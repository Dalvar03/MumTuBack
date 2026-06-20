import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { S3Service } from 'src/common/s3/s3.service';
import { OpenJobsQueryDto } from './dto/open-jobs-query.dto';
import { buildJobsWhere } from './utils/queryBuilder';
import { RateJobDto } from './dto/rate-job.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { JobCompletionService } from '../job-completion/job-completion.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly notificationsService: NotificationsService,
    private readonly paymentsService: PaymentsService,
    private readonly jobCompletionService: JobCompletionService,
  ) {}

  async createJob(
    clerkUserId: string,
    dto: CreateJobDto,
    photos: Express.Multer.File[],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'CLIENT') {
      throw new ForbiddenException('Only clients can create jobs');
    }

    const title = dto.title.trim();
    const description = dto.description.trim();
    const city = dto.city.trim();
    const address = dto.address.trim();
    const price = new Prisma.Decimal(dto.price);
    const paymentAmounts = this.paymentsService.getPaymentAmounts(price);

    const uploadedPhotos = await Promise.all(
      photos.map((photo) => this.s3Service.uploadFile(photo, 'jobs')),
    );

    const job = await this.prisma.job.create({
      data: {
        title,
        description,
        price,
        status: JobStatus.PAYMENT_PENDING,
        ...paymentAmounts,
        city,
        address,
        category: dto.category,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        placeId: dto.placeId ?? null,
        clientId: user.id,
        payment: {
          create: {
            status: 'CREATED',
            amountMinor: paymentAmounts.amountMinor,
            currency: paymentAmounts.currency,
          },
        },
        imageIds: {
          create: uploadedPhotos.map((photo) => ({
            url: photo.url,
            key: photo.key,
          })),
        },
      },
      include: {
        imageIds: true,
        payment: true,
      },
    });

    const checkout = await this.paymentsService.createCheckoutSession(
      job.id,
      user.id,
    );

    return {
      job,
      ...checkout,
    };
  }

  async getOpenJobs(clerkUserId: string, query: OpenJobsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const worker = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (
      !worker ||
      worker.role !== 'WORKER' ||
      worker.latitude === null ||
      worker.longitude === null ||
      worker.workRadiusKm === null
    ) {
      return {
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const whereSql = buildJobsWhere({
      status: query.status ?? JobStatus.OPEN,
      workerLat: worker.latitude,
      workerLon: worker.longitude,
      radiusKm: worker.workRadiusKm,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      category: query.category,
    });

    const data = await this.prisma.$queryRaw`
  SELECT
    j.*,
    (
      6371 * acos(
        cos(radians(${worker.latitude}))
        * cos(radians(j.latitude))
        * cos(radians(j.longitude) - radians(${worker.longitude}))
        + sin(radians(${worker.latitude}))
        * sin(radians(j.latitude))
      )
    ) AS "distanceKm"
  FROM "Job" j
  WHERE ${whereSql}
  ORDER BY "distanceKm" ASC
  LIMIT ${limit}
  OFFSET ${offset};
`;

    const totalResult = await this.prisma.$queryRaw<{ count: bigint }[]>`
  SELECT COUNT(*)::bigint AS count
  FROM "Job" j
  WHERE ${whereSql};
`;

    const total = Number(totalResult[0]?.count ?? 0);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyCreatedJobs(clerkUserId: string, status?: JobStatus) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.job.findMany({
      where: {
        clientId: user.id,
        status,
      },
      include: {
        client: true,
        assignedWorker: true,
        imageIds: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getMyAssignedJobs(clerkUserId: string, status?: JobStatus) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.job.findMany({
      where: {
        assignedWorkerId: user.id,
        status,
      },
      include: {
        client: true,
        assignedWorker: true,
        imageIds: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getJobById(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: true,
        assignedWorker: true,
        imageIds: true,
        conversation: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async takeJob(clerkUserId: string, jobId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'WORKER') {
      throw new ForbiddenException('Only workers can take jobs');
    }

    if (
      !user.stripeAccountId ||
      !user.stripeTransfersEnabled ||
      !user.stripePayoutsEnabled ||
      user.stripeOnboardingStatus !== 'COMPLETE'
    ) {
      throw new BadRequestException(
        'Complete Stripe Connect onboarding before taking jobs',
      );
    }

    const job = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "User"
        WHERE "id" = ${user.id}
        FOR UPDATE
      `;

      const activeJobsCount = await tx.job.count({
        where: {
          assignedWorkerId: user.id,
          status: {
            in: [JobStatus.ASSIGNED, JobStatus.IN_PROGRESS],
          },
        },
      });

      if (activeJobsCount >= 3) {
        throw new ConflictException(
          'Worker cannot have more than 3 unfinished jobs',
        );
      }

      const result = await tx.job.updateMany({
        where: {
          id: jobId,
          status: JobStatus.OPEN,
          assignedWorkerId: null,
          payment: {
            status: 'SUCCEEDED',
          },
        },
        data: {
          status: JobStatus.ASSIGNED,
          assignedWorkerId: user.id,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Job is already taken or unavailable');
      }

      const updatedJob = await tx.job.findUnique({
        where: { id: jobId },
        include: {
          client: true,
          assignedWorker: true,
        },
      });

      if (!updatedJob) {
        throw new NotFoundException('Job not found');
      }

      await tx.conversation.upsert({
        where: {
          jobId: updatedJob.id,
        },
        update: {},
        create: {
          jobId: updatedJob.id,
          clientId: updatedJob.clientId,
          workerId: user.id,
        },
      });

      return updatedJob;
    });

    await this.notificationsService.createNotification({
      userId: job.clientId,
      type: NotificationType.JOB_ASSIGNED,
      title: 'Job assigned',
      message: `${job.assignedWorker?.username ?? 'Worker'} accepted your job`,
      jobId: job.id,
    });

    return job;
  }

  async cancelJob(clerkUserId: string, jobId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (user.role === 'CLIENT') {
      if (job.status !== JobStatus.OPEN && job.status !== JobStatus.CANCELLED) {
        throw new ConflictException('Only open jobs can be cancelled');
      }

      if (job.clientId !== user.id) {
        throw new ForbiddenException('Only own jobs can be cancelled');
      }

      if (job.assignedWorkerId) {
        throw new ConflictException('Assigned jobs cannot be refunded');
      }

      return this.paymentsService.refundOpenJob(job.id, user.id);
    }

    if (user.role === 'WORKER') {
      if (job.status !== JobStatus.ASSIGNED) {
        throw new ConflictException('Only not completed job can be cancelled');
      }

      if (job.assignedWorkerId !== user.id) {
        throw new ForbiddenException('Only own jobs can be cancelled');
      }

      return this.prisma.job.update({
        where: {
          id: jobId,
        },
        data: {
          assignedWorkerId: null,
          status: JobStatus.OPEN,
        },
        include: {
          assignedWorker: true,
          client: true,
        },
      });
    }
  }

  async markAsCompletedByClient(jobId: string, clerkUserId: string) {
    return this.jobCompletionService.approveByClient(jobId, clerkUserId);
  }

  submitCompletionByWorker(jobId: string, clerkUserId: string) {
    return this.jobCompletionService.submitByWorker(jobId, clerkUserId);
  }

  async rateJob(dto: RateJobDto, fromUserId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
    });

    if (!job) throw new NotFoundException();

    if (job.status !== 'COMPLETED') {
      throw new BadRequestException('Job not completed');
    }

    const toUserId =
      job.assignedWorkerId === fromUserId ? job.clientId : job.assignedWorkerId;

    if (!toUserId) {
      throw new BadRequestException('No user to rate');
    }

    const rating = await this.prisma.rating.create({
      data: {
        jobId: dto.jobId,
        fromUserId,
        toUserId,
        value: dto.value,
        comment: dto.comment,
      },
    });

    // 🔥 апдейт рейтингу юзера
    await this.updateUserRating(toUserId, dto.value);

    return rating;
  }

  private async updateUserRating(userId: string, newRating: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const newCount = (user?.ratingsCount || 0) + 1;

    const newAvg =
      ((user?.averageRating || 0) * (user?.ratingsCount || 0) + newRating) /
      newCount;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        averageRating: newAvg,
        ratingsCount: newCount,
      },
    });
  }
}
