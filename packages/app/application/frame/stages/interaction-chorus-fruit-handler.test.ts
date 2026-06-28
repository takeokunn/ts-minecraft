import { afterEach, describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import { DEFAULT_PLAYER_ID, SlotIndex } from '@ts-minecraft/core'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import {
  CHORUS_FRUIT_FOOD_LEVEL,
  CHORUS_FRUIT_SATURATION_MODIFIER,
  handleChorusFruitUse,
  resolveChorusFruitTeleportTarget,
} from './interaction-item-use-handler/chorus-fruit'
import { selectedHotbarSlotIndex } from './selected-hotbar-slot'

const PLAYER_POSITION = { x: 10, y: 64, z: 10 }

afterEach(() => {
  vi.restoreAllMocks()
})

type ChorusFruitServices = Pick<
  FrameHandlerServices,
  'hotbarService' | 'inventoryService' | 'gameMode' | 'gameState' | 'hungerService'
>

const makeServices = (): ChorusFruitServices => ({
  hotbarService: {
    getSelectedBlockType: vi.fn(() => Effect.succeed(Option.some('CHORUS_FRUIT'))),
    getSelectedSlot: vi.fn(() => Effect.succeed(SlotIndex.make(3))),
  },
  inventoryService: {
    removeBlock: vi.fn(() => Effect.void),
  },
  gameMode: {
    isCreative: vi.fn(() => Effect.succeed(false)),
  },
  gameState: {
    getPlayerPosition: vi.fn(() => Effect.succeed(PLAYER_POSITION)),
    setPlayerPosition: vi.fn(() => Effect.void),
  },
  hungerService: {
    eat: vi.fn(() => Effect.void),
  },
})

describe('resolveChorusFruitTeleportTarget', () => {
  it('keeps player height and applies bounded horizontal random offsets', () => {
    const rolls = [0.25, 0.75]
    const result = resolveChorusFruitTeleportTarget(PLAYER_POSITION, () => rolls.shift() ?? 0.5)

    expect(result).toEqual({ x: 6, y: 64, z: 14 })
  })

  it('clamps out-of-range random rolls to the teleport radius', () => {
    const rolls = [-1, 2]
    const result = resolveChorusFruitTeleportTarget(PLAYER_POSITION, () => rolls.shift() ?? 0.5)

    expect(result).toEqual({ x: 2, y: 64, z: 18 })
  })
})

describe('handleChorusFruitUse', () => {
  it('returns false when selected item is not CHORUS_FRUIT', async () => {
    const services = makeServices()
    services.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('APPLE')))

    const result = await Effect.runPromise(handleChorusFruitUse(services))

    expect(result).toBe(false)
    expect(services.inventoryService.removeBlock).not.toHaveBeenCalled()
    expect(services.gameState.setPlayerPosition).not.toHaveBeenCalled()
  })

  it('survival consumes one fruit, teleports, and restores hunger', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.25).mockReturnValueOnce(0.75)
    const services = makeServices()

    const result = await Effect.runPromise(handleChorusFruitUse(services))

    expect(result).toBe(true)
    expect(services.gameState.getPlayerPosition).toHaveBeenCalledWith(DEFAULT_PLAYER_ID)
    expect(services.inventoryService.removeBlock).toHaveBeenCalledWith(
      'CHORUS_FRUIT',
      1,
      selectedHotbarSlotIndex(SlotIndex.make(3)),
    )
    expect(services.gameState.setPlayerPosition).toHaveBeenCalledWith({ x: 6, y: 64, z: 14 })
    expect(services.hungerService.eat).toHaveBeenCalledWith(
      CHORUS_FRUIT_FOOD_LEVEL,
      CHORUS_FRUIT_SATURATION_MODIFIER,
    )
  })

  it('creative teleports without consuming or restoring hunger', async () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.75).mockReturnValueOnce(0.25)
    const services = makeServices()
    services.gameMode.isCreative.mockReturnValue(Effect.succeed(true))

    const result = await Effect.runPromise(handleChorusFruitUse(services))

    expect(result).toBe(true)
    expect(services.inventoryService.removeBlock).not.toHaveBeenCalled()
    expect(services.gameState.setPlayerPosition).toHaveBeenCalledWith({ x: 14, y: 64, z: 6 })
    expect(services.hungerService.eat).not.toHaveBeenCalled()
  })

  it('does not teleport when survival item consumption fails', async () => {
    const services = makeServices()
    services.inventoryService.removeBlock.mockReturnValue(Effect.fail('slot-empty'))

    const result = await Effect.runPromise(handleChorusFruitUse(services))

    expect(result).toBe(false)
    expect(services.gameState.setPlayerPosition).not.toHaveBeenCalled()
    expect(services.hungerService.eat).not.toHaveBeenCalled()
  })
})
