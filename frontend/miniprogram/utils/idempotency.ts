function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const wxCrypto =
    typeof wx !== 'undefined'
      ? (wx as unknown as {
          getRandomValues?: (options: { length: number }) => {
            randomValues: ArrayBuffer;
          };
        }).getRandomValues
      : undefined;
  if (wxCrypto) {
    return new Uint8Array(wxCrypto({ length }).randomValues);
  }
  const webCrypto = (globalThis as unknown as {
    crypto?: { getRandomValues?: (values: Uint8Array) => Uint8Array };
  }).crypto;
  if (webCrypto?.getRandomValues) {
    return webCrypto.getRandomValues(bytes);
  }
  throw new Error('A secure random source is required for idempotency keys');
}

export function createUuidV7(now = Date.now()): string {
  const bytes = randomBytes(16);
  let timestamp = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index]! = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6]! = (bytes[6]! & 0x0f) | 0x70;
  bytes[8]! = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
}

export function createIdempotencyKey(
  operation: string,
  now = Date.now()
): string {
  return `v1:${operation}:${createUuidV7(now)}`;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export class IdempotencyManager {
  private key: string | null = null;
  private fingerprint: string | null = null;

  constructor(private readonly operation: string) {}

  forPayload(payload: unknown): string {
    const nextFingerprint = stableStringify(payload);
    if (!this.key || this.key === null || this.fingerprint !== nextFingerprint) {
      this.key = createIdempotencyKey(this.operation);
      this.fingerprint = nextFingerprint;
    }
    return this.key;
  }

  reset(): void {
    this.key = null;
    this.fingerprint = null;
  }
}
