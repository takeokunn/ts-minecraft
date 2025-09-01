import { Position, setPosition, setVelocity, Velocity } from '@/domain/components';
import { physicsQuery } from '@/domain/queries';
import { FRICTION, TERMINAL_VELOCITY } from '@/domain/world-constants';
import { System } from '@/runtime/loop';
import { query, updateComponent } from '@/runtime/world';

export const integrate = (
  position: Position,
  velocity: Velocity,
  isGrounded: boolean,
  deltaTime: number,
  gravity: number,
): { newPosition: Position; newVelocity: Velocity } => {
  let newVelocity = { ...velocity };

  // Apply gravity if not grounded
  if (!isGrounded) {
    const dy = Math.max(
      -TERMINAL_VELOCITY,
      newVelocity.dy - gravity * deltaTime,
    );
    newVelocity = setVelocity(newVelocity, { dy });
  }

  // Apply friction if grounded
  if (isGrounded) {
    newVelocity = setVelocity(newVelocity, {
      dx: newVelocity.dx * FRICTION,
      dz: newVelocity.dz * FRICTION,
    });
  }

  // Update position based on new velocity
  const newPosition: Position = setPosition(position, {
    x: position.x + newVelocity.dx * deltaTime,
    y: position.y + newVelocity.dy * deltaTime,
    z: position.z + newVelocity.dz * deltaTime,
  });

  return { newPosition, newVelocity };
};

export const physicsSystem: System = (world, { deltaTime }) => {
  if (deltaTime === 0) {
    return [world, []];
  }

  const entities = query(world, physicsQuery);
  if (entities.length === 0) {
    return [world, []];
  }

  const newWorld = entities.reduce((currentWorld, entity) => {
    const { entityId, position, velocity, gravity } = entity;
    // A physics entity might optionally have a player component (for friction/grounded checks)
    const player = currentWorld.components.player.get(entityId);
    const isGrounded = player?.isGrounded ?? false;

    const { newPosition, newVelocity } = integrate(
      position,
      velocity,
      isGrounded,
      deltaTime,
      gravity.value,
    );

    const worldWithNewPos = updateComponent(
      currentWorld,
      entityId,
      'position',
      newPosition,
    );
    return updateComponent(
      worldWithNewPos,
      entityId,
      'velocity',
      newVelocity,
    );
  }, world);

  return [newWorld, []];
};
