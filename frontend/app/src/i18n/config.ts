import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'


import commonEn from '../locales/en/common.json'
import navEn from '../locales/en/nav.json'
import authEn from '../locales/en/auth.json'
import dashboardEn from '../locales/en/dashboard.json'
import transactionsEn from '../locales/en/transactions.json'
import accountsEn from '../locales/en/accounts.json'
import budgetsEn from '../locales/en/budgets.json'
import categoriesEn from '../locales/en/categories.json'
import debtsEn from '../locales/en/debts.json'
import goalsEn from '../locales/en/goals.json'
import recurringEn from '../locales/en/recurring.json'
import reportsEn from '../locales/en/reports.json'
import documentsEn from '../locales/en/documents.json'
import investmentsEn from '../locales/en/investments.json'
import importEn from '../locales/en/import.json'
import notificationsEn from '../locales/en/notifications.json'
import advisorEn from '../locales/en/advisor.json'
import adminEn from '../locales/en/admin.json'
import bankSyncEn from '../locales/en/bankSync.json'
import rulesEn from '../locales/en/rules.json'
import trackersEn from '../locales/en/trackers.json'
import validationEn from '../locales/en/validation.json'



export const defaultNS = 'common'

export const resources = {
  en: {
    common: commonEn,
    nav: navEn,
    auth: authEn,
    dashboard: dashboardEn,
    transactions: transactionsEn,
    accounts: accountsEn,
    budgets: budgetsEn,
    categories: categoriesEn,
    debts: debtsEn,
    goals: goalsEn,
    recurring: recurringEn,
    reports: reportsEn,
    documents: documentsEn,
    investments: investmentsEn,
    import: importEn,
    notifications: notificationsEn,
    advisor: advisorEn,
    admin: adminEn,
    bankSync: bankSyncEn,
    rules: rulesEn,
    trackers: trackersEn,
    validation: validationEn,
  },
} as const

// Vite creates separate translation chunks. Only the selected language and
// namespace are downloaded; English remains available synchronously as fallback.
const translationModules = import.meta.glob<{ default: Record<string, unknown> }>(
  '../locales/{ru,fr,de,it,el,lu}/*.json',
)

const lazyTranslations = {
  type: 'backend' as const,
  init: () => {},
  read(language: string, namespace: string, callback: (error: Error | null, data: Record<string, unknown> | null) => void) {
    const load = translationModules[`../locales/${language}/${namespace}.json`]
    if (!load) {
      callback(new Error(`Unknown translation: ${language}/${namespace}`), null)
      return
    }
    void load().then((module) => callback(null, module.default)).catch((error: unknown) => {
      callback(error instanceof Error ? error : new Error(String(error)), null)
    })
  },
}

void i18next
  .use(LanguageDetector)
  .use(lazyTranslations)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'el', 'ru', 'fr', 'de', 'it', 'lu'],
    defaultNS,
    ns: Object.keys(resources.en),
    partialBundledLanguages: true,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng) => lng.toLowerCase().startsWith('lb') ? 'lu' : lng,
      lookupLocalStorage: 'pf-language',
    },
    interpolation: {
      escapeValue: false,
    },
  })

/**
 * Keep `<html lang>` in step with the active language.
 *
 * `index.html` hardcodes `lang="en"`, which is wrong the moment someone
 * switches to Greek — and not only for screen readers. Case mapping in CSS is
 * language-sensitive: uppercasing Greek is supposed to drop the tonos
 * (Ημέρας → ΗΜΕΡΑΣ), and browsers only apply that rule when the content
 * language says Greek. With `lang="en"` every `text-transform: uppercase`
 * label — which is most of the app's micro-labels — kept its accents.
 *
 * Hyphenation, quote marks and font fallback all key off this too, so it is
 * worth setting once here rather than patching the strings that show it.
 */
function syncDocumentLanguage(language: string) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language === 'lu' ? 'lb-LU' : language.split('-')[0]
}

syncDocumentLanguage(i18next.resolvedLanguage ?? i18next.language ?? 'en')
i18next.on('languageChanged', syncDocumentLanguage)

export default i18next
