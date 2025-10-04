import { HashMap, HashSet, Match, Option, pipe } from 'effect'
import { InputTimestamp, MouseDelta, Vector2 } from './model'
import type {
  AxisId,
  AxisValue,
  InputEvent,
  InputTimestamp as InputTimestampType,
  KeyCode,
  MouseButton,
  Vector2 as Vector2Type,
} from './model'

export type AxisState = HashMap.HashMap<AxisId, AxisValue>

export interface InputSnapshot {
  readonly keys: HashSet.HashSet<KeyCode>
  readonly mouseButtons: HashSet.HashSet<MouseButton>
  readonly axes: AxisState
  readonly mousePosition: Vector2Type
  readonly mouseDelta: MouseDelta
  readonly lastTimestamp: InputTimestampType
}

export const makeSnapshot = (timestamp: InputTimestampType): InputSnapshot => ({
  keys: HashSet.empty(),
  mouseButtons: HashSet.empty(),
  axes: HashMap.empty(),
  mousePosition: Vector2({ x: 0, y: 0 }),
  mouseDelta: MouseDelta({ deltaX: 0, deltaY: 0, occurredAt: timestamp }),
  lastTimestamp: timestamp,
})

const withTimestamp = (snapshot: InputSnapshot, timestamp: InputTimestampType): InputSnapshot => ({
  ...snapshot,
  lastTimestamp: timestamp,
})

const pressKey = (snapshot: InputSnapshot, key: KeyCode): InputSnapshot => ({
  ...snapshot,
  keys: HashSet.add(snapshot.keys, key),
})

const releaseKey = (snapshot: InputSnapshot, key: KeyCode): InputSnapshot => ({
  ...snapshot,
  keys: HashSet.remove(snapshot.keys, key),
})

const pressMouse = (snapshot: InputSnapshot, button: MouseButton): InputSnapshot => ({
  ...snapshot,
  mouseButtons: HashSet.add(snapshot.mouseButtons, button),
})

const releaseMouse = (snapshot: InputSnapshot, button: MouseButton): InputSnapshot => ({
  ...snapshot,
  mouseButtons: HashSet.remove(snapshot.mouseButtons, button),
})

const updateMouseMove = (
  snapshot: InputSnapshot,
  position: Vector2Type,
  deltaX: number,
  deltaY: number,
  timestamp: InputTimestampType
): InputSnapshot => ({
  ...snapshot,
  mousePosition: position,
  mouseDelta: MouseDelta({ deltaX, deltaY, occurredAt: timestamp }),
})

const updateAxis = (snapshot: InputSnapshot, axis: AxisId, value: AxisValue): InputSnapshot => ({
  ...snapshot,
  axes: HashMap.set(snapshot.axes, axis, value),
})

export const applyEvent = (snapshot: InputSnapshot, event: InputEvent): InputSnapshot =>
  pipe(
    event,
    Match.value,
    Match.tag('KeyPressed', ({ key, timestamp }) =>
      withTimestamp(pressKey(snapshot, key), timestamp)
    ),
    Match.tag('KeyReleased', ({ key, timestamp }) =>
      withTimestamp(releaseKey(snapshot, key), timestamp)
    ),
    Match.tag('MouseButtonPressed', ({ button, timestamp }) =>
      withTimestamp(pressMouse(snapshot, button), timestamp)
    ),
    Match.tag('MouseButtonReleased', ({ button, timestamp }) =>
      withTimestamp(releaseMouse(snapshot, button), timestamp)
    ),
    Match.tag('MouseMoved', ({ position, delta, timestamp }) =>
      withTimestamp(updateMouseMove(snapshot, position, delta.x, delta.y, timestamp), timestamp)
    ),
    Match.tag('GamepadAxisChanged', ({ axis, value, timestamp }) =>
      withTimestamp(updateAxis(snapshot, axis, value), timestamp)
    ),
    Match.exhaustive
  )

export const isKeyActive = (snapshot: InputSnapshot, key: KeyCode): boolean =>
  HashSet.has(snapshot.keys, key)

export const isMouseButtonActive = (snapshot: InputSnapshot, button: MouseButton): boolean =>
  HashSet.has(snapshot.mouseButtons, button)

export const axisValue = (
  snapshot: InputSnapshot,
  axis: AxisId
): Option.Option<AxisValue> => HashMap.get(snapshot.axes, axis)

export const zeroSnapshot = makeSnapshot(InputTimestamp(0))
