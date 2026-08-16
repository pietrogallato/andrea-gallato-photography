import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lightbox } from '../Lightbox'
import { getDictionary } from '@/lib/i18n/dictionaries'

const dict = getDictionary('it')

const photos = [
  { id: 'a', ar: 1.5, url: 'https://cdn.sanity.io/images/p/d/a-3000x2000.jpg', lqip: null, alt: 'Prima', altLang: 'it' as const, title: 'Nebbia', titleLang: 'it' as const, year: 2024, place: 'Veneto', placeLang: 'it' as const },
  { id: 'b', ar: 0.75, url: 'https://cdn.sanity.io/images/p/d/b-1500x2000.jpg', lqip: null, alt: 'Seconda', altLang: 'it' as const },
]

beforeAll(() => {
  // jsdom non implementa i metodi di <dialog>.
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

function setup(index = 0, onClose = vi.fn(), onNavigate = vi.fn()) {
  render(
    <Lightbox
      photos={photos}
      index={index}
      locale="it"
      dict={dict}
      onClose={onClose}
      onNavigate={onNavigate}
    />,
  )
  return { onClose, onNavigate }
}

describe('Lightbox', () => {
  it('ha sempre un nome accessibile, anche senza titolo', () => {
    setup(1)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName()
  })

  it('usa il titolo come nome accessibile quando c e', () => {
    setup(0)
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Nebbia/)
  })

  it('mostra titolo, anno e luogo solo quando valorizzati', () => {
    setup(0)
    expect(screen.getByText('Nebbia')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.getByText('Veneto')).toBeInTheDocument()
  })

  it('non mostra didascalia quando i campi mancano', () => {
    setup(1)
    expect(screen.queryByText('Nebbia')).toBeNull()
    expect(screen.queryByText('2024')).toBeNull()
  })

  // La chiusura con Esc non e verificabile qui. jsdom non implementa
  // l algoritmo di "request close" di <dialog>: non esiste showModal e non
  // viene mai emesso ne cancel ne close, quindi onClose non puo scattare.
  // Verificato leggendo jsdom/living/nodes/HTMLDialogElement-impl.js.
  // Il comportamento e corretto in un browser vero, dove Esc emette cancel e
  // poi close, ed e coperto dall e2e "si chiude con Esc" del Task 12.

  it('naviga con le frecce', async () => {
    const { onNavigate } = setup(0)
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('non supera l ultima fotografia', async () => {
    const { onNavigate } = setup(1)
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('non va prima della prima fotografia', async () => {
    const { onNavigate } = setup(0)
    await userEvent.keyboard('{ArrowLeft}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('annuncia la posizione a ogni navigazione', () => {
    setup(0)
    expect(screen.getByRole('status')).toHaveTextContent('1')
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('espone i pulsanti di chiusura e navigazione, alternativa allo swipe', () => {
    setup(0)
    expect(screen.getByRole('button', { name: dict.lightboxClose })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: dict.lightboxNext })).toBeInTheDocument()
  })
})

/**
 * Il difetto vero — il browser continua a dipingere la fotografia precedente
 * finche la nuova non e decodificata — **non e riproducibile qui**: jsdom non
 * dipinge nulla, e nel DOM `src` e `alt` cambiano subito anche col bug.
 *
 * Quello che si puo verificare e il meccanismo che lo risolve: l elemento
 * immagine viene rimontato invece di riusato, cosi il segnaposto sfocato
 * torna a mostrarsi, e c e uno stato di caricamento visibile quando la
 * fotografia tarda.
 */
describe('Lightbox, stato di caricamento', () => {
  function renderAt(index: number) {
    return render(
      <Lightbox
        photos={photos}
        index={index}
        locale="it"
        dict={dict}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
  }

  it('rimonta l elemento immagine quando la fotografia cambia', () => {
    const { rerender } = renderAt(0)
    const prima = screen.getByAltText('Prima')

    rerender(
      <Lightbox
        photos={photos}
        index={1}
        locale="it"
        dict={dict}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )

    const seconda = screen.getByAltText('Seconda')
    // Nodo diverso, non lo stesso <img> con un src riscritto: e cio che
    // riporta in scena il segnaposto invece della fotografia precedente.
    expect(seconda).not.toBe(prima)
    expect(prima).not.toBeInTheDocument()
  })

  it('non mostra l indicatore prima della soglia: una fotografia veloce non lo fa lampeggiare', () => {
    vi.useFakeTimers()
    try {
      renderAt(0)
      act(() => { vi.advanceTimersByTime(200) })
      expect(screen.queryByRole('progressbar')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('mostra l indicatore quando la fotografia tarda', () => {
    vi.useFakeTimers()
    try {
      renderAt(0)
      act(() => { vi.advanceTimersByTime(400) })
      const barra = screen.getByRole('progressbar')
      expect(barra).toHaveAccessibleName(dict.lightboxLoading)
      // Indeterminato: nessun valore da dichiarare.
      expect(barra).not.toHaveAttribute('aria-valuenow')
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * `next/image` non inoltra `onLoad` in modo sincrono: attende `decode()`
   * sull elemento prima di richiamarlo. Senza aspettare quel microtask le
   * asserzioni girerebbero un istante troppo presto, e il test fallirebbe
   * descrivendo un difetto che non c e.
   */
  const segnalaCaricata = async (alt: string) => {
    await act(async () => {
      fireEvent.load(screen.getByAltText(alt))
    })
  }

  it('toglie l indicatore quando la fotografia e arrivata', async () => {
    vi.useFakeTimers()
    try {
      renderAt(0)
      act(() => { vi.advanceTimersByTime(400) })
      expect(screen.getByRole('progressbar')).toBeInTheDocument()

      await segnalaCaricata('Prima')
      expect(screen.queryByRole('progressbar')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('marca la figura come occupata finche la fotografia non e arrivata', async () => {
    renderAt(0)
    const figura = screen.getByAltText('Prima').closest('figure')!
    expect(figura).toHaveAttribute('aria-busy', 'true')

    await segnalaCaricata('Prima')
    expect(figura).toHaveAttribute('aria-busy', 'false')
  })

  it('ricomincia ad attendere quando si naviga a una fotografia gia caricata', async () => {
    vi.useFakeTimers()
    try {
      const { rerender } = renderAt(0)
      await segnalaCaricata('Prima')

      rerender(
        <Lightbox
          photos={photos}
          index={1}
          locale="it"
          dict={dict}
          onClose={vi.fn()}
          onNavigate={vi.fn()}
        />,
      )

      // Lo stato non deve restare "caricata" dalla fotografia precedente.
      expect(screen.getByAltText('Seconda').closest('figure')).toHaveAttribute('aria-busy', 'true')
      act(() => { vi.advanceTimersByTime(400) })
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Lightbox, ingrandimento', () => {
  function montaConRiquadro(index = 0, onClose = vi.fn(), onNavigate = vi.fn()) {
    render(
      <Lightbox
        photos={photos}
        index={index}
        locale="it"
        dict={dict}
        onClose={onClose}
        onNavigate={onNavigate}
      />,
    )
    // jsdom non fa layout: senza un riquadro finto ogni conto sarebbe degenere
    // e il livello non salirebbe mai sopra 1.
    const superficie = document.querySelector('dialog figure > div') as HTMLElement
    superficie.getBoundingClientRect = () =>
      ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    return { onClose, onNavigate, superficie }
  }

  it('espone il comando per ingrandire, unico modo da tastiera', () => {
    montaConRiquadro()
    expect(screen.getByRole('button', { name: dict.lightboxZoomIn })).toBeInTheDocument()
  })

  it('da ingranditi ritira frecce e didascalia', async () => {
    montaConRiquadro(0)
    expect(screen.getByRole('button', { name: dict.lightboxNext })).toBeInTheDocument()
    expect(screen.getByText('Nebbia')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))

    // Ritirate, non nascoste a meta: mostrare una freccia mentre la stessa
    // freccia della tastiera fa un altra cosa e una interfaccia che si smentisce.
    expect(screen.queryByRole('button', { name: dict.lightboxNext })).toBeNull()
    expect(screen.queryByText('Nebbia')).toBeNull()
  })

  it('a riposo le frecce navigano', async () => {
    const { onNavigate } = montaConRiquadro(0)
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('da ingranditi le frecce non navigano piu: spostano', async () => {
    const { onNavigate } = montaConRiquadro(0)
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    await userEvent.keyboard('{ArrowRight}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('non tocca le frecce quando c e un modificatore: quello e il browser', async () => {
    const { onNavigate } = montaConRiquadro(0)
    await userEvent.keyboard('{Meta>}{ArrowRight}{/Meta}')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('il tasto + ingrandisce e il tasto 0 riporta a schermo intero', async () => {
    montaConRiquadro(0)
    await userEvent.keyboard('+')
    expect(screen.getByRole('button', { name: dict.lightboxZoomReset })).toBeInTheDocument()
    await userEvent.keyboard('0')
    expect(screen.queryByRole('button', { name: dict.lightboxZoomReset })).toBeNull()
  })

  it('accetta = oltre a +, perche su parecchi layout + richiede Shift', async () => {
    montaConRiquadro(0)
    await userEvent.keyboard('=')
    expect(screen.getByRole('button', { name: dict.lightboxZoomReset })).toBeInTheDocument()
  })

  it('cambiando fotografia torna a schermo intero', async () => {
    const { rerender } = render(
      <Lightbox photos={photos} index={0} locale="it" dict={dict} onClose={vi.fn()} onNavigate={vi.fn()} />,
    )
    const superficie = document.querySelector('dialog figure > div') as HTMLElement
    superficie.getBoundingClientRect = () =>
      ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    expect(screen.getByRole('button', { name: dict.lightboxZoomReset })).toBeInTheDocument()

    rerender(
      <Lightbox photos={photos} index={1} locale="it" dict={dict} onClose={vi.fn()} onNavigate={vi.fn()} />,
    )
    expect(screen.queryByRole('button', { name: dict.lightboxZoomReset })).toBeNull()
  })

  it('resta una sola regione live, che dice la posizione', async () => {
    montaConRiquadro(0)
    await userEvent.click(screen.getByRole('button', { name: dict.lightboxZoomIn }))
    // getByRole fallisce con "found multiple elements" se ne compare una seconda.
    expect(screen.getByRole('status')).toHaveTextContent('1')
  })
})
