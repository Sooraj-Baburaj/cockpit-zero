import type { Metadata } from 'next';
import { Eyebrow } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Docs — CockpitZero',
  description: 'CockpitZero documentation.',
};

export default function DocsPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[clamp(104px,14vh,160px)] pb-[clamp(48px,8vh,110px)] sm:px-10">
      <Eyebrow>Docs</Eyebrow>
      <h1 className="m-0 text-[clamp(34px,5vw,56px)] leading-[1.05] font-medium tracking-[-0.03em]">
        Documentation
      </h1>
      <p className="m-0 max-w-[52ch] text-lg leading-[1.55] text-muted">
        Documentation is coming soon. Check back shortly — or press the hotkey and find out for
        yourself.
      </p>
    </main>
  );
}
