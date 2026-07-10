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
  type === RedstoneComponentType.Piston ||
  type === RedstoneComponentType.PressurePlate ||
  type === RedstoneComponentType.Observer ||
  type === RedstoneComponentType.Repeater ||
  type === RedstoneComponentType.Comparator ||
  type === RedstoneComponentType.Dispenser

export const isPowerSource = (component: RedstoneComponent): boolean =>
  (component.type === RedstoneComponentType.Lever && component.state.active) ||
  (component.type === RedstoneComponentType.Button && component.state.buttonTicksRemaining > 0) ||
  (component.type === RedstoneComponentType.Torch && component.state.active) ||
  (component.type === RedstoneComponentType.PressurePlate && component.state.active) ||
  // Observers pulse like buttons: power while the pulse timer runs.
  (component.type === RedstoneComponentType.Observer && component.state.buttonTicksRemaining > 0) ||
  // Active repeaters re-emit at full strength (signal refresh).
  (component.type === RedstoneComponentType.Repeater && component.state.active) ||
  // Comparators emit their computed output strength.
  (component.type === RedstoneComponentType.Comparator && (component.state.comparatorOutput ?? 0) > 0)

export const neighborsOf = (position: Position): ReadonlyArray<Position> => [
  { x: position.x + 1, y: position.y, z: position.z },
  { x: position.x - 1, y: position.y, z: position.z },
  { x: position.x, y: position.y + 1, z: position.z },
  { x: position.x, y: position.y - 1, z: position.z },
  { x: position.x, y: position.y, z: position.z + 1 },
  { x: position.x, y: position.y, z: position.z - 1 },
]

// A torch attaches to the cell opposite its facing (floor torches attach below).
// It NEVER powers that cell — in vanilla a torch does not power its own support,
// which is exactly what prevents an isolated torch from self-oscillating once
// inversion (updateTorches) reads the support cell's power.
export const torchAttachmentPosition = (component: RedstoneComponent): Position => {
  const base = toBlockPosition(component.position)
  const facing = component.state.pistonFacing
  const offset = facing !== undefined ? REPEATER_FACING_OFFSETS[facing] : { x: 0, y: 1, z: 0 }
  return { x: base.x - offset.x, y: base.y - offset.y, z: base.z - offset.z }
}

export const propagatePower = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
): HashMap.HashMap<PositionKey, number> => {
  const powered = MutableHashMap.empty<PositionKey, number>()

  const queue: Array<{ readonly key: PositionKey; readonly power: number }> = []
  HashMap.forEach(components, (component, key) => {
    if (!isPowerSource(component)) return
    // Comparators are the one variable-strength source: they re-emit the
    // measured rear signal, not a full 15.
    const power = component.type === RedstoneComponentType.Comparator
      ? Math.min(MAX_REDSTONE_POWER, Math.max(0, component.state.comparatorOutput ?? 0))
      : MAX_REDSTONE_POWER
    queue.push({ key, power })
  })

  let cursor = 0
  while (cursor < queue.length) {
    const current = queue[cursor++]!
    const currentKnown = Option.getOrElse(MutableHashMap.get(powered, current.key), () => 0)
    if (current.power <= currentKnown) continue

    MutableHashMap.set(powered, current.key, current.power)

    if (current.power <= 1) continue

    const position = positionFromKey(current.key)
    const currentComponent = Option.getOrNull(HashMap.get(components, current.key))
    const torchAttachmentKey = currentComponent !== null && currentComponent.type === RedstoneComponentType.Torch
      ? positionKey(torchAttachmentPosition(currentComponent))
      : null
    for (const neighborPosition of neighborsOf(position)) {
      const neighborKey = positionKey(neighborPosition)
      // Torches never power their own attachment cell (vanilla; also the
      // stability condition for NOT-gate inversion).
      if (torchAttachmentKey !== null && neighborKey === torchAttachmentKey) continue
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

export const REPEATER_FACING_OFFSETS = {
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  south: { x: 0, y: 0, z: 1 },
  north: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
} as const

// Repeaters read the PREVIOUS tick's power at their rear cell (opposite the
// facing) and become full-strength sources when it is powered — a signal
// refresh with an inherent one-tick delay. Returns whether any state changed
// so the caller can force a re-propagation.
export const updateRepeaters = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  powered: HashMap.HashMap<PositionKey, number>,
): [HashMap.HashMap<PositionKey, RedstoneComponent>, boolean] => {
  let nextComponents = components
  let changed = false
  HashMap.forEach(components, (component, key) => {
    if (component.type !== RedstoneComponentType.Repeater) return
    const facing = component.state.pistonFacing ?? 'east'
    const offset = REPEATER_FACING_OFFSETS[facing]
    const rear: Position = {
      x: Math.floor(component.position.x) - offset.x,
      y: Math.floor(component.position.y) - offset.y,
      z: Math.floor(component.position.z) - offset.z,
    }
    const rearPower = Option.getOrElse(HashMap.get(powered, positionKey(rear)), () => 0)
    const nextActive = rearPower > 0
    if (nextActive !== component.state.active) {
      changed = true
      nextComponents = HashMap.set(nextComponents, key, {
        ...component,
        state: { ...component.state, active: nextActive },
      })
    }
  })
  return [nextComponents, changed]
}

// Torch inversion (the NOT gate): a torch reads the PREVIOUS tick's power at
// its attachment cell and is lit exactly when that cell is unpowered. The
// one-tick delay matches vanilla torch response.
export const updateTorches = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  powered: HashMap.HashMap<PositionKey, number>,
): [HashMap.HashMap<PositionKey, RedstoneComponent>, boolean] => {
  let nextComponents = components
  let changed = false
  HashMap.forEach(components, (component, key) => {
    if (component.type !== RedstoneComponentType.Torch) return
    const attachmentPower = Option.getOrElse(
      HashMap.get(powered, positionKey(torchAttachmentPosition(component))),
      () => 0,
    )
    const nextActive = attachmentPower === 0
    if (nextActive !== component.state.active) {
      changed = true
      nextComponents = HashMap.set(nextComponents, key, {
        ...component,
        state: { ...component.state, active: nextActive },
      })
    }
  })
  return [nextComponents, changed]
}

// Perpendicular side offsets per facing (vertical facings measure the four
// horizontal neighbors, mirroring how vanilla has no vertical comparators).
const COMPARATOR_SIDE_OFFSETS: Readonly<Record<string, ReadonlyArray<{ x: number; y: number; z: number }>>> = {
  east: [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }],
  west: [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }],
  north: [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }],
  south: [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }],
  up: [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }],
  down: [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }],
}

// Comparators (compare mode): output = rear signal when rear >= max(side
// signals), else 0. Samples the previous tick's power map like repeaters,
// so comparator chains settle one tick per stage.
export const updateComparators = (
  components: HashMap.HashMap<PositionKey, RedstoneComponent>,
  powered: HashMap.HashMap<PositionKey, number>,
): [HashMap.HashMap<PositionKey, RedstoneComponent>, boolean] => {
  let nextComponents = components
  let changed = false
  HashMap.forEach(components, (component, key) => {
    if (component.type !== RedstoneComponentType.Comparator) return
    const facing = component.state.pistonFacing ?? 'east'
    const offset = REPEATER_FACING_OFFSETS[facing]
    const base = {
      x: Math.floor(component.position.x),
      y: Math.floor(component.position.y),
      z: Math.floor(component.position.z),
    }
    const rearPower = Option.getOrElse(
      HashMap.get(powered, positionKey({ x: base.x - offset.x, y: base.y - offset.y, z: base.z - offset.z })),
      () => 0,
    )
    let sideMax = 0
    for (const side of COMPARATOR_SIDE_OFFSETS[facing]!) {
      const sidePower = Option.getOrElse(
        HashMap.get(powered, positionKey({ x: base.x + side.x, y: base.y + side.y, z: base.z + side.z })),
        () => 0,
      )
      if (sidePower > sideMax) sideMax = sidePower
    }
    // Subtract mode: rear − max(sides), floored at 0. Compare mode (default):
    // rear passes only when it beats every side.
    const nextOutput = component.state.comparatorSubtract === true
      ? Math.max(0, rearPower - sideMax)
      : (rearPower > 0 && rearPower >= sideMax ? rearPower : 0)
    if (nextOutput !== (component.state.comparatorOutput ?? 0)) {
      changed = true
      nextComponents = HashMap.set(nextComponents, key, {
        ...component,
        state: { ...component.state, comparatorOutput: nextOutput, active: nextOutput > 0 },
      })
    }
  })
  return [nextComponents, changed]
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
