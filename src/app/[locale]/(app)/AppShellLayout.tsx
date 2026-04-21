'use client';

import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Group,
  Menu,
  NavLink,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
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
  MoreHorizontal,
  Moon,
  PictureInPicture2,
  Settings,
  Shield,
  Sun,
  Target,
  User as UserIcon,
  Video,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ComponentType, ReactNode } from 'react';

import { Link, usePathname } from '@/i18n/navigation';
import { signOutAction } from '@/lib/actions/auth';

import styles from './AppShellLayout.module.css';

type IconType = ComponentType<{ size?: number }>;

type NavItem = {
  href: string;
  labelKey: string;
  icon: IconType;
};

const navItems: readonly NavItem[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/read', labelKey: 'read', icon: BookOpen },
  { href: '/watch', labelKey: 'watch', icon: Video },
  { href: '/vocab', labelKey: 'vocab', icon: BookText },
  { href: '/review', labelKey: 'review', icon: Target },
  { href: '/drill', labelKey: 'drill', icon: Dumbbell },
  { href: '/ticker', labelKey: 'ticker', icon: PictureInPicture2 },
  { href: '/settings', labelKey: 'settings', icon: Settings },
] as const;

const adminNavItem: NavItem = {
  href: '/admin',
  labelKey: 'admin',
  icon: Shield,
};

// Phone bottom bar: 4 primary slots + an overflow menu. Keep the 4 that a
// learner hits every day; everything else goes into the "More" menu.
const BOTTOM_PRIMARY_HREFS = ['/dashboard', '/review', '/read', '/vocab'] as const;

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
  const locale = useLocale();
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure(false);
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', {
    getInitialValueInEffect: true,
  });

  async function handleSignOut() {
    await signOutAction();
    window.location.assign('/');
  }

  const moreLabel = locale === 'ja' ? 'その他' : 'More';

  const allItems: NavItem[] = isAdmin ? [...navItems, adminNavItem] : [...navItems];
  const primaryItems = BOTTOM_PRIMARY_HREFS.map(
    (href) => allItems.find((i) => i.href === href)!,
  ).filter(Boolean);
  const primaryHrefSet = new Set<string>(BOTTOM_PRIMARY_HREFS);
  const overflowItems = allItems.filter((i) => !primaryHrefSet.has(i.href));

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <AppShell
        header={{ height: 56 }}
        navbar={{
          width: 240,
          // Below lg: navbar collapses (tablet hamburger drawer or phone: kept
          // collapsed and hidden since the Burger is only shown on sm–lg).
          // Above lg: pinned sidebar.
          breakpoint: 'lg',
          collapsed: { mobile: !opened, desktop: false },
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="sm">
              {/* Hamburger: tablet only (sm–lg). */}
              <Burger
                opened={opened}
                onClick={toggle}
                visibleFrom="sm"
                hiddenFrom="lg"
                size="sm"
              />
              <Text fw={600}>en-word-book</Text>
            </Group>
            <Group gap="xs">
              {/* sm+: direct header controls (color scheme + sign out). */}
              <Tooltip label={computed === 'dark' ? 'Light' : 'Dark'}>
                <ActionIcon
                  variant="subtle"
                  visibleFrom="sm"
                  onClick={() =>
                    setColorScheme(computed === 'dark' ? 'light' : 'dark')
                  }
                  aria-label="Toggle color scheme"
                >
                  {computed === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </ActionIcon>
              </Tooltip>
              <Tooltip label={tCommon('signOut')}>
                <ActionIcon
                  variant="subtle"
                  visibleFrom="sm"
                  onClick={handleSignOut}
                  aria-label={tCommon('signOut')}
                >
                  <LogOut size={18} />
                </ActionIcon>
              </Tooltip>

              {/* Phone (< sm): collapse the above into a single user menu so
                  the header stays uncluttered; the bottom bar has nav. */}
              <Box hiddenFrom="sm">
                <Menu shadow="md" width={220} position="bottom-end">
                  <Menu.Target>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="account menu"
                    >
                      <UserIcon size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {userEmail ? <Menu.Label>{userEmail}</Menu.Label> : null}
                    <Menu.Item
                      leftSection={
                        computed === 'dark' ? <Sun size={14} /> : <Moon size={14} />
                      }
                      onClick={() =>
                        setColorScheme(computed === 'dark' ? 'light' : 'dark')
                      }
                    >
                      {computed === 'dark' ? 'Light mode' : 'Dark mode'}
                    </Menu.Item>
                    <Menu.Item
                      component={Link}
                      href="/settings"
                      leftSection={<Settings size={14} />}
                    >
                      {t('settings')}
                    </Menu.Item>
                    {isAdmin ? (
                      <Menu.Item
                        component={Link}
                        href="/admin"
                        leftSection={<Shield size={14} />}
                      >
                        {t('admin')}
                      </Menu.Item>
                    ) : null}
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      leftSection={<LogOut size={14} />}
                      onClick={handleSignOut}
                    >
                      {tCommon('signOut')}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Box>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm">
          <AppShell.Section grow component={ScrollArea}>
            {allItems.map(({ href, labelKey, icon: Icon }) => (
              <NavLink
                key={href}
                component={Link}
                href={href}
                label={t(labelKey)}
                leftSection={<Icon size={18} />}
                active={isActive(href)}
                onClick={close}
                mb={2}
              />
            ))}
          </AppShell.Section>
          {userEmail ? (
            <AppShell.Section>
              <Text size="xs" c="dimmed" truncate>
                {userEmail}
              </Text>
            </AppShell.Section>
          ) : null}
        </AppShell.Navbar>

        <AppShell.Main
          style={{
            paddingBottom:
              'calc(env(safe-area-inset-bottom, 0px) + var(--bottom-bar-h, 0px))',
          }}
        >
          {children}
        </AppShell.Main>
      </AppShell>

      {/* Phone-only bottom nav. */}
      <Box hiddenFrom="sm" className={styles.bottomBarWrap}>
        <Paper
          className={styles.bottomBar}
          withBorder
          style={{
            borderBottom: 'none',
            borderLeft: 'none',
            borderRight: 'none',
          }}
        >
          <Group gap={0} wrap="nowrap" style={{ width: '100%' }}>
            {primaryItems.map((item) => (
              <BottomNavItem
                key={item.href}
                href={item.href}
                label={t(item.labelKey)}
                icon={<item.icon size={20} />}
                active={isActive(item.href)}
              />
            ))}
            <Menu
              shadow="md"
              width={220}
              position="top-end"
              withinPortal
              offset={8}
            >
              <Menu.Target>
                <UnstyledButton
                  className={styles.bottomItem}
                  aria-label={moreLabel}
                >
                  <Stack gap={2} align="center">
                    <MoreHorizontal size={20} />
                    <Text size="10px" fw={500}>
                      {moreLabel}
                    </Text>
                  </Stack>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                {overflowItems.map((item) => (
                  <Menu.Item
                    key={item.href}
                    component={Link}
                    href={item.href}
                    leftSection={<item.icon size={14} />}
                  >
                    {t(item.labelKey)}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Paper>
      </Box>
    </>
  );
}

function BottomNavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <UnstyledButton
      component={Link}
      href={href}
      className={`${styles.bottomItem} ${active ? styles.bottomItemActive : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Stack gap={2} align="center">
        {icon}
        <Text size="10px" fw={active ? 700 : 500}>
          {label}
        </Text>
      </Stack>
    </UnstyledButton>
  );
}
