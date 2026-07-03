// Factory defaults — the immutable reference the runtime registry resets to.
export const DEFAULT_KEY_MAPPINGS = {
  MOVE_FORWARD: 'KeyW',
  MOVE_BACKWARD: 'KeyS',
  MOVE_LEFT: 'KeyA',
  MOVE_RIGHT: 'KeyD',
  // Arrow-key aliases for movement (checked in addition to WASD).
  MOVE_FORWARD_ALT: 'ArrowUp',
  MOVE_BACKWARD_ALT: 'ArrowDown',
  MOVE_LEFT_ALT: 'ArrowLeft',
  MOVE_RIGHT_ALT: 'ArrowRight',
  JUMP: 'Space',
  SPRINT: 'ControlLeft',
  SPRINT_ALT: 'ControlRight',
  SNEAK: 'ShiftLeft',
  CAMERA_TOGGLE: 'F5',
  HUD_TOGGLE: 'F1',
  SCREENSHOT: 'F2',
  DROP_ITEM: 'KeyQ',
  // Creative-mode flight toggle. While flying, held JUMP/SNEAK drive ascend/descend.
  TOGGLE_FLIGHT: 'KeyF',
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
  INVENTORY_SORT: 'KeyR',
  PLAYER_LIST_TOGGLE: 'Tab',
  ESCAPE: 'Escape',
} as const

export type KeyAction = keyof typeof DEFAULT_KEY_MAPPINGS

// RUNTIME key registry. Call sites read properties per frame, so rebinding
// mutates this object in place and takes effect immediately with zero
// call-site changes. Reset + overlay pattern keeps unbound actions on their
// defaults.
export const KeyMappings: Record<KeyAction, string> = { ...DEFAULT_KEY_MAPPINGS }

// Applies player bindings from settings: reset to defaults, then overlay the
// overrides (unknown action names are ignored — stale saves stay harmless).
export const applyKeyBindings = (overrides: Readonly<Record<string, string>> | undefined): void => {
  for (const action of Object.keys(DEFAULT_KEY_MAPPINGS) as ReadonlyArray<KeyAction>) {
    const override = overrides?.[action]
    KeyMappings[action] = typeof override === 'string' && override.length > 0 ? override : DEFAULT_KEY_MAPPINGS[action]
  }
}


export type KeyMappings = typeof DEFAULT_KEY_MAPPINGS
