import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { UserResponseDto } from './dto/user-response.dto';
import { ApiResponse } from '@nestjs/swagger';
import { UpdateBillingProfileDto } from './dto/update-billing-profile.dto';

type AuthenticatedRequest = Request & {
  user: {
    clerkUserId: string;
  };
};

@Controller('users')
@UseGuards(ClerkAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiResponse({
    status: 200,
    type: [UserResponseDto],
  })
  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.usersService.getMe(req.user.clerkUserId);
  }

  @Patch('onboarding')
  updateOnboarding(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOnboardingDto,
  ) {
    return this.usersService.updateOnboarding(req.user.clerkUserId, dto);
  }

  @Patch('me/billing-profile')
  updateBillingProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateBillingProfileDto,
  ) {
    return this.usersService.updateBillingProfile(req.user.clerkUserId, dto);
  }
}
