import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { JobCompletionScheduler } from './job-completion.scheduler';
import { JobCompletionService } from './job-completion.service';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  providers: [JobCompletionService, JobCompletionScheduler],
  exports: [JobCompletionService],
})
export class JobCompletionModule {}
