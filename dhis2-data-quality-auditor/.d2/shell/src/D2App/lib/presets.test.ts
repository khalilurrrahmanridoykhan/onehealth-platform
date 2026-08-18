import { AMR_PRESETS } from './presets'

describe('AMR_PRESETS', () => {
  test('has three presets covering resistance, consumption, and stewardship', () => {
    expect(AMR_PRESETS.map((p) => p.id)).toEqual([
      'amr-resistance-rate',
      'amr-consumption',
      'amr-stewardship',
    ])
  })

  test('every preset has a unique id', () => {
    const ids = AMR_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every preset is category AMR and has a non-empty label, description, and source name', () => {
    for (const preset of AMR_PRESETS) {
      expect(preset.category).toBe('AMR')
      expect(preset.label.length).toBeGreaterThan(0)
      expect(preset.description.length).toBeGreaterThan(0)
      expect(preset.sourceName.length).toBeGreaterThan(0)
    }
  })

  test('no preset sets a dataset, data element, org unit, or comparison-element id -- those always come from the installing instance', () => {
    for (const preset of AMR_PRESETS) {
      expect(preset).not.toHaveProperty('dataSetId')
      expect(preset).not.toHaveProperty('dataElementId')
      expect(preset).not.toHaveProperty('orgUnits')
      expect(preset).not.toHaveProperty('comparisonDataElementId')
    }
  })

  test('ratio-based presets keep expectedRatioMin/Max within a plausible 0-1 proportion range', () => {
    const ratioPresets = AMR_PRESETS.filter((p) => p.comparisonLabel !== null)
    expect(ratioPresets.length).toBeGreaterThan(0)
    for (const preset of ratioPresets) {
      expect(preset.expectedRatioMin).toBe(0)
      expect(preset.expectedRatioMax).toBe(1)
    }
  })

  test('every expectedUpdateDays and trendChangeThresholdPercent is a positive number', () => {
    for (const preset of AMR_PRESETS) {
      expect(preset.expectedUpdateDays).toBeGreaterThan(0)
      expect(preset.trendChangeThresholdPercent).toBeGreaterThan(0)
    }
  })
})
