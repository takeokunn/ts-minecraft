import type { BootContext } from '@ts-minecraft/app/main/boot'

export type SessionBootstrapCoreDeps = {
  readonly bootCtx: BootContext
  readonly worldId: import('@ts-minecraft/core').WorldId
  readonly initialGameMode: import('@ts-minecraft/game').GameMode
  readonly gameLoopService: import('@ts-minecraft/game').GameLoopService
}
