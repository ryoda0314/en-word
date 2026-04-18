'use client';

import {
  Alert,
  Button,
  Divider,
  PasswordInput,
  SegmentedControl,
  Stack,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('invalidEmail'),
  password: z.string().min(8, 'shortPassword'),
});

type Mode = 'signin' | 'signup';

export function LoginForm({
  locale,
  next,
  showError,
}: {
  locale: string;
  next?: string;
  showError?: boolean;
}) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(
    showError ? t('genericError') : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: zodResolver(schema),
  });

  const supabase = createSupabaseBrowserClient();

  async function handleGoogle() {
    setLoading(true);
    setFormError(null);
    const callback = `${window.location.origin}/auth/callback`;
    const params = new URLSearchParams({ locale });
    if (next) params.set('next', next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${callback}?${params.toString()}` },
    });
    if (error) {
      setFormError(error.message);
      setLoading(false);
    }
  }

  async function handleEmail(values: { email: string; password: string }) {
    setLoading(true);
    setFormError(null);
    setNotice(null);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        setFormError(error.message);
        setLoading(false);
        return;
      }
      window.location.assign(next ?? `/${locale}/dashboard`);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?locale=${locale}`,
        },
      });
      if (error) {
        setFormError(error.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        window.location.assign(next ?? `/${locale}/dashboard`);
      } else {
        setNotice(t('confirmEmail'));
        setLoading(false);
      }
    }
  }

  return (
    <Stack gap="md">
      <SegmentedControl
        fullWidth
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        data={[
          { label: t('signIn'), value: 'signin' },
          { label: t('signUp'), value: 'signup' },
        ]}
      />

      <Button
        variant="default"
        onClick={handleGoogle}
        loading={loading}
        fullWidth
      >
        {t('continueWithGoogle')}
      </Button>

      <Divider label={t('or')} labelPosition="center" />

      <form onSubmit={form.onSubmit(handleEmail)}>
        <Stack gap="sm">
          <TextInput
            label={t('email')}
            placeholder="you@example.com"
            autoComplete="email"
            key={form.key('email')}
            {...form.getInputProps('email')}
            error={form.errors.email ? t(String(form.errors.email)) : undefined}
          />
          <PasswordInput
            label={t('password')}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            key={form.key('password')}
            {...form.getInputProps('password')}
            error={
              form.errors.password ? t(String(form.errors.password)) : undefined
            }
          />
          <Button type="submit" loading={loading} fullWidth>
            {mode === 'signin' ? t('signIn') : t('signUp')}
          </Button>
        </Stack>
      </form>

      {formError ? (
        <Alert color="red" icon={<AlertCircle size={16} />} variant="light">
          {formError}
        </Alert>
      ) : null}
      {notice ? (
        <Alert color="indigo" variant="light">
          {notice}
        </Alert>
      ) : null}
    </Stack>
  );
}
