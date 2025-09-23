import { Context, Effect, Layer, Ref, Match, pipe, Option } from 'effect'
import { Schema } from 'effect'
import { MouseDelta } from './types'
import { SensitivityValue } from '../../shared/types/branded'

// 感度プリセット
export const SensitivityPreset = Schema.Literal('low', 'medium', 'high', 'gaming', 'precision', 'custom')
export type SensitivityPreset = Schema.Schema.Type<typeof SensitivityPreset>

// 感度カーブタイプ
export const SensitivityCurve = Schema.Literal('linear', 'accelerated', 'decelerated', 'custom')
export type SensitivityCurve = Schema.Schema.Type<typeof SensitivityCurve>

// マウス感度設定
export const MouseSensitivityConfig = Schema.Struct({
  xSensitivity: Schema.Number.pipe(Schema.positive()),
  ySensitivity: Schema.Number.pipe(Schema.positive()),
  globalMultiplier: Schema.Number.pipe(Schema.positive()),
  dpi: Schema.Number.pipe(Schema.int(), Schema.positive()),
  invertX: Schema.Boolean,
  invertY: Schema.Boolean,
  curve: SensitivityCurve,
  preset: SensitivityPreset,
  customCurvePoints: Schema.optional(Schema.Array(Schema.Number)),
  deadZone: Schema.Number.pipe(Schema.between(0, 1)),
  smoothing: Schema.Number.pipe(Schema.between(0, 1)),
})
export type MouseSensitivityConfig = Schema.Schema.Type<typeof MouseSensitivityConfig>

// 調整済みマウスデルタ
export const AdjustedMouseDelta = Schema.Struct({
  deltaX: Schema.Number,
  deltaY: Schema.Number,
  originalDeltaX: Schema.Number,
  originalDeltaY: Schema.Number,
  appliedSensitivity: Schema.Number,
  timestamp: Schema.Number.pipe(Schema.positive()),
})
export type AdjustedMouseDelta = Schema.Schema.Type<typeof AdjustedMouseDelta>

// 感度エラー
export const MouseSensitivityErrorSchema = Schema.Struct({
  _tag: Schema.Literal('MouseSensitivityError'),
  message: Schema.String,
  config: Schema.optional(Schema.Unknown),
})

export type MouseSensitivityError = Schema.Schema.Type<typeof MouseSensitivityErrorSchema>

export const MouseSensitivityError = (params: Omit<MouseSensitivityError, '_tag'>): MouseSensitivityError => ({
  _tag: 'MouseSensitivityError' as const,
  ...params,
})

// マウス感度サービス
export interface MouseSensitivity {
  readonly getConfig: () => Effect.Effect<MouseSensitivityConfig, MouseSensitivityError>
  readonly setConfig: (config: MouseSensitivityConfig) => Effect.Effect<void, MouseSensitivityError>
  readonly applySensitivity: (delta: MouseDelta) => Effect.Effect<AdjustedMouseDelta, MouseSensitivityError>
  readonly setPreset: (preset: SensitivityPreset) => Effect.Effect<void, MouseSensitivityError>
  readonly setSensitivity: (x: SensitivityValue, y: SensitivityValue) => Effect.Effect<void, MouseSensitivityError>
  readonly setGlobalMultiplier: (multiplier: number) => Effect.Effect<void, MouseSensitivityError>
  readonly invertAxis: (x: boolean, y: boolean) => Effect.Effect<void, MouseSensitivityError>
  readonly setCurve: (curve: SensitivityCurve) => Effect.Effect<void, MouseSensitivityError>
  readonly resetToDefault: () => Effect.Effect<void, MouseSensitivityError>
}

export const MouseSensitivity = Context.GenericTag<MouseSensitivity>('@minecraft/MouseSensitivity')

// デフォルト設定
export const defaultSensitivityConfig: MouseSensitivityConfig = {
  xSensitivity: 1.0,
  ySensitivity: 1.0,
  globalMultiplier: 1.0,
  dpi: 800,
  invertX: false,
  invertY: false,
  curve: 'linear',
  preset: 'medium',
  deadZone: 0.0,
  smoothing: 0.0,
}

// プリセット定義
export const sensitivityPresets: Record<SensitivityPreset, Partial<MouseSensitivityConfig>> = {
  low: {
    xSensitivity: 0.3,
    ySensitivity: 0.3,
    globalMultiplier: 0.5,
    curve: 'linear',
  },
  medium: {
    xSensitivity: 1.0,
    ySensitivity: 1.0,
    globalMultiplier: 1.0,
    curve: 'linear',
  },
  high: {
    xSensitivity: 2.0,
    ySensitivity: 2.0,
    globalMultiplier: 1.5,
    curve: 'linear',
  },
  gaming: {
    xSensitivity: 1.5,
    ySensitivity: 1.2,
    globalMultiplier: 1.2,
    curve: 'accelerated',
    deadZone: 0.02,
  },
  precision: {
    xSensitivity: 0.5,
    ySensitivity: 0.5,
    globalMultiplier: 0.8,
    curve: 'decelerated',
    smoothing: 0.1,
  },
  custom: {
    // カスタム設定は変更しない
  },
}

// マウス感度の実装
export const MouseSensitivityLive = Layer.effect(
  MouseSensitivity,
  Effect.gen(function* () {
    const config = yield* Ref.make<MouseSensitivityConfig>(defaultSensitivityConfig)
    const smoothingBuffer = yield* Ref.make<MouseDelta[]>([])

    // 感度カーブ適用
    const applyCurve = (value: number, curve: SensitivityCurve, customPoints?: number[]): number => {
      const absValue = Math.abs(value)
      const sign = Math.sign(value)

      return pipe(
        curve,
        Match.value,
        Match.when('linear', () => value),
        Match.when('accelerated', () => sign * Math.pow(absValue, 1.2)),
        Match.when('decelerated', () => sign * Math.pow(absValue, 0.8)),
        Match.when('custom', () =>
          pipe(
            Option.fromNullable(customPoints),
            Option.flatMap((points) =>
              pipe(
                points.length === 0,
                Match.value,
                Match.when(true, () => Option.none<number[]>()),
                Match.orElse(() => Option.some(points))
              )
            ),
            Option.match({
              onNone: () => value,
              onSome: (points: number[]) => {
                // 簡単な線形補間による custom curve
                const normalizedInput = Math.min(absValue, 1.0)
                const segmentSize = 1.0 / (points.length - 1)
                const segmentIndex = Math.floor(normalizedInput / segmentSize)
                const segmentProgress = (normalizedInput % segmentSize) / segmentSize

                return pipe(
                  segmentIndex >= points.length - 1,
                  Match.value,
                  Match.when(true, () =>
                    pipe(
                      Option.fromNullable(points[points.length - 1]
    }),
    Option.match({
                        onNone: () => value,
                        onSome: (lastPoint) => sign * lastPoint,
                      })
                    )
                  ),
                  Match.orElse(() => {
                    const currentPoint = points[segmentIndex]
                    const nextPoint = points[segmentIndex + 1]

                    return pipe(
                      Option.fromNullable(currentPoint),
                      Option.flatMap((current) =>
                        Option.fromNullable(nextPoint).pipe(Option.map((next) => ({ current, next })))
                      ),
                      Option.match({
                        onNone: () => value,
                        onSome: ({ current, next }) => {
                          const interpolated = current + (next - current) * segmentProgress
                          return sign * interpolated
                        },
                      })
                    )
                  })
                )
              },
            })
          )
        ),
        Match.exhaustive
      )
    }

    // スムージング適用
    const applySmoothing = (
      currentDelta: MouseDelta,
      smoothingAmount: number,
      buffer: MouseDelta[]
    ): { smoothedDelta: MouseDelta; newBuffer: MouseDelta[] } =>
      pipe(
        smoothingAmount <= 0,
        Match.value,
        Match.when(true, () => ({ smoothedDelta: currentDelta, newBuffer: buffer })),
        Match.orElse(() => {
          const bufferSize = Math.max(1, Math.floor(smoothingAmount * 10))
          const newBuffer = [...buffer, currentDelta].slice(-bufferSize)

          return pipe(
            newBuffer.length === 1,
            Match.value,
            Match.when(true, () => ({ smoothedDelta: currentDelta, newBuffer })),
            Match.orElse(() => {
              // 加重平均
              let totalWeight = 0
              let weightedDeltaX = 0
              let weightedDeltaY = 0

              newBuffer.forEach((delta, index) => {
                const weight = (index + 1) / newBuffer.length
                totalWeight += weight
                weightedDeltaX += delta.deltaX * weight
                weightedDeltaY += delta.deltaY * weight
              })

              const smoothedDelta: MouseDelta = {
                deltaX: weightedDeltaX / totalWeight,
                deltaY: weightedDeltaY / totalWeight,
                timestamp: currentDelta.timestamp,
              }

              return { smoothedDelta, newBuffer }
            })
          )
        })
      )

    return MouseSensitivity.of({
      getConfig: () => Ref.get(config),

      setConfig: (newConfig) =>
        Effect.gen(function* () {
          const validatedConfig = yield* Schema.decodeUnknown(MouseSensitivityConfig)(newConfig).pipe(
            Effect.mapError((parseError) =>
              MouseSensitivityError({
                message: 'Invalid configuration provided',
                config: newConfig,
              })
            )
          )
          yield* Ref.set(config, validatedConfig)
        }),

      applySensitivity: (delta) =>
        Effect.gen(function* () {
          const currentConfig = yield* Ref.get(config)
          const buffer = yield* Ref.get(smoothingBuffer)

          // デッドゾーン適用
          const deltaLength = Math.sqrt(delta.deltaX ** 2 + delta.deltaY ** 2)
          const deadZoneResult = pipe(
            deltaLength < currentConfig.deadZone,
            Match.value,
            Match.when(true, () =>
              Option.some({
                deltaX: 0,
                deltaY: 0,
                originalDeltaX: delta.deltaX,
                originalDeltaY: delta.deltaY,
                appliedSensitivity: 0,
                timestamp: delta.timestamp,
              })
            ),
            Match.orElse(() => Option.none<AdjustedMouseDelta>())
          )

          return yield* pipe(
            deadZoneResult,
            Option.match({
              onSome: (result) => Effect.succeed(result),
              onNone: () => Effect.gen(function* () {
                  // スムージング適用
                  const { smoothedDelta, newBuffer } = applySmoothing(delta, currentConfig.smoothing, buffer)
                  yield* Ref.set(smoothingBuffer, newBuffer)

                  // 感度カーブ適用
                  const customPoints = pipe(
                    Option.fromNullable(currentConfig.customCurvePoints),
                    Option.map((points) => [...points]),
                    Option.getOrUndefined
                  )
                  const curvedDeltaX = applyCurve(smoothedDelta.deltaX, currentConfig.curve, customPoints)
                  const curvedDeltaY = applyCurve(smoothedDelta.deltaY, currentConfig.curve, customPoints)

                  // 感度とグローバル倍率適用
                  let adjustedDeltaX = curvedDeltaX * currentConfig.xSensitivity * currentConfig.globalMultiplier
                  let adjustedDeltaY = curvedDeltaY * currentConfig.ySensitivity * currentConfig.globalMultiplier

                  // 軸反転
                  adjustedDeltaX = pipe(
                    currentConfig.invertX,
                    Match.value,
                    Match.when(true, () => -adjustedDeltaX),
                    Match.orElse(() => adjustedDeltaX)
                  )
                  adjustedDeltaY = pipe(
                    currentConfig.invertY,
                    Match.value,
                    Match.when(true, () => -adjustedDeltaY),
                    Match.orElse(() => adjustedDeltaY)
                  )

                  const appliedSensitivity = Math.sqrt(adjustedDeltaX ** 2 + adjustedDeltaY ** 2) / (deltaLength || 1)

                  return {
                    deltaX: adjustedDeltaX,
                    deltaY: adjustedDeltaY,
                    originalDeltaX: delta.deltaX,
                    originalDeltaY: delta.deltaY,
                    appliedSensitivity,
                    timestamp: delta.timestamp,
                  }
                }),
            })
          )
        }),

      setPreset: (preset) =>
        Effect.gen(function* () {
          const currentConfig = yield* Ref.get(config)
          const presetConfig = sensitivityPresets[preset]

          const newConfig: MouseSensitivityConfig = {
            ...currentConfig,
            ...presetConfig,
            preset: preset as SensitivityPreset,
          }

          yield* Ref.set(config, newConfig)
        }),

      setSensitivity: (x, y) =>
        Effect.gen(function* () {
          yield* Ref.update(config, (current) => ({
            ...current,
            xSensitivity: Math.max(0.01, x),
            ySensitivity: Math.max(0.01, y
    }),
    preset: 'custom' as SensitivityPreset,
          }))
        }),

      setGlobalMultiplier: (multiplier) =>
        Effect.gen(function* () {
          yield* Ref.update(config, (current) => ({
            ...current,
            globalMultiplier: Math.max(0.01, multiplier
    }),
    preset: 'custom' as SensitivityPreset,
          }))
        }),

      invertAxis: (x, y) =>
        Effect.gen(function* () {
          yield* Ref.update(config, (current) => ({
            ...current,
            invertX: x,
            invertY: y,
            preset: 'custom' as SensitivityPreset,
          }))
        }),

      setCurve: (curve) =>
        Effect.gen(function* () {
          yield* Ref.update(config, (current) => ({
            ...current,
            curve,
            preset: 'custom' as SensitivityPreset,
          }))
        }),

      resetToDefault: () => Ref.set(config, defaultSensitivityConfig),
    })
  })
)

// テスト用のモック実装
export const MockMouseSensitivity = Layer.succeed(
    MouseSensitivity,
    MouseSensitivity.of({
    getConfig: () => Effect.succeed(defaultSensitivityConfig),

    setConfig: () => Effect.succeed(undefined,
      applySensitivity: (delta) =>
      Effect.succeed({
        deltaX: delta.deltaX,
        deltaY: delta.deltaY,
        originalDeltaX: delta.deltaX,
        originalDeltaY: delta.deltaY,
        appliedSensitivity: 1.0,
        timestamp: delta.timestamp,
      }),

    setPreset: () => Effect.succeed(undefined),

    setSensitivity: () => Effect.succeed(undefined),

    setGlobalMultiplier: () => Effect.succeed(undefined),

    invertAxis: () => Effect.succeed(undefined),

    setCurve: () => Effect.succeed(undefined),

    resetToDefault: () => Effect.succeed(undefined),
  })
)
