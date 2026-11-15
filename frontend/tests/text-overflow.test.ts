import { describe, expect, it } from 'vitest';
// @ts-expect-error Vitest runs in Node while the miniapp tsconfig limits Node ambient types.
import { readFileSync } from 'node:fs';

interface CssRule {
  selectors: string[];
  declarations: string;
}

function readCss(path: string): string {
  return readFileSync(path, 'utf8');
}

function rules(css: string): CssRule[] {
  return Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => ({
    selectors: (match[1] ?? '')
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean),
    declarations: match[2] ?? ''
  }));
}

function declarationsFor(css: string, selector: string): string {
  return (
    rules(css)
      .filter((rule) => rule.selectors.includes(selector))
      .map((rule) => rule.declarations)
      .join('\n') || ''
  );
}

describe('long text presentation rules', () => {
  it('clamps feed summaries while allowing arbitrary characters to wrap', () => {
    const css = readCss('miniprogram/pages/feed/index.wxss');
    const body = declarationsFor(css, '.body');
    const nickname = declarationsFor(css, '.nickname');

    expect(body).toContain('-webkit-line-clamp: 5');
    expect(body).toContain('overflow: hidden');
    expect(body).toContain('overflow-wrap: anywhere');
    expect(nickname).toContain('text-overflow: ellipsis');
    expect(nickname).toContain('white-space: nowrap');
  });

  it('keeps full post and comment text readable in detail', () => {
    const css = readCss('miniprogram/pages/detail/index.wxss');
    const body = declarationsFor(css, '.body');
    const comment = declarationsFor(css, '.comment-body');

    expect(body).toContain('overflow-wrap: anywhere');
    expect(body).toContain('white-space: pre-wrap');
    expect(body).not.toContain('-webkit-line-clamp');
    expect(comment).toContain('overflow-wrap: anywhere');
    expect(comment).not.toContain('-webkit-line-clamp');
  });

  it('limits post previews in my-posts without hiding detail content', () => {
    const css = readCss('miniprogram/pages/my-posts/index.wxss');
    const body = declarationsFor(css, '.post-body');

    expect(body).toContain('-webkit-line-clamp: 4');
    expect(body).toContain('overflow: hidden');
    expect(body).toContain('overflow-wrap: anywhere');
  });

  it('handles long profile, settings and receipt text', () => {
    const profile = readCss('miniprogram/pages/my/index.wxss');
    const settings = readCss('miniprogram/pages/settings/index.wxss');
    const report = readCss('miniprogram/pages/report/index.wxss');

    expect(declarationsFor(profile, '.profile-name')).toContain(
      '-webkit-line-clamp: 2'
    );
    expect(declarationsFor(profile, '.profile-bio')).toContain(
      '-webkit-line-clamp: 2'
    );
    expect(declarationsFor(settings, '.setting-value')).toContain(
      'text-overflow: ellipsis'
    );
    expect(declarationsFor(report, '.receipt-id')).toContain(
      'overflow-wrap: anywhere'
    );
  });

  it('wraps shared messages, notices and state descriptions', () => {
    const app = readCss('miniprogram/app.wxss');
    const publish = readCss('miniprogram/pages/publish/index.wxss');
    const notice = readCss('miniprogram/pages/notice/index.wxss');
    const state = readCss('miniprogram/components/state-panel/index.wxss');

    expect(declarationsFor(app, '.message')).toContain(
      'overflow-wrap: anywhere'
    );
    expect(declarationsFor(publish, '.notice-copy')).toContain(
      'overflow-wrap: anywhere'
    );
    expect(declarationsFor(notice, '.notice-copy')).toContain(
      'overflow-wrap: anywhere'
    );
    expect(declarationsFor(state, '.state-message')).toContain(
      'overflow-wrap: anywhere'
    );
  });
});
