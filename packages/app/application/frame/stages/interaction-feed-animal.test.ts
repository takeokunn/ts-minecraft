import { describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { EntityType } from '@ts-minecraft/entity'
import { handleFeedAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler'

// Default camera at origin looks down -Z; entity center (y + 0.9 offset) on the
// eye line one block ahead → a guaranteed findAttackableEntity hit.
const makeCamera = () => {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.position.set(0, 0, 0)
  cam.updateMatrixWorld(true)
  return cam
}

const cow = { entityId: 'cow-1', position: { x: 0, y: -0.9, z: -1 }, type: EntityType.Cow }

const makeServices = (heldItem: string | undefined, feedResult: boolean) => {
  const removeBlock = vi.fn(() => Effect.void)
  const feedEntity = vi.fn(() => Effect.succeed(feedResult))
  const playEffect = vi.fn(() => Effect.void)
  const services = {
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(heldItem === undefined ? Option.none() : Option.some(heldItem)),
      getSelectedSlot: () => Effect.succeed(0),
    },
    entityManager: {
      getEntities: () => Effect.succeed([cow]),
      getEntity: () => Effect.succeed(Option.some(cow)),
      feedEntity,
    },
    inventoryService: { removeBlock },
    soundManager: { playEffect },
  } as never
  return { services, removeBlock, feedEntity, playEffect }
}

describe('handleFeedAnimal (R6c-3)', () => {
  it('feeds a cow held WHEAT: enters love, consumes 1 item, returns true', async () => {
    const { services, removeBlock, feedEntity } = makeServices('WHEAT', true)
    const fed = await Effect.runPromise(handleFeedAnimal({ camera: makeCamera() }, services))
    expect(fed).toBe(true)
    expect(feedEntity).toHaveBeenCalledWith('cow-1')
    expect(removeBlock).toHaveBeenCalledWith('WHEAT', 1, expect.anything())
  })

  it('does nothing when the held item is not the cow breeding item', async () => {
    const { services, feedEntity } = makeServices('STONE', true)
    const fed = await Effect.runPromise(handleFeedAnimal({ camera: makeCamera() }, services))
    expect(fed).toBe(false)
    expect(feedEntity).not.toHaveBeenCalled()
  })

  it('does not consume when feedEntity declines (not a willing adult)', async () => {
    const { services, removeBlock } = makeServices('WHEAT', false)
    const fed = await Effect.runPromise(handleFeedAnimal({ camera: makeCamera() }, services))
    expect(fed).toBe(false)
    expect(removeBlock).not.toHaveBeenCalled()
  })

  it('returns false when nothing is held', async () => {
    const { services, feedEntity } = makeServices(undefined, true)
    const fed = await Effect.runPromise(handleFeedAnimal({ camera: makeCamera() }, services))
    expect(fed).toBe(false)
    expect(feedEntity).not.toHaveBeenCalled()
  })
})
