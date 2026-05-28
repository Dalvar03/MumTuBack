import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUser as CurrentUserType } from '../../common/types/current-user.type';
import { NotificationsService } from './notifications.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationResponseDto } from './dtos/notificationResponse.dto';

@UseGuards(ClerkAuthGuard)
@ApiTags('Notifications')
@UseGuards(ClerkAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user notifications',
  })
  @ApiOkResponse({
    description: 'List of notifications',
    type: NotificationResponseDto,
    isArray: true,
  })
  getMyNotifications(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.getMyNotifications(user.id);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notifications count',
  })
  @ApiOkResponse({
    description: 'Unread notifications count',
    schema: {
      example: {
        count: 5,
      },
    },
  })
  async getUnreadCount(@CurrentUser() user: CurrentUserType) {
    const count = await this.notificationsService.getUnreadCount(user.id);

    return {
      count,
    };
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: 'cm123abc',
  })
  @ApiOkResponse({
    description: 'Notification marked as read',
  })
  markAsRead(@CurrentUser() user: CurrentUserType, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
  })
  @ApiOkResponse({
    description: 'All notifications marked as read',
  })
  markAllAsRead(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
