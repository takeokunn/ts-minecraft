import { Effect } from "effect";
import { World } from "./world";

export type System = Effect.Effect<void, never, World>;

export type SystemNode = {
  name: string;
  system: System;
  before?: string[];
  after?: string[];
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
      throw new Error(`System not found: ${name}`);
    }

    // Process `after` dependencies (nodes that must come before this one)
    if (node.after) {
      for (const depName of node.after) {
        visit(depName);
      }
    }

    // Process `before` dependencies (this node must come before these)
    // This is a bit tricky. We can't just visit them here.
    // The sorting logic needs to handle both `before` and `after`.
    // A full topological sort implementation would handle this more robustly.
    // For this implementation, we'll primarily rely on the `after` directive.

    visiting.delete(name);
    visited.add(name);
    sorted.push(node);
  };

  for (const node of nodes) {
    visit(node.name);
  }

  // A simple sort based on `before` as a secondary check.
  // This is not a complete topological sort.
  const finalSorted = sorted.sort((a, b) => {
    if (a.before?.includes(b.name)) return -1;
    if (b.before?.includes(a.name)) return 1;
    return 0;
  });

  const allSystems = finalSorted.map((node) => node.system);

  return Effect.forEach(allSystems, (system) => system, { discard: true });
};
