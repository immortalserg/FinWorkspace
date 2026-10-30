import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, CheckmarkCircle02Icon, Copy01Icon, Key01Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '../lib/format'
import { PageContainer } from '../ui/PageContainer'
import { PageHeader } from '../ui/PageHeader'
import { useConfirm } from '../ui/useConfirm'
import { ApiKeyGuide } from './ApiKeyGuide'
import * as apiKeysApi from './apiKeysApi'
import type { ApiKey, ApiKeyScope } from './apiKeysApi'

const SCOPE_OPTIONS = [
  { value: 'read' as const, labelKey: 'apiKeys.readOnly', helpKey: 'apiKeys.readOnlyHelp' },
  { value: 'full' as const, labelKey: 'apiKeys.fullAccess', helpKey: 'apiKeys.fullAccessHelp' },
]

function formatDateTime(value: string) {
  return formatDate(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ApiKeysPage() {
  const { t } = useTranslation('accounts')
  const queryClient = useQueryClient()
  const { confirm, confirmDialog } = useConfirm()

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [scope, setScope] = useState<ApiKeyScope>('read')
  const [newKey, setNewKey] = useState<string | null>(null)

  const { data: keys, isLoading, isError } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeysApi.listApiKeys,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['api-keys'] })

  const createMutation = useMutation({
    mutationFn: apiKeysApi.createApiKey,
    onSuccess: (result) => {
      setCreateOpen(false)
      setName('')
      setScope('read')
      setNewKey(result.key)
      void invalidate()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t('apiKeys.createFailed')),
  })

  const revokeMutation = useMutation({
    mutationFn: apiKeysApi.revokeApiKey,
    onSuccess: () => {
      toast.success(t('apiKeys.revoked'))
      void invalidate()
    },
    onError: () => toast.error(t('apiKeys.revokeFailed')),
  })

  const atLimit = (keys?.length ?? 0) >= apiKeysApi.MAX_API_KEYS

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createMutation.mutate({ name: trimmed, scope })
  }

  const handleCopy = async () => {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      toast.success(t('apiKeys.copied'))
    } catch {
      toast.error(t('apiKeys.copyFailed'))
    }
  }

  const handleRevoke = async (key: ApiKey) => {
    const ok = await confirm({
      title: t('apiKeys.revokeTitle', { name: key.name }),
      description: t('apiKeys.revokeDescription'),
      confirmLabel: t('apiKeys.revokeConfirm'),
      cancelLabel: t('apiKeys.keepKey'),
      tone: 'destructive',
    })
    if (!ok) return
    revokeMutation.mutate(key.id)
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title={t('apiKeys.title')}
        description={t('apiKeys.description')}
      />
      {confirmDialog}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Key01Icon} strokeWidth={2} className="size-5 text-primary" />
            {t('apiKeys.yourKeys')}
          </CardTitle>
          <CardDescription>
            {keys ? t('apiKeys.keysInUse', { count: keys.length, max: apiKeysApi.MAX_API_KEYS }) : t('apiKeys.nameEachKey')}
          </CardDescription>
          <CardAction>
            <Button size="sm" disabled={atLimit} onClick={() => setCreateOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              {t('apiKeys.newKey')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Spinner />
              {t('apiKeys.loading')}
            </div>
          )}
          {isError && <p className="text-sm text-destructive text-center py-6">{t('apiKeys.loadFailed')}</p>}
          {!isLoading && !isError && keys?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">{t('apiKeys.empty')}</p>
          )}
          {!isLoading && !isError && keys && keys.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('apiKeys.columnName')}</TableHead>
                  <TableHead>{t('apiKeys.columnAccess')}</TableHead>
                  <TableHead>{t('apiKeys.columnKey')}</TableHead>
                  <TableHead>{t('apiKeys.columnCreated')}</TableHead>
                  <TableHead>{t('apiKeys.columnLastUsed')}</TableHead>
                  <TableHead className="text-right">{t('apiKeys.columnActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      {key.scope === 'full' ? (
                        <Badge variant="destructive">{t('apiKeys.fullAccess')}</Badge>
                      ) : (
                        <Badge variant="secondary">{t('apiKeys.readOnly')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {key.key_prefix}…{key.last_four}
                    </TableCell>
                    <TableCell>{formatDate(key.created_at)}</TableCell>
                    <TableCell>{key.last_used_at ? formatDateTime(key.last_used_at) : t('apiKeys.never')}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={revokeMutation.isPending}
                        onClick={() => void handleRevoke(key)}
                      >
                        {t('apiKeys.revoke')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ApiKeyGuide />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('apiKeys.createTitle')}</DialogTitle>
            <DialogDescription>{t('apiKeys.createDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="api-key-name">{t('apiKeys.name')}</FieldLabel>
              <Input
                id="api-key-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('apiKeys.namePlaceholder')}
                autoFocus
              />
              <FieldDescription>{t('apiKeys.nameHelp')}</FieldDescription>
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium mb-1">{t('apiKeys.access')}</legend>
              {SCOPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="api-key-scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium">{t(option.labelKey)}</span>
                    <span className="block text-xs text-muted-foreground">{t(option.helpKey)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t('apiKeys.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
                {createMutation.isPending ? <Spinner /> : t('apiKeys.createKey')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newKey !== null}
        onOpenChange={(open) => {
          if (!open) setNewKey(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-5 text-primary" />
              {t('apiKeys.createdTitle')}
            </DialogTitle>
            <DialogDescription>
              <strong className="text-destructive font-medium">{t('apiKeys.copyNow')}</strong>{' '}
              {t('apiKeys.createdWarning')}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 p-4">
            <Field>
              <FieldLabel htmlFor="new-api-key">{t('apiKeys.apiKey')}</FieldLabel>
              <div className="flex gap-2">
                <Input id="new-api-key" readOnly value={newKey ?? ''} className="font-mono text-sm" />
                <Button type="button" size="icon" title={t('apiKeys.copy')} onClick={() => void handleCopy()}>
                  <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                  <span className="sr-only">{t('apiKeys.copy')}</span>
                </Button>
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setNewKey(null)}>
              {t('apiKeys.copiedConfirmation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
