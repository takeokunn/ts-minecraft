import { Schema } from 'effect'

export const KeyMappingsSchema = Schema.Struct({
  MOVE_FORWARD: Schema.Literal('KeyW'),
  MOVE_BACKWARD: Schema.Literal('KeyS'),
  MOVE_LEFT: Schema.Literal('KeyA'),
  MOVE_RIGHT: Schema.Literal('KeyD'),
  JUMP: Schema.Literal('Space'),
  SPRINT: Schema.Literal('ControlLeft'),
  SNEAK: Schema.Literal('ShiftRight'),
  CAMERA_TOGGLE: Schema.Literal('F5'),
  HOTBAR_SLOT_1: Schema.Literal('Digit1'),
  HOTBAR_SLOT_2: Schema.Literal('Digit2'),
  HOTBAR_SLOT_3: Schema.Literal('Digit3'),
  HOTBAR_SLOT_4: Schema.Literal('Digit4'),
  HOTBAR_SLOT_5: Schema.Literal('Digit5'),
  HOTBAR_SLOT_6: Schema.Literal('Digit6'),
  HOTBAR_SLOT_7: Schema.Literal('Digit7'),
  HOTBAR_SLOT_8: Schema.Literal('Digit8'),
  HOTBAR_SLOT_9: Schema.Literal('Digit9'),
  INVENTORY_OPEN: Schema.Literal('KeyE'),
  ESCAPE: Schema.Literal('Escape'),
})

export type KeyMappings = Schema.Schema.Type<typeof KeyMappingsSchema>

export const KeyMappings = {
  MOVE_FORWARD: 'KeyW',
  MOVE_BACKWARD: 'KeyS',
  MOVE_LEFT: 'KeyA',
  MOVE_RIGHT: 'KeyD',
  JUMP: 'Space',
  SPRINT: 'ControlLeft',
  SNEAK: 'ShiftRight', // Changed from ShiftLeft to ShiftRight
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
