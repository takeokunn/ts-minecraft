import { Effect, MutableRef, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  DROWN_DAMAGE,
  DROWN_DAMAGE_INTERVAL_SECS,
  MAX_AIR_SECS,
} from '@ts-minecraft/entity/domain/environment-hazard.config'
import { ItemStack } from '@ts-minecraft/inventory/domain/item-stack'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import { applySurvivalAirEffects } from './environment-air'
import type { SurvivalMovementState } from './types'
import { makeDefaultInputs, makeDefaultRefs, makeDefaultServices } from './test-builders'

describe('physics-stage-survival/environment-air', () => {
  it('syncs the air meter and applies drowning damage while submerged', async () => {
    const services = makeDefaultServices()
    const refs = makeDefaultRefs()
    const airElement = { style: { display: 'none' }, textContent: 'before' } as unknown as HTMLElement
    const refreshedPos = { x: 2, y: 70, z: -3 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: false,
      isGrounded: false,
      isSneaking: false,
      isSprinting: false,
    }

    await Effect.runPromise(
      applySurvivalAirEffects(
        {
          ...services,
          equipmentService: {
            ...services.equipmentService,
            getEquippedItem: services.equipmentService.getEquippedItem,
          },
        } as PhysicsStageServices,
        refs,
        {
          ...makeDefaultInputs(DROWN_DAMAGE_INTERVAL_SECS),
          airElementOrNull: airElement,
        },
        refreshedPos,
        movement,
        'WATER',
        applyDamage,
      ),
    )

    expect(services.equipmentService.getEquippedItem).toHaveBeenCalledOnce()
    expect(damageCalls).toEqual([DROWN_DAMAGE])
    expect(services.soundManager.playEffect).toHaveBeenCalledOnce()
    expect(services.soundManager.playEffect).toHaveBeenCalledWith('playerHurt', { position: refreshedPos })
    expect(airElement.style.display).toBe('block')
    expect(airElement.textContent).toBe('💀 Drowning')
    expect(MutableRef.get(refs.airSecsRef)).toBe(0)
    expect(MutableRef.get(refs.lastAirBubblesRef)).toBe(0)
  })

  it('hides air meter when player surfaces with remaining air', async () => {
    const services = makeDefaultServices()
    const refs = makeDefaultRefs(5, 3)
    const airElement = { style: { display: 'block' }, textContent: '🫧🫧🫧' } as unknown as HTMLElement
    const refreshedPos = { x: 0, y: 65, z: 0 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: false,
      isGrounded: true,
      isSneaking: false,
      isSprinting: false,
    }

    await Effect.runPromise(
      applySurvivalAirEffects(
        services as PhysicsStageServices,
        refs,
        {
          ...makeDefaultInputs(0.1),
          airElementOrNull: airElement,
        },
        refreshedPos,
        movement,
        'AIR',
        applyDamage,
      ),
    )

    expect(damageCalls).toEqual([])
    expect(airElement.style.display).toBe('none')
    expect(MutableRef.get(refs.airSecsRef)).toBe(MAX_AIR_SECS)
    expect(MutableRef.get(refs.lastAirBubblesRef)).toBe(10)
  })

  it('extends air supply when wearing a Respiration helmet', async () => {
    const services = makeDefaultServices()
    const respirationHelmet = new ItemStack({
      itemType: 'IRON_HELMET',
      count: 1,
      durability: 165,
      enchantments: [{ type: 'RESPIRATION', level: 2 }],
    })
    services.equipmentService.getEquippedItem.mockReturnValue(Effect.succeed(Option.some(respirationHelmet)))
    const refs = makeDefaultRefs(44, 10)
    const refreshedPos = { x: 0, y: 62, z: 0 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: false,
      isGrounded: false,
      isSneaking: false,
      isSprinting: false,
    }

    await Effect.runPromise(
      applySurvivalAirEffects(
        services as PhysicsStageServices,
        refs,
        makeDefaultInputs(1),
        refreshedPos,
        movement,
        'WATER',
        applyDamage,
      ),
    )

    // With Respiration II the effective max is 15 + 15*2 = 45 secs.
    // Starting at 44, after draining 1 sec → 43 remaining, airBubbles = ceil(43/45*10) = 10.
    // Air meter is unchanged (lastAirBubblesRef starts at 10) so no DOM update.
    expect(damageCalls).toEqual([])
    expect(MutableRef.get(refs.airSecsRef)).toBe(43)
  })

  it('does not drain air or apply drowning in creative mode', async () => {
    const services = makeDefaultServices()
    const refs = makeDefaultRefs(MAX_AIR_SECS, 10)
    const airElement = { style: { display: 'none' }, textContent: '' } as unknown as HTMLElement
    const refreshedPos = { x: 0, y: 60, z: 0 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: true,
      isGrounded: false,
      isSneaking: false,
      isSprinting: false,
    }

    await Effect.runPromise(
      applySurvivalAirEffects(
        services as PhysicsStageServices,
        refs,
        {
          ...makeDefaultInputs(DROWN_DAMAGE_INTERVAL_SECS * 5),
          airElementOrNull: airElement,
        },
        refreshedPos,
        movement,
        'WATER',
        applyDamage,
      ),
    )

    expect(damageCalls).toEqual([])
    expect(services.soundManager.playEffect).not.toHaveBeenCalled()
    expect(MutableRef.get(refs.airSecsRef)).toBe(MAX_AIR_SECS)
  })
})
