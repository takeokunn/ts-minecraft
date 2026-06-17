import type { Settings } from './settings.schema'

export const applySettingsEnvironmentPolicy = (
  settings: Settings,
  isLocalhost: boolean,
): Settings =>
  isLocalhost ? { ...settings, audioEnabled: false } : settings
