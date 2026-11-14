import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth/auth.types';
import { OptionalSessionAuthGuard } from '../auth/optional-session-auth.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { RequestId } from '../common/request-id.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('posts/:postId/comments')
  @UseGuards(OptionalSessionAuthGuard)
  async list(
    @Param('postId') postId: string,
    @Query() query: ListCommentsQueryDto,
    @Req() request: Partial<AuthenticatedRequest>,
    @RequestId() requestId: string
  ) {
    return {
      ...(await this.comments.list(postId, query, request.user?.id)),
      request_id: requestId
    };
  }

  @Post('posts/:postId/comments')
  @UseGuards(SessionAuthGuard)
  async create(
    @Param('postId') postId: string,
    @Body() body: CreateCommentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ) {
    return this.comments.create({
      postId,
      bodyText: body.body_text,
      user: request.user,
      idempotencyKey,
      requestId
    });
  }

  @Delete('comments/:commentId')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async remove(
    @Param('commentId') commentId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedRequest,
    @RequestId() requestId: string
  ): Promise<void> {
    await this.comments.delete({
      commentId,
      user: request.user,
      idempotencyKey,
      requestId
    });
  }
}
