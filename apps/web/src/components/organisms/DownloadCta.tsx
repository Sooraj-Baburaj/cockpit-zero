'use client';

import { useEffect, useState } from 'react';
import { ParticleField } from '@/components/molecules/ParticleField';
import { PointerArrow } from '@/components/molecules/PointerArrow';
import { Eyebrow } from '@/components/atoms/Eyebrow';
import { detectPlatform, downloadHref, PLATFORM_LABELS, type Platform } from '@/lib/downloads';

type KnownPlatform = Exclude<Platform, 'unknown'>;

const SHORT_LABELS: Record<KnownPlatform, string> = {
  mac: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
};

const ORDER: KnownPlatform[] = ['mac', 'windows', 'linux'];

/**
 * "One last thing" download band with rising particles — light warm surface
 * (like the product page's closing section) so the ink pointer arrow stays
 * visible in both color modes. The visitor's OS (detected client-side; macOS
 * until known) gets the highlighted button — listed first — and the pointer
 * arrow curves toward it.
 */
export function DownloadCta() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  useEffect(() => setPlatform(detectPlatform()), []);

  const primary: KnownPlatform = platform === 'unknown' ? 'mac' : (platform as KnownPlatform);
  const others = ORDER.filter((p) => p !== primary);

  return (
    <section id="download" className="px-4 py-9 sm:px-10 md:py-[84px]">
      <PointerArrow targetId="cz-cta-download" />
      <div className="relative mx-auto max-w-[1160px] overflow-hidden rounded-[clamp(22px,3vw,40px)] border border-line-soft bg-surface-2 px-6 py-12 text-ink sm:px-[72px] md:py-24">
        <ParticleField count={80} dir="up" className="opacity-55" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <Eyebrow>One last thing</Eyebrow>
          <h2 className="m-0 max-w-[16ch] text-[clamp(32px,5vw,60px)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
            Give your keyboard the rest of your computer.
          </h2>
          <p className="m-0 max-w-[48ch] text-[clamp(16px,1.8vw,19px)] leading-[1.55] text-muted">
            Your hands already know where the keys are. Everything else should meet them there.
          </p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-3">
            <a
              id="cz-cta-download"
              href={downloadHref(primary)}
              className="inline-flex items-center gap-[9px] rounded-full bg-[var(--btn-primary-bg)] px-6 py-[13px] text-[15.5px] leading-none font-medium text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)]"
            >
              {PLATFORM_LABELS[primary]}
            </a>
            {others.map((p) => (
              <a
                key={p}
                href={downloadHref(p)}
                className="inline-flex items-center gap-[9px] rounded-full border border-line-soft bg-[var(--btn-tonal-bg)] px-6 py-[13px] text-[15.5px] leading-none font-medium text-ink transition-colors hover:bg-[var(--btn-tonal-hover)]"
              >
                {SHORT_LABELS[p]}
              </a>
            ))}
          </div>
          <p className="mt-1.5 mb-0 font-mono text-xs leading-none text-muted">
            macOS • Windows • Linux · free forever · no account
          </p>
        </div>
      </div>
    </section>
  );
}
