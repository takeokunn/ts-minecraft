import { Effect } from 'effect'
import type { CustomBody } from '../../domain/physics-body'
import type { CustomWorld, WorldConfig } from '../../domain/physics-world'
import type { DeltaTimeSecs } from '@ts-minecraft/core'

// Terminal downward fall velocity (blocks/s). Without a cap, free-fall velocity
// grows unbounded and a single Euler step can move a body farther than its own
// height — past the AABB block resolver, which only scans the body's *current*
// bounding box (not the swept path) — letting it tunnel through thin floors.
//
// Derivation (NOT a feel-tuned magic number): the resolver reliably catches a
// floor only when the body lands within its ~1.8-block-tall box after a step, so
// the per-step fall must stay ≤ that height. At the deltaTime ceiling (0.05s,
// game-loop.ts) the safe cap is 1.8 / 0.05 = 36 blocks/s; 32 leaves margin
// (per-step ≤ 1.6 < 1.8). See physics-world-service.test.ts for the invariant.
export const TERMINAL_VELOCITY_Y = -32

export class PhysicsWorldService extends Effect.Service<PhysicsWorldService>()(
  '@minecraft/infrastructure/physics/PhysicsWorldService',
  {
    succeed: {
      create: (config: WorldConfig): Effect.Effect<CustomWorld, never> =>
        Effect.succeed({
          gravity: { x: config.gravity.x, y: config.gravity.y, z: config.gravity.z },
          bodies: [],
        }),
      addBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          world.bodies.push(body)
        }),
      removeBody: (world: CustomWorld, body: CustomBody): Effect.Effect<void, never> =>
        Effect.sync(() => {
          for (let index = world.bodies.length - 1; index >= 0; index -= 1) {
            if (world.bodies[index] === body) {
              world.bodies.splice(index, 1)
            }
          }
        }),
      step: (world: CustomWorld, deltaTime: DeltaTimeSecs): Effect.Effect<void, never> =>
        Effect.sync(() => {
          const gravityY = world.gravity.y
          for (const body of world.bodies) {
            if (body.type !== 'dynamic') continue

            body.velocity.y += gravityY * deltaTime
            // Clamp downward fall to terminal velocity so a single step never
            // moves the body more than its own height (tunneling guard). Upward
            // motion (jumping) is untouched.
            if (body.velocity.y < TERMINAL_VELOCITY_Y) body.velocity.y = TERMINAL_VELOCITY_Y
            body.position.x += body.velocity.x * deltaTime
            body.position.y += body.velocity.y * deltaTime
            body.position.z += body.velocity.z * deltaTime
          }
        }),
    },
  }
) {}
