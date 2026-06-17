import {
  type DebugFeatureCatalogEntry,
  type DebugFeatureFlagGroup,
  type DebugFeatureFlagId,
  type DebugFeatureSnapshot,
} from '@ts-minecraft/app/debug-feature-flags'
import type { DebugOverlayDomNodes } from '@ts-minecraft/presentation/hud/debug-overlay-types'
import {
  DEBUG_FEATURE_GROUP_ORDER,
  debugFeatureSearchMatches,
} from '@ts-minecraft/presentation/hud/debug-overlay-utils'

export type DebugOverlayToggleRowState = {
  readonly id: DebugFeatureFlagId
  readonly enabled: boolean
  readonly visible: boolean
}

export type DebugOverlayGroupSectionState = {
  readonly group: DebugFeatureFlagGroup
  readonly visible: boolean
}

export type DebugOverlayPanelState = {
  readonly enabledCount: number
  readonly toggleRows: ReadonlyArray<DebugOverlayToggleRowState>
  readonly groupSections: ReadonlyArray<DebugOverlayGroupSectionState>
}

const resolveGroupSectionState = (
  catalog: ReadonlyArray<DebugFeatureCatalogEntry>,
  query: string,
): ReadonlyArray<DebugOverlayGroupSectionState> => {
  const groupsInCatalog = new Set<DebugFeatureFlagGroup>(catalog.map((entry) => entry.group))
  const states: Array<DebugOverlayGroupSectionState> = []
  for (const group of DEBUG_FEATURE_GROUP_ORDER) {
    if (!groupsInCatalog.has(group)) continue
    const visible = catalog.some((entry) => entry.group === group && debugFeatureSearchMatches(entry, query))
    states.push({ group, visible })
  }
  return states
}

export const resolveDebugOverlayPanelState = (
  snapshot: DebugFeatureSnapshot,
  query: string,
): DebugOverlayPanelState => {
  let enabledCount = 0
  const toggleRows = snapshot.catalog.map((entry) => {
    const enabled = snapshot.flags[entry.id]
    if (enabled) enabledCount += 1
    return {
      id: entry.id,
      enabled,
      visible: debugFeatureSearchMatches(entry, query),
    }
  })
  return {
    enabledCount,
    toggleRows,
    groupSections: resolveGroupSectionState(snapshot.catalog, query),
  }
}

const setToggleRowStyle = (rowState: DebugOverlayToggleRowState, rowNodes: DebugOverlayDomNodes['toggleRows'][number]): void => {
  rowNodes.button.setAttribute('aria-checked', rowState.enabled ? 'true' : 'false')
  rowNodes.button.style.background = rowState.enabled ? 'rgba(34,197,94,0.22)' : 'rgba(148,163,184,0.12)'
  rowNodes.button.style.borderColor = rowState.enabled ? '#22c55e' : '#64748b'
  rowNodes.button.style.color = rowState.enabled ? '#dcfce7' : '#cbd5e1'
  rowNodes.stateText.nodeValue = rowState.enabled ? 'ON' : 'OFF'
  rowNodes.row.style.opacity = rowState.enabled ? '1' : '0.56'
  rowNodes.row.style.display = rowState.visible ? 'flex' : 'none'
}

const setGroupSectionStyle = (
  sectionState: DebugOverlayGroupSectionState,
  sectionNodes: DebugOverlayDomNodes['groupSections'][number],
): void => {
  sectionNodes.section.style.display = sectionState.visible ? 'block' : 'none'
}

export const applyDebugOverlayPanelState = (
  dom: Pick<DebugOverlayDomNodes, 'toggleRows' | 'groupSections' | 'enabledCountText'>,
  state: DebugOverlayPanelState,
): void => {
  dom.enabledCountText.nodeValue = `${state.enabledCount}/${state.toggleRows.length} enabled`

  const rowsById = new Map<DebugFeatureFlagId, DebugOverlayDomNodes['toggleRows'][number]>()
  for (const row of dom.toggleRows) rowsById.set(row.id, row)
  for (const rowState of state.toggleRows) {
    const rowNodes = rowsById.get(rowState.id)
    if (rowNodes === undefined) continue
    setToggleRowStyle(rowState, rowNodes)
  }

  const sectionsByGroup = new Map<DebugFeatureFlagGroup, DebugOverlayDomNodes['groupSections'][number]>()
  for (const section of dom.groupSections) sectionsByGroup.set(section.group, section)
  for (const sectionState of state.groupSections) {
    const sectionNodes = sectionsByGroup.get(sectionState.group)
    if (sectionNodes === undefined) continue
    setGroupSectionStyle(sectionState, sectionNodes)
  }
}
