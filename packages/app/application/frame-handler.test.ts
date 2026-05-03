import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, MutableRef, Option } from 'effect'
import {
  arrangeFrameHarness,
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// Orchestrator-level tests
//
// Per-stage tests live alongside their stage source under `src/frame/stages/`.
// This file keeps tests that exercise the full frame pipeline as a black box
// (cross-stage pause gating + nominal-frame integration smoke).
// ---------------------------------------------------------------------------

describe('frame-handler', () => {
  // -------------------------------------------------------------------------
  // Pause gate: camera update and block interaction (cross-stage integration)
  // -------------------------------------------------------------------------

  describe('pause gate', () => {
    it.effect('suppresses firstPersonCamera.update when gamePausedRef is true', () => Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness({ paused: true })
      const cameraUpdateSpy = vi.fn(() => Effect.void)
      // Override firstPersonCamera.update with spy
      ;(services.firstPersonCamera as { update: unknown }).update = cameraUpdateSpy

      yield* runFrame(deps, services)

      expect(cameraUpdateSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls firstPersonCamera.update when gamePausedRef is false', () => Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const cameraUpdateSpy = vi.fn(() => Effect.void)
      ;(services.firstPersonCamera as { update: unknown }).update = cameraUpdateSpy

      yield* runFrame(deps, services)

      expect(cameraUpdateSpy).toHaveBeenCalledOnce()
    }))

    it.effect('suppresses hotbarService.update when gamePausedRef is true', () => Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness({ paused: true })
      const hotbarUpdateSpy = vi.fn(() => Effect.void)
      ;(services.hotbarService as { update: unknown }).update = hotbarUpdateSpy

      yield* runFrame(deps, services)

      expect(hotbarUpdateSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls hotbarService.update when gamePausedRef is false', () => Effect.gen(function* () {
      const { deps, services } = yield* arrangeFrameHarness()
      const hotbarUpdateSpy = vi.fn(() => Effect.void)
      ;(services.hotbarService as { update: unknown }).update = hotbarUpdateSpy

      yield* runFrame(deps, services)

      expect(hotbarUpdateSpy).toHaveBeenCalledOnce()
    }))
  })

  // -------------------------------------------------------------------------
  // Frame completes without error for the nominal (unpaused, no keys) case
  // -------------------------------------------------------------------------

  describe('nominal frame execution', () => {
    it.effect('completes without error when no keys are pressed and game is not paused', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      // Should complete without error
      yield* runFrame(deps, services)
    }))

    it.effect('completes without error when game is paused', () => Effect.gen(function* () {
      const deps = yield* makeDeps(true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      yield* runFrame(deps, services)
    }))

    it.effect('skips physicsStage and uses initialPlayerPos when sessionPausedRef is true', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false)
      // Set the session-paused flag — simulates pause-menu open / quit-to-title in progress.
      MutableRef.set(deps.sessionPausedRef, true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      // gameState.update should NOT be called when session is paused (physics stage is skipped)
      const updateSpy = vi.fn(() => Effect.void)
      ;(services.gameState as { update: unknown }).update = updateSpy

      yield* runFrame(deps, services)

      // physicsStage calls gameState.update; it must be skipped when sessionPausedRef is true
      expect(updateSpy).not.toHaveBeenCalled()
    }))

    it.effect('calls renderer.render every frame when composer is absent', () => Effect.gen(function* () {
      const deps = yield* makeDeps(true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      yield* runFrame(deps, services)

      expect((deps.renderer as { render: ReturnType<typeof vi.fn> }).render).toHaveBeenCalledOnce()
    }))

    it.effect('calls composer.render every frame when composer is present', () => Effect.gen(function* () {
      const deps = yield* makeDeps(false, true)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })

      yield* runFrame(deps, services)

      const composer = Option.getOrNull(deps.composer)
      expect((composer as { render: ReturnType<typeof vi.fn> }).render).toHaveBeenCalledOnce()
      expect((deps.renderer as { render: ReturnType<typeof vi.fn> }).render).not.toHaveBeenCalled()
    }))
  })
})
