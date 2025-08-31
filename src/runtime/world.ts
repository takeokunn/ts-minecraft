import { ComponentAny } from "@/domain/components";
import { Entity, EntityId } from "@/domain/entity";
import { Schema } from "@effect/schema";
import {
  Context,
  Effect,
  Layer,
  Ref,
  HashMap,
  Option,
  Chunk,
  Order,
} from "effect";
import { pipe } from "effect/Function";

// --- Component Registration ---

// This is a workaround to get component classes from tags for deserialization in query.
if (typeof globalThis !== "undefined") {
  (globalThis as any).componentRegistry = {};
}

export const registerComponent =
  <T extends new (...args: any) => any>(c: T): T => {
    if (typeof globalThis !== "undefined") {
      const tag = (c as any).getTag();
      if (tag) {
        (globalThis as any).componentRegistry[tag] = c;
      }
    }
    return c;
  };

// --- Custom Query Types ---

type ComponentClass<T extends ComponentAny = ComponentAny> = new (
  ...args: any
) => T;

type QueryDescription = {
  all?: ComponentClass[];
  not?: ComponentClass[];
};

type ComponentsOf<T extends ComponentClass[]> = {
  [K in InstanceType<T[number]> as K["_tag"]]: K;
};

export type QueryResult<T extends ComponentClass[]> = ReadonlyMap<
  EntityId,
  ComponentsOf<T>
>;

export type QueryResultSingle<T extends ComponentClass[]> = readonly [
  EntityId,
  ComponentsOf<T>,
];

// --- Archetype ---

type ComponentTag = string;
type ArchetypeId = string;
type Archetype = {
  id: ArchetypeId;
  tags: Set<ComponentTag>;
  entities: EntityId[]; // Use array for dense storage
};

const createArchetypeId = (tags: Iterable<ComponentTag>): ArchetypeId => {
  return Array.from(tags).sort().join("-");
};

// --- Service Interface ---

export interface World {
  readonly createEntity: (
    ...components: ComponentAny[]
  ) => Effect.Effect<EntityId>;
  readonly removeEntity: (id: EntityId) => Effect.Effect<void>;
  readonly addComponent: (
    id: EntityId,
    component: ComponentAny,
  ) => Effect.Effect<void>;
  readonly removeComponent: <A extends ComponentAny>(
    id: EntityId,
    componentClass: new (...args: any) => A,
  ) => Effect.Effect<void>;
  readonly updateComponent: (
    id: EntityId,
    component: ComponentAny,
  ) => Effect.Effect<void>;
  readonly getComponent: <A extends ComponentAny>(
    id: EntityId,
    componentClass: new (...args: any) => A,
  ) => Effect.Effect<Option.Option<A>>;
  readonly query: <T extends ComponentClass[]>(
    ...query: T | [QueryDescription]
  ) => Effect.Effect<QueryResult<T>>;
  readonly querySingle: <T extends ComponentClass[]>(
    ...query: T | [QueryDescription]
  ) => Effect.Effect<Option.Option<QueryResultSingle<T>>>;
}

export const World = Context.GenericTag<World>("World");

// --- Live Implementation (SoA) ---

type ComponentSoAStorage = {
  [key: string]: unknown[];
};

type ComponentStorage = HashMap.HashMap<ComponentTag, ComponentSoAStorage>;
type ArchetypeMap = HashMap.HashMap<ArchetypeId, Archetype>;
type EntityLocation = { archetypeId: ArchetypeId; index: number };
type EntityLocationMap = HashMap.HashMap<EntityId, EntityLocation>;

type WorldState = {
  components: ComponentStorage;
  archetypes: ArchetypeMap;
  entityLocations: EntityLocationMap;
};

const InitialWorldState: WorldState = {
  components: HashMap.empty(),
  archetypes: HashMap.empty(),
  entityLocations: HashMap.empty(),
};

export const WorldLive: Layer.Layer<World> = Layer.sync(World, () => {
  const state = Ref.unsafeMake<WorldState>(InitialWorldState);

  // Helper to get a component's schema
  const getComponentSchema = (
    component: ComponentAny,
  ): Option.Option<Schema.Schema.Fields> => {
    return Option.fromNullable(
      (component.constructor as any)[Schema.TypeId],
    ).pipe(Option.map((s) => (s as any).ast.propertySignatures));
  };

  const getComponentClassSchema = <A extends ComponentAny>(
    componentClass: new (...args: any) => A,
  ): Option.Option<Schema.Schema.Fields> => {
    return Option.fromNullable((componentClass as any)[Schema.TypeId]).pipe(
      Option.map((s) => (s as any).ast.propertySignatures),
    );
  };

  const moveEntityToArchetype = (
    id: EntityId,
    newArchetypeId: ArchetypeId,
    newTags: Set<ComponentTag>,
  ): Effect.Effect<void> =>
    Ref.update(state, (s) => {
      let archetypes = s.archetypes;
      const newArchetype = pipe(
        archetypes,
        HashMap.get(newArchetypeId),
        Option.getOrElse(() => ({
          id: newArchetypeId,
          tags: newTags,
          entities: [],
        })),
      );

      const newIndex = newArchetype.entities.length;
      newArchetype.entities.push(id);
      archetypes = HashMap.set(archetypes, newArchetypeId, newArchetype);

      const entityLocations = HashMap.set(s.entityLocations, id, {
        archetypeId: newArchetypeId,
        index: newIndex,
      });

      return { ...s, archetypes, entityLocations };
    });

  const removeEntityFromArchetype = (
    id: EntityId,
    location: EntityLocation,
  ): Effect.Effect<void> =>
    Ref.update(state, (s) => {
      let archetypes = s.archetypes;
      const archetype = HashMap.unsafeGet(archetypes, location.archetypeId);

      const lastEntityId = archetype.entities.pop();
      let entityLocations = s.entityLocations;

      if (lastEntityId && lastEntityId !== id) {
        archetype.entities[location.index] = lastEntityId;
        entityLocations = HashMap.set(entityLocations, lastEntityId, {
          ...HashMap.unsafeGet(entityLocations, lastEntityId),
          index: location.index,
        });
      }

      archetypes = HashMap.set(archetypes, location.archetypeId, archetype);
      entityLocations = HashMap.remove(entityLocations, id);

      return { ...s, archetypes, entityLocations };
    });

  const addComponentToSoA = (
    s: WorldState,
    id: EntityId,
    component: ComponentAny,
    location: EntityLocation,
  ): WorldState => {
    const schema = getComponentSchema(component);
    if (Option.isNone(schema)) return s;

    let componentStorage = s.components;
    let soa = pipe(
      componentStorage,
      HashMap.get(component._tag),
      Option.getOrElse(() =>
        Object.fromEntries(
          Object.keys(schema.value).map((key) => [key, []]),
        ),
      ),
    );

    for (const key of Object.keys(schema.value)) {
      if (location.index === soa[key].length) {
        soa[key].push((component as any)[key]);
      } else {
        soa[key][location.index] = (component as any)[key];
      }
    }

    componentStorage = HashMap.set(componentStorage, component._tag, soa);
    return { ...s, components: componentStorage };
  };

  const removeComponentFromSoA = (
    s: WorldState,
    tag: ComponentTag,
    location: EntityLocation,
  ): WorldState => {
    const soaOpt = HashMap.get(s.components, tag);
    if (Option.isNone(soaOpt)) return s;

    const soa = soaOpt.value;
    const schemaOpt = getComponentClassSchema(
      (globalThis as any).componentRegistry[tag],
    );
    if (Option.isNone(schemaOpt)) return s;

    const lastIndex = Object.values(soa)[0].length - 1;

    for (const key of Object.keys(schemaOpt.value)) {
      soa[key][location.index] = soa[key][lastIndex];
      soa[key].pop();
    }

    const components = HashMap.set(s.components, tag, soa);
    return { ...s, components };
  };

  const updateComponentEffect = (
    id: EntityId,
    component: ComponentAny,
  ): Effect.Effect<void> =>
    Ref.update((s) => {
      const locationOpt = HashMap.get(s.entityLocations, id);
      if (Option.isNone(locationOpt)) return s;

      const schema = getComponentSchema(component);
      if (Option.isNone(schema)) return s;

      const soaOpt = HashMap.get(s.components, component._tag);
      if (Option.isNone(soaOpt)) return s;

      const soa = soaOpt.value;
      for (const key of Object.keys(schema.value)) {
        soa[key][locationOpt.value.index] = (component as any)[key];
      }

      const components = HashMap.set(s.components, component._tag, soa);
      return { ...s, components };
    });

  const self: World = {
    createEntity: (...components: ComponentAny[]) =>
      Effect.gen(function* (_) {
        const entityId = Entity.make();
        const tags = new Set(components.map((c) => c._tag));
        const archetypeId = createArchetypeId(tags);

        yield* _(moveEntityToArchetype(entityId, archetypeId, tags));
        yield* _(
          Ref.update((s) => {
            const location = HashMap.unsafeGet(s.entityLocations, entityId);
            let newState = s;
            for (const c of components) {
              newState = addComponentToSoA(newState, entityId, c, location);
            }
            return newState;
          }),
        );
        return entityId;
      }),

    removeEntity: (id: EntityId) =>
      Effect.gen(function* (_) {
        const s = yield* _(Ref.get(state));
        const locationOpt = HashMap.get(s.entityLocations, id);
        if (Option.isNone(locationOpt)) return;

        const location = locationOpt.value;
        const archetype = HashMap.unsafeGet(s.archetypes, location.archetypeId);

        yield* _(removeEntityFromArchetype(id, location));
        yield* _(
          Ref.update((s) => {
            let newState = s;
            for (const tag of archetype.tags) {
              newState = removeComponentFromSoA(newState, tag, location);
            }
            return newState;
          }),
        );
      }),

    addComponent: (id, component) =>
      Effect.logWarning(
        "addComponent is not fully implemented in SoA world yet.",
      ),

    removeComponent: <A extends ComponentAny>(
      id: EntityId,
      componentClass: new (...args: any) => A,
    ) =>
      Effect.logWarning(
        "removeComponent is not fully implemented in SoA world yet.",
      ),

    updateComponent: updateComponentEffect,

    getComponent: <A extends ComponentAny>(
      id: EntityId,
      componentClass: new (...args: any) => A,
    ) =>
      Ref.get(state).pipe(
        Effect.map((s) => {
          const tag = (componentClass as any).getTag();
          if (!tag) return Option.none<A>();

          return pipe(
            HashMap.get(s.entityLocations, id),
            Option.flatMap((location) => {
              const soaOpt = HashMap.get(s.components, tag);
              if (Option.isNone(soaOpt)) return Option.none();
              const soa = soaOpt.value;
              const schemaOpt = getComponentClassSchema(componentClass);
              if (Option.isNone(schemaOpt)) return Option.none();

              const componentData = Object.fromEntries(
                Object.keys(schemaOpt.value).map((key) => [
                  key,
                  soa[key][location.index],
                ]),
              );
              return Option.some(new componentClass(componentData) as A);
            }),
          );
        }),
      ),

    query: <T extends ComponentClass[]>(
      ...query: T | [QueryDescription]
    ) =>
      Effect.gen(function* (_) {
        const desc: QueryDescription =
          typeof query[0] === "function"
            ? { all: query as T }
            : (query[0] as QueryDescription);

        const allComponents = desc.all ?? [];
        if (allComponents.length === 0) {
          return new Map();
        }

        const worldState = yield* _(Ref.get(state));
        const allTags = new Set(allComponents.map((c) => c.getTag()));
        const notTags = new Set((desc.not ?? []).map((c) => c.getTag()));

        const results = new Map();

        for (const archetype of worldState.archetypes.values()) {
          const hasAll = Array.from(allTags).every((tag) =>
            archetype.tags.has(tag),
          );
          const hasNone =
            Array.from(notTags).every((tag) => !archetype.tags.has(tag)) ||
            notTags.size === 0;

          if (hasAll && hasNone) {
            for (let i = 0; i < archetype.entities.length; i++) {
              const id = archetype.entities[i];
              const components = Array.from(allTags).reduce(
                (acc, tag) => {
                  const soa = HashMap.unsafeGet(worldState.components, tag);
                  const componentClass = (globalThis as any).componentRegistry[
                    tag
                  ];
                  const schema =
                    getComponentClassSchema(componentClass).pipe(
                      Option.getOrThrow,
                    );

                  const componentData = Object.fromEntries(
                    Object.keys(schema).map((key) => [key, soa[key][i]]),
                  );
                  acc[tag] = new componentClass(componentData);
                  return acc;
                },
                {} as Record<string, ComponentAny>,
              );
              results.set(id, components);
            }
          }
        }

        return results as QueryResult<T>;
      }),

    querySingle: <T extends ComponentClass[]>(
      ...query: T | [QueryDescription]
    ) =>
      self.query(...(query as [T]) | [QueryDescription]).pipe(
        Effect.map((results) => {
          const firstEntry = results.entries().next();
          if (firstEntry.done) {
            return Option.none();
          }
          return Option.some(firstEntry.value as QueryResultSingle<T>);
        }),
      ),
  };
  return self;
});