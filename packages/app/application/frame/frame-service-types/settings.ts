import type { SettingsService } from '@ts-minecraft/game'
import type { DebugFeatureFlagsService } from '@ts-minecraft/app/debug-feature-flags'

export type FrameSettingsServices = {
  readonly settingsService: SettingsService
  readonly debugFeatureFlags: DebugFeatureFlagsService
}
