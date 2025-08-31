import { describe, expect, it } from 'vitest';
import { EntityId } from './entity';

describe('EntityId', () => {
  it('should create a branded EntityId', () => {
    const id = 'some-unique-id';
    const entityId = EntityId(id);
    expect(entityId).toBe(id);
  });

  it('should prevent assigning a plain string to a function expecting EntityId', () => {
    const id: string = 'some-id';
    const entityId: EntityId = EntityId(id);

    const processEntity = (id: EntityId): string => `processed-${id}`;
    expect(processEntity(entityId)).toBe(`processed-${id}`);

    // @ts-expect-error - This is a type-level check.
    // A plain string should not be assignable to EntityId.
    processEntity(id);
    // We don't test the runtime behavior here as it's a compile-time guarantee.
  });
});
