import type {
  BlockHighlightService,
  CrosshairService,
  DamageOverlayService,
  InventoryRendererService,
  PauseMenuService,
  PlayerListPanelService,
  SettingsOverlayService,
} from '@ts-minecraft/presentation'

export type FramePresentationServices = {
  readonly blockHighlight: BlockHighlightService
  readonly crosshair: CrosshairService
  readonly damageOverlay: DamageOverlayService
  readonly settingsOverlay: SettingsOverlayService
  readonly pauseMenu: PauseMenuService
  readonly inventoryRenderer: InventoryRendererService
  readonly playerListPanel: PlayerListPanelService
}
