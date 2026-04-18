'use client';

import { Card, type CardProps } from '@mantine/core';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

type LinkProps = ComponentPropsWithoutRef<typeof Link>;

type LinkCardProps = Omit<CardProps, 'component'> & {
  href: LinkProps['href'];
  children: ReactNode;
};

export function LinkCard({ href, children, ...cardProps }: LinkCardProps) {
  return (
    <Card
      component={Link}
      href={href}
      style={{ textDecoration: 'none', display: 'block' }}
      {...cardProps}
    >
      {children}
    </Card>
  );
}
