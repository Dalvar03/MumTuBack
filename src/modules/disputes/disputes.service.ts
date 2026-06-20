import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DisputeResolution,
  DisputeStatus,
  JobStatus,
  NotificationType,
  WorkerTransferStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateJobDisputeDto } from '../jobs/dto/create-job-dispute.dto';
import { JobCompletionService } from '../job-completion/job-completion.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly jobCompletionService: JobCompletionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async openByClient(
    jobId: string,
    clerkUserId: string,
    dto: CreateJobDisputeDto,
  ) {
    const client = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!client) {
      throw new NotFoundException('User not found');
    }

    if (client.role !== 'CLIENT') {
      throw new ForbiddenException('Only clients can open disputes');
    }

    const now = new Date();
    const dispute = await this.prisma.$transaction(async (tx) => {
      const result = await tx.job.updateMany({
        where: {
          id: jobId,
          clientId: client.id,
          status: JobStatus.AWAITING_APPROVAL,
          approvalDeadlineAt: {
            gt: now,
          },
          dispute: null,
          workerTransfer: null,
        },
        data: {
          status: JobStatus.DISPUTED,
        },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Dispute window expired or job cannot be disputed',
        );
      }

      return tx.jobDispute.create({
        data: {
          jobId,
          openedByClientId: client.id,
          reason: dto.reason,
          description: dto.description.trim(),
        },
        include: {
          job: true,
        },
      });
    });

    if (dispute.job.assignedWorkerId) {
      await this.notificationsService.createNotification({
        userId: dispute.job.assignedWorkerId,
        type: NotificationType.JOB_DISPUTED,
        title: 'Job disputed',
        message: 'The client opened a dispute for this job',
        jobId,
      });
    }

    return dispute;
  }

  async resolveToClient(disputeId: string, adminEmail: string) {
    const dispute = await this.reserveResolution(
      disputeId,
      DisputeResolution.CLIENT_REFUND,
      adminEmail,
    );

    try {
      const refund = await this.paymentsService.refundDisputedJob(
        dispute.jobId,
      );
      const paymentStatus = refund?.payment?.status;

      if (paymentStatus === 'REFUNDED') {
        await this.finalizeClientRefund(dispute.id);
      }

      return this.getDispute(dispute.id);
    } catch (error) {
      await this.reopenResolution(dispute.id, error);
      throw error;
    }
  }

  async resolveToWorker(disputeId: string, adminEmail: string) {
    const dispute = await this.reserveResolution(
      disputeId,
      DisputeResolution.WORKER_PAYOUT,
      adminEmail,
    );

    try {
      const job = await this.jobCompletionService.releaseAfterAdminDecision(
        dispute.jobId,
      );
      const transfer = job?.workerTransfer;

      await this.prisma.jobDispute.update({
        where: { id: dispute.id },
        data: {
          status: DisputeStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionError:
            transfer?.status === WorkerTransferStatus.FAILED
              ? transfer.lastError
              : null,
        },
      });

      await this.notifyResolution(dispute.jobId, 'Funds released to worker');
      return this.getDispute(dispute.id);
    } catch (error) {
      await this.reopenResolution(dispute.id, error);
      throw error;
    }
  }

  async finalizeClientRefund(disputeId: string) {
    const dispute = await this.prisma.jobDispute.findUnique({
      where: { id: disputeId },
    });

    if (
      !dispute ||
      dispute.status !== DisputeStatus.RESOLVING ||
      dispute.resolution !== DisputeResolution.CLIENT_REFUND
    ) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: dispute.jobId },
        data: {
          status: JobStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      }),
      this.prisma.jobDispute.update({
        where: { id: dispute.id },
        data: {
          status: DisputeStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionError: null,
        },
      }),
    ]);

    await this.notifyResolution(dispute.jobId, 'Client refund approved');
  }

  async reopenFailedClientRefund(jobId: string, error: string) {
    await this.prisma.$transaction([
      this.prisma.job.updateMany({
        where: {
          id: jobId,
          status: JobStatus.CANCELLED,
        },
        data: {
          status: JobStatus.DISPUTED,
          cancelledAt: null,
        },
      }),
      this.prisma.jobDispute.updateMany({
        where: {
          jobId,
          status: DisputeStatus.RESOLVING,
          resolution: DisputeResolution.CLIENT_REFUND,
        },
        data: {
          status: DisputeStatus.OPEN,
          resolution: null,
          resolvedByAdminEmail: null,
          resolutionError: error,
        },
      }),
    ]);
  }

  private async reserveResolution(
    disputeId: string,
    resolution: DisputeResolution,
    adminEmail: string,
  ) {
    const result = await this.prisma.jobDispute.updateMany({
      where: {
        id: disputeId,
        status: DisputeStatus.OPEN,
        job: {
          status: JobStatus.DISPUTED,
        },
      },
      data: {
        status: DisputeStatus.RESOLVING,
        resolution,
        resolvedByAdminEmail: adminEmail,
        resolutionError: null,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Dispute is already being resolved');
    }

    return this.getDispute(disputeId);
  }

  private async reopenResolution(disputeId: string, error: unknown) {
    await this.prisma.jobDispute.updateMany({
      where: {
        id: disputeId,
        status: DisputeStatus.RESOLVING,
      },
      data: {
        status: DisputeStatus.OPEN,
        resolution: null,
        resolvedByAdminEmail: null,
        resolutionError:
          error instanceof Error ? error.message : 'Resolution failed',
      },
    });
  }

  private async notifyResolution(jobId: string, message: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return;
    }

    const userIds = [job.clientId, job.assignedWorkerId].filter(
      (value): value is string => Boolean(value),
    );

    await Promise.all(
      userIds.map((userId) =>
        this.notificationsService.createNotification({
          userId,
          type: NotificationType.DISPUTE_RESOLVED,
          title: 'Dispute resolved',
          message,
          jobId,
        }),
      ),
    );
  }

  private getDispute(disputeId: string) {
    return this.prisma.jobDispute.findUniqueOrThrow({
      where: { id: disputeId },
      include: {
        job: {
          include: {
            payment: true,
            workerTransfer: true,
          },
        },
      },
    });
  }
}
