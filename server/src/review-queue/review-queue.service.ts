import { Injectable } from '@nestjs/common';
import {
  ModerationPriority,
  Prisma,
  ReportStatus
} from '@prisma/client';
import { decodeCursor, encodeCursor, QueueCursor } from '../common/cursor';
import { PrismaService } from '../prisma/prisma.service';
import {
  ListReviewQueueDto,
  ReviewQueueSource
} from './dto/list-review-queue.dto';

interface QueueItem {
  source: 'report' | 'moderation';
  item_id: string;
  target_type: string;
  target_id: string;
  content_version: number;
  priority: ModerationPriority;
  priority_rank: number;
  status: string;
  reason_code: string | null;
  hit_rule_refs: unknown;
  is_minor_related: boolean;
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
    const priorityRank =
      query.priority === undefined
        ? undefined
        : query.priority === ModerationPriority.PREEMPTIVE
          ? 0
          : 1;
    const limit = query.limit ?? 20;

    const reportPromise =
      source === ReviewQueueSource.MODERATION
        ? Promise.resolve([])
        : this.prisma.report.findMany({
            where: {
              status: { in: [ReportStatus.PENDING, ReportStatus.PROCESSING] },
              ...(priorityRank === undefined ? {} : { priorityRank }),
              ...this.reportCursorWhere(cursor)
            },
            orderBy: [
              { priorityRank: 'asc' },
              { submittedAt: 'asc' },
              { id: 'asc' }
            ],
            take: limit + 1
          });

    const moderationPromise =
      source === ReviewQueueSource.REPORT
        ? Promise.resolve([])
        : this.prisma.moderationRecord.findMany({
            where: {
              status: { in: ['PENDING', 'PROCESSING'] },
              ...(priorityRank === undefined ? {} : { priorityRank }),
              ...this.moderationCursorWhere(cursor)
            },
            orderBy: [
              { priorityRank: 'asc' },
              { createdAt: 'asc' },
              { id: 'asc' }
            ],
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
        priority: report.priority,
        priority_rank: report.priorityRank,
        status: report.status,
        reason_code: report.reason,
        hit_rule_refs: null,
        is_minor_related: report.isMinorRelated,
        queue_at: report.submittedAt.toISOString()
      })),
      ...moderation.map((record) => ({
        source: 'moderation' as const,
        item_id: record.id,
        target_type: record.targetType,
        target_id: record.targetId,
        content_version: record.contentVersion,
        priority: record.priority,
        priority_rank: record.priorityRank,
        status: record.status,
        reason_code: null,
        hit_rule_refs: record.hitRuleRefs,
        is_minor_related: false,
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
      data: page.map(({ priority_rank: _priorityRank, ...item }) => item),
      page: {
        has_more: hasMore,
        next_cursor:
          hasMore && last
            ? encodeCursor({
                version: 1,
                source: last.source,
                priorityRank: last.priority_rank,
                queueAt: last.queue_at,
                itemId: last.item_id
              })
            : null
      }
    };
  }

  private compareItems(left: QueueItem, right: QueueItem): number {
    return (
      left.priority_rank - right.priority_rank ||
      Date.parse(left.queue_at) - Date.parse(right.queue_at) ||
      SOURCE_RANK[left.source] - SOURCE_RANK[right.source] ||
      left.item_id.localeCompare(right.item_id)
    );
  }

  private compareItemToCursor(item: QueueItem, cursor: QueueCursor): number {
    return (
      item.priority_rank - cursor.priorityRank ||
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
        { priorityRank: { gt: cursor.priorityRank } },
        {
          priorityRank: cursor.priorityRank,
          submittedAt: { gt: queueAt }
        },
        ...(SOURCE_RANK.report >= SOURCE_RANK[cursor.source]
          ? [
              {
                priorityRank: cursor.priorityRank,
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
        { priorityRank: { gt: cursor.priorityRank } },
        {
          priorityRank: cursor.priorityRank,
          createdAt: { gt: queueAt }
        },
        ...(SOURCE_RANK.moderation >= SOURCE_RANK[cursor.source]
          ? [
              {
                priorityRank: cursor.priorityRank,
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
