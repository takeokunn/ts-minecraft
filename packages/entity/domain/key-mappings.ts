export const KeyMappings = {
  MOVE_FORWARD: 'KeyW',
  MOVE_BACKWARD: 'KeyS',
  MOVE_LEFT: 'KeyA',
  MOVE_RIGHT: 'KeyD',
  JUMP: 'Space',
  SPRINT: 'ControlLeft',
  SNEAK: 'ShiftLeft',
  CAMERA_TOGGLE: 'F5',
  HOTBAR_SLOT_1: 'Digit1',
  HOTBAR_SLOT_2: 'Digit2',
  HOTBAR_SLOT_3: 'Digit3',
  HOTBAR_SLOT_4: 'Digit4',
  HOTBAR_SLOT_5: 'Digit5',
  HOTBAR_SLOT_6: 'Digit6',
  HOTBAR_SLOT_7: 'Digit7',
  HOTBAR_SLOT_8: 'Digit8',
  HOTBAR_SLOT_9: 'Digit9',
  INVENTORY_OPEN: 'KeyE',
  ESCAPE: 'Escape',
} as const

export type KeyMappings = typeof KeyMappings
