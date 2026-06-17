import { Option } from 'effect'

import type { WorldBootstrap } from './session-world-loader-metadata'

export const DEFAULT_BASE_SPAWN_POSITION = { x: 0, y: 100, z: 0 } as const

export type SessionStartPositions = {
  readonly initialChunkLoadAnchor: { readonly x: number; readonly y: number; readonly z: number }
  readonly spawnPosition: { readonly x: number; readonly y: number; readonly z: number }
  readonly respawnPosition: { readonly x: number; readonly y: number; readonly z: number }
}

export const resolveSessionStartPositions = (
  worldBootstrap: WorldBootstrap,
  defaultRespawnPosition: { readonly x: number; readonly y: number; readonly z: number },
): SessionStartPositions => {
  const savedPlayerState = worldBootstrap.savedPlayerState
  const spawnPosition = Option.getOrElse(
    Option.map(savedPlayerState, (saved) => saved.position),
    () => defaultRespawnPosition,
  )
  const respawnPosition = Option.getOrElse(
    Option.flatMap(savedPlayerState, (saved) => Option.fromNullable(saved.respawnPosition)),
    () => defaultRespawnPosition,
  )
  const initialChunkLoadAnchor = Option.getOrElse(
    Option.map(savedPlayerState, (saved) => saved.position),
    () => worldBootstrap.baseSpawnPosition,
  )

  return {
    initialChunkLoadAnchor,
    spawnPosition,
    respawnPosition,
  }
}
