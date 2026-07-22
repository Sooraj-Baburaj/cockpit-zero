import type { Metadata } from 'next';
import { STEPS } from '@/lib/content';
import { Eyebrow, Kbd, MediaPlaceholder, PrimaryCta, SearchIcon, TonalCta } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Product — CockpitZero',
  description:
    'Search, act, and automate without lifting your hands off the keyboard. Everything CockpitZero does under one hotkey.',
};

const PLATFORMS: [string, string][] = [
  ['macOS', 'Universal binary. Spotlight integration for files and apps.'],
  ['Windows', 'x64 & ARM64. Hooks into Windows Search out of the box.'],
  ['Linux', 'AppImage, .deb & .rpm. Wayland and X11 supported.'],
];

export default function ProductPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-[clamp(98px,12vh,150px)] pb-[clamp(30px,5vh,60px)] sm:px-10">
        <div className="relative mx-auto flex max-w-[900px] flex-col items-center gap-[22px] text-center">
          <Eyebrow>The product</Eyebrow>
          <h1 className="m-0 max-w-[15ch] text-[clamp(36px,6.4vw,72px)] leading-[1.04] font-medium tracking-[-0.03em] text-balance">
            One bar. Your whole computer.
          </h1>
          <p className="m-0 max-w-[56ch] text-[clamp(16px,1.9vw,20px)] leading-[1.55] text-muted">
            Search, act, and automate without lifting your hands off the keyboard. Here&apos;s
            everything CockpitZero does under that one hotkey.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryCta href="/download" large>
              Download free
            </PrimaryCta>
            <TonalCta href="/pricing" large>
              View pricing
            </TonalCta>
          </div>

          <div className="mt-4 w-[min(560px,95vw)] overflow-hidden rounded-2xl border border-line bg-surface text-left">
            <div className="flex items-center gap-3 border-b border-line-soft px-[18px] py-3.5">
              <SearchIcon size={17} />
              <span className="flex-1 text-[17px] leading-none font-medium text-ink">deploy prod</span>
              <Kbd>↵</Kbd>
            </div>
            <div className="p-2">
              <div className="flex items-center gap-3 rounded-[10px] bg-accent-soft px-3 py-2.5">
                <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-surface-3 font-mono text-[15px] leading-none font-medium text-ink">
                  ⧉
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] leading-tight font-medium">
                    Deploy → production
                  </span>
                  <span className="block font-mono text-xs leading-[1.3] text-muted">
                    Workflow · 3 steps
                  </span>
                </span>
                <span className="rounded-md border border-line-soft px-[7px] py-1 font-mono text-[10px] leading-none font-medium tracking-[0.08em] uppercase text-muted">
                  flow
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature bands */}
      <section className="px-4 py-10 sm:px-10 md:py-20">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-[clamp(40px,6vw,88px)]">
          {STEPS.map((st) => (
            <div
              key={st.n}
              data-band
              data-reveal
              className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-[clamp(28px,4vw,64px)]"
            >
              <div>
                <div className="mb-2.5 flex items-baseline gap-3">
                  <span className="font-mono text-sm leading-none font-medium text-accent">{st.n}</span>
                  <span className="font-mono text-xs leading-none font-medium tracking-[0.1em] uppercase text-muted">
                    {st.tag}
                  </span>
                </div>
                <h2 className="mt-0 mb-3 text-[clamp(26px,3vw,38px)] leading-[1.1] font-semibold tracking-[-0.02em]">
                  {st.title}
                </h2>
                <p className="m-0 max-w-[46ch] text-[clamp(16px,1.8vw,18px)] leading-[1.6] text-muted">
                  {st.body}
                </p>
              </div>
              <div data-bandmedia>
                <MediaPlaceholder
                  label={st.media}
                  aspect="4/3"
                  className="rounded-[clamp(16px,2vw,24px)] border border-line"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Local first */}
      <section className="px-4 py-10 sm:px-10 md:py-20">
        <div className="mx-auto max-w-[1080px] text-center">
          <Eyebrow>Local first</Eyebrow>
          <h2
            data-reveal
            className="mt-3.5 mb-2 text-[clamp(26px,3.2vw,40px)] leading-[1.1] font-semibold tracking-[-0.02em]"
          >
            Your computer. Not ours.
          </h2>
          <p data-reveal className="mx-auto mt-0 mb-[34px] max-w-[48ch] text-base leading-[1.55] text-muted">
            Your actions live in a config file. Your workflows live on your machine. If the internet
            dies, CockpitZero shrugs and keeps working. No account required, ever.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {PLATFORMS.map(([name, blurb]) => (
              <div key={name} data-reveal className="rounded-[20px] border border-line bg-surface p-7">
                <span className="font-mono text-sm leading-none font-medium tracking-[0.06em] text-accent">
                  {name}
                </span>
                <p className="mt-3 mb-0 text-[14.5px] leading-[1.5] text-muted">{blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-4 pt-[clamp(30px,4vw,60px)] pb-12 sm:px-10 md:pb-[90px]">
        <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-[18px] rounded-[clamp(20px,3vw,36px)] border border-line-soft bg-surface-2 p-9 text-center md:p-[72px]">
          <h2 className="m-0 text-[clamp(28px,4vw,50px)] leading-[1.06] font-medium tracking-[-0.03em]">
            Put it on your keyboard
          </h2>
          <p className="m-0 max-w-[46ch] text-[17px] leading-[1.55] text-muted">
            Free forever, no account required. See where it fits.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-3">
            <PrimaryCta href="/download" large>
              Download free
            </PrimaryCta>
            <TonalCta href="/pricing" large>
              View pricing
            </TonalCta>
          </div>
        </div>
      </section>
    </main>
  );
}
