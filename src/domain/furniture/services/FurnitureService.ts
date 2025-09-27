import { Context, Effect } from 'effect'
import type { PlayerId, Vector3D } from '../types/brands'
import { Bed, BedId, BedColor, Sign, SignId, WrittenBook, Direction, FurnitureError } from '../types/FurnitureTypes'

export interface FurnitureService {
  readonly placeBed: (
    position: Vector3D,
    color: BedColor,
    direction: Direction,
    placerId: PlayerId
  ) => Effect.Effect<Bed, FurnitureError>

  readonly sleepInBed: (bedId: BedId, playerId: PlayerId) => Effect.Effect<void, FurnitureError>

  readonly wakeUp: (playerId: PlayerId) => Effect.Effect<void, FurnitureError>

  readonly setSpawnPoint: (playerId: PlayerId, position: Vector3D) => Effect.Effect<void, never>

  readonly placeSign: (
    position: Vector3D,
    isWallSign: boolean,
    direction: Direction,
    placerId: PlayerId
  ) => Effect.Effect<Sign, FurnitureError>

  readonly editSign: (
    signId: SignId,
    lines: readonly [string, string, string, string],
    editorId: PlayerId
  ) => Effect.Effect<void, FurnitureError>

  readonly writeBook: (
    title: string,
    pages: ReadonlyArray<string>,
    authorId: PlayerId
  ) => Effect.Effect<WrittenBook, FurnitureError>

  readonly getSign: (signId: SignId) => Effect.Effect<Sign, FurnitureError>

  readonly getBed: (bedId: BedId) => Effect.Effect<Bed, FurnitureError>

  readonly removeBed: (bedId: BedId) => Effect.Effect<void, FurnitureError>

  readonly removeSign: (signId: SignId) => Effect.Effect<void, FurnitureError>
}

export const FurnitureService = Context.GenericTag<FurnitureService>('@minecraft/domain/FurnitureService')
