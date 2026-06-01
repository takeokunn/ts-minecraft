import { Cause, Effect } from 'effect'
import {
  DEBUG_FEATURE_FLAG_CATALOG,
  type DebugFeatureFlags,
} from '@ts-minecraft/app/debug-feature-flags'
import type { DebugOverlayDeps, DebugOverlayDomNodes, GroupSectionNodes, TogglePanelNodes, ToggleRowNodes } from '@ts-minecraft/presentation/hud/debug-overlay-types'
import {
  badgeStyles,
  DEBUG_FEATURE_GROUP_ORDER,
  debugFeatureBadges,
  debugFeatureGroupLabels,
  debugFeatureSearchMatches,
} from '@ts-minecraft/presentation/hud/debug-overlay-utils'

export const setStatus = (dom: Pick<DebugOverlayDomNodes, 'statusText'>, message: string): void => {
  dom.statusText.nodeValue = message
}

export const updateToggleRowsFromFlags = (
  dom: Pick<DebugOverlayDomNodes, 'toggleRows' | 'enabledCountText'>,
  flags: DebugFeatureFlags,
): void => {
  let enabledCount = 0
  for (const row of dom.toggleRows) {
    const enabled = flags[row.id]
    if (enabled) enabledCount += 1
    row.button.setAttribute('aria-checked', enabled ? 'true' : 'false')
    row.button.style.background = enabled ? 'rgba(34,197,94,0.22)' : 'rgba(148,163,184,0.12)'
    row.button.style.borderColor = enabled ? '#22c55e' : '#64748b'
    row.button.style.color = enabled ? '#dcfce7' : '#cbd5e1'
    row.stateText.nodeValue = enabled ? 'ON' : 'OFF'
    row.row.style.opacity = enabled ? '1' : '0.56'
  }
  dom.enabledCountText.nodeValue = `${enabledCount}/${dom.toggleRows.length} enabled`
}

export const filterToggleRows = (
  dom: Pick<DebugOverlayDomNodes, 'searchInput' | 'groupSections' | 'toggleRows'>,
): void => {
  const query = dom.searchInput.value
  for (const groupSection of dom.groupSections) {
    let visibleRows = 0
    for (const row of dom.toggleRows) {
      if (row.entry.group !== groupSection.group) continue
      const visible = debugFeatureSearchMatches(row.entry, query)
      row.row.style.display = visible ? 'flex' : 'none'
      if (visible) visibleRows += 1
    }
    groupSection.section.style.display = visibleRows > 0 ? 'block' : 'none'
  }
}

export const refreshTogglePanel = (
  dom: DebugOverlayDomNodes,
  deps: DebugOverlayDeps,
  statusMessage?: string,
): Effect.Effect<void, never> =>
  deps.debugFeatureFlags.getSnapshot().pipe(
    Effect.map((snapshot) => {
      updateToggleRowsFromFlags(dom, snapshot.flags)
      filterToggleRows(dom)
      if (statusMessage !== undefined) setStatus(dom, statusMessage)
    }),
  )

export const runPanelEffect = (dom: DebugOverlayDomNodes, effect: Effect.Effect<void, never>): void => {
  void Effect.runPromise(
    effect.pipe(
      Effect.catchAllCause((cause) =>
        Effect.sync(() => setStatus(dom, `Debug toggle failed: ${Cause.pretty(cause)}`)),
      ),
    ),
  )
}

const makeBadge = (badge: 'danger' | 'reload' | 'perf'): HTMLSpanElement => {
  const span = document.createElement('span')
  span.textContent = badge
  span.title = badge === 'danger'
    ? 'Debug-only: may alter runtime state'
    : badge === 'reload'
      ? 'May require a scene/settings refresh for full visual effect'
      : 'Useful for performance isolation'
  span.style.cssText = [
    'font-size:9px',
    'line-height:1',
    'padding:2px 4px',
    'border:1px solid',
    'border-radius:999px',
    'text-transform:uppercase',
    'letter-spacing:0.04em',
    badgeStyles[badge],
  ].join(';')
  return span
}

const createToggleRow = (
  entry: (typeof DEBUG_FEATURE_FLAG_CATALOG)[number],
  deps: DebugOverlayDeps,
  getDom: () => DebugOverlayDomNodes | null,
): ToggleRowNodes => {
  const row = document.createElement('div')
  row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px'
  row.dataset['debugFeatureId'] = entry.id

  const info = document.createElement('div')
  info.style.cssText = 'min-width:0;display:flex;flex-direction:column;gap:1px'
  const labelLine = document.createElement('div')
  labelLine.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap'
  const label = document.createElement('span')
  label.textContent = entry.label
  label.style.cssText = 'color:#f8fafc'
  labelLine.appendChild(label)
  for (const badge of debugFeatureBadges(entry)) labelLine.appendChild(makeBadge(badge))
  const description = document.createElement('div')
  description.textContent = entry.description
  description.style.cssText = 'color:#94a3b8;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px'
  info.appendChild(labelLine)
  info.appendChild(description)

  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('role', 'switch')
  button.setAttribute('aria-label', entry.label)
  button.setAttribute('aria-checked', 'true')
  button.style.cssText = 'cursor:pointer;min-width:48px;border:1px solid #22c55e;border-radius:999px;background:rgba(34,197,94,0.22);color:#dcfce7;font:inherit;font-size:10px;padding:3px 6px;text-align:center'
  const stateText = document.createTextNode('ON')
  button.appendChild(stateText)

  const activate = (): void => {
    const dom = getDom()
    if (dom === null) return
    runPanelEffect(
      dom,
      deps.debugFeatureFlags.isEnabled(entry.id).pipe(
        Effect.flatMap((enabled) => deps.debugFeatureFlags.setEnabled(entry.id, !enabled)),
        Effect.flatMap((changed) => refreshTogglePanel(dom, deps, changed ? `${entry.label} toggled` : `${entry.label} unchanged`)),
      ),
    )
  }
  button.addEventListener('click', activate)
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    activate()
  })

  row.appendChild(info)
  row.appendChild(button)
  return { id: entry.id, entry, row, button, stateText }
}

export const buildTogglePanel = (
  deps: DebugOverlayDeps,
  getDom: () => DebugOverlayDomNodes | null,
): TogglePanelNodes => {
  const panel = document.createElement('div')
  panel.id = 'debug-toggle-panel'
  panel.setAttribute('role', 'region')
  panel.setAttribute('aria-label', 'Debug feature toggles')
  panel.style.cssText = 'padding:10px;background:rgba(0,0,0,0.82);border:1px solid rgba(148,163,184,0.35);border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,0.35);pointer-events:auto;white-space:normal;max-height:min(70vh,560px);overflow:auto'

  const header = document.createElement('div')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px'
  const titleWrap = document.createElement('div')
  const title = document.createElement('div')
  title.textContent = 'Debug Toggles'
  title.style.cssText = 'font-weight:700;font-size:13px;letter-spacing:0.02em'
  const enabledCountText = document.createTextNode('0/0 enabled')
  const enabledCount = document.createElement('div')
  enabledCount.style.cssText = 'color:#cbd5e1;font-size:11px;margin-top:2px'
  enabledCount.appendChild(enabledCountText)
  titleWrap.appendChild(title)
  titleWrap.appendChild(enabledCount)

  const resetAllButton = document.createElement('button')
  resetAllButton.type = 'button'
  resetAllButton.textContent = 'Reset All'
  resetAllButton.style.cssText = 'cursor:pointer;border:1px solid rgba(148,163,184,0.45);border-radius:4px;background:rgba(15,23,42,0.7);color:#e2e8f0;font:inherit;font-size:11px;padding:4px 7px'
  header.appendChild(titleWrap)
  header.appendChild(resetAllButton)

  const searchInput = document.createElement('input')
  searchInput.type = 'search'
  searchInput.placeholder = 'Search features...'
  searchInput.setAttribute('aria-label', 'Search debug toggles')
  searchInput.style.cssText = 'box-sizing:border-box;width:100%;margin-bottom:8px;padding:6px 7px;border:1px solid rgba(148,163,184,0.45);border-radius:4px;background:rgba(15,23,42,0.82);color:#f8fafc;font:inherit;font-size:12px;outline:none'

  const groupSections: Array<GroupSectionNodes> = []
  const toggleRows: Array<ToggleRowNodes> = []
  const groupsContainer = document.createElement('div')
  groupsContainer.style.cssText = 'display:flex;flex-direction:column;gap:7px'

  for (const group of DEBUG_FEATURE_GROUP_ORDER) {
    const entries = DEBUG_FEATURE_FLAG_CATALOG.filter((entry) => entry.group === group)
    if (entries.length === 0) continue
    const section = document.createElement('div')
    section.style.cssText = 'border-top:1px solid rgba(148,163,184,0.18);padding-top:7px'
    const groupHeader = document.createElement('div')
    groupHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px'
    const groupTitle = document.createElement('div')
    groupTitle.textContent = debugFeatureGroupLabels[group]
    groupTitle.style.cssText = 'font-weight:700;color:#f8fafc;font-size:12px'
    const resetGroupButton = document.createElement('button')
    resetGroupButton.type = 'button'
    resetGroupButton.textContent = 'Reset'
    resetGroupButton.style.cssText = 'cursor:pointer;border:1px solid rgba(148,163,184,0.35);border-radius:4px;background:rgba(15,23,42,0.62);color:#cbd5e1;font:inherit;font-size:10px;padding:2px 5px'
    resetGroupButton.addEventListener('click', () => {
      const dom = getDom()
      if (dom === null) return
      runPanelEffect(dom, deps.debugFeatureFlags.resetGroup(group).pipe(Effect.andThen(refreshTogglePanel(dom, deps, `${debugFeatureGroupLabels[group]} reset`))))
    })
    groupHeader.appendChild(groupTitle)
    groupHeader.appendChild(resetGroupButton)
    section.appendChild(groupHeader)
    const rowsWrap = document.createElement('div')
    rowsWrap.setAttribute('role', 'group')
    rowsWrap.setAttribute('aria-label', debugFeatureGroupLabels[group])
    rowsWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px'
    for (const entry of entries) {
      const row = createToggleRow(entry, deps, getDom)
      rowsWrap.appendChild(row.row)
      toggleRows.push(row)
    }
    section.appendChild(rowsWrap)
    groupsContainer.appendChild(section)
    groupSections.push({ group, section })
  }

  const status = document.createElement('div')
  status.setAttribute('aria-live', 'polite')
  status.style.cssText = 'margin-top:8px;color:#cbd5e1;font-size:10px;min-height:14px'
  const statusText = document.createTextNode('F3 toggles are session-only')
  status.appendChild(statusText)
  const keyboardHint = document.createElement('div')
  keyboardHint.textContent = 'Tip: / or Ctrl+F searches, Enter/Space toggles, Esc leaves search.'
  keyboardHint.style.cssText = 'margin-top:4px;color:#64748b;font-size:10px'
  panel.appendChild(header)
  panel.appendChild(searchInput)
  panel.appendChild(groupsContainer)
  panel.appendChild(status)
  panel.appendChild(keyboardHint)

  return { panel, searchInput, enabledCountText, statusText, resetAllButton, toggleRows, groupSections }
}
