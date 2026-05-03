import { describe, expect, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import {
  makeDeps,
  makeInputService,
  makeInventoryRenderer,
  makeServices,
  makeSettingsOverlay,
  runFrame,
} from '@test/frame-handler-test-kit'

// ---------------------------------------------------------------------------
// Step 3.5: Fall damage
// ---------------------------------------------------------------------------

describe('step 3.5 — fall damage', () => {
  it.effect('calls healthService.processFallDamage each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.succeed(0))
    ;(services.healthService as { processFallDamage: unknown }).processFallDamage = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('calls healthService.applyDamage when processFallDamage returns > 0', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.healthService as { processFallDamage: unknown }).processFallDamage = vi.fn(() =>
      Effect.succeed(5)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledOnce()
    expect(applyDamageSpy).toHaveBeenCalledWith(5)
  }))

  it.effect('does NOT call healthService.applyDamage when processFallDamage returns 0', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.healthService as { processFallDamage: unknown }).processFallDamage = vi.fn(() =>
      Effect.succeed(0)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).not.toHaveBeenCalled()
  }))

  it.effect('calls healthService.tick each frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.healthService as { tick: unknown }).tick = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('applies hostile contact damage when the entity manager reports an attacker in range', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(3)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith(3)
  }))

  it.effect('does NOT apply fall damage when player has invincibilityTicks > 0', () => Effect.gen(function* () {
    // Guard: tryApplyPlayerDamage bails early when invincibilityTicks > 0.
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Fall damage would be applied
    ;(services.healthService as { processFallDamage: unknown }).processFallDamage = vi.fn(() =>
      Effect.succeed(5)
    )
    // But the player is currently invincible
    ;(services.healthService as { getHealth: unknown }).getHealth = vi.fn(() =>
      Effect.succeed({ current: 15, max: 20, invincibilityTicks: 10 })
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    // applyDamage must NOT be called because invincibilityTicks > 0
    expect(applyDamageSpy).not.toHaveBeenCalled()
  }))

  // FR-1.3: in SURVIVAL the death-screen overlay owns respawn; the frame
  // handler must NOT auto-respawn (would race the overlay and flicker).
  it.effect('does NOT auto-respawn the player on death in survival mode (death screen owns respawn)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.healthService as { isDead: unknown }).isDead = vi.fn(() => Effect.succeed(true))
    // Default test-kit gameMode is survival (isCreative -> false).
    const resetSpy = vi.fn(() => Effect.void)
    const respawnSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { reset: unknown }).reset = resetSpy
    ;(services.gameState as { respawn: unknown }).respawn = respawnSpy

    yield* runFrame(deps, services)

    expect(resetSpy).not.toHaveBeenCalled()
    expect(respawnSpy).not.toHaveBeenCalled()
  }))

  // FR-1.3: in CREATIVE there is no death screen, so the legacy auto-respawn
  // path runs (resets health, repositions to respawnPosition).
  it.effect('auto-respawns the player on death in creative mode', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.healthService as { isDead: unknown }).isDead = vi.fn(() => Effect.succeed(true))
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(true))
    const resetSpy = vi.fn(() => Effect.void)
    const respawnSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { reset: unknown }).reset = resetSpy
    ;(services.gameState as { respawn: unknown }).respawn = respawnSpy

    yield* runFrame(deps, services)

    expect(resetSpy).toHaveBeenCalledOnce()
    expect(respawnSpy).toHaveBeenCalledOnce()
    expect(respawnSpy).toHaveBeenCalledWith(deps.respawnPosition)
  }))
})
