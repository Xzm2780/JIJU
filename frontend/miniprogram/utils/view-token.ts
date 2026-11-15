function pseudoRandomByte(): number {
  return Math.floor(Math.random() * 256);
}

export function createViewToken(now = Date.now()): string {
  let timestamp = now;
  const bytes = new Uint8Array(16);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = timestamp % 256;
    timestamp = Math.floor(timestamp / 256);
  }
  bytes[7] = pseudoRandomByte();
  for (let index = 9; index < 16; index += 1) {
    bytes[index] = pseudoRandomByte();
  }
  bytes[6] = 0x70;
  bytes[8] = 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `v1:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isValidViewToken(value: string): boolean {
  return /^v1:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value
  );
}
