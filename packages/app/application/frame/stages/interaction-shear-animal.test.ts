import { describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { EntityType } from '@ts-minecraft/entity'
import { handleShearAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler'

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
const makeServices = (heldItem: string | undefined, shearResult: Option.Option<number>) => {
  const addBlock = vi.fn(() => Effect.void)
  const shearEntity = vi.fn(() => Effect.succeed(shearResult))
  const playEffect = vi.fn(() => Effect.void)
  const services = {
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(heldItem === undefined ? Option.none() : Option.some(heldItem)),
      getSelectedSlot: () => Effect.succeed(0),
    },
    entityManager: {
      getEntities: () => Effect.succeed([sheep]),
      getEntity: () => Effect.succeed(Option.some(sheep)),
      shearEntity,
    },
    inventoryService: { addBlock },
    soundManager: { playEffect },
  } as never
  return { services, addBlock, shearEntity, playEffect }
}

describe('handleShearAnimal (R11)', () => {
  it('shears a sheep held SHEARS: harvests wool to inventory, plays a cue, returns true', async () => {
    const { services, addBlock, shearEntity, playEffect } = makeServices('SHEARS', Option.some(3))
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(true)
    expect(shearEntity).toHaveBeenCalledWith('sheep-1')
    expect(addBlock).toHaveBeenCalledWith('WOOL', 3)
    expect(playEffect).toHaveBeenCalled()
  })

  it('does nothing when the held item is not SHEARS', async () => {
    const { services, shearEntity } = makeServices('STONE', Option.some(3))
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(false)
    expect(shearEntity).not.toHaveBeenCalled()
  })

  it('returns false (no wool) when shearEntity declines (wrong species / already sheared)', async () => {
    const { services, addBlock } = makeServices('SHEARS', Option.none())
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(false)
    expect(addBlock).not.toHaveBeenCalled()
  })

  it('returns false when nothing is held', async () => {
    const { services, shearEntity } = makeServices(undefined, Option.some(3))
    const sheared = await Effect.runPromise(handleShearAnimal({ camera: makeCamera() }, services))
    expect(sheared).toBe(false)
    expect(shearEntity).not.toHaveBeenCalled()
  })
})
