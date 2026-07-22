'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from '@/lib/content';
import { DownloadArrow } from '@/components/atoms/DownloadArrow';
import { LogoMark } from '@/components/atoms/LogoMark';

function applyTheme(dark: boolean) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  try {
    localStorage.setItem('cz-theme', dark ? 'dark' : 'light');
  } catch {
    /* private mode */
  }
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
  }, []);

  // Close the mobile menu on navigation.
  useEffect(() => setMenuOpen(false), [pathname]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-line-soft bg-[var(--nav-bg)] backdrop-blur-xl backdrop-saturate-[1.3]">
        <div className="mx-auto flex w-full max-w-[1240px] items-center gap-[18px] px-4 sm:px-10">
          <Link href="/" className="flex items-center gap-2.5 text-ink">
            <span className="cz-brand-grad inline-flex h-[26px] w-[26px] items-center justify-center rounded-lg">
              <LogoMark size={17} className="text-white" />
            </span>
            <span className="text-[17px] leading-none font-semibold tracking-[-0.02em]">
              Cockpit<span className="text-muted">Zero</span>
            </span>
          </Link>

          <nav className="mx-auto hidden items-center gap-1 desk:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className="rounded-lg px-3 py-2 text-[14.5px] leading-none font-medium text-muted transition-colors hover:bg-[var(--btn-tonal-bg)] hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="inline-flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full border border-line-soft bg-[var(--btn-tonal-bg)] transition-colors hover:bg-[var(--btn-tonal-hover)]"
            >
              <span
                className="h-[15px] w-[15px] rounded-full border-[1.6px] border-[var(--text)]"
                style={{
                  background: 'linear-gradient(90deg,var(--text) 0 50%,transparent 50% 100%)',
                }}
              />
            </button>
            <Link
              href="/download"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--btn-primary-bg)] px-[18px] py-[9px] text-[14.5px] leading-none font-medium text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)]"
            >
              Download
              <DownloadArrow />
            </Link>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="inline-flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[9px] border border-line-soft bg-[var(--btn-tonal-bg)] desk:hidden"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-x-0 top-14 bottom-0 z-40 flex flex-col bg-bg px-4 py-2.5 sm:px-10 desk:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="border-b border-line-soft px-1 py-5 text-[22px] leading-none font-medium text-ink"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/download"
            onClick={() => setMenuOpen(false)}
            className="mt-[22px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--btn-primary-bg)] px-6 py-3.5 text-base leading-none font-medium text-[var(--btn-primary-text)]"
          >
            Download CockpitZero
          </Link>
        </div>
      )}
    </>
  );
}
