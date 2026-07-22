import type { Metadata } from 'next';
import { Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { APP_NAME } from '@cockpitzero/shared';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import './globals.css';

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-hanken',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: `${APP_NAME} — the keyboard-first desktop launcher`,
  description:
    'One hotkey to search apps, files, folders, URLs, scripts, snippets, and the actions you built. Hit Enter. Keep working.',
};

const themeInit = `try{var t=localStorage.getItem('cz-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${hanken.variable} ${plexMono.variable} min-h-screen font-sans antialiased`}>
        <div className="relative min-h-screen overflow-x-clip">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
