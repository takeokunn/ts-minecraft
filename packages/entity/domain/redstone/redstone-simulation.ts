import { HashMap, MutableHashMap, Option } from 'effect'
import type { HashSet } from 'effect'
import type { Position } from '@ts-minecraft/core'
import {
  RedstonePowerLevel,
  RedstoneComponentType,
  type RedstoneComponent,
  type RedstoneTickSnapshot,
} from './redstone-model'
import { type PositionKey, toBlockPosition, positionKey, positionFromKey } from './redstone-position-utils'
import { MAX_REDSTONE_POWER } from './redstone.config'

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

export const neighborsOf = (position: Position): ReadonlyArray<Position> => [
  { x: position.x + 1, y: position.y, z: position.z },
  { x: position.x - 1, y: position.y, z: position.z },
  { x: position.x, y: position.y + 1, z: position.z },
  { x: position.x, y: position.y - 1, z: position.z },
  { x: position.x, y: position.y, z: position.z + 1 },
  { x: position.x, y: position.y, z: position.z - 1 },
]

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
    for (const neighborPosition of neighborsOf(position)) {
      const neighborKey = positionKey(neighborPosition)
      const neighborOpt = HashMap.get(components, neighborKey)
      const neighborComponent = Option.getOrNull(neighborOpt)
      if (neighborComponent !== null && canConduct(neighborComponent.type)) {
        queue.push({ key: neighborKey, power: current.power - 1 })
      }
    }
  }

  return HashMap.fromIterable(powered)
}

export const updatePistons = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  powered: HashMap.HashMap<PositionKey, number>,
  pistonKeys: HashSet.HashSet<PositionKey>,
): HashMap.HashMap<PositionKey, RedstoneComponent> => {
  let nextComponents = components
  for (const key of pistonKeys) {
    const component = Option.getOrNull(HashMap.get(components, key))
    if (!component) continue
    const nextExtended = Option.getOrElse(HashMap.get(powered, key), () => 0) > 0
    if (nextExtended !== component.state.pistonExtended) {
      nextComponents = HashMap.set(nextComponents, key, {
        ...component,
        state: { ...component.state, pistonExtended: nextExtended },
      })
    }
  }
  return nextComponents
}

export const decayButtonTimers = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  buttonKeys: HashSet.HashSet<PositionKey>,
): HashMap.HashMap<PositionKey, RedstoneComponent> => {
  let nextComponents = components
  for (const key of buttonKeys) {
    const component = Option.getOrNull(HashMap.get(components, key))
    if (!component) continue
    const nextTicks = Math.max(0, component.state.buttonTicksRemaining - 1)
    nextComponents = HashMap.set(nextComponents, key, {
      ...component,
      state: { ...component.state, buttonTicksRemaining: nextTicks, active: nextTicks > 0 },
    })
  }
  return nextComponents
}

export const sortedPowerSnapshot = (powerByPosition: HashMap.HashMap<PositionKey, number>): RedstoneTickSnapshot['poweredPositions'] => {
  const entries: Array<readonly [PositionKey, number]> = []
  for (const entry of powerByPosition) {
    entries.push(entry)
  }
  entries.sort((a, b) => a[0] - b[0])

  const poweredPositions: Array<RedstoneTickSnapshot['poweredPositions'][number]> = []
  for (let i = 0; i < entries.length; i++) {
    const [key, power] = entries[i]!
    poweredPositions.push({
      position: positionFromKey(key),
      power: RedstonePowerLevel.make(power),
    })
  }
  return poweredPositions
}

const getButtonComponent = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  key: PositionKey,
): RedstoneComponent | null => Option.getOrNull(HashMap.get(components, key))

const hasActiveButton = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  buttonKeys: HashSet.HashSet<PositionKey>,
): boolean => {
  for (const key of buttonKeys) {
    const component = getButtonComponent(components, key)
    if (component !== null && component.state.buttonTicksRemaining > 0) return true
  }
  return false
}

const hasExpiredButtonThatStillHasPower = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  powerByPosition: HashMap.HashMap<PositionKey, number>,
  buttonKeys: HashSet.HashSet<PositionKey>,
): boolean => {
  for (const key of buttonKeys) {
    const component = getButtonComponent(components, key)
    if (component !== null && component.state.buttonTicksRemaining === 0 && HashMap.has(powerByPosition, key)) {
      return true
    }
  }
  return false
}

/**
 * Pure helper: determines whether the redstone circuit needs full power-propagation
 * this tick, based on external dirty flag and button activity.
 *
 * Propagation is needed when:
 * 1. An external event set dirty (lever toggle, button press, component add/remove).
 * 2. Any button is currently active (ticks > 0): power must re-propagate because the
 *    button is still providing power.
 * 3. Any button just expired (ticks hit 0 while still in powerByPosition): the
 *    previous propagation included it as a source; one more pass clears it.
 */
export const computeNeedsPropagation = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  powerByPosition: HashMap.HashMap<PositionKey, number>,
  buttonKeys: HashSet.HashSet<PositionKey>,
  dirty: boolean,
): boolean => {
  if (dirty) return true
  return hasActiveButton(components, buttonKeys) || hasExpiredButtonThatStillHasPower(components, powerByPosition, buttonKeys)
}
