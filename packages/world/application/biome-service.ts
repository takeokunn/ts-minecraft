import { Effect } from "effect";
import { NoiseServicePort } from "../domain/noise-service-port";
import { createBiomeServiceOps } from "./biome-service-ops";

// ─── Service ─────────────────────────────────────────────────────────────────

export class BiomeService extends Effect.Service<BiomeService>()(
  "@minecraft/application/BiomeService",
  {
    effect: Effect.gen(function* () {
      const noiseService = yield* NoiseServicePort;
      const {
        getBiome,
        getBiomeProperties,
        getTemperature,
        getHumidity,
        getBiomesAndPropertiesForChunk,
      } = createBiomeServiceOps(noiseService);
      return {
        getBiome,
        getBiomeProperties,
        getTemperature,
        getHumidity,
        getBiomesAndPropertiesForChunk,
      };
    }),
  },
) {}
