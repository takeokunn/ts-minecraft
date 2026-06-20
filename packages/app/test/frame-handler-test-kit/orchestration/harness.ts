import { Effect, MutableHashSet } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app/frame-handler'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { makeClickInputService, makeInputService, makeMouseDownInputService } from '../presentation/input'
import { makeInventoryRenderer, makeSettingsOverlay } from '../presentation/overlay'
import { makeServices } from '../services'
import { makeDeps } from './deps'

/** Runs one maintenance pass followed by one frame-handler pass. */
export const runFrame = (deps: FrameHandlerDeps, services: FrameHandlerServices): Effect.Effect<void> =>
  Effect.gen(function* () {
    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler().pipe(Effect.andThen(frameHandler(0.016 as DeltaTimeSecs)))
  })

export type FrameHarnessOptions = {
  readonly paused?: boolean
  readonly inventoryOpen?: boolean
  readonly settingsOpen?: boolean
  readonly withComposer?: boolean
  readonly pressedKeys?: MutableHashSet.MutableHashSet<string>
  /** Simulate a single mouse-button click (0 = left, 2 = right). */
  readonly mouseClick?: number
  /** Simulate a mouse button held down (0 = left). */
  readonly mouseDown?: number
}

/** Arranges a complete frame-handler test harness with mutable overlay states. */
export const arrangeFrameHarness = ({
  paused = false,
  inventoryOpen = false,
  settingsOpen = false,
  withComposer = false,
  pressedKeys = MutableHashSet.empty<string>(),
  mouseClick,
  mouseDown,
}: FrameHarnessOptions = {}) =>
  Effect.gen(function* () {
    const inventoryState = { open: inventoryOpen }
    const settingsState = { open: settingsOpen }
    const deps = yield* makeDeps(paused, withComposer)

    const inputService =
      mouseClick !== undefined ? makeClickInputService(mouseClick, pressedKeys)
      : mouseDown !== undefined ? makeMouseDownInputService(mouseDown, pressedKeys)
      : makeInputService(pressedKeys)

    const services = makeServices({
      inputService,
      inventoryRenderer: makeInventoryRenderer(inventoryState),
      settingsOverlay: makeSettingsOverlay(settingsState),
    })

    return {
      deps,
      services,
      inventoryState,
      settingsState,
    }
  })
