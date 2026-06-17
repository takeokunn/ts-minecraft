import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'
import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'

export type SessionBootstrapResult = {
  readonly bootCtx: BootContext
  readonly gameLoopService: import('@ts-minecraft/game').GameLoopService
  readonly loadingScreen: import('@ts-minecraft/presentation').LoadingScreenService
  readonly terrainPool: BootContext['terrainPool']
  readonly runtimeParams: SessionRuntimeParams
  readonly runtimeServices: FrameHandlerServices
  readonly control: SessionControl
}
