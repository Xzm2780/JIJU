import { ADMIN_CONSOLE_HTML } from './admin-console.page';

describe('Admin console account management', () => {
  it('uses a searchable user table and opens a dedicated processing page', () => {
    expect(ADMIN_CONSOLE_HTML).toContain('id="account-filter-status"');
    expect(ADMIN_CONSOLE_HTML).toContain('id="account-query"');
    expect(ADMIN_CONSOLE_HTML).toContain('id="account-list"');
    expect(ADMIN_CONSOLE_HTML).toContain('function openAccountProcess(item)');
    expect(ADMIN_CONSOLE_HTML).toContain(
      '/api/v1/admin-console/process?kind=account&id='
    );
    expect(ADMIN_CONSOLE_HTML).not.toContain('id="account-form"');
  });

  it('shows the same profile fields used by the miniapp', () => {
    expect(ADMIN_CONSOLE_HTML).toContain('item.plaza_nickname');
    expect(ADMIN_CONSOLE_HTML).toContain('item.post_count');
    expect(ADMIN_CONSOLE_HTML).toContain('item.comment_count');
    expect(ADMIN_CONSOLE_HTML).not.toContain('item.bio');
    expect(ADMIN_CONSOLE_HTML).not.toContain('item.avatar_color');
  });

  it('contains syntactically valid inline operator scripts', () => {
    const match = ADMIN_CONSOLE_HTML.match(/<script>([\s\S]*)<\/script>/);
    expect(match).not.toBeNull();
    expect(() => new Function(match![1])).not.toThrow();
  });

  it('clamps long table text and exposes the complete value as a tooltip', () => {
    expect(ADMIN_CONSOLE_HTML).toContain(
      '.cell-main.cell-clamp-2{max-width:460px;-webkit-line-clamp:2}'
    );
    expect(ADMIN_CONSOLE_HTML).not.toContain('max-height:3.1em');
    expect(ADMIN_CONSOLE_HTML).toContain(
      "main.className='cell-main cell-clamp-2'"
    );
    expect(ADMIN_CONSOLE_HTML).toContain('main.title=item.body_excerpt');
    expect(ADMIN_CONSOLE_HTML).toContain("sub.title=subText");
    expect(ADMIN_CONSOLE_HTML).toContain('name.title=item.plaza_nickname');
  });

  it('restores the admin session after refresh without persisting credentials', () => {
    expect(ADMIN_CONSOLE_HTML).toContain(
      "const ADMIN_SESSION_KEY='jiju.admin-console.session.v1'"
    );
    expect(ADMIN_CONSOLE_HTML).toContain(
      'sessionStorage.setItem(ADMIN_SESSION_KEY'
    );
    expect(ADMIN_CONSOLE_HTML).toContain(
      'sessionStorage.getItem(ADMIN_SESSION_KEY)'
    );
    expect(ADMIN_CONSOLE_HTML).toContain(
      'sessionStorage.removeItem(ADMIN_SESSION_KEY)'
    );
    expect(ADMIN_CONSOLE_HTML).toContain('function restoreAdminSession()');
    expect(ADMIN_CONSOLE_HTML).toContain(
      'if(!restoreAdminSession())showLoginScreen()'
    );
    expect(ADMIN_CONSOLE_HTML).not.toContain('localStorage');
    expect(ADMIN_CONSOLE_HTML).not.toContain('password:password');
  });

  it('does not expose internal implementation or operational instructions', () => {
    expect(ADMIN_CONSOLE_HTML).not.toContain('AdminRoleAssignment');
    expect(ADMIN_CONSOLE_HTML).not.toContain('建议按“举报队列');
    expect(ADMIN_CONSOLE_HTML).not.toContain('浏览器标签页');
    expect(ADMIN_CONSOLE_HTML).not.toContain('服务端校验角色');
    expect(ADMIN_CONSOLE_HTML).not.toContain("body.code?body.code+': '");
    expect(ADMIN_CONSOLE_HTML).not.toContain('usr_...');
  });

  it('uses concise report reason fields instead of explanatory subtitles', () => {
    expect(ADMIN_CONSOLE_HTML).not.toContain('辱骂、攻击或骚扰');
    expect(ADMIN_CONSOLE_HTML).not.toContain('危险或不适当内容');
    expect(ADMIN_CONSOLE_HTML).not.toContain('广告或垃圾信息');
    expect(ADMIN_CONSOLE_HTML).not.toContain('命中内容规则');
    expect(ADMIN_CONSOLE_HTML).not.toContain("badge('常规')");
    expect(ADMIN_CONSOLE_HTML).toContain(
      "['来源','原因','内容','状态','时间','操作']"
    );
  });

  it('keeps internal identifiers out of visible table content', () => {
    expect(ADMIN_CONSOLE_HTML).not.toContain("'编号 '+");
    expect(ADMIN_CONSOLE_HTML).not.toContain('shortId(');
    expect(ADMIN_CONSOLE_HTML).not.toContain('pst_...');
    expect(ADMIN_CONSOLE_HTML).not.toContain('usr_...');
    expect(ADMIN_CONSOLE_HTML).not.toContain('id="content-form"');
    expect(ADMIN_CONSOLE_HTML).toContain(
      '/api/v1/admin-console/process?kind=content&type='
    );
  });
});
