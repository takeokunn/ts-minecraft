import { Clock, Effect, Match, pipe, Array as ReadonlyArray, Schema } from 'effect'
import {
  ChunkCommand,
  ChunkEvent,
  ChunkRequest,
  ChunkSystemConfig,
  ChunkSystemConfigSchema,
  ChunkSystemError,
  ChunkSystemState,
  ChunkSystemStateSchema,
  EpochMillisecondsSchema,
  PerformanceSnapshotSchema,
  TickSchema,
} from './index'

export interface TransitionResult {
  readonly state: ChunkSystemState
  readonly events: ReadonlyArray<ChunkEvent>
}

const noEvents: ReadonlyArray<ChunkEvent> = []

const decodeWith =
  <A>(schema: Schema.Schema<A>) =>
  (input: unknown) =>
    pipe(
      Schema.decodeUnknown(schema)(input),
      Effect.mapError((issue) =>
        ChunkSystemError.ValidationError({
          message: issue.message,
        })
      )
    )

const decodeEpoch = decodeWith(EpochMillisecondsSchema)

const decodeTick = decodeWith(TickSchema)

const decodeState = decodeWith(ChunkSystemStateSchema)

const decodePerformance = decodeWith(PerformanceSnapshotSchema)

const ensureCapacity = (state: ChunkSystemState, request: ChunkRequest) =>
  Effect.filterOrFail(
    Effect.succeed(state.active.length),
    (count) => count < state.budget.maxConcurrent,
    () => ChunkSystemError.ResourceBudgetExceeded({ request, budget: state.budget })
  )

const extractRequest = (collection: ReadonlyArray<ChunkRequest>, id: ChunkRequest['id']) =>
  pipe(
    collection,
    ReadonlyArray.findFirst((candidate) => candidate.id === id),
    Effect.fromOption(() => ChunkSystemError.RequestNotFound({ id })),
    Effect.map((request) => ({
      request,
      rest: ReadonlyArray.filter(collection, (candidate) => candidate.id !== id),
    }))
  )

const locateRequest = (state: ChunkSystemState, id: ChunkRequest['id']) =>
  Effect.gen(function* () {
    const attempt = yield* extractRequest(state.active, id).pipe(Effect.either)
    return yield* Match.value(attempt).pipe(
      Match.when({ _tag: 'Right' }, ({ right }) =>
        Effect.succeed({
          request: right.request,
          restActive: right.rest,
          restDelayed: state.delayed,
          source: 'active' as const,
        })
      ),
      Match.when({ _tag: 'Left' }, () =>
        extractRequest(state.delayed, id).pipe(
          Effect.map((result) => ({
            request: result.request,
            restActive: state.active,
            restDelayed: result.rest,
            source: 'delayed' as const,
          }))
        )
      ),
      Match.exhaustive
    )
  })

const successRatioFor = (activeCount: number, total: number) =>
  Match.value(total).pipe(
    Match.when(0, () => Effect.succeed(1)),
    Match.orElse(() => Effect.succeed(Math.min(Math.max(activeCount / total, 0), 1)))
  )

const updatePerformance = (state: ChunkSystemState, deltaActive: number) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const capturedAt = yield* decodeEpoch(now)
    const activeCount = state.active.length + deltaActive
    const total = activeCount + state.delayed.length
    const successRatio = yield* successRatioFor(activeCount, total)
    const operationsPerSecond = Math.max(activeCount, 0) / (state.performance.window.windowMs / 1_000)
    const rollingAverage = Math.max(state.performance.window.rollingAverage * 0.8 + activeCount * 0.2, 0)
    const percentile95 = Math.max(state.performance.window.percentile95 * 0.9 + activeCount * 0.1, 0)
    return yield* decodePerformance({
      capturedAt,
      window: {
        windowMs: state.performance.window.windowMs,
        rollingAverage,
        percentile95,
      },
      throughput: {
        operationsPerSecond,
        successRatio,
      },
    })
  })

const nextTick = (tick: ChunkSystemState['tick']) => decodeTick(tick + 1)

const enqueueRequest = (state: ChunkSystemState, request: ChunkRequest, expired: boolean) =>
  Match.value(expired).pipe(
    Match.when(true, () => ({
      active: state.active,
      delayed: ReadonlyArray.append(state.delayed, request),
      delta: 0,
    })),
    Match.when(false, () => ({
      active: ReadonlyArray.append(state.active, request),
      delayed: state.delayed,
      delta: 1,
    })),
    Match.exhaustive
  )

const schedule = (state: ChunkSystemState, request: ChunkRequest) =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const captured = yield* decodeEpoch(now)
    const expired = request.deadline < captured
    yield* Match.value(expired).pipe(
      Match.when(false, () => ensureCapacity(state, request)),
      Match.when(true, () => Effect.void),
      Match.exhaustive
    )
    const placement = enqueueRequest(state, request, expired)
    const performance = yield* updatePerformance(state, placement.delta)
    const tick = yield* nextTick(state.tick)
    return {
      state: yield* decodeState({
        active: placement.active,
        delayed: placement.delayed,
        budget: state.budget,
        strategy: state.strategy,
        performance,
        tick,
      }),
      events: [ChunkEvent.RequestQueued({ request })],
    }
  })

const applyLocated = <A>(
  located: {
    readonly source: 'active' | 'delayed'
    readonly restActive: ReadonlyArray<ChunkRequest>
    readonly restDelayed: ReadonlyArray<ChunkRequest>
  },
  onActive: () => A,
  onDelayed: () => A
) =>
  Match.value(located.source).pipe(Match.when('active', onActive), Match.when('delayed', onDelayed), Match.exhaustive)

const complete = (state: ChunkSystemState, command: Extract<ChunkCommand, { readonly _tag: 'Complete' }>) =>
  Effect.gen(function* () {
    const located = yield* locateRequest(state, command.requestId)
    const performance = yield* updatePerformance(
      state,
      applyLocated(
        located,
        () => -1,
        () => 0
      )
    )
    const tick = yield* nextTick(state.tick)
    return {
      state: yield* decodeState({
        active: applyLocated(
          located,
          () => located.restActive,
          () => state.active
        ),
        delayed: applyLocated(
          located,
          () => state.delayed,
          () => located.restDelayed
        ),
        budget: state.budget,
        strategy: state.strategy,
        performance,
        tick,
      }),
      events: [
        ChunkEvent.RequestCompleted({
          requestId: command.requestId,
          completedAt: command.completedAt,
        }),
      ],
    }
  })

const fail = (state: ChunkSystemState, command: Extract<ChunkCommand, { readonly _tag: 'Fail' }>) =>
  Effect.gen(function* () {
    const located = yield* locateRequest(state, command.requestId)
    const performance = yield* updatePerformance(
      state,
      applyLocated(
        located,
        () => -1,
        () => 0
      )
    )
    const tick = yield* nextTick(state.tick)
    return {
      state: yield* decodeState({
        active: applyLocated(
          located,
          () => located.restActive,
          () => state.active
        ),
        delayed: applyLocated(
          located,
          () => state.delayed,
          () => located.restDelayed
        ),
        budget: state.budget,
        strategy: state.strategy,
        performance,
        tick,
      }),
      events: [
        ChunkEvent.RequestFailed({
          requestId: command.requestId,
          occurredAt: command.occurredAt,
          reason: command.reason,
        }),
      ],
    }
  })

const reprioritize = (state: ChunkSystemState, command: Extract<ChunkCommand, { readonly _tag: 'Reprioritize' }>) =>
  Effect.gen(function* () {
    const located = yield* locateRequest(state, command.requestId)
    const updatedRequest = {
      ...located.request,
      priority: command.newPriority,
    }
    const active = applyLocated(
      located,
      () => ReadonlyArray.append(located.restActive, updatedRequest),
      () => state.active
    )
    const delayed = applyLocated(
      located,
      () => state.delayed,
      () => ReadonlyArray.append(located.restDelayed, updatedRequest)
    )
    const performance = yield* updatePerformance(state, 0)
    const tick = yield* nextTick(state.tick)
    return {
      state: yield* decodeState({
        active,
        delayed,
        budget: state.budget,
        strategy: state.strategy,
        performance,
        tick,
      }),
      events: [ChunkEvent.RequestQueued({ request: updatedRequest })],
    }
  })

const switchStrategy = (state: ChunkSystemState, command: Extract<ChunkCommand, { readonly _tag: 'SwitchStrategy' }>) =>
  Effect.gen(function* () {
    const changed = state.strategy !== command.strategy
    const performance = yield* updatePerformance(state, 0)
    const tick = yield* nextTick(state.tick)
    const events = yield* Match.value(changed).pipe(
      Match.when(true, () =>
        Effect.succeed<ReadonlyArray<ChunkEvent>>([
          ChunkEvent.StrategyShifted({
            strategy: command.strategy,
            decidedAt: command.decidedAt,
          }),
        ])
      ),
      Match.when(false, () => Effect.succeed(noEvents)),
      Match.exhaustive
    )
    return {
      state: yield* decodeState({
        active: state.active,
        delayed: state.delayed,
        budget: state.budget,
        strategy: command.strategy,
        performance,
        tick,
      }),
      events,
    }
  })

export const applyCommand = (
  state: ChunkSystemState,
  command: ChunkCommand
): Effect.Effect<TransitionResult, ChunkSystemError> =>
  Match.value(command).pipe(
    Match.tag('Schedule', ({ request }) => schedule(state, request)),
    Match.tag('Complete', (payload) => complete(state, payload)),
    Match.tag('Fail', (payload) => fail(state, payload)),
    Match.tag('Reprioritize', (payload) => reprioritize(state, payload)),
    Match.tag('SwitchStrategy', (payload) => switchStrategy(state, payload)),
    Match.exhaustive
  )

export const makeInitialState = (config: ChunkSystemConfig): Effect.Effect<ChunkSystemState, ChunkSystemError> =>
  Effect.gen(function* () {
    const parsedConfig = yield* pipe(
      Schema.decodeUnknown(ChunkSystemConfigSchema)(config),
      Effect.mapError((issue) =>
        ChunkSystemError.ValidationError({
          message: issue.message,
        })
      )
    )
    const now = yield* Clock.currentTimeMillis
    const capturedAt = yield* decodeEpoch(now)
    const tick = yield* decodeTick(0)
    const performance = yield* decodePerformance({
      capturedAt,
      window: parsedConfig.performanceWindow,
      throughput: {
        operationsPerSecond: 0,
        successRatio: 1,
      },
    })
    return yield* decodeState({
      active: [],
      delayed: [],
      budget: parsedConfig.initialBudget,
      strategy: parsedConfig.initialStrategy,
      performance,
      tick,
    })
  })
