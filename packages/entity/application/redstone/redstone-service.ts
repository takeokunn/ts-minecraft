import { Array as Arr, Effect, HashMap, HashSet, Option, Order, Ref } from 'effect'
import type { Position } from '@ts-minecraft/core'
import {
  RedstoneComponentType,
  type RedstoneComponent,
  type RedstoneTickSnapshot,
} from '../../domain/redstone/redstone-model'
import { type PositionKey, positionKey, toBlockPosition } from '../../domain/redstone/redstone-position-utils'
import {
  normalizeComponentPosition,
  makeDefaultState,
  propagatePower,
  updatePistons,
  decayButtonTimers,
  sortedPowerSnapshot,
} from '../../domain/redstone/redstone-simulation'
import { DEFAULT_BUTTON_TICKS, MAX_BUTTON_TICKS } from '../../domain/redstone/redstone.config'

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

export class RedstoneService extends Effect.Service<RedstoneService>()(
  '@minecraft/redstone/RedstoneService',
  {
    effect: Effect.all([
      Ref.make<RedstoneState>(INITIAL_STATE),
      Ref.make(false),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([stateRef, dirtyRef]) => ({
        setComponent: (
          position: Position,
          type: RedstoneComponentType,
        ): Effect.Effect<RedstoneComponent, never> =>
          Ref.modify(stateRef, (state): [RedstoneComponent, RedstoneState] => {
            const normalized = toBlockPosition(position)
            const key = positionKey(normalized)
            const componentState = Option.match(
              Option.filter(HashMap.get(state.components, key), (c) => c.type === type),
              {
                onNone: () => makeDefaultState(type),
                onSome: (c) => c.state,
              },
            )
            const component: RedstoneComponent = normalizeComponentPosition({
              type,
              position: normalized,
              state: componentState,
            })
            const components = HashMap.set(state.components, key, component)
            const pistonKeys = type === RedstoneComponentType.Piston
              ? HashSet.add(state.pistonKeys, key)
              : state.pistonKeys
            const buttonKeys = type === RedstoneComponentType.Button
              ? HashSet.add(state.buttonKeys, key)
              : state.buttonKeys
            return [component, { ...state, components, pistonKeys, buttonKeys }]
          }).pipe(Effect.tap(() => Ref.set(dirtyRef, true))),

        removeComponent: (position: Position): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => {
            const key = positionKey(position)
            return {
              ...state,
              components: HashMap.remove(state.components, key),
              powerByPosition: HashMap.remove(state.powerByPosition, key),
              pistonKeys: HashSet.remove(state.pistonKeys, key),
              buttonKeys: HashSet.remove(state.buttonKeys, key),
            }
          }).pipe(Effect.tap(() => Ref.set(dirtyRef, true))),

        getComponent: (position: Position): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => HashMap.get(state.components, positionKey(position))),
          ),

        getComponents: (): Effect.Effect<ReadonlyArray<RedstoneComponent>, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => {
              const components: Array<RedstoneComponent> = Arr.fromIterable(HashMap.values(state.components))
              return Arr.sort(components, Order.mapInput(Order.number, (a: RedstoneComponent) => positionKey(a.position)))
            }),
          ),

        toggleLever: (position: Position): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Ref.modify(stateRef, (state): [Option.Option<RedstoneComponent>, RedstoneState] => {
            const key = positionKey(position)
            return Option.match(
              Option.filter(HashMap.get(state.components, key), (c) => c.type === RedstoneComponentType.Lever),
              {
                onNone: () => [Option.none(), state],
                onSome: (current) => {
                  const updated: RedstoneComponent = {
                    ...current,
                    state: { ...current.state, active: !current.state.active },
                  }
                  return [Option.some(updated), { ...state, components: HashMap.set(state.components, key, updated) }]
                },
              },
            )
          }).pipe(Effect.tap(() => Ref.set(dirtyRef, true))),

        pressButton: (
          position: Position,
          durationTicks = DEFAULT_BUTTON_TICKS,
        ): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Ref.modify(stateRef, (state): [Option.Option<RedstoneComponent>, RedstoneState] => {
            const key = positionKey(position)
            return Option.match(
              Option.filter(HashMap.get(state.components, key), (c) => c.type === RedstoneComponentType.Button),
              {
                onNone: () => [Option.none(), state],
                onSome: (current) => {
                  const normalizedDuration = Math.min(Math.max(1, Math.floor(durationTicks)), MAX_BUTTON_TICKS)
                  const updated: RedstoneComponent = {
                    ...current,
                    state: {
                      ...current.state,
                      active: true,
                      buttonTicksRemaining: normalizedDuration,
                    },
                  }
                  return [Option.some(updated), { ...state, components: HashMap.set(state.components, key, updated) }]
                },
              },
            )
          }).pipe(Effect.tap(() => Ref.set(dirtyRef, true))),

        toggleTorch: (position: Position): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Ref.modify(stateRef, (state): [Option.Option<RedstoneComponent>, RedstoneState] => {
            const key = positionKey(position)
            return Option.match(
              Option.filter(HashMap.get(state.components, key), (c) => c.type === RedstoneComponentType.Torch),
              {
                onNone: () => [Option.none(), state],
                onSome: (current) => {
                  const updated: RedstoneComponent = {
                    ...current,
                    state: { ...current.state, active: !current.state.active },
                  }
                  return [Option.some(updated), { ...state, components: HashMap.set(state.components, key, updated) }]
                },
              },
            )
          }).pipe(Effect.tap(() => Ref.set(dirtyRef, true))),

        getPowerAt: (position: Position): Effect.Effect<number, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => Option.getOrElse(HashMap.get(state.powerByPosition, positionKey(position)), () => 0)),
          ),

        getPowerSnapshot: (): Effect.Effect<RedstoneTickSnapshot, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => ({
              tick: state.tick,
              poweredPositions: sortedPowerSnapshot(state.powerByPosition),
            })),
          ),

        tick: (): Effect.Effect<RedstoneTickSnapshot, never> =>
          Effect.gen(function* () {
            const dirty = yield* Ref.getAndSet(dirtyRef, false)

            return yield* Ref.modify(stateRef, (state): [RedstoneTickSnapshot, RedstoneState] => {
              // Buttons tick autonomously — always run decay.
              // Propagation is needed if:
              // 1. An external event set dirty (lever toggle, button press, component add/remove)
              // 2. Any button is currently active (ticks > 0): propagation uses pre-decay state,
              //    and the following tick must re-propagate because decay changes power sources.
              // 3. Any button was a power source last tick but is now inactive (ticks just hit 0):
              //    detected by checking if any Button component is powered but no longer active.
              const buttonKeysArr = Arr.fromIterable(state.buttonKeys)
              const anyButtonActive = Arr.some(
                buttonKeysArr,
                (key) => Option.match(HashMap.get(state.components, key), {
                  onNone: () => false,
                  onSome: (c) => c.state.buttonTicksRemaining > 0,
                })
              )
              const anyButtonJustExpired = Arr.some(
                buttonKeysArr,
                (key) => Option.match(HashMap.get(state.components, key), {
                  onNone: () => false,
                  onSome: (c) =>
                    c.state.buttonTicksRemaining === 0 &&
                    HashMap.has(state.powerByPosition, key),
                })
              )
              const needsPropagation = dirty || anyButtonActive || anyButtonJustExpired

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
                  : Option.match(state.cachedSnapshot, {
                      onNone: () => Option.some(sortedPowerSnapshot(powered)),
                      onSome: () => state.cachedSnapshot,
                    })

              const nextState: RedstoneState = {
                tick: state.tick + 1,
                components: nextComponents,
                powerByPosition: powered,
                pistonKeys: state.pistonKeys,
                buttonKeys: state.buttonKeys,
                cachedSnapshot,
              }

              const snapshot: RedstoneTickSnapshot = {
                tick: nextState.tick,
                poweredPositions: Option.getOrThrow(cachedSnapshot),
              }

              return [snapshot, nextState]
            })
          }),
    })))
  },
) {}

export const RedstoneServiceLive = RedstoneService.Default
