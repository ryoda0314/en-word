'use client';

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { CheckCircle2, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { updateProfile } from '@/lib/actions/profile';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Locale = 'ja' | 'en';
type MeaningLocale = 'ja' | 'en' | 'both';

export function SettingsForm({
  userEmail,
  currentLocale,
  initialUiLocale,
  initialMeaningLocale,
  initialDailyGoal,
  initialTimezone,
  displayName,
}: {
  userEmail: string | null;
  currentLocale: Locale;
  initialUiLocale: Locale;
  initialMeaningLocale: MeaningLocale;
  initialDailyGoal: number;
  initialTimezone: string;
  displayName: string | null;
}) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [nameValue, setNameValue] = useState<string>(displayName ?? '');
  const [uiLocale, setUiLocale] = useState<Locale>(initialUiLocale);
  const [meaningLocale, setMeaningLocale] = useState<MeaningLocale>(initialMeaningLocale);
  const [dailyGoal, setDailyGoal] = useState<number>(initialDailyGoal);
  const [timezone, setTimezone] = useState<string>(initialTimezone);

  function handleSave() {
    startTransition(async () => {
      const result = await updateProfile({
        display_name: nameValue.trim(),
        ui_locale: uiLocale,
        meaning_locale: meaningLocale,
        daily_goal: dailyGoal,
        timezone,
      });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2400);
        if (uiLocale !== currentLocale) {
          const pathname = window.location.pathname;
          const newPath = pathname.replace(
            new RegExp(`^/${currentLocale}(?=/|$)`),
            `/${uiLocale}`,
          );
          window.location.assign(newPath);
        }
      }
    });
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign(`/${currentLocale}`);
  }

  return (
    <Stack gap="xl">
      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Text fw={600}>{t('preferences')}</Text>

          <Select
            label={t('uiLocale')}
            description={t('uiLocaleDesc')}
            value={uiLocale}
            onChange={(v) => v && setUiLocale(v as Locale)}
            data={[
              { value: 'ja', label: '日本語' },
              { value: 'en', label: 'English' },
            ]}
            allowDeselect={false}
          />

          <Select
            label={t('meaningLocale')}
            description={t('meaningLocaleDesc')}
            value={meaningLocale}
            onChange={(v) => v && setMeaningLocale(v as MeaningLocale)}
            data={[
              { value: 'ja', label: t('meaningOptions.ja') },
              { value: 'en', label: t('meaningOptions.en') },
              { value: 'both', label: t('meaningOptions.both') },
            ]}
            allowDeselect={false}
          />

          <NumberInput
            label={t('dailyGoal')}
            description={t('dailyGoalDesc')}
            value={dailyGoal}
            onChange={(v) => setDailyGoal(Number(v) || 1)}
            min={1}
            max={200}
            step={5}
          />

          <Select
            label={t('timezone')}
            value={timezone}
            onChange={(v) => v && setTimezone(v)}
            searchable
            data={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
            allowDeselect={false}
          />

          <Group mt="sm" gap="xs" align="center">
            <Button onClick={handleSave} loading={pending}>
              {t('save')}
            </Button>
            {saved ? (
              <Badge
                color="teal"
                variant="light"
                leftSection={<CheckCircle2 size={12} />}
              >
                {t('saved')}
              </Badge>
            ) : null}
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Text fw={600}>{t('account')}</Text>
          <TextInput
            label={t('displayName')}
            description={t('displayNameDesc')}
            placeholder={t('displayNamePlaceholder')}
            value={nameValue}
            onChange={(e) => setNameValue(e.currentTarget.value)}
            maxLength={60}
          />
          {userEmail ? (
            <TextInput label={t('email')} value={userEmail} readOnly />
          ) : null}
          <Divider />
          <Group>
            <Button
              color="red"
              variant="light"
              leftSection={<LogOut size={16} />}
              onClick={handleSignOut}
            >
              {tCommon('signOut')}
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

const COMMON_TIMEZONES = [
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];
