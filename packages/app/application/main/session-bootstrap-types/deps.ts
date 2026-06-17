import type { BootContext } from '@ts-minecraft/app/main/boot'

import type { SessionBootstrapServices } from './services'

export type SessionBootstrapDeps = {
  readonly bootCtx: BootContext
  readonly worldId: import('@ts-minecraft/core').WorldId
  readonly initialGameMode: import('@ts-minecraft/game').GameMode
  readonly gameLoopService: import('@ts-minecraft/game').GameLoopService
  readonly loadingScreen: import('@ts-minecraft/presentation').LoadingScreenService
  readonly deathScreen: import('@ts-minecraft/presentation').DeathScreenService
  readonly services: SessionBootstrapServices
}
