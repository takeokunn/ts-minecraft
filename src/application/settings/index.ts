export {
  SettingsApplicationService,
  SettingsApplicationServiceLive,
  SettingsApplicationServiceTag,
  type SettingsApplicationError,
} from './service'

export type {
  SettingsCategory,
  SettingsMenuModel,
  SettingsOption,
  SettingsOptionId,
  SettingsOptionType,
  SettingsOptionUpdate,
  SliderOptionId,
  ToggleOptionId,
  SelectOptionId,
  SettingsSelectOption,
  SettingsCategoryId,
} from './types'

export {
  SettingsOptionNotFoundError,
  type SettingsOptionNotFoundError,
  SettingsOptionTypeMismatchError,
  type SettingsOptionTypeMismatchError,
  SettingsOptionValueError,
  type SettingsOptionValueError,
} from './errors'
