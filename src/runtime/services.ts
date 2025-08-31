import { Context, type Effect, Stream, Option } from 'effect';
import type * as THREE from 'three';
import type { Hotbar, Position } from '../domain/components';
import type { EntityId } from '../domain/entity';
import { BlockType, Scene } from './game-state';
import type { WorldState } from './world';

/**
 * Service for rendering the game world.
 */
export interface Renderer {
  readonly render: (world: WorldState) => Effect.Effect<void>;
  readonly updateHighlight: (
    target: THREE.Intersection | null,
  ) => Effect.Effect<void>;
}
export const Renderer: Context.Tag<Renderer, Renderer> =
  Context.GenericTag<Renderer>('@services/Renderer');

type MouseState = {
  dx: number;
  dy: number;
  leftClick: boolean;
  rightClick: boolean;
};

import type { World } from './world';
/**
 * Service for handling user input.
 */
export interface Input {
  readonly poll: () => Effect.Effect<void, never, World>;
  readonly getMouseState: () => Effect.Effect<MouseState>;
  readonly getKeyboardState: () => Effect.Effect<Set<string>>;
}
export const Input: Context.Tag<Input, Input> =
  Context.GenericTag<Input>('@services/Input');

/**
 * Service to hold rendering-specific state that needs to be shared
 * between the render system and other systems (e.g., interaction).
 */
export interface RenderContext {
  readonly instanceIdToEntityId: Map<BlockType, Map<number, EntityId>>; // blockType -> instanceId -> entityId
}
export const RenderContext: Context.Tag<RenderContext, RenderContext> =
  Context.GenericTag<RenderContext>('@services/RenderContext');

/**
 * Service for managing Three.js materials.
 */
export interface MaterialManager {
  readonly get: (
    blockType: BlockType,
  ) => Effect.Effect<THREE.Material | THREE.Material[]>;
}
export const MaterialManager: Context.Tag<MaterialManager, MaterialManager> =
  Context.GenericTag<MaterialManager>('@services/MaterialManager');

/**
 * Service for interacting with the UI (DOM).
 */
export interface UI {
  readonly setScene: (scene: Scene) => Effect.Effect<void>;
  readonly updateHotbar: (hotbar: Hotbar) => Effect.Effect<void>;
  readonly events: {
    readonly newGame: Stream.Stream<never, never, void>;
    readonly loadGame: Stream.Stream<never, never, File>;
    readonly saveGame: Stream.Stream<never, never, void>;
    readonly backToGame: Stream.Stream<never, never, void>;
  };
}
export const UI: Context.Tag<UI, UI> = Context.GenericTag<UI>('@services/UI');

/**
 * Service for controlling the camera.
 */
export interface Camera {
  readonly moveRight: (delta: number) => Effect.Effect<void>;
  readonly rotatePitch: (delta: number) => Effect.Effect<void>;
  readonly getYaw: () => Effect.Effect<number>;
  readonly getPitch: () => Effect.Effect<number>;
}
export const Camera = Context.GenericTag<Camera>('Camera');

export type RaycastResult = {
  readonly entityId: EntityId;
  readonly position: Position;
  readonly face: THREE.Vector3;
  readonly intersection: unknown; // Opaque type for the renderer
};

/**
 * Service for performing raycasts into the scene.
 */
export interface RaycastService {
  readonly cast: () => Effect.Effect<Option.Option<RaycastResult>>;
}
export const RaycastService = Context.GenericTag<RaycastService>('RaycastService');
