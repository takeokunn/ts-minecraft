import { Array as Arr, Brand, Effect, HashMap, MutableHashMap, Option, Order, Ref } from 'effect'
import type { Position } from '@/shared/kernel'
import {
  RedstonePowerLevel,
  RedstoneComponentType,
  type RedstoneComponent,
  type RedstoneTickSnapshot,
} from '@/redstone/redstone-model'

const MAX_REDSTONE_POWER = 15
const DEFAULT_BUTTON_TICKS = 10

// Branded key derived from a block-snapped Position. Only positionKey() may produce one,
// so HashMap<PositionKey, X> cannot be accidentally queried with an arbitrary string.
type PositionKey = string & Brand.Brand<'PositionKey'>

type RedstoneState = {
  readonly tick: number
  readonly components: HashMap.HashMap<PositionKey, RedstoneComponent>
  readonly powerByPosition: HashMap.HashMap<PositionKey, number>
}

const INITIAL_STATE: RedstoneState = {
  tick: 0,
  components: HashMap.empty<PositionKey, RedstoneComponent>(),
  powerByPosition: HashMap.empty<PositionKey, number>(),
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
  return `${block.x}:${block.y}:${block.z}` as PositionKey
}

const positionFromKey = (key: PositionKey): Position => {
  const parts = Arr.map(key.split(':'), (v) => parseInt(v, 10))
  return {
    x: Option.getOrElse(Arr.get(parts, 0), () => 0),
    y: Option.getOrElse(Arr.get(parts, 1), () => 0),
    z: Option.getOrElse(Arr.get(parts, 2), () => 0),
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

  while (queue.length > 0) {
    const current = queue.shift()!
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

  return HashMap.fromIterable(powered as Iterable<readonly [PositionKey, number]>)
}

const updatePistons = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  powered: HashMap.HashMap<PositionKey, number>,
): HashMap.HashMap<PositionKey, RedstoneComponent> =>
  HashMap.map(components, (component, key) => {
    if (component.type !== RedstoneComponentType.Piston) return component
    const nextExtended = Option.getOrElse(HashMap.get(powered, key), () => 0) > 0
    return { ...component, state: { ...component.state, pistonExtended: nextExtended } }
  })

const decayButtonTimers = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
): HashMap.HashMap<PositionKey, RedstoneComponent> =>
  HashMap.map(components, (component) => {
    if (component.type !== RedstoneComponentType.Button) return component
    const nextTicks = Math.max(0, component.state.buttonTicksRemaining - 1)
    return {
      ...component,
      state: {
        ...component.state,
        buttonTicksRemaining: nextTicks,
        active: nextTicks > 0,
      },
    }
  })

const sortedPowerSnapshot = (powerByPosition: HashMap.HashMap<PositionKey, number>): RedstoneTickSnapshot['poweredPositions'] => {
  const entries: Array<[PositionKey, number]> = Arr.fromIterable(powerByPosition)
  const sorted = Arr.sort(entries, Order.mapInput(Order.string, (e: readonly [PositionKey, number]) => e[0]))
  return Arr.map(sorted, ([key, power]) => ({
    position: positionFromKey(key),
    power: RedstonePowerLevel.make(power),
  }))
}

export class RedstoneService extends Effect.Service<RedstoneService>()(
  '@minecraft/redstone/RedstoneService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<RedstoneState>(INITIAL_STATE)

      return {
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
            return [component, { ...state, components }]
          }),

        removeComponent: (position: Position): Effect.Effect<void, never> =>
          Ref.update(stateRef, (state) => ({
            ...state,
            components: HashMap.remove(state.components, positionKey(position)),
            powerByPosition: HashMap.remove(state.powerByPosition, positionKey(position)),
          })),

        getComponent: (position: Position): Effect.Effect<Option.Option<RedstoneComponent>, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => HashMap.get(state.components, positionKey(position))),
          ),

        getComponents: (): Effect.Effect<ReadonlyArray<RedstoneComponent>, never> =>
          Ref.get(stateRef).pipe(
            Effect.map((state) => {
              const components: Array<RedstoneComponent> = Arr.fromIterable(HashMap.values(state.components))
              return Arr.sort(components, Order.mapInput(Order.string, (a: RedstoneComponent) => positionKey(a.position)))
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
          }),

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
          }),

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
          }),

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
          Ref.modify(stateRef, (state): [RedstoneTickSnapshot, RedstoneState] => {
            const powered = propagatePower(state.components)
            const pistonUpdated = updatePistons(state.components, powered)
            const nextComponents = decayButtonTimers(pistonUpdated)

            const nextState: RedstoneState = {
              tick: state.tick + 1,
              components: nextComponents,
              powerByPosition: powered,
            }

            const snapshot: RedstoneTickSnapshot = {
              tick: nextState.tick,
              poweredPositions: sortedPowerSnapshot(nextState.powerByPosition),
            }

            return [snapshot, nextState]
          }),
      }
    }),
  },
) {}

export const RedstoneServiceLive = RedstoneService.Default
