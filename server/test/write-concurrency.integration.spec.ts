import { randomUUID } from 'node:crypto';
import {
  ModerationStatus,
  PublicStatus,
  ReactionType
} from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

const describeIntegration =
  process.env.JIJU_RUN_INTEGRATION === 'true' ? describe : describe.skip;

describeIntegration('write concurrency constraints', () => {
  const prisma = new PrismaService();
  const suffix = randomUUID();
  const userId = `usr_it_concurrency_${suffix}`;
  const postId = `pst_it_concurrency_${suffix}`;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.user.create({
      data: {
        id: userId,
        authSubjectRef: `subject_concurrency_${suffix}`,
        authProvider: 'MOCK',
        plazaNickname: 'integration concurrency'
      }
    });
    await prisma.post.create({
      data: {
        id: postId,
        authorId: userId,
        bodyText: '并发测试',
        bodyGraphemeLength: 4,
        retentionHours: 168,
        publicStatus: PublicStatus.PUBLISHED,
        moderationStatus: ModerationStatus.PASSED,
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 168 * 60 * 60 * 1000)
      }
    });
  });

  afterAll(async () => {
    await prisma.reaction.deleteMany({ where: { postId } });
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('keeps one reaction row under concurrent type changes', async () => {
    const types = [ReactionType.HUG, ReactionType.HEAD_PAT, ReactionType.CHEER];
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        prisma.reaction.upsert({
          where: { userId_postId: { userId, postId } },
          create: {
            id: `rxn_${randomUUID()}`,
            userId,
            postId,
            type: types[index % types.length]!,
            active: true
          },
          update: {
            type: types[index % types.length]!,
            active: true
          }
        })
      )
    );
    await expect(
      prisma.reaction.count({ where: { userId, postId } })
    ).resolves.toBe(1);
  });
});
