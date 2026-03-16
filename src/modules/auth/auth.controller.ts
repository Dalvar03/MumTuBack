import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../common/types/current-user.type';
import { AuthService } from './auth.service';
import { ClerkAuthGuard } from './clerk-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(ClerkAuthGuard)
  getMe(@CurrentUser() user: CurrentUserType) {
    return this.authService.getMe(user);
  }
}
