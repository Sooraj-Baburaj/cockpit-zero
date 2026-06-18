import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keeps the workspace's shared package transpiled correctly in the app.
  transpilePackages: ['@cockpitzero/shared'],
  // Linting is a dedicated Turbo task (`pnpm lint`); don't re-run it during build.
  eslint: { ignoreDuringBuilds: true },
  // Static-export capable: uncomment to emit a fully static site to `out/`.
  // output: 'export',
};

export default nextConfig;
