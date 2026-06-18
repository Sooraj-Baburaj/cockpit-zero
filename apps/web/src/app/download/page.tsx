import { DownloadButton } from '@/components/DownloadButton';

export default function DownloadPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-32 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Download CockpitZero</h1>
      <p className="max-w-lg text-white/70">
        We detected your platform automatically. Free during beta.
      </p>
      <DownloadButton />
    </main>
  );
}
