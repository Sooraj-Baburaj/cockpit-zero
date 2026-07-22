'use client';

import { useEffect, useState } from 'react';
import { detectPlatform, downloadHref, PLATFORM_LABELS, type Platform } from '@/lib/downloads';
import { DownloadArrow } from '@/components/atoms/DownloadArrow';
import { PointerArrow } from '@/components/molecules/PointerArrow';

/**
 * Client component: detects the visitor's OS and shows the right installer,
 * with the pointer arrow curving toward it.
 */
export function DownloadButton() {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => setPlatform(detectPlatform()), []);

  return (
    <div className="flex flex-col items-center gap-3.5">
      <PointerArrow targetId="cz-download-primary" />
      <a
        id="cz-download-primary"
        href={downloadHref(platform)}
        className="inline-flex items-center gap-[9px] rounded-full bg-[var(--btn-primary-bg)] px-[27px] py-[15px] text-[17px] leading-none font-medium text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)]"
      >
        {PLATFORM_LABELS[platform]}
        <DownloadArrow size={15} />
      </a>
      <p className="m-0 text-sm text-muted">
        Also available for{' '}
        {(['mac', 'windows', 'linux'] as const)
          .filter((p) => p !== platform)
          .map((p, i, arr) => (
            <span key={p}>
              <a className="text-accent hover:text-accent-hover" href={downloadHref(p)}>
                {p === 'mac' ? 'macOS' : p === 'windows' ? 'Windows' : 'Linux'}
              </a>
              {i < arr.length - 1 ? ', ' : ''}
            </span>
          ))}
      </p>
    </div>
  );
}
