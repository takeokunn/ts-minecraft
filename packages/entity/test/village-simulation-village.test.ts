import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { tickVillage } from '@ts-minecraft/entity/domain/village/village-simulation-village'
import {
  VillagerId,
  VillageId,
  VillageStructureId,
  VillagerActivity,
} from '@ts-minecraft/entity/domain/village/village-model'
import type { Village } from '@ts-minecraft/entity/domain/village/village-model'
import { VILLAGE_SIMULATION_DISTANCE } from '@ts-minecraft/entity/domain/village/village-simulation-constants'

// ─── fixtures ─────────────────────────────────────────────────────────────────

const HOME_ID = VillageStructureId.make('home-1')
const WORK_ID = VillageStructureId.make('work-1')

const makeVillage = (center = { x: 48, y: 64, z: 48 }): Village => ({
  villageId: VillageId.make('v1'),
  center,
  structures: [
    {
      structureId: HOME_ID,
      type: 'house',
      anchor: { x: 50, y: 64, z: 50 },
      size: { x: 3, y: 4, z: 3 },
    },
    {
      structureId: WORK_ID,
      type: 'farm',
      anchor: { x: 40, y: 64, z: 40 },
      size: { x: 3, y: 2, z: 3 },
    },
  ],
  villagers: [
    {
      villagerId: VillagerId.make('v1'),
      villageId: VillageId.make('v1'),
      profession: 'Farmer',
      homeStructureId: HOME_ID,
      workplaceStructureId: WORK_ID,
      level: 1,
      experience: 0,
      position: { x: 48, y: 64, z: 48 },
      activity: VillagerActivity.Idle,
    },
  ],
})

// Player far from village
const FAR_PLAYER = { x: 0, y: 64, z: 0 }
// Player inside village (near centre at 48, 64, 48)
const NEAR_PLAYER = { x: 48, y: 64, z: 48 }

// ─── tickVillage ──────────────────────────────────────────────────────────────
describe('tickVillage', () => {
  it('returns the same reference when player is beyond simulation distance', () => {
    const village = makeVillage()
    const beyondPlayer = {
      x: VILLAGE_SIMULATION_DISTANCE * 2,
      y: 64,
      z: VILLAGE_SIMULATION_DISTANCE * 2,
    }
    const result = tickVillage(village, beyondPlayer, 0.5, 1, 1)
    expect(result).toBe(village)
  })

  it('returns the same reference when a villager is already trading and player stays close', () => {
    // Set up: villager already in Trade mode, player stays nearby
    const village = makeVillage()
    // First tick: player at villager position → Trade activity, position stays
    const result1 = tickVillage(village, NEAR_PLAYER, 0.5, 1, 1)
    expect(result1.villagers[0]!.activity).toBe(VillagerActivity.Trade)
    // Second tick: same conditions → Trade stays, position unchanged → same reference
    const result2 = tickVillage(result1, NEAR_PLAYER, 0.5, 2, 1)
    expect(result2).toBe(result1)
  })

  it('returns a new object when a villager position changes', () => {
    const village = makeVillage({ x: 48, y: 64, z: 48 })
    // Player nearby triggers Trade activity, position unchanged → but the first tick may change
    // Daytime (0.5) + player far → villager should walk toward work target
    const result = tickVillage(village, FAR_PLAYER, 0.5, 1, 10) // large maxMoveDelta
    // Villager walks toward work at {40, 64, 40}; position changes → new object
    expect(result).not.toBe(village)
  })

  it('updates villager activity when player is within trade range', () => {
    const village = makeVillage()
    // Villager starts at {48, 64, 48}; put player at same spot
    const result = tickVillage(village, { x: 48, y: 64, z: 48 }, 0.5, 1, 1)
    expect(result.villagers[0]!.activity).toBe(VillagerActivity.Trade)
  })

  it('assigns Rest activity during nighttime', () => {
    const village = makeVillage()
    // timeOfDay > 0.78 → night → Rest
    const result = tickVillage(village, FAR_PLAYER, 0.9, 1, 0)
    expect(result.villagers[0]!.activity).toBe(VillagerActivity.Rest)
  })
})
