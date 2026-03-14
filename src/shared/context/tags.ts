import { Context, Effect } from 'effect'
import { PhysicsBodyId, Position } from '@/shared/kernel'
import type { Vector3 } from '@/shared/math/three/vector3'
import { PhysicsError, StorageError, ChunkError } from '@/domain/errors'
import { AddBodyConfig } from '@/application/physics/physics-service'
import { ChunkCoord, BlockType } from '@/domain'
import { Chunk } from '@/domain/chunk'
import type { WorldMetadata } from '@/infrastructure/storage/storage-service'

// PhysicsTag for physics operations
export class PhysicsTag extends Context.Tag('Physics')<PhysicsTag, {
  readonly addBody: (config: AddBodyConfig) => Effect.Effect<PhysicsBodyId, PhysicsError>
  readonly removeBody: (bodyId: PhysicsBodyId) => Effect.Effect<void, PhysicsError>
  readonly setVelocity: (bodyId: PhysicsBodyId, velocity: Vector3) => Effect.Effect<void, PhysicsError>
  readonly getVelocity: (bodyId: PhysicsBodyId) => Effect.Effect<Vector3, PhysicsError>
  readonly getPosition: (bodyId: PhysicsBodyId) => Effect.Effect<Position, PhysicsError>
  readonly step: (deltaTime: number) => Effect.Effect<void, PhysicsError>
  readonly isGrounded: (bodyId: PhysicsBodyId) => Effect.Effect<boolean, never>
}>() {}

// StorageTag for persistence operations
export class StorageTag extends Context.Tag('Storage')<StorageTag, {
  readonly saveChunk: (worldId: string, coord: ChunkCoord, data: Uint8Array) => Effect.Effect<void, StorageError>
  readonly loadChunk: (worldId: string, coord: ChunkCoord) => Effect.Effect<Uint8Array, StorageError>
  readonly deleteChunk: (worldId: string, coord: ChunkCoord) => Effect.Effect<void, StorageError>
  readonly saveWorldMetadata: (worldId: string, metadata: WorldMetadata) => Effect.Effect<void, StorageError>
  readonly loadWorldMetadata: (worldId: string) => Effect.Effect<WorldMetadata | undefined, StorageError>
}>() {}

// ChunkTag for chunk operations
export class ChunkTag extends Context.Tag('Chunk')<ChunkTag, {
  readonly createChunk: (coord: ChunkCoord) => Effect.Effect<Chunk, ChunkError>
  readonly getChunk: (coord: ChunkCoord) => Effect.Effect<Chunk, ChunkError>
  readonly setBlock: (coord: ChunkCoord, x: number, y: number, z: number, blockType: BlockType) => Effect.Effect<void, ChunkError>
  readonly getBlock: (coord: ChunkCoord, x: number, y: number, z: number) => Effect.Effect<BlockType, never>
}>() {}
