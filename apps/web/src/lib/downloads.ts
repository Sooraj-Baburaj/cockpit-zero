export type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

/** What the visitor is actually browsing on — includes phones/tablets, which
 * can't run the app and get a "desktop app" state instead of an installer. */
export type DetectedPlatform = Platform | 'ios' | 'android';

export function isMobilePlatform(platform: DetectedPlatform): platform is 'ios' | 'android' {
  return platform === 'ios' || platform === 'android';
}

export const DOWNLOAD_BASE = process.env.NEXT_PUBLIC_DOWNLOAD_BASE_URL ?? '#';

export const PLATFORM_LABELS: Record<Platform, string> = {
  mac: 'Download for macOS',
  windows: 'Download for Windows',
  linux: 'Download for Linux',
  unknown: 'Download',
};

export const PLATFORM_FILES: Record<Platform, string> = {
  mac: 'CockpitZero.dmg',
  windows: 'CockpitZero-Setup.exe',
  linux: 'CockpitZero.AppImage',
  unknown: '',
};

export function downloadHref(platform: Platform): string {
  return PLATFORM_FILES[platform] ? `${DOWNLOAD_BASE}/${PLATFORM_FILES[platform]}` : '#';
}

export function detectPlatform(): DetectedPlatform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  // Phones/tablets first: an iPhone UA contains "like Mac OS X" and an
  // Android UA contains "linux", so the desktop checks must come after.
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (ua.includes('android')) return 'android';
  // iPadOS 13+ masquerades as macOS Safari; multi-touch gives it away.
  if (ua.includes('mac') && navigator.maxTouchPoints > 1) return 'ios';
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}
