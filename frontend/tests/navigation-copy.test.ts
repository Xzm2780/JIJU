import { describe, expect, it } from 'vitest';
// @ts-expect-error Vitest runs in Node while the miniapp tsconfig limits Node ambient types.
import { readFileSync } from 'node:fs';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('miniapp navigation copy and alignment', () => {
  it('keeps my-page menu entries concise', () => {
    const markup = read('miniprogram/pages/my/index.wxml');

    expect(markup).not.toContain('menu-desc');
    expect(markup).not.toContain('查看、编辑和管理已发布内容');
    expect(markup).not.toContain('退出登录与永久注销');
    expect(markup).toContain('<text class="menu-title">我的帖子</text>');
  });

  it('left-aligns account setting labels and uses a concise logout label', () => {
    const markup = read('miniprogram/pages/settings/index.wxml');
    const styles = read('miniprogram/pages/settings/index.wxss');

    expect(markup).toContain('<text class="setting-label">退出登录</text>');
    expect(markup).not.toContain('退出当前会话');
    expect(markup).toContain('class="setting-row setting-action');
    expect(markup).not.toContain('setting-button');
    expect(markup).not.toContain('立即停用并进入 30 天冷静期');
    expect(styles).toMatch(/\.setting-label\s*\{[^}]*text-align:\s*left/s);
    expect(styles).toMatch(/\.setting-label\s*\{[^}]*flex:\s*1 1 0/s);
  });

  it('models a non-social plaza identity without a personal bio', () => {
    const identity = read('miniprogram/pages/profile/index.wxml');
    const myPage = read('miniprogram/pages/my/index.wxml');

    expect(identity).toContain('<text class="label">广场昵称</text>');
    expect(identity).toContain('<text class="label">头像配色</text>');
    expect(identity).not.toContain('个人简介');
    expect(identity).not.toContain('textarea');
    expect(myPage).not.toContain('profile-bio');
    expect(myPage).toContain('<text class="menu-title">广场身份</text>');
  });
});
