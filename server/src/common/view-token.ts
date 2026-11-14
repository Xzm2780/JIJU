const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VIEW_TOKEN_PATTERN = /^v1:view:([0-9a-f-]+)$/;

export function isValidViewToken(value: string): boolean {
  const match = VIEW_TOKEN_PATTERN.exec(value);
  return Boolean(match?.[1] && UUID_V7_PATTERN.test(match[1]));
}
