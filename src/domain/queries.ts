import {
  AnyComponentSchema,
  CameraState,
  Chunk,
  Collider,
  ComponentType,
  Gravity,
  InputState,
  InstancedMeshRenderable,
  Player,
  Position,
  Renderable,
  TerrainBlock,
  Velocity,
} from "./components";
import { EntityId } from "./entity";

// --- Advanced Query & Result Types ---

// A query description that uses schema classes directly
export type QueryDescription<
  A extends readonly AnyComponentSchema[] = readonly AnyComponentSchema[],
  N extends readonly AnyComponentSchema[] = readonly AnyComponentSchema[],
> = {
  readonly all?: A;
  readonly not?: N;
};

// Utility to get the lowercase tag name for a schema
type ComponentTagName<S extends AnyComponentSchema> = Uncapitalize<
  ComponentType<S>["_tag"]
>;

// Utility to create the SoA property name (e.g., "positions")
type SoAPropertyName<S extends AnyComponentSchema> = `${ComponentTagName<S>}s`;

// Utility to create the SoA storage type for a single component
type ComponentSoA<S extends AnyComponentSchema> = {
  readonly [P in keyof Omit<
    ComponentType<S>,
    "_tag"
  >]: readonly ComponentType<S>[P][];
};

// Dynamically creates the full SoA result type from a list of component schemas
type SoAResultBody<A extends readonly AnyComponentSchema[]> = {
  readonly [K in keyof A as SoAPropertyName<
    A[K] & AnyComponentSchema
  >]: ComponentSoA<A[K] & AnyComponentSchema>;
};

// The final, strongly-typed result of a querySoA call
export type SoAQueryResult<A extends readonly AnyComponentSchema[]> = {
  readonly entities: readonly EntityId[];
} & SoAResultBody<A>;

// --- Concrete Queries ---

export const playerQuery = {
  all: [Player, Position, Velocity, CameraState, InputState],
} as const;
export const physicsQuery = { all: [Position, Velocity, Gravity] } as const;
export const playerColliderQuery = {
  all: [Player, Position, Velocity, Collider],
} as const;
export const positionColliderQuery = { all: [Position, Collider] } as const;
export const sceneQuery = { all: [Position, Renderable] } as const;
export const terrainQuery = { all: [TerrainBlock, Chunk] } as const;
export const instancedRenderableQuery = {
  all: [InstancedMeshRenderable, Position],
} as const;
