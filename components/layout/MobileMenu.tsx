'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locales'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { pathFor } from '@/lib/i18n/routes'
import styles from './MobileMenu.module.css'

export function MobileMenu({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={styles.menu} onKeyDown={(e) => e.key === 'Escape' && open && close()}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? dict.closeMenu : dict.openMenu}
      </button>

      <div id={panelId} className={styles.panel} hidden={!open}>
        <Link href={pathFor(locale, { key: 'gallery' })} onClick={close}>
          {dict.navGallery}
        </Link>
      </div>
    </div>
  )
}
