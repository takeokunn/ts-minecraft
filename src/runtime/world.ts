import { Context, Effect, Layer, Ref, Schema } from 'effect';
import {
  CameraStateSchema,
  ChunkSchema,
  ColliderSchema,
  GravitySchema,
  InputStateSchema,
  PlayerSchema,
  PositionSchema,
  RenderableSchema,
  TerrainBlockSchema,
  VelocitySchema,
  type CameraState,
  type Chunk,
  type Collider,
  type Gravity,
  type InputState,
  type Player,
  type Position,
  type Renderable,
  type TerrainBlock,
  type Velocity,
} from '../domain/components';
import { EntityId } from '../domain/entity';

// A generic component type
export type Component =
  | Position
  | Velocity
  | Renderable
  | Player
  | InputState
  | Gravity
  | CameraState
  | TerrainBlock
  | Collider
  | Chunk;

export const ComponentSchema = Schema.Union(
  PositionSchema,
  VelocitySchema,
  RenderableSchema,
  PlayerSchema,
  InputStateSchema,
  GravitySchema,
  CameraStateSchema,
  TerrainBlockSchema,
  ColliderSchema,
  ChunkSchema,
);

// The WorldState holds all entities and their components
export interface WorldState {
  readonly entities: Map<EntityId, Set<Component>>;
}

// The World service is a Ref holding the WorldState
export interface World extends Ref.Ref<WorldState> {}
export const World: Context.Tag<World, World> =
  Context.GenericTag<World>('@services/World');

// Live implementation of the World service using Ref
export const WorldLive: Layer.Layer<World> = Layer.effect(
  World,
  Ref.make<WorldState>({ entities: new Map() }),
);

// --- Operations ---

/**
 * Creates a new entity with the given components.
 */
export const createEntity = (
  ...components: Component[]
): Effect.Effect<EntityId, never, World> =>
  Effect.gen(function* (_) {
    const worldRef: World = yield* _(World);
    const entityId: EntityId = EntityId(crypto.randomUUID());
    const componentSet: Set<Component> = new Set(components);

    yield* _(
      Ref.update(worldRef, (state: WorldState) => ({
        ...state,
        entities: new Map(state.entities).set(entityId, componentSet),
      })),
    );

    return entityId;
  });

/**
 * Retrieves all components for a given entity.
 */
export const getEntity = (
  id: EntityId,
): Effect.Effect<ReadonlySet<Component> | undefined, never, World> =>
  Effect.gen(function* (_) {
    const worldRef: World = yield* _(World);
    const state: WorldState = yield* _(Ref.get(worldRef));
    return state.entities.get(id);
  });

/**
 * The result of a query for a single entity.
 * Provides a strongly-typed `get` method to retrieve components.
 */
export type QueryResult<T extends ReadonlyArray<Schema.Schema.Any>> = {
  id: EntityId;
  get: <S extends T[number]>(schema: S) => Schema.Schema.Type<S>;
};

/**
 * Queries for entities that have all the specified components.
 */
export const query = <T extends ReadonlyArray<Schema.Schema.Any>>(
  ...schemas: T
): Effect.Effect<ReadonlyArray<QueryResult<T>>, never, World> =>
  Effect.gen(function* (_) {
    const worldRef: World = yield* _(World);
    const state: WorldState = yield* _(Ref.get(worldRef));
    const results: QueryResult<T>[] = [];

    // Extract the string literal tag from each schema's AST
    const componentTags: string[] = schemas.map(
      (s) => (s.ast as any).propertySignatures[0].type.literal,
    );

    for (const [id, components] of state.entities.entries()) {
      const componentMap: Map<string, Component> = new Map<string, Component>();
      for (const component of components) {
        componentMap.set(component._tag, component);
      }

      // Check if the entity has all the required component tags
      if (componentTags.every((tag: string) => componentMap.has(tag))) {
        results.push({
          id,
          get: <S extends T[number]>(schema: S): Schema.Schema.Type<S> => {
            const tag = (schema.ast as any).propertySignatures[0].type.literal;
            return componentMap.get(tag) as Schema.Schema.Type<S>;
          },
        });
      }
    }

    return results;
  });

/**
 * Deletes an entity and all its components from the world.
 */
export const deleteEntity = (id: EntityId): Effect.Effect<void, never, World> =>
  Effect.gen(function* (_) {
    const worldRef: World = yield* _(World);
    yield* _(
      Ref.update(worldRef, (state: WorldState) => {
        const newEntities = new Map(state.entities);
        newEntities.delete(id);
        return { ...state, entities: newEntities };
      }),
    );
  });

/**
 * Updates a component for a given entity.
 * If the component does not exist, it will be added.
 */
export const updateComponent = <C extends Component>(
  id: EntityId,
  component: C,
): Effect.Effect<void, never, World> =>
  Effect.gen(function* (_) {
    const worldRef: World = yield* _(World);
    yield* _(
      Ref.update(worldRef, (state: WorldState) => {
        const entities: Map<EntityId, Set<Component>> = new Map(state.entities);
        const components = entities.get(id);
        if (components) {
          const newComponents: Set<Component> = new Set(
            [...components].filter((c) => c._tag !== component._tag),
          );
          newComponents.add(component);
          entities.set(id, newComponents);
        }
        return { ...state, entities };
      }),
    );
  });

/**
 * Retrieves a single component for a given entity.
 */
export const getComponent = <S extends Schema.Schema.Any>(
  id: EntityId,
  schema: S,
): Effect.Effect<Schema.Schema.Type<S> | undefined, never, World> =>
  Effect.gen(function* (_) {
    const entity: ReadonlySet<Component> | undefined = yield* _(getEntity(id));
    if (!entity) return undefined;

    const tag = (schema.ast as any).propertySignatures[0].type.literal;
    for (const component of entity) {
      if (component._tag === tag) {
        return component as Schema.Schema.Type<S>;
      }
    }
    return undefined;
  });
