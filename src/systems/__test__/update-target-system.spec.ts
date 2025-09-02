import { describe, it, expect, beforeEach } from 'vitest';
import { createWorld, type World } from '@/domain/world';
import { createEntity } from '@/domain/entity';
import { PlayerComponent, RaycastResultComponent, TargetComponent } from '@/domain/components';
import { updateTargetSystem } from '../update-target-system';
import { isSome, some } from '@/domain/types';

describe('updateTargetSystem', () => {
  let world: World;
  let player: number;

  beforeEach(() => {
    world = createWorld();
    player = createEntity();
    world.addComponent(player, PlayerComponent, {});
  });

  it('should add a target component if one does not exist', () => {
    const raycastResult = {
      point: { x: 0.5, y: 0.5, z: 0.5 },
      face: some([0, 1, 0]),
    };
    world.addComponent(createEntity(), RaycastResultComponent, raycastResult);

    updateTargetSystem(world);

    const target = world.getComponent(player, TargetComponent);
    expect(isSome(target)).toBe(true);
    if (isSome(target)) {
      expect(target.value.position).toEqual([0, 0, 0]);
    }
  });

  it('should update the target component if one already exists', () => {
    const initialTarget = {
      id: createEntity(),
      position: [1, 1, 1],
      face: [0, -1, 0],
    };
    world.addComponent(player, TargetComponent, initialTarget);

    const raycastResult = {
      point: { x: 2.5, y: 2.5, z: 2.5 },
      face: some([0, 1, 0]),
    };
    world.addComponent(createEntity(), RaycastResultComponent, raycastResult);

    updateTargetSystem(world);

    const target = world.getComponent(player, TargetComponent);
    expect(isSome(target)).toBe(true);
    if (isSome(target)) {
      expect(target.value.position).toEqual([2, 2, 2]);
      expect(target.value.id).not.toBe(initialTarget.id);
    }
  });

  it('should remove the target component if the raycast result is empty', () => {
    const initialTarget = {
      id: createEntity(),
      position: [1, 1, 1],
      face: [0, -1, 0],
    };
    world.addComponent(player, TargetComponent, initialTarget);

    world.addComponent(createEntity(), RaycastResultComponent, {});

    updateTargetSystem(world);

    const target = world.getComponent(player, TargetComponent);
    expect(isSome(target)).toBe(false);
  });
});