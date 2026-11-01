import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommissionInvoicesController } from './commission-invoices.controller';
import { CommissionInvoicesScheduler } from './commission-invoices.scheduler';
import { CommissionInvoicesService } from './commission-invoices.service';
import { FakturowniaService } from './fakturownia.service';

@Module({
  imports: [AuthModule],
  controllers: [CommissionInvoicesController],
  providers: [
    FakturowniaService,
    CommissionInvoicesService,
    CommissionInvoicesScheduler,
  ],
  exports: [CommissionInvoicesService],
})
export class CommissionInvoicesModule {}
