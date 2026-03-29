import { Array as Arr, Brand, Effect, HashMap, HashSet, MutableHashMap, Option, Order, Ref } from 'effect'
import type { Position } from '@/shared/kernel'
import { CHUNK_HEIGHT } from '@/domain/chunk'
import {
  RedstonePowerLevel,
  RedstoneComponentType,
  type RedstoneComponent,
  type RedstoneTickSnapshot,
} from '@/redstone/redstone-model'

const MAX_REDSTONE_POWER = 15
const DEFAULT_BUTTON_TICKS = 10

// Branded key derived from a block-snapped Position via numeric encoding.
// Only positionKey() may produce one, so HashMap<PositionKey, X> cannot be
// accidentally queried with an arbitrary number.
type PositionKey = number & Brand.Brand<'PositionKey'>
const PositionKey = Brand.nominal<PositionKey>()

const BIAS = 32768
const Y_STRIDE = 65536
const XZ_STRIDE = CHUNK_HEIGHT * Y_STRIDE

type RedstoneState = {
  readonly tick: number
  readonly components: HashMap.HashMap<PositionKey, RedstoneComponent>
  readonly powerByPosition: HashMap.HashMap<PositionKey, number>
  readonly pistonKeys: HashSet.HashSet<PositionKey>
  readonly buttonKeys: HashSet.HashSet<PositionKey>
  readonly cachedSnapshot: RedstoneTickSnapshot['poweredPositions'] | null
}

const INITIAL_STATE: RedstoneState = {
  tick: 0,
  components: HashMap.empty<PositionKey, RedstoneComponent>(),
  powerByPosition: HashMap.empty<PositionKey, number>(),
  pistonKeys: HashSet.empty<PositionKey>(),
  buttonKeys: HashSet.empty<PositionKey>(),
  cachedSnapshot: null,
}

const POSITION_DIRECTIONS: ReadonlyArray<Position> = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
]

const toBlockPosition = (position: Position): Position => ({
  x: Math.floor(position.x),
  y: Math.floor(position.y),
  z: Math.floor(position.z),
})

const positionKey = (position: Position): PositionKey => {
  const block = toBlockPosition(position)
  return PositionKey((block.x + BIAS) * XZ_STRIDE + block.y * Y_STRIDE + (block.z + BIAS))
}

const positionFromKey = (key: PositionKey): Position => {
  const biasedX = Math.floor(key / XZ_STRIDE)
  const remainder = key - biasedX * XZ_STRIDE
  const y = Math.floor(remainder / Y_STRIDE)
  const biasedZ = remainder - y * Y_STRIDE
  return {
    x: biasedX - BIAS,
    y,
    z: biasedZ - BIAS,
  }
}

const normalizeComponentPosition = (component: RedstoneComponent): RedstoneComponent => ({
  ...component,
  position: toBlockPosition(component.position),
})

const makeDefaultState = (type: RedstoneComponentType): RedstoneComponent['state'] => ({
  active: type === RedstoneComponentType.Torch,
  buttonTicksRemaining: 0,
  pistonExtended: false,
})

const canConduct = (type: RedstoneComponentType): boolean =>
  type === RedstoneComponentType.Wire ||
  type === RedstoneComponentType.Lever ||
  type === RedstoneComponentType.Button ||
  type === RedstoneComponentType.Torch ||
  type === RedstoneComponentType.Piston

const isPowerSource = (component: RedstoneComponent): boolean =>
  (component.type === RedstoneComponentType.Lever && component.state.active) ||
  (component.type === RedstoneComponentType.Button && component.state.buttonTicksRemaining > 0) ||
  (component.type === RedstoneComponentType.Torch && component.state.active)

const neighborsOf = (position: Position): ReadonlyArray<Position> =>
  Arr.map(POSITION_DIRECTIONS, (delta) => ({
    x: position.x + delta.x,
    y: position.y + delta.y,
    z: position.z + delta.z,
  }))

const propagatePower = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
): HashMap.HashMap<PositionKey, number> => {
  const powered = MutableHashMap.empty<PositionKey, number>()

  const queue: Array<{ readonly key: PositionKey; readonly power: number }> = []
  HashMap.forEach(components, (component, key) => {
    if (!isPowerSource(component)) return
    queue.push({ key, power: MAX_REDSTONE_POWER })
  })

  let cursor = 0
  while (cursor < queue.length) {
    const current = queue[cursor++]!
    const currentKnown = Option.getOrElse(MutableHashMap.get(powered, current.key), () => 0)
    if (current.power <= currentKnown) continue

    MutableHashMap.set(powered, current.key, current.power)

    if (current.power <= 1) continue

    const position = positionFromKey(current.key)
    Arr.forEach(neighborsOf(position), (neighbor) => {
      const neighborKey = positionKey(neighbor)
      Option.match(HashMap.get(components, neighborKey), {
        onNone: () => {},
        onSome: (neighborComponent) => {
          if (!canConduct(neighborComponent.type)) return
          queue.push({ key: neighborKey, power: current.power - 1 })
        },
      })
    })
  }

  let snapshot = HashMap.empty<PositionKey, number>()
  MutableHashMap.forEach(powered, (value, key) => {
    snapshot = HashMap.set(snapshot, key, value)
  })

  return snapshot
}

const updatePistons = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  powered: HashMap.HashMap<PositionKey, number>,
  pistonKeys: HashSet.HashSet<PositionKey>,
): HashMap.HashMap<PositionKey, RedstoneComponent> =>
  Arr.reduce(Arr.fromIterable(pistonKeys), components, (acc, key) =>
    Option.match(HashMap.get(components, key), {
      onNone: () => acc,
      onSome: (component) => {
        const nextExtended = Option.getOrElse(HashMap.get(powered, key), () => 0) > 0
        return nextExtended === component.state.pistonExtended
          ? acc
          : HashMap.set(acc, key, { ...component, state: { ...component.state, pistonExtended: nextExtended } })
      },
    })
  )

const decayButtonTimers = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  buttonKeys: HashSet.HashSet<PositionKey>,
): HashMap.HashMap<PositionKey, RedstoneComponent> =>
  Arr.reduce(Arr.fromIterable(buttonKeys), components, (acc, key) =>
    Option.match(HashMap.get(components, key), {
      onNone: () => acc,
      onSome: (component) => {
        const nextTicks = Math.max(0, component.state.buttonTicksRemaining - 1)
        return HashMap.set(acc, key, {
          ...component,
          state: {
            ...component.state,
            buttonTicksRemaining: nextTicks,
            active: nextTicks > 0,
          },
        })
      },
    })
  )

const sortedPowerSnapshot = (powerByPosition: HashMap.HashMap<PositionKey, number>): RedstoneTickSnapshot['poweredPositions'] => {
  const entries: Array<[PositionKey, number]> = Arr.fromIterable(powerByPosition)
  const sorted = Arr.sort(entries, Order.mapInput(Order.number, (e: readonly [PositionKey, number]) => e[0]))
  return Arr.map(sorted, ([key, power]) => ({
    position: positionFromKey(key),
    power: RedstonePowerLevel.make(power),
  }))
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
                  const normalizedDuration = Math.max(1, Math.floor(durationTicks))
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
                    Option.isSome(HashMap.get(state.powerByPosition, key)),
                })
              )
              const needsPropagation = dirty || anyButtonActive || anyButtonJustExpired

              let powered = state.powerByPosition
              let nextComponents: HashMap.HashMap<PositionKey, RedstoneComponent>

              if (needsPropagation) {
                powered = propagatePower(state.components)
                const pistonUpdated = updatePistons(state.components, powered, state.pistonKeys)
                nextComponents = decayButtonTimers(pistonUpdated, state.buttonKeys)
              } else {
                nextComponents = decayButtonTimers(state.components, state.buttonKeys)
              }

              const cachedSnapshot: RedstoneTickSnapshot['poweredPositions'] =
                needsPropagation || state.cachedSnapshot === null
                  ? sortedPowerSnapshot(powered)
                  : state.cachedSnapshot

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
                poweredPositions: cachedSnapshot,
              }

              return [snapshot, nextState]
            })
          }),
    })))
  },
) {}

export const RedstoneServiceLive = RedstoneService.Default
