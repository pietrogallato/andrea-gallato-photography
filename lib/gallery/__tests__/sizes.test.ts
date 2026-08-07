import { describe, it, expect } from 'vitest'
import { sizesForTile, CONTENT_MAX_PX, TABLET_MIN_PX } from '../sizes'

describe('sizesForTile', () => {
  it('dichiara larghezza piena sotto il breakpoint tablet', () => {
    expect(sizesForTile(2.8, 1.4)).toContain(`(max-width: ${TABLET_MIN_PX - 1}px) 100vw`)
  })

  it('esprime la frazione di riga occupata dal tile', () => {
    // Un tile che occupa meta della riga: 1.4 su 2.8.
    expect(sizesForTile(2.8, 1.4)).toContain('50vw')
  })

  it('limita la larghezza al contenitore massimo', () => {
    expect(sizesForTile(2.8, 1.4)).toContain(`${Math.round(CONTENT_MAX_PX * 0.5)}px`)
  })

  it('assegna larghezza piena a un tile solo nella sua riga', () => {
    expect(sizesForTile(1.7, 1.7)).toContain('100vw')
  })

  it('arrotonda le percentuali a interi', () => {
    expect(sizesForTile(3, 1)).not.toMatch(/\d+\.\d+vw/)
  })

  it('non produce mai zero', () => {
    expect(sizesForTile(0, 1.5)).toContain('100vw')
  })
})
