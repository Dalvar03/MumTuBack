import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(clerkUserId: string, dto: CreateJobDto) {
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

    return this.prisma.job.create({
      data: {
        title,
        description,
        price,
        city,
        address,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        placeId: dto.placeId ?? null,
        clientId: user.id,
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

    if (job.clientId !== user.id) {
      throw new ForbiddenException('You can cancel only your own jobs');
    }

    if (job.status !== JobStatus.OPEN) {
      throw new ConflictException('Only open jobs can be cancelled');
    }

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
}
