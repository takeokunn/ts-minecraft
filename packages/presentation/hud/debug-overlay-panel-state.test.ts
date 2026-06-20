import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'

import { DEBUG_FEATURE_FLAG_CATALOG } from '@ts-minecraft/app/application/debug-feature-flags'
import {
  applyDebugOverlayPanelState,
  resolveDebugOverlayPanelState,
} from '@ts-minecraft/presentation/hud/debug-overlay-panel-state'
import { DEBUG_FEATURE_GROUP_ORDER } from '@ts-minecraft/presentation/hud/debug-overlay-utils'
import type { DebugOverlayDomNodes } from '@ts-minecraft/presentation/hud/debug-overlay-types'
import type { DebugFeatureFlagGroup, DebugFeatureSnapshot } from '@ts-minecraft/app/application/debug-feature-flags'

const buildSnapshot = (): DebugFeatureSnapshot => {
  const flags = Object.fromEntries(
    DEBUG_FEATURE_FLAG_CATALOG.map((entry) => [entry.id, false]),
  ) as DebugFeatureSnapshot['flags']
  flags['mobs.enabled'] = true
  flags['rendering.postProcessing'] = true
  return { catalog: DEBUG_FEATURE_FLAG_CATALOG, flags }
}

const makeElement = <T extends Record<string, unknown>>(initial?: T) => {
  const attributes = new Map<string, string>()
  return {
    style: {} as Record<string, string>,
    setAttribute: (name: string, value: string) => {
      attributes.set(name, value)
    },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    ...initial,
  }
}

const makeTextNode = (value = '') => ({ nodeValue: value })

const makeDom = (): DebugOverlayDomNodes => {
  const groupsInCatalog = new Set<DebugFeatureFlagGroup>(DEBUG_FEATURE_FLAG_CATALOG.map((entry) => entry.group))
  const toggleRows = DEBUG_FEATURE_FLAG_CATALOG.map((entry) => ({
    id: entry.id,
    entry,
    row: makeElement(),
    button: makeElement(),
    stateText: makeTextNode(),
  }))
  const groupSections = DEBUG_FEATURE_GROUP_ORDER
    .filter((group): group is DebugFeatureFlagGroup => groupsInCatalog.has(group))
    .map((group) => ({
      group,
      section: makeElement(),
    }))
  return {
    overlay: makeElement(),
    panel: makeElement(),
    searchInput: makeElement({ value: '' }),
    enabledCountText: makeTextNode(),
    statusText: makeTextNode(),
    resetAllButton: makeElement(),
    toggleRows,
    groupSections,
    metricsPanel: makeElement(),
    textNodes: [],
  }
}

describe('presentation/hud/debug-overlay-panel-state', () => {
  it('resolves the panel state from one snapshot and query', () => {
    const state = resolveDebugOverlayPanelState(buildSnapshot(), 'mobs.enabled')
    const matchedRow = state.toggleRows.find((row) => row.id === 'mobs.enabled')
    const unmatchedRow = state.toggleRows.find((row) => row.id === 'rendering.postProcessing')
    const mobsSection = state.groupSections.find((section) => section.group === 'mobs')
    const renderingSection = state.groupSections.find((section) => section.group === 'rendering')

    expect(state.enabledCount).toBe(2)
    expect(state.toggleRows).toHaveLength(DEBUG_FEATURE_FLAG_CATALOG.length)
    expect(matchedRow?.visible).toBe(true)
    expect(matchedRow?.enabled).toBe(true)
    expect(unmatchedRow?.visible).toBe(false)
    expect(mobsSection?.visible).toBe(true)
    expect(renderingSection?.visible).toBe(false)
  })

  it('applies the resolved state to the DOM nodes', () => {
    const dom = makeDom()
    const state = resolveDebugOverlayPanelState(buildSnapshot(), 'mobs.enabled')

    applyDebugOverlayPanelState(dom, state)

    const matchedRow = dom.toggleRows.find((row) => row.id === 'mobs.enabled')
    const unmatchedRow = dom.toggleRows.find((row) => row.id === 'rendering.postProcessing')
    const mobsSection = dom.groupSections.find((section) => section.group === 'mobs')
    const renderingSection = dom.groupSections.find((section) => section.group === 'rendering')

    expect(dom.enabledCountText.nodeValue).toBe(`2/${DEBUG_FEATURE_FLAG_CATALOG.length} enabled`)
    expect(matchedRow?.row.style.display).toBe('flex')
    expect(matchedRow?.row.style.opacity).toBe('1')
    expect(matchedRow?.button.getAttribute('aria-checked')).toBe('true')
    expect(matchedRow?.stateText.nodeValue).toBe('ON')
    expect(unmatchedRow?.row.style.display).toBe('none')
    expect(unmatchedRow?.button.getAttribute('aria-checked')).toBe('true')
    expect(unmatchedRow?.stateText.nodeValue).toBe('ON')
    expect(mobsSection?.section.style.display).toBe('block')
    expect(renderingSection?.section.style.display).toBe('none')
  })
})
