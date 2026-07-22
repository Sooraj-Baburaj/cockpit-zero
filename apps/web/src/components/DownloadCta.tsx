import { ParticleField } from '@/components/ParticleField';
import { Eyebrow } from '@/components/ui';
import { downloadHref } from '@/lib/downloads';

/** Inverse "one last thing" download band with rising particles. */
export function DownloadCta() {
  return (
    <section id="download" className="px-4 py-9 sm:px-10 md:py-[84px]">
      <div className="relative mx-auto max-w-[1160px] overflow-hidden rounded-[clamp(22px,3vw,40px)] bg-inverse-bg px-6 py-12 text-inverse-text sm:px-[72px] md:py-24">
        <ParticleField count={80} dir="up" className="opacity-55" />
        <div className="relative flex flex-col items-center gap-5 text-center">
          <Eyebrow inverse>One last thing</Eyebrow>
          <h2 className="m-0 max-w-[16ch] text-[clamp(32px,5vw,60px)] leading-[1.05] font-medium tracking-[-0.03em] text-balance">
            Give your keyboard the rest of your computer.
          </h2>
          <p className="m-0 max-w-[48ch] text-[clamp(16px,1.8vw,19px)] leading-[1.55] text-inverse-muted">
            Your hands already know where the keys are. Everything else should meet them there.
          </p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-3">
            <a
              href={downloadHref('mac')}
              className="inline-flex items-center gap-[9px] rounded-full bg-inverse-text px-6 py-[13px] text-[15.5px] leading-none font-medium text-inverse-bg"
            >
              Download for macOS
            </a>
            <a
              href={downloadHref('windows')}
              className="inline-flex items-center gap-[9px] rounded-full border border-inverse-border bg-[rgba(246,244,239,.08)] px-6 py-[13px] text-[15.5px] leading-none font-medium text-inverse-text"
            >
              Windows
            </a>
            <a
              href={downloadHref('linux')}
              className="inline-flex items-center gap-[9px] rounded-full border border-inverse-border bg-[rgba(246,244,239,.08)] px-6 py-[13px] text-[15.5px] leading-none font-medium text-inverse-text"
            >
              Linux
            </a>
          </div>
          <p className="mt-1.5 mb-0 font-mono text-xs leading-none text-inverse-muted">
            macOS • Windows • Linux · free forever · no account
          </p>
        </div>
      </div>
    </section>
  );
}
