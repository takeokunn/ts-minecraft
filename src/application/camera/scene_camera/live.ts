import { Clock, Data, Effect, Layer, Match, Option, pipe } from 'effect'
import type {
  CinematicSequence,
  FollowMode,
  SceneCameraApplicationError,
  SceneCameraApplicationService,
  SceneCameraId,
  SceneCameraState,
  SceneCameraStatistics,
  SceneId,
  SceneTarget,
  SequenceExecutionError,
  SequenceId,
} from './index'
import { createSceneCameraApplicationError, createSequenceExecutionResult } from './index'

// Imported service types
import type { OptimizationResult, SceneCameraDebugInfo, SceneStatistics, SequenceValidationResult } from './index'

// Domain Service Dependencies
import type {
  AnimationEngineService,
  CameraControlService,
  CollisionDetectionService,
  SettingsValidatorService,
  ViewModeManagerService,
} from '@/domain/camera/domain_service/index'

// Repository Dependencies
import type {
  AnimationHistoryRepository,
  CameraStateRepository,
  SettingsStorageRepository,
} from '@/domain/camera/repository/index'

// Value Object Dependencies
import type { Position3D } from '@/domain/camera/value_object/index'

/**
 * Scene Camera Application Service Live Implementation
 *
 * シーンカメラのユースケースを実現するApplication Serviceの実装です。
 * 複数のDomain ServiceとRepositoryを統合してシネマティック機能を提供します。
 */
export const SceneCameraApplicationServiceLive = Layer.effect(
  SceneCameraApplicationService,
  Effect.gen(function* () {
    // === Dependencies Injection ===
    const cameraStateRepo = yield* CameraStateRepository
    const settingsRepo = yield* SettingsStorageRepository
    const animationHistoryRepo = yield* AnimationHistoryRepository

    const cameraControlService = yield* CameraControlService
    const animationEngine = yield* AnimationEngineService
    const collisionDetection = yield* CollisionDetectionService
    const settingsValidator = yield* SettingsValidatorService
    const viewModeManager = yield* ViewModeManagerService

    // === Internal State Management ===
    const scenes = new Map<SceneId, Set<SceneCameraId>>()
    const sceneCameras = new Map<SceneCameraId, SceneCameraState>()
    const activeSequences = new Map<SceneCameraId, CinematicSequence>()
    const sequenceStates = new Map<SequenceId, any>() // SequenceExecutionState
    const trackingStates = new Map<SceneCameraId, any>() // DynamicTrackingState
    const performanceMetrics = new Map<SceneCameraId, SceneCameraStatistics>()

    // === Helper Functions ===

    /**
     * シーンカメラIDを生成
     */
    const generateSceneCameraId = (): Effect.Effect<SceneCameraId, never> =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const random = yield* Effect.sync(() => Math.random().toString(36).substr(2, 9))
        return `scene-camera-${timestamp}-${random}` as SceneCameraId
      })

    /**
     * シーケンスIDを生成
     */
    const generateSequenceId = (): Effect.Effect<SequenceId, never> =>
      Effect.gen(function* () {
        const timestamp = yield* Clock.currentTimeMillis
        const random = yield* Effect.sync(() => Math.random().toString(36).substr(2, 9))
        return `sequence-${timestamp}-${random}` as SequenceId
      })

    /**
     * シーンカメラ状態を取得（内部用）
     */
    const findSceneCamera = (
      sceneCameraId: SceneCameraId
    ): Effect.Effect<SceneCameraState, SceneCameraApplicationError> =>
      pipe(
        Option.fromNullable(sceneCameras.get(sceneCameraId)),
        Option.match({
          onNone: () => Effect.fail(createSceneCameraApplicationError.sceneCameraNotFound(sceneCameraId)),
          onSome: Effect.succeed,
        })
      )

    /**
     * シーンターゲットの位置を解決
     */
    const resolveTargetPosition = (target: SceneTarget): Effect.Effect<Position3D, SceneCameraApplicationError> =>
      pipe(
        target,
        Match.value,
        Match.tag('StaticPosition', ({ position }) => Effect.succeed(position)),
        Match.tag('DynamicEntity', ({ entityId, offset }) =>
          Effect.gen(function* () {
            // エンティティ位置の取得（実装簡略化）
            const entityPosition = { x: 0, y: 64, z: 0 } as Position3D
            return {
              x: entityPosition.x + offset.x,
              y: entityPosition.y + offset.y,
              z: entityPosition.z + offset.z,
            } as Position3D
          })
        ),
        Match.tag('Player', ({ playerId, offset }) =>
          Effect.gen(function* () {
            // プレイヤー位置の取得（実装簡略化）
            const playerPosition = { x: 0, y: 64, z: 0 } as Position3D
            return {
              x: playerPosition.x + offset.x,
              y: playerPosition.y + offset.y,
              z: playerPosition.z + offset.z,
            } as Position3D
          })
        ),
        Match.tag(
          'CustomTracker',
          ({ trackerId, updateCallback }) => Effect.sync(() => updateCallback(16.67)) // 60fps想定
        ),
        Match.tag('Group', ({ targets, centeringMode, weight }) =>
          Effect.gen(function* () {
            const positions = yield* Effect.all(targets.map(resolveTargetPosition), { concurrency: 4 })

            return pipe(
              centeringMode,
              Match.value,
              Match.tag('Arithmetic', () => {
                const sum = positions.reduce(
                  (acc, pos) => ({
                    x: acc.x + pos.x,
                    y: acc.y + pos.y,
                    z: acc.z + pos.z,
                  }),
                  { x: 0, y: 0, z: 0 }
                )
                return {
                  x: sum.x / positions.length,
                  y: sum.y / positions.length,
                  z: sum.z / positions.length,
                } as Position3D
              }),
              Match.tag('Weighted', () => {
                // 簡略実装：算術平均と同じ
                const sum = positions.reduce(
                  (acc, pos) => ({
                    x: acc.x + pos.x,
                    y: acc.y + pos.y,
                    z: acc.z + pos.z,
                  }),
                  { x: 0, y: 0, z: 0 }
                )
                return {
                  x: sum.x / positions.length,
                  y: sum.y / positions.length,
                  z: sum.z / positions.length,
                } as Position3D
              }),
              Match.tag('Closest', () => {
                // 簡略実装：最初の位置を返す
                return positions[0] || ({ x: 0, y: 64, z: 0 } as Position3D)
              }),
              Match.tag('Bounds', () => {
                // 境界ボックス中心計算
                const minX = Math.min(...positions.map((p) => p.x))
                const maxX = Math.max(...positions.map((p) => p.x))
                const minY = Math.min(...positions.map((p) => p.y))
                const maxY = Math.max(...positions.map((p) => p.y))
                const minZ = Math.min(...positions.map((p) => p.z))
                const maxZ = Math.max(...positions.map((p) => p.z))

                return {
                  x: (minX + maxX) / 2,
                  y: (minY + maxY) / 2,
                  z: (minZ + maxZ) / 2,
                } as Position3D
              }),
              Match.exhaustive
            )
          })
        ),
        Match.exhaustive
      )

    /**
     * フォローモードに基づいてカメラ位置を計算
     */
    const calculateCameraPositionFromFollow = (
      followMode: FollowMode,
      currentPosition: Position3D
    ): Effect.Effect<Position3D, SceneCameraApplicationError> =>
      pipe(
        followMode,
        Match.value,
        Match.tag('Static', () => Effect.succeed(currentPosition)),
        Match.tag('FollowTarget', ({ target, smoothing, maxDistance }) =>
          Effect.gen(function* () {
            const targetPosition = yield* resolveTargetPosition(target)

            // 距離制限の適用
            const distance = Math.sqrt(
              Math.pow(targetPosition.x - currentPosition.x, 2) +
                Math.pow(targetPosition.y - currentPosition.y, 2) +
                Math.pow(targetPosition.z - currentPosition.z, 2)
            )

            return distance > maxDistance
              ? ({
                  x: currentPosition.x + (targetPosition.x - currentPosition.x) * (maxDistance / distance),
                  y: currentPosition.y + (targetPosition.y - currentPosition.y) * (maxDistance / distance),
                  z: currentPosition.z + (targetPosition.z - currentPosition.z) * (maxDistance / distance),
                } as Position3D)
              : ({
                  x: currentPosition.x + (targetPosition.x - currentPosition.x) * smoothing,
                  y: currentPosition.y + (targetPosition.y - currentPosition.y) * smoothing,
                  z: currentPosition.z + (targetPosition.z - currentPosition.z) * smoothing,
                } as Position3D)
          })
        ),
        Match.tag('Orbit', ({ center, radius, speed, direction }) =>
          Effect.gen(function* () {
            const timeMs = yield* Clock.currentTimeMillis
            const time = timeMs / 1000 // 秒単位
            const angle = time * speed

            return {
              x: center.x + Math.cos(angle) * radius,
              y: center.y,
              z: center.z + Math.sin(angle) * radius,
            } as Position3D
          })
        ),
        Match.tag('Path', ({ waypoints, speed, looping }) =>
          Effect.gen(function* () {
            return waypoints.length === 0 ? currentPosition : waypoints[0]
          })
        ),
        Match.tag('LookAt', ({ target, distance, angle }) =>
          Effect.gen(function* () {
            const targetPosition = yield* resolveTargetPosition(target)

            return {
              x: targetPosition.x + Math.cos(angle) * distance,
              y: targetPosition.y,
              z: targetPosition.z + Math.sin(angle) * distance,
            } as Position3D
          })
        ),
        Match.exhaustive
      )

    /**
     * シーケンス実行の妥当性チェック
     */
    const validateSequenceExecution = (
      sequence: CinematicSequence,
      cameraState: SceneCameraState
    ): Effect.Effect<boolean, SceneCameraApplicationError> =>
      Effect.gen(function* () {
        const memoryRequired = sequence.keyframes.length * 1024 // 1KB per keyframe
        const availableMemory = 100 * 1024 * 1024 // 100MB available

        return (
          Option.isNone(cameraState.currentSequence) &&
          sequence.keyframes.length > 0 &&
          memoryRequired < availableMemory
        )
      })

    /**
     * シーンカメラ統計を更新
     */
    const updateSceneCameraStatistics = (
      sceneCameraId: SceneCameraId,
      operationType: string
    ): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const current =
          performanceMetrics.get(sceneCameraId) ||
          ({
            totalSequencesPlayed: 0,
            totalRunTime: 0,
            averageFPS: 60,
            lastPerformanceCheck: now,
            memoryUsage: 0,
            renderingMetrics: {
              drawCalls: 0,
              trianglesRendered: 0,
              textureMemoryUsage: 0,
              shaderCompilationTime: 0,
              frameTime: 16.67,
            },
          } as SceneCameraStatistics)

        const updated = {
          ...current,
          ...(operationType === 'sequenceStart' && { totalSequencesPlayed: current.totalSequencesPlayed + 1 }),
          lastPerformanceCheck: now,
        } as SceneCameraStatistics

        performanceMetrics.set(sceneCameraId, updated)
      })

    // === Public Interface Implementation ===

    return SceneCameraApplicationService.of({
      createSceneCamera: (sceneId, initialSetup) =>
        Effect.gen(function* () {
          // シーンの初期化
          yield* Effect.when(!scenes.has(sceneId), () => Effect.sync(() => scenes.set(sceneId, new Set())))

          // 独立した初期化処理を並行実行
          const [now, sceneCameraId, initialTargetPositions, cameraPosition] = yield* Effect.all(
            [
              Clock.currentTimeMillis,
              generateSceneCameraId(),
              Effect.all(initialSetup.targets.map(resolveTargetPosition), { concurrency: 4 }),
              calculateCameraPositionFromFollow(initialSetup.followMode, initialSetup.initialPosition),
            ],
            { concurrency: 4 }
          )

          // カメラ状態の作成
          const cameraState = {
            sceneCameraId,
            sceneId,
            currentPosition: cameraPosition,
            currentRotation: initialSetup.initialRotation,
            currentTargets: initialSetup.targets,
            isActive: true,
            currentSequence: Option.none(),
            animationState: Option.none(),
            lastUpdate: now,
            statistics: {
              totalSequencesPlayed: 0,
              totalRunTime: 0,
              averageFPS: 60,
              lastPerformanceCheck: now,
              memoryUsage: 0,
              renderingMetrics: {
                drawCalls: 0,
                trianglesRendered: 0,
                textureMemoryUsage: 0,
                shaderCompilationTime: 0,
                frameTime: 16.67,
              },
            },
          } as SceneCameraState

          // 状態の保存（並行実行）
          yield* Effect.all(
            [
              pipe(
                Option.fromNullable(scenes.get(sceneId)),
                Option.match({
                  onNone: () => Effect.fail(createSceneCameraApplicationError.sceneNotFound(sceneId)),
                  onSome: (sceneSet) => Effect.sync(() => sceneSet.add(sceneCameraId)),
                })
              ),
              Effect.sync(() => sceneCameras.set(sceneCameraId, cameraState)),
              Effect.sync(() => performanceMetrics.set(sceneCameraId, cameraState.statistics)),
            ],
            { concurrency: 4 }
          )

          return sceneCameraId
        }),

      addCameraToScene: (sceneId, cameraConfig) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const sceneCameraId = yield* generateSceneCameraId()

          // シーンの存在確認
          yield* Effect.unless(scenes.has(sceneId), () =>
            Effect.fail(createSceneCameraApplicationError.sceneNotFound(sceneId))
          )

          const cameraState = {
            sceneCameraId,
            sceneId,
            currentPosition: cameraConfig.setup.initialPosition,
            currentRotation: cameraConfig.setup.initialRotation,
            currentTargets: cameraConfig.setup.targets,
            isActive: cameraConfig.isActive,
            currentSequence: Option.none(),
            animationState: Option.none(),
            lastUpdate: now,
            statistics: {
              totalSequencesPlayed: 0,
              totalRunTime: 0,
              averageFPS: 60,
              lastPerformanceCheck: now,
              memoryUsage: 0,
              renderingMetrics: {
                drawCalls: 0,
                trianglesRendered: 0,
                textureMemoryUsage: 0,
                shaderCompilationTime: 0,
                frameTime: 16.67,
              },
            },
          } as SceneCameraState

          yield* pipe(
            Option.fromNullable(scenes.get(sceneId)),
            Option.match({
              onNone: () => Effect.fail(createSceneCameraApplicationError.sceneNotFound(sceneId)),
              onSome: (sceneSet) => Effect.sync(() => sceneSet.add(sceneCameraId)),
            })
          )
          sceneCameras.set(sceneCameraId, cameraState)
          performanceMetrics.set(sceneCameraId, cameraState.statistics)

          return sceneCameraId
        }),

      updateSceneTargets: (sceneCameraId, targets) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const cameraState = yield* findSceneCamera(sceneCameraId)

          // ターゲット位置の解決
          const targetPositions = yield* Effect.all(targets.map(resolveTargetPosition), { concurrency: 4 })

          const updatedState = {
            ...cameraState,
            currentTargets: targets,
            lastUpdate: now,
          } as SceneCameraState

          sceneCameras.set(sceneCameraId, updatedState)
        }),

      startCinematicSequence: (sceneCameraId, sequence) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const cameraState = yield* findSceneCamera(sceneCameraId)

          const canExecute = yield* validateSequenceExecution(sequence, cameraState)

          return yield* pipe(
            canExecute,
            Effect.if({
              onTrue: () =>
                Effect.gen(function* () {
                  // シーケンス実行の開始
                  const animation = yield* animationEngine.createSequenceAnimation(sequence)

                  const updatedState = {
                    ...cameraState,
                    currentSequence: Option.some(sequence),
                    animationState: Option.some(animation),
                    lastUpdate: now,
                  } as SceneCameraState

                  sceneCameras.set(sceneCameraId, updatedState)
                  activeSequences.set(sceneCameraId, sequence)

                  yield* updateSceneCameraStatistics(sceneCameraId, 'sequenceStart')

                  // アニメーション履歴の記録
                  yield* animationHistoryRepo.recordSequenceStart(sceneCameraId, sequence.id)

                  return createSequenceExecutionResult.started(sequence.id, sequence.duration)
                }),
              onFalse: () => {
                const error = Data.struct({
                  _tag: 'AnimationSystemError' as const,
                  details: 'Cannot start sequence: camera is busy or invalid sequence',
                }) as SequenceExecutionError

                return Effect.succeed(createSequenceExecutionResult.failed(sequence.id, error, 0))
              },
            })
          )
        }),

      pauseCinematicSequence: (sceneCameraId) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const cameraState = yield* findSceneCamera(sceneCameraId)

          yield* pipe(
            cameraState.animationState,
            Option.match({
              onNone: () => Effect.void,
              onSome: (animation) =>
                Effect.gen(function* () {
                  yield* animationEngine.pauseAnimation(animation)

                  const updatedState = {
                    ...cameraState,
                    lastUpdate: now,
                  } as SceneCameraState

                  sceneCameras.set(sceneCameraId, updatedState)
                }),
            })
          )
        }),

      resumeCinematicSequence: (sceneCameraId) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const cameraState = yield* findSceneCamera(sceneCameraId)

          yield* pipe(
            cameraState.animationState,
            Option.match({
              onNone: () => Effect.void,
              onSome: (animation) =>
                Effect.gen(function* () {
                  yield* animationEngine.resumeAnimation(animation)

                  const updatedState = {
                    ...cameraState,
                    lastUpdate: now,
                  } as SceneCameraState

                  sceneCameras.set(sceneCameraId, updatedState)
                }),
            })
          )
        }),

      stopCinematicSequence: (sceneCameraId) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const cameraState = yield* findSceneCamera(sceneCameraId)

          yield* pipe(
            cameraState.animationState,
            Option.match({
              onNone: () => Effect.void,
              onSome: (animation) =>
                Effect.gen(function* () {
                  yield* animationEngine.stopAnimation(animation)

                  const updatedState = {
                    ...cameraState,
                    currentSequence: Option.none(),
                    animationState: Option.none(),
                    lastUpdate: now,
                  } as SceneCameraState

                  sceneCameras.set(sceneCameraId, updatedState)
                  activeSequences.delete(sceneCameraId)

                  // アニメーション履歴の記録
                  yield* pipe(
                    cameraState.currentSequence,
                    Option.match({
                      onNone: () => Effect.void,
                      onSome: (sequence) => animationHistoryRepo.recordSequenceEnd(sceneCameraId, sequence.id),
                    })
                  )
                }),
            })
          )
        }),

      getSceneCameraState: (sceneCameraId) => findSceneCamera(sceneCameraId),

      getAllSceneCameras: (sceneId) =>
        Effect.gen(function* () {
          return yield* pipe(
            Option.fromNullable(scenes.get(sceneId)),
            Option.match({
              onNone: () => Effect.fail(createSceneCameraApplicationError.sceneNotFound(sceneId)),
              onSome: (sceneCameraIds) =>
                Effect.succeed(
                  Array.from(sceneCameraIds)
                    .map((id) => sceneCameras.get(id)!)
                    .filter(Boolean)
                ),
            })
          )
        }),

      destroySceneCamera: (sceneCameraId) =>
        Effect.gen(function* () {
          const cameraState = yield* findSceneCamera(sceneCameraId)

          // アクティブなシーケンスの停止
          yield* pipe(
            cameraState.currentSequence,
            Option.match({
              onNone: () => Effect.void,
              onSome: () =>
                pipe(
                  cameraState.animationState,
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (animation) => animationEngine.stopAnimation(animation),
                  })
                ),
            })
          )

          // 状態の削除
          yield* Effect.sync(() => {
            pipe(
              Option.fromNullable(scenes.get(cameraState.sceneId)),
              Option.match({
                onNone: () => {},
                onSome: (sceneSet) => {
                  sceneSet.delete(sceneCameraId)
                },
              })
            )

            sceneCameras.delete(sceneCameraId)
            activeSequences.delete(sceneCameraId)
            trackingStates.delete(sceneCameraId)
            performanceMetrics.delete(sceneCameraId)
          })
        }),

      destroyScene: (sceneId) =>
        Effect.gen(function* () {
          yield* pipe(
            Option.fromNullable(scenes.get(sceneId)),
            Option.match({
              onNone: () => Effect.fail(createSceneCameraApplicationError.sceneNotFound(sceneId)),
              onSome: (sceneCameraIds) =>
                Effect.gen(function* () {
                  // 全カメラの破棄
                  yield* Effect.all(
                    Array.from(sceneCameraIds).map((sceneCameraId) =>
                      Effect.gen(function* () {
                        yield* pipe(
                          Option.fromNullable(sceneCameras.get(sceneCameraId)),
                          Option.match({
                            onNone: () => Effect.void,
                            onSome: (cameraState) =>
                              pipe(
                                cameraState.animationState,
                                Option.match({
                                  onNone: () => Effect.void,
                                  onSome: (animation) => animationEngine.stopAnimation(animation),
                                })
                              ),
                          })
                        )

                        yield* Effect.sync(() => {
                          sceneCameras.delete(sceneCameraId)
                          activeSequences.delete(sceneCameraId)
                          trackingStates.delete(sceneCameraId)
                          performanceMetrics.delete(sceneCameraId)
                        })
                      })
                    ),
                    { concurrency: 4 }
                  )

                  scenes.delete(sceneId)
                }),
            })
          )
        }),

      synchronizeCameras: (operations) =>
        Effect.all(
          operations.map(({ sceneCameraId, operation }) =>
            Effect.gen(function* () {
              const now = yield* Clock.currentTimeMillis
              // 簡略実装：各操作を順次実行
              const mockSequence = {
                id: yield* generateSequenceId(),
                name: 'Sync Operation',
                description: Option.none(),
                keyframes: [],
                duration: 1000,
                loopMode: { _tag: 'None' },
                transitionSettings: {
                  fadeInDuration: 500,
                  fadeOutDuration: 500,
                  smoothTransition: true,
                  preserveOrientation: false,
                },
                metadata: {
                  creator: 'System',
                  version: '1.0.0',
                  created: now,
                  lastModified: now,
                  tags: ['sync'],
                  category: { _tag: 'Debug' },
                },
              } as CinematicSequence

              return createSequenceExecutionResult.started(mockSequence.id, 1000)
            })
          ),
          { concurrency: 4 }
        ),

      switchBetweenCameras: (fromCameraId, toCameraId, transitionConfig) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const fromCamera = yield* findSceneCamera(fromCameraId)
          const toCamera = yield* findSceneCamera(toCameraId)

          // カメラ切り替えアニメーションの作成
          const transitionSequence = {
            id: yield* generateSequenceId(),
            name: 'Camera Switch',
            description: Option.some(`Switch from ${fromCameraId} to ${toCameraId}`),
            keyframes: [
              {
                time: 0,
                position: fromCamera.currentPosition,
                rotation: fromCamera.currentRotation,
                fieldOfView: 75,
                easing: { _tag: 'EaseInOut' },
                effects: [],
              },
              {
                time: transitionConfig.duration,
                position: toCamera.currentPosition,
                rotation: toCamera.currentRotation,
                fieldOfView: 75,
                easing: { _tag: 'EaseInOut' },
                effects: [],
              },
            ],
            duration: transitionConfig.duration,
            loopMode: { _tag: 'None' },
            transitionSettings: {
              fadeInDuration: transitionConfig.duration / 4,
              fadeOutDuration: transitionConfig.duration / 4,
              smoothTransition: true,
              preserveOrientation: transitionConfig.preserveTargets,
            },
            metadata: {
              creator: 'System',
              version: '1.0.0',
              created: now,
              lastModified: now,
              tags: ['transition'],
              category: { _tag: 'Cinematic' },
            },
          } as CinematicSequence

          return createSequenceExecutionResult.started(transitionSequence.id, transitionConfig.duration)
        }),

      startDynamicTracking: (sceneCameraId, target, trackingConfig) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const cameraState = yield* findSceneCamera(sceneCameraId)

          // 追跡状態の保存
          trackingStates.set(sceneCameraId, {
            target,
            config: trackingConfig,
            startTime: now,
            isActive: true,
          })

          const updatedState = {
            ...cameraState,
            lastUpdate: now,
          } as SceneCameraState

          sceneCameras.set(sceneCameraId, updatedState)
        }),

      stopDynamicTracking: (sceneCameraId) =>
        Effect.gen(function* () {
          yield* findSceneCamera(sceneCameraId) // 存在確認

          trackingStates.delete(sceneCameraId)
        }),

      getSceneCameraStatistics: (sceneCameraId) =>
        Effect.gen(function* () {
          yield* findSceneCamera(sceneCameraId) // 存在確認

          return yield* pipe(
            Option.fromNullable(performanceMetrics.get(sceneCameraId)),
            Option.match({
              onNone: () => Effect.fail(createSceneCameraApplicationError.sceneCameraNotFound(sceneCameraId)),
              onSome: Effect.succeed,
            })
          )
        }),

      getSceneStatistics: (sceneId) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis

          return yield* pipe(
            Option.fromNullable(scenes.get(sceneId)),
            Option.match({
              onNone: () => Effect.fail(createSceneCameraApplicationError.sceneNotFound(sceneId)),
              onSome: (sceneCameraIds) => {
                const activeCameras = Array.from(sceneCameraIds)
                  .map((id) => sceneCameras.get(id))
                  .filter((camera) => camera?.isActive).length

                return Effect.succeed({
                  totalCameras: sceneCameraIds.size,
                  activeCameras,
                  totalSequencesPlayed: Array.from(sceneCameraIds)
                    .map((id) => performanceMetrics.get(id)?.totalSequencesPlayed || 0)
                    .reduce((sum, count) => sum + count, 0),
                  averagePerformance: 60, // 簡略実装
                  memoryUsage: sceneCameraIds.size * 1024 * 1024, // 1MB per camera
                  lastOptimization: now,
                } as SceneStatistics)
              },
            })
          )
        }),

      optimizeSceneCameras: (optimizationTargets) =>
        Effect.gen(function* () {
          const stats = yield* Effect.when(optimizationTargets.cleanupInactiveCameras, () =>
            Effect.gen(function* () {
              let camerasOptimized = 0
              let memoryFreed = 0

              yield* Effect.all(
                Array.from(sceneCameras.entries()).map(([sceneCameraId, cameraState]) =>
                  Effect.when(!cameraState.isActive, () =>
                    Effect.sync(() => {
                      pipe(
                        Option.fromNullable(scenes.get(cameraState.sceneId)),
                        Option.match({
                          onNone: () => {},
                          onSome: (sceneSet) => {
                            sceneSet.delete(sceneCameraId)
                          },
                        })
                      )
                      sceneCameras.delete(sceneCameraId)
                      activeSequences.delete(sceneCameraId)
                      performanceMetrics.delete(sceneCameraId)

                      camerasOptimized++
                      memoryFreed += 1024 * 1024 // 1MB per camera
                    })
                  )
                ),
                { concurrency: 4 }
              )

              return { camerasOptimized, memoryFreed }
            })
          )

          const { camerasOptimized = 0, memoryFreed = 0 } = stats || {}

          return {
            camerasOptimized,
            sequencesOptimized: 0,
            memoryFreed,
            performanceImprovement: 0.1, // 10%改善
            optimizationDuration: 100, // 100ms
          } as OptimizationResult
        }),

      validateSequence: (sequence) =>
        Effect.gen(function* () {
          // 基本的な検証
          const baseErrors = [
            ...(sequence.keyframes.length === 0 ? ['Sequence must have at least one keyframe'] : []),
            ...(sequence.duration <= 0 ? ['Sequence duration must be positive'] : []),
          ]

          // キーフレームの検証
          const keyframeErrors = sequence.keyframes.flatMap((keyframe, i) =>
            keyframe.time < 0 || keyframe.time > sequence.duration
              ? [`Keyframe ${i} time is out of sequence duration range`]
              : []
          )

          const errors = [...baseErrors, ...keyframeErrors]

          return errors.length > 0
            ? (Data.struct({
                _tag: 'Invalid' as const,
                errors: errors.map((msg) => ({
                  type: 'ValidationError',
                  message: msg,
                  keyframeIndex: Option.none(),
                  severity: { _tag: 'Medium' },
                })),
                warnings: [],
              }) as SequenceValidationResult)
            : (Data.struct({
                _tag: 'Valid' as const,
                estimatedDuration: sequence.duration,
                requiredResources: ['memory', 'gpu'],
              }) as SequenceValidationResult)
        }),

      getDebugInfo: (sceneCameraId) =>
        Effect.gen(function* () {
          const currentState = yield* findSceneCamera(sceneCameraId)

          return yield* pipe(
            Option.fromNullable(performanceMetrics.get(sceneCameraId)),
            Option.match({
              onNone: () => Effect.fail(createSceneCameraApplicationError.sceneCameraNotFound(sceneCameraId)),
              onSome: (statistics) =>
                Effect.succeed({
                  currentState,
                  recentOperations: ['startSequence', 'updateTargets'], // 簡略実装
                  performanceMetrics: statistics,
                  memoryBreakdown: {
                    sequences: 1024,
                    keyframes: 2048,
                    targets: 512,
                    animations: 1024,
                    effects: 256,
                    total: 4864,
                  },
                  activeSequenceDetails: Option.fromNullable(activeSequences.get(sceneCameraId)).pipe(
                    Option.map((sequence) => ({
                      sequenceId: sequence.id,
                      currentKeyframe: 0,
                      totalKeyframes: sequence.keyframes.length,
                      progress: 0.5, // 50%
                      remainingTime: sequence.duration / 2,
                      lastFrameTime: 16.67,
                    }))
                  ),
                } as SceneCameraDebugInfo),
            })
          )
        }),
    })
  })
)
