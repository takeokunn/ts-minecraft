// F3 debug overlay (FR-1.5). Runtime-toggled, distinct from URL-gated `?debug=perf` perf-hud.
// z-index 5500 — above perf-hud (5000), so F3 stays readable when both are active.
// Pre-allocated DOM text nodes (no innerHTML churn); 4 Hz daemon; acquireRelease lifecycle.
import { Cause, Duration, Effect, MutableRef, Schedule } from 'effect'
import type * as Scope from 'effect/Scope'

import type { BiomeService } from '@ts-minecraft/biome-classifier'
import type { ChunkManagerService } from '@ts-minecraft/chunk-manager'
import type { GameStateService } from '@ts-minecraft/game-session'
import type { TimeService } from '@ts-minecraft/day-night-cycle'
import type { PlayerCameraStateService } from '@ts-minecraft/camera-controller'
import type { FPSCounterService } from '@ts-minecraft/app/presentation/fps-counter'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'

// -----------------------------------------------------------------------------
// Facing direction conversion (vanilla format)
// -----------------------------------------------------------------------------

// Vanilla mapping (Three.js +Z = south): yaw≈0→south, ≈π/2→west, ≈±π→north, ≈-π/2→east. Normalized to (-π, π].
export const facingFromYaw = (yawRad: number): { name: string; axis: string } => {
  // Normalize to (-π, π].
  let y = yawRad % (2 * Math.PI)
  if (y > Math.PI) y -= 2 * Math.PI
  if (y <= -Math.PI) y += 2 * Math.PI

  const QUARTER = Math.PI / 4
  if (y >= -QUARTER && y < QUARTER) return { name: 'south', axis: 'Towards positive Z' }
  if (y >= QUARTER && y < 3 * QUARTER) return { name: 'west', axis: 'Towards negative X' }
  if (y >= -3 * QUARTER && y < -QUARTER) return { name: 'east', axis: 'Towards positive X' }
  return { name: 'north', axis: 'Towards negative Z' }
}

// -----------------------------------------------------------------------------
// Service dependencies (injected at attach() time)
// -----------------------------------------------------------------------------

export type DebugOverlayDeps = {
  readonly biomeService: BiomeService
  readonly chunkManager: ChunkManagerService
  readonly gameState: GameStateService
  readonly timeService: TimeService
  readonly cameraState: PlayerCameraStateService
  readonly fpsCounter: FPSCounterService
}

// -----------------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------------

export interface DebugOverlayInterface {
  // Idempotent: re-attach is a no-op (DOM scaffold already present). Daemon runs for lifetime of scope.
  readonly attach: (deps: DebugOverlayDeps) => Effect.Effect<void, never, Scope.Scope>
  readonly toggle: () => Effect.Effect<void, never>
  readonly show: () => Effect.Effect<void, never>
  readonly hide: () => Effect.Effect<void, never>
  readonly isVisible: () => Effect.Effect<boolean, never>
}

const DOM_UPDATE_INTERVAL_MS = 250 // 4 Hz

const formatNumber = (n: number, decimals: number): string =>
  Number.isFinite(n) ? n.toFixed(decimals) : '--'

export class DebugOverlayService extends Effect.Service<DebugOverlayService>()(
  '@minecraft/presentation/DebugOverlayService',
  {
    scoped: Effect.sync(() => {
      // -------------------------------------------------------------------
      // SSR-safe path — when `document` is undefined (vitest node env),
      // `attach` becomes a no-op so tests don't crash on DOM access.
      // -------------------------------------------------------------------
      const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined'

      const visibleRef = MutableRef.make(false)
      // Lazily initialised on first attach() — kept on a Ref-like Mutable so
      // the initial scoped construction stays cheap (no DOM allocation).
      type DomNodes = {
        readonly overlay: HTMLDivElement
        readonly textNodes: ReadonlyArray<Text>
      }
      const domRef = MutableRef.make<DomNodes | null>(null)

      const buildDom = (): DomNodes => {
        const overlay = document.createElement('div')
        overlay.id = 'debug-overlay'
        overlay.style.cssText = [
          'position: fixed',
          'top: 10px',
          'left: 10px',
          // Above perf-hud (z=5000) so F3 stays readable when both are visible.
          'z-index: 5500',
          'padding: 8px 10px',
          'background: rgba(0, 0, 0, 0.65)',
          'color: #ffffff',
          'font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          'font-size: 12px',
          'line-height: 1.35',
          'border-radius: 4px',
          'pointer-events: none',
          'user-select: none',
          'min-width: 220px',
          'white-space: pre',
          'display: none',
        ].join(';')

        // 6 lines: XYZ, Facing, Biome, FPS, Chunks, Time.
        const labels: ReadonlyArray<string> = [
          'XYZ:    ',
          'Facing: ',
          'Biome:  ',
          'FPS:    ',
          'Chunks: ',
          'Time:   ',
        ]
        const initialValues: ReadonlyArray<string> = ['--', '--', '--', '--', '--', '--']

        const nodes: Text[] = []
        for (let i = 0; i < labels.length; i++) {
          const line = document.createElement('div')
          line.appendChild(document.createTextNode(labels[i]!))
          const valueNode = document.createTextNode(initialValues[i]!)
          line.appendChild(valueNode)
          overlay.appendChild(line)
          nodes.push(valueNode)
        }
        document.body.appendChild(overlay)
        return { overlay, textNodes: nodes }
      }

      const applyVisibility = (visible: boolean): void => {
        const dom = MutableRef.get(domRef)
        if (dom === null) return
        dom.overlay.style.display = visible ? 'block' : 'none'
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

      // -------------------------------------------------------------------
      // attach(): mount DOM + register F3 listener + start update daemon.
      // Single-shot (idempotent) — repeat calls bail out early.
      // -------------------------------------------------------------------
      const attach = (deps: DebugOverlayDeps): Effect.Effect<void, never, Scope.Scope> =>
        Effect.gen(function* () {
          if (!hasDom) return
          if (MutableRef.get(domRef) !== null) return

          // Build DOM scaffold inside acquireRelease so scope teardown removes it.
          yield* Effect.acquireRelease(
            Effect.sync(() => {
              const dom = buildDom()
              MutableRef.set(domRef, dom)
              return dom
            }),
            (dom) => Effect.sync(() => {
              dom.overlay.remove()
              MutableRef.set(domRef, null)
            }),
          )

          // F3 keydown listener — toggles visibility. Captured as a separate
          // resource so its finalizer runs even if the daemon fork errors.
          const keyHandler = (event: KeyboardEvent): void => {
            if (event.key !== 'F3') return
            // Prevent the browser's default F3 (search) behavior.
            event.preventDefault()
            const next = !MutableRef.get(visibleRef)
            MutableRef.set(visibleRef, next)
            applyVisibility(next)
          }
          yield* Effect.acquireRelease(
            Effect.sync(() => {
              window.addEventListener('keydown', keyHandler)
            }),
            () => Effect.sync(() => {
              window.removeEventListener('keydown', keyHandler)
            }),
          )

          // 4 Hz update daemon — only does work when overlay is visible to keep
          // the cost zero in the default-hidden state. Runs on a forkDaemon so
          // it lives for the session scope (independent of caller's fiber).
          const updateOnce = Effect.gen(function* () {
            if (!MutableRef.get(visibleRef)) return
            const dom = MutableRef.get(domRef)
            if (dom === null) return

            const [position, rotation, fps, loadedChunks, timeOfDay] = yield* Effect.all(
              [
                deps.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
                  Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 })),
                ),
                deps.cameraState.getRotation(),
                deps.fpsCounter.getFPS(),
                deps.chunkManager.getLoadedChunks(),
                deps.timeService.getTimeOfDay(),
              ],
              { concurrency: 'unbounded' },
            )

            const biome = yield* deps.biomeService.getBiome(
              Math.floor(position.x),
              Math.floor(position.z),
            )

            const facing = facingFromYaw(rotation.yaw)

            // Pre-allocated text node mutations — no innerHTML / textContent.
            dom.textNodes[0]!.nodeValue = `${formatNumber(position.x, 1)} / ${formatNumber(position.y, 1)} / ${formatNumber(position.z, 1)}`
            dom.textNodes[1]!.nodeValue = `${facing.name} (${facing.axis})`
            dom.textNodes[2]!.nodeValue = biome
            dom.textNodes[3]!.nodeValue = formatNumber(fps, 1)
            dom.textNodes[4]!.nodeValue = String(loadedChunks.length)
            dom.textNodes[5]!.nodeValue = formatNumber(timeOfDay, 3)
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

      const impl: DebugOverlayInterface = {
        attach,
        toggle,
        show: () => setVisible(true),
        hide: () => setVisible(false),
        isVisible,
      }
      return impl
    }),
  },
) {}

export const DebugOverlayLive = DebugOverlayService.Default
