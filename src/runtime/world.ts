import { Components, ComponentName, componentNames } from '@/domain/components';
import { EntityId } from '@/domain/entity';
import { Query } from '@/domain/query';

type ComponentStore = {
  [K in ComponentName]: Map<EntityId, Components[K]>;
};

type QueryResult<T extends Query> = Array<{
  entityId: EntityId;
} & {
  [K in T['components'][number]]: Components[K];
}>;

export class World {
  private nextEntityId: EntityId = 0;
  private entities: Set<EntityId> = new Set();
  private componentStore: ComponentStore = Object.fromEntries(
    componentNames.map(name => [name, new Map()]),
  ) as ComponentStore;

  createEntity(): EntityId {
    const eid = this.nextEntityId++;
    this.entities.add(eid);
    return eid;
  }

  removeEntity(eid: EntityId): void {
    this.entities.delete(eid);
    for (const name of componentNames) {
      this.componentStore[name].delete(eid);
    }
  }

  setComponent<C extends ComponentName>(eid: EntityId, componentName: C, data: Components[C]): void {
    if (this.entities.has(eid)) {
      this.componentStore[componentName].set(eid, data);
    }
  }

  getComponent<C extends ComponentName>(eid: EntityId, componentName: C): Components[C] | undefined {
    return this.componentStore[componentName].get(eid);
  }

  query<T extends Query>(query: T): QueryResult<T> {
    const results: QueryResult<T> = [];
    for (const eid of this.entities) {
      let match = true;
      for (const componentName of query.components) {
        if (!this.componentStore[componentName].has(eid)) {
          match = false;
          break;
        }
      }

      if (match) {
        const components = {} as { [K in T['components'][number]]: Components[K] };
        for (const componentName of query.components) {
          components[componentName] = this.componentStore[componentName].get(eid)!;
        }
        results.push({ entityId: eid, ...components });
      }
    }
    return results;
  }
}