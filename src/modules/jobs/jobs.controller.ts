import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ApiOperation } from '@nestjs/swagger';

type AuthenticatedRequest = Request & {
  user: {
    clerkUserId: string;
  };
};

@Controller('jobs')
@UseGuards(ClerkAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @ApiOperation({ summary: 'Create a new job (CLIENT only)' })
  @Post()
  createJob(@Req() req: AuthenticatedRequest, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(req.user.clerkUserId, dto);
  }

  @Get('open')
  getOpenJobs() {
    return this.jobsService.getOpenJobs();
  }

  @Get('my-created')
  getMyCreatedJobs(@Req() req: AuthenticatedRequest) {
    return this.jobsService.getMyCreatedJobs(req.user.clerkUserId);
  }

  @Get('my-assigned')
  getMyAssignedJobs(@Req() req: AuthenticatedRequest) {
    return this.jobsService.getMyAssignedJobs(req.user.clerkUserId);
  }

  @Get(':id')
  getJobById(@Param('id') id: string) {
    return this.jobsService.getJobById(id);
  }

  @Patch(':id/take')
  takeJob(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.jobsService.takeJob(req.user.clerkUserId, id);
  }

  @Patch(':id/cancel')
  cancelJob(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.jobsService.cancelJob(req.user.clerkUserId, id);
  }
}
