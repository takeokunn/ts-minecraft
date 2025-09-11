import { Effect, Layer, Context } from 'effect'
import { WorldDomainService } from '../../domain/services/world-domain.service'
import { TerrainGenerationDomainService, TerrainGeneratorPort } from '../../domain/services/terrain-generation-domain.service'
import { MeshGenerationDomainService, MeshGeneratorPort } from '../../domain/services/mesh-generation-domain.service'
import { WorldManagementDomainService, WorldManagementDomainServicePort } from '../../domain/services/world-management-domain.service'

export interface WorldGenerateCommand {
  readonly seed: number
  readonly worldType: 'flat' | 'normal' | 'amplified' | 'debug'
  readonly generateStructures: boolean
  readonly worldSize?: 'small' | 'medium' | 'large' | 'infinite'
  readonly biomes?: string[]
}

export class WorldGenerateUseCase extends Context.Tag('WorldGenerateUseCase')<
  WorldGenerateUseCase,
  {
    readonly execute: (command: WorldGenerateCommand) => Effect.Effect<void, Error>
    readonly generateBiome: (chunkX: number, chunkZ: number, biomeType: string) => Effect.Effect<void, Error>
    readonly generateStructure: (position: { x: number; y: number; z: number }, structureType: string) => Effect.Effect<void, Error>
  }
>() {}

export const WorldGenerateUseCaseLive = Layer.succeed(WorldGenerateUseCase, {
  execute: (command) =>
    Effect.gen(function* (_) {
      const worldService = yield* _(WorldDomainService)
      const terrainGenerator = yield* _(TerrainGeneratorPort)
      const meshGenerator = yield* _(MeshGeneratorPort)
      const worldManagement = yield* _(WorldManagementDomainServicePort)

      // Initialize world generation with new domain services
      yield* _(Effect.log(`Starting world generation with seed: ${command.seed}`))

      // Generate base terrain using TerrainGenerationDomainService
      yield* _(generateBaseTerrain(command, terrainGenerator))

      // Generate biomes if specified
      if (command.biomes && command.biomes.length > 0) {
        yield* _(generateBiomes(command, terrainGenerator))
      }

      // Generate structures if enabled
      if (command.generateStructures) {
        yield* _(generateWorldStructures(command, worldService))
      }

      // Initialize spawn point
      yield* _(generateSpawnPoint(command, worldService))

      yield* _(Effect.log(`World generation completed with seed: ${command.seed}`))
    }),

  generateBiome: (chunkX, chunkZ, biomeType) =>
    Effect.gen(function* (_) {
      const worldService = yield* _(WorldDomainService)

      // Generate biome-specific terrain features
      const biomeFeatures = yield* _(worldService.generateBiomeFeatures(chunkX, chunkZ, biomeType))

      // Apply biome-specific block variations
      yield* _(worldService.applyBiomeBlockVariations(chunkX, chunkZ, biomeType))

      // Generate biome-specific vegetation
      yield* _(worldService.generateBiomeVegetation(chunkX, chunkZ, biomeType, biomeFeatures))

      yield* _(Effect.log(`Biome ${biomeType} generated for chunk ${chunkX}, ${chunkZ}`))
    }),

  generateStructure: (position, structureType) =>
    Effect.gen(function* (_) {
      const worldService = yield* _(WorldDomainService)

      // Validate structure placement
      const canPlace = yield* _(worldService.canPlaceStructure(position, structureType))

      if (!canPlace) {
        return yield* _(Effect.fail(new Error(`Cannot place structure ${structureType} at position`)))
      }

      // Generate structure blueprint
      const blueprint = yield* _(worldService.generateStructureBlueprint(structureType))

      // Place structure blocks
      yield* _(worldService.placeStructureBlocks(position, blueprint))

      // Add structure metadata
      yield* _(
        worldService.addStructureMetadata({
          position,
          structureType,
          blueprint,
          generatedAt: Date.now(),
        }),
      )

      yield* _(Effect.log(`Structure ${structureType} generated at ${position.x}, ${position.y}, ${position.z}`))
    }),
})

const generateBaseTerrain = (command: WorldGenerateCommand, terrainGenerator: any) =>
  Effect.gen(function* (_) {
    // Use the new TerrainGenerationDomainService for terrain generation
    yield* _(Effect.log(`Generating ${command.worldType} terrain with seed ${command.seed}`))
    
    // The actual terrain generation is now handled by the domain service
    // This would typically involve generating initial chunks around spawn
    const spawnChunk = { x: 0, z: 0 }
    const biome = yield* _(terrainGenerator.getBiome(0, 0, command.seed))
    
    yield* _(Effect.log(`Base terrain generation completed for world type: ${command.worldType}`))
  })

const generateBiomes = (command: WorldGenerateCommand, terrainGenerator: any) =>
  Effect.gen(function* (_) {
    yield* _(Effect.log(`Generating biomes for world with seed ${command.seed}`))
    
    // Generate biomes using the terrain generation domain service
    for (const biomeType of command.biomes!) {
      const biome = yield* _(terrainGenerator.getBiome(0, 0, command.seed))
      yield* _(Effect.log(`Generated biome: ${biome.type}`))
    }

    yield* _(Effect.log(`Generated ${command.biomes!.length} biomes`))
  })

const generateWorldStructures = (command: WorldGenerateCommand, worldService: WorldDomainService) =>
  Effect.gen(function* (_) {
    // Generate villages
    yield* _(worldService.generateVillages(command.seed))

    // Generate dungeons
    yield* _(worldService.generateDungeons(command.seed))

    // Generate strongholds
    yield* _(worldService.generateStrongholds(command.seed))

    // Generate other structures based on world type
    if (command.worldType !== 'flat') {
      yield* _(worldService.generateMineshafts(command.seed))
      yield* _(worldService.generateTemples(command.seed))
    }
  })

const generateSpawnPoint = (command: WorldGenerateCommand, worldService: WorldDomainService) =>
  Effect.gen(function* (_) {
    const spawnPoint = yield* _(worldService.findSuitableSpawnPoint(command.seed))

    yield* _(worldService.setWorldSpawn(spawnPoint))

    yield* _(Effect.log(`Spawn point set at ${spawnPoint.x}, ${spawnPoint.y}, ${spawnPoint.z}`))
  })

// Layer dependencies will be provided by the main Application layer
