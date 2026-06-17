import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'

export type InputDeps = Pick<FrameHandlerDeps, 'gamePausedRef'>

export type InputServices = Pick<
  FrameHandlerServices,
  | 'inputService'
  | 'inventoryRenderer'
  | 'settingsOverlay'
  | 'pauseMenu'
  | 'tradingPresentation'
  | 'hotbarService'
  | 'inventoryService'
  | 'villageService'
  | 'timeService'
  | 'soundManager'
  | 'firstPersonCamera'
>

export type InputRefs = Pick<FrameStageRefs, 'lastSyncedDayLengthSecondsRef'>
