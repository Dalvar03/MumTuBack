import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CommissionInvoicesService } from './commission-invoices.service';

@Injectable()
export class CommissionInvoicesScheduler {
  constructor(
    private readonly commissionInvoicesService: CommissionInvoicesService,
  ) {}

  @Cron(process.env.FAKTUROWNIA_RETRY_CRON ?? '*/5 * * * *')
  retryOutstandingInvoices() {
    return this.commissionInvoicesService.retryOutstanding();
  }
}
