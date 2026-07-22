import { LogoMark } from '@/components/atoms/LogoMark';

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
