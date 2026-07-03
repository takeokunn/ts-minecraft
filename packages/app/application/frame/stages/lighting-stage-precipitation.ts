import { Effect } from 'effect'
import { blockTypeToIndex, type Position } from '@ts-minecraft/core'
import { getParticleUvOffset } from '@ts-minecraft/rendering'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { Weather } from '@ts-minecraft/game'

// Precipitation particles: a handful of atlas-tinted motes scattered around
// the player every frame while it rains — the in-world counterpart to the
// CSS streak overlay. Snowy climates emit white snow motes instead.
const PRECIPITATION_SPAWNS_PER_FRAME = 4
const PRECIPITATION_PARTICLES_PER_SPAWN = 2
const PRECIPITATION_RADIUS = 10
const PRECIPITATION_HEIGHT = 8

const SNOWY_BIOMES = new Set(['SNOW', 'TAIGA', 'MOUNTAINS'])

// Deterministic per-frame scatter (Math.random is banned; visual-only state,
// same module-scratch pattern as the music context).
let precipitationFrame = 0
const scatter = (seed: number): number => {
  let h = (seed * 374761393 + 668265263) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  return (((h * 1274126177) >>> 0) >>> 16 & 0xffff) / 0xffff
}

export const spawnPrecipitationParticles = (
  services: Pick<FrameHandlerServices, 'particleSystem' | 'biomeService'>,
  playerPos: Position,
  weather: Weather,
): Effect.Effect<void, never> =>
  weather === 'clear'
    ? Effect.void
    : Effect.gen(function* () {
        precipitationFrame = (precipitationFrame + 1) >>> 0
        const biome = yield* services.biomeService.getBiome(Math.floor(playerPos.x), Math.floor(playerPos.z)).pipe(
          Effect.catchAll(() => Effect.succeed('PLAINS' as const)),
        )
        const tile = SNOWY_BIOMES.has(biome) ? blockTypeToIndex('SNOW') : blockTypeToIndex('WATER')
        const uv = getParticleUvOffset(tile)
        for (let i = 0; i < PRECIPITATION_SPAWNS_PER_FRAME; i++) {
          const seed = precipitationFrame * PRECIPITATION_SPAWNS_PER_FRAME + i
          const x = playerPos.x + (scatter(seed) - 0.5) * 2 * PRECIPITATION_RADIUS
          const z = playerPos.z + (scatter(seed + 7919) - 0.5) * 2 * PRECIPITATION_RADIUS
          const y = playerPos.y + 2 + scatter(seed + 104729) * PRECIPITATION_HEIGHT
          yield* services.particleSystem.spawnBurst(x, y, z, uv.u, uv.v, PRECIPITATION_PARTICLES_PER_SPAWN)
        }
      })
