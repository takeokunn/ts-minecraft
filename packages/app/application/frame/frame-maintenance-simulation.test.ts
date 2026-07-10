import { describe, it } from "@effect/vitest";
import {
  blockTypeToIndex,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  DeltaTimeSecs,
} from "@ts-minecraft/core";
import {
  chunkBlockIndexUnchecked,
  FIRE_MAINTENANCE_INTERVAL_SECS,
  makeFallingBlockMaintenanceState,
  type Chunk,
} from "@ts-minecraft/world";
import { Effect, HashMap, MutableRef, Option } from "effect";
import { expect, vi } from "vitest";

import { arrangeFrameHarness } from "../../test/frame-handler-test-kit/orchestration/harness";
import { runMaintenanceSimulation } from "./frame-maintenance-simulation";

const makeUnsupportedFireChunk = (): Chunk => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
  blocks[chunkBlockIndexUnchecked(4, 10, 4)] = blockTypeToIndex("FIRE");

  return {
    blocks,
    coord: { x: 1, z: 0 },
  };
};

describe("runMaintenanceSimulation fire lifecycle integration", () => {
  it.effect("runs fire maintenance during the frame maintenance simulation", () =>
    Effect.gen(function* () {
      const { services } = yield* arrangeFrameHarness();
      const fireChunk = makeUnsupportedFireChunk();
      const getLoadedChunks = vi.fn(() => Effect.succeed([fireChunk]));
      const forceSetBlock = vi.fn(() => Effect.void);

      Object.assign(services.chunkManagerService, {
        getLoadedChunks,
      });
      Object.assign(services.blockService, {
        forceSetBlock,
      });
      Object.assign(services.entityManager, {
        despawnAllEntities: vi.fn(() => Effect.succeed(0)),
        despawnFarEntities: vi.fn(() => Effect.succeed(0)),
      });
      Object.assign(services.mobSpawner, {
        trySpawn: vi.fn(() => Effect.succeed(Option.none())),
      });

      const result = yield* runMaintenanceSimulation(
        services,
        {
          cropTickAccumulatorRef: MutableRef.make(0),
          fireTickAccumulatorRef: MutableRef.make(0),
          fallingBlockState: makeFallingBlockMaintenanceState(),
          dirtyChunksRef: MutableRef.make(HashMap.empty()),
        },
        {
          furnaceEnabled: false,
          maintenanceDeltaTime: DeltaTimeSecs.make(
            FIRE_MAINTENANCE_INTERVAL_SECS,
          ),
          mobsEnabled: false,
          mobsSpawnEnabled: false,
          playerPos: { x: 0, y: 64, z: 0 },
          villageEnabled: false,
        },
      );

      expect(result.despawnedCount).toBe(0);
      expect(forceSetBlock).toHaveBeenCalledWith({ x: 20, y: 10, z: 4 }, "AIR");
    }),
  );
});
