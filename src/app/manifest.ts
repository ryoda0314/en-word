import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'en-word-book',
    short_name: 'en-word-book',
    description:
      '読む・拾う・使える。TOEIC/TOEFL の長文からタップで語彙を育て、作文までつなげる学習アプリ。',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ja',
    background_color: '#FAFAF7',
    theme_color: '#4F46E5',
    categories: ['education'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
