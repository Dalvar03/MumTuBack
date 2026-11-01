import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeService } from './stripe.service';
import { CommissionInvoicesModule } from '../commission-invoices/commission-invoices.module';

@Module({
  imports: [AuthModule, CommissionInvoicesModule],
  controllers: [PaymentsController, StripeWebhookController],
  providers: [StripeService, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
