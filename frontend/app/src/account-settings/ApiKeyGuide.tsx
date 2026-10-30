import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon } from '@hugeicons/core-free-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { API_ENDPOINT_GROUPS, curlExample, type ApiEndpoint } from './apiKeyEndpoints'

async function copy(text: string, success: string, failure: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(success)
  } catch {
    toast.error(failure)
  }
}

function MethodBadge({ method }: { method: ApiEndpoint['method'] }) {
  return (
    <Badge variant={method === 'GET' ? 'secondary' : 'outline'} className="font-mono w-14 justify-center">
      {method}
    </Badge>
  )
}

export function ApiKeyGuide() {
  const { t } = useTranslation('accounts')
  const origin = window.location.origin

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('apiKeys.guideTitle')}</CardTitle>
        <CardDescription>{t('apiKeys.guideDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <section aria-labelledby="api-guide-auth" className="flex flex-col gap-2">
          <h3 id="api-guide-auth" className="text-sm font-semibold">
            1. {t('apiKeys.authenticate')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('apiKeys.authText')} <code className="font-mono">X-API-Key</code>{' '}
            {t('apiKeys.authTextSuffix')} <code className="font-mono">{origin}/api</code>.
          </p>
          <div className="relative">
            <pre className="rounded-lg border border-border bg-muted/60 p-3 pr-12 text-xs font-mono overflow-x-auto">
              {curlExample({ method: 'GET', path: '/accounts/', descriptionKey: 'accountsList' }, origin)}
            </pre>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute top-1.5 right-1.5"
              title={t('apiKeys.copy')}
              onClick={() =>
                void copy(
                  curlExample({ method: 'GET', path: '/accounts/', descriptionKey: 'accountsList' }, origin),
                  t('apiKeys.copied'),
                  t('apiKeys.copyFailed'),
                )
              }
            >
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
              <span className="sr-only">{t('apiKeys.copyExample')}</span>
            </Button>
          </div>
        </section>

        <section aria-labelledby="api-guide-scopes" className="flex flex-col gap-2">
          <h3 id="api-guide-scopes" className="text-sm font-semibold">
            2. {t('apiKeys.chooseAccess')}
          </h3>
          <ul className="text-sm text-muted-foreground list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong className="text-foreground">{t('apiKeys.readOnly')}</strong>{' '}
              {t('apiKeys.readOnlyDetails')} <code className="font-mono">GET</code>.{' '}
              {t('apiKeys.readOnlyForbidden')} <code className="font-mono">403</code>. {t('apiKeys.readOnlyUse')}
            </li>
            <li>
              <strong className="text-foreground">{t('apiKeys.fullAccess')}</strong>{' '}
              {t('apiKeys.fullAccessDetails')} (<code className="font-mono">POST</code>,{' '}
              <code className="font-mono">PUT</code>, <code className="font-mono">DELETE</code>) —{' '}
              {t('apiKeys.fullAccessAsYou')}
            </li>
            <li>{t('apiKeys.cannotManageKeys')}</li>
            <li>{t('apiKeys.revokeImmediate')}</li>
          </ul>
        </section>

        <section aria-labelledby="api-guide-endpoints" className="flex flex-col gap-3">
          <h3 id="api-guide-endpoints" className="text-sm font-semibold">
            3. {t('apiKeys.endpoints')}
          </h3>
          {API_ENDPOINT_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-1">
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`apiKeys.group.${group.key}`)}
              </h4>
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {group.endpoints.map((endpoint) => (
                  <li key={`${endpoint.method} ${endpoint.path}`} className="flex items-center gap-3 px-3 py-2">
                    <MethodBadge method={endpoint.method} />
                    <div className="min-w-0 flex-1">
                      <code className="font-mono text-sm break-all">{endpoint.path}</code>
                      <p className="text-xs text-muted-foreground">
                        {t(`apiKeys.endpoint.${endpoint.descriptionKey}`)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title={t('apiKeys.copy')}
                      onClick={() =>
                        void copy(curlExample(endpoint, origin), t('apiKeys.copied'), t('apiKeys.copyFailed'))
                      }
                    >
                      <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                      <span className="sr-only">
                        {t('apiKeys.copyCurl', { method: endpoint.method, path: endpoint.path })}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            {t('apiKeys.endpointsFooter')}{' '}
            <a className="text-primary underline" href="/docs" target="_blank" rel="noreferrer">/docs</a>.
          </p>
        </section>

        <section aria-labelledby="api-guide-safety" className="flex flex-col gap-2">
          <h3 id="api-guide-safety" className="text-sm font-semibold">
            {t('apiKeys.keepSafe')}
          </h3>
          <ul className="text-sm text-muted-foreground list-disc pl-5 flex flex-col gap-1">
            <li>{t('apiKeys.safetyPassword')}</li>
            <li>{t('apiKeys.safetyOneKey')}</li>
            <li>{t('apiKeys.safetyReadOnly')}</li>
          </ul>
        </section>
      </CardContent>
    </Card>
  )
}
