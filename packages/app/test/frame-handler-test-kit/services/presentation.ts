import { makeBlockHighlight } from '../presentation/highlight'
import { makeDebugFeatureFlags } from '../presentation/debug'
import { makeFPSCounter, makeHotbarRenderer } from '../presentation/hud'
import { makeInputService } from '../presentation/input'
import { makeInventoryRenderer, makePauseMenu, makeSettingsOverlay, makeTradingPresentation } from '../presentation/overlay'

export const makePresentationServices = (opts: {
  inputService: ReturnType<typeof makeInputService>
  inventoryRenderer: ReturnType<typeof makeInventoryRenderer>
  settingsOverlay: ReturnType<typeof makeSettingsOverlay>
  tradingPresentation: ReturnType<typeof makeTradingPresentation>
}) => ({
  blockHighlight: makeBlockHighlight(),
  inputService: opts.inputService,
  hotbarRenderer: makeHotbarRenderer(),
  debugFeatureFlags: makeDebugFeatureFlags(),
  settingsOverlay: opts.settingsOverlay,
  pauseMenu: makePauseMenu(),
  inventoryRenderer: opts.inventoryRenderer,
  fpsCounter: makeFPSCounter(),
  tradingPresentation: opts.tradingPresentation,
})
