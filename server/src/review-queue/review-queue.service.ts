import { Injectable } from '@nestjs/common';
import { Prisma, ReportStatus } from '@prisma/client';
import { decodeCursor, encodeCursor, QueueCursor } from '../common/cursor';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListReviewQueueDto,
  ReviewQueueSource
} from './dto/list-review-queue.dto';

export interface QueueItem {
  source: 'report' | 'moderation';
  item_id: string;
  target_type: string;
  target_id: string;
  content_version: number;
  status: string;
  reason_code: string | null;
  hit_rule_refs: unknown;
  queue_at: string;
}

const SOURCE_RANK = {
  report: 0,
  moderation: 1
} as const;

@Injectable()
export class ReviewQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListReviewQueueDto) {
    const source = query.source ?? ReviewQueueSource.ALL;
    const cursor = decodeCursor(query.cursor);
    const limit = query.limit ?? 20;

    const reportPromise =
      source === ReviewQueueSource.MODERATION
        ? Promise.resolve([])
        : this.prisma.report.findMany({
            where: {
              status: { in: [ReportStatus.PENDING, ReportStatus.PROCESSING] },
              ...this.reportCursorWhere(cursor)
            },
            orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
            take: limit + 1
          });

    const moderationPromise =
      source === ReviewQueueSource.REPORT
        ? Promise.resolve([])
        : this.prisma.moderationRecord.findMany({
            where: {
              status: { in: ['PENDING', 'PROCESSING'] },
              ...this.moderationCursorWhere(cursor)
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            take: limit + 1
          });

    const [reports, moderation] = await Promise.all([
      reportPromise,
      moderationPromise
    ]);
    const items: QueueItem[] = [
      ...reports.map((report) => ({
        source: 'report' as const,
        item_id: report.id,
        target_type: report.targetType,
        target_id: report.targetId,
        content_version: report.contentVersion,
        status: report.status,
        reason_code: report.reason,
        hit_rule_refs: null,
        queue_at: report.submittedAt.toISOString()
      })),
      ...moderation.map((record) => ({
        source: 'moderation' as const,
        item_id: record.id,
        target_type: record.targetType,
        target_id: record.targetId,
        content_version: record.contentVersion,
        status: record.status,
        reason_code: null,
        hit_rule_refs: record.hitRuleRefs,
        queue_at: record.createdAt.toISOString()
      }))
    ];

    const afterCursor = cursor
      ? items.filter((item) => this.compareItemToCursor(item, cursor) > 0)
      : items;
    afterCursor.sort((left, right) => this.compareItems(left, right));
    const page = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const last = page.at(-1);

    return {
      data: page,
      page: {
        has_more: hasMore,
        next_cursor:
          hasMore && last
            ? encodeCursor({
                version: 1,
                source: last.source,
                queueAt: last.queue_at,
                itemId: last.item_id
              })
            : null
      }
    };
  }

  private compareItems(left: QueueItem, right: QueueItem): number {
    return (
      Date.parse(left.queue_at) - Date.parse(right.queue_at) ||
      SOURCE_RANK[left.source] - SOURCE_RANK[right.source] ||
      left.item_id.localeCompare(right.item_id)
    );
  }

  private compareItemToCursor(item: QueueItem, cursor: QueueCursor): number {
    return (
      Date.parse(item.queue_at) - Date.parse(cursor.queueAt) ||
      SOURCE_RANK[item.source] - SOURCE_RANK[cursor.source] ||
      item.item_id.localeCompare(cursor.itemId)
    );
  }

  private reportCursorWhere(
    cursor: QueueCursor | null
  ): { OR?: Prisma.ReportWhereInput[] } {
    if (!cursor) {
      return {};
    }
    const queueAt = new Date(cursor.queueAt);
    return {
      OR: [
        { submittedAt: { gt: queueAt } },
        ...(SOURCE_RANK.report >= SOURCE_RANK[cursor.source]
          ? [
              {
                submittedAt: queueAt,
                ...(SOURCE_RANK.report === SOURCE_RANK[cursor.source]
                  ? { id: { gt: cursor.itemId } }
                  : {})
              }
            ]
          : [])
      ]
    };
  }

  private moderationCursorWhere(
    cursor: QueueCursor | null
  ): { OR?: Prisma.ModerationRecordWhereInput[] } {
    if (!cursor) {
      return {};
    }
    const queueAt = new Date(cursor.queueAt);
    return {
      OR: [
        { createdAt: { gt: queueAt } },
        ...(SOURCE_RANK.moderation >= SOURCE_RANK[cursor.source]
          ? [
              {
                createdAt: queueAt,
                ...(SOURCE_RANK.moderation === SOURCE_RANK[cursor.source]
                  ? { id: { gt: cursor.itemId } }
                  : {})
              }
            ]
          : [])
      ]
    };
  }
}
