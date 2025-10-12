export type MenuRoute = 'main' | 'pause' | 'settings' | 'none'

export interface MenuAction {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly disabled?: boolean
}

export type {
  SelectOptionId,
  SelectSettingsOption,
  SettingsCategory,
  SettingsCategoryId,
  SettingsMenuModel,
  SettingsOption,
  SettingsOptionId,
  SettingsOptionType,
  SettingsOptionUpdate,
  SettingsSelectOption,
  SliderOptionId,
  SliderSettingsOption,
  ToggleOptionId,
  ToggleSettingsOption,
} from '@application/settings'
