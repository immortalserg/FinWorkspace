import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import * as adminApi from './adminApi'

type Values = Record<string, unknown>
type SecretInputs = Record<string, string>

type SecretField =
  | 'OPENROUTER_API_KEY'
  | 'SMTP_PASSWORD'
  | 'VAPID_PRIVATE_KEY'

export function ApplicationSettings() {
  const { t } = useTranslation('admin')
  const queryClient = useQueryClient()
  const pemInput = useRef<HTMLInputElement>(null)

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: adminApi.getAdminSettings,
  })

  const [values, setValues] = useState<Values>({})
  const [secretInputs, setSecretInputs] = useState<SecretInputs>({})
  const [clearedSecrets, setClearedSecrets] = useState<string[]>([])

  useEffect(() => {
    if (settingsQuery.data) {
      setValues(settingsQuery.data.values)
    }
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => {
      const secrets = Object.fromEntries(
        Object.entries(secretInputs).filter(([, value]) => value !== ''),
      )

      return adminApi.updateAdminSettings({
        values,
        secrets,
        clear_secrets: clearedSecrets,
      })
    },
    onSuccess: (result) => {
      queryClient.setQueryData(['admin', 'settings'], result)
      setSecretInputs({})
      setClearedSecrets([])
      toast.success(t('settings.saved'))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('settings.saveFailed'),
      )
    },
  })

  const uploadMutation = useMutation({
    mutationFn: adminApi.uploadEnableBankingPrivateKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast.success(t('settings.pemUploaded'))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('settings.pemUploadFailed'),
      )
    },
  })

  const deletePemMutation = useMutation({
    mutationFn: adminApi.deleteEnableBankingPrivateKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast.success(t('settings.pemDeleted'))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('settings.pemDeleteFailed'),
      )
    },
  })

  const value = (key: string): unknown => values[key]

  const textValue = (key: string): string => {
    const current = value(key)
    if (current == null) return ''
    return String(current)
  }

  const booleanValue = (key: string): boolean => value(key) === true

  const listValue = (key: string): string => {
    const current = value(key)
    return Array.isArray(current) ? current.map(String).join('\n') : ''
  }

  const setValue = (key: string, next: unknown) => {
    setValues((current) => ({ ...current, [key]: next }))
  }

  const setSecret = (key: string, next: string) => {
    setSecretInputs((current) => ({ ...current, [key]: next }))
    setClearedSecrets((current) => current.filter((item) => item !== key))
  }

  const renderText = (
    key: string,
    type: 'text' | 'number' | 'email' | 'url' = 'text',
  ) => (
    <Field key={key}>
      <FieldLabel htmlFor={`setting-${key}`}>
        {t(`settings.fields.${key}`)}
      </FieldLabel>
      <Input
        id={`setting-${key}`}
        type={type}
        value={textValue(key)}
        onChange={(event) => {
          const next = event.target.value
          setValue(
            key,
            type === 'number' ? (next === '' ? null : Number(next)) : next,
          )
        }}
      />
    </Field>
  )

  const renderList = (key: string) => (
    <Field key={key}>
      <FieldLabel htmlFor={`setting-${key}`}>
        {t(`settings.fields.${key}`)}
      </FieldLabel>
      <Textarea
        id={`setting-${key}`}
        rows={3}
        value={listValue(key)}
        onChange={(event) => {
          const next = event.target.value
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean)
          setValue(key, next)
        }}
      />
      <FieldDescription>{t('settings.listHint')}</FieldDescription>
    </Field>
  )

  const renderSwitch = (key: string) => (
    <div key={key} className="flex min-h-10 items-center justify-between gap-4">
      <span className="text-sm font-medium">{t(`settings.fields.${key}`)}</span>
      <Switch
        checked={booleanValue(key)}
        onCheckedChange={(checked) => setValue(key, checked)}
        aria-label={t(`settings.fields.${key}`)}
      />
    </div>
  )

  const renderSecret = (key: SecretField) => {
    const configured = settingsQuery.data?.secret_configured[key] ?? false
    const cleared = clearedSecrets.includes(key)

    return (
      <Field key={key}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel htmlFor={`secret-${key}`}>
            {t(`settings.fields.${key}`)}
          </FieldLabel>
          <Badge variant={cleared ? 'destructive' : configured ? 'default' : 'outline'}>
            {cleared
              ? t('settings.willBeCleared')
              : configured
                ? t('settings.configured')
                : t('settings.notConfigured')}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            id={`secret-${key}`}
            type="password"
            autoComplete="new-password"
            placeholder={configured ? t('settings.secretPlaceholder') : ''}
            value={secretInputs[key] ?? ''}
            onChange={(event) => setSecret(key, event.target.value)}
          />
          {configured && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setClearedSecrets((current) =>
                  cleared
                    ? current.filter((item) => item !== key)
                    : [...current, key],
                )
              }
            >
              {cleared ? t('settings.keepSecret') : t('settings.clearSecret')}
            </Button>
          )}
        </div>
      </Field>
    )
  }

  if (settingsQuery.isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('settings.loading')}</p>
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return <p className="py-8 text-center text-sm text-destructive">{t('settings.loadError')}</p>
  }

  const restartFields = settingsQuery.data.restart_required_fields

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.description')}</p>
      </div>

      {restartFields.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium">{t('settings.restartRequired')}</p>
          <p className="mt-1 text-muted-foreground">
            {restartFields.map((field) => t(`settings.fields.${field}`, { defaultValue: field })).join(', ')}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.sections.general')}</CardTitle>
          <CardDescription>{t('settings.generalDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {renderText('APP_NAME')}
          {renderText('ACCESS_TOKEN_EXPIRE_MINUTES', 'number')}
          {renderText('PUBLIC_BASE_URL', 'url')}
          {renderList('ADMIN_EMAILS')}
          {renderList('CORS_ORIGINS')}
          <div className="md:col-span-2">{renderSwitch('TRUST_PROXY_HEADERS')}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.sections.notifications')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {renderSwitch('NOTIFICATIONS_ENABLED')}
          <div className="grid gap-4 md:grid-cols-2">
            {renderText('SMTP_HOST')}
            {renderText('SMTP_PORT', 'number')}
            {renderText('SMTP_USER')}
            {renderText('SMTP_FROM', 'email')}
            {renderText('VAPID_PUBLIC_KEY')}
            {renderText('VAPID_SUBJECT')}
          </div>
          {renderSwitch('SMTP_USE_TLS')}
          {renderSecret('SMTP_PASSWORD')}
          {renderSecret('VAPID_PRIVATE_KEY')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.sections.ai')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {renderSecret('OPENROUTER_API_KEY')}
          {renderText('OPENROUTER_BASE_URL', 'url')}
          {renderText('AI_DEFAULT_MODEL')}
          {renderText('AI_MAX_OUTPUT_TOKENS', 'number')}
          {renderText('AI_TURN_COST_CAP_USD', 'number')}
          {renderText('AI_MONTHLY_CAP_USD', 'number')}
          {renderText('AI_CHAT_MAX_TOOL_ROUNDS', 'number')}
          {renderText('AI_FALLBACK_PRICE_IN_PER_M', 'number')}
          {renderText('AI_FALLBACK_PRICE_OUT_PER_M', 'number')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.sections.bank')}</CardTitle>
          <CardDescription>{t('settings.bankDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {renderSwitch('BANK_SYNC_ENABLED')}
          <div className="grid gap-4 md:grid-cols-2">
            {renderText('EB_API_BASE', 'url')}
            {renderText('EB_APPLICATION_ID')}
            {renderText('EB_REDIRECT_URL', 'url')}
            {renderText('FRONTEND_BASE_URL', 'url')}
            {renderText('EB_CONSENT_DAYS', 'number')}
            {renderText('EB_INITIAL_HISTORY_DAYS', 'number')}
            {renderText('EB_SYNC_OVERLAP_DAYS', 'number')}
            {renderText('EB_MANUAL_SYNC_COOLDOWN_MINUTES', 'number')}
            {renderText('EB_CONSENT_WARN_DAYS', 'number')}
          </div>
          {renderSwitch('EB_INCLUDE_PENDING')}

          <div className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t('settings.fields.pemFile')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.pemUploadHint')}
                </p>
                <Badge className="mt-2" variant={settingsQuery.data.private_key_configured ? 'default' : 'outline'}>
                  {settingsQuery.data.private_key_configured
                    ? t('settings.configured')
                    : t('settings.notConfigured')}
                </Badge>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={uploadMutation.isPending || deletePemMutation.isPending}
                onClick={() => pemInput.current?.click()}
              >
                {uploadMutation.isPending ? t('settings.uploading') : t('settings.uploadPem')}
              </Button>
              {settingsQuery.data.private_key_configured && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deletePemMutation.isPending || uploadMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t('settings.confirmPemDelete'))) {
                      deletePemMutation.mutate()
                    }
                  }}
                >
                  {deletePemMutation.isPending
                    ? t('settings.pemDeleting')
                    : t('settings.pemDelete')}
                </Button>
              )}
              <input
                ref={pemInput}
                type="file"
                accept=".pem"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) uploadMutation.mutate(file)
                  event.target.value = ''
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.sections.legal')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {renderText('LEGAL_OPERATOR_NAME')}
          {renderText('LEGAL_CONTACT_EMAIL', 'email')}
          {renderText('LEGAL_JURISDICTION')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.sections.limits')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {renderText('RATE_LIMIT_PER_IP_MAX', 'number')}
          {renderText('RATE_LIMIT_PER_IP_WINDOW_SECONDS', 'number')}
          {renderText('RATE_LIMIT_PER_EMAIL_MAX', 'number')}
          {renderText('RATE_LIMIT_PER_EMAIL_WINDOW_SECONDS', 'number')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.protectedTitle')}</CardTitle>
          <CardDescription>{t('settings.protectedDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {Object.entries(settingsQuery.data.protected_configured).map(([key, configured]) => (
            <Badge key={key} variant={configured ? 'default' : 'outline'}>
              {key}: {configured ? t('settings.configured') : t('settings.notConfigured')}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? t('settings.saving') : t('settings.save')}
        </Button>
      </div>
    </div>
  )
}
