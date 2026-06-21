/**
 * Favicon lookup for `open-url` action rows. Fetches the icon straight from the
 * site's own origin (`https://site/favicon.ico`) — never a third-party favicon
 * service — so the only host contacted is the one the user already configured to
 * open. Results (success and failure) are cached by origin, and the whole thing
 * degrades to null (→ the line glyph) on any error or timeout, so it never
 * blocks or breaks the launcher.
 */
const cache = new Map<string, string | null>();

export async function getFavicon(url: string): Promise<string | null> {
  let origin: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    origin = parsed.origin;
  } catch {
    return null;
  }

  const cached = cache.get(origin);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(`${origin}/favicon.ico`, {
      signal: AbortSignal.timeout(2500),
      redirect: 'follow',
    });
    if (!res.ok) return remember(origin, null);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) return remember(origin, null);
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/x-icon';
    if (!mime.startsWith('image/')) return remember(origin, null);
    return remember(origin, `data:${mime};base64,${buffer.toString('base64')}`);
  } catch {
    return remember(origin, null);
  }
}

function remember(origin: string, value: string | null): string | null {
  cache.set(origin, value);
  return value;
}
