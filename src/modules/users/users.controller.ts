import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { UserResponseDto } from './dto/user-response.dto';
import { ApiResponse } from '@nestjs/swagger';

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
}
