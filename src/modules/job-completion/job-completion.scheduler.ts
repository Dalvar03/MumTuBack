import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobCompletionService } from './job-completion.service';

@Injectable()
export class JobCompletionScheduler {
  constructor(private readonly jobCompletionService: JobCompletionService) {}

  @Cron(process.env.JOB_APPROVAL_SWEEP_CRON ?? '*/1 * * * *')
  autoApproveExpiredJobs() {
    return this.jobCompletionService.autoApproveExpiredJobs();
  }
}
