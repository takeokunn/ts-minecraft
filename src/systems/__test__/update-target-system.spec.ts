import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { createArchetype } from "@/domain/archetypes";
import { TargetBlock, createTargetNone } from "@/domain/components";
import { playerTargetQuery } from "@/domain/queries";
import { RaycastService } from "@/infrastructure/raycast-three";
import { World } from "@/runtime/world";
import { provideTestWorld } from "@/../test/utils";
import { updateTargetSystem } from "../update-target-system";
import { addArchetype, createWorld } from "@/runtime/world-pure";

const RaycastServiceMock: RaycastService = {
  cast: vi.fn(),
};

describe("updateTargetSystem", () => {
  it("should update target to block when raycast hits", async () => {
    // 1. Setup initial world state
    let worldState = createWorld();
    const [, worldWithPlayer] = addArchetype(worldState, {
      ...createArchetype({ type: "player", pos: { x: 0, y: 0, z: 0 } }),
      target: createTargetNone(),
    });
    const [block, finalWorldState] = addArchetype(
      worldWithPlayer,
      createArchetype({ type: "block", pos: { x: 1, y: 1, z: 1 }, blockType: "grass" }),
    );

    // 2. Mock service implementations
    const face = { x: 0, y: 1, z: 0 };
    vi.spyOn(RaycastServiceMock, "cast").mockReturnValue(
      Effect.succeed(Option.some({ entityId: block, face, intersection: {} as any })),
    );

    // 3. Create the test layer
    const testLayer = provideTestWorld(finalWorldState, {
      raycast: RaycastServiceMock,
    });

    // 4. Define the test program
    const program = Effect.gen(function* (_) {
      const world = yield* _(World);
      yield* _(updateTargetSystem);
      const players = yield* _(world.query(playerTargetQuery));
      const player = players[0]!;

      expect(player.target._tag).toBe("block");
      if (player.target._tag === "block") {
        expect(player.target.entityId).toBe(block);
        expect(player.target.face).toEqual(face);
      }
    });

    // 5. Run the program
    await Effect.runPromise(Effect.provide(program, testLayer));
  });

  it("should update target to none when raycast misses", async () => {
    let worldState = createWorld();
    const [block, worldWithBlock] = addArchetype(
      worldState,
      createArchetype({ type: "block", pos: { x: 1, y: 1, z: 1 }, blockType: "grass" }),
    );
    const [, finalWorldState] = addArchetype(worldWithBlock, {
      ...createArchetype({ type: "player", pos: { x: 0, y: 0, z: 0 } }),
      target: new TargetBlock({ _tag: "block", entityId: block, face: { x: 0, y: 1, z: 0 } }),
    });

    vi.spyOn(RaycastServiceMock, "cast").mockReturnValue(Effect.succeed(Option.none()));

    const testLayer = provideTestWorld(finalWorldState, {
      raycast: RaycastServiceMock,
    });

    const program = Effect.gen(function* (_) {
      const world = yield* _(World);
      yield* _(updateTargetSystem);
      const players = yield* _(world.query(playerTargetQuery));
      const player = players[0]!;
      expect(player.target._tag).toBe("none");
    });

    await Effect.runPromise(Effect.provide(program, testLayer));
  });

  it("should not call raycast if no player exists", async () => {
    const worldState = createWorld();
    const castSpy = vi.spyOn(RaycastServiceMock, "cast");

    const testLayer = provideTestWorld(worldState, {
      raycast: RaycastServiceMock,
    });

    const program = Effect.gen(function* (_) {
      yield* _(updateTargetSystem);
    });

    await Effect.runPromise(Effect.provide(program, testLayer));
    expect(castSpy).not.toHaveBeenCalled();
  });
});
