import { Layer } from 'effect'

import { DomOperationsService } from '@ts-minecraft/presentation'
import { SettingsOverlayService } from '@ts-minecraft/presentation'
import { SettingsService, SettingsStorageServiceLayer } from '@ts-minecraft/game'
import { EnvironmentLayer } from '@ts-minecraft/world'

const SettingsLayer = SettingsService.Default.pipe(
  Layer.provide(SettingsStorageServiceLayer),
  Layer.provide(EnvironmentLayer),
)

export const SettingsOverlayLayer = SettingsOverlayService.Default.pipe(
  Layer.provide(SettingsLayer),
  Layer.provide(DomOperationsService.Default),
)

export const SettingsPresentationLayers = SettingsLayer.pipe(
  Layer.provideMerge(SettingsOverlayLayer),
)
