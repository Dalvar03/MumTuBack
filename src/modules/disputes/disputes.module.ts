import { Module } from '@nestjs/common';
import { JobCompletionModule } from '../job-completion/job-completion.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { DisputesService } from './disputes.service';

@Module({
  imports: [PaymentsModule, JobCompletionModule, NotificationsModule],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
