import { Effect, Option, ReadonlyArray, Schedule } from 'effect'
import { pipe } from 'effect/Function'

/**
 * 数値範囲を昇順に生成
 */
export const range = (start: number, end: number): ReadonlyArray<number> => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return ReadonlyArray.empty<number>()
  }

  const adjustedStart = Math.trunc(start)
  const adjustedEnd = Math.trunc(end)

  if (adjustedStart > adjustedEnd) {
    return ReadonlyArray.empty<number>()
  }

  const length = adjustedEnd - adjustedStart + 1

  return ReadonlyArray.makeBy(length, (index) => adjustedStart + index)
}

/**
 * 数値範囲を降順に生成
 */
export const rangeReverse = (start: number, end: number): ReadonlyArray<number> => {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return ReadonlyArray.empty<number>()
  }

  const adjustedStart = Math.trunc(start)
  const adjustedEnd = Math.trunc(end)

  if (adjustedStart < adjustedEnd) {
    return ReadonlyArray.empty<number>()
  }

  const length = adjustedStart - adjustedEnd + 1

  return ReadonlyArray.makeBy(length, (index) => adjustedStart - index)
}

/**
 * Effect を指定回数実行
 */
export const repeatEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  iterations: number,
  schedule: Schedule.Schedule<void, void> = Schedule.recurs(iterations - 1)
): Effect.Effect<ReadonlyArray<A>, E, R> => Effect.repeat(effect, { schedule })

/**
 * 逐次走査
 */
export const forEachSequential = <A, R, E, B>(
  items: Iterable<A>,
  f: (value: A, index: number) => Effect.Effect<B, E, R>
): Effect.Effect<ReadonlyArray<B>, E, R> => Effect.forEach(items, f, { concurrency: 1 })

/**
 * 並列走査
 */
export const forEachParallel = <A, R, E, B>(
  items: Iterable<A>,
  f: (value: A, index: number) => Effect.Effect<B, E, R>,
  concurrency = Number.POSITIVE_INFINITY
): Effect.Effect<ReadonlyArray<B>, E, R> => Effect.forEach(items, f, { concurrency })

/**
 * 条件を検証し、失敗時に指定 Effect
 */
export const ensure = <E, R>(
  predicate: boolean,
  onFalse: () => Effect.Effect<never, E, R>
): Effect.Effect<void, E, R> => (predicate ? Effect.succeed(undefined) : onFalse())

/**
 * Option を Effect に昇格
 */
export const ensureOption = <A, E, R>(
  option: Option.Option<A>,
  onNone: () => Effect.Effect<never, E, R>
): Effect.Effect<A, E, R> =>
  pipe(
    option,
    Option.match({
      onNone: () => onNone(),
      onSome: (value) => Effect.succeed(value),
    })
  )
