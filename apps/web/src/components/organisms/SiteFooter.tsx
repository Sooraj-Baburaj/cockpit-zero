import Link from 'next/link';
import { FOOTER_COLS } from '@/lib/content';

export function SiteFooter() {
  return (
    <footer className="border-t border-line-soft px-4 pt-12 pb-10 sm:px-10 md:pt-20">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-9">
        <div className="min-w-[220px]">
          <h2 className="m-0 mb-3 text-[clamp(30px,4vw,46px)] leading-[1.02] font-medium tracking-[-0.03em]">
            Summon anything.
          </h2>
          <p className="m-0 max-w-[38ch] font-mono text-[14.5px] leading-[1.55] text-muted">
            Made for people who think reaching for the mouse counts as cardio.
          </p>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <span className="mb-4 block font-mono text-xs leading-none font-medium tracking-[0.1em] uppercase text-muted">
              {col.title}
            </span>
            <div className="flex flex-col gap-[11px]">
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[15px] leading-none text-ink transition-colors hover:text-accent"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-11 flex max-w-[1240px] flex-wrap items-center justify-between gap-3.5 border-t border-line-soft pt-[22px]">
        <span className="font-mono text-[13px] leading-none text-muted">© 2026 CockpitZero</span>
        <div className="flex flex-wrap gap-5">
          {['Privacy', 'Terms', 'Status'].map((label) => (
            <Link
              key={label}
              href="#"
              className="font-mono text-[13px] leading-none text-muted transition-colors hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
