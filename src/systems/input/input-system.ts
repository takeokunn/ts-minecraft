/**
 * Input System - Next-Generation Input Processing
 * 
 * Features:
 * - Multi-input source management (keyboard, mouse, gamepad)
 * - Input buffering and smoothing
 * - Action mapping with customizable bindings
 * - Input prediction and rollback
 * - Accessibility features
 * - Performance-optimized input polling
 */

import { Effect, Duration, Option } from 'effect'
import { ArchetypeQuery, trackPerformance } from '@/core/queries'
import { World, InputManager } from '@/runtime/services'
import { SystemFunction, SystemConfig, SystemContext } from '../core/scheduler'
import { InputStateComponent, CameraComponent, VelocityComponent } from '@/core/components'

/**
 * Input system configuration
 */
export interface InputConfig {
  readonly enableInputBuffering: boolean
  readonly enableInputSmoothing: boolean
  readonly enableInputPrediction: boolean
  readonly inputBufferSize: number
  readonly mouseSensitivity: number
  readonly keyRepeatDelay: number
  readonly keyRepeatInterval: number
  readonly deadzone: number
  readonly accelerationCurve: 'linear' | 'exponential' | 'custom'
}

/**
 * Input action types
 */
export type InputAction = 
  | 'move_forward' 
  | 'move_backward' 
  | 'move_left' 
  | 'move_right'
  | 'jump'
  | 'sprint'
  | 'crouch'
  | 'interact'
  | 'place_block'
  | 'destroy_block'
  | 'toggle_inventory'
  | 'look_up'
  | 'look_down'
  | 'look_left'
  | 'look_right'

/**
 * Input binding
 */
export interface InputBinding {
  readonly action: InputAction
  readonly primary: string // Key code or button
  readonly secondary?: string // Alternative binding
  readonly modifier?: string // Shift, Ctrl, Alt
}

/**
 * Input state snapshot
 */
interface InputSnapshot {
  readonly timestamp: number
  readonly frameId: number
  readonly actions: Record<InputAction, number> // 0-1 for analog, 0/1 for digital
  readonly mouseMovement: { dx: number, dy: number }
  readonly rawInputs: {
    keyboard: Record<string, boolean>
    mouse: Record<string, boolean>
    mousePosition: { x: number, y: number }
  }
}

/**
 * Input buffer for prediction and rollback
 */
class InputBuffer {
  private buffer: InputSnapshot[] = []
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  add(snapshot: InputSnapshot): void {
    this.buffer.push(snapshot)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  getSnapshot(frameId: number): Option.Option<InputSnapshot> {
    const snapshot = this.buffer.find(s => s.frameId === frameId)
    return snapshot ? Option.some(snapshot) : Option.none()
  }

  getLatest(): Option.Option<InputSnapshot> {
    return this.buffer.length > 0 
      ? Option.some(this.buffer[this.buffer.length - 1])
      : Option.none()
  }

  clear(): void {
    this.buffer = []
  }

  getHistory(frames: number): InputSnapshot[] {
    return this.buffer.slice(-frames)
  }
}

/**
 * Input smoother for better feel
 */
class InputSmoother {
  private history: Map<InputAction, number[]> = new Map()
  private windowSize: number

  constructor(windowSize: number = 3) {
    this.windowSize = windowSize
  }

  smooth(action: InputAction, value: number): number {
    if (!this.history.has(action)) {
      this.history.set(action, [])
    }

    const actionHistory = this.history.get(action)!
    actionHistory.push(value)

    if (actionHistory.length > this.windowSize) {
      actionHistory.shift()
    }

    // Simple moving average
    return actionHistory.reduce((sum, v) => sum + v, 0) / actionHistory.length
  }

  reset(): void {
    this.history.clear()
  }
}

/**
 * Default input configuration
 */
export const defaultInputConfig: InputConfig = {
  enableInputBuffering: true,
  enableInputSmoothing: true,
  enableInputPrediction: false,
  inputBufferSize: 60, // 1 second at 60fps
  mouseSensitivity: 1.0,
  keyRepeatDelay: 500,
  keyRepeatInterval: 50,
  deadzone: 0.1,
  accelerationCurve: 'exponential',
}

/**
 * Default input bindings
 */
export const defaultInputBindings: InputBinding[] = [
  { action: 'move_forward', primary: 'KeyW' },
  { action: 'move_backward', primary: 'KeyS' },
  { action: 'move_left', primary: 'KeyA' },
  { action: 'move_right', primary: 'KeyD' },
  { action: 'jump', primary: 'Space' },
  { action: 'sprint', primary: 'ShiftLeft' },
  { action: 'crouch', primary: 'ControlLeft' },
  { action: 'interact', primary: 'KeyE' },
  { action: 'place_block', primary: 'mouse1' }, // Right mouse button
  { action: 'destroy_block', primary: 'mouse0' }, // Left mouse button
  { action: 'toggle_inventory', primary: 'KeyI' },
]

/**
 * Advanced input processor
 */
class InputProcessor {
  private inputBuffer: InputBuffer
  private inputSmoother: InputSmoother
  private bindings: Map<string, InputAction> = new Map()
  private lastInputState: Record<InputAction, number> = {} as any

  constructor(private config: InputConfig, bindings: InputBinding[]) {
    this.inputBuffer = new InputBuffer(config.inputBufferSize)
    this.inputSmoother = new InputSmoother()
    this.setupBindings(bindings)
    this.initializeInputState()
  }

  /**
   * Process raw input into actions
   */
  processInput(
    rawKeyboard: Record<string, boolean>,
    rawMouse: Record<string, boolean>,
    mouseMovement: { dx: number, dy: number },
    frameId: number
  ): Record<InputAction, number> {
    const timestamp = Date.now()
    const actions = {} as Record<InputAction, number>

    // Process digital inputs (keyboard/mouse buttons)
    for (const [key, pressed] of Object.entries(rawKeyboard)) {
      const action = this.bindings.get(key)
      if (action && pressed) {
        actions[action] = 1.0
      }
    }

    for (const [button, pressed] of Object.entries(rawMouse)) {
      const action = this.bindings.get(button)
      if (action && pressed) {
        actions[action] = 1.0
      }
    }

    // Process analog inputs (mouse movement)
    const sensitivity = this.config.mouseSensitivity
    const lookHorizontal = this.applyAccelerationCurve(mouseMovement.dx * sensitivity)
    const lookVertical = this.applyAccelerationCurve(mouseMovement.dy * sensitivity)

    actions.look_left = Math.max(0, -lookHorizontal)
    actions.look_right = Math.max(0, lookHorizontal)
    actions.look_up = Math.max(0, -lookVertical)
    actions.look_down = Math.max(0, lookVertical)

    // Apply deadzone
    for (const action of Object.keys(actions) as InputAction[]) {
      if (Math.abs(actions[action]) < this.config.deadzone) {
        actions[action] = 0
      }
    }

    // Apply smoothing if enabled
    if (this.config.enableInputSmoothing) {
      for (const action of Object.keys(actions) as InputAction[]) {
        actions[action] = this.inputSmoother.smooth(action, actions[action])
      }
    }

    // Store in buffer if enabled
    if (this.config.enableInputBuffering) {
      const snapshot: InputSnapshot = {
        timestamp,
        frameId,
        actions,
        mouseMovement,
        rawInputs: {
          keyboard: { ...rawKeyboard },
          mouse: { ...rawMouse },
          mousePosition: { x: 0, y: 0 }, // Would be populated from actual mouse position
        },
      }
      this.inputBuffer.add(snapshot)
    }

    this.lastInputState = actions
    return actions
  }

  /**
   * Apply acceleration curve to input values
   */
  private applyAccelerationCurve(value: number): number {
    const absValue = Math.abs(value)
    const sign = Math.sign(value)

    switch (this.config.accelerationCurve) {
      case 'linear':
        return value

      case 'exponential':
        return sign * Math.pow(absValue, 1.5)

      case 'custom':
        // Custom curve for more responsive low-end and smooth high-end
        return sign * (absValue < 0.5 ? absValue * 2 : 1 + (absValue - 0.5) * 0.5)

      default:
        return value
    }
  }

  /**
   * Setup input bindings
   */
  private setupBindings(bindings: InputBinding[]): void {
    for (const binding of bindings) {
      this.bindings.set(binding.primary, binding.action)
      if (binding.secondary) {
        this.bindings.set(binding.secondary, binding.action)
      }
    }
  }

  /**
   * Initialize input state
   */
  private initializeInputState(): void {
    const actions: InputAction[] = [
      'move_forward', 'move_backward', 'move_left', 'move_right',
      'jump', 'sprint', 'crouch', 'interact', 'place_block', 'destroy_block',
      'toggle_inventory', 'look_up', 'look_down', 'look_left', 'look_right'
    ]

    for (const action of actions) {
      this.lastInputState[action] = 0
    }
  }

  /**
   * Get input history for prediction/rollback
   */
  getInputHistory(frames: number): InputSnapshot[] {
    return this.inputBuffer.getHistory(frames)
  }

  /**
   * Get specific input snapshot
   */
  getInputSnapshot(frameId: number): Option.Option<InputSnapshot> {
    return this.inputBuffer.getSnapshot(frameId)
  }
}

/**
 * Create optimized input system
 */
export const createInputSystem = (
  config: Partial<InputConfig> = {},
  bindings: InputBinding[] = defaultInputBindings
): SystemFunction => {
  const inputConfig = { ...defaultInputConfig, ...config }
  const processor = new InputProcessor(inputConfig, bindings)

  return (context: SystemContext) => Effect.gen(function* ($) {
    const world = yield* $(World)
    const inputManager = yield* $(InputManager)
    
    const startTime = Date.now()

    // Get raw input state
    const keyboardState = yield* $(inputManager.getState())
    const mouseState = yield* $(inputManager.getMouseState())

    // Convert to raw input maps
    const rawKeyboard = {
      KeyW: keyboardState.forward,
      KeyS: keyboardState.backward,
      KeyA: keyboardState.left,
      KeyD: keyboardState.right,
      Space: keyboardState.jump,
      ShiftLeft: keyboardState.sprint,
    }

    const rawMouse = {
      mouse0: keyboardState.destroy, // Left click
      mouse1: keyboardState.place,   // Right click
    }

    // Process inputs
    const processedActions = processor.processInput(
      rawKeyboard,
      rawMouse,
      mouseState,
      context.frameId
    )

    // Query entities that need input updates
    const playerQuery = ArchetypeQuery()
      .with('player', 'inputState')
      .maybe('cameraState', 'velocity')
      .execute()

    // Apply input to entities
    yield* $(
      Effect.forEach(
        playerQuery.entities,
        (entityId) => Effect.gen(function* ($) {
          // Update input state component
          const newInputState: Partial<InputStateComponent> = {
            forward: processedActions.move_forward > 0,
            backward: processedActions.move_backward > 0,
            left: processedActions.move_left > 0,
            right: processedActions.move_right > 0,
            jump: processedActions.jump > 0,
            sprint: processedActions.sprint > 0,
            place: processedActions.place_block > 0,
            destroy: processedActions.destroy_block > 0,
          }

          yield* $(world.updateComponent(entityId, 'inputState', newInputState))

          // Update camera state if present
          const cameraState = playerQuery.getComponent<CameraComponent>(entityId, 'cameraState')
          if (cameraState._tag === 'Some') {
            const currentCamera = (cameraState as any).value

            const newCameraState: Partial<CameraComponent> = {
              ...currentCamera,
              pitch: Math.max(-89, Math.min(89, currentCamera.pitch + 
                (processedActions.look_up - processedActions.look_down) * inputConfig.mouseSensitivity
              )),
              yaw: currentCamera.yaw + 
                (processedActions.look_right - processedActions.look_left) * inputConfig.mouseSensitivity,
            }

            yield* $(world.updateComponent(entityId, 'cameraState', newCameraState))
          }

          // Apply movement forces to velocity if physics-enabled
          const velocity = playerQuery.getComponent<VelocityComponent>(entityId, 'velocity')
          if (velocity._tag === 'Some') {
            const currentVelocity = (velocity as any).value
            const movementForce = 0.1 // This would be configurable

            const forwardBack = processedActions.move_forward - processedActions.move_backward
            const leftRight = processedActions.move_right - processedActions.move_left

            // Apply movement based on camera direction (would need camera direction from camera state)
            const newVelocity: Partial<VelocityComponent> = {
              dx: currentVelocity.dx + leftRight * movementForce,
              dz: currentVelocity.dz + forwardBack * movementForce,
              dy: processedActions.jump > 0 ? 0.5 : currentVelocity.dy, // Jump force
            }

            yield* $(world.updateComponent(entityId, 'velocity', newVelocity))
          }
        }),
        { concurrency: 'inherit', discard: true }
      )
    )

    // Performance tracking
    const endTime = Date.now()
    const executionTime = endTime - startTime
    trackPerformance('input', 'write', executionTime)

    // Debug logging for input lag analysis
    if (context.frameId % 120 === 0) { // Every 2 seconds at 60fps
      const activeActions = Object.entries(processedActions)
        .filter(([_, value]) => value > 0)
        .map(([action]) => action)
        
      if (activeActions.length > 0) {
        console.debug(`Input System - Active actions: ${activeActions.join(', ')} - ${executionTime}ms`)
      }
    }
  })
}

/**
 * System configuration for input
 */
export const inputSystemConfig: SystemConfig = {
  id: 'input',
  name: 'Input System',
  priority: 'critical',
  phase: 'input',
  dependencies: [],
  conflicts: [],
  maxExecutionTime: Duration.millis(2), // Input must be very fast
  enableProfiling: true,
}

/**
 * Default input system instance
 */
export const inputSystem = createInputSystem()

/**
 * Input system variants for different scenarios
 */
export const inputSystemVariants = {
  /**
   * Low-latency input for competitive gameplay
   */
  lowLatency: createInputSystem({
    enableInputBuffering: false,
    enableInputSmoothing: false,
    enableInputPrediction: false,
    accelerationCurve: 'linear',
  }),

  /**
   * Smooth input for casual gameplay
   */
  smooth: createInputSystem({
    enableInputBuffering: true,
    enableInputSmoothing: true,
    mouseSensitivity: 0.8,
    accelerationCurve: 'custom',
  }),

  /**
   * Accessibility-focused input
   */
  accessible: createInputSystem({
    enableInputSmoothing: true,
    deadzone: 0.2, // Larger deadzone
    keyRepeatDelay: 300,
    keyRepeatInterval: 100,
    accelerationCurve: 'exponential',
  }),
}

/**
 * Input system utilities
 */
export const InputUtils = {
  /**
   * Create input system with sensitivity preset
   */
  withSensitivity: (sensitivity: 'low' | 'medium' | 'high') => {
    const sensitivities = {
      low: 0.5,
      medium: 1.0,
      high: 2.0,
    }
    
    return createInputSystem({ mouseSensitivity: sensitivities[sensitivity] })
  },

  /**
   * Create input system with custom bindings
   */
  withBindings: (customBindings: Partial<Record<InputAction, string>>) => {
    const bindings: InputBinding[] = []
    
    for (const [action, key] of Object.entries(customBindings)) {
      bindings.push({
        action: action as InputAction,
        primary: key,
      })
    }
    
    return createInputSystem({}, [...defaultInputBindings, ...bindings])
  },

  /**
   * Create input system optimized for input lag
   */
  lowLatency: () => inputSystemVariants.lowLatency,

  /**
   * Validate input binding conflicts
   */
  validateBindings: (bindings: InputBinding[]): string[] => {
    const conflicts: string[] = []
    const usedKeys = new Set<string>()
    
    for (const binding of bindings) {
      if (usedKeys.has(binding.primary)) {
        conflicts.push(`Conflict: ${binding.primary} used by multiple actions`)
      }
      usedKeys.add(binding.primary)
      
      if (binding.secondary && usedKeys.has(binding.secondary)) {
        conflicts.push(`Conflict: ${binding.secondary} used by multiple actions`)
      }
      if (binding.secondary) {
        usedKeys.add(binding.secondary)
      }
    }
    
    return conflicts
  },
}