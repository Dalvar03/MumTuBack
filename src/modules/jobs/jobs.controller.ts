import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  UploadedFiles,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { Request } from 'express';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JobResponseDto } from './dto/job-response.dto';
import { OpenJobsQueryDto } from './dto/open-jobs-query.dto';
import { PaginatedJobsResponseDto } from './dto/paginated-jobs-response';
import { RateJobDto } from './dto/rate-job.dto';
import { CreateJobDisputeDto } from './dto/create-job-dispute.dto';
import { DisputesService } from '../disputes/disputes.service';

type AuthenticatedRequest = Request & {
  user: {
    clerkUserId: string;
  };
};

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(ClerkAuthGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly disputesService: DisputesService,
  ) {}

  @ApiOperation({ summary: 'Create a new job with optional photos' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        city: { type: 'string' },
        category: { type: 'string' },
        address: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        placeId: { type: 'string' },
        photos: {
          type: 'array',
          items: {
            type: 'file',
            format: 'binary',
          },
        },
      },
      required: [
        'title',
        'description',
        'price',
        'city',
        'address',
        'category',
      ],
    },
  })
  @UseInterceptors(
    FilesInterceptor('photos', 10, {
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Only JPG, PNG, and WEBP images are allowed',
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  @Post()
  async createJob(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateJobDto,
    @UploadedFiles() photos: Express.Multer.File[],
  ) {
    return this.jobsService.createJob(req.user.clerkUserId, dto, photos ?? []);
  }

  @ApiOperation({ summary: 'Get all open jobs' })
  @ApiOkResponse({
    description: 'List of open jobs',
    type: PaginatedJobsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @Get('open')
  getOpenJobs(
    @Req() req: AuthenticatedRequest,
    @Query() query: OpenJobsQueryDto,
  ) {
    return this.jobsService.getOpenJobs(req.user.clerkUserId, query);
  }

  @ApiOperation({ summary: 'Get jobs created by the current user' })
  @ApiOkResponse({
    description: 'List of jobs created by current user',
    type: JobResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Get('my-created')
  getMyCreatedJobs(@Req() req: AuthenticatedRequest) {
    return this.jobsService.getMyCreatedJobs(req.user.clerkUserId);
  }

  @ApiOperation({ summary: 'Get jobs assigned to the current worker' })
  @ApiOkResponse({
    description: 'List of jobs assigned to current user',
    type: JobResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @Get('my-assigned')
  getMyAssignedJobs(@Req() req: AuthenticatedRequest) {
    return this.jobsService.getMyAssignedJobs(req.user.clerkUserId);
  }

  @ApiOperation({ summary: 'Get job details by ID' })
  @ApiParam({
    name: 'id',
    description: 'Job ID',
    example: 'cm9job123abc456def',
  })
  @ApiOkResponse({
    description: 'Job details',
    type: JobResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Job not found' })
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

  @Patch(':id/done')
  markAsCompleted(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.jobsService.markAsCompletedByClient(id, req.user.clerkUserId);
  }

  @Patch(':id/submit-completion')
  submitCompletion(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.jobsService.submitCompletionByWorker(id, req.user.clerkUserId);
  }

  @Post(':id/disputes')
  openDispute(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateJobDisputeDto,
  ) {
    return this.disputesService.openByClient(id, req.user.clerkUserId, dto);
  }

  @Post('rate')
  @UseGuards(ClerkAuthGuard)
  rate(@Body() dto: RateJobDto, @Req() req: AuthenticatedRequest) {
    return this.jobsService.rateJob(dto, req.user.id);
  }
}
