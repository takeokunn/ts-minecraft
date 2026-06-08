import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, MutableRef, Option } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
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

  it.effect('ticks the hunger service each frame while alive', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.succeed('none' as const))
    ;(services.hungerService as { tick: unknown }).tick = spy

    yield* runFrame(deps, services)

    expect(spy).toHaveBeenCalledOnce()
  }))

  it.effect('does NOT accrue hunger exhaustion when the player is stationary', () => Effect.gen(function* () {
    // initialPlayerPos and the refreshed position both read the same static
    // mock ({0,64,0}), so distance moved is 0 → no exhaustion.
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.void)
    ;(services.hungerService as { addExhaustion: unknown }).addExhaustion = spy

    yield* runFrame(deps, services)

    expect(spy).not.toHaveBeenCalled()
  }))

  it.effect('heals 1 HP when the food tick reports "regen"', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hungerService as { tick: unknown }).tick = vi.fn(() => Effect.succeed('regen' as const))
    const healSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { heal: unknown }).heal = healSpy

    yield* runFrame(deps, services)

    expect(healSpy).toHaveBeenCalledWith(1)
  }))

  it.effect('applies 1 starvation damage when the food tick reports "starve"', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hungerService as { tick: unknown }).tick = vi.fn(() => Effect.succeed('starve' as const))
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    // Fall damage + hostile damage both default to 0, so the only applyDamage
    // call comes from starvation.
    expect(applyDamageSpy).toHaveBeenCalledWith(1)
  }))

  it.effect('writes the current foodLevel to the hunger HUD element', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const fakeEl = { textContent: '' } as unknown as HTMLElement
    ;(deps as { hungerValueElement: unknown }).hungerValueElement = Option.some(fakeEl)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hungerService as { getHunger: unknown }).getHunger = vi.fn(() =>
      Effect.succeed({ foodLevel: 17, saturation: 3, exhaustion: 0 })
    )

    yield* runFrame(deps, services)

    expect(fakeEl.textContent).toBe('17')
  }))

  it.effect('writes the total armor points to the armor HUD element', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const fakeEl = { textContent: '' } as unknown as HTMLElement
    ;(deps as { armorValueElement: unknown }).armorValueElement = Option.some(fakeEl)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.equipmentService as { getTotalArmorPoints: unknown }).getTotalArmorPoints = vi.fn(() =>
      Effect.succeed(11)
    )

    yield* runFrame(deps, services)

    expect(fakeEl.textContent).toBe('11')
  }))

  it.effect('writes the armor HUD at most once across two frames with the same value (change-gated)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    let writes = 0
    const fakeEl = {
      get textContent() { return '' },
      set textContent(_value: string) { writes += 1 },
    } as unknown as HTMLElement
    ;(deps as { armorValueElement: unknown }).armorValueElement = Option.some(fakeEl)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.equipmentService as { getTotalArmorPoints: unknown }).getTotalArmorPoints = vi.fn(() =>
      Effect.succeed(11)
    )

    // createFrameHandlers owns the cross-frame lastArmorRef, so build the handler
    // once and drive two frames through the same instance to exercise the gate.
    const { frameHandler } = yield* createFrameHandlers(deps, services)
    yield* frameHandler(0.016 as DeltaTimeSecs)
    yield* frameHandler(0.016 as DeltaTimeSecs)

    expect(writes).toBe(1)
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

  it.effect('mitigates hostile contact damage by the player\'s equipped armor (4%/point)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(3)
    )
    // 5 armor points → 20% reduction → 3 × 0.8 = 2.4
    ;(services.equipmentService as { getTotalArmorPoints: unknown }).getTotalArmorPoints = vi.fn(() =>
      Effect.succeed(5)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledTimes(1)
    expect(applyDamageSpy.mock.calls[0]?.[0]).toBeCloseTo(2.4)
  }))

  it.effect('deposits a resolved fishing catch into the inventory', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // The bobber resolves this frame, yielding a cooked cod.
    ;(services.fishingService as { tick: unknown }).tick = vi.fn(() =>
      Effect.succeed(Option.some('COOKED_COD'))
    )
    const addBlockSpy = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy

    yield* runFrame(deps, services)

    expect(addBlockSpy).toHaveBeenCalledWith('COOKED_COD', 1)
  }))

  it.effect('does NOT add anything when fishing is idle (tick returns none)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const addBlockSpy = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy

    yield* runFrame(deps, services)

    // Default mock tick returns Option.none() → no catch → no inventory write.
    expect(addBlockSpy).not.toHaveBeenCalled()
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

    // FR-1.3: in CREATIVE there is no death screen, so immediate auto-respawn
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
    expect(respawnSpy).toHaveBeenCalledWith(MutableRef.get(deps.respawnPositionRef))
  }))

  it.effect('skips getPlayerContactDamage when mobs.enabled debug flag is false', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    yield* services.debugFeatureFlags.setEnabled('mobs.enabled', false)
    const contactDamageSpy = vi.fn(() => Effect.succeed(0))
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = contactDamageSpy

    yield* runFrame(deps, services)

    expect(contactDamageSpy).not.toHaveBeenCalled()
  }))

  it.effect('accrues hunger exhaustion proportional to horizontal distance moved', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // runFrame calls maintenanceHandler() then frameHandler().
    // getPlayerPosition call order:
    //   1) maintenanceHandler (frame-maintenance) → initial pos (0,64,0)
    //   2) frameHandler initial position fetch → initial pos (0,64,0)
    //   3) physicsStage internal refresh → post-physics pos (3,64,4) → distance=5
    let posCallCount = 0
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() => {
      posCallCount++
      if (posCallCount < 3) return Effect.succeed({ x: 0, y: 64, z: 0 })
      return Effect.succeed({ x: 3, y: 64, z: 4 })
    })
    const addExhaustionSpy = vi.fn(() => Effect.void)
    ;(services.hungerService as { addExhaustion: unknown }).addExhaustion = addExhaustionSpy

    yield* runFrame(deps, services)

    expect(addExhaustionSpy).toHaveBeenCalledOnce()
    // distance=5, EXHAUSTION_SPRINT_PER_BLOCK=0.1 → 0.5
    expect(addExhaustionSpy.mock.calls[0]?.[0]).toBeCloseTo(0.5, 5)
  }))
})

// ---------------------------------------------------------------------------
// Nether portal travel detection (Phase 17)
// ---------------------------------------------------------------------------

// NETHER_PORTAL block index: player at (0,64,0) → lx=0, lz=0, y=64 → idx=64
const PORTAL_BLOCK_IDX = 64

const makePortalChunk = () => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks[PORTAL_BLOCK_IDX] = blockTypeToIndex('NETHER_PORTAL')
  return { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
}

describe('physics-stage — nether portal travel', () => {
  it.effect('player standing in NETHER_PORTAL for 4+ seconds triggers dimension travel', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Return a chunk with NETHER_PORTAL at player feet (0,64,0)
    const portalChunk = makePortalChunk()
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(portalChunk),
    )
    const setDimensionSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { setDimension: unknown }).setDimension = setDimensionSpy
    const respawnSpy = vi.fn(() => Effect.void)
    ;(services.gameState as { respawn: unknown }).respawn = respawnSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    // Run 5 frames × 1 second deltaTime = 5 seconds accumulated → exceeds PORTAL_ACTIVATION_SECS (4s)
    for (let i = 0; i < 5; i++) {
      yield* frameHandler(1.0 as DeltaTimeSecs)
    }

    expect(setDimensionSpy).toHaveBeenCalledOnce()
    expect(setDimensionSpy).toHaveBeenCalledWith('nether')
    expect(respawnSpy).toHaveBeenCalledOnce()
  }))

  it.effect('player NOT in NETHER_PORTAL does not trigger dimension travel', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const setDimensionSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { setDimension: unknown }).setDimension = setDimensionSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    for (let i = 0; i < 5; i++) {
      yield* frameHandler(1.0 as DeltaTimeSecs)
    }

    expect(setDimensionSpy).not.toHaveBeenCalled()
  }))

  it.effect('portal timer resets when player leaves the portal', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const portalChunk = makePortalChunk()
    const emptyChunk = { coord: { x: 0, z: 0 }, blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT), fluid: Option.none() }
    // frameNumber is set before each frameHandler call so the mock can distinguish frames
    // without counting getChunk invocations (entity-update-stage calls getChunk 9× per frame
    // for the surrounding 3×3 chunk grid, making call-count unreliable as a frame proxy).
    let frameNumber = 0
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(
      ({ x, z }: { x: number; z: number }) => {
        // Only the player's own chunk {0,0} can contain the portal block; surrounding chunks are empty.
        if (x !== 0 || z !== 0) return Effect.succeed(emptyChunk)
        // Frames 1-2: in portal; frames 3-4: out (timer reset); frames 5-6: in again.
        // Total in-portal time is 2s + 2s = 4s but non-continuous → timer never reaches 4s threshold.
        const inPortal = frameNumber <= 2 || frameNumber > 4
        return Effect.succeed(inPortal ? portalChunk : emptyChunk)
      },
    )
    const setDimensionSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { setDimension: unknown }).setDimension = setDimensionSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    // 2 frames (2s) in → 2 frames out (reset) → 2 frames (2s) in = total 4s but split → no teleport
    for (let i = 0; i < 6; i++) {
      frameNumber = i + 1
      yield* frameHandler(1.0 as DeltaTimeSecs)
    }

    expect(setDimensionSpy).not.toHaveBeenCalled()
  }))

  it.effect('builds an exit portal at the destination when no portal exists there', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const portalChunk = makePortalChunk()
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(portalChunk),
    )
    // No portals registered in nether → resolveNetherTravel returns portalToCreate=Some
    const forceSetBlockSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { forceSetBlock: unknown }).forceSetBlock = forceSetBlockSpy
    const registerPortalSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { registerPortal: unknown }).registerPortal = registerPortalSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    for (let i = 0; i < 5; i++) {
      yield* frameHandler(1.0 as DeltaTimeSecs)
    }

    // The auto-generated portal is 4 wide (2+2 frame cols) × 5 tall (3+2 frame rows)
    // = frame: 20 obsidian positions + interior: 2×3=6 NETHER_PORTAL positions
    expect(forceSetBlockSpy.mock.calls.some(([, type]) => type === 'OBSIDIAN')).toBe(true)
    expect(forceSetBlockSpy.mock.calls.some(([, type]) => type === 'NETHER_PORTAL')).toBe(true)
    expect(registerPortalSpy).toHaveBeenCalledOnce()
  }))

  it.effect('player in nether standing in NETHER_PORTAL for 4+ seconds returns to overworld', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const portalChunk = makePortalChunk()
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(portalChunk),
    )
    // Player is in the nether — getDimension returns 'nether'
    ;(services.netherService as { getDimension: unknown }).getDimension = vi.fn(() =>
      Effect.succeed('nether' as const),
    )
    const setDimensionSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { setDimension: unknown }).setDimension = setDimensionSpy
    const respawnSpy = vi.fn(() => Effect.void)
    ;(services.gameState as { respawn: unknown }).respawn = respawnSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    for (let i = 0; i < 5; i++) {
      yield* frameHandler(1.0 as DeltaTimeSecs)
    }

    expect(setDimensionSpy).toHaveBeenCalledOnce()
    expect(setDimensionSpy).toHaveBeenCalledWith('overworld')
    expect(respawnSpy).toHaveBeenCalledOnce()
  }))

  it.effect('chunk not loaded (Option.none) is treated as non-portal (onNone: () => false)', () => Effect.gen(function* () {
    // getChunk fails → Effect.option wraps it as Option.none → inPortal = false → no dimension change.
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.fail(new Error('chunk not loaded')),
    )
    const setDimensionSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { setDimension: unknown }).setDimension = setDimensionSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    for (let i = 0; i < 5; i++) {
      yield* frameHandler(1.0 as DeltaTimeSecs)
    }

    expect(setDimensionSpy).not.toHaveBeenCalled()
  }))

  it.effect('reuses existing portal at destination (portalToCreate = none) without building a new frame', () => Effect.gen(function* () {
    // getPortals returns a portal position at (0,64,0) in nether (the scaled destination
    // from overworld (0,64,0) → nether (0,64,0)). findNearestPortal finds it within
    // PORTAL_SEARCH_RADIUS=128 → resolveNetherTravel returns portalToCreate=Option.none()
    // → the onNone (() => Effect.void) branch is taken, forceSetBlock is NOT called.
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const portalChunk = makePortalChunk()
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(portalChunk),
    )
    // Return a portal at the exact nether destination so resolveNetherTravel reuses it
    ;(services.netherService as { getPortals: unknown }).getPortals = vi.fn(() =>
      Effect.succeed([{ x: 0, y: 64, z: 0 }] as const),
    )
    const forceSetBlockSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { forceSetBlock: unknown }).forceSetBlock = forceSetBlockSpy
    const setDimensionSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { setDimension: unknown }).setDimension = setDimensionSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    for (let i = 0; i < 5; i++) {
      yield* frameHandler(1.0 as DeltaTimeSecs)
    }

    expect(setDimensionSpy).toHaveBeenCalledOnce()
    // No portal frame blocks placed — existing portal reused
    expect(forceSetBlockSpy).not.toHaveBeenCalled()
  }))

  it.effect('player standing on END_PORTAL triggers instant travel to The End and spawns EnderDragon', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Replace portal block with END_PORTAL at player position (index 64 = y=64, x=0, z=0)
    const endPortalChunk = makePortalChunk()
    endPortalChunk.blocks[PORTAL_BLOCK_IDX] = blockTypeToIndex('END_PORTAL')
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(endPortalChunk),
    )
    // Currently in overworld, so standing on END_PORTAL takes us to 'end'
    ;(services.netherService as { getDimension: unknown }).getDimension = vi.fn(() =>
      Effect.succeed('overworld' as const),
    )
    const setDimensionSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { setDimension: unknown }).setDimension = setDimensionSpy
    const setActiveDimensionSpy = vi.fn(() => Effect.void)
    ;(services.chunkManagerService as unknown as { setActiveDimension: unknown }).setActiveDimension = setActiveDimensionSpy
    const respawnSpy = vi.fn(() => Effect.void)
    ;(services.gameState as { respawn: unknown }).respawn = respawnSpy
    const addEntitySpy = vi.fn(() => Effect.void)
    ;(services.entityManager as unknown as { addEntity: unknown }).addEntity = addEntitySpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    // END_PORTAL is instant — a single frame is enough
    yield* frameHandler(0.016 as DeltaTimeSecs)

    expect(setDimensionSpy).toHaveBeenCalledWith('end')
    expect(setActiveDimensionSpy).toHaveBeenCalledWith('end')
    expect(respawnSpy).toHaveBeenCalledOnce()
    // EnderDragon should be spawned when entering The End
    expect(addEntitySpy).toHaveBeenCalledWith('EnderDragon', { x: 0, y: 80, z: 20 })
  }))

  it.effect('player standing on END_PORTAL in The End returns to overworld', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const endPortalChunk = makePortalChunk()
    endPortalChunk.blocks[PORTAL_BLOCK_IDX] = blockTypeToIndex('END_PORTAL')
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(endPortalChunk),
    )
    // Currently in The End → standing on END_PORTAL returns to overworld
    ;(services.netherService as { getDimension: unknown }).getDimension = vi.fn(() =>
      Effect.succeed('end' as const),
    )
    const setDimensionSpy = vi.fn(() => Effect.void)
    ;(services.netherService as { setDimension: unknown }).setDimension = setDimensionSpy
    const respawnSpy = vi.fn(() => Effect.void)
    ;(services.gameState as { respawn: unknown }).respawn = respawnSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.016 as DeltaTimeSecs)

    expect(setDimensionSpy).toHaveBeenCalledWith('overworld')
    expect(respawnSpy).toHaveBeenCalledOnce()
  }))
})
