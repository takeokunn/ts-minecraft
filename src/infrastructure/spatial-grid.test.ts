import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { createSpatialGrid } from './spatial-grid';
import type { AABB } from '../domain/types';
import { EntityId } from '@/domain/entity';

const aabbArbitrary: fc.Arbitrary<AABB> = fc
  .record({
    minX: fc.float({ min: -100, max: 100, noNaN: true }),
    minY: fc.float({ min: -100, max: 100, noNaN: true }),
    minZ: fc.float({ min: -100, max: 100, noNaN: true }),
    width: fc.float({ min: 0.1, max: 50, noNaN: true }),
    height: fc.float({ min: 0.1, max: 50, noNaN: true }),
    depth: fc.float({ min: 0.1, max: 50, noNaN: true }),
  })
  .map(({ minX, minY, minZ, width, height, depth }) => ({
    minX,
    minY,
    minZ,
    maxX: minX + width,
    maxY: minY + height,
    maxZ: minZ + depth,
  }));

const entityIdArbitrary = fc.integer({ min: 0, max: 1_000_000 }).map(id => id as EntityId);

describe('infrastructure/spatial-grid', () => {
  it('should find an entity when its AABB is queried', () => {
    fc.assert(
      fc.property(entityIdArbitrary, aabbArbitrary, (entityId, aabb) => {
        const grid = createSpatialGrid();
        grid.register(entityId, aabb);
        const results = grid.query(aabb);
        expect(results).toContain(entityId);
      }),
    );
  });

  it('should find an entity when query AABB partially overlaps', () => {
    fc.assert(
      fc.property(entityIdArbitrary, aabbArbitrary, (entityId, aabb) => {
        const queryAABB: AABB = {
          minX: aabb.minX - 1,
          minY: aabb.minY - 1,
          minZ: aabb.minZ - 1,
          maxX: aabb.minX + 1,
          maxY: aabb.minY + 1,
          maxZ: aabb.minZ + 1,
        };
        const grid = createSpatialGrid();
        grid.register(entityId, aabb);
        const results = grid.query(queryAABB);
        expect(results).toContain(entityId);
      }),
    );
  });

  it('should find an entity when query AABB is fully contained within it', () => {
    fc.assert(
      fc.property(entityIdArbitrary, aabbArbitrary, (entityId, aabb) => {
        const queryAABB: AABB = {
          minX: aabb.minX + 0.1,
          minY: aabb.minY + 0.1,
          minZ: aabb.minZ + 0.1,
          maxX: aabb.minX + 0.2,
          maxY: aabb.minY + 0.2,
          maxZ: aabb.minZ + 0.2,
        };
        const grid = createSpatialGrid();
        grid.register(entityId, aabb);
        const results = grid.query(queryAABB);
        expect(results).toContain(entityId);
      }),
    );
  });

  it('should not find an entity in a non-overlapping AABB', () => {
    fc.assert(
      fc.property(
        entityIdArbitrary,
        aabbArbitrary,
        fc.float({ min: 1, max: 100, noNaN: true }),
        (entityId, aabb, gap) => {
          const queryAABB: AABB = {
            minX: aabb.maxX + gap,
            minY: aabb.maxY + gap,
            minZ: aabb.maxZ + gap,
            maxX: aabb.maxX + gap + 1,
            maxY: aabb.maxY + gap + 1,
            maxZ: aabb.maxZ + gap + 1,
          };
          const grid = createSpatialGrid();
          grid.register(entityId, aabb);
          const results = grid.query(queryAABB);
          expect(results).not.toContain(entityId);
        },
      ),
    );
  });

  it('should return each entity ID only once', () => {
    fc.assert(
      fc.property(entityIdArbitrary, aabbArbitrary, (entityId, aabb) => {
        const queryAABB: AABB = {
          minX: aabb.minX - 1,
          minY: aabb.minY - 1,
          minZ: aabb.minZ - 1,
          maxX: aabb.maxX + 1,
          maxY: aabb.maxY + 1,
          maxZ: aabb.maxZ + 1,
        };
        const grid = createSpatialGrid();
        grid.register(entityId, aabb);
        const results = grid.query(queryAABB);
        const occurrences = results.filter(id => id === entityId).length;
        expect(occurrences).toBe(1);
      }),
    );
  });

  it('should remove all entities after clear', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: entityIdArbitrary, aabb: aabbArbitrary }), {
          minLength: 1,
          maxLength: 10,
        }),
        entities => {
          const grid = createSpatialGrid();
          for (const { id, aabb } of entities) {
            grid.register(id, aabb);
          }
          grid.clear();
          const results = grid.query({
            minX: -2000,
            minY: -2000,
            minZ: -2000,
            maxX: 2000,
            maxY: 2000,
            maxZ: 2000,
          });
          expect(results).toHaveLength(0);
        },
      ),
    );
  });
});
