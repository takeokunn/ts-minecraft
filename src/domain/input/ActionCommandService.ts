import { Context, Effect, Layer, Match, Ref, Schema, pipe, Option, Queue, Chunk, Stream, Duration } from 'effect'
import type { GameAction, InputEvent, InputTimestamp } from './schemas'
import { GameActionSchema } from './schemas'

// アクションコマンドエラー
export const ActionCommandErrorSchema = Schema.Struct({
  _tag: Schema.Literal('ActionCommandError'),
  message: Schema.String,
  actionName: Schema.optional(Schema.String),
})
export type ActionCommandError = Schema.Schema.Type<typeof ActionCommandErrorSchema>

// コマンド優先度
export const CommandPrioritySchema = Schema.Number.pipe(Schema.between(0, 100), Schema.brand('CommandPriority'))
export type CommandPriority = Schema.Schema.Type<typeof CommandPrioritySchema>

// コマンドステータス
export const CommandStatusSchema = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('executing'),
  Schema.Literal('completed'),
  Schema.Literal('cancelled'),
  Schema.Literal('failed')
)
export type CommandStatus = Schema.Schema.Type<typeof CommandStatusSchema>

// アクションコマンド
export const ActionCommandSchema = Schema.Struct({
  _tag: Schema.Literal('ActionCommand'),
  id: Schema.String,
  action: GameActionSchema,
  priority: CommandPrioritySchema,
  status: CommandStatusSchema,
  timestamp: Schema.Number.pipe(Schema.brand('InputTimestamp')),
  executionTime: Schema.optional(Schema.Number),
  completionTime: Schema.optional(Schema.Number),
  cancellable: Schema.Boolean,
  buffered: Schema.Boolean,
})
export type ActionCommand = Schema.Schema.Type<typeof ActionCommandSchema>

// コマンドキュー設定
export const CommandQueueSettingsSchema = Schema.Struct({
  _tag: Schema.Literal('CommandQueueSettings'),
  maxQueueSize: Schema.Number.pipe(Schema.between(10, 1000)),
  bufferWindow: Schema.Number.pipe(Schema.between(50, 500)), // ms
  mergeWindow: Schema.Number.pipe(Schema.between(10, 100)), // ms
  priorityLevels: Schema.Number.pipe(Schema.between(3, 10)),
})
export type CommandQueueSettings = Schema.Schema.Type<typeof CommandQueueSettingsSchema>

// アクションコマンドサービスインターフェース
export interface ActionCommandService {
  readonly queueAction: (
    action: GameAction,
    priority?: CommandPriority
  ) => Effect.Effect<ActionCommand, ActionCommandError>
  readonly executeNextCommand: () => Effect.Effect<ActionCommand | null, ActionCommandError>
  readonly cancelCommand: (commandId: string) => Effect.Effect<void, ActionCommandError>
  readonly getQueuedCommands: () => Effect.Effect<ReadonlyArray<ActionCommand>, ActionCommandError>
  readonly getExecutingCommands: () => Effect.Effect<ReadonlyArray<ActionCommand>, ActionCommandError>
  readonly clearQueue: () => Effect.Effect<void, ActionCommandError>
  readonly updateSettings: (settings: CommandQueueSettings) => Effect.Effect<void, ActionCommandError>
  readonly getSettings: () => Effect.Effect<CommandQueueSettings, ActionCommandError>
  readonly mergeCompatibleActions: (
    actions: ReadonlyArray<GameAction>
  ) => Effect.Effect<ReadonlyArray<GameAction>, ActionCommandError>
  readonly createCommandStream: () => Effect.Effect<Stream.Stream<ActionCommand, ActionCommandError>, never>
}

export const ActionCommandService = Context.GenericTag<ActionCommandService>('@minecraft/ActionCommandService')

// デフォルト設定
const DEFAULT_SETTINGS: CommandQueueSettings = {
  _tag: 'CommandQueueSettings',
  maxQueueSize: 100,
  bufferWindow: 100,
  mergeWindow: 20,
  priorityLevels: 5,
}

// コマンドIDジェネレータ
const generateCommandId = (): string => `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// アクションコマンドサービス実装
export const makeActionCommandService = Effect.gen(function* () {
  // 設定
  const settingsRef = yield* Ref.make<CommandQueueSettings>(DEFAULT_SETTINGS)

  // コマンドキュー（優先度キューとして実装）
  const commandQueuesRef = yield* Ref.make<Map<CommandPriority, Queue.Queue<ActionCommand>>>(new Map())

  // 実行中のコマンド
  const executingCommandsRef = yield* Ref.make<Map<string, ActionCommand>>(new Map())

  // コマンドストリーム
  const commandStream = yield* Queue.unbounded<ActionCommand>()

  // 優先度キューの初期化
  yield* pipe(
    Effect.forEach(
      Array.from({ length: DEFAULT_SETTINGS.priorityLevels }, (_, i) => i as CommandPriority),
      (priority) =>
        Effect.gen(function* () {
          const queue = yield* Queue.bounded<ActionCommand>(DEFAULT_SETTINGS.maxQueueSize)
          return { priority, queue }
        })
    ),
    Effect.map((results) => {
      const queues = new Map<CommandPriority, Queue.Queue<ActionCommand>>()
      results.forEach(({ priority, queue }) => queues.set(priority, queue))
      return queues
    }),
    Effect.flatMap((queues) => Ref.set(commandQueuesRef, queues))
  )

  // アクションをキューに追加
  const queueAction = (
    action: GameAction,
    priority: CommandPriority = 50 as CommandPriority
  ): Effect.Effect<ActionCommand, ActionCommandError> =>
    Effect.gen(function* () {
      const settings = yield* Ref.get(settingsRef)
      const queues = yield* Ref.get(commandQueuesRef)

      const command: ActionCommand = {
        _tag: 'ActionCommand',
        id: generateCommandId(),
        action,
        priority,
        status: 'pending',
        timestamp: Date.now() as InputTimestamp,
        cancellable: true,
        buffered: false,
      }

      // 優先度に対応するキューを取得
      const queueLevel = Math.floor(priority / (100 / settings.priorityLevels)) as CommandPriority

      yield* pipe(
        Option.fromNullable(queues.get(queueLevel)),
        Option.match({
          onNone: () =>
            Effect.fail(
              {
                _tag: 'ActionCommandError' as const,
                message: `No queue for priority level ${queueLevel}`,
              }
            ),
          onSome: (queue) =>
            Effect.gen(function* () {
              yield* Queue.offer(queue, command)
              yield* Queue.offer(commandStream, command)
            }),
        })
      )

      return command
    })

  // 次のコマンドを実行
  const executeNextCommand = (): Effect.Effect<ActionCommand | null, ActionCommandError> =>
    Effect.gen(function* () {
      const queues = yield* Ref.get(commandQueuesRef)

      // 優先度の高い順にキューをチェック
      const sortedPriorities = Array.from(queues.keys()).sort((a, b) => b - a)

      const nextCommand = yield* pipe(
        Effect.forEach(sortedPriorities, (priority) =>
          pipe(
            Option.fromNullable(queues.get(priority)),
            Option.match({
              onNone: () => Effect.succeed(Option.none<ActionCommand>()),
              onSome: (q) => Queue.poll(q).pipe(Effect.map(Option.fromNullable)),
            })
          )
        ),
        Effect.map((results) => {
          const found = results.find(Option.isSome)
          return found ? Option.getOrNull(found) : null
        })
      )

      return yield* pipe(
        Option.fromNullable(nextCommand),
        Option.match({
          onNone: () => Effect.succeed(null),
          onSome: (cmd) =>
            Effect.gen(function* () {
              const updatedCommand: ActionCommand = {
                ...cmd,
                status: 'executing' as CommandStatus,
                executionTime: Date.now(),
              }

              yield* Ref.update(executingCommandsRef, (map) => new Map(map).set(cmd.id, updatedCommand))

              return updatedCommand
            }),
        })
      )
    })

  // コマンドをキャンセル
  const cancelCommand = (commandId: string): Effect.Effect<void, ActionCommandError> =>
    Effect.gen(function* () {
      const executingCommands = yield* Ref.get(executingCommandsRef)
      const command = executingCommands.get(commandId)

      yield* pipe(
        Option.fromNullable(command),
        Option.match({
          onNone: () =>
            Effect.fail(
              {
                _tag: 'ActionCommandError' as const,
                message: `Command ${commandId} not found`,
              }
            ),
          onSome: (cmd) =>
            Effect.gen(function* () {
              yield* Effect.unless(Effect.succeed(cmd.cancellable), () =>
                Effect.fail(
                  {
                    _tag: 'ActionCommandError' as const,
                    message: `Command ${commandId} is not cancellable`,
                  }
                )
              )

              // コマンドを実行中リストから削除
              yield* Ref.update(executingCommandsRef, (map) => {
                const newMap = new Map(map)
                newMap.delete(commandId)
                return newMap
              })

              // キャンセル通知
              const cancelledCommand = {
                ...cmd,
                status: 'cancelled' as CommandStatus,
                completionTime: Date.now(),
              }

              yield* Queue.offer(commandStream, cancelledCommand)
            }),
        })
      )
    })

  // キューに入っているコマンドを取得
  const getQueuedCommands = (): Effect.Effect<ReadonlyArray<ActionCommand>, ActionCommandError> =>
    Effect.gen(function* () {
      const queues = yield* Ref.get(commandQueuesRef)
      const allCommands: ActionCommand[] = []

      yield* Effect.forEach(queues.values(), (queue) =>
        Effect.gen(function* () {
          const items = yield* Queue.takeAll(queue)
          allCommands.push(...Chunk.toArray(items))
          // 取り出したアイテムを戻す
          yield* Effect.forEach(items, (item) => Queue.offer(queue, item))
        })
      )

      return allCommands
    })

  // 実行中のコマンドを取得
  const getExecutingCommands = (): Effect.Effect<ReadonlyArray<ActionCommand>, ActionCommandError> =>
    Effect.gen(function* () {
      const executingCommands = yield* Ref.get(executingCommandsRef)
      return Array.from(executingCommands.values())
    })

  // キューをクリア
  const clearQueue = (): Effect.Effect<void, ActionCommandError> =>
    Effect.gen(function* () {
      const queues = yield* Ref.get(commandQueuesRef)

      yield* Effect.forEach(queues.values(), (queue) => Queue.takeAll(queue))
    })

  // 設定更新
  const updateSettings = (settings: CommandQueueSettings): Effect.Effect<void, ActionCommandError> =>
    Effect.gen(function* () {
      const validated = yield* Schema.decode(CommandQueueSettingsSchema)(settings).pipe(
        Effect.mapError((e) => ({
          _tag: 'ActionCommandError' as const,
          message: `Invalid settings: ${e}`,
        }))
      )
      yield* Ref.set(settingsRef, validated)
    })

  // 設定取得
  const getSettings = (): Effect.Effect<CommandQueueSettings, ActionCommandError> => Ref.get(settingsRef)

  // 互換性のあるアクションをマージ
  const mergeCompatibleActions = (
    actions: ReadonlyArray<GameAction>
  ): Effect.Effect<ReadonlyArray<GameAction>, ActionCommandError> =>
    Effect.gen(function* () {
      const settings = yield* Ref.get(settingsRef)
      const mergedActions: GameAction[] = []
      let currentGroup: GameAction[] = []
      let lastTimestamp = 0

      yield* Effect.forEach(actions, (action) =>
        Effect.gen(function* () {
          const currentTimestamp = yield* Match.value(action).pipe(
            Match.when({ _tag: 'MovementAction' }, () => Effect.succeed(Date.now())),
            Match.when({ _tag: 'JumpAction' }, () => Effect.succeed(Date.now())),
            Match.orElse(() => Effect.succeed(Date.now()))
          )

          // マージウィンドウ内かつ同じタイプのアクションか確認
          const canMerge = yield* Effect.if(
            currentGroup.length > 0 &&
              currentGroup[0]._tag === action._tag &&
              currentTimestamp - lastTimestamp < settings.mergeWindow,
            {
              onTrue: () => Effect.succeed(true),
              onFalse: () => Effect.succeed(false),
            }
          )

          yield* Effect.if(canMerge, {
            onTrue: () =>
              Effect.gen(function* () {
                currentGroup.push(action)
              }),
            onFalse: () =>
              Effect.gen(function* () {
                // 前のグループをマージして追加
                yield* Effect.when(
                  Effect.succeed(currentGroup.length > 0),
                  () => Effect.gen(function* () {
                    const merged = yield* mergeActionGroup(currentGroup)
                    mergedActions.push(merged)
                  })
                )
                currentGroup = [action]
              }),
          })

          lastTimestamp = currentTimestamp
        })
      )

      // 最後のグループを処理
      yield* Effect.when(
        Effect.succeed(currentGroup.length > 0),
        () => Effect.gen(function* () {
          const merged = yield* mergeActionGroup(currentGroup)
          mergedActions.push(merged)
        })
      )

      return mergedActions
    })

  // アクショングループをマージ
  const mergeActionGroup = (actions: GameAction[]): Effect.Effect<GameAction, never> =>
    Effect.gen(function* () {
      return yield* Effect.if(actions.length === 0, {
        onTrue: () => Effect.succeed({
          _tag: 'MovementAction' as const,
          direction: 'forward' as const,
          intensity: 0,
        }),
        onFalse: () => Effect.gen(function* () {
          const first = actions[0]!
          return yield* Match.value(first._tag).pipe(
        Match.when('MovementAction', () =>
          Effect.gen(function* () {
            // 移動アクションをマージ（平均的な強度を計算）
            const avgIntensity =
              actions.reduce((sum, a) => (a._tag === 'MovementAction' ? sum + a.intensity : sum), 0) / actions.length

            return {
              ...first,
              intensity: Math.min(1, avgIntensity),
            }
          })
        ),
        Match.when('JumpAction', () =>
          Effect.gen(function* () {
            // ジャンプアクションをマージ（最大強度を使用）
            const maxIntensity = Math.max(...actions.map((a) => (a._tag === 'JumpAction' ? a.intensity : 0)))

            return {
              ...first,
              intensity: maxIntensity,
            }
          })
        ),
            Match.orElse(() => Effect.succeed(first))
          )
        })
      })
    })

  // コマンドストリーム作成
  const createCommandStream = (): Effect.Effect<Stream.Stream<ActionCommand, ActionCommandError>, never> =>
    Effect.succeed(Stream.fromQueue(commandStream))

  return {
    queueAction,
    executeNextCommand,
    cancelCommand,
    getQueuedCommands,
    getExecutingCommands,
    clearQueue,
    updateSettings,
    getSettings,
    mergeCompatibleActions,
    createCommandStream,
  }
})

// ActionCommandServiceレイヤー
export const ActionCommandServiceLive = Layer.effect(ActionCommandService, makeActionCommandService)
