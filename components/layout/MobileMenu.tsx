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
        {/* L etichetta sparisce agli occhi, non alle orecchie: resta il nome
            accessibile del pulsante, e con esso il modo in cui lo cercano gli
            screen reader e i test. */}
        <span className="visually-hidden">{open ? dict.closeMenu : dict.openMenu}</span>
        {/* Due trattini, non tre. Con tre, quello di mezzo deve svanire mentre
            gli altri ruotano e il gesto si sporca; con due la croce e la stessa
            figura girata. Lo stato lo dice gia `aria-expanded` sul pulsante, e
            il CSS legge quello invece di una classe in piu. */}
        <span className={styles.simbolo} aria-hidden="true">
          <span className={styles.barra} />
          <span className={styles.barra} />
        </span>
      </button>

      {/* L attributo, e non la classe: la regola che lo cerca vive in
          Header.module.css, dove il nome con l hash di questo modulo non arriva.
          Il perche di quella regola e scritto li. */}
      <div id={panelId} data-pannello-menu className={styles.panel} hidden={!open}>
        <div className={styles.lingue}>
          <LocaleNav current={locale} groupLabel={dict.localeGroup} names={localeNames} />
        </div>

        <PrimaryNav
          locale={locale}
          dict={dict}
          conHome
          className={styles.nav}
          linkClassName={styles.navLink}
          onNavigate={close}
        />
      </div>
    </div>
  )
}
