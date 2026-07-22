import type { Metadata } from 'next';
import { DownloadButton } from '@/components/DownloadButton';
import { ParticleField } from '@/components/ParticleField';
import { Eyebrow } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Download — CockpitZero',
  description: 'Get CockpitZero for macOS, Windows, or Linux. Free forever, no account.',
};

export default function DownloadPage() {
  return (
    <main className="relative overflow-hidden">
      <ParticleField count={60} className="opacity-70" />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-[22px] px-4 pt-[clamp(104px,14vh,160px)] pb-[clamp(48px,8vh,110px)] text-center sm:px-10">
        <Eyebrow>Download</Eyebrow>
        <h1 className="m-0 max-w-[14ch] text-[clamp(36px,6vw,68px)] leading-[1.04] font-medium tracking-[-0.03em] text-balance">
          Put your keyboard in charge.
        </h1>
        <p className="m-0 max-w-[48ch] text-[clamp(16px,1.9vw,20px)] leading-[1.55] text-muted">
          We detected your platform automatically. Free forever — no account, no credit card.
        </p>
        <DownloadButton />
        <p className="m-0 font-mono text-xs leading-none text-muted">
          macOS • Windows • Linux · free forever · no account
        </p>
      </div>
    </main>
  );
}
