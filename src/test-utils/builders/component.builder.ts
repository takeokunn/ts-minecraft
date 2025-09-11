import { ComponentName, ComponentOfName, ComponentSchemas } from '@/core/components'
import { BlockType } from '@/core/values/block-type'
import * as S from "/schema/Schema"

/**
 * Component Builder - Type-safe component creation with validation
 * 
 * Features:
 * - Fluent API for component construction
 * - Runtime validation using Effect Schema
 * - Default value population
 * - Component composition utilities
 */

/**
 * Generic component builder state
 */
type ComponentBuilderState<T> = {
  readonly data: Partial<T>
  readonly schema: S.Schema<T, any>
}

/**
 * Component builder functions
 */
export const componentBuilder = {
  /**
   * Create a new component builder for a specific component type
   */
  for: <K extends ComponentName>(componentName: K) => {
    const schema = ComponentSchemas[componentName]
    
    return {
      create: (): ComponentBuilderState<ComponentOfName<K>> => ({
        data: {},
        schema: schema as S.Schema<ComponentOfName<K>, any>
      }),

      /**
       * Set a field value
       */
      with: <F extends keyof ComponentOfName<K>>(
        field: F, 
        value: ComponentOfName<K>[F]
      ) => (state: ComponentBuilderState<ComponentOfName<K>>): ComponentBuilderState<ComponentOfName<K>> => ({
        ...state,
        data: {
          ...state.data,
          [field]: value
        }
      }),

      /**
       * Merge partial data
       */
      merge: (partial: Partial<ComponentOfName<K>>) => 
        (state: ComponentBuilderState<ComponentOfName<K>>): ComponentBuilderState<ComponentOfName<K>> => ({
          ...state,
          data: {
            ...state.data,
            ...partial
          }
        }),

      /**
       * Build and validate the component
       */
      build: (state: ComponentBuilderState<ComponentOfName<K>>): ComponentOfName<K> => {
        try {
          return S.decodeSync(state.schema)(state.data) as ComponentOfName<K>
        } catch (error) {
          throw new Error(`Component validation failed for ${componentName}: ${error}`)
        }
      },

      /**
       * Build with defaults (no validation errors for missing fields)
       */
      buildWithDefaults: (state: ComponentBuilderState<ComponentOfName<K>>): Partial<ComponentOfName<K>> => {
        return state.data
      }
    }
  }
}

/**
 * Specialized builders for common components
 */
export const PositionBuilder = {
  create: () => componentBuilder.for('position').create(),
  at: (x: number, y: number, z: number) => 
    (state: any) => componentBuilder.for('position').with('x', x)(
      componentBuilder.for('position').with('y', y)(
        componentBuilder.for('position').with('z', z)(state)
      )
    ),
  origin: () => (state: any) => PositionBuilder.at(0, 0, 0)(state),
  spawn: () => (state: any) => PositionBuilder.at(0, 64, 0)(state),
  build: componentBuilder.for('position').build
}

export const VelocityBuilder = {
  create: () => componentBuilder.for('velocity').create(),
  stationary: () => (state: any) => 
    componentBuilder.for('velocity').merge({ dx: 0, dy: 0, dz: 0 })(state),
  moving: (dx: number, dy: number, dz: number) => (state: any) =>
    componentBuilder.for('velocity').merge({ dx, dy, dz })(state),
  falling: (speed: number = -10) => (state: any) =>
    componentBuilder.for('velocity').merge({ dx: 0, dy: speed, dz: 0 })(state),
  build: componentBuilder.for('velocity').build
}

export const PlayerBuilder = {
  create: () => componentBuilder.for('player').create(),
  grounded: () => (state: any) =>
    componentBuilder.for('player').with('isGrounded', true)(state),
  airborne: () => (state: any) =>
    componentBuilder.for('player').with('isGrounded', false)(state),
  build: componentBuilder.for('player').build
}

export const InputStateBuilder = {
  create: () => componentBuilder.for('inputState').create(),
  idle: () => (state: any) =>
    componentBuilder.for('inputState').merge({
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
      destroy: false,
      isLocked: false
    })(state),
  moving: (direction: 'forward' | 'backward' | 'left' | 'right') => (state: any) =>
    componentBuilder.for('inputState').merge({
      ...InputStateBuilder.idle()(state).data,
      [direction]: true
    })(state),
  sprinting: () => (state: any) => {
    const baseState = InputStateBuilder.moving('forward')(state)
    return componentBuilder.for('inputState').with('sprint', true)(baseState)
  },
  jumping: () => (state: any) =>
    componentBuilder.for('inputState').with('jump', true)(state),
  building: () => (state: any) =>
    componentBuilder.for('inputState').with('place', true)(state),
  mining: () => (state: any) =>
    componentBuilder.for('inputState').with('destroy', true)(state),
  build: componentBuilder.for('inputState').build
}

export const CameraStateBuilder = {
  create: () => componentBuilder.for('cameraState').create(),
  neutral: () => (state: any) =>
    componentBuilder.for('cameraState').merge({ pitch: 0, yaw: 0 })(state),
  lookingDown: () => (state: any) =>
    componentBuilder.for('cameraState').merge({ pitch: -Math.PI/2, yaw: 0 })(state),
  lookingUp: () => (state: any) =>
    componentBuilder.for('cameraState').merge({ pitch: Math.PI/2, yaw: 0 })(state),
  facing: (direction: 'north' | 'south' | 'east' | 'west') => (state: any) => {
    const yawMap = {
      north: 0,
      east: Math.PI/2,
      south: Math.PI,
      west: -Math.PI/2
    }
    return componentBuilder.for('cameraState').merge({ pitch: 0, yaw: yawMap[direction] })(state)
  },
  build: componentBuilder.for('cameraState').build
}

export const HotbarBuilder = {
  create: () => componentBuilder.for('hotbar').create(),
  empty: () => (state: any) =>
    componentBuilder.for('hotbar').merge({
      slots: Array(9).fill(BlockType.AIR),
      selectedIndex: 0
    })(state),
  withBlocks: (blocks: BlockType[]) => (state: any) => {
    const slots = Array(9).fill(BlockType.AIR)
    blocks.forEach((block, index) => {
      if (index < 9) slots[index] = block
    })
    return componentBuilder.for('hotbar').merge({ slots, selectedIndex: 0 })(state)
  },
  selecting: (index: number) => (state: any) =>
    componentBuilder.for('hotbar').with('selectedIndex', Math.max(0, Math.min(8, index)))(state),
  build: componentBuilder.for('hotbar').build
}

export const ColliderBuilder = {
  create: () => componentBuilder.for('collider').create(),
  player: () => (state: any) =>
    componentBuilder.for('collider').merge({ width: 0.6, height: 1.8, depth: 0.6 })(state),
  block: () => (state: any) =>
    componentBuilder.for('collider').merge({ width: 1, height: 1, depth: 1 })(state),
  custom: (width: number, height: number, depth: number) => (state: any) =>
    componentBuilder.for('collider').merge({ width, height, depth })(state),
  build: componentBuilder.for('collider').build
}

export const RenderableBuilder = {
  create: () => componentBuilder.for('renderable').create(),
  cube: (blockType: BlockType) => (state: any) =>
    componentBuilder.for('renderable').merge({
      geometry: 'cube' as const,
      blockType
    })(state),
  build: componentBuilder.for('renderable').build
}

export const TargetBuilder = {
  create: () => componentBuilder.for('target').create(),
  none: () => (state: any) =>
    componentBuilder.for('target').merge({ _tag: 'none' as const })(state),
  block: (position: { x: number; y: number; z: number }, normal: { x: number; y: number; z: number }) => (state: any) =>
    componentBuilder.for('target').merge({ 
      _tag: 'block' as const,
      position,
      normal
    })(state),
  build: componentBuilder.for('target').build
}

/**
 * Component composition utilities
 */
export const ComponentComposer = {
  /**
   * Compose multiple components into a single archetype
   */
  compose: <T extends Record<ComponentName, any>>(components: T): { components: T } => ({
    components
  }),

  /**
   * Standard player archetype composition
   */
  player: (position: { x: number; y: number; z: number }) => {
    const pos = pipe(PositionBuilder.create(), PositionBuilder.at(position.x, position.y, position.z), PositionBuilder.build)
    const vel = pipe(VelocityBuilder.create(), VelocityBuilder.stationary(), VelocityBuilder.build)
    const player = pipe(PlayerBuilder.create(), PlayerBuilder.grounded(), PlayerBuilder.build)
    const input = pipe(InputStateBuilder.create(), InputStateBuilder.idle(), InputStateBuilder.build)
    const camera = pipe(CameraStateBuilder.create(), CameraStateBuilder.neutral(), CameraStateBuilder.build)
    const hotbar = pipe(HotbarBuilder.create(), HotbarBuilder.empty(), HotbarBuilder.build)
    const collider = pipe(ColliderBuilder.create(), ColliderBuilder.player(), ColliderBuilder.build)
    const target = pipe(TargetBuilder.create(), TargetBuilder.none(), TargetBuilder.build)
    
    return ComponentComposer.compose({
      position: pos,
      velocity: vel,
      player: player,
      inputState: input,
      cameraState: camera,
      hotbar: hotbar,
      collider: collider,
      target: target,
      gravity: { value: -32 }
    })
  },

  /**
   * Standard block archetype composition
   */
  block: (position: { x: number; y: number; z: number }, blockType: BlockType) => {
    const pos = pipe(PositionBuilder.create(), PositionBuilder.at(position.x, position.y, position.z), PositionBuilder.build)
    const renderable = pipe(RenderableBuilder.create(), RenderableBuilder.cube(blockType), RenderableBuilder.build)
    const collider = pipe(ColliderBuilder.create(), ColliderBuilder.block(), ColliderBuilder.build)
    
    return ComponentComposer.compose({
      position: pos,
      renderable: renderable,
      collider: collider,
      terrainBlock: {},
      targetBlock: {}
    })
  },

  /**
   * Validate component combination
   */
  validate: <T extends Record<ComponentName, any>>(components: T): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    // Basic validation rules
    if ('player' in components && !('position' in components)) {
      errors.push('Player entities must have a position component')
    }
    
    if ('velocity' in components && !('position' in components)) {
      errors.push('Entities with velocity must have a position component')
    }
    
    if ('collider' in components && !('position' in components)) {
      errors.push('Entities with collider must have a position component')
    }
    
    if ('renderable' in components && !('position' in components)) {
      errors.push('Entities with renderable must have a position component')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }
}

/**
 * Helper for pipe - functional composition
 */
function pipe<A>(value: A): A
function pipe<A, B>(value: A, fn1: (a: A) => B): B
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C
function pipe<A, B, C, D>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D): D
function pipe<A, B, C, D, E>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E): E
function pipe<A, B, C, D, E, F>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F): F
function pipe<A, B, C, D, E, F, G>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G): G
function pipe<A, B, C, D, E, F, G, H>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G, fn7: (g: G) => H): H
function pipe(value: any, ...fns: Array<(a: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value)
}