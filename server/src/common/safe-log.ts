const ALLOWED_FIELDS = [
  'request_id',
  'trace_id',
  'route_template',
  'method',
  'status_code',
  'duration_ms',
  'result_category',
  'actor_ref',
  'operation'
] as const;

type SafeLogField = (typeof ALLOWED_FIELDS)[number];
export type SafeLogEvent = Partial<Record<SafeLogField, string | number>>;

export function buildSafeLogEvent(
  input: Record<string, unknown>
): SafeLogEvent {
  const event: SafeLogEvent = {};
  for (const field of ALLOWED_FIELDS) {
    const value = input[field];
    if (typeof value === 'string' || typeof value === 'number') {
      event[field] = value;
    }
  }
  return event;
}
