import { BlockType, hotbarSlots } from './block';
import type { Components, Position, Hotbar } from './components';

type Archetype = Partial<Components>;

export function getPlayerArchetype(pos: Position): Archetype {
  const hotbar = hotbarSlots.reduce(
    (acc, block, i) => {
      acc[`slot${i}` as keyof Omit<Hotbar, 'selectedSlot'>] = block;
      return acc;
    },
    { selectedSlot: 0 } as Components['hotbar'],
  );

  return {
    player: { isGrounded: false },
    position: pos,
    velocity: { dx: 0, dy: 0, dz: 0 },
    gravity: { value: 0.01 },
    cameraState: { pitch: 0, yaw: 0 },
    inputState: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
      destroy: false,
    },
    collider: {
      width: 0.6,
      height: 1.8,
      depth: 0.6,
    },
    hotbar,
    target: {
      entityId: -1,
      faceX: 0,
      faceY: 0,
      faceZ: 0,
    },
  };
}

export function getBlockArchetype(
  pos: Position,
  blockType: BlockType,
): Archetype {
  return {
    position: pos,
    renderable: {
      geometry: 'box',
      blockType,
    },
    collider: { width: 1, height: 1, depth: 1 },
  };
}

export type PlayerArchetype = ReturnType<typeof getPlayerArchetype>;
export type BlockArchetype = ReturnType<typeof getBlockArchetype>;