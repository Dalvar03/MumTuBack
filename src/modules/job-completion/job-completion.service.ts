import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JobApprovalSource,
  JobPaymentStatus,
  JobStatus,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class JobCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submitByWorker(jobId: string, clerkUserId: string) {
    const worker = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!worker) {
      throw new NotFoundException('User not found');
    }

    if (worker.role !== 'WORKER') {
      throw new ForbiddenException('Only workers can submit completion');
    }

    const now = new Date();
    const approvalDeadlineAt = new Date(
      now.getTime() + this.getApprovalWindowMs(),
    );

    const result = await this.prisma.job.updateMany({
      where: {
        id: jobId,
        assignedWorkerId: worker.id,
        status: {
          in: [JobStatus.ASSIGNED, JobStatus.IN_PROGRESS],
        },
        payment: {
          status: JobPaymentStatus.SUCCEEDED,
        },
        dispute: null,
      },
      data: {
        status: JobStatus.AWAITING_APPROVAL,
        workerCompletedAt: now,
        approvalDeadlineAt,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Job is not eligible for worker completion');
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    await this.notificationsService.createNotification({
      userId: job.clientId,
      type: NotificationType.WORKER_COMPLETED_JOB,
      title: 'Worker completed the job',
      message: 'Review the work within 24 hours or it will be auto-approved',
      jobId: job.id,
    });

    return job;
  }

  async approveByClient(jobId: string, clerkUserId: string) {
    const client = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!client) {
      throw new NotFoundException('User not found');
    }

    return this.releaseWorkerFunds(jobId, JobApprovalSource.CLIENT, client.id);
  }

  async autoApproveExpiredJobs() {
    const jobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.AWAITING_APPROVAL,
        approvalDeadlineAt: {
          lte: new Date(),
        },
        dispute: null,
      },
      select: {
        id: true,
      },
      take: 100,
    });

    for (const job of jobs) {
      try {
        await this.releaseWorkerFunds(job.id, JobApprovalSource.AUTO);
      } catch {
        // A concurrent approval or dispute can legitimately win the race.
      }
    }
  }

  async releaseAfterAdminDecision(jobId: string) {
    return this.releaseWorkerFunds(jobId, JobApprovalSource.ADMIN);
  }

  private async releaseWorkerFunds(
    jobId: string,
    source: JobApprovalSource,
    clientId?: string,
  ) {
    const now = new Date();
    const where =
      source === JobApprovalSource.ADMIN
        ? {
            id: jobId,
            status: JobStatus.DISPUTED,
            dispute: {
              status: 'RESOLVING' as const,
              resolution: 'WORKER_PAYOUT' as const,
            },
          }
        : {
            id: jobId,
            status: JobStatus.AWAITING_APPROVAL,
            clientId:
              source === JobApprovalSource.CLIENT ? clientId : undefined,
            approvalDeadlineAt:
              source === JobApprovalSource.AUTO ? { lte: now } : undefined,
            dispute: null,
          };

    const result = await this.prisma.job.updateMany({
      where,
      data: {
        status: JobStatus.COMPLETED,
        approvedAt: now,
        completedAt: now,
        approvalSource: source,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Job cannot be approved');
    }

    const transfer =
      await this.paymentsService.createAndExecuteWorkerTransfer(jobId);
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        assignedWorkerId: true,
      },
    });

    if (job?.assignedWorkerId) {
      await this.notificationsService.createNotification({
        userId: job.assignedWorkerId,
        type:
          transfer.status === 'FAILED'
            ? NotificationType.WORKER_PAYOUT_FAILED
            : source === JobApprovalSource.AUTO
              ? NotificationType.JOB_AUTO_APPROVED
              : NotificationType.JOB_APPROVED,
        title: 'Job approved',
        message:
          transfer.status === 'SUCCEEDED'
            ? 'Worker payout was released'
            : 'Job was approved, but payout requires attention',
        jobId,
      });
    }

    return this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        workerTransfer: true,
      },
    });
  }

  private getApprovalWindowMs() {
    const hours = Number(process.env.JOB_APPROVAL_WINDOW_HOURS ?? 24);

    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error('JOB_APPROVAL_WINDOW_HOURS must be a positive number');
    }

    return hours * 60 * 60 * 1000;
  }
}
