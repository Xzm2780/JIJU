import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/api-error';
import {
  decodePageCursor,
  encodePageCursor
} from '../common/page-cursor';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsDto) {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    if (from && to && from.getTime() > to.getTime()) {
      throw new ApiError(
        'JIJU_VALIDATION_4221',
        422,
        '开始时间不能晚于结束时间'
      );
    }
    const cursor = decodePageCursor(query.cursor);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        ...(query.actor_id ? { actorId: query.actor_id } : {}),
        ...(query.action_type ? { actionType: query.action_type } : {}),
        ...(query.object_type ? { objectType: query.object_type } : {}),
        ...(query.object_id ? { objectId: query.object_id } : {}),
        ...(from || to
          ? {
              occurredAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {})
              }
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                {
                  occurredAt: { lt: new Date(cursor.timestamp) }
                },
                {
                  occurredAt: new Date(cursor.timestamp),
                  id: { lt: cursor.id }
                }
              ]
            }
          : {})
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1
    });
    const page = logs.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.map((log) => ({
        id: log.id,
        actor_id: log.actorId,
        actor_role: log.actorRole,
        action_type: log.actionType,
        object_type: log.objectType,
        object_id: log.objectId,
        content_version: log.contentVersion,
        reason: log.reason,
        occurred_at: log.occurredAt.toISOString()
      })),
      page: {
        has_more: logs.length > query.limit,
        next_cursor:
          logs.length > query.limit && last
            ? encodePageCursor({
                version: 1,
                timestamp: last.occurredAt.toISOString(),
                id: last.id
              })
            : null
      }
    };
  }
}
