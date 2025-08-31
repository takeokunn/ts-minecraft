import { describe, expect, it } from 'vitest';
import { Entity, EntityId } from './entity';

describe('Entity', () => {
  it('should create a unique EntityId', () => {
    const entityId1 = Entity.make();
    const entityId2 = Entity.make();
    expect(entityId1).not.toBe(entityId2);
    expect(typeof entityId1).toBe('string');
  });

  it('should prevent assigning a plain string to a function expecting EntityId', () => {
    const id: string = 'some-id';
    const entityId: EntityId = Entity.make();

    const processEntity = (id: EntityId): string => `processed-${id}`;
    expect(processEntity(entityId)).toBe(`processed-${entityId}`);

    // This is a type-level check. A plain string should not be assignable to EntityId.
    // @ts-expect-error
    processEntity(id);
  });
});
