import { Schema } from 'effect'

export const SettingsCategoryId = Schema.Literal('rendering', 'gameLoop', 'input', 'performance', 'debug')
export type SettingsCategoryId = Schema.Schema.Type<typeof SettingsCategoryId>

export const SettingsOptionType = Schema.Literal('toggle', 'slider', 'select')
export type SettingsOptionType = Schema.Schema.Type<typeof SettingsOptionType>

export type SettingsOptionId =
  | 'rendering.targetFps'
  | 'rendering.enableVSync'
  | 'rendering.antialiasing'
  | 'rendering.shadowMapping'
  | 'rendering.webgl2'
  | 'gameLoop.enableFixedTimeStep'
  | 'gameLoop.updateInterval'
  | 'gameLoop.maxDeltaTime'
  | 'gameLoop.fixedTimeStep'
  | 'input.mouseSensitivity'
  | 'input.keyRepeatDelay'
  | 'input.enableGamepad'
  | 'performance.enableMetrics'
  | 'performance.memoryLimit'
  | 'performance.gcThreshold'
  | 'debug.enableLogging'
  | 'debug.logLevel'
  | 'debug.showPerformanceStats'
  | 'debug.enableHotReload'

export type ToggleOptionId =
  | 'rendering.enableVSync'
  | 'rendering.antialiasing'
  | 'rendering.shadowMapping'
  | 'rendering.webgl2'
  | 'gameLoop.enableFixedTimeStep'
  | 'input.enableGamepad'
  | 'performance.enableMetrics'
  | 'debug.enableLogging'
  | 'debug.showPerformanceStats'
  | 'debug.enableHotReload'

export type SliderOptionId =
  | 'rendering.targetFps'
  | 'gameLoop.updateInterval'
  | 'gameLoop.maxDeltaTime'
  | 'gameLoop.fixedTimeStep'
  | 'input.mouseSensitivity'
  | 'input.keyRepeatDelay'
  | 'performance.memoryLimit'
  | 'performance.gcThreshold'

export type SelectOptionId = 'debug.logLevel'

export interface SettingsSelectOption {
  readonly value: string
  readonly label: string
}

export interface BaseSettingsOption {
  readonly id: SettingsOptionId
  readonly label: string
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
  readonly step: number
  readonly unit?: string
}

export interface SelectSettingsOption extends BaseSettingsOption {
  readonly type: 'select'
  readonly value: string
  readonly options: ReadonlyArray<SettingsSelectOption>
}

export type SettingsOption = ToggleSettingsOption | SliderSettingsOption | SelectSettingsOption

export interface SettingsCategory {
  readonly id: SettingsCategoryId
  readonly label: string
  readonly description?: string
  readonly options: ReadonlyArray<SettingsOption>
}

export type SettingsMenuModel = ReadonlyArray<SettingsCategory>

export type SettingsOptionUpdate =
  | {
      readonly type: 'toggle'
      readonly id: ToggleOptionId
      readonly value: boolean
    }
  | {
      readonly type: 'slider'
      readonly id: SliderOptionId
      readonly value: number
    }
  | {
      readonly type: 'select'
      readonly id: SelectOptionId
      readonly value: string
    }
