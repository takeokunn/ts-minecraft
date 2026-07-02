import { makeBlockHighlight } from '../presentation/highlight'
import { makeDebugFeatureFlags } from '../presentation/debug'
import { makeCrosshair, makeDamageOverlay, makeFPSCounter, makeHotbarRenderer, makeSleepOverlay } from '../presentation/hud'
import { makeInputService } from '../presentation/input'
import { makeChatPanel, makeInventoryRenderer, makePauseMenu, makePlayerListPanel, makeSettingsOverlay, makeTradingPresentation } from '../presentation/overlay'

export const makePresentationServices = (opts: {
  inputService: ReturnType<typeof makeInputService>
  inventoryRenderer: ReturnType<typeof makeInventoryRenderer>
  playerListPanel: ReturnType<typeof makePlayerListPanel>
  settingsOverlay: ReturnType<typeof makeSettingsOverlay>
  tradingPresentation: ReturnType<typeof makeTradingPresentation>
}) => ({
  blockHighlight: makeBlockHighlight(),
  crosshair: makeCrosshair(),
  damageOverlay: makeDamageOverlay(),
  sleepOverlay: makeSleepOverlay(),
  inputService: opts.inputService,
  hotbarRenderer: makeHotbarRenderer(),
  debugFeatureFlags: makeDebugFeatureFlags(),
  settingsOverlay: opts.settingsOverlay,
  pauseMenu: makePauseMenu(),
  inventoryRenderer: opts.inventoryRenderer,
  playerListPanel: opts.playerListPanel,
  fpsCounter: makeFPSCounter(),
  tradingPresentation: opts.tradingPresentation,
  chatPanel: makeChatPanel(),
})
