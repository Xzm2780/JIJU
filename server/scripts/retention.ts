import { PrismaClient, PublicStatus } from '@prisma/client';

const prisma = new PrismaClient();

function days(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<void> {
  const now = new Date();
  const viewCutoff = new Date(
    now.getTime() -
      days(process.env.VIEW_RECORD_RETENTION_DAYS, 30) * 86400000
  );
  const auditCutoff = new Date(
    now.getTime() -
      days(process.env.AUDIT_LOG_RETENTION_DAYS, 180) * 86400000
  );
  const expiredPostCutoff = new Date(
    now.getTime() -
      days(process.env.EXPIRED_POST_BODY_RETENTION_DAYS, 30) * 86400000
  );

  await prisma.viewRecord.deleteMany({
    where: { viewedAt: { lt: viewCutoff } }
  });
  await prisma.auditLog.deleteMany({
    where: { occurredAt: { lt: auditCutoff } }
  });
  await prisma.idempotencyRecord.deleteMany({
    where: { expiresAt: { lt: now } }
  });
  await prisma.authSession.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: auditCutoff } }]
    }
  });
  await prisma.post.updateMany({
    where: {
      expiresAt: { lt: expiredPostCutoff },
      publicStatus: PublicStatus.EXPIRED,
      bodyText: { not: '' }
    },
    data: {
      bodyText: '',
      bodyGraphemeLength: 0,
      emotionTagId: null,
      emotionTagNameSnapshot: null,
      contextTagId: null,
      contextTagNameSnapshot: null
    }
  });

  const dueUsers = await prisma.user.findMany({
    where: {
      accountDeletionScheduledAt: { lte: now },
      accountStatus: 'DEACTIVATED'
    },
    select: { id: true }
  });
  for (const user of dueUsers) {
    await prisma.$transaction([
      prisma.post.updateMany({
        where: { authorId: user.id },
        data: {
          bodyText: '',
          bodyGraphemeLength: 0,
          emotionTagId: null,
          emotionTagNameSnapshot: null,
          contextTagId: null,
          contextTagNameSnapshot: null,
          publicStatus: PublicStatus.DELETED,
          deletedAt: now
        }
      }),
      prisma.postVersion.updateMany({
        where: { post: { authorId: user.id } },
        data: {
          bodyText: '',
          bodyGraphemeLength: 0,
          emotionTagId: null,
          emotionTagNameSnapshot: null,
          contextTagId: null,
          contextTagNameSnapshot: null
        }
      }),
      prisma.comment.updateMany({
        where: { authorId: user.id },
        data: {
          bodyText: '',
          bodyGraphemeLength: 0,
          deletedAt: now
        }
      }),
      prisma.reaction.deleteMany({ where: { userId: user.id } }),
      prisma.viewRecord.deleteMany({ where: { viewerId: user.id } }),
      prisma.noticeConfirmation.deleteMany({ where: { userId: user.id } }),
      prisma.authSession.deleteMany({ where: { userId: user.id } }),
      prisma.quotaUsage.deleteMany({ where: { userId: user.id } }),
      prisma.idempotencyRecord.deleteMany({ where: { actorId: user.id } }),
      prisma.adminRoleAssignment.updateMany({
        where: { userId: user.id },
        data: { active: false, revokedAt: now }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          authSubjectRef: null,
          loginCode: null,
          authProvider: 'DELETED',
          plazaNickname: '已注销用户',
          accountStatus: 'DELETED',
          postingRestrictedUntil: null,
          commentingRestrictedUntil: null,
          reactionRestrictedUntil: null
        }
      })
    ]);
  }

  console.log(
    JSON.stringify({
      deleted_view_records: 'cutoff_applied',
      deleted_audit_logs: 'cutoff_applied',
      purged_accounts: dueUsers.length
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
