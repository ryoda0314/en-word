'use client';

import { Button, type ButtonProps } from '@mantine/core';
import type { ComponentPropsWithoutRef } from 'react';

import { Link } from '@/i18n/navigation';

type LinkProps = ComponentPropsWithoutRef<typeof Link>;

type LinkButtonProps = ButtonProps &
  Omit<LinkProps, keyof ButtonProps> & {
    href: LinkProps['href'];
  };

export function LinkButton(props: LinkButtonProps) {
  return <Button component={Link} {...props} />;
}
