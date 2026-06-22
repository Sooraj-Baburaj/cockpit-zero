import { Sparkle } from '../atoms/Sparkle.js';

/** The uppercase "AI mode" chip with a spark, shown at the right of the search
 *  row while the bar is offering / running an ask. Sienna on a soft accent wash. */
export function AiModePill() {
  return (
    <span className="flex shrink-0 items-center gap-[7px] rounded-[var(--cz-radius-full)] border px-[11px] py-[5px] text-[10.5px] font-semibold tracking-[0.12em] text-[var(--cz-accent-bright)] uppercase [background:var(--cz-accent-soft)] [border-color:var(--cz-accent-line)]">
      <Sparkle className="size-[13px]" />
      AI mode
    </span>
  );
}
