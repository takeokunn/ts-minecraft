/**
 * View Mode Manager Domain Service Live Implementation
 *
 * ビューモード管理ドメインサービスの純粋なドメインロジック実装。
 * ビューモード切り替えロジック、トランジション制御、
 * 制約確認等の核となるビジネスロジックを実装しています。
 */

import { Clock, Effect, Layer, Match, Option, pipe, Random } from 'effect'
import type {
  AnimationDuration,
  AnimationTimeline,
  Camera,
  CameraDistance,
  CameraError,
  CameraRotation,
  EasingType,
  Position3D,
  ViewMode,
} from '../../value_object'
import {
  AnimationValueFactory,
  CameraOps,
  CameraRotationOps,
  Position3DOps,
  ViewModeFactory,
  ViewModeOps,
} from '../../value_object'
import type {
  CameraPath,
  EnvironmentState,
  GameState,
  InputState,
  PlayerState,
  TransitionType,
  ViewModeAlternative,
  ViewModeContext,
  ViewModeHistoryEntry,
  ViewModePermissions,
  ViewModePreferences,
  ViewModeTransition,
  ViewModeTransitionSettings,
  ViewModeType,
} from './index'
import { TransitionExecutionResult, TransitionStep, ViewModeManagerService } from './index'

/**
 * ビューモード管理サービスのLive実装
 * 純粋なドメインロジックのみを含む
 */
export const ViewModeManagerServiceLive = Layer.succeed(
  ViewModeManagerService,
  ViewModeManagerService.of({
    /**
     * 一人称視点への切り替え
     */
    switchToFirstPerson: (camera, playerPosition, transitionSettings) =>
      Effect.gen(function* () {
        const firstPersonMode = yield* ViewModeFactory.createFirstPerson({
          eyeHeight: 1.62, // Minecraftの標準プレイヤー目の高さ
          headBob: true,
          handsVisible: true,
        })

        const eyePosition = yield* Position3DOps.add(playerPosition, yield* Position3DOps.create(0, 1.62, 0))

        let updatedCamera = yield* CameraOps.setPosition(camera, eyePosition)
        updatedCamera = yield* CameraOps.setViewMode(updatedCamera, firstPersonMode)

        return yield* applyTransitionOption(updatedCamera, transitionSettings)
      }),

    /**
     * 三人称視点への切り替え
     */
    switchToThirdPerson: (camera, targetPosition, distance, transitionSettings) =>
      Effect.gen(function* () {
        const thirdPersonMode = yield* ViewModeFactory.createThirdPerson({
          distance,
          offset: yield* Position3DOps.create(0, 0, 0),
          followSpeed: 5.0,
          collisionDetection: true,
        })

        // 現在の回転を維持してカメラ位置を計算
        const currentRotation = yield* CameraOps.getRotation(camera)
        const cameraPosition = yield* calculateThirdPersonPosition(targetPosition, currentRotation, distance)

        let updatedCamera = yield* CameraOps.setPosition(camera, cameraPosition)
        updatedCamera = yield* CameraOps.setViewMode(updatedCamera, thirdPersonMode)

        return yield* applyTransitionOption(updatedCamera, transitionSettings)
      }),

    /**
     * スペクテイターモードへの切り替え
     */
    switchToSpectator: (camera, initialPosition, transitionSettings) =>
      Effect.gen(function* () {
        const spectatorMode = yield* ViewModeFactory.createSpectator({
          flySpeed: 10.0,
          noClip: true,
          freeRotation: true,
          uiVisible: false,
        })

        let updatedCamera = yield* CameraOps.setPosition(camera, initialPosition)
        updatedCamera = yield* CameraOps.setViewMode(updatedCamera, spectatorMode)

        return yield* applyTransitionOption(updatedCamera, transitionSettings)
      }),

    /**
     * シネマティックモードへの切り替え
     */
    switchToCinematic: (camera, cinematicSettings, transitionSettings) =>
      Effect.gen(function* () {
        const cinematicMode = yield* ViewModeFactory.createCinematic({
          timeline: cinematicSettings.cameraPath
            ? yield* createTimelineFromPath(cinematicSettings.cameraPath)
            : undefined,
          autoPlay: true,
          looping: cinematicSettings.cameraPath?.looping ?? false,
          effects: cinematicSettings.cinematicEffects,
        })

        const cameraWithInitialPosition = yield* pipe(
          Option.fromNullable(cinematicSettings.cameraPath),
          Match.value,
          Match.tag('None', () => Effect.succeed(camera)),
          Match.tag('Some', ({ value: cameraPath }) =>
            pipe(
              Match.value(cameraPath.keyframes.length > 0),
              Match.when(false, () => Effect.succeed(camera)),
              Match.orElse(() =>
                Effect.gen(function* () {
                  const firstKeyframe = cameraPath.keyframes[0]
                  let positionedCamera = yield* CameraOps.setPosition(camera, firstKeyframe.position)
                  positionedCamera = yield* CameraOps.setRotation(positionedCamera, firstKeyframe.rotation)
                  return positionedCamera
                })
              ),
              Match.exhaustive
            )
          ),
          Match.exhaustive
        )

        const cameraWithFOV = yield* pipe(
          Option.fromNullable(cinematicSettings.fovOverride),
          Match.value,
          Match.tag('None', () => Effect.succeed(cameraWithInitialPosition)),
          Match.tag('Some', ({ value }) => CameraOps.setFOV(cameraWithInitialPosition, value)),
          Match.exhaustive
        )

        const updatedCamera = yield* CameraOps.setViewMode(cameraWithFOV, cinematicMode)

        return yield* applyTransitionOption(updatedCamera, transitionSettings)
      }),

    /**
     * ビューモード切り替え可能性の確認
     */
    canSwitchToMode: (currentMode, targetMode, context) =>
      Effect.gen(function* () {
        // 権限チェック
        const hasPermission = yield* checkViewModePermission(targetMode, context.permissions)

        return yield* pipe(
          Match.value(hasPermission),
          Match.when(false, () => Effect.succeed(false)),
          Match.orElse(() =>
            Effect.gen(function* () {
              const stateAllowed = yield* checkGameStateCompatibility(targetMode, context.gameState)

              return yield* pipe(
                Match.value(stateAllowed),
                Match.when(false, () => Effect.succeed(false)),
                Match.orElse(() =>
                  Effect.gen(function* () {
                    const environmentAllowed = yield* checkEnvironmentCompatibility(
                      targetMode,
                      context.environmentState
                    )

                    return yield* pipe(
                      Match.value(environmentAllowed),
                      Match.when(false, () => Effect.succeed(false)),
                      Match.orElse(() => Effect.succeed(true)),
                      Match.exhaustive
                    )
                  })
                ),
                Match.exhaustive
              )
            })
          ),
          Match.exhaustive
        )
      }),

    /**
     * ビューモードトランジションの作成
     */
    createViewModeTransition: (fromMode, toMode, transitionType) =>
      Effect.gen(function* () {
        const transitionId = yield* generateTransitionId()
        const duration = yield* getTransitionDuration(transitionType)
        const settings = yield* createDefaultTransitionSettings(transitionType)
        const steps = yield* createTransitionSteps(fromMode, toMode, transitionType)

        return {
          id: transitionId,
          fromMode,
          toMode,
          transitionType,
          duration,
          settings,
          steps,
        }
      }),

    /**
     * トランジション実行
     */
    executeTransition: (camera, transition, currentTime) =>
      Effect.gen(function* () {
        const startTime = currentTime
        const progress = Math.min(1.0, (currentTime - startTime) / (transition.duration as number))

        return yield* pipe(
          Match.value(progress >= 1.0),
          Match.when(true, () =>
            Effect.gen(function* () {
              const finalCamera = yield* applyFinalTransitionState(camera, transition)
              return TransitionExecutionResult.Completed({
                finalCamera,
                executionTime: transition.duration as number,
              })
            })
          ),
          Match.orElse(() =>
            Effect.gen(function* () {
              const currentCamera = yield* applyTransitionProgress(camera, transition, progress)
              return TransitionExecutionResult.InProgress({
                progress,
                currentCamera,
                estimatedCompletion: startTime + (transition.duration as number),
              })
            })
          ),
          Match.exhaustive
        )
      }),

    /**
     * ビューモード制約の確認
     */
    checkViewModeConstraints: (viewMode, context) =>
      Effect.gen(function* () {
        const restrictions: string[] = []
        const recommendations: string[] = []
        const warnings: string[] = []

        // 各種制約チェック
        yield* checkPlayerStateConstraints(viewMode, context.playerState, restrictions, warnings)
        yield* checkEnvironmentConstraints(viewMode, context.environmentState, restrictions, recommendations)
        yield* checkInputConstraints(viewMode, context.inputState, recommendations)

        const allowed = restrictions.length === 0

        return {
          allowed,
          restrictions,
          recommendations,
          warnings,
        }
      }),

    /**
     * 最適なビューモードの提案
     */
    suggestOptimalViewMode: (context, userPreferences) =>
      Effect.gen(function* () {
        const candidates = yield* evaluateViewModeCandidates(context, userPreferences)
        const bestCandidate = yield* selectBestCandidate(candidates)
        const alternatives = yield* createAlternatives(candidates.filter((c) => c !== bestCandidate))

        return {
          suggestedMode: bestCandidate.mode,
          confidence: bestCandidate.score,
          reason: bestCandidate.reason,
          alternatives: alternatives,
        }
      }),

    /**
     * ビューモード履歴の管理
     */
    getViewModeHistory: (camera, maxEntries = 10) =>
      Effect.gen(function* () {
        // カメラオブジェクトから履歴を取得（実装時にカメラ構造に依存）
        const history: ViewModeHistoryEntry[] = []

        // スタブ実装：実際はカメラの内部状態から履歴を取得
        return history.slice(0, maxEntries)
      }),

    /**
     * 前回のビューモードに復帰
     */
    revertToPreviousMode: (camera, transitionSettings) =>
      Effect.gen(function* () {
        const history = yield* ViewModeManagerService.getViewModeHistory(camera, 2)

        return yield* pipe(
          Match.value(history.length < 2),
          Match.when(true, () => Effect.succeed(camera)),
          Match.orElse(() =>
            Effect.gen(function* () {
              const previousEntry = history[1]
              const previousMode = previousEntry.mode

              return yield* pipe(
                previousMode,
                Match.value,
                Match.when(
                  (mode) => ViewModeOps.isFirstPerson(mode),
                  () =>
                    ViewModeManagerService.switchToFirstPerson(
                      camera,
                      previousEntry.context.playerState.position,
                      transitionSettings
                    )
                ),
                Match.when(
                  (mode) => ViewModeOps.isThirdPerson(mode),
                  () =>
                    ViewModeManagerService.switchToThirdPerson(
                      camera,
                      previousEntry.context.playerState.position,
                      5.0 as CameraDistance,
                      transitionSettings
                    )
                ),
                Match.when(
                  (mode) => ViewModeOps.isSpectator(mode),
                  () =>
                    ViewModeManagerService.switchToSpectator(
                      camera,
                      previousEntry.context.playerState.position,
                      transitionSettings
                    )
                ),
                Match.orElse(() => Effect.succeed(camera))
              )
            })
          ),
          Match.exhaustive
        )
      }),
  })
)

/**
 * Helper Functions
 */

/**
 * 三人称カメラ位置の計算
 */
const calculateThirdPersonPosition = (
  targetPosition: Position3D,
  rotation: CameraRotation,
  distance: CameraDistance
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    const pitch = CameraRotationOps.getPitch(rotation)
    const yaw = CameraRotationOps.getYaw(rotation)

    // 球面座標から直交座標への変換
    const pitchRad = ((pitch as number) * Math.PI) / 180
    const yawRad = ((yaw as number) * Math.PI) / 180
    const dist = distance as number

    const x = dist * Math.cos(pitchRad) * Math.sin(yawRad)
    const y = dist * Math.sin(pitchRad)
    const z = dist * Math.cos(pitchRad) * Math.cos(yawRad)

    const offset = yield* Position3DOps.create(-x, y, -z)
    return yield* Position3DOps.add(targetPosition, offset)
  })

/**
 * カメラパスからタイムラインを作成
 */
const createTimelineFromPath = (path: CameraPath): Effect.Effect<AnimationTimeline, CameraError> =>
  Effect.succeed({
    keyframes: path.keyframes.map((keyframe) => ({
      time: keyframe.time,
      position: {
        x: Number(keyframe.position.x),
        y: Number(keyframe.position.y),
        z: Number(keyframe.position.z),
      },
      rotation: {
        pitch: Number(keyframe.rotation.pitch),
        yaw: Number(keyframe.rotation.yaw),
      },
      easing: keyframe.easingType,
    })),
    duration: path.duration,
    loop: path.looping,
  })

/**
 * トランジションをカメラに適用
 */
const applyTransitionToCamera = (
  camera: Camera,
  settings: ViewModeTransitionSettings
): Effect.Effect<Camera, CameraError> =>
  Effect.gen(function* () {
    // トランジション設定をカメラに適用（スタブ実装）
    return camera
  })

const applyTransitionOption = (
  camera: Camera,
  settings: ViewModeTransitionSettings | undefined
): Effect.Effect<Camera, CameraError> =>
  pipe(
    settings,
    Option.fromNullable,
    Match.value,
    Match.tag('None', () => Effect.succeed(camera)),
    Match.tag('Some', ({ value }) => applyTransitionToCamera(camera, value)),
    Match.exhaustive
  )

/**
 * ビューモード権限チェック
 */
const checkViewModePermission = (
  mode: ViewMode,
  permissions: ViewModePermissions
): Effect.Effect<boolean, CameraError> =>
  pipe(
    mode,
    Match.value,
    Match.when(
      (candidate) => ViewModeOps.isFirstPerson(candidate),
      () => Effect.succeed(permissions.canUseFirstPerson)
    ),
    Match.when(
      (candidate) => ViewModeOps.isThirdPerson(candidate),
      () => Effect.succeed(permissions.canUseThirdPerson)
    ),
    Match.when(
      (candidate) => ViewModeOps.isSpectator(candidate),
      () => Effect.succeed(permissions.canUseSpectator)
    ),
    Match.orElse(() => Effect.succeed(permissions.canUseCinematic)),
    Match.exhaustive
  )

/**
 * ゲーム状態互換性チェック
 */
const checkGameStateCompatibility = (mode: ViewMode, gameState: GameState): Effect.Effect<boolean, CameraError> =>
  pipe(
    Match.value(gameState.cutscene),
    Match.when(true, () => Effect.succeed(ViewModeOps.isCinematic(mode))),
    Match.orElse(() =>
      pipe(
        Match.value(gameState.loading),
        Match.when(true, () => Effect.succeed(ViewModeOps.isSpectator(mode))),
        Match.orElse(() => Effect.succeed(true)),
        Match.exhaustive
      )
    ),
    Match.exhaustive
  )

/**
 * 環境互換性チェック
 */
const checkEnvironmentCompatibility = (
  mode: ViewMode,
  environment: EnvironmentState
): Effect.Effect<boolean, CameraError> =>
  pipe(
    Match.value(environment.confined && ViewModeOps.isThirdPerson(mode)),
    Match.when(true, () => Effect.succeed(false)),
    Match.orElse(() =>
      pipe(
        Match.value(environment.inVehicle && ViewModeOps.isThirdPerson(mode)),
        Match.when(true, () => Effect.succeed(false)),
        Match.orElse(() => Effect.succeed(true)),
        Match.exhaustive
      )
    ),
    Match.exhaustive
  )

/**
 * トランジションID生成
 */
const generateTransitionId = (): Effect.Effect<string, CameraError> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    const randomValue = yield* Random.nextIntBetween(0, 36 ** 9 - 1)
    const randomId = randomValue.toString(36).padStart(9, '0')
    return `transition_${timestamp}_${randomId}`
  })

/**
 * トランジション期間取得
 */
const getTransitionDuration = (type: TransitionType): Effect.Effect<AnimationDuration, CameraError> =>
  Effect.gen(function* () {
    const duration = pipe(
      type,
      Match.value,
      Match.when('instant', () => 0),
      Match.when('smooth', () => 500),
      Match.when('fade', () => 1000),
      Match.when('slide', () => 750),
      Match.when('custom', () => 1000),
      Match.exhaustive
    )

    return yield* AnimationValueFactory.createDuration(duration)
  })

/**
 * デフォルトトランジション設定作成
 */
const createDefaultTransitionSettings = (
  type: TransitionType
): Effect.Effect<ViewModeTransitionSettings, CameraError> =>
  Effect.gen(function* () {
    const duration = yield* getTransitionDuration(type)

    return {
      duration,
      easingType: 'easeInOut' as EasingType,
      smoothPosition: true,
      smoothRotation: true,
      smoothFOV: true,
      allowInterruption: true,
    }
  })

/**
 * トランジションステップ作成
 */
const createTransitionSteps = (
  fromMode: ViewMode,
  toMode: ViewMode,
  transitionType: TransitionType
): Effect.Effect<readonly (typeof TransitionStep.Type)[], CameraError> =>
  Effect.gen(function* () {
    const steps: (typeof TransitionStep.Type)[] = []

    // 位置遷移ステップを追加
    // 実装時に具体的なステップを定義

    return steps
  })

/**
 * 最終トランジション状態適用
 */
const applyFinalTransitionState = (
  camera: Camera,
  transition: ViewModeTransition
): Effect.Effect<Camera, CameraError> =>
  Effect.gen(function* () {
    // 最終状態をカメラに適用
    return camera
  })

/**
 * トランジション進行適用
 */
const applyTransitionProgress = (
  camera: Camera,
  transition: ViewModeTransition,
  progress: number
): Effect.Effect<Camera, CameraError> =>
  Effect.gen(function* () {
    // 進行度に応じてカメラ状態を更新
    return camera
  })

/**
 * プレイヤー状態制約チェック
 */
const checkPlayerStateConstraints = (
  mode: ViewMode,
  playerState: PlayerState,
  restrictions: string[],
  warnings: string[]
): Effect.Effect<void, CameraError> =>
  Effect.gen(function* () {
    yield* Effect.when(!playerState.alive && !ViewModeOps.isSpectator(mode), () =>
      Effect.sync(() => {
        restrictions.push('Cannot use camera mode while dead')
      })
    )

    yield* Effect.when(playerState.spectating && !ViewModeOps.isSpectator(mode), () =>
      Effect.sync(() => {
        restrictions.push('Must use spectator mode while spectating')
      })
    )
  })

/**
 * 環境制約チェック
 */
const checkEnvironmentConstraints = (
  mode: ViewMode,
  environment: EnvironmentState,
  restrictions: string[],
  recommendations: string[]
): Effect.Effect<void, CameraError> =>
  Effect.gen(function* () {
    yield* Effect.when(environment.confined && ViewModeOps.isThirdPerson(mode), () =>
      Effect.sync(() => {
        recommendations.push('First person mode recommended in confined spaces')
      })
    )

    yield* Effect.when(environment.underwater && ViewModeOps.isThirdPerson(mode), () =>
      Effect.sync(() => {
        recommendations.push('Consider first person for better underwater visibility')
      })
    )
  })

/**
 * 入力制約チェック
 */
const checkInputConstraints = (
  mode: ViewMode,
  inputState: InputState,
  recommendations: string[]
): Effect.Effect<void, CameraError> =>
  Effect.gen(function* () {
    yield* Effect.when(inputState.inputType === 'touch' && ViewModeOps.isFirstPerson(mode), () =>
      Effect.sync(() => {
        recommendations.push('Third person mode may be easier with touch controls')
      })
    )
  })

/**
 * ビューモード候補評価
 */
const evaluateViewModeCandidates = (
  context: ViewModeContext,
  preferences: ViewModePreferences
): Effect.Effect<ViewModeCandidate[], CameraError> =>
  Effect.gen(function* () {
    // 候補評価ロジック（スタブ実装）
    return [
      { mode: 'first_person' as ViewModeType, score: 0.8, reason: 'Good for combat' },
      { mode: 'third_person' as ViewModeType, score: 0.9, reason: 'Best for exploration' },
    ]
  })

/**
 * 最適候補選択
 */
const selectBestCandidate = (candidates: ViewModeCandidate[]): Effect.Effect<ViewModeCandidate, CameraError> =>
  Effect.gen(function* () {
    return candidates.reduce((best, current) => (current.score > best.score ? current : best))
  })

/**
 * 代替案作成
 */
const createAlternatives = (candidates: ViewModeCandidate[]): Effect.Effect<ViewModeAlternative[], CameraError> =>
  Effect.gen(function* () {
    return candidates.map((candidate) => ({
      mode: candidate.mode,
      score: candidate.score,
      pros: ['Good visibility'],
      cons: ['May cause motion sickness'],
    }))
  })

/**
 * 内部型定義
 */
interface ViewModeCandidate {
  mode: ViewModeType
  score: number
  reason: string
}
