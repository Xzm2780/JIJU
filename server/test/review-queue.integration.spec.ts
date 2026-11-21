import { randomUUID } from 'node:crypto';
import {
  ReportReason,
  ReportStatus,
  ReportTargetType
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReviewQueueSource } from '../src/review-queue/dto/list-review-queue.dto';
import { ReviewQueueService } from '../src/review-queue/review-queue.service';

const describeIntegration =
  process.env.JIJU_RUN_INTEGRATION === 'true' ? describe : describe.skip;

describeIntegration('ReviewQueueService PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const service = new ReviewQueueService(prisma);
  const suffix = randomUUID();
  const reporterId = `usr_it_report_${suffix}`;
  const reportId = `rpt_it_${suffix}`;
  const moderationId = `mdr_it_${suffix}`;
  const targetId = `pst_it_${suffix}`;
  const queueAt = new Date('2026-11-14T02:00:00.000Z');

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: reporterId,
        authSubjectRef: `subject_${suffix}`,
        authProvider: 'MOCK',
        plazaNickname: 'integration reporter'
      }
    });
    await prisma.report.create({
      data: {
        id: reportId,
        reporterId,
        targetType: ReportTargetType.POST,
        targetId,
        contentVersion: 1,
        reason: ReportReason.ABUSE,
        otherDescription: 'must-not-appear-in-queue',
        status: ReportStatus.PENDING,
        dedupeKey: `dedupe_${suffix}`,
        submittedAt: queueAt
      }
    });
    await prisma.moderationRecord.create({
      data: {
        id: moderationId,
        targetType: 'POST',
        targetId,
        contentVersion: 1,
        status: 'PENDING',
        hitRuleRefs: ['review-rule'],
        createdAt: queueAt
      }
    });
  });

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { id: reportId } });
    await prisma.moderationRecord.deleteMany({ where: { id: moderationId } });
    await prisma.user.deleteMany({ where: { id: reporterId } });
    await prisma.$disconnect();
  });

  it('does not duplicate or leak fields across a multi-source cursor page', async () => {
    const first = await service.list({
      source: ReviewQueueSource.ALL,
      limit: 1
    });
    const second = await service.list({
      source: ReviewQueueSource.ALL,
      limit: 1,
      cursor: first.page.next_cursor ?? undefined
    });

    expect(first.data[0].source).toBe('report');
    expect(second.data[0].source).toBe('moderation');
    expect(first.data[0].item_id).not.toBe(second.data[0].item_id);
    expect(JSON.stringify(first)).not.toContain('must-not-appear-in-queue');
  });
});
