import type { Metadata } from 'next';
import { APP_NAME } from '@cockpitzero/shared';
import './globals.css';

export const metadata: Metadata = {
  title: `${APP_NAME} — the keyboard-first desktop launcher`,
  description: 'Launch anything, automate everything. A fast, cross-platform command bar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
