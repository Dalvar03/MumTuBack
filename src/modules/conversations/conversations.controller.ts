import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { SendMessageDto } from './dtos/send-message.dto';
import { ConversationResponseDto } from './dtos/conversation-response.dto';
import { MessageResponseDto } from './dtos/message-response.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

type AuthenticatedRequest = Request & {
  user: {
    clerkUserId: string;
  };
};

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user conversations' })
  @ApiOkResponse({
    type: ConversationResponseDto,
    isArray: true,
  })
  getMyConversations(@Req() req: AuthenticatedRequest) {
    return this.conversationsService.getMyConversations(req.user.clerkUserId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by id' })
  @ApiParam({ name: 'id', example: 'clx123conversationid' })
  @ApiOkResponse({
    type: ConversationResponseDto,
  })
  getConversationById(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.conversationsService.getConversationById(
      req.user.clerkUserId,
      id,
    );
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get conversation messages' })
  @ApiParam({ name: 'id', example: 'clx123conversationid' })
  @ApiOkResponse({
    type: MessageResponseDto,
    isArray: true,
  })
  getMessages(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.conversationsService.getMessages(req.user.clerkUserId, id);
  }

  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Send message to conversation' })
  @ApiParam({ name: 'id', example: 'clx123conversationid' })
  @Post(':id/messages')
  @UseInterceptors(FilesInterceptor('image'))
  @ApiCreatedResponse({
    type: MessageResponseDto,
  })
  sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.conversationsService.sendMessage(
      req.user.clerkUserId,
      id,
      dto,
      image,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark conversation messages as read' })
  @ApiParam({ name: 'id', example: 'clx123conversationid' })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
      },
    },
  })
  markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.conversationsService.markAsRead(req.user.clerkUserId, id);
  }
}
