import { describe, it, expect, vi } from 'vitest'
import { nextOrderRank } from '../orderRank'

function clientReturning(value: string | null) {
  return { fetch: vi.fn(async () => value) } as unknown as Parameters<typeof nextOrderRank>[0]
}

describe('nextOrderRank', () => {
  it('produce un rank quando il dataset è vuoto', async () => {
    const rank = await nextOrderRank(clientReturning(null), 'photo')
    expect(typeof rank).toBe('string')
    expect(rank.length).toBeGreaterThan(0)
  })

  it('produce un rank successivo a quello esistente', async () => {
    const first = await nextOrderRank(clientReturning(null), 'photo')
    const second = await nextOrderRank(clientReturning(first), 'photo')
    expect(second > first).toBe(true)
  })

  it('produce rank crescenti su chiamate successive', async () => {
    let last: string | null = null
    const ranks: string[] = []
    for (let i = 0; i < 5; i++) {
      last = await nextOrderRank(clientReturning(last), 'photo')
      ranks.push(last)
    }
    expect([...ranks].sort()).toEqual(ranks)
    expect(new Set(ranks).size).toBe(5)
  })

  /**
   * Limite noto, documentato di proposito invece che corretto qui.
   *
   * `nextOrderRank` legge il massimo e ci costruisce sopra: due chiamate che
   * partono dallo stesso massimo — perche nessuna delle due ha ancora
   * scritto — arrivano allo stesso valore. Due fotografie caricate insieme
   * finirebbero nella stessa posizione, e l'ordine editoriale diventerebbe
   * arbitrario.
   *
   * La correzione non sta in questa funzione, che non puo sapere di essere
   * chiamata due volte: sta in chi la usa. Il tool di caricamento assegna i
   * rank **in sequenza**, non in parallelo.
   */
  it('dallo stesso massimo due chiamate concorrenti danno lo stesso rank', async () => {
    const client = clientReturning('0|hzzzzz:')

    const [a, b] = await Promise.all([
      nextOrderRank(client, 'photo'),
      nextOrderRank(client, 'photo'),
    ])

    expect(a).toBe(b)
  })

  it('interroga il rank massimo ordinando in modo decrescente', async () => {
    const client = clientReturning(null)
    await nextOrderRank(client, 'photo')

    const [query] = (client.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect(query).toContain('orderRank desc')
    expect(query).toContain('[0]')
  })

  it('passa il tipo come parametro e non lo interpola nella query', async () => {
    const client = clientReturning(null)
    await nextOrderRank(client, 'photo')

    const [query, params] = (client.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]

    // Il tipo viaggia nei parametri, non concatenato nella stringa:
    // interpolare un valore in una query GROQ e la porta aperta all injection.
    expect(query).toContain('$type')
    expect(query).not.toContain('"photo"')
    expect(params).toEqual({ type: 'photo' })
  })
})
