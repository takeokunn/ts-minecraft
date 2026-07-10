import type {
  AchievementToastService,
  DimensionFadeService,
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
  readonly achievementToast: AchievementToastService
  readonly dimensionFade: DimensionFadeService
  readonly sleepOverlay: SleepOverlayService
  readonly settingsOverlay: SettingsOverlayService
  readonly pauseMenu: PauseMenuService
  readonly inventoryRenderer: InventoryRendererService
  readonly playerListPanel: PlayerListPanelService
  readonly chatPanel: ChatPanelService
}
