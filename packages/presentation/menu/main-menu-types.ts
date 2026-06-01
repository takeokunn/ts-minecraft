import type { WorldId } from '@ts-minecraft/core'
import type { GameMode } from '@ts-minecraft/game'

export type MainMenuChoice =
  | { readonly action: 'newWorld'; readonly worldId: WorldId; readonly gameMode: GameMode }
  | { readonly action: 'loadWorld'; readonly worldId: WorldId }
