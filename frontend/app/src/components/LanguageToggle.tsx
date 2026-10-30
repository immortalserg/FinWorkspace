import { useTranslation } from 'react-i18next'
import { HugeiconsIcon } from '@hugeicons/react'
import { AlphabetGreekIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'ru', name: 'Русский' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'lu', name: 'Lëtzebuergesch' },
] as const

export function LanguageToggle() {
  const { t, i18n } = useTranslation('nav')
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('languageToggle.changeLanguage')}
          className="gap-1"
        >
          <HugeiconsIcon icon={AlphabetGreekIcon} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('languageToggle.changeLanguage')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={current}
            onValueChange={(lng) => void i18n.changeLanguage(lng)}
          >
            {LANGUAGES.map(({ code, name }) => (
              <DropdownMenuRadioItem key={code} value={code}>
                {name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
