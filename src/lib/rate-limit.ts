const rateMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, limit = 50, windowMs = 3600000): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  rateMap.forEach((value, key) => {
    if (now > value.resetAt) rateMap.delete(key);
  });
}, 60000);
