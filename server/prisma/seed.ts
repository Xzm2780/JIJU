import {
  ModerationStatus,
  PrismaClient,
  PublicStatus,
  ReactionType,
  TagCategory
} from '@prisma/client';
import {
  createHash,
  randomBytes,
  scryptSync
} from 'node:crypto';

const prisma = new PrismaClient();

const tags = [
  ['tag_00000000-0000-4000-8000-000000000001', TagCategory.EMOTION, '开心', 1, false],
  ['tag_00000000-0000-4000-8000-000000000002', TagCategory.EMOTION, '平静', 2, false],
  ['tag_00000000-0000-4000-8000-000000000003', TagCategory.EMOTION, '疲惫', 3, false],
  ['tag_00000000-0000-4000-8000-000000000004', TagCategory.EMOTION, '焦虑', 4, false],
  ['tag_00000000-0000-4000-8000-000000000005', TagCategory.EMOTION, '委屈', 5, false],
  ['tag_00000000-0000-4000-8000-000000000006', TagCategory.EMOTION, '难过', 6, false],
  ['tag_00000000-0000-4000-8000-000000000007', TagCategory.EMOTION, '愤怒', 7, false],
  ['tag_00000000-0000-4000-8000-000000000008', TagCategory.EMOTION, '孤独', 8, false],
  ['tag_00000000-0000-4000-8000-000000000009', TagCategory.EMOTION, '迷茫', 9, false],
  ['tag_00000000-0000-4000-8000-000000000010', TagCategory.EMOTION, '失落', 10, false],
  ['tag_00000000-0000-4000-8000-000000000011', TagCategory.EMOTION, '其他', 11, true],
  ['tag_00000000-0000-4000-8000-000000000101', TagCategory.CONTEXT, '家庭', 1, false],
  ['tag_00000000-0000-4000-8000-000000000102', TagCategory.CONTEXT, '校园', 2, false],
  ['tag_00000000-0000-4000-8000-000000000103', TagCategory.CONTEXT, '亲密关系', 3, false],
  ['tag_00000000-0000-4000-8000-000000000104', TagCategory.CONTEXT, '职场', 4, false],
  ['tag_00000000-0000-4000-8000-000000000105', TagCategory.CONTEXT, '朋友关系', 5, false],
  ['tag_00000000-0000-4000-8000-000000000106', TagCategory.CONTEXT, '自我与生活', 6, false],
  ['tag_00000000-0000-4000-8000-000000000107', TagCategory.CONTEXT, '其他', 7, true]
] as const;

async function main(): Promise<void> {
  await prisma.tagCatalog.upsert({
    where: { id: 'current' },
    create: { id: 'current', version: 'mvp-tags-v1' },
    update: { version: 'mvp-tags-v1' }
  });

  for (const [id, category, name, sortOrder, isOther] of tags) {
    await prisma.tag.upsert({
      where: { id },
      create: {
        id,
        category,
        name,
        sortOrder,
        enabled: true,
        isOther,
        catalogVersion: 'mvp-tags-v1'
      },
      update: {
        category,
        name,
        sortOrder,
        enabled: true,
        isOther,
        catalogVersion: 'mvp-tags-v1'
      }
    });
  }

  const now = Date.now();
  const seedDemoData =
    process.env.SEED_DEMO_DATA === 'true' ||
    process.env.NODE_ENV !== 'production';
  if (!seedDemoData) {
    return;
  }

  const demoAdmin = await prisma.user.upsert({
    where: { id: 'usr_demo_admin' },
    create: {
      id: 'usr_demo_admin',
      authProvider: 'SEED',
      plazaNickname: '演示运营'
    },
    update: { plazaNickname: '演示运营' }
  });
  const adminRoles = [
    'REPORT_REVIEWER',
    'CONTENT_MODERATOR',
    'ACCOUNT_MODERATOR',
    'AUDITOR'
  ] as const;
  for (const role of adminRoles) {
    await prisma.adminRoleAssignment.upsert({
      where: { id: `adr_demo_${role.toLowerCase()}` },
      create: {
        id: `adr_demo_${role.toLowerCase()}`,
        userId: demoAdmin.id,
        role,
        active: true
      },
      update: { userId: demoAdmin.id, role, active: true, revokedAt: null }
    });
  }
  const adminToken =
    process.env.SEED_ADMIN_TOKEN ?? 'jiju-admin-demo-token';
  const adminUsername =
    process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ?? 'jiju-admin-demo';
  const passwordSalt = randomBytes(16).toString('hex');
  const passwordHash = `scrypt$${passwordSalt}$${scryptSync(
    adminPassword,
    passwordSalt,
    64
  ).toString('hex')}`;
  await prisma.adminCredential.upsert({
    where: { userId: demoAdmin.id },
    create: {
      id: 'adc_demo_admin',
      userId: demoAdmin.id,
      username: adminUsername,
      passwordHash,
      active: true
    },
    update: {
      username: adminUsername,
      passwordHash,
      active: true
    }
  });
  const adminExpiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
  await prisma.authSession.upsert({
    where: { id: 'ses_demo_admin' },
    create: {
      id: 'ses_demo_admin',
      tokenHash: createHash('sha256').update(adminToken).digest('hex'),
      userId: demoAdmin.id,
      expiresAt: adminExpiresAt
    },
    update: {
      tokenHash: createHash('sha256').update(adminToken).digest('hex'),
      expiresAt: adminExpiresAt,
      revokedAt: null
    }
  });

  const demoAuthor = await prisma.user.upsert({
    where: { id: 'usr_demo_emotion_square' },
    create: {
      id: 'usr_demo_emotion_square',
      authProvider: 'SEED',
      plazaNickname: '晚风邮局'
    },
    update: {
      plazaNickname: '晚风邮局'
    }
  });
  const demoReaders = await Promise.all(
    [
      ['usr_demo_reader_1', '清晨 2046'],
      ['usr_demo_reader_2', '远山 0713'],
      ['usr_demo_reader_3', '南岸 1188']
    ].map(([id, plazaNickname]) =>
      prisma.user.upsert({
        where: { id },
        create: {
          id,
          authProvider: 'SEED',
          plazaNickname
        },
        update: { plazaNickname }
      })
    )
  );

  const demoPosts = [
    {
      id: 'pst_demo_0001',
      body: '今天下班走出写字楼，风刚好吹散了闷了一整天的那口气。',
      emotion: ['tag_00000000-0000-4000-8000-000000000002', '平静'],
      context: ['tag_00000000-0000-4000-8000-000000000104', '职场'],
      hoursAgo: 1,
      retention: 168
    },
    {
      id: 'pst_demo_0002',
      body: '有些委屈不是因为事情很大，只是那一刻发现自己一直没被认真听见。',
      emotion: ['tag_00000000-0000-4000-8000-000000000005', '委屈'],
      context: ['tag_00000000-0000-4000-8000-000000000103', '亲密关系'],
      hoursAgo: 4,
      retention: 72
    },
    {
      id: 'pst_demo_0003',
      body: '第一次一个人去看电影，散场时街上很亮，忽然觉得自己也挺勇敢。',
      emotion: ['tag_00000000-0000-4000-8000-000000000001', '开心'],
      context: ['tag_00000000-0000-4000-8000-000000000106', '自我与生活'],
      hoursAgo: 8,
      retention: 168
    },
    {
      id: 'pst_demo_0004',
      body: '最近总在想未来要去哪里，没有答案的时候，就先认真吃完今天这顿饭。',
      emotion: ['tag_00000000-0000-4000-8000-000000000009', '迷茫'],
      context: ['tag_00000000-0000-4000-8000-000000000106', '自我与生活'],
      hoursAgo: 14,
      retention: 168
    },
    {
      id: 'pst_demo_0005',
      body: '给很久没联系的朋友发了一句“最近好吗”，她回我一长串语音，突然就安心了。',
      emotion: ['tag_00000000-0000-4000-8000-000000000001', '开心'],
      context: ['tag_00000000-0000-4000-8000-000000000105', '朋友关系'],
      hoursAgo: 22,
      retention: 72
    },
    {
      id: 'pst_demo_0006',
      body: '允许自己今天什么都不完成。能好好呼吸，也算一件了不起的事。',
      emotion: ['tag_00000000-0000-4000-8000-000000000003', '疲惫'],
      context: ['tag_00000000-0000-4000-8000-000000000106', '自我与生活'],
      hoursAgo: 30,
      retention: 168
    }
  ];

  for (const item of demoPosts) {
    const publishedAt = new Date(now - item.hoursAgo * 60 * 60 * 1000);
    const expiresAt = new Date(
      publishedAt.getTime() + item.retention * 60 * 60 * 1000
    );
    await prisma.post.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        authorId: demoAuthor.id,
        bodyText: item.body,
        bodyGraphemeLength: Array.from(item.body).length,
        emotionTagId: item.emotion[0],
        emotionTagNameSnapshot: item.emotion[1],
        contextTagId: item.context[0],
        contextTagNameSnapshot: item.context[1],
        retentionHours: item.retention,
        publicStatus: PublicStatus.PUBLISHED,
        moderationStatus: ModerationStatus.PASSED,
        publishedAt,
        expiresAt
      },
      update: {
        bodyText: item.body,
        bodyGraphemeLength: Array.from(item.body).length,
        emotionTagId: item.emotion[0],
        emotionTagNameSnapshot: item.emotion[1],
        contextTagId: item.context[0],
        contextTagNameSnapshot: item.context[1],
        retentionHours: item.retention,
        publicStatus: PublicStatus.PUBLISHED,
        moderationStatus: ModerationStatus.PASSED,
        publishedAt,
        expiresAt,
        deletedAt: null,
        hiddenAt: null
      }
    });
    await prisma.postVersion.upsert({
      where: {
        postId_versionNumber: {
          postId: item.id,
          versionNumber: 1
        }
      },
      create: {
        id: `pvr_demo_${item.id.slice(-4)}`,
        postId: item.id,
        versionNumber: 1,
        bodyText: item.body,
        bodyGraphemeLength: Array.from(item.body).length,
        emotionTagId: item.emotion[0],
        emotionTagNameSnapshot: item.emotion[1],
        contextTagId: item.context[0],
        contextTagNameSnapshot: item.context[1]
      },
      update: {
        bodyText: item.body,
        bodyGraphemeLength: Array.from(item.body).length
      }
    });

    await prisma.comment.upsert({
      where: { id: `cmt_demo_${item.id.slice(-4)}` },
      create: {
        id: `cmt_demo_${item.id.slice(-4)}`,
        postId: item.id,
        authorId: demoReaders[0]!.id,
        bodyText: '看到这里，想轻轻给你一个回应。',
        bodyGraphemeLength: 17,
        publishedAt: new Date(publishedAt.getTime() + 10 * 60 * 1000)
      },
      update: { deletedAt: null }
    });

    for (let index = 0; index < demoReaders.length; index += 1) {
      const reader = demoReaders[index]!;
      await prisma.reaction.upsert({
        where: {
          userId_postId: {
            userId: reader.id,
            postId: item.id
          }
        },
        create: {
          id: `rxn_demo_${item.id.slice(-4)}_${index}`,
          userId: reader.id,
          postId: item.id,
          type:
            index === 0
              ? ReactionType.HUG
              : index === 1
                ? ReactionType.HEAD_PAT
                : ReactionType.CHEER,
          active: true
        },
        update: {
          active: true
        }
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
