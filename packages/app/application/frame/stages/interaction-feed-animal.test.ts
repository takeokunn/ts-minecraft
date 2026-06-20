import { describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import type { FrameAnimalInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types/animal'
import { handleFeedAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/feed-animal'

// Default camera at origin looks down -Z; entity center (y + 0.9 offset) on the
// eye line one block ahead → a guaranteed findAttackableEntity hit.
const makeCamera = () => {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.position.set(0, 0, 0)
  cam.updateMatrixWorld(true)
  return cam
}

const cow = { entityId: 'cow-1', position: { x: 0, y: -0.9, z: -1 }, type: EntityType.Cow }

const makeServices = (
  heldItem: string | undefined,
  feedResult: boolean,
  options: {
    readonly entities?: ReadonlyArray<typeof cow>
    readonly target?: Option.Option<typeof cow>
    readonly removeBlock?: () => Effect.Effect<void, string>
    readonly playEffect?: () => Effect.Effect<void, string>
  } = {},
): {
  readonly services: FrameAnimalInteractionServices
  readonly removeBlock: ReturnType<typeof vi.fn>
  readonly feedEntity: ReturnType<typeof vi.fn>
  readonly playEffect: ReturnType<typeof vi.fn>
} => {
  const removeBlock = vi.fn(options.removeBlock ?? (() => Effect.void))
  const feedEntity = vi.fn(() => Effect.succeed(feedResult))
  const playEffect = vi.fn(options.playEffect ?? (() => Effect.void))
  const services: FrameAnimalInteractionServices = {
    hotbarService: {
      getSelectedBlockType: () => Effect.succeed(heldItem === undefined ? Option.none() : Option.some(heldItem)),
      getSelectedSlot: () => Effect.succeed(0),
    },
    entityManager: {
      getEntities: () => Effect.succeed(options.entities ?? [cow]),
      getEntity: () => Effect.succeed(options.target ?? Option.some(cow)),
      feedEntity,
    },
    inventoryService: { removeBlock },
    soundManager: { playEffect },
  }
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

  it('returns false when no animal is under the crosshair', async () => {
    const { services, feedEntity } = makeServices('WHEAT', true, { entities: [] })
    const fed = await Effect.runPromise(handleFeedAnimal({ camera: makeCamera() }, services))
    expect(fed).toBe(false)
    expect(feedEntity).not.toHaveBeenCalled()
  })

  it('returns false when the aimed entity disappears before feeding', async () => {
    const { services, feedEntity } = makeServices('WHEAT', true, { target: Option.none() })
    const fed = await Effect.runPromise(handleFeedAnimal({ camera: makeCamera() }, services))
    expect(fed).toBe(false)
    expect(feedEntity).not.toHaveBeenCalled()
  })

  it('still returns true when item removal fails after a successful feed', async () => {
    const { services, removeBlock, playEffect } = makeServices('WHEAT', true, {
      removeBlock: () => Effect.fail('slot-empty'),
    })
    const fed = await Effect.runPromise(handleFeedAnimal({ camera: makeCamera() }, services))
    expect(fed).toBe(true)
    expect(removeBlock).toHaveBeenCalledWith('WHEAT', 1, expect.anything())
    expect(playEffect).toHaveBeenCalled()
  })

  it('still returns true when the feed sound fails', async () => {
    const { services, playEffect } = makeServices('WHEAT', true, {
      playEffect: () => Effect.fail('sound-offline'),
    })
    const fed = await Effect.runPromise(handleFeedAnimal({ camera: makeCamera() }, services))
    expect(fed).toBe(true)
    expect(playEffect).toHaveBeenCalledWith('blockPlace', { position: cow.position })
  })
})
