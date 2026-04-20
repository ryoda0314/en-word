import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const csp = [
  "default-src 'self'",
  // Next.js dev/prod scripts + YouTube IFrame API
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
  // Inline styles (Mantine) + Google Fonts CSS
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Google Fonts files
  "font-src 'self' https://fonts.gstatic.com",
  // YouTube player iframe + nocookie embed
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  // Supabase, OpenAI, Gemini, YouTube (service-worker fetch of iframe_api)
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.youtube.com https://api.openai.com https://generativelanguage.googleapis.com",
  // App images + YouTube thumbnails + Supabase storage
  "img-src 'self' data: blob: https://i.ytimg.com https://*.supabase.co",
  // TTS audio blobs from Supabase storage
  "media-src 'self' blob: https://*.supabase.co",
  // Service workers
  "worker-src 'self' blob:",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: csp }],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks', 'lucide-react'],
  },
};

export default withNextIntl(nextConfig);
