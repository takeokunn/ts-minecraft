import { describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { handleShearAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/shear-animal'

// Default camera at origin looks down -Z; entity center (y + 0.9 offset) on the
// eye line one block ahead → a guaranteed findAttackableEntity hit.
const makeCamera = () => {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.position.set(0, 0, 0)
  cam.updateMatrixWorld(true)
  return cam
}

const sheep = { entityId: 'sheep-1', position: { x: 0, y: -0.9, z: -1 }, type: EntityType.Sheep }

// shearResult: Option<number> the (mocked) EntityManager.shearEntity returns.
const makeServices = (
  heldItem: string | undefined,
  shearResult: Option.Option<number>,
  options: {
    readonly entities?: ReadonlyArray<typeof sheep>
    readonly target?: Option.Option<typeof sheep>
    readonly addBlock?: () => Effect.Effect<void, string>
    readonly playEffect?: () => Effect.Effect<void, string>
  } = {},
) => {
  const addBlock = vi.fn(options.addBlock ?? (() => Effect.void))
  const damageSlot = vi.fn(() => Effect.void)
  const shearEntity = vi.fn(() => Effect.succeed(shearResult))
  const playEffect = vi.fn(options.playEffect ?? (() => Effect.void))
  const services = {
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(heldItem === undefined ? Option.none() : Option.some(heldItem)),
      getSelectedSlot: () => Effect.succeed(0),
    },
    entityManager: {
      getEntities: () => Effect.succeed(options.entities ?? [sheep]),
      getEntity: () => Effect.succeed(options.target ?? Option.some(sheep)),
      shearEntity,
    },
    inventoryService: { addBlock, damageSlot },
    soundManager: { playEffect },
  } as never
  return { services, addBlock, damageSlot, shearEntity, playEffect }
}

describe('handleShearAnimal (R11)', () => {
  it('shears a sheep held SHEARS: harvests wool to inventory, plays a cue, returns true', async () => {
    const { services, addBlock, damageSlot, shearEntity, playEffect } = makeServices('SHEARS', Option.some(3))
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(true)
    expect(shearEntity).toHaveBeenCalledWith('sheep-1')
    expect(addBlock).toHaveBeenCalledWith('WOOL', 3)
    expect(damageSlot).toHaveBeenCalledWith(27, 1)
    expect(playEffect).toHaveBeenCalled()
  })

  it('does nothing when the held item is not SHEARS', async () => {
    const { services, damageSlot, shearEntity } = makeServices('STONE', Option.some(3))
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(false)
    expect(shearEntity).not.toHaveBeenCalled()
    expect(damageSlot).not.toHaveBeenCalled()
  })

  it('returns false (no wool) when shearEntity declines (wrong species / already sheared)', async () => {
    const { services, addBlock, damageSlot } = makeServices('SHEARS', Option.none())
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(false)
    expect(addBlock).not.toHaveBeenCalled()
    expect(damageSlot).not.toHaveBeenCalled()
  })

  it('returns false when nothing is held', async () => {
    const { services, damageSlot, shearEntity } = makeServices(undefined, Option.some(3))
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(false)
    expect(shearEntity).not.toHaveBeenCalled()
    expect(damageSlot).not.toHaveBeenCalled()
  })

  it('returns false when no sheep is under the crosshair', async () => {
    const { services, shearEntity } = makeServices('SHEARS', Option.some(3), { entities: [] })
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(false)
    expect(shearEntity).not.toHaveBeenCalled()
  })

  it('still damages shears when the wool cannot be added to inventory', async () => {
    const { services, addBlock, damageSlot, playEffect } = makeServices('SHEARS', Option.some(2), {
      addBlock: () => Effect.fail('inventory-full'),
    })
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(true)
    expect(addBlock).toHaveBeenCalledWith('WOOL', 2)
    expect(damageSlot).toHaveBeenCalledWith(27, 1)
    expect(playEffect).toHaveBeenCalled()
  })

  it('returns true when the sheep is gone before the sound position can be read', async () => {
    const { services, damageSlot, playEffect } = makeServices('SHEARS', Option.some(1), { target: Option.none() })
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(true)
    expect(damageSlot).toHaveBeenCalledWith(27, 1)
    expect(playEffect).not.toHaveBeenCalled()
  })

  it('still returns true when the shear sound fails', async () => {
    const { services, playEffect } = makeServices('SHEARS', Option.some(1), {
      playEffect: () => Effect.fail('sound-offline'),
    })
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(true)
    expect(playEffect).toHaveBeenCalledWith('blockBreak', { position: sheep.position })
  })
})
