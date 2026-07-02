import type {
  BlockHighlightService,
  ChatPanelService,
  CrosshairService,
  DamageOverlayService,
  SleepOverlayService,
  InventoryRendererService,
  PauseMenuService,
  PlayerListPanelService,
  SettingsOverlayService,
} from '@ts-minecraft/presentation'

export type FramePresentationServices = {
  readonly blockHighlight: BlockHighlightService
  readonly crosshair: CrosshairService
  readonly damageOverlay: DamageOverlayService
  readonly sleepOverlay: SleepOverlayService
  readonly settingsOverlay: SettingsOverlayService
  readonly pauseMenu: PauseMenuService
  readonly inventoryRenderer: InventoryRendererService
  readonly playerListPanel: PlayerListPanelService
  readonly chatPanel: ChatPanelService
}
