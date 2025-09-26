import { Effect, Layer, Context } from 'effect'
import type { PlayerId } from '@/shared/types/branded'
import type { Vector3D } from '@/shared/types/spatial-brands'
import type { Bed, BedId, BedColor, Sign, SignId, WrittenBook, Direction, FurnitureError } from './FurnitureTypes'

import { FurnitureService } from './FurnitureService'

// Basic implementation for now
const makeFurnitureService = (): FurnitureService => ({
  placeBed: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'insufficient_space' as const,
      message: 'Not implemented yet',
    }),
  sleepInBed: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'bed_not_found' as const,
      message: 'Not implemented yet',
    }),
  wakeUp: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'player_not_sleeping' as const,
      message: 'Not implemented yet',
    }),
  setSpawnPoint: () => Effect.void,
  placeSign: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'block_occupied' as const,
      message: 'Not implemented yet',
    }),
  editSign: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'sign_not_found' as const,
      message: 'Not implemented yet',
    }),
  writeBook: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'book_title_too_long' as const,
      message: 'Not implemented yet',
    }),
  getSign: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'sign_not_found' as const,
      message: 'Not implemented yet',
    }),
  getBed: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'bed_not_found' as const,
      message: 'Not implemented yet',
    }),
  removeBed: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'bed_not_found' as const,
      message: 'Not implemented yet',
    }),
  removeSign: () =>
    Effect.fail({
      _tag: 'FurnitureError' as const,
      reason: 'sign_not_found' as const,
      message: 'Not implemented yet',
    }),
})

export const FurnitureServiceLive = Layer.succeed(FurnitureService, makeFurnitureService())
