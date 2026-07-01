import { beforeEach, describe, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { expect, vi } from 'vitest'

import { handleRightClickPriorityFromContext } from './interaction-right-click-handler'

vi.mock('@ts-minecraft/app/frame/stages/interaction-item-use-handler/shear-animal', () => ({
  handleShearAnimal: vi.fn(() => Effect.succeed(false)),
}))
vi.mock('@ts-minecraft/app/frame/stages/interaction-item-use-handler/feed-animal', () => ({
  handleFeedAnimal: vi.fn(() => Effect.succeed(false)),
}))
vi.mock('@ts-minecraft/app/frame/stages/interaction-item-use-handler/food-consumption', () => ({
  handleFoodConsumption: vi.fn(() => Effect.succeed(false)),
}))
vi.mock('@ts-minecraft/app/frame/stages/interaction-item-use-handler/ender-pearl', () => ({
  handleEnderPearlThrow: vi.fn(() => Effect.succeed(false)),
}))
vi.mock('@ts-minecraft/app/frame/stages/interaction-farming-handler', () => ({
  handleFarmingInteraction: vi.fn(() => Effect.succeed(false)),
}))
vi.mock('@ts-minecraft/app/frame/stages/interaction-bucket-handler/bucket-handler', () => ({
  handleBucket: vi.fn(() => Effect.succeed(false)),
}))
vi.mock('@ts-minecraft/app/frame/stages/interaction-flint-steel-handler', () => ({
  handleFlintAndSteel: vi.fn(() => Effect.succeed(false)),
}))
vi.mock('@ts-minecraft/app/frame/stages/interaction-placement-handler', () => ({
  handleRightClick: vi.fn(() => Effect.void),
}))

import { handleShearAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/shear-animal'
import { handleFeedAnimal } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/feed-animal'
import { handleFoodConsumption } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/food-consumption'
import { handleEnderPearlThrow } from '@ts-minecraft/app/frame/stages/interaction-item-use-handler/ender-pearl'
import { handleFarmingInteraction } from '@ts-minecraft/app/frame/stages/interaction-farming-handler'
import { handleBucket } from '@ts-minecraft/app/frame/stages/interaction-bucket-handler/bucket-handler'
import { handleFlintAndSteel } from '@ts-minecraft/app/frame/stages/interaction-flint-steel-handler'
import { handleRightClick } from '@ts-minecraft/app/frame/stages/interaction-placement-handler'

const shearMock = vi.mocked(handleShearAnimal)
const feedMock = vi.mocked(handleFeedAnimal)
const foodMock = vi.mocked(handleFoodConsumption)
const enderPearlMock = vi.mocked(handleEnderPearlThrow)
const farmMock = vi.mocked(handleFarmingInteraction)
const bucketMock = vi.mocked(handleBucket)
const igniteMock = vi.mocked(handleFlintAndSteel)
const placeMock = vi.mocked(handleRightClick)

const makeDeps = () =>
  ({
    camera: {} as never,
    respawnPositionRef: {} as never,
  }) as never

const makeServices = () => ({}) as never

const makeRefs = () => ({}) as never

const makeContext = (selectedHotbarItem: string | null = null) => ({
  snapshot: {
    selectedHotbarItem: selectedHotbarItem === null ? Option.none() : Option.some(selectedHotbarItem),
  } as never,
  targetHit: Option.none<never>(),
})

describe('handleRightClickPriorityFromContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    shearMock.mockReturnValue(Effect.succeed(false))
    feedMock.mockReturnValue(Effect.succeed(false))
    foodMock.mockReturnValue(Effect.succeed(false))
    enderPearlMock.mockReturnValue(Effect.succeed(false))
    farmMock.mockReturnValue(Effect.succeed(false))
    bucketMock.mockReturnValue(Effect.succeed(false))
    igniteMock.mockReturnValue(Effect.succeed(false))
    placeMock.mockReturnValue(Effect.void)
  })

  it.effect('stops after shearing succeeds', () =>
    Effect.gen(function* () {
      shearMock.mockReturnValue(Effect.succeed(true))

      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext())

      expect(shearMock).toHaveBeenCalledOnce()
      expect(feedMock).not.toHaveBeenCalled()
      expect(foodMock).not.toHaveBeenCalled()
      expect(enderPearlMock).not.toHaveBeenCalled()
      expect(farmMock).not.toHaveBeenCalled()
      expect(bucketMock).not.toHaveBeenCalled()
      expect(igniteMock).not.toHaveBeenCalled()
      expect(placeMock).not.toHaveBeenCalled()
    }),
  )

  it.effect('stops after feeding succeeds', () =>
    Effect.gen(function* () {
      feedMock.mockReturnValue(Effect.succeed(true))

      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext())

      expect(shearMock).toHaveBeenCalledOnce()
      expect(feedMock).toHaveBeenCalledOnce()
      expect(foodMock).not.toHaveBeenCalled()
      expect(enderPearlMock).not.toHaveBeenCalled()
      expect(farmMock).not.toHaveBeenCalled()
      expect(bucketMock).not.toHaveBeenCalled()
      expect(igniteMock).not.toHaveBeenCalled()
      expect(placeMock).not.toHaveBeenCalled()
    }),
  )

  it.effect('stops after farming succeeds', () =>
    Effect.gen(function* () {
      farmMock.mockReturnValue(Effect.succeed(true))

      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext())

      expect(shearMock).toHaveBeenCalledOnce()
      expect(feedMock).toHaveBeenCalledOnce()
      expect(farmMock).toHaveBeenCalledOnce()
      expect(foodMock).not.toHaveBeenCalled()
      expect(enderPearlMock).not.toHaveBeenCalled()
      expect(bucketMock).not.toHaveBeenCalled()
      expect(igniteMock).not.toHaveBeenCalled()
      expect(placeMock).not.toHaveBeenCalled()
    }),
  )

  it.effect('stops after consuming food succeeds', () =>
    Effect.gen(function* () {
      foodMock.mockReturnValue(Effect.succeed(true))

      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext())

      expect(shearMock).toHaveBeenCalledOnce()
      expect(feedMock).toHaveBeenCalledOnce()
      expect(farmMock).toHaveBeenCalledOnce()
      expect(foodMock).toHaveBeenCalledOnce()
      expect(enderPearlMock).not.toHaveBeenCalled()
      expect(bucketMock).not.toHaveBeenCalled()
      expect(igniteMock).not.toHaveBeenCalled()
      expect(placeMock).not.toHaveBeenCalled()
    }),
  )

  it.effect('stops after throwing ender pearl succeeds', () =>
    Effect.gen(function* () {
      enderPearlMock.mockReturnValue(Effect.succeed(true))

      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext())

      expect(shearMock).toHaveBeenCalledOnce()
      expect(feedMock).toHaveBeenCalledOnce()
      expect(farmMock).toHaveBeenCalledOnce()
      expect(foodMock).toHaveBeenCalledOnce()
      expect(enderPearlMock).toHaveBeenCalledOnce()
      expect(bucketMock).not.toHaveBeenCalled()
      expect(igniteMock).not.toHaveBeenCalled()
      expect(placeMock).not.toHaveBeenCalled()
    }),
  )

  it.effect('stops after bucket interaction succeeds', () =>
    Effect.gen(function* () {
      bucketMock.mockReturnValue(Effect.succeed(true))

      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext())

      expect(shearMock).toHaveBeenCalledOnce()
      expect(feedMock).toHaveBeenCalledOnce()
      expect(farmMock).toHaveBeenCalledOnce()
      expect(foodMock).toHaveBeenCalledOnce()
      expect(enderPearlMock).toHaveBeenCalledOnce()
      expect(bucketMock).toHaveBeenCalledOnce()
      expect(igniteMock).not.toHaveBeenCalled()
      expect(placeMock).not.toHaveBeenCalled()
    }),
  )

  it.effect('stops after ignition succeeds when holding FLINT_AND_STEEL', () =>
    Effect.gen(function* () {
      igniteMock.mockReturnValue(Effect.succeed(true))

      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext('FLINT_AND_STEEL'))

      expect(shearMock).toHaveBeenCalledOnce()
      expect(feedMock).toHaveBeenCalledOnce()
      expect(farmMock).toHaveBeenCalledOnce()
      expect(foodMock).toHaveBeenCalledOnce()
      expect(enderPearlMock).toHaveBeenCalledOnce()
      expect(bucketMock).toHaveBeenCalledOnce()
      expect(igniteMock).toHaveBeenCalledOnce()
      expect(placeMock).not.toHaveBeenCalled()
    }),
  )

  it.effect('skips ignite and falls through to placement when not holding FLINT_AND_STEEL', () =>
    Effect.gen(function* () {
      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext())

      expect(igniteMock).not.toHaveBeenCalled()
      expect(placeMock).toHaveBeenCalledOnce()
    }),
  )

  it.effect('falls through to placement when no earlier handler succeeds', () =>
    Effect.gen(function* () {
      yield* handleRightClickPriorityFromContext(makeDeps(), makeServices(), makeRefs(), makeContext('FLINT_AND_STEEL'))

      expect(shearMock).toHaveBeenCalledOnce()
      expect(feedMock).toHaveBeenCalledOnce()
      expect(farmMock).toHaveBeenCalledOnce()
      expect(foodMock).toHaveBeenCalledOnce()
      expect(enderPearlMock).toHaveBeenCalledOnce()
      expect(bucketMock).toHaveBeenCalledOnce()
      expect(igniteMock).toHaveBeenCalledOnce()
      expect(placeMock).toHaveBeenCalledOnce()
    }),
  )
})
