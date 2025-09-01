
import { Effect } from 'effect';
import { World } from '@/runtime/world';
import { Position, Velocity } from '@/domain/components';

const TERMINAL_VELOCITY = 50;
const FRICTION = 0.98;

export const integrate = (
  position: Position,
  velocity: Velocity,
  isGrounded: boolean,
  deltaTime: number,
  gravity: number,
): { newPosition: Position; newVelocity: Velocity } => {
  if (deltaTime === 0) {
    return {
      newPosition: { ...position },
      newVelocity: { ...velocity },
    };
  }

  let newVel = { ...velocity };

  if (!isGrounded) {
    newVel.y = Math.max(
      -TERMINAL_VELOCITY,
      newVel.y - gravity * deltaTime,
    );
  } else {
    newVel.y = 0;
    newVel.x *= FRICTION;
    newVel.z *= FRICTION;
  }

  const newPos: Position = {
    x: position.x + newVel.x * deltaTime,
    y: position.y + newVel.y * deltaTime,
    z: position.z + newVel.z * deltaTime,
  };

  return { newPosition: newPos, newVelocity: newVel };
};

export const physicsSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const { gravity, simulationRate } = world.globalState.physics;
  const deltaTime = 1 / simulationRate;
  const entities = world.queries.physics(world);

  for (const entity of entities) {
    const { entityId, position, velocity } = entity;
    const player = world.components.player.get(entityId);
    const isGrounded = player?.isGrounded ?? false;

    const { newPosition, newVelocity } = integrate(
      position,
      velocity,
      isGrounded,
      deltaTime,
      gravity,
    );

    world.components.position.set(entityId, newPosition);
    world.components.velocity.set(entityId, newVelocity);
  }
});
