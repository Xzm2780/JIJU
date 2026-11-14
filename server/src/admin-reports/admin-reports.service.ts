import { Injectable } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import {
  decodePageCursor,
  encodePageCursor
} from '../common/page-cursor';
import { PrismaService } from '../prisma/prisma.service';
import { ListAdminReportsDto } from './dto/list-admin-reports.dto';

@Injectable()
export class AdminReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAdminReportsDto) {
    const cursor = decodePageCursor(query.cursor);
    const reports = await this.prisma.report.findMany({
      where: {
        status: query.status
          ? query.status
          : { in: [ReportStatus.PENDING, ReportStatus.PROCESSING] },
        ...(query.priority
          ? { priority: query.priority }
          : {}),
        ...(query.reason ? { reason: query.reason } : {}),
        ...(cursor
          ? {
              OR: [
                {
                  priorityRank: {
                    gt: cursor.priorityRank ?? 0
                  }
                },
                {
                  priorityRank: cursor.priorityRank ?? 0,
                  submittedAt: { lt: new Date(cursor.timestamp) }
                },
                {
                  priorityRank: cursor.priorityRank ?? 0,
                  submittedAt: new Date(cursor.timestamp),
                  id: { lt: cursor.id }
                }
              ]
            }
          : {})
      },
      orderBy: [
        { priorityRank: 'asc' },
        { submittedAt: 'desc' },
        { id: 'desc' }
      ],
      take: query.limit + 1
    });
    const page = reports.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.map((report) => ({
        id: report.id,
        target_type: report.targetType,
        target_id: report.targetId,
        content_version: report.contentVersion,
        reason: report.reason,
        ...(report.otherDescription
          ? { other_description: report.otherDescription }
          : {}),
        is_minor_related: report.isMinorRelated,
        priority: report.priority,
        status: report.status,
        submitted_at: report.submittedAt.toISOString()
      })),
      page: {
        has_more: reports.length > query.limit,
        next_cursor:
          reports.length > query.limit && last
            ? encodePageCursor({
                version: 1,
                timestamp: last.submittedAt.toISOString(),
                id: last.id,
                priorityRank: last.priorityRank
              })
            : null
      }
    };
  }
}
