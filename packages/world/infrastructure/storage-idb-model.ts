import { Brand } from 'effect'
import type { ChunkCoord, WorldId } from '@ts-minecraft/core'
import type { DBSchema } from './idb-utils'
import type { ChunkStorageValue } from '../domain/storage-service-port'
import type { WorldMetadataEncoded } from '../domain/world-metadata-model'

export const WORLD_SCHEMA_VERSION = 3
export const DB_NAME = 'minecraft-worlds'
export const DB_VERSION = 2
export const STORE_CHUNKS = 'chunks'
export const STORE_METADATA = 'metadata'

export type MinecraftWorldsDB = DBSchema & {
  chunks: {
    key: string
    value: ChunkStorageValue
  }
  metadata: {
    key: string
    value: WorldMetadataEncoded
  }
}

export type ChunkStorageKey = string & Brand.Brand<'ChunkStorageKey'>
export const ChunkStorageKey = Brand.nominal<ChunkStorageKey>()

export const chunkKey = (worldId: WorldId, chunkCoord: ChunkCoord): ChunkStorageKey =>
  ChunkStorageKey(`${worldId}:${chunkCoord.x}:${chunkCoord.z}`)
