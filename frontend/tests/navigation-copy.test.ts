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

  it('uses a normal profile with a generated avatar and editable nickname', () => {
    const profile = read('miniprogram/pages/profile/index.wxml');
    const styles = read('miniprogram/pages/profile/index.wxss');
    const myPage = read('miniprogram/pages/my/index.wxml');

    expect(profile).toContain('<view class="avatar-preview">');
    expect(profile).toContain('<text class="label">昵称</text>');
    expect(profile).not.toContain('头像配色');
    expect(profile).not.toContain('color-grid');
    expect(profile).not.toContain('个人简介');
    expect(profile).not.toContain('textarea');
    expect(myPage).not.toContain('profile-bio');
    expect(myPage).toContain('<text class="menu-title">个人资料</text>');
    expect(styles).toMatch(/\.input\s*\{[^}]*height:\s*92rpx/s);
    expect(styles).toMatch(/\.input\s*\{[^}]*line-height:\s*92rpx/s);
    expect(styles).toMatch(/\.input\s*\{[^}]*color:\s*#30292a/s);
  });
});
