import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import { runWithEntityManager } from './mob/test-utils'

const POS = { x: 10, y: 64, z: 10 }

describe('EntityManager.setActiveDimension', () => {
  it('parks the current dimension entities and starts the new dimension empty', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const manager = yield* EntityManager
      yield* manager.addEntity('Cow', POS)
      yield* manager.addEntity('Villager', POS)
      expect((yield* manager.getEntities()).length).toBe(2)

      yield* manager.setActiveDimension('nether')
      expect((yield* manager.getEntities()).length).toBe(0)
    }))
  })

  it('restores a dimension population on return, keeping ids and types', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const manager = yield* EntityManager
      yield* manager.addEntity('Cow', POS)
      yield* manager.setActiveDimension('nether')
      yield* manager.addEntity('Blaze', POS)
      yield* manager.addEntity('Ghast', POS)

      yield* manager.setActiveDimension('overworld')
      const overworld = yield* manager.getEntities()
      expect(overworld.map((e) => e.type)).toEqual(['Cow'])

      yield* manager.setActiveDimension('nether')
      const nether = yield* manager.getEntities()
      expect(nether.map((e) => e.type).sort()).toEqual(['Blaze', 'Ghast'])
    }))
  })

  it('is a no-op when the dimension is unchanged', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const manager = yield* EntityManager
      yield* manager.addEntity('Cow', POS)
      const versionBefore = yield* manager.getStructureVersion()
      yield* manager.setActiveDimension('overworld')
      expect((yield* manager.getEntities()).length).toBe(1)
      expect(yield* manager.getStructureVersion()).toBe(versionBefore)
    }))
  })

  it('bumps the structure version on a real switch so the renderer rebuilds', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const manager = yield* EntityManager
      const versionBefore = yield* manager.getStructureVersion()
      yield* manager.setActiveDimension('end')
      expect(yield* manager.getStructureVersion()).toBe(versionBefore + 1)
    }))
  })

  it('clear() wipes parked dimensions too — a new world starts with empty pools', async () => {
    await runWithEntityManager(Effect.gen(function* () {
      const manager = yield* EntityManager
      yield* manager.addEntity('Cow', POS)
      yield* manager.setActiveDimension('nether')
      yield* manager.addEntity('Blaze', POS)
      yield* manager.clear()
      // clear resets to overworld with nothing anywhere.
      expect((yield* manager.getEntities()).length).toBe(0)
      yield* manager.setActiveDimension('nether')
      expect((yield* manager.getEntities()).length).toBe(0)
      yield* manager.setActiveDimension('overworld')
      expect((yield* manager.getEntities()).length).toBe(0)
    }))
  })
})
