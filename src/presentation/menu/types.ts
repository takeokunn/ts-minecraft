export type MenuRoute = 'main' | 'pause' | 'settings' | 'none'

export interface MenuAction {
  readonly id: string
  readonly label: string
  readonly description?: string
  readonly disabled?: boolean
}

export interface SettingsCategory {
  readonly id: string
  readonly label: string
  readonly options: ReadonlyArray<SettingsOption>
}

export type SettingsOptionType = 'toggle' | 'slider' | 'select'

export interface BaseSettingsOption {
  readonly id: string
  readonly label: string
  readonly type: SettingsOptionType
  readonly description?: string
}

export interface ToggleSettingsOption extends BaseSettingsOption {
  readonly type: 'toggle'
  readonly value: boolean
}

export interface SliderSettingsOption extends BaseSettingsOption {
  readonly type: 'slider'
  readonly value: number
  readonly min: number
  readonly max: number
  readonly step?: number
}

export interface SelectSettingsOption extends BaseSettingsOption {
  readonly type: 'select'
  readonly value: string
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
}

export type SettingsOption = ToggleSettingsOption | SliderSettingsOption | SelectSettingsOption
