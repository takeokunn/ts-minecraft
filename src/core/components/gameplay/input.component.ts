import * as S from 'effect/Schema'

/**
 * Input Component
 * Stores the current input state for an entity
 */

export const InputComponent = S.Struct({
  // Movement
  forward: S.Boolean,
  backward: S.Boolean,
  left: S.Boolean,
  right: S.Boolean,
  jump: S.Boolean,
  sprint: S.Boolean,
  crouch: S.Boolean,
  
  // Actions
  place: S.Boolean,
  destroy: S.Boolean,
  interact: S.Boolean,
  
  // UI
  inventory: S.Boolean,
  menu: S.Boolean,
  
  // Mouse
  mouseDeltaX: S.Number.pipe(S.finite()).pipe(S.withDefault(() => 0)),
  mouseDeltaY: S.Number.pipe(S.finite()).pipe(S.withDefault(() => 0)),
  
  // Meta
  isLocked: S.Boolean, // Pointer lock state
})

export type InputComponent = S.Schema.Type<typeof InputComponent>

// Helper to create default input state
export const createInputState = (): InputComponent => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  crouch: false,
  place: false,
  destroy: false,
  interact: false,
  inventory: false,
  menu: false,
  mouseDeltaX: 0,
  mouseDeltaY: 0,
  isLocked: false,
})

// Check if any movement key is pressed
export const hasMovementInput = (input: InputComponent): boolean =>
  input.forward || input.backward || input.left || input.right

// Get movement vector from input
export const getMovementVector = (input: InputComponent) => {
  let x = 0
  let z = 0
  
  if (input.forward) z -= 1
  if (input.backward) z += 1
  if (input.left) x -= 1
  if (input.right) x += 1
  
  // Normalize diagonal movement
  const length = Math.sqrt(x * x + z * z)
  if (length > 0) {
    x /= length
    z /= length
  }
  
  return { x, z }
}