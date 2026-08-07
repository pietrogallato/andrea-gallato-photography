import { describe, it, expect } from 'vitest'
import { buildPlaceholderPlan, ASPECT_RATIOS } from '../generatePlaceholders'

describe('buildPlaceholderPlan', () => {
  it('produce esattamente il numero richiesto di immagini', () => {
    expect(buildPlaceholderPlan(30)).toHaveLength(30)
  })

  it('usa tutti i rapporti d aspetto previsti', () => {
    const plan = buildPlaceholderPlan(30)
    const used = new Set(plan.map((p) => p.ratioName))
    expect(used.size).toBe(ASPECT_RATIOS.length)
  })

  it('non supera mai 4000px sul lato lungo', () => {
    for (const p of buildPlaceholderPlan(30)) {
      expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(4000)
    }
  })

  it('produce dimensioni intere', () => {
    for (const p of buildPlaceholderPlan(30)) {
      expect(Number.isInteger(p.width)).toBe(true)
      expect(Number.isInteger(p.height)).toBe(true)
    }
  })

  it('rispetta il rapporto d aspetto entro un pixel di arrotondamento', () => {
    for (const p of buildPlaceholderPlan(30)) {
      const actual = p.width / p.height
      expect(Math.abs(actual - p.ratio)).toBeLessThan(0.01)
    }
  })

  it('produce nomi di file univoci', () => {
    const plan = buildPlaceholderPlan(30)
    expect(new Set(plan.map((p) => p.filename)).size).toBe(30)
  })

  it('è deterministico', () => {
    expect(buildPlaceholderPlan(12)).toEqual(buildPlaceholderPlan(12))
  })
})
