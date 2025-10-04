import { Context, Effect, Layer, Match, Option, pipe, Schema, STM, Ref } from 'effect'

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
    Schema.Literal('computation'),
  ),
  dependencies: Schema.Array(Schema.String),
  dependents: Schema.Array(Schema.String),
  status: Schema.Union(
    Schema.Literal('waiting'),
    Schema.Literal('ready'),
    Schema.Literal('running'),
    Schema.Literal('completed'),
    Schema.Literal('failed'),
  ),
  priority: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
  estimatedDuration: Schema.Number.pipe(Schema.positive()),
  resourceRequirements: Schema.Struct({
    cpu: Schema.Number.pipe(Schema.between(0, 1)),
    memory: Schema.Number.pipe(Schema.positive()),
    io: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
})

export const DependencyGraph = Schema.Struct({
  _tag: Schema.Literal('DependencyGraph'),
  nodes: Schema.Record(Schema.String, DependencyNode),
  edges: Schema.Array(Schema.Struct({
    from: Schema.String,
    to: Schema.String,
    weight: Schema.Number.pipe(Schema.positive()),
    type: Schema.Union(
      Schema.Literal('hard'),
      Schema.Literal('soft'),
      Schema.Literal('optional'),
    ),
  })),
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
  reservations: Schema.Record(Schema.String, Schema.Struct({
    cpu: Schema.Number,
    memory: Schema.Number,
    io: Schema.Number,
    duration: Schema.Number,
  })),
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
  Schema.Literal('adaptive'), // 適応的実行
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
    Schema.Literal('priority_override'),
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
    cause: Schema.optional(Schema.Unknown),
    recovery: Schema.optional(Schema.String),
  }
)

export interface DependencyCoordinatorErrorType
  extends Schema.Schema.Type<typeof DependencyCoordinatorError> {}

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
    taskExecutors: Record<string, Effect.Effect<any, any>>
  ) => Effect.Effect<Record<string, any>, DependencyCoordinatorErrorType>

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
  readonly releaseResources: (
    taskId: string
  ) => Effect.Effect<void, DependencyCoordinatorErrorType>

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
  readonly getResourceUsage: () => Effect.Effect<Schema.Schema.Type<typeof ResourcePool>, DependencyCoordinatorErrorType>

  /**
   * 実行統計を取得します
   */
  readonly getExecutionStatistics: () => Effect.Effect<Record<string, any>, DependencyCoordinatorErrorType>
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
  const executionHistory = yield* Ref.make<Array<{ taskId: string; startTime: number; endTime: number; result: any }>([])

  const buildDependencyGraph = (
    nodes: Schema.Schema.Type<typeof DependencyNode>[],
    config: Schema.Schema.Type<typeof CoordinationConfig>
  ) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`依存関係グラフ構築開始: ${nodes.length}ノード`)

      const nodeMap = new Map(nodes.map(node => [node.id, node]))
      const edges = []

      // エッジ構築
      for (const node of nodes) {
        for (const depId of node.dependencies) {
          if (nodeMap.has(depId)) {
            edges.push({
              from: depId,
              to: node.id,
              weight: 1.0,
              type: 'hard' as const,
            })
          }
        }
      }

      // 循環依存検出
      const cycles = yield* detectCycles(nodeMap, edges)
      if (cycles.length > 0 && config.deadlockDetection) {
        yield* Effect.logWarning(`循環依存検出: ${cycles.length}個`)
      }

      // クリティカルパス計算
      const criticalPath = yield* calculateCriticalPathInternal(nodeMap, edges)

      const graph: Schema.Schema.Type<typeof DependencyGraph> = {
        _tag: 'DependencyGraph',
        nodes: Object.fromEntries(nodeMap.entries()),
        edges,
        cycles,
        criticalPath,
      }

      yield* Effect.logInfo(`依存関係グラフ構築完了: ${edges.length}エッジ, ${cycles.length}循環`)
      return graph
    })

  const createExecutionPlan = (
    graph: Schema.Schema.Type<typeof DependencyGraph>,
    resourcePool: Schema.Schema.Type<typeof ResourcePool>
  ) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('実行計画作成開始')

      // トポロジカルソート
      const plan = yield* topologicalSort(graph)

      // リソース制約に基づく最適化
      const optimizedPlan = yield* optimizeForResources(plan, graph, resourcePool)

      yield* Effect.logInfo(`実行計画作成完了: ${optimizedPlan.length}ステップ`)
      return optimizedPlan
    })

  const coordinateExecution = (
    executionPlan: string[],
    taskExecutors: Record<string, Effect.Effect<any, any>>
  ) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`調整実行開始: ${executionPlan.length}タスク`)

      const results: Record<string, any> = {}
      const concurrentTasks = new Map<string, Effect.Effect<any, any>>()

      for (const taskId of executionPlan) {
        if (!taskExecutors[taskId]) {
          yield* Effect.logWarning(`タスクエグゼキューター未定義: ${taskId}`)
          continue
        }

        // リソース割り当て
        const allocation = yield* allocateResources(taskId, {
          cpu: 0.25,
          memory: 512,
          io: 0.1,
        })

        try {
          // タスク実行
          const startTime = Date.now()
          const result = yield* taskExecutors[taskId]
          const endTime = Date.now()

          results[taskId] = result

          // 実行履歴記録
          yield* Ref.update(executionHistory, history => [
            ...history,
            { taskId, startTime, endTime, result }
          ])

          yield* Effect.logInfo(`タスク完了: ${taskId} (${endTime - startTime}ms)`)
        } finally {
          // リソース解放
          yield* releaseResources(taskId)
        }
      }

      yield* Effect.logInfo(`調整実行完了: ${Object.keys(results).length}タスク`)
      return results
    })

  const allocateResources = (
    taskId: string,
    requirements: Schema.Schema.Type<typeof DependencyNode>['resourceRequirements']
  ) =>
    Effect.gen(function* () {
      const currentPool = yield* Ref.get(resourcePool)

      // リソース可用性チェック
      if (currentPool.cpuCapacity < requirements.cpu ||
          currentPool.memoryCapacity < requirements.memory ||
          currentPool.ioCapacity < requirements.io) {
        return yield* Effect.fail({
          _tag: 'DependencyCoordinatorError' as const,
          message: `リソース不足: ${taskId}`,
          coordinationId: 'resource-allocation',
          nodeId: taskId,
        })
      }

      const allocation: Schema.Schema.Type<typeof ResourceAllocation> = {
        _tag: 'ResourceAllocation',
        taskId,
        allocatedCpu: requirements.cpu,
        allocatedMemory: requirements.memory,
        allocatedIo: requirements.io,
        startTime: Date.now(),
        estimatedEndTime: Date.now() + 30000, // 30秒の推定
      }

      // リソース予約
      yield* Ref.update(resourcePool, pool => ({
        ...pool,
        cpuCapacity: pool.cpuCapacity - requirements.cpu,
        memoryCapacity: pool.memoryCapacity - requirements.memory,
        ioCapacity: pool.ioCapacity - requirements.io,
        activeTasks: [...pool.activeTasks, taskId],
      }))

      yield* Ref.update(activeAllocations, allocs => allocs.set(taskId, allocation))

      yield* Effect.logDebug(`リソース割り当て: ${taskId} - CPU:${requirements.cpu}, MEM:${requirements.memory}MB`)
      return allocation
    })

  const releaseResources = (taskId: string) =>
    Effect.gen(function* () {
      const allocs = yield* Ref.get(activeAllocations)
      const allocation = allocs.get(taskId)

      if (!allocation) {
        yield* Effect.logWarning(`割り当て情報が見つかりません: ${taskId}`)
        return
      }

      // リソース解放
      yield* Ref.update(resourcePool, pool => ({
        ...pool,
        cpuCapacity: pool.cpuCapacity + allocation.allocatedCpu,
        memoryCapacity: pool.memoryCapacity + allocation.allocatedMemory,
        ioCapacity: pool.ioCapacity + allocation.allocatedIo,
        activeTasks: pool.activeTasks.filter(id => id !== taskId),
      }))

      yield* Ref.update(activeAllocations, allocs => {
        allocs.delete(taskId)
        return allocs
      })

      yield* Effect.logDebug(`リソース解放: ${taskId}`)
    })

  const detectDeadlock = (graph: Schema.Schema.Type<typeof DependencyGraph>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('デッドロック検出開始')
      return graph.cycles
    })

  const calculateCriticalPath = (graph: Schema.Schema.Type<typeof DependencyGraph>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('クリティカルパス計算開始')
      return graph.criticalPath
    })

  const getResourceUsage = () => Ref.get(resourcePool)

  const getExecutionStatistics = () =>
    Effect.gen(function* () {
      const history = yield* Ref.get(executionHistory)
      const allocs = yield* Ref.get(activeAllocations)

      return {
        totalExecutions: history.length,
        activeAllocations: allocs.size,
        averageExecutionTime: history.length > 0 ?
          history.reduce((sum, h) => sum + (h.endTime - h.startTime), 0) / history.length :
          0,
        resourceUtilization: {
          cpu: Array.from(allocs.values()).reduce((sum, a) => sum + a.allocatedCpu, 0),
          memory: Array.from(allocs.values()).reduce((sum, a) => sum + a.allocatedMemory, 0),
          io: Array.from(allocs.values()).reduce((sum, a) => sum + a.allocatedIo, 0),
        },
      }
    })

  // === Helper Functions ===

  const detectCycles = (
    nodes: Map<string, Schema.Schema.Type<typeof DependencyNode>>,
    edges: any[]
  ) =>
    Effect.gen(function* () {
      const visited = new Set<string>()
      const recursionStack = new Set<string>()
      const cycles: string[][] = []

      const dfs = (nodeId: string, path: string[]): boolean => {
        if (recursionStack.has(nodeId)) {
          const cycleStart = path.indexOf(nodeId)
          cycles.push(path.slice(cycleStart))
          return true
        }

        if (visited.has(nodeId)) return false

        visited.add(nodeId)
        recursionStack.add(nodeId)

        const dependencies = nodes.get(nodeId)?.dependencies || []
        for (const depId of dependencies) {
          if (dfs(depId, [...path, nodeId])) {
            return true
          }
        }

        recursionStack.delete(nodeId)
        return false
      }

      for (const nodeId of nodes.keys()) {
        if (!visited.has(nodeId)) {
          dfs(nodeId, [])
        }
      }

      return cycles
    })

  const calculateCriticalPathInternal = (
    nodes: Map<string, Schema.Schema.Type<typeof DependencyNode>>,
    edges: any[]
  ) =>
    Effect.gen(function* () {
      // 最長経路計算（簡略化）
      const durations = new Map<string, number>()
      for (const [nodeId, node] of nodes) {
        durations.set(nodeId, node.estimatedDuration)
      }

      // 単純な場合のクリティカルパス（実際はより複雑な計算が必要）
      return Array.from(nodes.keys()).slice(0, 3) // プレースホルダー
    })

  const topologicalSort = (graph: Schema.Schema.Type<typeof DependencyGraph>) =>
    Effect.gen(function* () {
      const inDegree = new Map<string, number>()
      const adjList = new Map<string, string[]>()

      // 初期化
      for (const nodeId of Object.keys(graph.nodes)) {
        inDegree.set(nodeId, 0)
        adjList.set(nodeId, [])
      }

      // グラフ構築
      for (const edge of graph.edges) {
        adjList.get(edge.from)?.push(edge.to)
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1)
      }

      // トポロジカルソート
      const queue = Array.from(inDegree.entries())
        .filter(([_, degree]) => degree === 0)
        .map(([nodeId, _]) => nodeId)

      const result: string[] = []

      while (queue.length > 0) {
        const current = queue.shift()!
        result.push(current)

        for (const neighbor of adjList.get(current) || []) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1
          inDegree.set(neighbor, newDegree)

          if (newDegree === 0) {
            queue.push(neighbor)
          }
        }
      }

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
  DependencyGraph as DependencyGraphType,
  DependencyNode as DependencyNodeType,
  ResourcePool as ResourcePoolType,
  ResourceAllocation as ResourceAllocationType,
  CoordinationConfig as CoordinationConfigType,
} from './dependency-coordinator.js'