'use client';

import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'indigo',
  primaryShade: { light: 6, dark: 5 },
  fontFamily:
    'var(--font-inter), var(--font-noto-sans-jp), system-ui, -apple-system, sans-serif',
  fontFamilyMonospace:
    'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
  headings: {
    fontFamily:
      'var(--font-inter), var(--font-noto-sans-jp), system-ui, -apple-system, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
});
