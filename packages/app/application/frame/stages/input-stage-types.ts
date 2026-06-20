import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'

export type InputDeps = Pick<FrameHandlerDeps, 'gamePausedRef'>

export type InputServices = Pick<
  FrameHandlerServices,
  | 'inputService'
  | 'inventoryRenderer'
  | 'settingsOverlay'
  | 'pauseMenu'
  | 'tradingPresentation'
  | 'droppedItemService'
  | 'hotbarService'
  | 'inventoryService'
  | 'villageService'
  | 'timeService'
  | 'soundManager'
  | 'firstPersonCamera'
>

export type InputRefs = Pick<FrameStageRefs, 'lastSyncedDayLengthSecondsRef'>
