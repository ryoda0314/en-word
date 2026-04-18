import { Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SettingsForm } from '@/components/settings/SettingsForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Locale = 'ja' | 'en';
type MeaningLocale = 'ja' | 'en' | 'both';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, ui_locale, meaning_locale, daily_goal, timezone')
    .eq('user_id', user.id)
    .maybeSingle();

  const initialUiLocale = (
    profile?.ui_locale === 'ja' || profile?.ui_locale === 'en'
      ? profile.ui_locale
      : locale === 'en'
        ? 'en'
        : 'ja'
  ) as Locale;

  const initialMeaningLocale = (
    profile?.meaning_locale === 'ja' ||
    profile?.meaning_locale === 'en' ||
    profile?.meaning_locale === 'both'
      ? profile.meaning_locale
      : 'ja'
  ) as MeaningLocale;

  return (
    <Stack gap="lg" maw={640}>
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>
      <SettingsForm
        userEmail={user.email ?? null}
        displayName={profile?.display_name ?? null}
        currentLocale={locale as Locale}
        initialUiLocale={initialUiLocale}
        initialMeaningLocale={initialMeaningLocale}
        initialDailyGoal={profile?.daily_goal ?? 10}
        initialTimezone={profile?.timezone ?? 'Asia/Tokyo'}
      />
    </Stack>
  );
}
