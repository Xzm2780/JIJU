import { createUuidV7 } from './idempotency';

export function createViewToken(now = Date.now()): string {
  return `v1:view:${createUuidV7(now)}`;
}

export function isValidViewToken(value: string): boolean {
  return /^v1:view:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value
  );
}
