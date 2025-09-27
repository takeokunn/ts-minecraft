import { Context, Effect } from 'effect'
import type { PlayerId } from '@shared/types/branded'
import type { ItemStack } from '../../inventory/InventoryTypes'
import type {
  Crop,
  CropId,
  CropType,
  GrowthStage,
  GrowthConditions,
  AgricultureError,
  FarmAnimal,
  AnimalType,
  CropDrops,
  BreedingResult,
  Moisture,
} from '../types/AgricultureTypes'

// ===================================
// Service Interface
// ===================================

export interface AgricultureService {
  // Crop Management
  readonly plantCrop: (
    position: { x: number; y: number; z: number },
    cropType: CropType,
    planterId: PlayerId
  ) => Effect.Effect<Crop, AgricultureError>

  readonly harvestCrop: (cropId: CropId, harvesterId: PlayerId) => Effect.Effect<CropDrops, AgricultureError>

  readonly updateGrowth: (cropId: CropId) => Effect.Effect<GrowthStage, AgricultureError>

  readonly fertilizeCrop: (cropId: CropId, fertilizerId: PlayerId) => Effect.Effect<void, AgricultureError>

  readonly checkGrowthConditions: (cropId: CropId) => Effect.Effect<GrowthConditions, AgricultureError>

  readonly getCrop: (cropId: CropId) => Effect.Effect<Crop, AgricultureError>

  readonly getCropAt: (position: { x: number; y: number; z: number }) => Effect.Effect<Crop | null, AgricultureError>

  readonly getCropsInChunk: (chunkX: number, chunkZ: number) => Effect.Effect<ReadonlyArray<Crop>, AgricultureError>

  readonly destroyCrop: (
    cropId: CropId,
    reason?: 'player_break' | 'natural_decay' | 'trampled' | 'explosion'
  ) => Effect.Effect<void, AgricultureError>

  readonly trampleFarmland: (
    position: { x: number; y: number; z: number },
    tramplerId: PlayerId
  ) => Effect.Effect<void, AgricultureError>

  readonly hydrateFarmland: (position: { x: number; y: number; z: number }) => Effect.Effect<Moisture, AgricultureError>

  // Animal Management
  readonly breedAnimals: (
    animal1: string,
    animal2: string,
    food: ItemStack,
    breederId: PlayerId
  ) => Effect.Effect<BreedingResult, AgricultureError>

  readonly feedAnimal: (animalId: string, food: ItemStack, feederId: PlayerId) => Effect.Effect<void, AgricultureError>

  readonly tameAnimal: (animalId: string, tamerId: PlayerId, food?: ItemStack) => Effect.Effect<void, AgricultureError>

  readonly getAnimal: (animalId: string) => Effect.Effect<FarmAnimal, AgricultureError>

  readonly getAnimalsInRange: (
    position: { x: number; y: number; z: number },
    radius: number
  ) => Effect.Effect<ReadonlyArray<FarmAnimal>, AgricultureError>

  readonly setLoveModeForAnimal: (animalId: string, duration: number) => Effect.Effect<void, AgricultureError>

  readonly canBreedAnimals: (animal1: string, animal2: string) => Effect.Effect<boolean, AgricultureError>

  // Growth Ticking
  readonly tickGrowth: () => Effect.Effect<void, never>

  readonly tickAnimals: () => Effect.Effect<void, never>

  // Statistics
  readonly getTotalCrops: () => Effect.Effect<number, never>

  readonly getCropsByType: (type: CropType) => Effect.Effect<ReadonlyArray<Crop>, never>

  readonly getTotalAnimals: () => Effect.Effect<number, never>

  readonly getAnimalsByType: (type: AnimalType) => Effect.Effect<ReadonlyArray<FarmAnimal>, never>
}

// ===================================
// Service Tag
// ===================================

export const AgricultureService = Context.GenericTag<AgricultureService>('@minecraft/domain/AgricultureService')

// ===================================
// Service Helpers
// ===================================

export const plantCrop = (position: { x: number; y: number; z: number }, cropType: CropType, planterId: PlayerId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.plantCrop(position, cropType, planterId)
  })

export const harvestCrop = (cropId: CropId, harvesterId: PlayerId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.harvestCrop(cropId, harvesterId)
  })

export const updateGrowth = (cropId: CropId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.updateGrowth(cropId)
  })

export const fertilizeCrop = (cropId: CropId, fertilizerId: PlayerId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.fertilizeCrop(cropId, fertilizerId)
  })

export const checkGrowthConditions = (cropId: CropId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.checkGrowthConditions(cropId)
  })

export const getCrop = (cropId: CropId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getCrop(cropId)
  })

export const getCropAt = (position: { x: number; y: number; z: number }) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getCropAt(position)
  })

export const getCropsInChunk = (chunkX: number, chunkZ: number) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getCropsInChunk(chunkX, chunkZ)
  })

export const destroyCrop = (cropId: CropId, reason?: 'player_break' | 'natural_decay' | 'trampled' | 'explosion') =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.destroyCrop(cropId, reason)
  })

export const trampleFarmland = (position: { x: number; y: number; z: number }, tramplerId: PlayerId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.trampleFarmland(position, tramplerId)
  })

export const hydrateFarmland = (position: { x: number; y: number; z: number }) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.hydrateFarmland(position)
  })

export const breedAnimals = (animal1: string, animal2: string, food: ItemStack, breederId: PlayerId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.breedAnimals(animal1, animal2, food, breederId)
  })

export const feedAnimal = (animalId: string, food: ItemStack, feederId: PlayerId) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.feedAnimal(animalId, food, feederId)
  })

export const tameAnimal = (animalId: string, tamerId: PlayerId, food?: ItemStack) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.tameAnimal(animalId, tamerId, food)
  })

export const getAnimal = (animalId: string) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getAnimal(animalId)
  })

export const getAnimalsInRange = (position: { x: number; y: number; z: number }, radius: number) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getAnimalsInRange(position, radius)
  })

export const setLoveModeForAnimal = (animalId: string, duration: number) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.setLoveModeForAnimal(animalId, duration)
  })

export const canBreedAnimals = (animal1: string, animal2: string) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.canBreedAnimals(animal1, animal2)
  })

export const tickGrowth = () =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.tickGrowth()
  })

export const tickAnimals = () =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.tickAnimals()
  })

export const getTotalCrops = () =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getTotalCrops()
  })

export const getCropsByType = (type: CropType) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getCropsByType(type)
  })

export const getTotalAnimals = () =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getTotalAnimals()
  })

export const getAnimalsByType = (type: AnimalType) =>
  Effect.gen(function* () {
    const service = yield* AgricultureService
    return yield* service.getAnimalsByType(type)
  })
