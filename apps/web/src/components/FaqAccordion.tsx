'use client';

import { useState } from 'react';
import { FAQS } from '@/lib/content';

export function FaqAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <div>
      {FAQS.map((f, i) => (
        <div key={f.q} className="border-t border-line-soft">
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
            className="flex w-full cursor-pointer items-center justify-between gap-4 border-none bg-transparent px-1 py-5 text-left text-[clamp(16px,1.9vw,19px)] leading-[1.35] font-medium text-ink"
          >
            <span>{f.q}</span>
            <span className="flex-none font-mono text-[22px] leading-none text-muted">
              {open === i ? '–' : '+'}
            </span>
          </button>
          {open === i && (
            <p className="m-0 max-w-[62ch] px-1 pb-[22px] text-[15.5px] leading-[1.6] text-muted">{f.a}</p>
          )}
        </div>
      ))}
      <div className="border-t border-line-soft" />
    </div>
  );
}
