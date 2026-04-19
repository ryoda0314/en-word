import {
  Badge,
  Box,
  Card,
  Container,
  Divider,
  Flex,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  BookOpen,
  Brain,
  Layers,
  PenLine,
  Quote,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LinkButton } from '@/components/common/LinkButton';
import { Link } from '@/i18n/navigation';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tApp = await getTranslations('app');

  return (
    <Box>
      {/* ────────────── Hero ────────────── */}
      <Box
        style={{
          borderBottom:
            '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
        }}
      >
        <Container size="lg" py={{ base: 56, md: 112 }}>
          <Flex gap={48} wrap="wrap" align="center">
            <Box style={{ flex: '1 1 420px', minWidth: 0 }}>
              <Stack gap="lg" align="flex-start">
                <Text c="dimmed" size="sm" tt="uppercase" fw={600} lts={1.5}>
                  {tApp('name')} — {tApp('tagline')}
                </Text>
                <Title order={1} fz={{ base: 36, md: 56 }} lh={1.15}>
                  {t('heroTitle')}
                </Title>
                <Text size="lg" c="dimmed" maw={560} lh={1.75}>
                  {t('heroBody')}
                </Text>
                <Group gap="sm" mt="md">
                  <LinkButton href="/dashboard" size="md">
                    {t('ctaStart')}
                  </LinkButton>
                  <LinkButton href="/auth/login" size="md" variant="subtle">
                    {t('ctaLogin')}
                  </LinkButton>
                </Group>
              </Stack>
            </Box>
            <Box style={{ flex: '1 1 360px', minWidth: 0 }}>
              <ReaderPreview />
            </Box>
          </Flex>
        </Container>
      </Box>

      {/* ────────────── Features ────────────── */}
      <Container size="lg" py={{ base: 56, md: 96 }}>
        <Stack gap="xl">
          <Stack gap="xs" align="flex-start">
            <Text c="dimmed" size="sm" tt="uppercase" fw={600} lts={1.5}>
              {t('featuresLabel')}
            </Text>
            <Title order={2} fz={{ base: 28, md: 40 }} lh={1.2}>
              {t('featuresTitle')}
            </Title>
          </Stack>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <FeatureCard
              icon={<BookOpen size={22} />}
              title={t('feat1Title')}
              body={t('feat1Body')}
            />
            <FeatureCard
              icon={<Sparkles size={22} />}
              title={t('feat2Title')}
              body={t('feat2Body')}
            />
            <FeatureCard
              icon={<PenLine size={22} />}
              title={t('feat3Title')}
              body={t('feat3Body')}
            />
          </SimpleGrid>
        </Stack>
      </Container>

      {/* ────────────── Flow (3 stages) ────────────── */}
      <Box
        style={{
          background: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
          borderTop:
            '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
          borderBottom:
            '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
        }}
      >
        <Container size="lg" py={{ base: 56, md: 96 }}>
          <Stack gap="xl">
            <Stack gap="xs" align="flex-start">
              <Text c="dimmed" size="sm" tt="uppercase" fw={600} lts={1.5}>
                {t('flowLabel')}
              </Text>
              <Title order={2} fz={{ base: 28, md: 40 }} lh={1.2}>
                {t('flowTitle')}
              </Title>
              <Text c="dimmed" size="lg" maw={680} lh={1.7}>
                {t('flowBody')}
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
              <StageCard
                step="01"
                icon={<Brain size={18} />}
                color="gray"
                label={t('stage1Label')}
                title={t('stage1Title')}
                body={t('stage1Body')}
              />
              <StageCard
                step="02"
                icon={<Target size={18} />}
                color="indigo"
                label={t('stage2Label')}
                title={t('stage2Title')}
                body={t('stage2Body')}
              />
              <StageCard
                step="03"
                icon={<TrendingUp size={18} />}
                color="teal"
                label={t('stage3Label')}
                title={t('stage3Title')}
                body={t('stage3Body')}
              />
            </SimpleGrid>
          </Stack>
        </Container>
      </Box>

      {/* ────────────── CTA strip ────────────── */}
      <Container size="lg" py={{ base: 56, md: 96 }}>
        <Paper
          withBorder
          radius="lg"
          p={{ base: 'lg', md: 40 }}
          style={{ textAlign: 'center' }}
        >
          <Stack gap="md" align="center">
            <ThemeIcon size={48} radius="xl" variant="light" color="indigo">
              <Layers size={22} />
            </ThemeIcon>
            <Title order={2} fz={{ base: 24, md: 32 }} lh={1.3}>
              {t('ctaTitle')}
            </Title>
            <Text c="dimmed" maw={520} lh={1.7}>
              {t('ctaBody')}
            </Text>
            <Group gap="sm" mt="xs">
              <LinkButton href="/dashboard" size="md">
                {t('ctaStart')}
              </LinkButton>
              <LinkButton href="/auth/login" size="md" variant="subtle">
                {t('ctaLogin')}
              </LinkButton>
            </Group>
          </Stack>
        </Paper>
      </Container>

      {/* ────────────── Footer ────────────── */}
      <Box
        style={{
          borderTop:
            '1px solid light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))',
        }}
      >
        <Container size="lg" py="lg">
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text c="dimmed" size="xs">
              © 2026 en-word-book
            </Text>
            <Group gap="xs">
              <Link
                href="/"
                locale="ja"
                style={{
                  fontSize: 12,
                  color: locale === 'ja' ? 'inherit' : 'var(--mantine-color-dimmed)',
                  fontWeight: locale === 'ja' ? 600 : 400,
                  textDecoration: 'none',
                }}
              >
                日本語
              </Link>
              <Text size="xs" c="dimmed">
                ·
              </Text>
              <Link
                href="/"
                locale="en"
                style={{
                  fontSize: 12,
                  color: locale === 'en' ? 'inherit' : 'var(--mantine-color-dimmed)',
                  fontWeight: locale === 'en' ? 600 : 400,
                  textDecoration: 'none',
                }}
              >
                English
              </Link>
            </Group>
          </Group>
        </Container>
      </Box>
    </Box>
  );
}

/* ──────────────────────────────── */

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <ThemeIcon variant="light" color="indigo" size={40} radius="md">
          {icon}
        </ThemeIcon>
        <Title order={3} size="h5" lh={1.3}>
          {title}
        </Title>
        <Text c="dimmed" size="sm" lh={1.7}>
          {body}
        </Text>
      </Stack>
    </Card>
  );
}

function StageCard({
  step,
  icon,
  color,
  label,
  title,
  body,
}: {
  step: string;
  icon: React.ReactNode;
  color: 'gray' | 'indigo' | 'teal';
  label: string;
  title: string;
  body: string;
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group gap="xs" align="center">
          <Text c="dimmed" fw={700} size="xs" ff="monospace">
            {step}
          </Text>
          <ThemeIcon size={28} radius="sm" variant="light" color={color}>
            {icon}
          </ThemeIcon>
          <Badge variant="light" color={color} size="xs">
            {label}
          </Badge>
        </Group>
        <Title order={3} size="h5" lh={1.3}>
          {title}
        </Title>
        <Text c="dimmed" size="sm" lh={1.7}>
          {body}
        </Text>
      </Stack>
    </Card>
  );
}

/** Static mock of the reader UI — a passage with highlighted tokens + a gloss card. */
function ReaderPreview() {
  const hlStyle: React.CSSProperties = {
    backgroundColor:
      'light-dark(color-mix(in srgb, var(--mantine-color-indigo-1) 65%, transparent), color-mix(in srgb, var(--mantine-color-indigo-9) 45%, transparent))',
    borderRadius: 3,
    padding: '0 2px',
  };
  const idiomStyle: React.CSSProperties = {
    borderBottom:
      '2px dotted light-dark(var(--mantine-color-indigo-6), var(--mantine-color-indigo-4))',
    padding: 0,
  };

  return (
    <Paper
      withBorder
      radius="lg"
      p={{ base: 'md', md: 'xl' }}
      shadow="sm"
      style={{ overflow: 'hidden' }}
    >
      <Stack gap="md">
        <Group gap={6} wrap="wrap">
          <Badge size="xs" color="indigo" variant="light">
            TOEIC Part 6
          </Badge>
          <Badge size="xs" variant="default">
            B2
          </Badge>
        </Group>
        <Title order={4} size="h5" lh={1.3}>
          Updated Expense Policy
        </Title>
        <Text
          size="sm"
          lh={1.95}
          style={{
            fontFamily:
              'var(--font-source-serif, Georgia), var(--font-noto-serif-jp), serif',
          }}
        >
          Effective next Monday, we will <span style={hlStyle}>implement</span>{' '}
          a revised expense <span style={hlStyle}>reimbursement</span> policy.
          The objective is to <span style={hlStyle}>streamline</span> approval
          procedures. Please{' '}
          <span style={idiomStyle}>keep track of</span> every receipt and submit
          claims through the portal.
        </Text>

        <Divider />

        <Card withBorder radius="sm" p="sm">
          <Stack gap={4}>
            <Group gap={6} wrap="wrap">
              <Quote size={12} />
              <Text fw={700} size="sm">
                streamline
              </Text>
              <Badge size="xs" variant="default">
                verb
              </Badge>
              <Text c="dimmed" size="xs" ff="monospace">
                /ˈstriːmlaɪn/
              </Text>
            </Group>
            <Text size="xs">合理化する、効率化する</Text>
            <Text size="xs" c="dimmed" fs="italic">
              We streamlined our approval process.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Paper>
  );
}
