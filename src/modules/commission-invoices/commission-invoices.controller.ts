import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CommissionInvoicesService } from './commission-invoices.service';

type AuthenticatedRequest = Request & {
  user: {
    clerkUserId: string;
  };
};

@Controller('commission-invoices')
@UseGuards(ClerkAuthGuard)
export class CommissionInvoicesController {
  constructor(
    private readonly commissionInvoicesService: CommissionInvoicesService,
  ) {}

  @Get()
  listMine(@Req() req: AuthenticatedRequest) {
    return this.commissionInvoicesService.listForWorker(req.user.clerkUserId);
  }
}
