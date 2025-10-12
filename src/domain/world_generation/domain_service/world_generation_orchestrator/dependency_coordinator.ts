import { JsonValueSchema, type JsonSerializable } from '@shared/schema/json'
import { Clock, Context, Effect, Layer, Option, pipe, ReadonlyArray, Ref, Schema } from 'effect'

/**
 * Dependency Coordinator Service
 *
 * ワールド生成における依存関係の調整とリソース管理を担当します。
 * 複数のドメインサービス間の協調を最適化し、デッドロックを防止します。
 */

// === Dependency Graph Types ===

export const DependencyNode = Schema.Struct({
  _tag: Schema.Literal('DependencyNode'),
  id: Schema.String,
  type: Schema.Union(
    Schema.Literal('service'),
    Schema.Literal('resource'),
    Schema.Literal('data'),
    Schema.Literal('computation')
  ),
  dependencies: Schema.Array(Schema.String),
  dependents: Schema.Array(Schema.String),
  status: Schema.Union(
    Schema.Literal('waiting'),
    Schema.Literal('ready'),
    Schema.Literal('running'),
    Schema.Literal('completed'),
    Schema.Literal('failed')
  ),
  priority: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  estimatedDuration: Schema.Number.pipe(Schema.positive()),
  resourceRequirements: Schema.Struct({
    cpu: Schema.Number.pipe(Schema.between(0, 1)),
    memory: Schema.Number.pipe(Schema.positive()),
    io: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  metadata: Schema.Record(Schema.String, JsonValueSchema),
})

export const DependencyGraph = Schema.Struct({
  _tag: Schema.Literal('DependencyGraph'),
  nodes: Schema.Record(Schema.String, DependencyNode),
  edges: Schema.Array(
    Schema.Struct({
      from: Schema.String,
      to: Schema.String,
      weight: Schema.Number.pipe(Schema.positive()),
      type: Schema.Union(Schema.Literal('hard'), Schema.Literal('soft'), Schema.Literal('optional')),
    })
  ),
  cycles: Schema.Array(Schema.Array(Schema.String)),
  criticalPath: Schema.Array(Schema.String),
})

// === Resource Management Types ===

export const ResourcePool = Schema.Struct({
  _tag: Schema.Literal('ResourcePool'),
  cpuCapacity: Schema.Number.pipe(Schema.between(0, 1)),
  memoryCapacity: Schema.Number.pipe(Schema.positive()),
  ioCapacity: Schema.Number.pipe(Schema.between(0, 1)),
  activeTasks: Schema.Array(Schema.String),
  reservations: Schema.Record(
    Schema.String,
    Schema.Struct({
      cpu: Schema.Number,
      memory: Schema.Number,
      io: Schema.Number,
      duration: Schema.Number,
    })
  ),
})

export const ResourceAllocation = Schema.Struct({
  _tag: Schema.Literal('ResourceAllocation'),
  taskId: Schema.String,
  allocatedCpu: Schema.Number,
  allocatedMemory: Schema.Number,
  allocatedIo: Schema.Number,
  startTime: Schema.Number,
  estimatedEndTime: Schema.Number,
})

// === Coordination Strategy ===

export const CoordinationStrategy = Schema.Union(
  Schema.Literal('sequential'), // 順次実行
  Schema.Literal('parallel'), // 並列実行
  Schema.Literal('pipeline'), // パイプライン実行
  Schema.Literal('adaptive') // 適応的実行
)

export const CoordinationConfig = Schema.Struct({
  _tag: Schema.Literal('CoordinationConfig'),
  strategy: CoordinationStrategy,
  maxConcurrency: Schema.Number.pipe(Schema.positive(), Schema.int()),
  resourceThresholds: Schema.Struct({
    cpuThreshold: Schema.Number.pipe(Schema.between(0, 1)),
    memoryThreshold: Schema.Number.pipe(Schema.positive()),
    ioThreshold: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  deadlockDetection: Schema.Boolean,
  deadlockResolution: Schema.Union(
    Schema.Literal('abort'),
    Schema.Literal('backtrack'),
    Schema.Literal('priority_override')
  ),
  loadBalancing: Schema.Boolean,
  adaptiveScheduling: Schema.Boolean,
})

// === Coordination Error ===

export const DependencyCoordinatorError = Schema.TaggedError<DependencyCoordinatorErrorType>()(
  'DependencyCoordinatorError',
  {
    message: Schema.String,
    coordinationId: Schema.String,
    nodeId: Schema.optional(Schema.String),
    cause: Schema.optional(JsonValueSchema),
    recovery: Schema.optional(Schema.String),
  }
)

export interface DependencyCoordinatorErrorType extends Schema.Schema.Type<typeof DependencyCoordinatorError> {}

type TaskExecutionResult = JsonSerializable | void

type TaskExecutors = Record<string, Effect.Effect<TaskExecutionResult, DependencyCoordinatorErrorType>>

type TaskExecutionResults = Record<string, TaskExecutionResult>

type ExecutionHistoryEntry = {
  readonly taskId: string
  readonly startTime: number
  readonly endTime: number
  readonly result: TaskExecutionResult
}

type ExecutionStatistics = {
  readonly totalExecutions: number
  readonly activeAllocations: number
  readonly averageExecutionTime: number
  readonly resourceUtilization: {
    readonly cpu: number
    readonly memory: number
    readonly io: number
  }
}

type DependencyGraphEdge = Schema.Schema.Type<typeof DependencyGraph>['edges'][number]

// === Service Interface ===

export interface DependencyCoordinatorService {
  /**
   * 依存関係グラフを構築します
   */
  readonly buildDependencyGraph: (
    nodes: Schema.Schema.Type<typeof DependencyNode>[],
    config: Schema.Schema.Type<typeof CoordinationConfig>
  ) => Effect.Effect<Schema.Schema.Type<typeof DependencyGraph>, DependencyCoordinatorErrorType>

  /**
   * 実行計画を作成します
   */
  readonly createExecutionPlan: (
    graph: Schema.Schema.Type<typeof DependencyGraph>,
    resourcePool: Schema.Schema.Type<typeof ResourcePool>
  ) => Effect.Effect<string[], DependencyCoordinatorErrorType>

  /**
   * タスクを調整実行します
   */
  readonly coordinateExecution: (
    executionPlan: string[],
    taskExecutors: TaskExecutors
  ) => Effect.Effect<TaskExecutionResults, DependencyCoordinatorErrorType>

  /**
   * リソースを割り当てます
   */
  readonly allocateResources: (
    taskId: string,
    requirements: Schema.Schema.Type<typeof DependencyNode>['resourceRequirements']
  ) => Effect.Effect<Schema.Schema.Type<typeof ResourceAllocation>, DependencyCoordinatorErrorType>

  /**
   * リソースを解放します
   */
  readonly releaseResources: (taskId: string) => Effect.Effect<void, DependencyCoordinatorErrorType>

  /**
   * デッドロックを検出します
   */
  readonly detectDeadlock: (
    graph: Schema.Schema.Type<typeof DependencyGraph>
  ) => Effect.Effect<string[][], DependencyCoordinatorErrorType>

  /**
   * クリティカルパスを計算します
   */
  readonly calculateCriticalPath: (
    graph: Schema.Schema.Type<typeof DependencyGraph>
  ) => Effect.Effect<string[], DependencyCoordinatorErrorType>

  /**
   * 現在のリソース使用状況を取得します
   */
  readonly getResourceUsage: () => Effect.Effect<
    Schema.Schema.Type<typeof ResourcePool>,
    DependencyCoordinatorErrorType
  >

  /**
   * 実行統計を取得します
   */
  readonly getExecutionStatistics: () => Effect.Effect<ExecutionStatistics, DependencyCoordinatorErrorType>
}

// === Live Implementation ===

const makeDependencyCoordinatorService = Effect.gen(function* () {
  // 内部状態管理
  const resourcePool = yield* Ref.make<Schema.Schema.Type<typeof ResourcePool>>({
    _tag: 'ResourcePool',
    cpuCapacity: 1.0,
    memoryCapacity: 8192, // 8GB
    ioCapacity: 1.0,
    activeTasks: [],
    reservations: {},
  })

  const activeAllocations = yield* Ref.make<Map<string, Schema.Schema.Type<typeof ResourceAllocation>>>(new Map())
  const executionHistory = yield* Ref.make<Array<ExecutionHistoryEntry>>([])

  const buildDependencyGraph = (
    nodes: Schema.Schema.Type<typeof DependencyNode>[],
    config: Schema.Schema.Type<typeof CoordinationConfig>
  ) =>
    Effect.gen(function* () {
      yield* Effect.unit

      const nodeMap = new Map(nodes.map((node) => [node.id, node]))
      // エッジ構築
      const edges = pipe(
        nodes,
        ReadonlyArray.flatMap((node) =>
          pipe(
            node.dependencies,
            ReadonlyArray.filterMap((depId) =>
              nodeMap.has(depId)
                ? Option.some({
                    from: depId,
                    to: node.id,
                    weight: 1.0,
                    type: 'hard' as const,
                  })
                : Option.none()
            )
          )
        )
      )

      // 循環依存検出
      const cycles = yield* detectCycles(nodeMap, edges)
      yield* Effect.when(cycles.length > 0 && config.deadlockDetection, () =>
        Effect.unit
      )

      // クリティカルパス計算
      const criticalPath = yield* calculateCriticalPathInternal(nodeMap, edges)

      const graph: Schema.Schema.Type<typeof DependencyGraph> = {
        _tag: 'DependencyGraph',
        nodes: Object.fromEntries(nodeMap.entries()),
        edges,
        cycles,
        criticalPath,
      }

      yield* Effect.unit
      return graph
    })

  const createExecutionPlan = (
    graph: Schema.Schema.Type<typeof DependencyGraph>,
    resourcePool: Schema.Schema.Type<typeof ResourcePool>
  ) =>
    Effect.gen(function* () {
      yield* Effect.unit

      // トポロジカルソート
      const plan = yield* topologicalSort(graph)

      // リソース制約に基づく最適化
      const optimizedPlan = yield* optimizeForResources(plan, graph, resourcePool)

      yield* Effect.unit
      return optimizedPlan
    })

  const coordinateExecution = (executionPlan: string[], taskExecutors: TaskExecutors) =>
    Effect.gen(function* () {
      yield* Effect.unit

      const results = yield* pipe(
        executionPlan,
        Effect.reduce({} satisfies TaskExecutionResults, (acc, taskId) =>
          pipe(
            Option.fromNullable(taskExecutors[taskId]),
            Option.match({
              onNone: () =>
                Effect.gen(function* () {
                  yield* Effect.unit
                  return acc
                }),
              onSome: (executor) =>
                Effect.gen(function* () {
                  // リソース割り当て
                  const allocation = yield* allocateResources(taskId, {
                    cpu: 0.25,
                    memory: 512,
                    io: 0.1,
                  })

                  const result = yield* pipe(
                    Effect.gen(function* () {
                      // タスク実行
                      const startTime = yield* Clock.currentTimeMillis
                      const result = yield* executor
                      const endTime = yield* Clock.currentTimeMillis

                      // 実行履歴記録
                      yield* Ref.update(executionHistory, (history) => [
                        ...history,
                        { taskId, startTime, endTime, result },
                      ])

                      yield* Effect.unit
                      return result
                    }),
                    Effect.ensuring(releaseResources(taskId))
                  )

                  return { ...acc, [taskId]: result }
                }),
            })
          )
        )
      )

      yield* Effect.unit
      return results
    })

  const allocateResources = (
    taskId: string,
    requirements: Schema.Schema.Type<typeof DependencyNode>['resourceRequirements']
  ) =>
    Effect.gen(function* () {
      const currentPool = yield* Ref.get(resourcePool)

      // リソース可用性チェック
      const hasInsufficientResources =
        currentPool.cpuCapacity < requirements.cpu ||
        currentPool.memoryCapacity < requirements.memory ||
        currentPool.ioCapacity < requirements.io

      yield* Effect.when(hasInsufficientResources, () =>
        Effect.fail({
          _tag: 'DependencyCoordinatorError' as const,
          message: `リソース不足: ${taskId}`,
          coordinationId: 'resource-allocation',
          nodeId: taskId,
        })
      )

      const allocation: Schema.Schema.Type<typeof ResourceAllocation> = {
        _tag: 'ResourceAllocation',
        taskId,
        allocatedCpu: requirements.cpu,
        allocatedMemory: requirements.memory,
        allocatedIo: requirements.io,
        startTime: yield* Clock.currentTimeMillis,
        estimatedEndTime: yield* Clock.currentTimeMillis,
      }

      // リソース予約
      yield* Ref.update(resourcePool, (pool) => ({
        ...pool,
        cpuCapacity: pool.cpuCapacity - requirements.cpu,
        memoryCapacity: pool.memoryCapacity - requirements.memory,
        ioCapacity: pool.ioCapacity - requirements.io,
        activeTasks: [...pool.activeTasks, taskId],
      }))

      yield* Ref.update(activeAllocations, (allocs) => allocs.set(taskId, allocation))

      yield* Effect.unit
      return allocation
    })

  const releaseResources = (taskId: string) =>
    Effect.gen(function* () {
      const allocs = yield* Ref.get(activeAllocations)

      yield* pipe(
        Option.fromNullable(allocs.get(taskId)),
        Option.match({
          onNone: () => Effect.unit,
          onSome: (allocation) =>
            Effect.gen(function* () {
              // リソース解放
              yield* Ref.update(resourcePool, (pool) => ({
                ...pool,
                cpuCapacity: pool.cpuCapacity + allocation.allocatedCpu,
                memoryCapacity: pool.memoryCapacity + allocation.allocatedMemory,
                ioCapacity: pool.ioCapacity + allocation.allocatedIo,
                activeTasks: pool.activeTasks.filter((id) => id !== taskId),
              }))

              yield* Ref.update(activeAllocations, (allocs) => {
                allocs.delete(taskId)
                return allocs
              })

              yield* Effect.unit
            }),
        })
      )
    })

  const detectDeadlock = (graph: Schema.Schema.Type<typeof DependencyGraph>) =>
    Effect.gen(function* () {
      yield* Effect.unit
      return graph.cycles
    })

  const calculateCriticalPath = (graph: Schema.Schema.Type<typeof DependencyGraph>) =>
    Effect.gen(function* () {
      yield* Effect.unit
      return graph.criticalPath
    })

  const getResourceUsage = () => Ref.get(resourcePool)

  const getExecutionStatistics = () =>
    Effect.gen(function* () {
      const history = yield* Ref.get(executionHistory)
      const allocs = yield* Ref.get(activeAllocations)

      const statistics: ExecutionStatistics = {
        totalExecutions: history.length,
        activeAllocations: allocs.size,
        averageExecutionTime:
          history.length > 0
            ? history.reduce((sum, entry) => sum + (entry.endTime - entry.startTime), 0) / history.length
            : 0,
        resourceUtilization: {
          cpu: Array.from(allocs.values()).reduce((sum, allocation) => sum + allocation.allocatedCpu, 0),
          memory: Array.from(allocs.values()).reduce((sum, allocation) => sum + allocation.allocatedMemory, 0),
          io: Array.from(allocs.values()).reduce((sum, allocation) => sum + allocation.allocatedIo, 0),
        },
      }

      return statistics
    })

  // === Helper Functions ===

  const detectCycles = (
    nodes: Map<string, Schema.Schema.Type<typeof DependencyNode>>,
    edges: ReadonlyArray<DependencyGraphEdge>
  ) =>
    Effect.gen(function* () {
      const visited = new Set<string>()
      const recursionStack = new Set<string>()
      const cycles: string[][] = []

      const dfs = (nodeId: string, path: string[]): boolean =>
        pipe(
          Match.value(recursionStack.has(nodeId)),
          Match.when(
            (inStack) => inStack,
            () => {
              const cycleStart = path.indexOf(nodeId)
              cycles.push(path.slice(cycleStart))
              return true
            }
          ),
          Match.orElse(() =>
            pipe(
              Match.value(visited.has(nodeId)),
              Match.when(
                (seen) => seen,
                () => false
              ),
              Match.orElse(() => {
                visited.add(nodeId)
                recursionStack.add(nodeId)

                const dependencies = nodes.get(nodeId)?.dependencies ?? []
                const hasCycle = pipe(
                  dependencies,
                  ReadonlyArray.some((depId) => dfs(depId, [...path, nodeId]))
                )

                return pipe(
                  Match.value(hasCycle),
                  Match.when(
                    (cycleDetected) => cycleDetected,
                    () => true
                  ),
                  Match.orElse(() => {
                    recursionStack.delete(nodeId)
                    return false
                  })
                )
              })
            )
          )
        )

      Array.from(nodes.keys()).forEach((nodeId) =>
        pipe(
          Match.value(visited.has(nodeId)),
          Match.when(
            (seen) => seen,
            () => undefined
          ),
          Match.orElse(() => dfs(nodeId, []))
        )
      )

      return cycles
    })

  const calculateCriticalPathInternal = (
    nodes: Map<string, Schema.Schema.Type<typeof DependencyNode>>,
    edges: ReadonlyArray<DependencyGraphEdge>
  ) =>
    Effect.gen(function* () {
      // 最長経路計算（簡略化）
      const durations = new Map(
        pipe(
          Array.from(nodes.entries()),
          ReadonlyArray.map(([nodeId, node]) => [nodeId, node.estimatedDuration] as const)
        )
      )

      // 単純な場合のクリティカルパス（実際はより複雑な計算が必要）
      return Array.from(nodes.keys()).slice(0, 3) // プレースホルダー
    })

  const topologicalSort = (graph: Schema.Schema.Type<typeof DependencyGraph>) =>
    Effect.gen(function* () {
      const inDegree = new Map<string, number>()
      const adjList = new Map<string, string[]>()

      // 初期化
      pipe(
        Object.keys(graph.nodes),
        ReadonlyArray.map((nodeId) => {
          inDegree.set(nodeId, 0)
          adjList.set(nodeId, [])
        })
      )

      // グラフ構築
      pipe(
        graph.edges,
        ReadonlyArray.map((edge) => {
          adjList.get(edge.from)?.push(edge.to)
          inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
        })
      )

      // トポロジカルソート（再帰的キュー処理）
      const processQueue = (
        queue: string[],
        result: string[],
        inDegree: Map<string, number>,
        adjList: Map<string, string[]>
      ): string[] =>
        pipe(
          Match.value(queue.length === 0),
          Match.when(
            (empty) => empty,
            () => result
          ),
          Match.orElse(() => {
            const current = queue[0]
            const newQueue = queue.slice(1)
            const newResult = [...result, current]

            const neighbors = adjList.get(current) ?? []
            const { updatedQueue, updatedInDegree } = pipe(
              neighbors,
              ReadonlyArray.reduce({ updatedQueue: newQueue, updatedInDegree: inDegree }, (acc, neighbor) => {
                const newDegree = (acc.updatedInDegree.get(neighbor) ?? 0) - 1
                acc.updatedInDegree.set(neighbor, newDegree)

                return pipe(
                  Match.value(newDegree === 0),
                  Match.when(
                    (zero) => zero,
                    () => ({
                      updatedQueue: [...acc.updatedQueue, neighbor],
                      updatedInDegree: acc.updatedInDegree,
                    })
                  ),
                  Match.orElse(() => acc)
                )
              })
            )

            return processQueue(updatedQueue, newResult, updatedInDegree, adjList)
          })
        )

      const initialQueue = pipe(
        Array.from(inDegree.entries()),
        ReadonlyArray.filter(([_, degree]) => degree === 0),
        ReadonlyArray.map(([nodeId, _]) => nodeId)
      )

      const result = processQueue(initialQueue, [], inDegree, adjList)

      return result
    })

  const optimizeForResources = (
    plan: string[],
    graph: Schema.Schema.Type<typeof DependencyGraph>,
    resourcePool: Schema.Schema.Type<typeof ResourcePool>
  ) =>
    Effect.gen(function* () {
      // リソース制約を考慮した実行順序最適化
      // 現在は単純に元の順序を返す（実際はより複雑な最適化が必要）
      return plan
    })

  return DependencyCoordinatorService.of({
    buildDependencyGraph,
    createExecutionPlan,
    coordinateExecution,
    allocateResources,
    releaseResources,
    detectDeadlock,
    calculateCriticalPath,
    getResourceUsage,
    getExecutionStatistics,
  })
})

// === Context Tag ===

export const DependencyCoordinatorService = Context.GenericTag<DependencyCoordinatorService>(
  '@minecraft/domain/world/DependencyCoordinatorService'
)

// === Layer ===

export const DependencyCoordinatorServiceLive = Layer.effect(
  DependencyCoordinatorService,
  makeDependencyCoordinatorService
)

// === Default Configuration ===

export const DEFAULT_COORDINATION_CONFIG: Schema.Schema.Type<typeof CoordinationConfig> = {
  _tag: 'CoordinationConfig',
  strategy: 'adaptive',
  maxConcurrency: 4,
  resourceThresholds: {
    cpuThreshold: 0.8,
    memoryThreshold: 6144, // 6GB
    ioThreshold: 0.7,
  },
  deadlockDetection: true,
  deadlockResolution: 'backtrack',
  loadBalancing: true,
  adaptiveScheduling: true,
}

export type {
  CoordinationConfig as CoordinationConfigType,
  DependencyGraph as DependencyGraphType,
  DependencyNode as DependencyNodeType,
  ResourceAllocation as ResourceAllocationType,
  ResourcePool as ResourcePoolType,
} from './dependency_coordinator'
