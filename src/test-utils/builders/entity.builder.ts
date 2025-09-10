import { Archetype } from '@/domain/archetypes'
import { BlockType } from '@/domain/block-types'
import { ComponentName, ComponentOfName } from '@/core/components'

/**
 * Entity Builder - Fluent API for creating test entities
 * Provides type-safe component composition
 */

type EntityBuilderState = {
  readonly components: Partial<{ [K in ComponentName]: ComponentOfName<K> }>
}

const initialState: EntityBuilderState = {
  components: {}
}

/**
 * Entity builder functions
 */
export const entityBuilder = {
  /**
   * Create a new builder
   */
  create: (): EntityBuilderState => initialState,
  
  /**
   * Add position component
   */
  withPosition: (x: number, y: number, z: number) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        position: { x, y, z }
      }
    }),
  
  /**
   * Add velocity component
   */
  withVelocity: (dx: number, dy: number, dz: number) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        velocity: { dx, dy, dz }
      }
    }),
  
  /**
   * Add player component
   */
  asPlayer: (isGrounded: boolean = false) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        player: { isGrounded }
      }
    }),
  
  /**
   * Add collider component
   */
  withCollider: (width: number, height: number, depth: number) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        collider: { width, height, depth }
      }
    }),
  
  /**
   * Add gravity component
   */
  withGravity: (value: number = -32) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        gravity: { value }
      }
    }),
  
  /**
   * Add renderable component
   */
  withRenderable: (geometry: string, blockType: BlockType) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        renderable: { geometry, blockType }
      }
    }),
  
  /**
   * Add input state component
   */
  withInputState: (inputState: Partial<ComponentOfName<'inputState'>>) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        inputState: {
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
          place: false,
          destroy: false,
          isLocked: false,
          ...inputState
        }
      }
    }),
  
  /**
   * Add camera state component
   */
  withCameraState: (pitch: number, yaw: number) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        cameraState: { pitch, yaw }
      }
    }),
  
  /**
   * Add hotbar component
   */
  withHotbar: (slots: BlockType[], selectedIndex: number = 0) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        hotbar: { slots, selectedIndex }
      }
    }),
  
  /**
   * Mark as terrain block
   */
  asTerrainBlock: () =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        terrainBlock: {}
      }
    }),
  
  /**
   * Mark as target block
   */
  asTargetBlock: () =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        targetBlock: {}
      }
    }),
  
  /**
   * Add a custom component
   */
  withComponent: <K extends ComponentName>(name: K, component: ComponentOfName<K>) =>
    (state: EntityBuilderState): EntityBuilderState => ({
      components: {
        ...state.components,
        [name]: component
      }
    }),
  
  /**
   * Build the archetype
   */
  build: (state: EntityBuilderState): Archetype => ({
    components: state.components as any // Type assertion needed due to partial nature
  })
}

/**
 * Preset entity builders
 */
export const presets = {
  /**
   * Create a standard player entity
   */
  player: (x: number, y: number, z: number) =>
    pipe(
      entityBuilder.create(),
      entityBuilder.withPosition(x, y, z),
      entityBuilder.withVelocity(0, 0, 0),
      entityBuilder.asPlayer(false),
      entityBuilder.withCollider(0.6, 1.8, 0.6),
      entityBuilder.withGravity(-32),
      entityBuilder.withInputState({}),
      entityBuilder.withCameraState(0, 0),
      entityBuilder.withHotbar(Array(9).fill(BlockType.AIR)),
      entityBuilder.build
    ),
  
  /**
   * Create a standard block entity
   */
  block: (x: number, y: number, z: number, blockType: BlockType) =>
    pipe(
      entityBuilder.create(),
      entityBuilder.withPosition(x, y, z),
      entityBuilder.withRenderable('cube', blockType),
      entityBuilder.withCollider(1, 1, 1),
      entityBuilder.asTerrainBlock(),
      entityBuilder.asTargetBlock(),
      entityBuilder.build
    )
}

// Helper for pipe - not available in all environments
function pipe<A>(value: A): A
function pipe<A, B>(value: A, fn1: (a: A) => B): B
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C
function pipe<A, B, C, D>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D): D
function pipe<A, B, C, D, E>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E): E
function pipe<A, B, C, D, E, F>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F): F
function pipe<A, B, C, D, E, F, G>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G): G
function pipe<A, B, C, D, E, F, G, H>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G, fn7: (g: G) => H): H
function pipe<A, B, C, D, E, F, G, H, I>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G, fn7: (g: G) => H, fn8: (h: H) => I): I
function pipe<A, B, C, D, E, F, G, H, I, J>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G, fn7: (g: G) => H, fn8: (h: H) => I, fn9: (i: I) => J): J
function pipe(value: any, ...fns: Array<(a: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value)
}