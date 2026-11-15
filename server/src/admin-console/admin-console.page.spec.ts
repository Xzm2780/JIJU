import { ADMIN_CONSOLE_HTML } from './admin-console.page';

describe('Admin console account management', () => {
  it('uses a searchable user table and automatically fills the action form', () => {
    expect(ADMIN_CONSOLE_HTML).toContain('id="account-filter-status"');
    expect(ADMIN_CONSOLE_HTML).toContain('id="account-query"');
    expect(ADMIN_CONSOLE_HTML).toContain('id="account-list"');
    expect(ADMIN_CONSOLE_HTML).toContain('function selectAccount(item)');
    expect(ADMIN_CONSOLE_HTML).toContain("$('#account-user-id').value=item.id");
    expect(ADMIN_CONSOLE_HTML).toContain(
      "id=\"account-user-id\" placeholder=\"请从上方列表选择用户\" readonly"
    );
  });

  it('shows the same profile fields used by the miniapp', () => {
    expect(ADMIN_CONSOLE_HTML).toContain('item.plaza_nickname');
    expect(ADMIN_CONSOLE_HTML).toContain('item.bio');
    expect(ADMIN_CONSOLE_HTML).toContain('item.avatar_color');
    expect(ADMIN_CONSOLE_HTML).toContain('item.post_count');
    expect(ADMIN_CONSOLE_HTML).toContain('item.comment_count');
  });

  it('contains syntactically valid inline operator scripts', () => {
    const match = ADMIN_CONSOLE_HTML.match(/<script>([\s\S]*)<\/script>/);
    expect(match).not.toBeNull();
    expect(() => new Function(match![1])).not.toThrow();
  });

  it('clamps long table text and exposes the complete value as a tooltip', () => {
    expect(ADMIN_CONSOLE_HTML).toContain(
      '.cell-main.cell-clamp-2{max-height:3.1em;max-width:460px;-webkit-line-clamp:2}'
    );
    expect(ADMIN_CONSOLE_HTML).toContain(
      "main.className='cell-main cell-clamp-2'"
    );
    expect(ADMIN_CONSOLE_HTML).toContain('main.title=item.body_excerpt');
    expect(ADMIN_CONSOLE_HTML).toContain("sub.title=subText");
    expect(ADMIN_CONSOLE_HTML).toContain('name.title=item.plaza_nickname');
  });
});
