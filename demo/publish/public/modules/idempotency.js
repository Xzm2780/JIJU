function formatUuid(bytes) {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
}

export function createUuidV7(now = Date.now(), cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Web Crypto getRandomValues is required');
  }

  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);

  let timestamp = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}

export function createIdempotencyKey(operation, now = Date.now()) {
  return `v1:${operation}:${createUuidV7(now)}`;
}

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const pairs = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${pairs.join(',')}}`;
  }

  return JSON.stringify(value);
}

export function createIntentKeyManager(operation, nowProvider = Date.now) {
  let key = null;
  let fingerprint = null;

  return {
    forPayload(payload) {
      const nextFingerprint = stableStringify(payload);
      if (!key || fingerprint !== nextFingerprint) {
        key = createIdempotencyKey(operation, nowProvider());
        fingerprint = nextFingerprint;
      }

      return { key, fingerprint };
    },
    reset() {
      key = null;
      fingerprint = null;
    }
  };
}
