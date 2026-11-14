import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('B0 contract artifacts', () => {
  it('defines the approved review queue and conditional restore contract', () => {
    const api = read('docs/api.yaml');

    expect(api).toContain('  /admin/review-queue:');
    expect(api).toContain('operationId: listReviewQueue');
    expect(api).toContain('source 可选 moderation、report、all');
    expect(api).toContain('PREEMPTIVE items sort before NORMAL items');
    expect(api).toContain(
      'RESTORE changes HIDDEN to PUBLISHED without changing expires_at'
    );
    expect(api).not.toContain('API_GAP');
  });

  it('keeps moderation and report sources separate in the database model', () => {
    const schema = read('server/prisma/schema.prisma');
    const migrationDirectory = join(
      root,
      'server/prisma/migrations/20261113234000_init_publish'
    );
    const migration = read(
      'server/prisma/migrations/20261113234000_init_publish/migration.sql'
    );

    expect(readdirSync(join(root, 'server/prisma/migrations'))).toEqual(
      expect.arrayContaining(['migration_lock.toml', '20261113234000_init_publish'])
    );
    expect(readdirSync(migrationDirectory)).toEqual(['migration.sql']);
    expect(schema).toMatch(/model Report\s*\{/);
    expect(schema).toMatch(/model ModerationRecord\s*\{/);
    expect(schema).toMatch(/model AuditLog\s*\{/);
    expect(schema).toMatch(/model AdminRoleAssignment\s*\{/);
    expect(schema).toContain('priorityRank');
    expect(migration).toContain('CREATE TABLE "Report"');
    expect(migration).toContain('CREATE TABLE "ModerationRecord"');
    expect(migration).toContain('CREATE TABLE "AuditLog"');
    expect(migration).toContain('Report_status_priorityRank_submittedAt_id_idx');
    expect(migration).toContain(
      'ModerationRecord_status_priorityRank_createdAt_id_idx'
    );
  });

  it('documents the approved restore conditions and safe unavailable message', () => {
    const stateMachine = read('docs/state-machine.md');
    const errors = read('docs/errors.md');

    expect(stateMachine).toContain(
      '| HIDDEN | 后台恢复 | 后台运营角色；`server_now < expires_at`'
    );
    expect(stateMachine).toContain('不修改 `expires_at`');
    expect(stateMachine).toContain('HIDDEN --> PUBLISHED');
    expect(errors).toMatch(
      /\| JIJU_CONTENT_4221 \| 422 \| 内容状态不允许操作 \| 内容已不可用 \|/
    );
  });

  it('marks the red acceptance suite as a production API contract suite', () => {
    const contractTest = read('tests/acceptance/publish-contract.test.mjs');

    expect(contractTest).toContain('JIJU_CONTRACT_BASE_URL');
    expect(contractTest).toContain('JIJU_CONTRACT_ALLOW_WRITES');
    expect(contractTest).not.toContain('createDemoApp');
    expect(contractTest).not.toContain('demo/publish');
    expect(contractTest).not.toContain('app.state');
    expect(contractTest).toContain('未验证：');
  });
});
