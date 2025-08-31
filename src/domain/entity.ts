import { Brand } from "effect";
import type { Component } from './components';

export type EntityId = Brand.Branded<string, "EntityId">;
export const EntityId = Brand.nominal<EntityId>();


export type Entity = {
  readonly id: EntityId;
  readonly components: Map<string, Component>;
};

export const createEntity = (id: EntityId, components: Component[]): Entity => ({
  id,
  components: new Map(components.map((c) => [c._tag, c])),
});

export const addComponent = (entity: Entity, component: Component): Entity => ({
  ...entity,
  components: new Map(entity.components).set(component._tag, component),
});

export const removeComponent = (entity: Entity, componentTag: string): Entity => {
  const newComponents = new Map(entity.components);
  newComponents.delete(componentTag);
  return {
    ...entity,
    components: newComponents,
  };
};

export const hasComponent = (entity: Entity, componentTag: string): boolean => {
  return entity.components.has(componentTag);
};

export const getComponent = <T extends Component>(
  entity: Entity,
  componentTag: T["_tag"],
): T | undefined => {
  return entity.components.get(componentTag) as T | undefined;
};

export const getComponentUnsafe = <T extends Component>(
  entity: Entity,
  componentTag: T["_tag"],
): T => {
  const component = entity.components.get(componentTag) as T | undefined;
  if (!component) {
    throw new Error(`Component ${componentTag} not found on entity ${entity.id}`);
  }
  return component;
};

export type QueryResult<T extends Component[]> = {
  entity: Entity;
  components: T;
};

export const query = <T extends Component["_tag"][]>(
  entities: Map<EntityId, Entity>,
  componentTags: T,
): QueryResult<{ [K in keyof T]: Extract<Component, { _tag: T[K] }> }>[] => {
  const result: QueryResult<{ [K in keyof T]: Extract<Component, { _tag: T[K] }> }>[] = [];
  for (const entity of entities.values()) {
    if (componentTags.every((tag) => hasComponent(entity, tag))) {
      const components = componentTags.map((tag) => getComponentUnsafe(entity, tag)) as { [K in keyof T]: Extract<Component, { _tag: T[K] }> };
      result.push({ entity, components });
    }
  }
  return result;
};

export const queryFirst = <T extends Component["_tag"][]>(
  entities: Map<EntityId, Entity>,
  componentTags: T,
): QueryResult<{ [K in keyof T]: Extract<Component, { _tag: T[K] }> }> | undefined => {
  for (const entity of entities.values()) {
    if (componentTags.every((tag) => hasComponent(entity, tag))) {
      const components = componentTags.map((tag) => getComponentUnsafe(entity, tag)) as { [K in keyof T]: Extract<Component, { _tag: T[K] }> };
      return { entity, components };
    }
  }
  return undefined;
};

export type World = {
  readonly entities: Map<EntityId, Entity>;
};

export const createWorld = (): World => {
  const entities = new Map<EntityId, Entity>();
  return {
    entities,
  };
};

export const addEntity = (world: World, entity: Entity): void => {
  world.entities.set(entity.id, entity);
};

export const removeEntity = (world: World, entityId: EntityId): void => {
  world.entities.delete(entityId);
};

export const getEntity = (world: World, entityId: EntityId): Entity | undefined => {
  return world.entities.get(entityId);
};

export const getEntities = (world: World): IterableIterator<Entity> => {
  return world.entities.values();
};

export const getEntitiesWithComponents = <T extends Component["_tag"][]>(
  world: World,
  componentTags: T,
): QueryResult<{ [K in keyof T]: Extract<Component, { _tag: T[K] }> }>[] => {
  return query(world.entities, componentTags);
};

export const getEntityWithComponents = <T extends Component["_tag"][]>(
  world: World,
  componentTags: T,
): QueryResult<{ [K in keyof T]: Extract<Component, { _tag: T[K] }> }> | undefined => {
  return queryFirst(world.entities, componentTags);
};
