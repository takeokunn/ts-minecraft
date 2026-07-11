import type { WorldId } from '@ts-minecraft/core'
import type { GameMode } from '@ts-minecraft/game'

export type MainMenuChoice =
  | { readonly action: 'newWorld'; readonly worldId: WorldId; readonly displayName: string; readonly gameMode: GameMode; readonly seed?: number }
  | { readonly action: 'loadWorld'; readonly worldId: WorldId }
  | { readonly action: 'multiplayer'; readonly serverUrl: string; readonly playerName: string }
