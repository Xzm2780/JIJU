import { ApiError } from './api-error';

const OPERATION_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isValidOperation(operation: string): boolean {
  return OPERATION_PATTERN.test(operation);
}

export function isValidIdempotencyKey(
  value: string,
  operation: string
): boolean {
  if (!isValidOperation(operation)) {
    return false;
  }
  const prefix = `v1:${operation}:`;
  return value.startsWith(prefix) && UUID_V7_PATTERN.test(value.slice(prefix.length));
}

export function requireIdempotencyKey(
  value: string | undefined,
  operation: string
): string {
  if (!value || !isValidIdempotencyKey(value, operation)) {
    throw new ApiError('JIJU_VALIDATION_4221', 422, '缺少或无效的幂等键', {
      fields: {
        'Idempotency-Key': `应为 v1:${operation}:<uuid_v7>`
      }
    });
  }
  return value;
}
