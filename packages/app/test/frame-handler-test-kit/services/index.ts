import { Option } from 'effect'
import { makeInputService } from '../presentation/input'
import { makeInventoryRenderer, makeSettingsOverlay, makeTradingPresentation } from '../presentation/overlay'
import { makeCameraState } from '../entity'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { CameraStateStub } from '../shared'
import { makeEntityServices } from './entity'
import { makePresentationServices } from './presentation'
import { makeWorldServices } from './world'

export const makeServices = (opts: {
  inputService: ReturnType<typeof makeInputService>
  inventoryRenderer: ReturnType<typeof makeInventoryRenderer>
  settingsOverlay: ReturnType<typeof makeSettingsOverlay>
  tradingPresentation?: ReturnType<typeof makeTradingPresentation>
}): FrameHandlerServices & { cameraState: CameraStateStub } => {
  const { inputService, inventoryRenderer, settingsOverlay } = opts
  const tradingPresentation = opts.tradingPresentation ?? makeTradingPresentation({ open: false })
  const cameraState = makeCameraState()

  return {
    ...makePresentationServices({
      inputService,
      inventoryRenderer,
      settingsOverlay,
      tradingPresentation,
    }),
    ...makeEntityServices(cameraState.service),
    ...makeWorldServices(),
    multiplayer: Option.none(),
    cameraState: cameraState.state,
  }
}
