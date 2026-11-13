export function beijingDayWindow(now: Date): { start: Date; end: Date } {
  const offsetMs = 8 * 60 * 60 * 1000;
  const localNow = new Date(now.getTime() + offsetMs);
  const localStart = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate()
  );

  return {
    start: new Date(localStart - offsetMs),
    end: new Date(localStart + 24 * 60 * 60 * 1000 - offsetMs)
  };
}

export function formatBeijingDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}
