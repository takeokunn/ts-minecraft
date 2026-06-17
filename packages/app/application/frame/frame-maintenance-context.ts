import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { Position } from '@ts-minecraft/core'

export type MaintenanceDebugFlags = Readonly<Record<string, boolean>>

export type MaintenanceContextInput = {
  readonly playerPos: Position
  readonly difficulty: string
  readonly debugFlags: MaintenanceDebugFlags
}

export type MaintenanceContext = {
  readonly mobsEnabled: boolean
  readonly mobsSpawnEnabled: boolean
  readonly furnaceEnabled: boolean
  readonly villageEnabled: boolean
  readonly chunkStreamingEnabled: boolean
  readonly chunkSceneSyncEnabled: boolean
  readonly dirtyChunkFlushEnabled: boolean
  readonly cx: number
  readonly cz: number
}

export const resolveMaintenanceContext = ({
  playerPos,
  difficulty,
  debugFlags,
}: MaintenanceContextInput): MaintenanceContext => {
  const mobsEnabled = debugFlags['mobs.enabled'] === true
  const mobsSpawnEnabled = mobsEnabled && debugFlags['mobs.spawn'] === true && difficulty !== 'peaceful'
  const furnaceEnabled = debugFlags['simulation.furnace'] === true
  const villageEnabled = debugFlags['simulation.village'] === true
  const chunkStreamingEnabled = debugFlags['world.chunkStreaming'] === true
  const chunkSceneSyncEnabled = debugFlags['world.chunkSceneSync'] === true
  const dirtyChunkFlushEnabled = chunkSceneSyncEnabled && debugFlags['world.dirtyChunkFlush'] === true

  return {
    mobsEnabled,
    mobsSpawnEnabled,
    furnaceEnabled,
    villageEnabled,
    chunkStreamingEnabled,
    chunkSceneSyncEnabled,
    dirtyChunkFlushEnabled,
    cx: Math.floor(playerPos.x / CHUNK_SIZE),
    cz: Math.floor(playerPos.z / CHUNK_SIZE),
  }
}
