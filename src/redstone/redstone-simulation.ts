import { Array as Arr, HashMap, MutableHashMap, Option, Order } from 'effect'
import type { HashSet } from 'effect'
import type { Position } from '@/shared/kernel'
import {
  RedstonePowerLevel,
  RedstoneComponentType,
  type RedstoneComponent,
  type RedstoneTickSnapshot,
} from '@/redstone/redstone-model'
import { type PositionKey, toBlockPosition, positionKey, positionFromKey } from './redstone-position-utils'
import { MAX_REDSTONE_POWER, POSITION_DIRECTIONS } from './redstone.config'

export const normalizeComponentPosition = (component: RedstoneComponent): RedstoneComponent => ({
  ...component,
  position: toBlockPosition(component.position),
})

export const makeDefaultState = (type: RedstoneComponentType): RedstoneComponent['state'] => ({
  active: type === RedstoneComponentType.Torch,
  buttonTicksRemaining: 0,
  pistonExtended: false,
})

export const canConduct = (type: RedstoneComponentType): boolean =>
  type === RedstoneComponentType.Wire ||
  type === RedstoneComponentType.Lever ||
  type === RedstoneComponentType.Button ||
  type === RedstoneComponentType.Torch ||
  type === RedstoneComponentType.Piston

export const isPowerSource = (component: RedstoneComponent): boolean =>
  (component.type === RedstoneComponentType.Lever && component.state.active) ||
  (component.type === RedstoneComponentType.Button && component.state.buttonTicksRemaining > 0) ||
  (component.type === RedstoneComponentType.Torch && component.state.active)

export const neighborsOf = (position: Position): ReadonlyArray<Position> =>
  Arr.map(POSITION_DIRECTIONS, (delta) => ({
    x: position.x + delta.x,
    y: position.y + delta.y,
    z: position.z + delta.z,
  }))

export const propagatePower = (
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

export const updatePistons = (
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

export const decayButtonTimers = (
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

export const sortedPowerSnapshot = (powerByPosition: HashMap.HashMap<PositionKey, number>): RedstoneTickSnapshot['poweredPositions'] => {
  const entries: Array<[PositionKey, number]> = Arr.fromIterable(powerByPosition)
  const sorted = Arr.sort(entries, Order.mapInput(Order.number, (e: readonly [PositionKey, number]) => e[0]))
  return Arr.map(sorted, ([key, power]) => ({
    position: positionFromKey(key),
    power: RedstonePowerLevel.make(power),
  }))
}
