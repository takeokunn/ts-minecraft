import { Stream, Effect, Chunk, pipe, Option } from 'effect'

/**
 * Stream API migration helpers for common for loop patterns
 * These utilities help convert traditional for loops to Effect-TS Stream API
 */

/**
 * Pattern A: Simple array iteration
 * Converts: for (const item of items) { process(item) }
 * To: Stream-based iteration with effects
 */
export const streamForEach = <A, E, R>(
  items: ReadonlyArray<A>,
  process: (item: A) => Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => pipe(Stream.fromIterable(items), Stream.runForEach(process))

/**
 * Pattern B: Indexed for loop
 * Converts: for (let i = 0; i < n; i++) { process(i) }
 * To: Stream.range with processing
 */
export const streamRange = <E, R>(
  start: number,
  end: number,
  process: (index: number) => Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => pipe(Stream.range(start, end - 1), Stream.runForEach(process))

/**
 * Pattern C: Nested loops (2D)
 * Converts nested for loops for 2D iteration
 */
export const stream2D = <E, R>(
  xRange: { start: number; end: number },
  yRange: { start: number; end: number },
  process: (x: number, y: number) => Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> =>
  pipe(
    Stream.range(xRange.start, xRange.end - 1),
    Stream.flatMap((x) => Stream.range(yRange.start, yRange.end - 1).pipe(Stream.map((y) => ({ x, y })))),
    Stream.runForEach(({ x, y }) => process(x, y))
  )

/**
 * Pattern D: Triple nested loops (3D) with chunking
 * Converts: for(x) for(y) for(z) { process(x,y,z) }
 * To: Stream with chunking for performance
 *
 * NOTE: Temporarily disabled due to complex typing issues
 */
/*
export const stream3D = <E, R>(
  xRange: { start: number; end: number },
  yRange: { start: number; end: number },
  zRange: { start: number; end: number },
  process: (coords: { x: number; y: number; z: number }) => Effect.Effect<void, E, R>,
  chunkSize: number = 1000
): Effect.Effect<void, E, R> =>
  pipe(
    Stream.range(xRange.start, xRange.end - 1),
    Stream.flatMap((x) =>
      pipe(
        Stream.range(yRange.start, yRange.end - 1),
        Stream.flatMap((y) =>
          pipe(
            Stream.range(zRange.start, zRange.end - 1),
            Stream.map((z) => ({ x, y, z }))
          )
        )
      )
    ),
    Stream.chunks(chunkSize),
    Stream.mapEffect((chunk) =>
      Effect.forEach(Array.from(chunk), process, { concurrency: 'unbounded' })
    ),
    Stream.runDrain
  )
*/

/**
 * Pattern E: Triple nested loops with concurrent processing
 * For CPU-intensive operations that can be parallelized
 *
 * NOTE: Temporarily disabled due to complex typing issues
 */
/*
export const stream3DConcurrent = <E, R>(
  xRange: { start: number; end: number },
  yRange: { start: number; end: number },
  zRange: { start: number; end: number },
  process: (coords: { x: number; y: number; z: number }) => Effect.Effect<void, E, R>,
  options: {
    chunkSize?: number
    concurrency?: number
  } = {}
): Effect.Effect<void, E, R> => {
  const { chunkSize = 1000, concurrency = 4 } = options

  return pipe(
    Stream.range(xRange.start, xRange.end - 1),
    Stream.flatMap((x) =>
      pipe(
        Stream.range(yRange.start, yRange.end - 1),
        Stream.flatMap((y) =>
          pipe(
            Stream.range(zRange.start, zRange.end - 1),
            Stream.map((z) => ({ x, y, z }))
          )
        )
      )
    ),
    Stream.chunks(chunkSize),
    Stream.mapEffect((chunk) =>
      Effect.forEach(Array.from(chunk), process, { concurrency })
    ),
    Stream.runDrain
  )
}
*/

/**
 * Pattern F: Array mapping with index
 * Converts: for (let i = 0; i < arr.length; i++) { result[i] = process(arr[i]) }
 */
export const streamMapWithIndex = <A, B, E, R>(
  items: ReadonlyArray<A>,
  process: (item: A, index: number) => Effect.Effect<B, E, R>
): Effect.Effect<ReadonlyArray<B>, E, R> =>
  pipe(
    Stream.fromIterable(items),
    Stream.zipWithIndex,
    Stream.mapEffect(([item, index]) => process(item, index)),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/**
 * Pattern G: Filter and process
 * Converts: for (const item of items) { if (condition(item)) process(item) }
 */
export const streamFilterProcess = <A, E, R>(
  items: ReadonlyArray<A>,
  condition: (item: A) => boolean,
  process: (item: A) => Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> => pipe(Stream.fromIterable(items), Stream.filter(condition), Stream.runForEach(process))

/**
 * Pattern H: Accumulation
 * Converts: let sum = 0; for (const item of items) { sum += item }
 */
export const streamAccumulate = <A, B, E, R>(
  items: ReadonlyArray<A>,
  initial: B,
  accumulate: (acc: B, item: A) => Effect.Effect<B, E, R>
): Effect.Effect<B, E, R> => Effect.reduce(items, initial, accumulate)

/**
 * Pattern I: Early termination
 * Converts: for (const item of items) { if (condition) break; process(item) }
 */
export const streamTakeWhile = <A, E, R>(
  items: ReadonlyArray<A>,
  condition: (item: A) => boolean,
  process: (item: A) => Effect.Effect<void, E, R>
): Effect.Effect<void, E, R> =>
  pipe(Stream.fromIterable(items), Stream.takeWhile(condition), Stream.runForEach(process))

/**
 * Pattern J: Collecting results with optional values
 * Converts loops that may or may not produce values
 */
export const streamCollectOptional = <A, B, E, R>(
  items: ReadonlyArray<A>,
  process: (item: A) => Effect.Effect<Option.Option<B>, E, R>
): Effect.Effect<ReadonlyArray<B>, E, R> =>
  pipe(
    Stream.fromIterable(items),
    Stream.mapEffect(process),
    Stream.filter(Option.isSome),
    Stream.map(Option.getOrThrow),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/**
 * Benchmark utility to compare for loop vs Stream performance
 */
export const benchmarkStream = <E, R>(
  name: string,
  effect: Effect.Effect<void, E, R>
): Effect.Effect<{ name: string; duration: number }, E, R> =>
  pipe(
    Effect.sync(() => performance.now()),
    Effect.flatMap((start) =>
      effect.pipe(
        Effect.map(() => ({
          name,
          duration: performance.now() - start,
        }))
      )
    )
  )
