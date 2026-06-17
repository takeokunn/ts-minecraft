import type {
  BlockHighlightService,
  InventoryRendererService,
  PauseMenuService,
  SettingsOverlayService,
} from '@ts-minecraft/presentation'

export type FramePresentationServices = {
  readonly blockHighlight: BlockHighlightService
  readonly settingsOverlay: SettingsOverlayService
  readonly pauseMenu: PauseMenuService
  readonly inventoryRenderer: InventoryRendererService
}
