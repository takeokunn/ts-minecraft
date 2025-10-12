export type MenuRoute = 'main' | 'pause' | 'settings' | 'none'

export interface MenuAction {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly disabled?: boolean
}

export type {
  SettingsCategory,
  SettingsOption,
  SettingsOptionType,
  ToggleSettingsOption,
  SliderSettingsOption,
  SelectSettingsOption,
  SettingsMenuModel,
  SettingsOptionId,
  SettingsOptionUpdate,
  SliderOptionId,
  ToggleOptionId,
  SelectOptionId,
  SettingsSelectOption,
  SettingsCategoryId,
} from '@application/settings'
