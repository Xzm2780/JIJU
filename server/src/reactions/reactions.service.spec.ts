import { ConfigService } from '@nestjs/config';
import {
  ModerationStatus,
  PublicStatus,
  ReactionType
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { ReactionsService } from './reactions.service';

const USER: AuthenticatedUser = {
  id: 'usr_1',
  authProvider: 'MOCK',
  plazaNickname: '晚风 1024',
  accountStatus: 'ACTIVE'
};
const POST_ID = 'pst_00000000-0000-7000-8000-000000000001';
const SET_KEY = 'v1:reaction.set:00000000-0000-7000-8000-000000000010';
const CANCEL_KEY =
  'v1:reaction.cancel:00000000-0000-7000-8000-000000000011';

function harness() {
  let storedIdempotency: any = null;
  const tx = {
    post: {
      findUnique: jest.fn().mockResolvedValue({
        id: POST_ID,
        publicStatus: PublicStatus.PUBLISHED,
        moderationStatus: ModerationStatus.PASSED,
        riskConfirmedAt: null,
        expiresAt: new Date('2026-11-21T02:00:00.000Z'),
        hiddenAt: null,
        deletedAt: null
      })
    },
    noticeConfirmation: {
      findUnique: jest.fn().mockResolvedValue({ id: 'notice' })
    },
    reaction: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([
        { type: ReactionType.HUG, _count: { _all: 1 } }
      ])
    },
    idempotencyRecord: {
      create: jest.fn().mockImplementation(({ data }) => {
        storedIdempotency = data;
        return Promise.resolve(data);
      })
    }
  };
  const prisma = {
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({})
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx))
  };
  const service = new ReactionsService(
    prisma as any,
    { getOrThrow: () => 'mvp-v1' } as unknown as ConfigService
  );
  return {
    service,
    prisma,
    tx,
    get storedIdempotency() {
      return storedIdempotency;
    }
  };
}

describe('ReactionsService', () => {
  it('sets one reaction and returns aggregate counts without identities', async () => {
    const h = harness();
    const result = await h.service.set({
      postId: POST_ID,
      user: USER,
      type: ReactionType.HUG,
      idempotencyKey: SET_KEY,
      requestId: 'req_set'
    });

    expect(result).toEqual({
      data: {
        my_reaction: ReactionType.HUG,
        counts: { hug: 1, head_pat: 0, cheer: 0, total: 1 }
      },
      request_id: 'req_set'
    });
    expect(h.tx.reaction.upsert).toHaveBeenCalledTimes(1);
    expect(h.storedIdempotency.operation).toBe('reaction.set');
    expect(JSON.stringify(result)).not.toContain(USER.id);
    expect(result.data).not.toHaveProperty('view_count');
  });

  it('switches the same unique reaction instead of creating a second row', async () => {
    const h = harness();
    h.tx.reaction.groupBy.mockResolvedValue([
      { type: ReactionType.HEAD_PAT, _count: { _all: 2 } }
    ]);
    await h.service.set({
      postId: POST_ID,
      user: USER,
      type: ReactionType.HEAD_PAT,
      idempotencyKey: SET_KEY,
      requestId: 'req_switch'
    });
    expect(h.tx.reaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_postId: { userId: USER.id, postId: POST_ID } },
        update: { type: ReactionType.HEAD_PAT, active: true }
      })
    );
  });

  it('cancels only the current reaction and repeated cancel does not update twice', async () => {
    const h = harness();
    h.tx.reaction.groupBy.mockResolvedValue([]);
    const args = {
      postId: POST_ID,
      user: USER,
      idempotencyKey: CANCEL_KEY,
      requestId: 'req_cancel'
    };
    const first = await h.service.cancel(args);
    expect(first.data.my_reaction).toBeNull();
    expect((first.data.counts as { total: number }).total).toBe(0);

    h.prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'idm_cancel',
      requestFingerprint:
        '{"action":"cancel","post_id":"pst_00000000-0000-7000-8000-000000000001"}',
      expiresAt: new Date(Date.now() + 60_000),
      responseJson: first
    });
    await h.service.cancel(args);
    expect(h.tx.reaction.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects guests through guard contract and unavailable posts in service', async () => {
    const h = harness();
    h.tx.post.findUnique.mockResolvedValue({
      id: POST_ID,
      publicStatus: PublicStatus.PUBLISHED,
      moderationStatus: ModerationStatus.PASSED,
      riskConfirmedAt: null,
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      hiddenAt: null,
      deletedAt: null
    });
    await expect(
      h.service.set({
        postId: POST_ID,
        user: USER,
        type: ReactionType.CHEER,
        idempotencyKey: SET_KEY,
        requestId: 'req_set'
      })
    ).rejects.toMatchObject({ code: 'JIJU_CONTENT_4041' });
  });
});
