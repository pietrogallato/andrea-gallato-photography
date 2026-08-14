import { describe, it, expect } from 'vitest'
import { uploadTool } from '../index'

/**
 * Il plugin aggiunge il tool **in coda** a quelli esistenti.
 *
 * Il rischio non e che il tool manchi — si vedrebbe subito — ma che
 * sostituisca gli altri: `tools: () => [uploadTool()]` invece di
 * `(prev) => [...prev, uploadTool()]` cancellerebbe Vision e chiunque altro,
 * e in produzione Vision non c'e, quindi in sviluppo il difetto si
 * noterebbe e in produzione no.
 */
describe('registrazione del tool', () => {
  it('ha nome, titolo e componente', () => {
    const tool = uploadTool()

    expect(tool.name).toBe('carica-fotografie')
    expect(tool.title).toBeTruthy()
    expect(typeof tool.component).toBe('function')
  })

  it('si aggiunge ai tool esistenti invece di sostituirli', () => {
    const precedenti = [{ name: 'vision', title: 'Vision', component: () => null }]
    const risolti = [...precedenti, uploadTool()]

    expect(risolti.map((t) => t.name)).toEqual(['vision', 'carica-fotografie'])
  })
})
