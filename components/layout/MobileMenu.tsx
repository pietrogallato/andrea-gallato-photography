'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { pathFor } from '@/lib/i18n/routes'
import { LocaleSwitcher } from '@/components/controls/LocaleSwitcher'
import { ThemeToggle } from '@/components/controls/ThemeToggle'
import styles from './MobileMenu.module.css'

export function MobileMenu({
  locale,
  dict,
  localePaths,
  localeNames,
}: {
  locale: Locale
  dict: Dictionary
  localePaths: Record<Locale, string>
  localeNames: Record<Locale, string>
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  // Il pannello copre lo schermo: senza questo blocco la pagina sotto
  // continuerebbe a scorrere sotto il menu aperto.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <div className={styles.menu} onKeyDown={(e) => e.key === 'Escape' && open && close()}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} label`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? dict.closeMenu : dict.openMenu}
      </button>

      <div id={panelId} className={styles.panel} hidden={!open}>
        <nav aria-label={dict.navGallery} className={styles.nav}>
          <Link
            href={pathFor(locale, { key: 'gallery' })}
            className={styles.navLink}
            onClick={close}
          >
            {dict.navGallery}
          </Link>
        </nav>

        <div className={styles.controls}>
          <LocaleSwitcher
            current={locale}
            paths={localePaths}
            groupLabel={dict.localeGroup}
            names={localeNames}
          />
          <ThemeToggle label={dict.themeToggle} />
        </div>
      </div>
    </div>
  )
}
