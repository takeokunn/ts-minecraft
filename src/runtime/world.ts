import { Archetype } from '@/domain/archetypes';
import { PlacedBlock } from '@/domain/block';
import { componentNames, ComponentName, Components } from '@/domain/components';
import { EntityId, toEntityId, fromEntityId } from '@/domain/entity';
import { Query } from '@/domain/query';
import { RaycastResult } from '@/infrastructure/raycast-three';
import { createSpatialGrid, SpatialGrid } from '@/infrastructure/spatial-grid';

// --- Types ---

export type World = {
  readonly nextEntityId: EntityId;
  readonly entities: ReadonlySet<EntityId>;
  readonly components: {
    readonly [K in ComponentName]: ReadonlyMap<EntityId, Components[K]>;
  };
  readonly globalState: {
    readonly scene: 'Title' | 'InGame' | 'Paused';
    readonly seeds: {
      readonly world: number;
      readonly biome: number;
      readonly trees: number;
    };
    readonly amplitude: number;
    readonly editedBlocks: {
      readonly placed: { readonly [key: string]: PlacedBlock };
      readonly destroyed: ReadonlySet<string>;
    };
    readonly spatialGrid: SpatialGrid;
    readonly chunkLoading: {
      readonly lastPlayerChunk: { readonly x: number; readonly z: number } | null;
      readonly loadedChunks: ReadonlyMap<string, EntityId>;
    };
    readonly raycastResult: RaycastResult | null;
  };
};

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

// --- World Creation ---

export const createWorld = (): World => {
  const components = Object.fromEntries(
    componentNames.map(name => [name, new Map()]),
  ) as unknown as World['components'];

  return {
    nextEntityId: toEntityId(0),
    entities: new Set(),
    components,
    globalState: {
      scene: 'Title',
      seeds: { world: 1, biome: 2, trees: 3 },
      amplitude: 20,
      editedBlocks: {
        placed: {},
        destroyed: new Set(),
      },
      chunkLoading: {
        lastPlayerChunk: null,
        loadedChunks: new Map(),
      },
      spatialGrid: createSpatialGrid(),
      raycastResult: null,
    },
  };
};

// --- Entity & Component Operations (Purely Functional) ---

export const addArchetype = (
  world: World,
  archetype: Archetype,
): readonly [World, EntityId] => {
  const entityId = world.nextEntityId;

  const newEntities = new Set(world.entities);
  newEntities.add(entityId);

  const newComponents: Mutable<World['components']> = { ...world.components };
  for (const key in archetype) {
    const componentName = key as ComponentName;
    const componentData = archetype[componentName];
    if (componentData) {
      const newMap = new Map(world.components[componentName]);
      newMap.set(entityId, componentData as any); // Using 'any' here is a pragmatic choice to avoid complex generic issues.
      (newComponents as any)[componentName] = newMap;
    }
  }

  return [
    {
      ...world,
      nextEntityId: toEntityId(fromEntityId(entityId) + 1),
      entities: newEntities,
      components: newComponents,
    },
    entityId,
  ] as const;
};

export const removeEntity = (world: World, id: EntityId): World => {
  if (!world.entities.has(id)) {
    return world;
  }

  const newEntities = new Set(world.entities);
  newEntities.delete(id);

  const newComponents: Mutable<World['components']> = { ...world.components };
  for (const name of componentNames) {
    if (world.components[name].has(id)) {
      const newMap = new Map(world.components[name]);
      newMap.delete(id);
      (newComponents as any)[name] = newMap;
    }
  }

  return {
    ...world,
    entities: newEntities,
    components: newComponents,
  };
};

export const getComponent = <T extends ComponentName>(
  world: World,
  entityId: EntityId,
  componentName: T,
): Components[T] | undefined => {
  return world.components[componentName].get(entityId) as
    | Components[T]
    | undefined;
};

export const updateComponent = <T extends ComponentName>(
  world: World,
  entityId: EntityId,
  componentName: T,
  componentData: Components[T],
): World => {
  if (!world.entities.has(entityId)) {
    return world;
  }

  const newComponentMap = new Map(world.components[componentName]);
  newComponentMap.set(entityId, componentData);

  return {
    ...world,
    components: {
      ...world.components,
      [componentName]: newComponentMap,
    },
  };
};

// --- Querying ---

type QueryResult<T extends ReadonlyArray<ComponentName>> = {
  readonly entityId: EntityId;
} & {
  readonly [K in T[number]]: Components[K];
};

export function query<T extends ReadonlyArray<ComponentName>>(
  world: World,
  queryDef: Query,
): ReadonlyArray<QueryResult<T>> {
  const { components: queryComponents } = queryDef;

  if (queryComponents.length === 0) {
    return Array.from(world.entities).map(
      entityId => ({ entityId }) as unknown as QueryResult<T>,
    );
  }

  const sortedComponents = [...queryComponents].sort(
    (a, b) => world.components[a].size - world.components[b].size,
  );

  const smallestMap = world.components[sortedComponents[0]!];
  const otherKeys = sortedComponents.slice(1);
  const results: QueryResult<T>[] = [];

  for (const entityId of smallestMap.keys()) {
    const hasAllComponents = otherKeys.every(key =>
      world.components[key].has(entityId),
    );

    if (hasAllComponents) {
      const result = { entityId } as any;
      for (const key of queryComponents) {
        result[key] = world.components[key].get(entityId)!;
      }
      results.push(result);
    }
  }

  return results;
}
