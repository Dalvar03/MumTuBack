import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PaymentsService } from './payments.service';

type AuthenticatedRequest = Request & {
  user: {
    clerkUserId: string;
  };
};

@Controller('payments/connect')
@UseGuards(ClerkAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('onboarding-link')
  createOnboardingLink(@Req() req: AuthenticatedRequest) {
    return this.paymentsService.createOnboardingLink(req.user.clerkUserId);
  }

  @Get('status')
  getConnectedAccountStatus(@Req() req: AuthenticatedRequest) {
    return this.paymentsService.getConnectedAccountStatus(req.user.clerkUserId);
  }
}
