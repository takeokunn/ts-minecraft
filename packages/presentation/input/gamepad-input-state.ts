import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'

export type GamepadMouseButton = 0 | 2
export type GamepadWheelButton = 4 | 5

export interface GamepadSnapshot {
  readonly pressedKeys: ReadonlySet<string>
  readonly mouseButtons: ReadonlySet<GamepadMouseButton>
  readonly wheelButtons: ReadonlySet<GamepadWheelButton>
  readonly mouseDelta: Readonly<{ x: number; y: number }>
}

export interface GamepadEdgeState {
  readonly snapshot: GamepadSnapshot
  readonly justPressedKeys: ReadonlySet<string>
  readonly justClickedButtons: ReadonlySet<GamepadMouseButton>
  readonly wheelDelta: number
}

export interface GamepadEdgeTracker {
  update(snapshot: GamepadSnapshot): void
  getState(): GamepadEdgeState
  consumeKeyPress(key: string): boolean
  consumeMouseClick(button: number): boolean
  consumeWheelDelta(): number
  clear(): void
}

const STICK_DEADZONE = 0.15
const TRIGGER_DEADZONE = 0.1
const LOOK_SENSITIVITY = 14
const WHEEL_STEP = 120

const KEY_BINDINGS = {
  forward: KeyMappings.MOVE_FORWARD,
  backward: KeyMappings.MOVE_BACKWARD,
  left: KeyMappings.MOVE_LEFT,
  right: KeyMappings.MOVE_RIGHT,
  jump: KeyMappings.JUMP,
  sneak: KeyMappings.SNEAK,
  sprint: KeyMappings.SPRINT,
  inventory: KeyMappings.INVENTORY_OPEN,
  drop: KeyMappings.DROP_ITEM,
  menu: KeyMappings.ESCAPE,
  hud: KeyMappings.HUD_TOGGLE,
  camera: KeyMappings.CAMERA_TOGGLE,
} as const

const EMPTY_SNAPSHOT: GamepadSnapshot = {
  pressedKeys: new Set(),
  mouseButtons: new Set(),
  wheelButtons: new Set(),
  mouseDelta: { x: 0, y: 0 },
}

const normalizeAxis = (value: number, deadzone: number): number => {
  if (!Number.isFinite(value)) return 0
  const magnitude = Math.min(Math.abs(value), 1)
  if (magnitude <= deadzone) return 0
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone))
}

const isButtonPressed = (button: GamepadButton | undefined, deadzone = 0.5): boolean =>
  button !== undefined && (button.pressed || (Number.isFinite(button.value) && button.value >= deadzone))

export const collectGamepadSnapshot = (gamepads: readonly Gamepad[]): GamepadSnapshot => {
  const pressedKeys = new Set<string>()
  const mouseButtons = new Set<GamepadMouseButton>()
  const wheelButtons = new Set<GamepadWheelButton>()
  let mouseDeltaX = 0
  let mouseDeltaY = 0

  for (const gamepad of gamepads) {
    if (!gamepad.connected) continue

    const leftX = normalizeAxis(gamepad.axes[0] ?? 0, STICK_DEADZONE)
    const leftY = normalizeAxis(gamepad.axes[1] ?? 0, STICK_DEADZONE)
    const rightX = normalizeAxis(gamepad.axes[2] ?? 0, STICK_DEADZONE)
    const rightY = normalizeAxis(gamepad.axes[3] ?? 0, STICK_DEADZONE)

    if (leftY < 0) pressedKeys.add(KEY_BINDINGS.forward)
    if (leftY > 0) pressedKeys.add(KEY_BINDINGS.backward)
    if (leftX < 0) pressedKeys.add(KEY_BINDINGS.left)
    if (leftX > 0) pressedKeys.add(KEY_BINDINGS.right)
    if (isButtonPressed(gamepad.buttons[12])) pressedKeys.add(KEY_BINDINGS.forward)
    if (isButtonPressed(gamepad.buttons[13])) pressedKeys.add(KEY_BINDINGS.backward)
    if (isButtonPressed(gamepad.buttons[14])) pressedKeys.add(KEY_BINDINGS.left)
    if (isButtonPressed(gamepad.buttons[15])) pressedKeys.add(KEY_BINDINGS.right)
    if (isButtonPressed(gamepad.buttons[0])) pressedKeys.add(KEY_BINDINGS.jump)
    if (isButtonPressed(gamepad.buttons[1])) pressedKeys.add(KEY_BINDINGS.sneak)
    if (isButtonPressed(gamepad.buttons[10])) pressedKeys.add(KEY_BINDINGS.sprint)
    if (isButtonPressed(gamepad.buttons[2])) pressedKeys.add(KEY_BINDINGS.drop)
    if (isButtonPressed(gamepad.buttons[3])) pressedKeys.add(KEY_BINDINGS.inventory)
    if (isButtonPressed(gamepad.buttons[8])) pressedKeys.add(KEY_BINDINGS.hud)
    if (isButtonPressed(gamepad.buttons[9])) pressedKeys.add(KEY_BINDINGS.menu)
    if (isButtonPressed(gamepad.buttons[11])) pressedKeys.add(KEY_BINDINGS.camera)
    if (isButtonPressed(gamepad.buttons[6], TRIGGER_DEADZONE)) mouseButtons.add(2)
    if (isButtonPressed(gamepad.buttons[7], TRIGGER_DEADZONE)) mouseButtons.add(0)
    if (isButtonPressed(gamepad.buttons[4])) wheelButtons.add(4)
    if (isButtonPressed(gamepad.buttons[5])) wheelButtons.add(5)

    mouseDeltaX += rightX * LOOK_SENSITIVITY
    mouseDeltaY += rightY * LOOK_SENSITIVITY
  }

  return { pressedKeys, mouseButtons, wheelButtons, mouseDelta: { x: mouseDeltaX, y: mouseDeltaY } }
}

export const createGamepadEdgeTracker = (): GamepadEdgeTracker => {
  let snapshot = EMPTY_SNAPSHOT
  let justPressedKeys = new Set<string>()
  let justClickedButtons = new Set<GamepadMouseButton>()
  let wheelDelta = 0

  return {
    update(next) {
      for (const key of next.pressedKeys) {
        if (!snapshot.pressedKeys.has(key)) justPressedKeys.add(key)
      }
      for (const button of next.mouseButtons) {
        if (!snapshot.mouseButtons.has(button)) justClickedButtons.add(button)
      }
      for (const button of next.wheelButtons) {
        if (!snapshot.wheelButtons.has(button)) wheelDelta += button === 4 ? -WHEEL_STEP : WHEEL_STEP
      }
      snapshot = next
    },
    getState: () => ({ snapshot, justPressedKeys, justClickedButtons, wheelDelta }),
    consumeKeyPress(key) {
      const pressed = justPressedKeys.has(key)
      justPressedKeys.delete(key)
      return pressed
    },
    consumeMouseClick(button) {
      if (button !== 0 && button !== 2) return false
      const clicked = justClickedButtons.has(button)
      justClickedButtons.delete(button)
      return clicked
    },
    consumeWheelDelta() {
      const delta = wheelDelta
      wheelDelta = 0
      return delta
    },
    clear() {
      snapshot = EMPTY_SNAPSHOT
      justPressedKeys = new Set()
      justClickedButtons = new Set()
      wheelDelta = 0
    },
  }
}
