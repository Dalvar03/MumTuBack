import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from 'src/common/s3/s3.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { JobCompletionModule } from '../job-completion/job-completion.module';
import { DisputesModule } from '../disputes/disputes.module';

@Module({
  imports: [
    AuthModule,
    S3Module,
    NotificationsModule,
    PaymentsModule,
    JobCompletionModule,
    DisputesModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
