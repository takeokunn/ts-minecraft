import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { spawnPrecipitationParticles } from './lighting-stage-precipitation'

const makeServices = (biome = 'PLAINS') => {
  const spawnBurst = vi.fn(() => Effect.void)
  return {
    services: {
      particleSystem: { spawnBurst },
      biomeService: { getBiome: () => Effect.succeed(biome) },
    } as never,
    spawnBurst,
  }
}

describe('precipitation particles', () => {
  it('spawns nothing in clear weather', async () => {
    const { services, spawnBurst } = makeServices()
    await Effect.runPromise(spawnPrecipitationParticles(services, { x: 0, y: 64, z: 0 }, 'clear'))
    expect(spawnBurst).not.toHaveBeenCalled()
  })

  it('scatters mote bursts around the player while raining', async () => {
    const { services, spawnBurst } = makeServices()
    await Effect.runPromise(spawnPrecipitationParticles(services, { x: 100, y: 64, z: -50 }, 'rain'))
    expect(spawnBurst).toHaveBeenCalledTimes(4)
    for (const call of spawnBurst.mock.calls) {
      const [x, y, z] = call as unknown as [number, number, number]
      expect(Math.abs(x - 100)).toBeLessThanOrEqual(10)
      expect(Math.abs(z - -50)).toBeLessThanOrEqual(10)
      expect(y).toBeGreaterThan(64)
    }
  })

  it('thunder also precipitates and snowy biomes emit snow-tinted motes', async () => {
    const plains = makeServices('PLAINS')
    await Effect.runPromise(spawnPrecipitationParticles(plains.services, { x: 0, y: 64, z: 0 }, 'thunder'))
    const rainUv = plains.spawnBurst.mock.calls[0]!.slice(3, 5)

    const snowy = makeServices('SNOW')
    await Effect.runPromise(spawnPrecipitationParticles(snowy.services, { x: 0, y: 64, z: 0 }, 'rain'))
    const snowUv = snowy.spawnBurst.mock.calls[0]!.slice(3, 5)
    expect(snowUv).not.toEqual(rainUv)
  })
})
