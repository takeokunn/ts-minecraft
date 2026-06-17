// F3 debug overlay (FR-1.5). Runtime-toggled, distinct from URL-gated `?debug=perf` perf-hud.
import { Cause, Duration, Effect, MutableRef, Schedule } from 'effect'
import type { DebugOverlayDeps, DebugOverlayDomNodes, DebugOverlayInterface } from '@ts-minecraft/presentation/hud/debug-overlay-types'
import { buildDebugOverlayDom } from '@ts-minecraft/presentation/hud/debug-overlay-dom'
import { resolveDebugOverlayMetrics } from '@ts-minecraft/presentation/hud/debug-overlay-metrics'
import { refreshTogglePanel } from '@ts-minecraft/presentation/hud/debug-overlay-panel'
import { DOM_UPDATE_INTERVAL_MS } from '@ts-minecraft/presentation/hud/debug-overlay-utils'

const updateMetrics = (dom: DebugOverlayDomNodes, deps: DebugOverlayDeps): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const metrics = yield* resolveDebugOverlayMetrics(deps)
    dom.textNodes[0]!.nodeValue = metrics.positionText
    dom.textNodes[1]!.nodeValue = metrics.facingText
    dom.textNodes[2]!.nodeValue = metrics.biomeText
    dom.textNodes[3]!.nodeValue = metrics.fpsText
    dom.textNodes[4]!.nodeValue = metrics.loadedChunksText
    dom.textNodes[5]!.nodeValue = metrics.timeOfDayText
  })

export const createDebugOverlayRuntime = (): DebugOverlayInterface => {
  const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined'
  const visibleRef = MutableRef.make(false)
  const domRef = MutableRef.make<DebugOverlayDomNodes | null>(null)

  const applyVisibility = (visible: boolean): void => {
    const dom = MutableRef.get(domRef)
    if (dom === null) return
    dom.overlay.style.display = visible ? 'grid' : 'none'
  }

  const setVisible = (next: boolean): Effect.Effect<void, never> =>
    Effect.sync(() => {
      MutableRef.set(visibleRef, next)
      applyVisibility(next)
    })

  const toggle = (): Effect.Effect<void, never> =>
    Effect.sync(() => {
      const next = !MutableRef.get(visibleRef)
      MutableRef.set(visibleRef, next)
      applyVisibility(next)
    })

  const isVisible = (): Effect.Effect<boolean, never> =>
    Effect.sync(() => MutableRef.get(visibleRef))

  const attach = (deps: DebugOverlayDeps) =>
    Effect.gen(function* () {
      if (!hasDom) return
      if (MutableRef.get(domRef) !== null) return

      const dom = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const nextDom = buildDebugOverlayDom(deps, () => MutableRef.get(domRef))
          MutableRef.set(domRef, nextDom)
          return nextDom
        }),
        (nextDom) => Effect.sync(() => {
          nextDom.overlay.remove()
          MutableRef.set(domRef, null)
        }),
      )

      yield* refreshTogglePanel(dom, deps)
      const keyHandler = (event: KeyboardEvent): void => {
        if (event.key === 'F3') {
          event.preventDefault()
          const next = !MutableRef.get(visibleRef)
          MutableRef.set(visibleRef, next)
          applyVisibility(next)
          return
        }
        if (!MutableRef.get(visibleRef)) return
        const activeDom = MutableRef.get(domRef)
        if (activeDom === null) return
        const wantsSearch = event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f')
        if (!wantsSearch) return
        event.preventDefault()
        activeDom.searchInput.focus()
        activeDom.searchInput.select()
      }
      yield* Effect.acquireRelease(
        Effect.sync(() => window.addEventListener('keydown', keyHandler)),
        () => Effect.sync(() => window.removeEventListener('keydown', keyHandler)),
      )

      const updateOnce = Effect.gen(function* () {
        if (!MutableRef.get(visibleRef)) return
        const activeDom = MutableRef.get(domRef)
        if (activeDom === null) return
        yield* updateMetrics(activeDom, deps)
      })

      yield* Effect.forkDaemon(
        Effect.repeat(
          updateOnce.pipe(
            Effect.catchAllCause((cause) =>
              Effect.logError(`debug-overlay daemon error: ${Cause.pretty(cause)}`),
            ),
          ),
          Schedule.spaced(Duration.millis(DOM_UPDATE_INTERVAL_MS)),
        ),
      )
    })

  return {
    attach,
    toggle,
    show: () => setVisible(true),
    hide: () => setVisible(false),
    isVisible,
  }
}
