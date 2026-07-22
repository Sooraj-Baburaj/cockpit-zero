import Link from 'next/link';
import { LogoMark } from '@/components/LogoMark';

/** Small down-arrow used inside download CTAs. */
export function DownloadArrow({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 4v11" />
      <path d="M6 11l6 6 6-6" />
      <path d="M5 20h14" />
    </svg>
  );
}

const primaryClasses =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-[var(--btn-primary-bg)] font-medium text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)]';

const tonalClasses =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line-soft bg-[var(--btn-tonal-bg)] font-medium text-ink transition-colors hover:bg-[var(--btn-tonal-hover)]';

export function PrimaryCta({
  href,
  children,
  large = false,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  large?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${primaryClasses} ${large ? 'px-[25px] py-[13px] text-base' : 'px-[22px] py-3 text-[15px]'} leading-none ${className}`}
    >
      {children}
    </Link>
  );
}

export function TonalCta({
  href,
  children,
  large = false,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  large?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`${tonalClasses} ${large ? 'px-6 py-[13px] text-base' : 'px-[22px] py-3 text-[15px]'} leading-none ${className}`}
    >
      {children}
    </Link>
  );
}

/** Mono uppercase section label. */
export function Eyebrow({
  children,
  inverse = false,
}: {
  children: React.ReactNode;
  inverse?: boolean;
}) {
  return (
    <span
      className={`font-mono text-xs font-medium tracking-[0.14em] uppercase ${inverse ? 'text-inverse-muted' : 'text-muted'}`}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-line-soft bg-surface-3 px-2 py-[3px] font-mono text-xs font-medium text-muted">
      {children}
    </kbd>
  );
}

/** Brand-gradient media card with a faint logo watermark and a mono label chip. */
export function MediaPlaceholder({
  label,
  aspect,
  className = '',
}: {
  label: string;
  aspect: string;
  className?: string;
}) {
  return (
    <div
      className={`cz-brand-grad relative flex items-center justify-center overflow-hidden p-5 ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <LogoMark className="absolute h-[46%] w-auto text-white/25" />
      <span className="relative rounded-lg border border-white/25 bg-black/35 px-3.5 py-2.5 text-center font-mono text-[12.5px] leading-[1.4] font-medium text-white">
        {label}
      </span>
    </div>
  );
}

export function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-muted)"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
