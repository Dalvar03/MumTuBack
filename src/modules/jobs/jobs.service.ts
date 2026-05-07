import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { S3Service } from 'src/common/s3/s3.service';
import { OpenJobsQueryDto } from './dto/open-jobs-query.dto';
import { buildJobsWhere } from './utils/queryBuilder';
import { TakeJobDto } from './dto/take-job-dto';
import { RateJobDto } from './dto/rate-job.dto';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
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

    const uploadedPhotos = await Promise.all(
      photos.map((photo) => this.s3Service.uploadFile(photo, 'jobs')),
    );

    return this.prisma.job.create({
      data: {
        title,
        description,
        price,
        city,
        address,
        category: dto.category,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        placeId: dto.placeId ?? null,
        clientId: user.id,
        imageIds: {
          create: uploadedPhotos.map((photo) => ({
            url: photo.url,
            key: photo.key,
          })),
        },
      },
      include: {
        imageIds: true,
      },
    });
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

  async getMyCreatedJobs(clerkUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.job.findMany({
      where: {
        clientId: user.id,
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

  async getMyAssignedJobs(clerkUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.job.findMany({
      where: {
        assignedWorkerId: user.id,
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

  async takeJob(clerkUserId: string, jobId: string, dto: TakeJobDto) {
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        payoutDetails: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'WORKER') {
      throw new ForbiddenException('Only workers can take jobs');
    }

    if (!user.payoutDetails && !dto.payoutDetails) {
      throw new BadRequestException('Payout details are required');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.payoutDetails) {
        await tx.workerPayoutDetails.upsert({
          where: { userId: user.id },
          update: { details: dto.payoutDetails },
          create: {
            userId: user.id,
            details: dto.payoutDetails,
          },
        });
      }

      const result = await tx.job.updateMany({
        where: {
          id: jobId,
          status: JobStatus.OPEN,
          assignedWorkerId: null,
        },
        data: {
          status: JobStatus.ASSIGNED,
          assignedWorkerId: user.id,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Job is already taken or unavailable');
      }

      const job = await tx.job.findUnique({
        where: { id: jobId },
        include: {
          client: true,
          assignedWorker: true,
        },
      });

      if (!job) {
        throw new NotFoundException('Job not found');
      }

      await tx.conversation.upsert({
        where: {
          jobId: job.id,
        },
        update: {},
        create: {
          jobId: job.id,
          clientId: job.clientId,
          workerId: user.id,
        },
      });

      return job;
    });
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
      if (job.status !== JobStatus.OPEN) {
        throw new ConflictException('Only open jobs can be cancelled');
      }

      if (job.clientId !== user.id) {
        throw new ForbiddenException('Only own jobs can be cancelled');
      }

      return this.prisma.job.delete({
        where: { id: jobId },
        include: {
          client: true,
          assignedWorker: true,
        },
      });
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
    const user = await this.prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: true,
        assignedWorker: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.clientId !== user.id) {
      throw new ForbiddenException('You can complete only your own jobs');
    }

    if (!job.assignedWorkerId) {
      throw new BadRequestException('Job has no assigned worker');
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
      },
    });

    return updatedJob;
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
