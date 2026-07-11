import type { Option } from 'effect'
import type { BootContext } from '@ts-minecraft/app/main/boot'

export type SessionBootstrapStartupMultiplayerConnection = Option.Option<{
  readonly serverUrl: string
  readonly playerName: string
}>

export type SessionBootstrapCoreDeps = {
  readonly bootCtx: BootContext
  readonly worldId: import('@ts-minecraft/core').WorldId
  readonly worldOpenRequest: import('@ts-minecraft/app/main/session-world-loader').WorldOpenRequest
  readonly initialGameMode: import('@ts-minecraft/game').GameMode
  readonly gameLoopService: import('@ts-minecraft/game').GameLoopService
  readonly startupMultiplayerConnection: SessionBootstrapStartupMultiplayerConnection
}
