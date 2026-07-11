export interface InputCapabilities {
  readonly touch: boolean
}

export interface InputGuidance {
  readonly supportSummary: ReadonlyArray<string>
  readonly instructions: ReadonlyArray<string>
  readonly quickHelp: ReadonlyArray<string>
}

export const TOUCH_CONTROLS_MEDIA_QUERY = '(hover: none) and (pointer: coarse)'

export interface InputCapabilityEnvironment {
  readonly matchMedia?: (query: string) => Pick<MediaQueryList, 'matches'>
}

const desktopInstructions = [
  'Move with WASD or the left stick, look with the mouse or right stick, and jump with Space or a gamepad face button.',
  'Break and place blocks with click or triggers. Open inventory with E, then use 1-9, the mouse wheel, or controller bumpers to select a hotbar slot.',
  'Press Esc to pause and open settings.',
] as const

const touchInstructions = [
  'Move with the left joystick, drag the right side to look, and use the on-screen buttons to jump, run, sneak, break, and place blocks.',
  'Use the numbered hotbar buttons to select an item. The top-right buttons open inventory and pause.',
] as const

export const detectInputCapabilities = (
  environment: InputCapabilityEnvironment = globalThis,
): InputCapabilities => ({
  touch: environment.matchMedia?.(TOUCH_CONTROLS_MEDIA_QUERY).matches === true,
})

export const inputGuidance = (capabilities: InputCapabilities): InputGuidance => {
  const touch = capabilities.touch
  return {
    supportSummary: touch
      ? ['Touch controls are ready.', 'Keyboard, mouse, and gamepad are also supported.']
      : ['Keyboard, mouse, and gamepad are supported.', 'Touch controls appear automatically on touch-first devices.'],
    instructions: touch ? [...touchInstructions, ...desktopInstructions] : [...desktopInstructions, ...touchInstructions],
    quickHelp: touch ? touchInstructions : desktopInstructions,
  }
}
