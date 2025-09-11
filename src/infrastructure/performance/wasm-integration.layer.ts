/**
 * WebAssembly Integration Layer (Effect-TS Implementation)
 * High-performance computation offloading to WASM modules
 */

import { Effect, Context, Layer, Ref, HashMap, Option, pipe, Queue, Fiber, Duration, Schedule, Metric, Chunk, Stream } from 'effect'
import * as S from 'effect/Schema'

// ============================================================================
// Schema Definitions
// ============================================================================

export const WasmModuleType = S.Literal('physics', 'terrain', 'pathfinding', 'noise', 'math', 'compression')
export type WasmModuleType = S.Schema.Type<typeof WasmModuleType>

export const WasmModuleConfig = S.Struct({
  name: S.String,
  type: WasmModuleType,
  url: S.String,
  memory: S.Struct({
    initial: S.Number, // in pages (64KB each)
    maximum: S.Number,
  }),
  imports: S.optional(S.Record(S.String, S.Unknown)),
  exports: S.Array(S.String),
  streaming: S.Boolean,
})
export type WasmModuleConfig = S.Schema.Type<typeof WasmModuleConfig>

export const WasmComputeTask = S.Struct({
  id: S.String,
  module: WasmModuleType,
  function: S.String,
  args: S.Array(S.Unknown),
  transferables: S.optional(S.Array(S.Unknown)),
  priority: S.optional(S.Number),
})
export type WasmComputeTask = S.Schema.Type<typeof WasmComputeTask>

export const WasmModuleStats = S.Struct({
  name: S.String,
  executionCount: S.Number,
  totalExecutionTime: S.Number,
  averageExecutionTime: S.Number,
  memoryUsage: S.Number,
  lastExecuted: S.Number,
})
export type WasmModuleStats = S.Schema.Type<typeof WasmModuleStats>

// ============================================================================
// Error Definitions
// ============================================================================

export class WasmError extends S.TaggedError<WasmError>()('WasmError', {
  message: S.String,
  module: S.optional(WasmModuleType),
}) {}

export class WasmCompilationError extends S.TaggedError<WasmCompilationError>()('WasmCompilationError', {
  message: S.String,
  module: WasmModuleType,
  details: S.optional(S.String),
}) {}

// ============================================================================
// WASM Service
// ============================================================================

export interface WasmService {
  readonly loadModule: (config: WasmModuleConfig) => Effect.Effect<void, WasmError>

  readonly execute: <T>(moduleType: WasmModuleType, functionName: string, args: unknown[]) => Effect.Effect<T, WasmError>

  readonly executeAsync: <T>(task: WasmComputeTask) => Effect.Effect<T, WasmError>

  readonly stream: <T, R>(moduleType: WasmModuleType, functionName: string, input: Stream.Stream<T>) => Stream.Stream<R, WasmError>

  readonly batch: <T, R>(moduleType: WasmModuleType, functionName: string, items: ReadonlyArray<T>) => Effect.Effect<ReadonlyArray<R>, WasmError>

  readonly getStats: (moduleType?: WasmModuleType) => Effect.Effect<ReadonlyArray<WasmModuleStats>>

  readonly unloadModule: (moduleType: WasmModuleType) => Effect.Effect<void>

  readonly precompile: (configs: ReadonlyArray<WasmModuleConfig>) => Effect.Effect<void>
}

export const WasmService = Context.GenericTag<WasmService>('WasmService')

// ============================================================================
// WASM Module Manager
// ============================================================================

interface LoadedWasmModule {
  instance: WebAssembly.Instance
  module: WebAssembly.Module
  memory: WebAssembly.Memory
  exports: Record<string, Function>
  stats: {
    executionCount: number
    totalExecutionTime: number
    lastExecuted: number
  }
}

// ============================================================================
// WASM Service Implementation
// ============================================================================

export const WasmServiceLive = Layer.effect(
  WasmService,
  Effect.gen(function* () {
    const modules = yield* Ref.make(HashMap.empty<WasmModuleType, LoadedWasmModule>())
    const taskQueue = yield* Queue.unbounded<{
      task: WasmComputeTask
      deferred: Effect.Deferred<unknown, WasmError>
    }>()

    // Start task processor
    yield* Effect.fork(
      Effect.forever(
        Effect.gen(function* () {
          const { task, deferred } = yield* Queue.take(taskQueue)

          try {
            const result = yield* execute(task.module, task.function, task.args)
            yield* Effect.Deferred.succeed(deferred, result)
          } catch (error) {
            yield* Effect.Deferred.fail(
              deferred,
              new WasmError({
                message: String(error),
                module: task.module,
              }),
            )
          }
        }),
      ),
    )

    const loadModule = (config: WasmModuleConfig) =>
      Effect.gen(function* () {
        try {
          // Fetch WASM module
          const response = yield* Effect.tryPromise({
            try: () => fetch(config.url),
            catch: () =>
              new WasmError({
                message: `Failed to fetch WASM module from ${config.url}`,
                module: config.type,
              }),
          })

          const arrayBuffer = yield* Effect.tryPromise({
            try: () => response.arrayBuffer(),
            catch: () =>
              new WasmError({
                message: 'Failed to read WASM module',
                module: config.type,
              }),
          })

          // Create memory
          const memory = new WebAssembly.Memory({
            initial: config.memory.initial,
            maximum: config.memory.maximum,
          })

          // Compile module
          const compiledModule = config.streaming
            ? yield* Effect.tryPromise({
                try: () => WebAssembly.compileStreaming(response),
                catch: () =>
                  new WasmCompilationError({
                    message: 'Failed to compile WASM module',
                    module: config.type,
                  }),
              })
            : yield* Effect.tryPromise({
                try: () => WebAssembly.compile(arrayBuffer),
                catch: () =>
                  new WasmCompilationError({
                    message: 'Failed to compile WASM module',
                    module: config.type,
                  }),
              })

          // Instantiate module
          const imports = {
            env: {
              memory,
              ...config.imports,
            },
          }

          const instance = yield* Effect.tryPromise({
            try: () => WebAssembly.instantiate(compiledModule, imports),
            catch: () =>
              new WasmError({
                message: 'Failed to instantiate WASM module',
                module: config.type,
              }),
          })

          // Store module
          const loadedModule: LoadedWasmModule = {
            instance,
            module: compiledModule,
            memory,
            exports: instance.exports as Record<string, Function>,
            stats: {
              executionCount: 0,
              totalExecutionTime: 0,
              lastExecuted: 0,
            },
          }

          yield* Ref.update(modules, (map) => HashMap.set(map, config.type, loadedModule))

          // Update metrics
          yield* Metric.increment(wasmMetrics.modulesLoaded)
        } catch (error) {
          return yield* Effect.fail(
            new WasmError({
              message: `Failed to load WASM module: ${error}`,
              module: config.type,
            }),
          )
        }
      })

    const execute = <T>(moduleType: WasmModuleType, functionName: string, args: unknown[]) =>
      Effect.gen(function* () {
        const moduleMap = yield* Ref.get(modules)
        const module = HashMap.get(moduleMap, moduleType)

        if (Option.isNone(module)) {
          return yield* Effect.fail(
            new WasmError({
              message: `Module ${moduleType} not loaded`,
              module: moduleType,
            }),
          )
        }

        const wasmModule = module.value
        const fn = wasmModule.exports[functionName]

        if (!fn) {
          return yield* Effect.fail(
            new WasmError({
              message: `Function ${functionName} not found in module ${moduleType}`,
              module: moduleType,
            }),
          )
        }

        const startTime = performance.now()

        try {
          const result = fn(...args) as T

          const executionTime = performance.now() - startTime

          // Update stats
          wasmModule.stats.executionCount++
          wasmModule.stats.totalExecutionTime += executionTime
          wasmModule.stats.lastExecuted = Date.now()

          // Update metrics
          yield* Metric.update(wasmMetrics.executionTime.tagged('module', moduleType), executionTime)
          yield* Metric.increment(wasmMetrics.executionCount.tagged('module', moduleType))

          return result
        } catch (error) {
          return yield* Effect.fail(
            new WasmError({
              message: `WASM execution failed: ${error}`,
              module: moduleType,
            }),
          )
        }
      })

    const executeAsync = <T>(task: WasmComputeTask) =>
      Effect.gen(function* () {
        const deferred = yield* Effect.Deferred.make<T, WasmError>()
        yield* Queue.offer(taskQueue, { task, deferred })
        return yield* Effect.Deferred.await(deferred)
      })

    const stream = <T, R>(moduleType: WasmModuleType, functionName: string, input: Stream.Stream<T>) =>
      input.pipe(Stream.mapEffect((item: T) => execute<R>(moduleType, functionName, [item])))

    const batch = <T, R>(moduleType: WasmModuleType, functionName: string, items: ReadonlyArray<T>) =>
      Effect.gen(function* () {
        // Process in chunks for better performance
        const chunkSize = 100
        const chunks = Chunk.fromIterable(items).pipe(Chunk.chunksOf(chunkSize))

        const results = yield* Effect.forEach(chunks, (chunk) => Effect.forEach(Chunk.toReadonlyArray(chunk), (item) => execute<R>(moduleType, functionName, [item])), {
          concurrency: 4,
        })

        return results.flat()
      })

    const getStats = (moduleType?: WasmModuleType) =>
      Effect.gen(function* () {
        const moduleMap = yield* Ref.get(modules)
        const stats: WasmModuleStats[] = []

        const entries = moduleType
          ? Option.match(HashMap.get(moduleMap, moduleType), {
              onNone: () => [],
              onSome: (m) => [[moduleType, m] as const],
            })
          : Array.from(HashMap.entries(moduleMap))

        for (const [type, module] of entries) {
          stats.push({
            name: type,
            executionCount: module.stats.executionCount,
            totalExecutionTime: module.stats.totalExecutionTime,
            averageExecutionTime: module.stats.executionCount > 0 ? module.stats.totalExecutionTime / module.stats.executionCount : 0,
            memoryUsage: module.memory.buffer.byteLength,
            lastExecuted: module.stats.lastExecuted,
          })
        }

        return stats
      })

    const unloadModule = (moduleType: WasmModuleType) =>
      Effect.gen(function* () {
        yield* Ref.update(modules, (map) => HashMap.remove(map, moduleType))
        yield* Metric.increment(wasmMetrics.modulesUnloaded)
      })

    const precompile = (configs: ReadonlyArray<WasmModuleConfig>) =>
      Effect.gen(function* () {
        yield* Effect.forEach(configs, (config) => loadModule(config), { concurrency: 4 })
      })

    return {
      loadModule,
      execute,
      executeAsync,
      stream,
      batch,
      getStats,
      unloadModule,
      precompile,
    }
  }),
)

// ============================================================================
// WASM Metrics
// ============================================================================

const wasmMetrics = {
  modulesLoaded: Metric.counter('wasm_modules_loaded', {
    description: 'Number of WASM modules loaded',
  }),

  modulesUnloaded: Metric.counter('wasm_modules_unloaded', {
    description: 'Number of WASM modules unloaded',
  }),

  executionCount: Metric.counter('wasm_execution_count', {
    description: 'Number of WASM function executions',
  }),

  executionTime: Metric.histogram('wasm_execution_time', {
    description: 'WASM function execution time in milliseconds',
    boundaries: Chunk.fromIterable([0.1, 0.5, 1, 5, 10, 25, 50, 100]),
  }),

  memoryUsage: Metric.gauge('wasm_memory_usage_bytes', {
    description: 'WASM memory usage in bytes',
  }),
}

// ============================================================================
// Specialized WASM Modules
// ============================================================================

export const PhysicsWasmModule: WasmModuleConfig = {
  name: 'physics',
  type: 'physics',
  url: '/wasm/physics.wasm',
  memory: {
    initial: 256, // 16MB
    maximum: 4096, // 256MB
  },
  exports: ['simulate', 'detectCollisions', 'applyForces'],
  streaming: true,
}

export const TerrainWasmModule: WasmModuleConfig = {
  name: 'terrain',
  type: 'terrain',
  url: '/wasm/terrain.wasm',
  memory: {
    initial: 512, // 32MB
    maximum: 8192, // 512MB
  },
  exports: ['generateChunk', 'generateNoise', 'erosion'],
  streaming: true,
}

export const NoiseWasmModule: WasmModuleConfig = {
  name: 'noise',
  type: 'noise',
  url: '/wasm/noise.wasm',
  memory: {
    initial: 64, // 4MB
    maximum: 256, // 16MB
  },
  exports: ['perlin2d', 'perlin3d', 'simplex2d', 'simplex3d'],
  streaming: true,
}

// ============================================================================
// Helper Functions
// ============================================================================

export const offloadToWasm =
  <T, R>(moduleType: WasmModuleType, functionName: string, prepareArgs?: (input: T) => unknown[]) =>
  (input: T) =>
    Effect.gen(function* () {
      const wasm = yield* WasmService
      const args = prepareArgs ? prepareArgs(input) : [input]
      return yield* wasm.execute<R>(moduleType, functionName, args)
    })

export const createWasmWorker = (moduleType: WasmModuleType) =>
  Effect.gen(function* () {
    const wasm = yield* WasmService

    return {
      execute: <T>(functionName: string, args: unknown[]) => wasm.execute<T>(moduleType, functionName, args),

      batch: <T, R>(functionName: string, items: ReadonlyArray<T>) => wasm.batch<T, R>(moduleType, functionName, items),

      stream: <T, R>(functionName: string, input: Stream.Stream<T>) => wasm.stream<T, R>(moduleType, functionName, input),
    }
  })

// ============================================================================
// WASM Optimization Utilities
// ============================================================================

export const simdAccelerated =
  <T extends Float32Array | Float64Array>(operation: (data: T) => T) =>
  (data: T) =>
    Effect.gen(function* () {
      const wasm = yield* WasmService

      // Check if SIMD is available
      const simdAvailable = typeof WebAssembly !== 'undefined' && 'simd' in WebAssembly

      if (simdAvailable) {
        // Use WASM SIMD operations
        return yield* wasm.execute<T>('math', 'simd_process', [data])
      } else {
        // Fallback to JavaScript
        return operation(data)
      }
    })
