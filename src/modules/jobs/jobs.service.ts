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

  async getOpenJobs() {
    return this.prisma.job.findMany({
      where: {
        status: JobStatus.OPEN,
        assignedWorkerId: null,
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

    const result = await this.prisma.job.updateMany({
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

    return this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: true,
        assignedWorker: true,
      },
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

    // TODO: Restrict to cancel only related to user jobs

    // if (job.status !== JobStatus.OPEN) {
    //   throw new ConflictException('Only open jobs can be cancelled');
    // }

    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
      },
      include: {
        client: true,
        assignedWorker: true,
      },
    });
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

    if (job.status !== JobStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Only jobs in progress can be marked as completed',
      );
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
      },
    });

    return updatedJob;
  }
}
