import { Effect, HashMap, HashSet, Option, Ref } from 'effect'
import type { Position } from '@ts-minecraft/core'
import {
  RedstoneComponentType,
  type RedstoneComponent,
  type RedstoneTickSnapshot,
} from '../../domain/redstone/redstone-model'
import {
  type PositionKey,
  positionKey,
  toBlockPosition,
} from '../../domain/redstone/redstone-position-utils'
import {
  computeNeedsPropagation,
  decayButtonTimers,
  makeDefaultState,
  normalizeComponentPosition,
  propagatePower,
  sortedPowerSnapshot,
  updatePistons,
} from '../../domain/redstone/redstone-simulation'
import {
  DEFAULT_BUTTON_TICKS,
  MAX_BUTTON_TICKS,
} from '../../domain/redstone/redstone.config'

type RedstoneState = {
  readonly tick: number
  readonly components: HashMap.HashMap<PositionKey, RedstoneComponent>
  readonly powerByPosition: HashMap.HashMap<PositionKey, number>
  readonly pistonKeys: HashSet.HashSet<PositionKey>
  readonly buttonKeys: HashSet.HashSet<PositionKey>
  readonly cachedSnapshot: Option.Option<RedstoneTickSnapshot['poweredPositions']>
}

const INITIAL_STATE: RedstoneState = {
  tick: 0,
  components: HashMap.empty<PositionKey, RedstoneComponent>(),
  powerByPosition: HashMap.empty<PositionKey, number>(),
  pistonKeys: HashSet.empty<PositionKey>(),
  buttonKeys: HashSet.empty<PositionKey>(),
  cachedSnapshot: Option.none(),
}


// ─── Pure tick computation ────────────────────────────────────────────────────

const computeNextRedstoneState = (
  state: RedstoneState,
  dirty: boolean,
): [RedstoneTickSnapshot, RedstoneState] => {
  const needsPropagation = computeNeedsPropagation(
    state.components,
    state.powerByPosition,
    state.buttonKeys,
    dirty,
  )

  const [powered, nextComponents] = needsPropagation
    ? (() => {
        const pow = propagatePower(state.components)
        const withPistons = updatePistons(state.components, pow, state.pistonKeys)
        return [pow, decayButtonTimers(withPistons, state.buttonKeys)] as const
      })()
    : [state.powerByPosition, decayButtonTimers(state.components, state.buttonKeys)] as const

  const cachedSnapshot: Option.Option<RedstoneTickSnapshot['poweredPositions']> =
    needsPropagation
      ? Option.some(sortedPowerSnapshot(powered))
      : Option.isSome(state.cachedSnapshot) ? state.cachedSnapshot : Option.some(sortedPowerSnapshot(powered))

  const nextState: RedstoneState = {
    tick: state.tick + 1,
    components: nextComponents,
    powerByPosition: powered,
    pistonKeys: state.pistonKeys,
    buttonKeys: state.buttonKeys,
    cachedSnapshot,
  }

  return [
    { tick: nextState.tick, poweredPositions: Option.getOrElse(cachedSnapshot, () => sortedPowerSnapshot(powered)) },
    nextState,
  ]
}

export class RedstoneService extends Effect.Service<RedstoneService>()(
  '@minecraft/redstone/RedstoneService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<RedstoneState>(INITIAL_STATE)
      const dirtyRef = yield* Ref.make(false)
      return {
        setComponent: (
          position: Position,
          type: RedstoneComponentType,
        ): Effect.Effect<RedstoneComponent, never> =>
          Effect.gen(function* () {
            const component = yield* Ref.modify(stateRef, (state): [RedstoneComponent, RedstoneState] => {
              const normalized = toBlockPosition(position)
              const key = positionKey(normalized)
              const existingValue = Option.getOrNull(HashMap.get(state.components, key))
              const existing = existingValue !== null && existingValue.type === type ? existingValue : null
              const componentState = existing !== null ? existing.state : makeDefaultState(type)
              const comp: RedstoneComponent = normalizeComponentPosition({
                type,
                position: normalized,
                state: componentState,
              })
              const components = HashMap.set(state.components, key, comp)
              const pistonKeys = type === RedstoneComponentType.Piston
                ? HashSet.add(state.pistonKeys, key)
                : state.pistonKeys
              const buttonKeys = type === RedstoneComponentType.Button
                ? HashSet.add(state.buttonKeys, key)
                : state.buttonKeys
              return [comp, { ...state, components, pistonKeys, buttonKeys }]
            })
            yield* Ref.set(dirtyRef, true)
            return component
          }),

        removeComponent: (position: Position): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.update(stateRef, (state) => {
              const key = positionKey(position)
              return {
                ...state,
                components: HashMap.remove(state.components, key),
                powerByPosition: HashMap.remove(state.powerByPosition, key),
                pistonKeys: HashSet.remove(state.pistonKeys, key),
                buttonKeys: HashSet.remove(state.buttonKeys, key),
              }
            })
            yield* Ref.set(dirtyRef, true)
          }),

        getComponent: (position: Position): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return HashMap.get(state.components, positionKey(position))
          }),

        getComponents: (): Effect.Effect<ReadonlyArray<RedstoneComponent>, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            const components: Array<RedstoneComponent> = []
            for (const component of HashMap.values(state.components)) {
              components.push(component)
            }
            components.sort((a, b) => positionKey(a.position) - positionKey(b.position))
            return components
          }),

        toggleLever: (position: Position): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Effect.gen(function* () {
            const result = yield* Ref.modify(stateRef, (state): [Option.Option<RedstoneComponent>, RedstoneState] => {
              const key = positionKey(position)
              const currentValue = Option.getOrNull(HashMap.get(state.components, key))
              const current = currentValue !== null && currentValue.type === RedstoneComponentType.Lever ? currentValue : null
              if (current === null) return [Option.none(), state]
              const updated: RedstoneComponent = { ...current, state: { ...current.state, active: !current.state.active } }
              return [Option.some(updated), { ...state, components: HashMap.set(state.components, key, updated) }]
            })
            yield* Ref.set(dirtyRef, true)
            return result
          }),

        pressButton: (
          position: Position,
          durationTicks = DEFAULT_BUTTON_TICKS,
        ): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Effect.gen(function* () {
            const result = yield* Ref.modify(stateRef, (state): [Option.Option<RedstoneComponent>, RedstoneState] => {
              const key = positionKey(position)
              const currentValue = Option.getOrNull(HashMap.get(state.components, key))
              const current = currentValue !== null && currentValue.type === RedstoneComponentType.Button ? currentValue : null
              if (current === null) return [Option.none(), state]
              const normalizedDuration = Math.min(Math.max(1, Math.floor(durationTicks)), MAX_BUTTON_TICKS)
              const updated: RedstoneComponent = {
                ...current,
                state: { ...current.state, active: true, buttonTicksRemaining: normalizedDuration },
              }
              return [Option.some(updated), { ...state, components: HashMap.set(state.components, key, updated) }]
            })
            yield* Ref.set(dirtyRef, true)
            return result
          }),

        setPressurePlatePressed: (
          position: Position,
          pressed: boolean,
        ): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Effect.gen(function* () {
            const [result, changed] = yield* Ref.modify(
              stateRef,
              (state): [[Option.Option<RedstoneComponent>, boolean], RedstoneState] => {
                const key = positionKey(position)
                const currentValue = Option.getOrNull(HashMap.get(state.components, key))
                const current = currentValue !== null && currentValue.type === RedstoneComponentType.PressurePlate ? currentValue : null
                if (current === null) return [[Option.none(), false], state]
                if (current.state.active === pressed) return [[Option.some(current), false], state]

                const updated: RedstoneComponent = {
                  ...current,
                  state: { ...current.state, active: pressed, buttonTicksRemaining: 0 },
                }
                return [
                  [Option.some(updated), true],
                  { ...state, components: HashMap.set(state.components, key, updated) },
                ]
              },
            )
            if (changed) yield* Ref.set(dirtyRef, true)
            return result
          }),

        toggleTorch: (position: Position): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Effect.gen(function* () {
            const result = yield* Ref.modify(stateRef, (state): [Option.Option<RedstoneComponent>, RedstoneState] => {
              const key = positionKey(position)
              const currentValue = Option.getOrNull(HashMap.get(state.components, key))
              const current = currentValue !== null && currentValue.type === RedstoneComponentType.Torch ? currentValue : null
              if (current === null) return [Option.none(), state]
              const updated: RedstoneComponent = { ...current, state: { ...current.state, active: !current.state.active } }
              return [Option.some(updated), { ...state, components: HashMap.set(state.components, key, updated) }]
            })
            yield* Ref.set(dirtyRef, true)
            return result
          }),

        getPowerAt: (position: Position): Effect.Effect<number, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return Option.getOrElse(HashMap.get(state.powerByPosition, positionKey(position)), () => 0)
          }),

        getPowerSnapshot: (): Effect.Effect<RedstoneTickSnapshot, never> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(stateRef)
            return {
              tick: state.tick,
              poweredPositions: sortedPowerSnapshot(state.powerByPosition),
            }
          }),

        tick: (): Effect.Effect<RedstoneTickSnapshot, never> =>
          Effect.gen(function* () {
            const dirty = yield* Ref.getAndSet(dirtyRef, false)
            return yield* Ref.modify(stateRef, (state) => computeNextRedstoneState(state, dirty))
          }),
      }
    }),
  },
) {}
