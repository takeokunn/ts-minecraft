export {
  SettingsApplicationService,
  SettingsApplicationServiceLive,
  SettingsApplicationServiceTag,
  type SettingsApplicationError,
} from './service'

export type {
  SelectOptionId,
  SettingsCategory,
  SettingsCategoryId,
  SettingsMenuModel,
  SettingsOption,
  SettingsOptionId,
  SettingsOptionType,
  SettingsOptionUpdate,
  SettingsSelectOption,
  SliderOptionId,
  ToggleOptionId,
} from './types'

export {
  SettingsOptionNotFoundError,
  SettingsOptionTypeMismatchError,
  SettingsOptionValueError,
  type SettingsOptionNotFoundError,
  type SettingsOptionTypeMismatchError,
  type SettingsOptionValueError,
} from './errors'
