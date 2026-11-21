import { ADMIN_PROCESS_HTML } from './admin-process.page';

describe('Admin dedicated process page', () => {
  it('provides tabbed content and account processing views', () => {
    expect(ADMIN_PROCESS_HTML).toContain('data-tab="overview"');
    expect(ADMIN_PROCESS_HTML).toContain('data-tab="action"');
    expect(ADMIN_PROCESS_HTML).toContain('data-tab="history"');
    expect(ADMIN_PROCESS_HTML).toContain('id="content-actions"');
    expect(ADMIN_PROCESS_HTML).toContain('id="content-state-section"');
    expect(ADMIN_PROCESS_HTML).toContain('id="account-action-form"');
    expect(ADMIN_PROCESS_HTML).not.toContain('id="back-button"');
    expect(ADMIN_PROCESS_HTML).not.toContain('返回列表');
  });

  it('uses the approved content and account action contracts', () => {
    expect(ADMIN_PROCESS_HTML).toContain(
      "'/reviews',{method:'POST',idempotencyKey:key('admin.review')"
    );
    expect(ADMIN_PROCESS_HTML).toContain(
      "'/actions',{method:'POST',idempotencyKey:key('admin.content.action')"
    );
    expect(ADMIN_PROCESS_HTML).toContain(
      "'/restrictions',{method:'POST',idempotencyKey:key('admin.user.restrict')"
    );
  });

  it('keeps operational implementation details out of the page', () => {
    expect(ADMIN_PROCESS_HTML).not.toContain('AdminRoleAssignment');
    expect(ADMIN_PROCESS_HTML).not.toContain('服务端校验');
    expect(ADMIN_PROCESS_HTML).not.toContain('pst_...');
    expect(ADMIN_PROCESS_HTML).not.toContain('usr_...');
  });

  it('shows modal feedback for success, failure and unavailable data', () => {
    expect(ADMIN_PROCESS_HTML).toContain('id="feedback-modal"');
    expect(ADMIN_PROCESS_HTML).toContain('function showFeedback(');
    expect(ADMIN_PROCESS_HTML).toContain(
      "showFeedback('复核成功','复核结果已保存','success')"
    );
    expect(ADMIN_PROCESS_HTML).toContain(
      "showFeedback('处理失败',error.message,'error')"
    );
    expect(ADMIN_PROCESS_HTML).toContain(
      "showFeedback('无法打开','当前处理数据已失效','error')"
    );
  });

  it('hides current-content actions for report processing', () => {
    expect(ADMIN_PROCESS_HTML).toContain(
      "const isReport=kind==='content'&&(['report','用户举报'].includes(item.source)||Boolean(item.reason))"
    );
    expect(ADMIN_PROCESS_HTML).toContain(
      "if(isReport)$('#content-state-section').classList.add('hidden')"
    );
  });

  it('contains syntactically valid inline scripts', () => {
    const match = ADMIN_PROCESS_HTML.match(/<script>([\s\S]*)<\/script>/);
    expect(match).not.toBeNull();
    expect(() => new Function(match![1])).not.toThrow();
  });
});
