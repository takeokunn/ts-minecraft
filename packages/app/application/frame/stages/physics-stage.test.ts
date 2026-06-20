import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect, HashMap, MutableHashSet, MutableRef, Option, Ref } from 'effect'
import { createFrameHandlers } from '@ts-minecraft/app/frame-handler'
import { DEBUG_FEATURE_FLAG_DEFAULTS } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex } from '@ts-minecraft/core'
import { SlotIndex } from '@ts-minecraft/core'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { BlockType } from '@ts-minecraft/core'
import type { SoundEffect } from '@ts-minecraft/game'
import { computeExplosionDamageAt } from '@ts-minecraft/entity/domain/explosion-resolution'
import { DEFAULT_SETTINGS } from '../../../test/frame-handler-test-kit/shared'
import { makeDeps } from '../../../test/frame-handler-test-kit/orchestration/deps'
import { runFrame } from '../../../test/frame-handler-test-kit/orchestration/harness'
import { makeInputService } from '../../../test/frame-handler-test-kit/presentation/input'
import {
  makeInventoryRenderer,
  makeSettingsOverlay,
} from '../../../test/frame-handler-test-kit/presentation/overlay'
import { makeServices } from '../../../test/frame-handler-test-kit/services'
import { physicsStage } from './physics-stage'
import { selectedHotbarSlotIndex } from './selected-hotbar-slot'

type ColumnBlockType = Parameters<typeof blockTypeToIndex>[0]
type PhysicsStageRefsForTest = Parameters<typeof physicsStage>[2]

const makePhysicsStageRefs = (): Effect.Effect<PhysicsStageRefsForTest, never> =>
  Effect.gen(function* () {
    return {
      lastHealthRef: MutableRef.make({ current: -1, max: -1 }),
      lastHungerRef: MutableRef.make({ foodLevel: -1, max: -1 }),
      lastXPRef: MutableRef.make({ level: -1, xpIntoLevel: -1, xpRequiredForNext: -1 }),
      lastArmorRef: MutableRef.make({ armorPoints: -1 }),
      portalSecsRef: yield* Ref.make(0),
      dirtyChunksRef: MutableRef.make(HashMap.empty<string, unknown>()) as PhysicsStageRefsForTest['dirtyChunksRef'],
      lavaDamageSecsRef: MutableRef.make(0),
      lavaBurnRemainingSecsRef: MutableRef.make(0),
      lavaBurnDamageSecsRef: MutableRef.make(0),
      airSecsRef: MutableRef.make(15),
      drownDamageSecsRef: MutableRef.make(0),
      suffocationDamageSecsRef: MutableRef.make(0),
      lightningDamageSecsRef: MutableRef.make(0),
      voidDamageSecsRef: MutableRef.make(0),
      lastAirBubblesRef: MutableRef.make(-1),
      isShieldBlockingRef: MutableRef.make(false),
      wasGroundedRef: MutableRef.make(true),
      footstepDistanceAccumulatorRef: MutableRef.make(0),
      finalPosRef: yield* Ref.make({ x: 0, y: 0, z: 0 }),
      healthTickAccumulatorRef: MutableRef.make(0),
      hungerTickAccumulatorRef: MutableRef.make(0),
      entityPhysicsChunkCacheRef: yield* Ref.make([null, null, null, null, null, null, null, null, null]),
      lastEntityPhysicsChunkCoordRef: yield* Ref.make({ cx: Number.NaN, cz: Number.NaN }),
    } as unknown as PhysicsStageRefsForTest
  })

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

  it.effect('reduces fall damage with Feather Falling boots', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.healthService as { processFallDamage: unknown }).processFallDamage = vi.fn(() =>
      Effect.succeed(10)
    )
    ;(services.equipmentService as { getEquippedItem: unknown }).getEquippedItem = vi.fn((slot: string) =>
      Effect.succeed(slot === 'BOOTS'
        ? Option.some({
            itemType: 'IRON_BOOTS',
            count: 1,
            enchantments: [{ type: 'FEATHER_FALLING', level: 4 }],
          })
        : Option.none())
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith(5.2)
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

  it.effect('does NOT apply fall damage in creative mode', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameMode as { isCreative: unknown }).isCreative = vi.fn(() => Effect.succeed(true))
    const processFallDamageSpy = vi.fn(() => Effect.succeed(5))
    ;(services.healthService as { processFallDamage: unknown }).processFallDamage = processFallDamageSpy
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* runFrame(deps, services)

    expect(processFallDamageSpy).toHaveBeenCalledOnce()
    expect(applyDamageSpy).not.toHaveBeenCalled()
    expect(playEffectSpy).not.toHaveBeenCalledWith('playerHurt', expect.anything())
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

  it.effect('ticks the hunger service once per game-tick (20Hz), not once per render frame', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const spy = vi.fn(() => Effect.succeed('none' as const))
    ;(services.hungerService as { tick: unknown }).tick = spy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    // Three sub-tick frames (3 × 0.016 = 0.048 < 0.05) → not yet a game-tick → no hunger tick.
    yield* frameHandler(0.016 as DeltaTimeSecs)
    yield* frameHandler(0.016 as DeltaTimeSecs)
    yield* frameHandler(0.016 as DeltaTimeSecs)
    expect(spy).not.toHaveBeenCalled()
    // The next frame crosses the 0.05s game-tick boundary → exactly one hunger tick.
    yield* frameHandler(0.016 as DeltaTimeSecs)
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

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.05 as DeltaTimeSecs) // one 20Hz game-tick fires the food tick

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

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.05 as DeltaTimeSecs) // one 20Hz game-tick fires the food tick

    // Fall damage + hostile damage both default to 0, so the only applyDamage
    // call comes from starvation.
    expect(applyDamageSpy).toHaveBeenCalledWith(1)
  }))

  it.effect('does not starve below half health on easy difficulty', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.settingsService, {
      getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, difficulty: 'easy' as const })),
    })
    ;(services.hungerService as { tick: unknown }).tick = vi.fn(() => Effect.succeed('starve' as const))
    ;(services.healthService as { getHealth: unknown }).getHealth = vi.fn(() =>
      Effect.succeed({ current: 10, max: 20, invincibilityTicks: 0 })
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.05 as DeltaTimeSecs)

    expect(applyDamageSpy).not.toHaveBeenCalled()
  }))

  it.effect('allows starvation to damage at one health on hard difficulty', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.settingsService, {
      getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, difficulty: 'hard' as const })),
    })
    ;(services.hungerService as { tick: unknown }).tick = vi.fn(() => Effect.succeed('starve' as const))
    ;(services.healthService as { getHealth: unknown }).getHealth = vi.fn(() =>
      Effect.succeed({ current: 1, max: 20, invincibilityTicks: 0 })
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.05 as DeltaTimeSecs)

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

  it.effect('updates pixel HUD icon fill states from the current health', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const iconSpies = Array.from({ length: 10 }, () => vi.fn())
    const container = {
      querySelectorAll: vi.fn(() => iconSpies.map((setAttribute) => ({ setAttribute }))),
    }
    const fakeEl = {
      textContent: '',
      closest: vi.fn(() => container),
    } as unknown as HTMLElement
    ;(deps as { healthValueElement: unknown }).healthValueElement = Option.some(fakeEl)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.healthService as { getHealth: unknown }).getHealth = vi.fn(() =>
      Effect.succeed({ current: 9, max: 20, invincibilityTicks: 0 })
    )

    yield* runFrame(deps, services)

    expect(iconSpies[0]).toHaveBeenCalledWith('data-fill', 'full')
    expect(iconSpies[3]).toHaveBeenCalledWith('data-fill', 'full')
    expect(iconSpies[4]).toHaveBeenCalledWith('data-fill', 'half')
    expect(iconSpies[5]).toHaveBeenCalledWith('data-fill', 'empty')
  }))

  it.effect('leaves health icon fill unchanged when the max health is zero', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const setAttributeSpy = vi.fn()
    const container = {
      querySelectorAll: vi.fn(() => [{ setAttribute: setAttributeSpy }]),
    }
    const fakeEl = {
      textContent: '',
      closest: vi.fn(() => container),
    } as unknown as HTMLElement
    ;(deps as { healthValueElement: unknown }).healthValueElement = Option.some(fakeEl)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.healthService as { getHealth: unknown }).getHealth = vi.fn(() =>
      Effect.succeed({ current: 0, max: 0, invincibilityTicks: 0 })
    )

    yield* runFrame(deps, services)

    expect(container.querySelectorAll).toHaveBeenCalledWith('[data-hud-icon]')
    expect(setAttributeSpy).not.toHaveBeenCalled()
  }))

  it.effect('updates the XP bar fill width from XP progress', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const fillElement = { style: { width: '' } }
    const container = {
      querySelector: vi.fn(() => fillElement),
    }
    const fakeEl = {
      textContent: '',
      closest: vi.fn(() => container),
    } as unknown as HTMLElement
    ;(deps as { xpBarElement: unknown }).xpBarElement = Option.some(fakeEl)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.xpService as { getXP: unknown }).getXP = vi.fn(() =>
      Effect.succeed({ level: 2, totalXP: 23, xpIntoLevel: 5, xpRequiredForNext: 10 })
    )

    yield* runFrame(deps, services)

    expect(fillElement.style.width).toBe('50%')
  }))

  it.effect('skips the XP bar fill when the fill node is absent', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const container = {
      querySelector: vi.fn(() => null),
    }
    const fakeEl = {
      textContent: '',
      closest: vi.fn(() => container),
    } as unknown as HTMLElement
    ;(deps as { xpBarElement: unknown }).xpBarElement = Option.some(fakeEl)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.xpService as { getXP: unknown }).getXP = vi.fn(() =>
      Effect.succeed({ level: 2, totalXP: 23, xpIntoLevel: 5, xpRequiredForNext: 10 })
    )

    yield* runFrame(deps, services)

    expect(container.querySelector).toHaveBeenCalledWith('#xp-progress-fill')
  }))

  it.effect('sets the XP bar fill to zero when no next-level requirement exists', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const fillElement = { style: { width: '' } }
    const container = {
      querySelector: vi.fn(() => fillElement),
    }
    const fakeEl = {
      textContent: '',
      closest: vi.fn(() => container),
    } as unknown as HTMLElement
    ;(deps as { xpBarElement: unknown }).xpBarElement = Option.some(fakeEl)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.xpService as { getXP: unknown }).getXP = vi.fn(() =>
      Effect.succeed({ level: 1, totalXP: 23, xpIntoLevel: 5, xpRequiredForNext: 0 })
    )

    yield* runFrame(deps, services)

    expect(fillElement.style.width).toBe('0%')
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

  it.effect('applies hostile ranged damage when the entity manager reports a shot', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.entityManager as { getPlayerRangedDamage: unknown }).getPlayerRangedDamage = vi.fn(() =>
      Effect.succeed(2)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith(2)
  }))

  it.effect('mitigates hostile ranged damage with Projectile Protection', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(0)
    )
    ;(services.entityManager as { getPlayerRangedDamage: unknown }).getPlayerRangedDamage = vi.fn(() =>
      Effect.succeed(10)
    )
    ;(services.equipmentService as { getTotalProjectileProtectionReduction: unknown }).getTotalProjectileProtectionReduction = vi.fn(() =>
      Effect.succeed(0.32)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledTimes(1)
    expect(applyDamageSpy.mock.calls[0]?.[0]).toBeCloseTo(6.8)
  }))

  it.effect('breaks blocks from drained creeper explosions', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const center = { x: 2, y: 64, z: 3 }
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(0)
    )
    ;(services.entityManager as { drainExplosions: unknown }).drainExplosions = vi.fn(() =>
      Effect.succeed([{ source: 'creeper' as const, position: center, power: 3 }])
    )
    const forceSetBlockSpy = vi.fn(() => Effect.void)
    ;(services.blockService as { forceSetBlock: unknown }).forceSetBlock = forceSetBlockSpy
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* runFrame(deps, services)

    const airCalls = forceSetBlockSpy.mock.calls.filter((call: readonly unknown[]) => call[1] === 'AIR')
    expect(airCalls.length).toBeGreaterThan(1)
    expect(airCalls.some((call: readonly unknown[]) => {
      const pos = call[0] as { readonly x: number; readonly y: number; readonly z: number }
      return pos.x === center.x && pos.y === center.y && pos.z === center.z
    })).toBe(true)
    expect(playEffectSpy).toHaveBeenCalledWith('blockBreak', { position: center })
  }))

  it.effect('classifies creeper explosion damage for Blast Protection without double-counting', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const center = { x: 0, y: 64, z: 0 }
    const rawDamage = computeExplosionDamageAt(center, 3, center)
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(rawDamage)
    )
    ;(services.entityManager as { getPlayerRangedDamage: unknown }).getPlayerRangedDamage = vi.fn(() =>
      Effect.succeed(0)
    )
    ;(services.entityManager as { drainExplosions: unknown }).drainExplosions = vi.fn(() =>
      Effect.succeed([{ source: 'creeper' as const, position: center, power: 3 }])
    )
    ;(services.equipmentService as { getTotalBlastProtectionReduction: unknown }).getTotalBlastProtectionReduction = vi.fn(() =>
      Effect.succeed(0.32)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledTimes(1)
    expect(applyDamageSpy.mock.calls[0]?.[0]).toBeCloseTo(rawDamage * 0.68)
  }))

  it.effect('passes cached solid blocks as the hostile ranged projectile blocker', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    blocks[64 + CHUNK_HEIGHT * CHUNK_SIZE] = blockTypeToIndex('STONE')
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn((coord: { readonly x: number; readonly z: number }) =>
      Effect.succeed({ coord, blocks })
    )
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(0)
    )
    const rangedDamageSpy = vi.fn((
      _playerPos: { readonly x: number; readonly y: number; readonly z: number },
      isProjectileBlocked?: (position: { readonly x: number; readonly y: number; readonly z: number }) => boolean,
    ) => Effect.succeed(isProjectileBlocked?.({ x: 1, y: 64, z: 0 }) === true ? 2 : 0))
    ;(services.entityManager as { getPlayerRangedDamage: unknown }).getPlayerRangedDamage = rangedDamageSpy
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(rangedDamageSpy.mock.calls[0]?.[1]).toEqual(expect.any(Function))
    expect(applyDamageSpy).toHaveBeenCalledWith(2)
  }))

  it.effect('uses player chunk coordinates for hostile projectile blocking before cache coordinates are finite', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const refs = yield* makePhysicsStageRefs()
    const playerPos = { x: CHUNK_SIZE + 1, y: 64, z: CHUNK_SIZE + 1 }
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    blocks[64 + CHUNK_HEIGHT * (1 + CHUNK_SIZE)] = blockTypeToIndex('STONE')
    yield* Ref.set(refs.entityPhysicsChunkCacheRef, [
      null,
      null,
      null,
      null,
      { coord: { x: 1, z: 1 }, blocks, fluid: Option.none() },
      null,
      null,
      null,
      null,
    ])
    ;(services.gameState as { update: unknown }).update = vi.fn(() => Effect.void)
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() =>
      Effect.succeed(playerPos)
    )
    ;(services.healthService as { processFallDamage: unknown }).processFallDamage = vi.fn(() =>
      Effect.succeed(0)
    )
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(0)
    )
    ;(services.entityManager as { drainExplosions: unknown }).drainExplosions = vi.fn(() =>
      Effect.succeed([])
    )
    let blockerResult: boolean | undefined
    const rangedDamageSpy = vi.fn((
      _playerPos: { readonly x: number; readonly y: number; readonly z: number },
      isProjectileBlocked?: (position: { readonly x: number; readonly y: number; readonly z: number }) => boolean,
    ) => {
      blockerResult = isProjectileBlocked?.(playerPos)
      return Effect.succeed(0)
    })
    ;(services.entityManager as { getPlayerRangedDamage: unknown }).getPlayerRangedDamage = rangedDamageSpy

    yield* physicsStage(deps, services, refs, {
      deltaTime: 0.016 as DeltaTimeSecs,
      initialPlayerPos: playerPos,
      healthValueElementOrNull: null,
      healthMaxElementOrNull: null,
      hungerValueElementOrNull: null,
      hungerMaxElementOrNull: null,
      xpLevelElementOrNull: null,
      xpBarElementOrNull: null,
      xpBarMaxElementOrNull: null,
      armorValueElementOrNull: null,
      airElementOrNull: null,
      debugFlags: DEBUG_FEATURE_FLAG_DEFAULTS,
      difficulty: DEFAULT_SETTINGS.difficulty,
    })

    expect(rangedDamageSpy.mock.calls[0]?.[1]).toEqual(expect.any(Function))
    expect(blockerResult).toBe(true)
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

  it.effect('shield blocking reduces hostile contact damage by 66% (effective on frame N+1 after input)', () => Effect.gen(function* () {
    // physicsStage runs before interactionStage in the pipeline, so the shield state
    // set by interactionStage on frame N takes effect in physicsStage on frame N+1.
    // Two frames are required: frame 1 sets blocking state, frame 2 applies reduction.
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // Simulate holding right-mouse with SHIELD to activate blocking state.
    ;(services.inputService as { isMouseDown: unknown }).isMouseDown = vi.fn((btn: number) =>
      Effect.succeed(btn === 2)
    )
    ;(services.hotbarService as { getSelectedBlockType: unknown }).getSelectedBlockType = vi.fn(() =>
      Effect.succeed({ _tag: 'Some' as const, value: 'SHIELD' })
    )
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(10)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    // Frame 1: interactionStage runs → sets isShieldBlockingRef = true.
    // physicsStage (runs before interaction) still sees the old false state this frame.
    // Two frames share the same handler so isShieldBlockingRef persists between frames.
    const { frameHandler } = yield* createFrameHandlers(deps, services)
    yield* frameHandler(0.016 as DeltaTimeSecs)
    applyDamageSpy.mockClear()

    // Frame 2: physicsStage now reads isShieldBlockingRef = true → 66% reduction.
    yield* frameHandler(0.016 as DeltaTimeSecs)

    // 10 damage × 0.34 (66% reduction) = 3.4
    expect(applyDamageSpy).toHaveBeenCalledTimes(1)
    expect(applyDamageSpy.mock.calls[0]?.[0]).toBeCloseTo(3.4)
  }))

  it.effect('shield NOT held: full hostile damage applies', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(10)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith(10)
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
      Effect.succeed(Option.some({ item: 'COOKED_COD', experience: 5 }))
    )
    const addBlockSpy = vi.fn(() => Effect.succeed(true))
    ;(services.inventoryService as { addBlock: unknown }).addBlock = addBlockSpy
    const damageSlotSpy = vi.fn(() => Effect.void)
    ;(services.inventoryService as { damageSlot: unknown }).damageSlot = damageSlotSpy
    const selectedSlot = SlotIndex.make(2)
    ;(services.hotbarService as { getSelectedSlot: unknown }).getSelectedSlot = vi.fn(() =>
      Effect.succeed(selectedSlot)
    )
    const addXPSpy = vi.fn(() => Effect.void)
    ;(services.xpService as { addXP: unknown }).addXP = addXPSpy

    yield* runFrame(deps, services)

    expect(addBlockSpy).toHaveBeenCalledWith('COOKED_COD', 1)
    expect(damageSlotSpy).toHaveBeenCalledWith(selectedHotbarSlotIndex(selectedSlot), 1)
    expect(addXPSpy).toHaveBeenCalledWith(5)
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

  it.effect('skips hostile damage queries when mobs.enabled debug flag is false', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    yield* services.debugFeatureFlags.setEnabled('mobs.enabled', false)
    const contactDamageSpy = vi.fn(() => Effect.succeed(0))
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = contactDamageSpy
    const rangedDamageSpy = vi.fn(() => Effect.succeed(0))
    ;(services.entityManager as { getPlayerRangedDamage: unknown }).getPlayerRangedDamage = rangedDamageSpy
    const drainExplosionsSpy = vi.fn(() => Effect.succeed([]))
    ;(services.entityManager as { drainExplosions: unknown }).drainExplosions = drainExplosionsSpy

    yield* runFrame(deps, services)

    expect(contactDamageSpy).not.toHaveBeenCalled()
    expect(rangedDamageSpy).not.toHaveBeenCalled()
    expect(drainExplosionsSpy).not.toHaveBeenCalled()
  }))

  it.effect('scales hostile contact damage on hard difficulty', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.settingsService, {
      getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, difficulty: 'hard' as const })),
    })
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(4)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).toHaveBeenCalledWith(6)
  }))

  it.effect('prevents hostile contact damage on peaceful difficulty', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    Object.assign(services.settingsService, {
      getSettings: vi.fn(() => Effect.succeed({ ...DEFAULT_SETTINGS, difficulty: 'peaceful' as const })),
    })
    ;(services.entityManager as { getPlayerContactDamage: unknown }).getPlayerContactDamage = vi.fn(() =>
      Effect.succeed(4)
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    yield* runFrame(deps, services)

    expect(applyDamageSpy).not.toHaveBeenCalled()
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
    // distance=5, no keys pressed → walk rate 0.01/block → 0.05
    expect(addExhaustionSpy.mock.calls[0]?.[0]).toBeCloseTo(0.05, 5)
  }))

  it.effect('accrues hunger exhaustion at sprint rate when sprinting (R59)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    // Ctrl + forward held, no sneak → sprinting
    const pressedKeys = MutableHashSet.fromIterable(['ControlLeft', 'KeyW'])
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
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
    // distance=5, sprinting → sprint rate 0.1/block → 0.5
    expect(addExhaustionSpy.mock.calls[0]?.[0]).toBeCloseTo(0.5, 5)
  }))

  it.effect('uses walk exhaustion when sprint keys are held but food level is too low', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['ControlLeft', 'KeyW'])
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    let posCallCount = 0
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() => {
      posCallCount++
      if (posCallCount < 3) return Effect.succeed({ x: 0, y: 64, z: 0 })
      return Effect.succeed({ x: 3, y: 64, z: 4 })
    })
    ;(services.hungerService as { getHunger: unknown }).getHunger = vi.fn(() =>
      Effect.succeed({ foodLevel: 6, saturation: 0, exhaustion: 0 })
    )
    const addExhaustionSpy = vi.fn(() => Effect.void)
    ;(services.hungerService as { addExhaustion: unknown }).addExhaustion = addExhaustionSpy

    yield* runFrame(deps, services)

    expect(addExhaustionSpy).toHaveBeenCalledOnce()
    // foodLevel=6 blocks sprinting, so distance=5 uses walk rate 0.01/block → 0.05
    expect(addExhaustionSpy.mock.calls[0]?.[0]).toBeCloseTo(0.05, 5)
  }))

  it.effect('accrues no hunger exhaustion while sneaking (R59)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['ShiftLeft'])
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    let posCallCount = 0
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() => {
      posCallCount++
      if (posCallCount < 3) return Effect.succeed({ x: 0, y: 64, z: 0 })
      return Effect.succeed({ x: 3, y: 64, z: 4 })
    })
    const addExhaustionSpy = vi.fn(() => Effect.void)
    ;(services.hungerService as { addExhaustion: unknown }).addExhaustion = addExhaustionSpy

    yield* runFrame(deps, services)

    // Sneak = no exhaustion accrued from movement
    expect(addExhaustionSpy).not.toHaveBeenCalled()
  }))

  it.effect('plays a grass footstep when grounded movement crosses the walk interval', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    let posCallCount = 0
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() => {
      posCallCount++
      if (posCallCount < 3) return Effect.succeed({ x: 0, y: 64, z: 0 })
      return Effect.succeed({ x: 0.8, y: 64, z: 0 })
    })
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeSingleBlockChunk(63, 'GRASS')),
    )
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* runFrame(deps, services)

    expect(playEffectSpy).toHaveBeenCalledWith('footstepGrass', {
      position: { x: 0.8, y: 64, z: 0 },
      gainScale: 1,
    })
  }))

  it.effect('stores sub-interval footstep distance until the next step', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    let posCallCount = 0
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() => {
      posCallCount++
      if (posCallCount < 3) return Effect.succeed({ x: 0, y: 64, z: 0 })
      return Effect.succeed({ x: 0.25, y: 64, z: 0 })
    })
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeSingleBlockChunk(63, 'GRASS')),
    )
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* runFrame(deps, services)

    expect(playEffectSpy).not.toHaveBeenCalled()
  }))

  it.effect('maps stone and wood ground blocks to their footstep variants', () => Effect.gen(function* () {
    const cases: ReadonlyArray<readonly [BlockType, SoundEffect]> = [
      ['STONE', 'footstepStone'],
      ['PLANKS', 'footstepWood'],
    ]

    for (const [blockType, expectedEffect] of cases) {
      const deps = yield* makeDeps(false)
      const services = makeServices({
        inputService: makeInputService(),
        inventoryRenderer: makeInventoryRenderer({ open: false }),
        settingsOverlay: makeSettingsOverlay({ open: false }),
      })
      let posCallCount = 0
      ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() => {
        posCallCount++
        if (posCallCount < 3) return Effect.succeed({ x: 0, y: 64, z: 0 })
        return Effect.succeed({ x: 0.8, y: 64, z: 0 })
      })
      ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
        Effect.succeed(makeSingleBlockChunk(63, blockType)),
      )
      const playEffectSpy = vi.fn(() => Effect.void)
      ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

      yield* runFrame(deps, services)

      expect(playEffectSpy).toHaveBeenCalledWith(expectedEffect, {
        position: { x: 0.8, y: 64, z: 0 },
        gainScale: 1,
      })
    }
  }))

  it.effect('uses the sprint footstep interval and gain while sprinting', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['ControlLeft', 'KeyW'])
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    let posCallCount = 0
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() => {
      posCallCount++
      if (posCallCount < 3) return Effect.succeed({ x: 0, y: 64, z: 0 })
      return Effect.succeed({ x: 0.56, y: 64, z: 0 })
    })
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeSingleBlockChunk(63, 'STONE')),
    )
    const playEffectSpy = vi.fn(() => Effect.void)
    ;(services.soundManager as { playEffect: unknown }).playEffect = playEffectSpy

    yield* runFrame(deps, services)

    expect(playEffectSpy).toHaveBeenCalledWith('footstepStone', {
      position: { x: 0.56, y: 64, z: 0 },
      gainScale: 1.15,
    })
  }))

  it.effect('accrues EXHAUSTION_SPRINT_JUMP (0.2) on a sprint-jump, not EXHAUSTION_JUMP (0.05) (R60)', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['ControlLeft', 'KeyW'])
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    // First frame: isGrounded=true → sets wasGroundedRef. Player stationary (no movement exhaust).
    const addExhaustionSpy = vi.fn(() => Effect.void)
    ;(services.hungerService as { addExhaustion: unknown }).addExhaustion = addExhaustionSpy
    yield* runFrame(deps, services)
    addExhaustionSpy.mockClear()

    // Second frame: isGrounded=false → jump detected (wasGrounded=true, isGrounded=false).
    // Sprint keys still held → should use EXHAUSTION_SPRINT_JUMP (0.2) not EXHAUSTION_JUMP (0.05).
    ;(services.gameState as { isPlayerGrounded: unknown }).isPlayerGrounded = vi.fn(() => Effect.succeed(false))
    yield* runFrame(deps, services)

    expect(addExhaustionSpy).toHaveBeenCalledOnce()
    expect(addExhaustionSpy.mock.calls[0]?.[0]).toBeCloseTo(0.2, 5)
  }))

  it.effect('uses normal jump exhaustion when sprint keys are held but food level is too low', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const pressedKeys = MutableHashSet.fromIterable(['ControlLeft', 'KeyW'])
    const services = makeServices({
      inputService: makeInputService(pressedKeys),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.hungerService as { getHunger: unknown }).getHunger = vi.fn(() =>
      Effect.succeed({ foodLevel: 6, saturation: 0, exhaustion: 0 })
    )
    const addExhaustionSpy = vi.fn(() => Effect.void)
    ;(services.hungerService as { addExhaustion: unknown }).addExhaustion = addExhaustionSpy
    yield* runFrame(deps, services)
    addExhaustionSpy.mockClear()

    ;(services.gameState as { isPlayerGrounded: unknown }).isPlayerGrounded = vi.fn(() => Effect.succeed(false))
    yield* runFrame(deps, services)

    expect(addExhaustionSpy).toHaveBeenCalledOnce()
    expect(addExhaustionSpy.mock.calls[0]?.[0]).toBeCloseTo(0.05, 5)
  }))
})

// ---------------------------------------------------------------------------
// Environmental hazards
// ---------------------------------------------------------------------------

const makeColumnChunk = (
  blocksAtY: ReadonlyArray<{ readonly y: number; readonly blockType: ColumnBlockType }>,
) => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  for (const { y, blockType } of blocksAtY) {
    blocks[y] = blockTypeToIndex(blockType)
  }
  return { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
}

const makeSingleBlockChunk = (blockY: number, blockType: ColumnBlockType) =>
  makeColumnChunk([{ y: blockY, blockType }])

const makeFilledChunk = (blockType: ColumnBlockType) => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks.fill(blockTypeToIndex(blockType))
  return { coord: { x: 0, z: 0 }, blocks, fluid: Option.none() }
}

describe('physics-stage — environmental hazards', () => {
  it.effect('applies suffocation damage when the player head is inside a solid block', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeSingleBlockChunk(64, 'STONE')),
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.5 as DeltaTimeSecs)

    expect(applyDamageSpy).toHaveBeenCalledWith(1)
  }))

  it.effect('applies void damage when the player is below y=-64', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() =>
      Effect.succeed({ x: 0, y: -65, z: 0 }),
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.5 as DeltaTimeSecs)

    expect(applyDamageSpy).toHaveBeenCalledWith(4)
  }))

  it.effect('does not apply void damage at exactly y=-64', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.gameState as { getPlayerPosition: unknown }).getPlayerPosition = vi.fn(() =>
      Effect.succeed({ x: 0, y: -64, z: 0 }),
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(0.5 as DeltaTimeSecs)

    expect(applyDamageSpy).not.toHaveBeenCalled()
  }))

  it.effect('reduces lava damage with Fire Protection armor', () => Effect.gen(function* () {
    const deps = yield* makeDeps(false)
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = vi.fn(() =>
      Effect.succeed(makeSingleBlockChunk(64, 'LAVA')),
    )
    const fireArmor = (itemType: 'IRON_HELMET' | 'IRON_CHESTPLATE' | 'IRON_LEGGINGS' | 'IRON_BOOTS') =>
      Option.some({
        itemType,
        count: 1,
        enchantments: [{ type: 'FIRE_PROTECTION' as const, level: 4 }],
      })
    ;(services.equipmentService as { getAll: unknown }).getAll = vi.fn(() =>
      Effect.succeed({
        HELMET: fireArmor('IRON_HELMET'),
        CHESTPLATE: fireArmor('IRON_CHESTPLATE'),
        LEGGINGS: fireArmor('IRON_LEGGINGS'),
        BOOTS: fireArmor('IRON_BOOTS'),
      })
    )
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(1 as DeltaTimeSecs)

    expect(applyDamageSpy).toHaveBeenCalled()
    expect(applyDamageSpy.mock.calls[0]?.[0]).toBeGreaterThan(0)
    expect(applyDamageSpy.mock.calls[0]?.[0]).toBeLessThan(4)
  }))

  it.effect('updates air display and applies drowning damage while submerged', () => Effect.gen(function* () {
    const airElement = { style: { display: '' }, textContent: '' } as unknown as HTMLElement
    const deps = {
      ...(yield* makeDeps(false)),
      airElement: Option.some(airElement),
    }
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const applyDamageSpy = vi.fn(() => Effect.void)
    ;(services.healthService as { applyDamage: unknown }).applyDamage = applyDamageSpy
    const waterColumn = makeFilledChunk('WATER')
    const airColumn = makeColumnChunk([])
    const getChunkSpy = vi.fn(() => Effect.succeed(waterColumn))
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = getChunkSpy
    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()

    yield* frameHandler(2 as DeltaTimeSecs)
    expect(airElement.style.display).toBe('block')
    expect(airElement.textContent).not.toContain('Drowning')

    yield* frameHandler(30 as DeltaTimeSecs)
    expect(airElement.style.display).toBe('block')
    expect(airElement.textContent).toContain('Drowning')
    expect(applyDamageSpy).toHaveBeenCalled()

    getChunkSpy.mockReturnValue(Effect.succeed(airColumn))
    yield* frameHandler(1 as DeltaTimeSecs)

    expect(airElement.style.display).toBe('none')
  }))

  it.effect('refills underwater air to the Respiration maximum after surfacing', () => Effect.gen(function* () {
    const airElement = { style: { display: '' }, textContent: '' } as unknown as HTMLElement
    const deps = {
      ...(yield* makeDeps(false)),
      airElement: Option.some(airElement),
    }
    const services = makeServices({
      inputService: makeInputService(),
      inventoryRenderer: makeInventoryRenderer({ open: false }),
      settingsOverlay: makeSettingsOverlay({ open: false }),
    })
    const waterColumn = makeFilledChunk('WATER')
    const airColumn = makeColumnChunk([])
    const getChunkSpy = vi.fn(() => Effect.succeed(waterColumn))
    ;(services.chunkManagerService as { getChunk: unknown }).getChunk = getChunkSpy
    ;(services.equipmentService as { getEquippedItem: unknown }).getEquippedItem = vi.fn(() =>
      Effect.succeed(Option.some({
        itemType: 'IRON_HELMET',
        count: 1,
        enchantments: [{ type: 'RESPIRATION', level: 1 }],
      }))
    )

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(deps, services)
    yield* maintenanceHandler()
    yield* frameHandler(1 as DeltaTimeSecs)

    expect(airElement.style.display).toBe('block')

    getChunkSpy.mockReturnValue(Effect.succeed(airColumn))
    yield* frameHandler(1 as DeltaTimeSecs)

    expect(airElement.style.display).toBe('none')
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
    expect(forceSetBlockSpy.mock.calls.some((call: readonly unknown[]) => call[1] === 'OBSIDIAN')).toBe(true)
    expect(forceSetBlockSpy.mock.calls.some((call: readonly unknown[]) => call[1] === 'NETHER_PORTAL')).toBe(true)
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
