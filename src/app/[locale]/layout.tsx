import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import {
  Inter,
  JetBrains_Mono,
  Noto_Sans_JP,
  Noto_Serif_JP,
  Source_Serif_4,
} from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import {
  ColorSchemeScript,
  mantineHtmlProps,
  MantineProvider,
} from '@mantine/core';

import '@mantine/core/styles.css';
import '../globals.css';

import { routing } from '@/i18n/routing';
import { theme } from '@/theme';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  weight: ['400', '500', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});

const notoSerifJp = Noto_Serif_JP({
  subsets: ['latin'],
  variable: '--font-noto-serif-jp',
  weight: ['400', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'en-word-book',
    template: '%s · en-word-book',
  },
  description: 'TOEIC/TOEFL の長文から語彙を育てる学習アプリ',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      {...mantineHtmlProps}
      className={`${inter.variable} ${notoSansJp.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} ${notoSerifJp.variable}`}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
