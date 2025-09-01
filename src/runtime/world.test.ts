import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { World } from './world';
import {
  Position,
  Velocity,
  Player,
  InputState,
  CameraState,
  Hotbar,
  componentNames,
  Components,
  ComponentName,
} from '@/domain/components';
import { playerQuery } from '@/domain/queries';
import { EntityId } from '@/domain/entity';

const positionArb = fc.record({ x: fc.float(), y: fc.float(), z: fc.float() });
const velocityArb = fc.record({ dx: fc.float(), dy: fc.float(), dz: fc.float() });
const playerArb = fc.record({ isGrounded: fc.boolean() });
const inputStateArb = fc.record({
  forward: fc.boolean(),
  backward: fc.boolean(),
  left: fc.boolean(),
  right: fc.boolean(),
  jump: fc.boolean(),
  sprint: fc.boolean(),
  place: fc.boolean(),
  destroy: fc.boolean(),
});
const cameraStateArb = fc.record({ pitch: fc.float(), yaw: fc.float() });
const hotbarArb = fc.record({
  slot0: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  slot1: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  slot2: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  slot3: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  slot4: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  slot5: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  slot6: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  slot7: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  slot8: fc.constantFrom(
    'grass',
    'dirt',
    'stone',
    'cobblestone',
    'oakLog',
    'oakLeaves',
    'sand',
    'water',
    'glass',
    'brick',
    'plank',
  ),
  selectedSlot: fc.integer({ min: 0, max: 8 }),
});

const componentArb: fc.Arbitrary<{ name: ComponentName; data: Components[ComponentName] }> =
  fc.oneof(
    positionArb.map(p => ({ name: 'position' as const, data: p })),
    velocityArb.map(v => ({ name: 'velocity' as const, data: v })),
    playerArb.map(p => ({ name: 'player' as const, data: p })),
    inputStateArb.map(i => ({ name: 'inputState' as const, data: i })),
    cameraStateArb.map(c => ({ name: 'cameraState' as const, data: c })),
    hotbarArb.map(h => ({ name: 'hotbar' as const, data: h })),
  );

describe('runtime/world', () => {
  it('createEntity should return unique entity IDs', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    expect(e1).not.toEqual(e2);
  });

  it('setComponent and getComponent should store and retrieve data', () => {
    fc.assert(
      fc.property(componentArb, ({ name, data }) => {
        const world = new World();
        const eid = world.createEntity();
        world.setComponent(eid, name, data);
        const result = world.getComponent(eid, name);
        expect(result).toEqual(data);
      }),
    );
  });

  it('removeEntity should make an entity and its components inaccessible', () => {
    fc.assert(
      fc.property(componentArb, ({ name, data }) => {
        const world = new World();
        const eid = world.createEntity();
        world.setComponent(eid, name, data);
        world.removeEntity(eid);
        const pos = world.getComponent(eid, name);
        const queryResult = world.query({ name: 'test', components: [name] });
        expect(pos).toBeUndefined();
        expect(queryResult.find(r => r.entityId === eid)).toBeUndefined();
      }),
    );
  });

  describe('query', () => {
    it('should only return entities that match the query', () => {
      const world = new World();
      const e1 = world.createEntity();
      world.setComponent(e1, 'position', { x: 1, y: 1, z: 1 });

      const e2 = world.createEntity();
      world.setComponent(e2, 'position', { x: 2, y: 2, z: 2 });
      world.setComponent(e2, 'velocity', { dx: 1, dy: 1, dz: 1 });

      const e3 = world.createEntity();
      world.setComponent(e3, 'player', { isGrounded: true });
      world.setComponent(e3, 'position', { x: 3, y: 3, z: 3 });
      world.setComponent(e3, 'velocity', { dx: 1, dy: 1, dz: 1 });
      world.setComponent(e3, 'inputState', {} as InputState);
      world.setComponent(e3, 'cameraState', {} as CameraState);
      world.setComponent(e3, 'hotbar', {} as Hotbar);

      const results = world.query(playerQuery);
      expect(results.length).toBe(1);
      expect(results[0]?.entityId).toBe(e3);
    });

    it('should return correct components for a matched entity', () => {
      const world = new World();
      const eid = world.createEntity();
      const position: Position = { x: 1, y: 2, z: 3 };
      const velocity: Velocity = { dx: 4, dy: 5, dz: 6 };
      const player: Player = { isGrounded: false };
      const inputState: InputState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false,
      };
      const cameraState: CameraState = { pitch: 0, yaw: 0 };
      const hotbar: Hotbar = {
        slot0: 'grass',
        slot1: 'dirt',
        slot2: 'stone',
        slot3: 'cobblestone',
        slot4: 'oakLog',
        slot5: 'plank',
        slot6: 'glass',
        slot7: 'brick',
        slot8: 'sand',
        selectedSlot: 0,
      };

      world.setComponent(eid, 'position', position);
      world.setComponent(eid, 'velocity', velocity);
      world.setComponent(eid, 'player', player);
      world.setComponent(eid, 'inputState', inputState);
      world.setComponent(eid, 'cameraState', cameraState);
      world.setComponent(eid, 'hotbar', hotbar);

      const results = world.query(playerQuery);
      expect(results.length).toBe(1);
      const result = results[0];
      expect(result?.entityId).toBe(eid);
      expect(result?.position).toEqual(position);
      expect(result?.velocity).toEqual(velocity);
      expect(result?.player).toEqual(player);
    });
  });
});
