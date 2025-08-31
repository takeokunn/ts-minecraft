import { Effect, Ref } from 'effect';
import { World } from './world';

export type System = Effect.Effect<void, never, any>; // Allow any context for systems

export type SystemNode = {
  name: string;
  system: System;
  before?: string[];
  after?: string[];
  /**
   * Specifies how often the system should run, in frames.
   * `runEvery: 1` (default) means the system runs every frame.
   * `runEvery: 5` means the system runs every 5 frames.
   */
  runEvery?: number;
};

export const createMainSystem = (nodes: SystemNode[]): System => {
  const nodeMap = new Map<string, SystemNode>(nodes.map((n) => [n.name, n]));
  const sorted: SystemNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (name: string) => {
    if (visiting.has(name)) {
      throw new Error(`Circular dependency detected in systems: ${name}`);
    }
    if (visited.has(name)) {
      return;
    }

    visiting.add(name);

    const node = nodeMap.get(name);
    if (!node) {
      // This allows dependencies to be optional
      return;
    }

    if (node.after) {
      for (const depName of node.after) {
        visit(depName);
      }
    }

    visiting.delete(name);
    visited.add(name);
    sorted.push(node);
  };

  for (const node of nodes) {
    visit(node.name);
  }

  // A simple sort based on `before` as a secondary check.
  // This is not a complete topological sort but works for this use case.
  const finalSorted = sorted.sort((a, b) => {
    if (a.before?.includes(b.name)) return -1;
    if (b.before?.includes(a.name)) return 1;
    return 0;
  });

  // Create a single Effect that manages the game loop logic
  return Effect.gen(function* (_) {
    const frameCounter = yield* _(Ref.make(0));

    const scheduledSystems = finalSorted.map((node) => {
      const runEvery = node.runEvery ?? 1;
      const systemEffect = Effect.gen(function* (_) {
        const currentFrame = yield* _(Ref.get(frameCounter));
        if (currentFrame % runEvery === 0) {
          yield* _(node.system);
        }
      });
      return systemEffect;
    });

    // The main loop effect
    yield* _(
      Effect.forEach(scheduledSystems, (system) => system, { discard: true }),
    );
    yield* _(Ref.update(frameCounter, (n) => n + 1));
  });
};
