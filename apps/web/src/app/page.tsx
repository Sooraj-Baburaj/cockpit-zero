import { ParticleField } from '@/components/ParticleField';
import { LauncherDemo } from '@/components/LauncherDemo';
import { StickyFeatures } from '@/components/StickyFeatures';
import { DemoCarousel } from '@/components/DemoCarousel';
import { DownloadCta } from '@/components/DownloadCta';
import { DownloadArrow, Eyebrow, MediaPlaceholder, PrimaryCta, TonalCta } from '@/components/ui';

const ARG_EXAMPLES: [string, string][] = [
  ['email', 'john'],
  ['ticket', 'ADO-18327'],
  ['translate', 'hello'],
  ['search', 'react usememo'],
  ['resize', '50%'],
  ['weather', 'tokyo'],
];

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-[clamp(104px,14vh,160px)] pb-[clamp(36px,6vh,80px)] sm:px-10">
        <ParticleField count={60} className="opacity-80" />
        <div className="relative mx-auto flex max-w-[960px] flex-col items-center gap-[22px] text-center">
          <h1 className="m-0 max-w-[15ch] text-[clamp(42px,7.6vw,86px)] leading-[1.02] font-medium tracking-[-0.032em] text-balance">
            Your mouse had a good run.
          </h1>
          <p className="m-0 max-w-[58ch] text-[clamp(17px,2vw,21px)] leading-[1.55] text-muted">
            Every time your hand leaves the keyboard, your brain context-switches a little.
            CockpitZero fixes that — one hotkey to search apps, files, folders, URLs, scripts,
            snippets, and the actions you built. Hit Enter. Keep working.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <PrimaryCta href="/download" large>
              Download — free forever
              <DownloadArrow />
            </PrimaryCta>
            <TonalCta href="/product" large>
              See it in action
            </TonalCta>
          </div>
          <p className="-mt-1 mb-0 font-mono text-[13px] leading-none text-muted">
            No account. No credit card. No “start your 14-day trial.”
          </p>
          <LauncherDemo />
        </div>
      </section>

      {/* Why it exists */}
      <section className="px-4 py-12 sm:px-10 md:py-[100px]">
        <div className="mx-auto max-w-[1120px]">
          <div data-reveal className="mx-auto mb-[42px] max-w-[730px] text-center">
            <Eyebrow>Why it exists</Eyebrow>
            <h2 className="mt-3.5 mb-3 text-[clamp(28px,4.2vw,44px)] leading-[1.08] font-semibold tracking-[-0.02em]">
              Your computer already knows where everything is
            </h2>
            <p className="m-0 text-[clamp(16px,1.8vw,19px)] leading-[1.55] text-muted">
              You just don&apos;t remember what menu it&apos;s hiding under. Apps, files, shell
              scripts, folders, URLs, commands, snippets — CockpitZero throws them into one search
              bar and lets fuzzy search sort out the rest. Three wrong letters are usually enough.
            </p>
          </div>
          <div
            data-reveal
            className="mx-auto max-w-[980px] overflow-hidden rounded-[clamp(16px,2vw,28px)] border border-line bg-surface"
          >
            <div className="flex h-[42px] items-center gap-3.5 border-b border-line-soft px-4">
              <span className="inline-flex gap-[7px]">
                <span className="h-[11px] w-[11px] rounded-full bg-surface-3" />
                <span className="h-[11px] w-[11px] rounded-full bg-surface-3" />
                <span className="h-[11px] w-[11px] rounded-full bg-surface-3" />
              </span>
              <span className="font-mono text-[12.5px] leading-none text-muted">
                CockpitZero — command bar
              </span>
            </div>
            <MediaPlaceholder label="product demo — launcher in action" aspect="16/9" />
          </div>
        </div>
      </section>

      <StickyFeatures />

      {/* Arguments */}
      <section className="px-4 py-10 sm:px-10 md:py-[90px]">
        <div className="mx-auto max-w-[900px] text-center">
          <Eyebrow>Type first. Explain later.</Eyebrow>
          <h2 className="mt-3.5 mb-3 text-[clamp(28px,4.2vw,44px)] leading-[1.08] font-semibold tracking-[-0.02em]">
            Actions don&apos;t stop at the space bar
          </h2>
          <p className="mx-auto mt-0 mb-[30px] max-w-[52ch] text-[clamp(16px,1.8vw,19px)] leading-[1.55] text-muted">
            Keep typing — everything after the action becomes its input. No dialogs, no popups, no
            “please fill out this form.”
          </p>
          <div
            data-reveal
            className="mx-auto flex max-w-[520px] flex-col gap-[13px] rounded-[18px] border border-line-soft bg-surface-2 p-5 text-left sm:p-[30px]"
          >
            {ARG_EXAMPLES.map(([action, arg]) => (
              <div
                key={action}
                className="flex gap-2.5 font-mono text-[clamp(14px,1.7vw,17px)] leading-[1.3] font-medium"
              >
                <span className="text-muted">&gt;</span>
                <span className="text-accent">{action}</span>
                <span className="text-ink">{arg}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiny demos */}
      <section className="px-4 py-12 sm:px-10 md:py-[100px]">
        <div className="mx-auto max-w-[1200px]">
          <div data-reveal className="mb-[34px] flex flex-wrap items-end justify-between gap-5">
            <h2 className="m-0 max-w-[12ch] text-[clamp(28px,3.6vw,44px)] leading-[1.08] font-semibold tracking-[-0.02em]">
              Tiny demos
            </h2>
            <p className="m-0 max-w-[40ch] text-base leading-[1.55] text-muted">
              Because watching software work beats reading about it.
            </p>
          </div>
          <DemoCarousel />
        </div>
      </section>

      {/* Free / Teams */}
      <section className="px-4 py-12 sm:px-10 md:py-[100px]">
        <div className="mx-auto grid max-w-[1080px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[22px]">
          <div data-reveal className="rounded-[26px] border border-line bg-surface p-7 md:p-11">
            <span className="font-mono text-xs leading-none font-medium tracking-[0.12em] uppercase text-muted">
              Free forever
            </span>
            <h3 className="mt-3.5 mb-2.5 text-[clamp(24px,2.6vw,32px)] leading-[1.1] font-semibold tracking-[-0.02em]">
              No account. No countdown.
            </h3>
            <p className="mt-0 mb-[22px] text-[15.5px] leading-[1.55] text-muted">
              No subscription, no feature timer. Install it, use it, delete it if you hate it. (We
              think you won&apos;t.)
            </p>
            <PrimaryCta href="/download">Download free</PrimaryCta>
          </div>
          <div data-reveal className="rounded-[26px] border border-line bg-surface p-7 md:p-11">
            <span className="font-mono text-xs leading-none font-medium tracking-[0.12em] uppercase text-muted">
              Teams
            </span>
            <h3 className="mt-3.5 mb-2.5 text-[clamp(24px,2.6vw,32px)] leading-[1.1] font-semibold tracking-[-0.02em]">
              The same setup on every machine
            </h3>
            <p className="mt-0 mb-[22px] text-[15.5px] leading-[1.55] text-muted">
              Log in and sync your actions, workflows, and AI memory. Let everyone stop asking, “can
              you send me that script again?”
            </p>
            <TonalCta href="/pricing">Sync your team</TonalCta>
          </div>
        </div>
      </section>

      <DownloadCta />
    </main>
  );
}
