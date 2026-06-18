import Link from 'next/link';
import { APP_NAME } from '@cockpitzero/shared';

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-32 text-center">
      <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
        Keyboard-first
      </span>
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">{APP_NAME}</h1>
      <p className="max-w-xl text-lg text-white/70">
        Launch anything, automate everything. A fast, frameless command bar for macOS, Windows, and
        Linux — one hotkey away.
      </p>
      <div className="flex gap-4">
        <Link
          href="/download"
          className="rounded-lg bg-white px-5 py-2.5 font-medium text-black transition hover:bg-white/90"
        >
          Download
        </Link>
        <Link
          href="/docs"
          className="rounded-lg border border-white/20 px-5 py-2.5 font-medium transition hover:bg-white/5"
        >
          Docs
        </Link>
      </div>
    </main>
  );
}
