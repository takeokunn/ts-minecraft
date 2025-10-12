import { GameApplication } from '@application/game-application'
import type { GameApplicationStateError } from '@application/game-application'
import type { GameApplicationConfigPatchInput } from '@application/config'
import { DEFAULT_GAME_APPLICATION_CONFIG, type GameApplicationConfig } from '@application/types'
import {
  SettingsOptionNotFoundError,
  SettingsOptionTypeMismatchError,
  SettingsOptionValueError,
  type SettingsOptionNotFoundError,
  type SettingsOptionTypeMismatchError,
  type SettingsOptionValueError,
} from './errors'
import type {
  SelectOptionId,
  SettingsCategory,
  SettingsCategoryId,
  SettingsMenuModel,
  SettingsOption,
  SettingsOptionId,
  SettingsOptionType,
  SettingsOptionUpdate,
  SliderOptionId,
  ToggleOptionId,
} from './types'
import { Context, Effect, Layer, Match, Option, Ref, Stream, SubscriptionRef } from 'effect'

type SettingsApplicationDomainError =
  | SettingsOptionNotFoundError
  | SettingsOptionTypeMismatchError
  | SettingsOptionValueError

export type SettingsApplicationError = GameApplicationStateError | SettingsApplicationDomainError

export interface SettingsApplicationService {
  readonly menuModel: () => Effect.Effect<SettingsMenuModel, SettingsApplicationError>
  readonly update: (update: SettingsOptionUpdate) => Effect.Effect<SettingsMenuModel, SettingsApplicationError>
  readonly reset: () => Effect.Effect<SettingsMenuModel, SettingsApplicationError>
  readonly refresh: () => Effect.Effect<SettingsMenuModel, SettingsApplicationError>
  readonly stream: () => Stream.Stream<SettingsMenuModel>
}

export const SettingsApplicationServiceTag = Context.GenericTag<SettingsApplicationService>(
  '@minecraft/application/settings/SettingsApplicationService'
)
export const SettingsApplicationService = SettingsApplicationServiceTag

type ToggleDefinition = {
  readonly id: ToggleOptionId
  readonly type: 'toggle'
  readonly category: SettingsCategoryId
  readonly label: string
  readonly description?: string
  readonly read: (config: GameApplicationConfig) => boolean
  readonly write: (value: boolean) => Effect.Effect<GameApplicationConfigPatchInput, SettingsOptionValueError>
}

type SliderDefinition = {
  readonly id: SliderOptionId
  readonly type: 'slider'
  readonly category: SettingsCategoryId
  readonly label: string
  readonly description?: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit?: string
  readonly read: (config: GameApplicationConfig) => number
  readonly write: (value: number) => Effect.Effect<GameApplicationConfigPatchInput, SettingsOptionValueError>
}

type SelectDefinition = {
  readonly id: SelectOptionId
  readonly type: 'select'
  readonly category: SettingsCategoryId
  readonly label: string
  readonly description?: string
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly read: (config: GameApplicationConfig) => string
  readonly write: (value: string) => Effect.Effect<GameApplicationConfigPatchInput, SettingsOptionValueError>
}

type SettingsOptionDefinition = ToggleDefinition | SliderDefinition | SelectDefinition

type CategoryDefinition = {
  readonly id: SettingsCategoryId
  readonly label: string
  readonly description?: string
}

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const roundTo = (value: number, precision: number): number => {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

const sliderPatch = (
  categoryKey: keyof GameApplicationConfig,
  field: string,
  min: number,
  max: number,
  precision: number = 2
) => (value: number) =>
  Effect.succeed<GameApplicationConfigPatchInput>({
    [categoryKey]: {
      [field]: precision === 0 ? Math.round(clampNumber(value, min, max)) : roundTo(clampNumber(value, min, max), precision),
    },
  })

const togglePatch =
  (categoryKey: keyof GameApplicationConfig, field: string) =>
  (value: boolean): Effect.Effect<GameApplicationConfigPatchInput, SettingsOptionValueError> =>
    Effect.succeed({
      [categoryKey]: {
        [field]: value,
      },
    })

const selectPatch = (
  categoryKey: keyof GameApplicationConfig,
  field: string,
  options: ReadonlyArray<{ readonly value: string }>
) => (value: string) =>
  Match.value(options.some((candidate) => candidate.value === value)).pipe(
    Match.when(true, () =>
      Effect.succeed<GameApplicationConfigPatchInput>({
        [categoryKey]: {
          [field]: value,
        },
      })
    ),
    Match.orElse(() =>
      Effect.fail(
        SettingsOptionValueError.make({
          optionId: `${String(categoryKey)}.${field}`,
          reason: 'サポートされていない値です',
          value,
        })
      )
    )
  )

const categoryDefinitions: ReadonlyArray<CategoryDefinition> = [
  { id: 'rendering', label: 'レンダリング' },
  { id: 'gameLoop', label: 'ゲームループ' },
  { id: 'input', label: '入力' },
  { id: 'performance', label: 'パフォーマンス' },
  { id: 'debug', label: 'デバッグ' },
] as const

const optionDefinitions: ReadonlyArray<SettingsOptionDefinition> = [
  {
    id: 'rendering.targetFps',
    type: 'slider',
    category: 'rendering',
    label: 'ターゲットFPS',
    description: '描画ループの目標フレームレートを設定します。',
    min: 30,
    max: 240,
    step: 1,
    read: (config) => config.rendering.targetFps,
    write: sliderPatch('rendering', 'targetFps', 30, 240, 0),
  },
  {
    id: 'rendering.enableVSync',
    type: 'toggle',
    category: 'rendering',
    label: '垂直同期 (VSync)',
    description: 'ディスプレイのリフレッシュレートにフレームを同期します。',
    read: (config) => config.rendering.enableVSync,
    write: togglePatch('rendering', 'enableVSync'),
  },
  {
    id: 'rendering.antialiasing',
    type: 'toggle',
    category: 'rendering',
    label: 'アンチエイリアス',
    description: 'ジギーを低減するためのアンチエイリアスを有効にします。',
    read: (config) => config.rendering.antialiasing,
    write: togglePatch('rendering', 'antialiasing'),
  },
  {
    id: 'rendering.shadowMapping',
    type: 'toggle',
    category: 'rendering',
    label: 'シャドウマッピング',
    description: '影の表現を有効にします。',
    read: (config) => config.rendering.shadowMapping,
    write: togglePatch('rendering', 'shadowMapping'),
  },
  {
    id: 'rendering.webgl2',
    type: 'toggle',
    category: 'rendering',
    label: 'WebGL 2',
    description: '利用可能な場合は WebGL 2 を使用します。',
    read: (config) => config.rendering.webgl2,
    write: togglePatch('rendering', 'webgl2'),
  },
  {
    id: 'gameLoop.enableFixedTimeStep',
    type: 'toggle',
    category: 'gameLoop',
    label: '固定タイムステップ',
    description: '固定タイムステップ方式でゲームループを進行します。',
    read: (config) => config.gameLoop.enableFixedTimeStep,
    write: togglePatch('gameLoop', 'enableFixedTimeStep'),
  },
  {
    id: 'gameLoop.updateInterval',
    type: 'slider',
    category: 'gameLoop',
    label: '更新間隔',
    description: 'ゲームループ更新間隔 (ms) を設定します。',
    min: 8,
    max: 33,
    step: 0.1,
    unit: 'ms',
    read: (config) => config.gameLoop.updateInterval,
    write: sliderPatch('gameLoop', 'updateInterval', 8, 33, 2),
  },
  {
    id: 'gameLoop.maxDeltaTime',
    type: 'slider',
    category: 'gameLoop',
    label: '最大デルタ時間',
    description: '1フレームあたりの最大デルタ時間 (ms) を制限します。',
    min: 16,
    max: 100,
    step: 1,
    unit: 'ms',
    read: (config) => config.gameLoop.maxDeltaTime,
    write: sliderPatch('gameLoop', 'maxDeltaTime', 16, 100, 0),
  },
  {
    id: 'gameLoop.fixedTimeStep',
    type: 'slider',
    category: 'gameLoop',
    label: '固定タイムステップ幅',
    description: '固定タイムステップ時の1フレームあたりの時間 (ms)。',
    min: 8,
    max: 33,
    step: 0.01,
    unit: 'ms',
    read: (config) => config.gameLoop.fixedTimeStep,
    write: sliderPatch('gameLoop', 'fixedTimeStep', 8, 33, 2),
  },
  {
    id: 'input.mouseSensitivity',
    type: 'slider',
    category: 'input',
    label: 'マウス感度',
    description: 'マウスの回転感度を設定します。',
    min: 0.1,
    max: 10,
    step: 0.1,
    read: (config) => config.input.mouseSensitivity,
    write: sliderPatch('input', 'mouseSensitivity', 0.1, 10, 2),
  },
  {
    id: 'input.keyRepeatDelay',
    type: 'slider',
    category: 'input',
    label: 'キーリピート遅延',
    description: 'キー入力をリピートするまでの遅延時間 (ms)。',
    min: 100,
    max: 1000,
    step: 25,
    unit: 'ms',
    read: (config) => config.input.keyRepeatDelay,
    write: sliderPatch('input', 'keyRepeatDelay', 100, 1000, 0),
  },
  {
    id: 'input.enableGamepad',
    type: 'toggle',
    category: 'input',
    label: 'ゲームパッド',
    description: 'ゲームパッド入力を有効にします。',
    read: (config) => config.input.enableGamepad,
    write: togglePatch('input', 'enableGamepad'),
  },
  {
    id: 'performance.enableMetrics',
    type: 'toggle',
    category: 'performance',
    label: 'メトリクス収集',
    description: 'ランタイムメトリクスの収集を有効にします。',
    read: (config) => config.performance.enableMetrics,
    write: togglePatch('performance', 'enableMetrics'),
  },
  {
    id: 'performance.memoryLimit',
    type: 'slider',
    category: 'performance',
    label: 'メモリ上限',
    description: 'ゲームに割り当てるメモリ上限 (MB)。',
    min: 512,
    max: 8192,
    step: 128,
    unit: 'MB',
    read: (config) => config.performance.memoryLimit,
    write: sliderPatch('performance', 'memoryLimit', 512, 8192, 0),
  },
  {
    id: 'performance.gcThreshold',
    type: 'slider',
    category: 'performance',
    label: 'GCしきい値',
    description: 'ガベージコレクションのトリガーしきい値 (0-1)。',
    min: 0.5,
    max: 0.95,
    step: 0.01,
    read: (config) => config.performance.gcThreshold,
    write: sliderPatch('performance', 'gcThreshold', 0.5, 0.95, 2),
  },
  {
    id: 'debug.enableLogging',
    type: 'toggle',
    category: 'debug',
    label: 'ログ出力',
    description: 'アプリケーションログを有効にします。',
    read: (config) => config.debug.enableLogging,
    write: togglePatch('debug', 'enableLogging'),
  },
  {
    id: 'debug.logLevel',
    type: 'select',
    category: 'debug',
    label: 'ログレベル',
    description: 'ログ出力の詳細度を設定します。',
    options: [
      { value: 'debug', label: 'Debug' },
      { value: 'info', label: 'Info' },
      { value: 'warn', label: 'Warn' },
      { value: 'error', label: 'Error' },
    ],
    read: (config) => config.debug.logLevel,
    write: selectPatch('debug', 'logLevel', [
      { value: 'debug' },
      { value: 'info' },
      { value: 'warn' },
      { value: 'error' },
    ]),
  },
  {
    id: 'debug.showPerformanceStats',
    type: 'toggle',
    category: 'debug',
    label: 'パフォーマンス表示',
    description: 'HUDにパフォーマンス統計を表示します。',
    read: (config) => config.debug.showPerformanceStats,
    write: togglePatch('debug', 'showPerformanceStats'),
  },
  {
    id: 'debug.enableHotReload',
    type: 'toggle',
    category: 'debug',
    label: 'ホットリロード',
    description: 'デバッグ用のホットリロードを有効にします。',
    read: (config) => config.debug.enableHotReload,
    write: togglePatch('debug', 'enableHotReload'),
  },
] as const

const definitionsByOptionId: Record<SettingsOptionId, SettingsOptionDefinition> = optionDefinitions.reduce(
  (record, definition) => ({
    ...record,
    [definition.id]: definition,
  }),
  {} as Record<SettingsOptionId, SettingsOptionDefinition>
)

const optionTypeOf = (definition: SettingsOptionDefinition): SettingsOptionType => definition.type

const ensureDefinition = (
  id: SettingsOptionId
): Effect.Effect<SettingsOptionDefinition, SettingsOptionNotFoundError> =>
  Option.fromNullable(definitionsByOptionId[id]).pipe(
    Option.match({
      onSome: (definition) => Effect.succeed(definition),
      onNone: () =>
        Effect.fail(
          SettingsOptionNotFoundError.make({
            optionId: id,
          })
        ),
    })
  )

const ensureMatchingType = (
  definition: SettingsOptionDefinition,
  expected: SettingsOptionType
): Effect.Effect<SettingsOptionDefinition, SettingsOptionTypeMismatchError> =>
  Match.value(optionTypeOf(definition)).pipe(
    Match.when(expected, () => Effect.succeed(definition)),
    Match.orElse((received) =>
      Effect.fail(
        SettingsOptionTypeMismatchError.make({
          optionId: definition.id,
          expectedType: expected,
          receivedType: received,
        })
      )
    )
  )

const buildOption = (definition: SettingsOptionDefinition, config: GameApplicationConfig): SettingsOption =>
  Match.value(definition.type).pipe(
    Match.when('toggle', () => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      type: 'toggle' as const,
      value: definition.read(config),
    })),
    Match.when('slider', () => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      type: 'slider' as const,
      value: definition.read(config),
      min: definition.min,
      max: definition.max,
      step: definition.step,
      unit: definition.unit,
    })),
    Match.when('select', () => ({
      id: definition.id,
      label: definition.label,
      description: definition.description,
      type: 'select' as const,
      value: definition.read(config),
      options: definition.options,
    })),
    Match.exhaustive
  )

const buildMenuModel = (config: GameApplicationConfig): SettingsMenuModel =>
  categoryDefinitions.map<SettingsCategory>((category) => ({
    id: category.id,
    label: category.label,
    description: category.description,
    options: optionDefinitions
      .filter((definition) => definition.category === category.id)
      .map((definition) => buildOption(definition, config)),
  }))

const currentMenuModel = (
  gameApplication: GameApplication
): Effect.Effect<SettingsMenuModel, never> =>
  gameApplication
    .getState()
    .pipe(Effect.map((state) => buildMenuModel(state.config)))

const publishModel = (
  model: SettingsMenuModel,
  cache: Ref.Ref<SettingsMenuModel>,
  updates: SubscriptionRef.SubscriptionRef<SettingsMenuModel>
) =>
  Ref.set(cache, model).pipe(
    Effect.zipLeft(SubscriptionRef.set(updates, model))
  )

const applyToggle = (
  definition: ToggleDefinition,
  value: boolean,
  gameApplication: GameApplication
): Effect.Effect<void, SettingsOptionValueError | GameApplicationStateError> =>
  definition.write(value).pipe(Effect.flatMap((patch) => gameApplication.updateConfig(patch)))

const applySlider = (
  definition: SliderDefinition,
  value: number,
  gameApplication: GameApplication
): Effect.Effect<void, SettingsOptionValueError | GameApplicationStateError> =>
  definition.write(value).pipe(Effect.flatMap((patch) => gameApplication.updateConfig(patch)))

const applySelect = (
  definition: SelectDefinition,
  value: string,
  gameApplication: GameApplication
): Effect.Effect<void, SettingsOptionValueError | GameApplicationStateError> =>
  definition.write(value).pipe(Effect.flatMap((patch) => gameApplication.updateConfig(patch)))

const applyUpdate = (
  update: SettingsOptionUpdate,
  gameApplication: GameApplication
): Effect.Effect<void, SettingsApplicationDomainError | GameApplicationStateError> =>
  ensureDefinition(update.id)
    .pipe(Effect.flatMap((definition) => ensureMatchingType(definition, update.type)))
    .pipe(
      Effect.flatMap((definition) =>
        Match.value(definition.type).pipe(
          Match.when('toggle', () => applyToggle(definition, update.value, gameApplication)),
          Match.when('slider', () => applySlider(definition, update.value, gameApplication)),
          Match.when('select', () => applySelect(definition, update.value, gameApplication)),
          Match.exhaustive
        )
      )
    )

const resetPatch: GameApplicationConfigPatchInput = {
  rendering: { ...DEFAULT_GAME_APPLICATION_CONFIG.rendering },
  gameLoop: { ...DEFAULT_GAME_APPLICATION_CONFIG.gameLoop },
  input: { ...DEFAULT_GAME_APPLICATION_CONFIG.input },
  performance: { ...DEFAULT_GAME_APPLICATION_CONFIG.performance },
  debug: { ...DEFAULT_GAME_APPLICATION_CONFIG.debug },
}

const makeSettingsService = Effect.gen(function* () {
  const gameApplication = yield* GameApplication
  const initialModel = yield* currentMenuModel(gameApplication)
  const cache = yield* Ref.make<SettingsMenuModel>(initialModel)
  const subscription = yield* SubscriptionRef.make<SettingsMenuModel>(initialModel)

  const refresh = currentMenuModel(gameApplication).pipe(
    Effect.tap((model) => publishModel(model, cache, subscription))
  )

  return SettingsApplicationService.of({
    menuModel: () => Ref.get(cache),
    stream: () => subscription.changes,
    refresh,
    reset: Effect.gen(function* () {
      yield* gameApplication.updateConfig(resetPatch)
      const model = yield* currentMenuModel(gameApplication)
      yield* publishModel(model, cache, subscription)
      return model
    }),
    update: (update) =>
      applyUpdate(update, gameApplication).pipe(
        Effect.flatMap(() => currentMenuModel(gameApplication)),
        Effect.tap((model) => publishModel(model, cache, subscription))
      ),
  })
})

export const SettingsApplicationServiceLive = Layer.scoped(SettingsApplicationServiceTag, makeSettingsService)
