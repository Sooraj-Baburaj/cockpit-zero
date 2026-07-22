import type { Metadata } from 'next';
import Link from 'next/link';
import { PLANS } from '@/lib/content';
import { ParticleField } from '@/components/molecules/ParticleField';
import { FaqAccordion } from '@/components/molecules/FaqAccordion';
import { Eyebrow } from '@/components/atoms/Eyebrow';

export const metadata: Metadata = {
  title: 'Pricing — CockpitZero',
  description:
    'The launcher is free forever. Pay only when you want managed AI and sync across your devices.',
};

function ctaHref(label: string): string {
  return label === 'Contact sales' ? 'mailto:hello@cockpitzero.app' : '/download';
}

export default function PricingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-[clamp(98px,12vh,150px)] pb-[clamp(24px,4vh,50px)] sm:px-10">
        <ParticleField count={54} className="opacity-65" />
        <div className="relative mx-auto flex max-w-[820px] flex-col items-center gap-[18px] text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h1 className="m-0 max-w-[15ch] text-[clamp(34px,6vw,68px)] leading-[1.04] font-medium tracking-[-0.03em] text-balance">
            Pricing that stays out of your way.
          </h1>
          <p className="m-0 max-w-[52ch] text-[clamp(16px,1.9vw,20px)] leading-[1.55] text-muted">
            The launcher is free forever. Pay only when you want managed AI and sync across your
            devices.
          </p>
          <Link href="/download" className="text-[15px] leading-none font-medium text-accent">
            CockpitZero is free forever →
          </Link>
        </div>
      </section>

      {/* Plans */}
      <section className="px-4 pt-6 pb-10 sm:px-10 md:pt-11 md:pb-20">
        <div className="mx-auto grid max-w-[1220px] grid-cols-[repeat(auto-fit,minmax(252px,1fr))] items-start gap-[18px]">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              data-accent={plan.accent ? 'true' : undefined}
              data-reveal
              className="flex flex-col rounded-3xl border border-line bg-surface px-6 py-[26px]"
            >
              <span
                data-badge
                className="font-mono text-[11.5px] leading-none font-medium tracking-[0.09em] uppercase text-muted"
              >
                {plan.tagLabel}
              </span>
              <h3 className="mt-[15px] mb-1 text-[25px] leading-[1.1] font-semibold tracking-[-0.01em]">
                {plan.name}
              </h3>
              <div className="mb-3 flex items-baseline gap-[3px]">
                <span className="text-[clamp(30px,3vw,36px)] leading-none font-semibold tracking-[-0.02em]">
                  {plan.price}
                </span>
                <span className="font-mono text-[13.5px] leading-none text-muted">{plan.unit}</span>
              </div>
              <p className="mt-0 mb-5 min-h-[4.2em] text-sm leading-[1.5] text-muted">
                {plan.blurb}
              </p>
              <Link
                href={ctaHref(plan.cta)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--btn-primary-bg)] px-5 py-3 text-[15px] leading-none font-medium text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--btn-primary-hover)]"
              >
                {plan.cta}
              </Link>
              {plan.cta2 && (
                <Link
                  href={ctaHref(plan.cta2)}
                  className="mt-2.5 inline-flex items-center justify-center gap-2 rounded-full border border-line-soft bg-[var(--btn-tonal-bg)] px-5 py-3 text-[15px] leading-none font-medium text-ink transition-colors hover:bg-[var(--btn-tonal-hover)]"
                >
                  {plan.cta2}
                </Link>
              )}
              <div className="my-[22px] mb-[18px] h-px bg-[var(--border-soft)]" />
              <span className="font-mono text-[11px] leading-none font-medium tracking-[0.1em] uppercase text-muted">
                Includes
              </span>
              <ul className="m-0 mt-3.5 flex list-none flex-col gap-[11px] p-0">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm leading-[1.4] text-ink"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 flex-none"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-[22px] mb-0 max-w-[1220px] text-center font-mono text-[12.5px] leading-[1.5] text-muted">
          Prices shown are placeholders for layout. * Rate limits and credit pools vary by plan.
        </p>
      </section>

      {/* FAQ */}
      <section className="px-4 py-9 sm:px-10 md:py-[72px]">
        <div className="mx-auto max-w-[760px]">
          <h2 className="mt-0 mb-2 text-center text-[clamp(26px,3.2vw,38px)] leading-[1.1] font-semibold tracking-[-0.02em]">
            Questions
          </h2>
          <p className="mt-0 mb-[30px] text-center text-base leading-[1.55] text-muted">
            The short version: you don&apos;t need an account, and your stuff stays yours.
          </p>
          <FaqAccordion />
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-4 pt-5 pb-12 sm:px-10 md:pt-11 md:pb-[90px]">
        <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-4 rounded-[clamp(20px,3vw,36px)] bg-inverse-bg p-10 text-center text-inverse-text md:p-[72px]">
          <h2 className="m-0 text-[clamp(28px,4vw,48px)] leading-[1.06] font-medium tracking-[-0.03em]">
            Start free. Upgrade never, or later.
          </h2>
          <p className="m-0 max-w-[44ch] text-base leading-[1.55] text-inverse-muted">
            Download the full launcher and bring your own key — no card, no account.
          </p>
          <Link
            href="/download"
            className="mt-1.5 inline-flex items-center gap-[9px] rounded-full bg-inverse-text px-[25px] py-[13px] text-base leading-none font-medium text-inverse-bg"
          >
            Download CockpitZero
          </Link>
        </div>
      </section>
    </main>
  );
}
