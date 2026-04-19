'use client';

import {
  ActionIcon,
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  BookOpen,
  BookText,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Moon,
  PictureInPicture2,
  Settings,
  Shield,
  Sun,
  Target,
  Video,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/read', labelKey: 'read', icon: BookOpen },
  { href: '/watch', labelKey: 'watch', icon: Video },
  { href: '/vocab', labelKey: 'vocab', icon: BookText },
  { href: '/review', labelKey: 'review', icon: Target },
  { href: '/drill', labelKey: 'drill', icon: Dumbbell },
  { href: '/ticker', labelKey: 'ticker', icon: PictureInPicture2 },
  { href: '/settings', labelKey: 'settings', icon: Settings },
] as const;

const adminNavItem = {
  href: '/admin',
  labelKey: 'admin',
  icon: Shield,
} as const;

export function AppShellLayout({
  children,
  userEmail,
  isAdmin = false,
}: {
  children: ReactNode;
  userEmail: string | null;
  isAdmin?: boolean;
}) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure(false);
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign('/');
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={600}>en-word-book</Text>
          </Group>
          <Group gap="xs">
            <Tooltip label={computed === 'dark' ? 'Light' : 'Dark'}>
              <ActionIcon
                variant="subtle"
                onClick={() => setColorScheme(computed === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle color scheme"
              >
                {computed === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label={tCommon('signOut')}>
              <ActionIcon
                variant="subtle"
                onClick={handleSignOut}
                aria-label={tCommon('signOut')}
              >
                <LogOut size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          {navItems.map(({ href, labelKey, icon: Icon }) => (
            <NavLink
              key={href}
              component={Link}
              href={href}
              label={t(labelKey)}
              leftSection={<Icon size={18} />}
              active={pathname === href || pathname.startsWith(`${href}/`)}
              onClick={close}
              mb={2}
            />
          ))}
          {isAdmin ? (
            <NavLink
              component={Link}
              href={adminNavItem.href}
              label={t(adminNavItem.labelKey)}
              leftSection={<adminNavItem.icon size={18} />}
              active={
                pathname === adminNavItem.href ||
                pathname.startsWith(`${adminNavItem.href}/`)
              }
              onClick={close}
              mb={2}
            />
          ) : null}
        </AppShell.Section>
        {userEmail ? (
          <AppShell.Section>
            <Text size="xs" c="dimmed" truncate>
              {userEmail}
            </Text>
          </AppShell.Section>
        ) : null}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
