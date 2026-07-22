export type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

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

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}
