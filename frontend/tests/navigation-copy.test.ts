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
    expect(markup).not.toContain('使用须知');
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

  it('requires the notice agreement before WeChat login', () => {
    const loginMarkup = read('miniprogram/pages/login/index.wxml');
    const loginLogic = read('miniprogram/pages/login/index.ts');
    const noticeLogic = read('miniprogram/pages/notice/index.ts');
    const settingsMarkup = read('miniprogram/pages/settings/index.wxml');

    expect(loginMarkup).toContain('我已阅读并同意');
    expect(loginMarkup).toContain('《使用须知》');
    expect(loginMarkup).toContain('disabled="{{busy || !agreed}}"');
    expect(loginMarkup).not.toContain('class="benefits"');
    expect(loginLogic).toContain('confirmNotice(');
    expect(noticeLogic).toContain("query.review === '1'");
    expect(settingsMarkup).toContain('服务与协议');
    expect(settingsMarkup).toContain('使用须知');
  });

  it('keeps implementation notes out of user-visible page markup', () => {
    const pages = [
      'feed',
      'detail',
      'publish',
      'login',
      'notice',
      'report',
      'my',
      'my-posts',
      'profile',
      'settings'
    ];

    for (const page of pages) {
      const markup = read(`miniprogram/pages/${page}/index.wxml`);
      expect(markup).not.toMatch(/服务端|数据库|接口开发|开发提示|实现说明/);
    }
  });

  it('returns guests to the feed after logout and prompts login for protected actions', () => {
    const settingsLogic = read('miniprogram/pages/settings/index.ts');
    const detailLogic = read('miniprogram/pages/detail/index.ts');
    const reportLogic = read('miniprogram/pages/report/index.ts');
    const myMarkup = read('miniprogram/pages/my/index.wxml');

    expect(settingsLogic).toContain(
      "wx.switchTab({ url: '/pages/feed/index' })"
    );
    expect(settingsLogic).not.toContain('已退出当前会话');
    expect(detailLogic).toContain('openLoginPage()');
    expect(reportLogic).toContain('openLoginPage()');
    expect(myMarkup).toContain('bindtap="openLogin"');
    expect(myMarkup).not.toContain('先去写一条');
  });
});
