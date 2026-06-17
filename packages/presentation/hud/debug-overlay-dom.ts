import { Array as Arr, Effect } from 'effect'
import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
} from '@ts-minecraft/app/debug-feature-flags'
import type { DebugOverlayDeps, DebugOverlayDomNodes } from '@ts-minecraft/presentation/hud/debug-overlay-types'
import {
  buildTogglePanel,
  refreshTogglePanel,
  runPanelEffect,
} from '@ts-minecraft/presentation/hud/debug-overlay-panel'
import {
  applyDebugOverlayPanelState,
  resolveDebugOverlayPanelState,
} from '@ts-minecraft/presentation/hud/debug-overlay-panel-state'

const createMetricsPanel = (): { readonly metricsPanel: HTMLDivElement; readonly textNodes: ReadonlyArray<Text> } => {
  const metricsPanel = document.createElement('div')
  metricsPanel.style.cssText = [
    'padding: 8px 10px',
    'background: rgba(0, 0, 0, 0.65)',
    'border-radius: 4px',
    'pointer-events: none',
    'min-width: 220px',
    'white-space: pre',
  ].join(';')

  const labels: ReadonlyArray<string> = ['XYZ:    ', 'Facing: ', 'Biome:  ', 'FPS:    ', 'Chunks: ', 'Time:   ']
  const initialValues: ReadonlyArray<string> = ['--', '--', '--', '--', '--', '--']
  const textNodes = Arr.map(Arr.zip(labels, initialValues), ([label, initial]) => {
    const line = document.createElement('div')
    line.appendChild(document.createTextNode(label))
    const valueNode = document.createTextNode(initial)
    line.appendChild(valueNode)
    metricsPanel.appendChild(line)
    return valueNode
  })
  return { metricsPanel, textNodes }
}

const createOverlay = (): HTMLDivElement => {
  const overlay = document.createElement('div')
  overlay.id = 'debug-overlay'
  overlay.style.cssText = [
    'position: fixed',
    'top: 10px',
    'left: 10px',
    'z-index: 5500',
    'display: none',
    'grid-template-columns: 240px minmax(320px, 400px)',
    'gap: 8px',
    'align-items: start',
    'color: #ffffff',
    'font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    'font-size: 12px',
    'line-height: 1.35',
    'user-select: none',
  ].join(';')
  return overlay
}

export const buildDebugOverlayDom = (
  deps: DebugOverlayDeps,
  getDom: () => DebugOverlayDomNodes | null,
): DebugOverlayDomNodes => {
  const overlay = createOverlay()
  const { metricsPanel, textNodes } = createMetricsPanel()
  const panelNodes = buildTogglePanel(deps, getDom)
  overlay.appendChild(metricsPanel)
  overlay.appendChild(panelNodes.panel)

  const dom: DebugOverlayDomNodes = {
    overlay,
    metricsPanel,
    textNodes,
    ...panelNodes,
  }

  panelNodes.resetAllButton.addEventListener('click', () => {
    runPanelEffect(dom, Effect.gen(function* () {
      yield* deps.debugFeatureFlags.resetAll()
      yield* refreshTogglePanel(dom, deps, 'All debug toggles reset')
    }))
  })
  panelNodes.searchInput.addEventListener('input', () => {
    runPanelEffect(dom, refreshTogglePanel(dom, deps))
  })
  panelNodes.searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    panelNodes.searchInput.blur()
  })

  document.body.appendChild(overlay)
  applyDebugOverlayPanelState(
    dom,
    resolveDebugOverlayPanelState(
      { catalog: DEBUG_FEATURE_FLAG_CATALOG, flags: { ...DEBUG_FEATURE_FLAG_DEFAULTS } },
      '',
    ),
  )
  return dom
}
