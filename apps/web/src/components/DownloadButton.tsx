'use client';

import { useEffect, useState } from 'react';

type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'unknown';
}

const LABELS: Record<Platform, string> = {
  mac: 'Download for macOS',
  windows: 'Download for Windows',
  linux: 'Download for Linux',
  unknown: 'Download',
};

const FILES: Record<Platform, string> = {
  mac: 'CockpitZero.dmg',
  windows: 'CockpitZero-Setup.exe',
  linux: 'CockpitZero.AppImage',
  unknown: '',
};

const base = process.env.NEXT_PUBLIC_DOWNLOAD_BASE_URL ?? '#';

/** Client component: detects the visitor's OS and shows the right installer. */
export function DownloadButton() {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => setPlatform(detectPlatform()), []);

  const href = FILES[platform] ? `${base}/${FILES[platform]}` : '#';

  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={href}
        className="rounded-lg bg-white px-6 py-3 text-lg font-medium text-black transition hover:bg-white/90"
      >
        {LABELS[platform]}
      </a>
      <p className="text-sm text-white/50">
        Also available for{' '}
        {(['mac', 'windows', 'linux'] as const)
          .filter((p) => p !== platform)
          .map((p, i, arr) => (
            <span key={p}>
              <a className="underline hover:text-white" href={`${base}/${FILES[p]}`}>
                {p === 'mac' ? 'macOS' : p === 'windows' ? 'Windows' : 'Linux'}
              </a>
              {i < arr.length - 1 ? ', ' : ''}
            </span>
          ))}
      </p>
    </div>
  );
}
