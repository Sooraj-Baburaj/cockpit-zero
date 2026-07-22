import Link from 'next/link';

const primaryClasses =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-none bg-[var(--btn-primary-bg)] font-medium text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)]';

const tonalClasses =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line-soft bg-[var(--btn-tonal-bg)] font-medium text-ink transition-colors hover:bg-[var(--btn-tonal-hover)]';

export function PrimaryCta({
  href,
  children,
  large = false,
  className = '',
  id,
}: {
  href: string;
  children: React.ReactNode;
  large?: boolean;
  className?: string;
  /** DOM id — used e.g. as a PointerArrow target. */
  id?: string;
}) {
  return (
    <Link
      id={id}
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
