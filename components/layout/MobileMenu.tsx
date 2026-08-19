'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { LocaleNav } from '@/components/controls/LocaleNav'
import { PrimaryNav } from './PrimaryNav'
import styles from './MobileMenu.module.css'

export function MobileMenu({
  locale,
  dict,
  localeNames,
}: {
  locale: Locale
  dict: Dictionary
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

      {/* L attributo, e non la classe: la regola che lo cerca vive in
          Header.module.css, dove il nome con l hash di questo modulo non arriva.
          Il perche di quella regola e scritto li. */}
      <div id={panelId} data-pannello-menu className={styles.panel} hidden={!open}>
        <PrimaryNav
          locale={locale}
          dict={dict}
          className={styles.nav}
          linkClassName={styles.navLink}
          onNavigate={close}
        />

        <div className={styles.controls}>
          <LocaleNav current={locale} groupLabel={dict.localeGroup} names={localeNames} />
        </div>
      </div>
    </div>
  )
}
