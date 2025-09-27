import {
  Effect,
  Layer,
  Ref,
  STM,
  Stream,
  Match,
  pipe,
  Schedule,
  Random,
  Duration,
  HashMap,
  Option,
  Chunk,
} from 'effect'
import { AgricultureService } from './AgricultureService'
import type { PlayerId, ItemId } from '@domain/core/types/brands'
import type { ItemStack } from '../../inventory/InventoryTypes'
import {
  type Crop,
  type CropId,
  type CropType,
  type GrowthStage,
  type GrowthConditions,
  type AgricultureError,
  type FarmAnimal,
  type AnimalType,
  type CropDrops,
  type BreedingResult,
  type Moisture,
  type GrowthRequirements,
  CropId as CropIdBrand,
  GrowthStage as GrowthStageBrand,
  LightLevel as LightLevelBrand,
  Moisture as MoistureBrand,
  WaterRadius as WaterRadiusBrand,
  BreedingCooldown as BreedingCooldownBrand,
  InvalidSoilError,
  CropAlreadyExistsError,
  CropNotFoundError,
  CropNotMatureError,
  AnimalNotFoundError,
  IncompatibleAnimalsError,
  AnimalTooYoungError,
  BreedingCooldownError,
  InvalidFoodError,
  createAgricultureError,
} from '../types/AgricultureTypes'

// ===================================
// Growth Requirements Configuration
// ===================================

const defaultGrowthRequirements = (() => {
  const map = HashMap.empty<CropType, GrowthRequirements>()
  return pipe(
    map,
    HashMap.set(
      'wheat' as CropType,
      {
        minLightLevel: LightLevelBrand(9),
        requiresWater: true as boolean,
        waterRadius: WaterRadiusBrand(4),
        baseGrowthTime: 60000, // 1 minute
        stages: 8,
      } as GrowthRequirements
    ),
    HashMap.set(
      'carrot' as CropType,
      {
        minLightLevel: LightLevelBrand(9),
        requiresWater: true as boolean,
        waterRadius: WaterRadiusBrand(4),
        baseGrowthTime: 80000,
        stages: 8,
      } as GrowthRequirements
    ),
    HashMap.set(
      'potato' as CropType,
      {
        minLightLevel: LightLevelBrand(9),
        requiresWater: true as boolean,
        waterRadius: WaterRadiusBrand(4),
        baseGrowthTime: 80000,
        stages: 8,
      } as GrowthRequirements
    ),
    HashMap.set(
      'beetroot' as CropType,
      {
        minLightLevel: LightLevelBrand(9),
        requiresWater: true as boolean,
        waterRadius: WaterRadiusBrand(4),
        baseGrowthTime: 90000,
        stages: 4,
      } as GrowthRequirements
    ),
    HashMap.set(
      'melon' as CropType,
      {
        minLightLevel: LightLevelBrand(9),
        requiresWater: true as boolean,
        waterRadius: WaterRadiusBrand(4),
        baseGrowthTime: 120000,
        stages: 8,
      } as GrowthRequirements
    ),
    HashMap.set(
      'pumpkin' as CropType,
      {
        minLightLevel: LightLevelBrand(9),
        requiresWater: true as boolean,
        waterRadius: WaterRadiusBrand(4),
        baseGrowthTime: 120000,
        stages: 8,
      } as GrowthRequirements
    ),
    HashMap.set(
      'sugar_cane' as CropType,
      {
        minLightLevel: LightLevelBrand(8),
        requiresWater: true as boolean,
        waterRadius: WaterRadiusBrand(1), // Must be adjacent to water
        baseGrowthTime: 120000,
        stages: 16,
      } as GrowthRequirements
    ),
    HashMap.set(
      'bamboo' as CropType,
      {
        minLightLevel: LightLevelBrand(9),
        requiresWater: false as boolean,
        waterRadius: WaterRadiusBrand(0),
        baseGrowthTime: 60000,
        stages: 16,
      } as GrowthRequirements
    ),
    HashMap.set(
      'nether_wart' as CropType,
      {
        minLightLevel: LightLevelBrand(0),
        requiresWater: false as boolean,
        waterRadius: WaterRadiusBrand(0),
        baseGrowthTime: 100000,
        stages: 4,
        canGrowInDark: true,
      } as GrowthRequirements
    )
  )
})()

// ===================================
// Animal Food Preferences
// ===================================

const animalFoodPreferences = (() => {
  const map = HashMap.empty<AnimalType, string[]>()
  return pipe(
    map,
    HashMap.set('cow' as AnimalType, ['wheat'] as string[]),
    HashMap.set('pig' as AnimalType, ['carrot', 'potato', 'beetroot'] as string[]),
    HashMap.set('sheep' as AnimalType, ['wheat'] as string[]),
    HashMap.set(
      'chicken' as AnimalType,
      ['seeds', 'wheat_seeds', 'melon_seeds', 'pumpkin_seeds', 'beetroot_seeds'] as string[]
    ),
    HashMap.set('horse' as AnimalType, ['golden_apple', 'golden_carrot', 'apple', 'hay_block'] as string[]),
    HashMap.set('rabbit' as AnimalType, ['carrot', 'golden_carrot', 'dandelion'] as string[]),
    HashMap.set('llama' as AnimalType, ['hay_block'] as string[]),
    HashMap.set('cat' as AnimalType, ['raw_fish', 'raw_salmon', 'raw_cod'] as string[]),
    HashMap.set('dog' as AnimalType, ['bone', 'meat', 'chicken', 'mutton', 'porkchop', 'beef'] as string[]),
    HashMap.set(
      'parrot' as AnimalType,
      ['seeds', 'wheat_seeds', 'melon_seeds', 'pumpkin_seeds', 'beetroot_seeds'] as string[]
    ),
    HashMap.set('bee' as AnimalType, ['flower', 'poppy', 'dandelion', 'sunflower'] as string[]),
    HashMap.set('fox' as AnimalType, ['sweet_berries', 'glow_berries'] as string[])
  )
})()

// ===================================
// Helper Functions
// ===================================

const generateCropId = (): Effect.Effect<CropId> =>
  Effect.sync(() => CropIdBrand(`crop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`))

const generateAnimalId = (): Effect.Effect<string> =>
  Effect.sync(() => `animal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

const calculateDrops = (crop: Crop): Effect.Effect<ReadonlyArray<ItemStack>> =>
  Effect.gen(function* () {
    const random = yield* Random.next

    return pipe(
      Match.value(crop.type),
      Match.when('wheat', () => [
        {
          itemId: 'wheat' as ItemId,
          count: Math.floor(random * 3) + 1,
          metadata: {},
        },
        {
          itemId: 'wheat_seeds' as ItemId,
          count: Math.floor(random * 4),
          metadata: {},
        },
      ]),
      Match.when('carrot', () => [
        {
          itemId: 'carrot' as ItemId,
          count: Math.floor(random * 4) + 1,
          metadata: {},
        },
      ]),
      Match.when('potato', () => {
        const potatoes = Math.floor(random * 4) + 1
        const poisonous = random < 0.02 ? 1 : 0
        return [
          {
            itemId: 'potato' as ItemId,
            count: potatoes,
            metadata: {},
          },
          ...(poisonous
            ? [
                {
                  itemId: 'poisonous_potato' as ItemId,
                  count: poisonous,
                  metadata: {},
                },
              ]
            : []),
        ]
      }),
      Match.when('beetroot', () => [
        {
          itemId: 'beetroot' as ItemId,
          count: 1,
          metadata: {},
        },
        {
          itemId: 'beetroot_seeds' as ItemId,
          count: Math.floor(random * 3),
          metadata: {},
        },
      ]),
      Match.when('melon', () => [
        {
          itemId: 'melon_slice' as ItemId,
          count: Math.floor(random * 5) + 3,
          metadata: {},
        },
      ]),
      Match.when('pumpkin', () => [
        {
          itemId: 'pumpkin' as ItemId,
          count: 1,
          metadata: {},
        },
      ]),
      Match.when('sugar_cane', () => [
        {
          itemId: 'sugar_cane' as ItemId,
          count: 1,
          metadata: {},
        },
      ]),
      Match.when('bamboo', () => [
        {
          itemId: 'bamboo' as ItemId,
          count: 1,
          metadata: {},
        },
      ]),
      Match.when('nether_wart', () => [
        {
          itemId: 'nether_wart' as ItemId,
          count: Math.floor(random * 3) + 2,
          metadata: {},
        },
      ]),
      Match.orElse(() => [
        {
          itemId: crop.type as ItemId,
          count: 1,
          metadata: {},
        },
      ])
    )
  })

const isValidFoodForAnimal = (animalType: AnimalType, foodId: string): boolean => {
  const preferences = HashMap.get(animalFoodPreferences, animalType)
  return pipe(
    preferences,
    Option.map((foods) => foods.some((food) => food === foodId)),
    Option.getOrElse(() => false)
  )
}

// ===================================
// Service Implementation
// ===================================

const makeAgricultureService = Effect.gen(function* () {
  // State management
  const crops = yield* Ref.make(HashMap.empty<CropId, Crop>())
  const farmAnimals = yield* Ref.make(HashMap.empty<string, FarmAnimal>())

  // Mock light level (in real implementation, would connect to lighting system)
  const getLightLevel = (_position: { x: number; y: number; z: number }) => Effect.succeed(LightLevelBrand(15))

  // Mock water check (in real implementation, would connect to water system)
  const hasWaterNearby = (_position: { x: number; y: number; z: number }, _radius: number) => Effect.succeed(true)

  // Mock soil check (in real implementation, would connect to world manager)
  const isFarmland = (_position: { x: number; y: number; z: number }) => Effect.succeed(true)

  // Update crop growth
  const updateCropGrowth = (crop: Crop): Effect.Effect<GrowthStage> =>
    Effect.gen(function* () {
      const requirements = HashMap.get(defaultGrowthRequirements, crop.type).pipe(
        Option.getOrElse(() => ({
          stages: 8,
          minLightLevel: LightLevelBrand(9),
          requiresWater: true,
          waterRadius: WaterRadiusBrand(4),
          baseGrowthTime: 60000,
        }))
      )

      if (crop.growthStage >= requirements.stages - 1) {
        return crop.growthStage
      }

      // Simplified growth logic
      const random = Math.random()
      const growthChance = crop.fertilized ? 0.5 : 0.25

      if (random < growthChance) {
        const newStage = Math.min(requirements.stages - 1, crop.growthStage + 1) as GrowthStage

        const updatedCrop = { ...crop, growthStage: newStage, lastUpdate: Date.now() }
        yield* Ref.update(crops, HashMap.set(crop.id, updatedCrop))

        return newStage
      }

      return crop.growthStage
    })

  // Growth ticker
  const growthTicker = pipe(
    Stream.fromSchedule(Schedule.fixed(Duration.seconds(5))),
    Stream.mapEffect(() =>
      Effect.gen(function* () {
        const allCrops = yield* Ref.get(crops)

        yield* Effect.forEach(HashMap.values(allCrops), (crop) => updateCropGrowth(crop), { concurrency: 'unbounded' })
      })
    ),
    Stream.runDrain,
    Effect.fork
  )

  // Start the growth ticker
  yield* growthTicker

  // Service implementation
  const plantCrop = (
    position: { x: number; y: number; z: number },
    cropType: CropType,
    planterId: PlayerId
  ): Effect.Effect<Crop, AgricultureError> =>
    Effect.gen(function* () {
      // Check soil
      const validSoil = yield* isFarmland(position)
      if (!validSoil) {
        return yield* Effect.fail(InvalidSoilError(position))
      }

      // Check for existing crop
      const existing = yield* Effect.gen(function* () {
        const allCrops = yield* Ref.get(crops)
        const values = Array.from(HashMap.values(allCrops))
        const found = values.find(
          (c) => c.position.x === position.x && c.position.y === position.y && c.position.z === position.z
        )
        return found ? Option.some(found) : Option.none()
      })

      if (Option.isSome(existing)) {
        return yield* Effect.fail(CropAlreadyExistsError(position))
      }

      // Create new crop
      const cropId = yield* generateCropId()
      const crop: Crop = {
        id: cropId,
        type: cropType,
        position,
        growthStage: GrowthStageBrand(0),
        plantedTime: Date.now(),
        moisture: MoistureBrand(7),
        fertilized: false,
        lastUpdate: Date.now(),
      }

      // Register crop
      yield* Ref.update(crops, HashMap.set(cropId, crop))

      return crop
    })

  const harvestCrop = (cropId: CropId, _harvesterId: PlayerId): Effect.Effect<CropDrops, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      const crop = pipe(
        HashMap.get(allCrops, cropId),
        Option.match({
          onNone: () => Effect.fail(CropNotFoundError(cropId)),
          onSome: (c) => Effect.succeed(c),
        })
      )
      const cropValue = yield* crop

      // Check maturity
      const requirements = HashMap.get(defaultGrowthRequirements, cropValue.type).pipe(
        Option.getOrElse(() => ({ stages: 8 }))
      )

      if (cropValue.growthStage < requirements.stages - 1) {
        return yield* Effect.fail(CropNotMatureError(cropId))
      }

      // Calculate drops
      const drops = yield* calculateDrops(cropValue)

      // Remove crop
      yield* Ref.update(crops, HashMap.remove(cropId))

      return {
        items: drops,
        experience: Math.floor(Math.random() * 3) + 1,
      }
    })

  const updateGrowth = (cropId: CropId): Effect.Effect<GrowthStage, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      const crop = pipe(
        HashMap.get(allCrops, cropId),
        Option.match({
          onNone: () => Effect.fail(CropNotFoundError(cropId)),
          onSome: (c) => Effect.succeed(c),
        })
      )
      const cropValue = yield* crop
      return yield* updateCropGrowth(cropValue)
    })

  const fertilizeCrop = (cropId: CropId, _fertilizerId: PlayerId): Effect.Effect<void, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      const crop = pipe(
        HashMap.get(allCrops, cropId),
        Option.match({
          onNone: () => Effect.fail(CropNotFoundError(cropId)),
          onSome: (c) => Effect.succeed(c),
        })
      )
      const cropValue = yield* crop

      const fertilizedCrop = { ...cropValue, fertilized: true }
      yield* Ref.update(crops, HashMap.set(cropId, fertilizedCrop))
    })

  const checkGrowthConditions = (cropId: CropId): Effect.Effect<GrowthConditions, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      const crop = pipe(
        HashMap.get(allCrops, cropId),
        Option.match({
          onNone: () => Effect.fail(CropNotFoundError(cropId)),
          onSome: (c) => Effect.succeed(c),
        })
      )
      const cropValue = yield* crop

      const lightLevel = yield* getLightLevel(cropValue.position)
      const hasWater = yield* hasWaterNearby(cropValue.position, 4)

      return {
        lightLevel,
        hasWater,
        isFertilized: cropValue.fertilized,
      }
    })

  const getCrop = (cropId: CropId): Effect.Effect<Crop, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      return yield* pipe(
        HashMap.get(allCrops, cropId),
        Option.match({
          onNone: () => Effect.fail(CropNotFoundError(cropId)),
          onSome: (c) => Effect.succeed(c),
        })
      )
    })

  const getCropAt = (position: { x: number; y: number; z: number }): Effect.Effect<Crop | null, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      const values = Array.from(HashMap.values(allCrops))
      const found = values.find(
        (c) => c.position.x === position.x && c.position.y === position.y && c.position.z === position.z
      )
      return found || null
    })

  const getCropsInChunk = (chunkX: number, chunkZ: number): Effect.Effect<ReadonlyArray<Crop>, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      const chunkMinX = chunkX * 16
      const chunkMaxX = chunkMinX + 15
      const chunkMinZ = chunkZ * 16
      const chunkMaxZ = chunkMinZ + 15

      const values = Array.from(HashMap.values(allCrops))
      const filtered = values.filter(
        (crop) =>
          crop.position.x >= chunkMinX &&
          crop.position.x <= chunkMaxX &&
          crop.position.z >= chunkMinZ &&
          crop.position.z <= chunkMaxZ
      )
      return filtered as ReadonlyArray<Crop>
    })

  const destroyCrop = (
    cropId: CropId,
    _reason?: 'player_break' | 'natural_decay' | 'trampled' | 'explosion'
  ): Effect.Effect<void, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      if (!HashMap.has(allCrops, cropId)) {
        return yield* Effect.fail(CropNotFoundError(cropId))
      }
      yield* Ref.update(crops, HashMap.remove(cropId))
    })

  const trampleFarmland = (
    position: { x: number; y: number; z: number },
    _tramplerId: PlayerId
  ): Effect.Effect<void, AgricultureError> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      const values = Array.from(HashMap.values(allCrops))
      const cropAtPosition = values.find(
        (c) => c.position.x === position.x && c.position.y === position.y && c.position.z === position.z
      )

      if (cropAtPosition) {
        yield* Ref.update(crops, HashMap.remove(cropAtPosition.id))
      }
    })

  const hydrateFarmland = (_position: { x: number; y: number; z: number }): Effect.Effect<Moisture, AgricultureError> =>
    Effect.succeed(MoistureBrand(7))

  // Animal management
  const breedAnimals = (
    animal1Id: string,
    animal2Id: string,
    food: ItemStack,
    _breederId: PlayerId
  ): Effect.Effect<BreedingResult, AgricultureError> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      const a1 = pipe(
        HashMap.get(animals, animal1Id),
        Option.match({
          onNone: () => Effect.fail(AnimalNotFoundError(animal1Id)),
          onSome: (a) => Effect.succeed(a),
        })
      )
      const a2 = pipe(
        HashMap.get(animals, animal2Id),
        Option.match({
          onNone: () => Effect.fail(AnimalNotFoundError(animal2Id)),
          onSome: (a) => Effect.succeed(a),
        })
      )

      const parent1 = yield* a1
      const parent2 = yield* a2

      // Check compatibility
      if (parent1.type !== parent2.type) {
        return yield* Effect.fail(IncompatibleAnimalsError(animal1Id, animal2Id))
      }

      // Check age
      if (parent1.isBaby || parent2.isBaby) {
        return yield* Effect.fail(AnimalTooYoungError(parent1.isBaby ? animal1Id : animal2Id))
      }

      // Check cooldown
      if (parent1.breedingCooldown > 0 || parent2.breedingCooldown > 0) {
        return yield* Effect.fail(BreedingCooldownError(parent1.breedingCooldown > 0 ? animal1Id : animal2Id))
      }

      // Check food
      const foodItemId = food.itemId.replace('minecraft:', '')
      if (!isValidFoodForAnimal(parent1.type, foodItemId)) {
        return yield* Effect.fail(InvalidFoodError(parent1.type, food.itemId))
      }

      // Create baby
      const babyId = yield* generateAnimalId()
      const baby: FarmAnimal = {
        entityId: babyId,
        type: parent1.type,
        health: 10,
        age: 0,
        isBaby: true,
        breedingCooldown: BreedingCooldownBrand(0),
        tamed: parent1.tamed && parent2.tamed,
        ownerId: parent1.ownerId || parent2.ownerId,
      }

      // Update parents and add baby
      yield* Ref.update(farmAnimals, (animals) =>
        pipe(
          animals,
          HashMap.set(babyId, baby),
          HashMap.modify(animal1Id, (a) => ({ ...a, breedingCooldown: BreedingCooldownBrand(6000) })),
          HashMap.modify(animal2Id, (a) => ({ ...a, breedingCooldown: BreedingCooldownBrand(6000) }))
        )
      )

      return {
        babyId,
        babyType: parent1.type,
        parents: [animal1Id, animal2Id] as [string, string],
      }
    })

  const feedAnimal = (animalId: string, food: ItemStack, _feederId: PlayerId): Effect.Effect<void, AgricultureError> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      const animal = pipe(
        HashMap.get(animals, animalId),
        Option.match({
          onNone: () => Effect.fail(AnimalNotFoundError(animalId)),
          onSome: (a) => Effect.succeed(a),
        })
      )
      const animalValue = yield* animal

      const foodItemId = food.itemId.replace('minecraft:', '')
      if (!isValidFoodForAnimal(animalValue.type, foodItemId)) {
        return yield* Effect.fail(InvalidFoodError(animalValue.type, food.itemId))
      }

      const fedAnimal: FarmAnimal = {
        ...animalValue,
        lastFed: Date.now(),
        health: Math.min(20, animalValue.health + 2),
      }

      yield* Ref.update(farmAnimals, (animals) => HashMap.set(animals, animalId, fedAnimal))
    })

  const tameAnimal = (animalId: string, tamerId: PlayerId, food?: ItemStack): Effect.Effect<void, AgricultureError> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      const animal = pipe(
        HashMap.get(animals, animalId),
        Option.match({
          onNone: () => Effect.fail(AnimalNotFoundError(animalId)),
          onSome: (a) => Effect.succeed(a),
        })
      )
      const animalValue = yield* animal

      // Check if tameable
      const tameableTypes: AnimalType[] = ['cat', 'dog', 'parrot', 'horse', 'llama']
      if (!tameableTypes.includes(animalValue.type)) {
        return yield* Effect.fail(createAgricultureError('NOT_TAMEABLE', `${animalValue.type} cannot be tamed`))
      }

      if (animalValue.tamed) {
        return yield* Effect.fail(createAgricultureError('ALREADY_TAMED', `Animal ${animalId} is already tamed`))
      }

      // Check food if provided
      if (food) {
        const foodItemId = food.itemId.replace('minecraft:', '')
        if (!isValidFoodForAnimal(animalValue.type, foodItemId)) {
          return yield* Effect.fail(InvalidFoodError(animalValue.type, food.itemId))
        }
      }

      const tamedAnimal: FarmAnimal = {
        ...animalValue,
        tamed: true,
        ownerId: tamerId,
      }

      yield* Ref.update(farmAnimals, (animals) => HashMap.set(animals, animalId, tamedAnimal))
    })

  const getAnimal = (animalId: string): Effect.Effect<FarmAnimal, AgricultureError> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      return yield* pipe(
        HashMap.get(animals, animalId),
        Option.match({
          onNone: () => Effect.fail(AnimalNotFoundError(animalId)),
          onSome: (a) => Effect.succeed(a),
        })
      )
    })

  const getAnimalsInRange = (
    _position: { x: number; y: number; z: number },
    _radius: number
  ): Effect.Effect<ReadonlyArray<FarmAnimal>, AgricultureError> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      // Simplified: return all animals, convert IterableIterator to array
      return Array.from(HashMap.values(animals)) as ReadonlyArray<FarmAnimal>
    })

  const setLoveModeForAnimal = (animalId: string, duration: number): Effect.Effect<void, AgricultureError> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      const animal = pipe(
        HashMap.get(animals, animalId),
        Option.match({
          onNone: () => Effect.fail(AnimalNotFoundError(animalId)),
          onSome: (a) => Effect.succeed(a),
        })
      )
      const animalValue = yield* animal

      const updatedAnimal: FarmAnimal = {
        ...animalValue,
        loveModeTime: Date.now() + duration,
      }

      yield* Ref.update(farmAnimals, (animals) => HashMap.set(animals, animalId, updatedAnimal))
    })

  const canBreedAnimals = (animal1Id: string, animal2Id: string): Effect.Effect<boolean, AgricultureError> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      const a1 = pipe(
        HashMap.get(animals, animal1Id),
        Option.match({
          onNone: () => Effect.fail(AnimalNotFoundError(animal1Id)),
          onSome: (a) => Effect.succeed(a),
        })
      )
      const a2 = pipe(
        HashMap.get(animals, animal2Id),
        Option.match({
          onNone: () => Effect.fail(AnimalNotFoundError(animal2Id)),
          onSome: (a) => Effect.succeed(a),
        })
      )

      const animal1 = yield* a1
      const animal2 = yield* a2

      return (
        animal1.type === animal2.type &&
        !animal1.isBaby &&
        !animal2.isBaby &&
        animal1.breedingCooldown === 0 &&
        animal2.breedingCooldown === 0
      )
    })

  const tickGrowth = (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      yield* Effect.forEach(HashMap.values(allCrops), (crop) => updateCropGrowth(crop), { concurrency: 'unbounded' })
    })

  const tickAnimals = (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      const now = Date.now()

      yield* Effect.forEach(
        HashMap.entries(animals),
        ([id, animal]) =>
          Effect.gen(function* () {
            let updated = animal

            // Age baby animals
            if (animal.isBaby && animal.age < 20) {
              updated = { ...updated, age: animal.age + 1 }
              if (updated.age >= 20) {
                updated = { ...updated, isBaby: false }
              }
            }

            // Reduce breeding cooldown
            if (animal.breedingCooldown > 0) {
              const newCooldown = Math.max(0, animal.breedingCooldown - 1000)
              updated = { ...updated, breedingCooldown: BreedingCooldownBrand(newCooldown) }
            }

            // End love mode
            if (animal.loveModeTime && animal.loveModeTime < now) {
              updated = { ...updated, loveModeTime: undefined }
            }

            yield* Ref.update(farmAnimals, (animals) => HashMap.set(animals, id, updated))
          }),
        { concurrency: 'unbounded' }
      )
    })

  const getTotalCrops = (): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      return HashMap.size(allCrops)
    })

  const getCropsByType = (type: CropType): Effect.Effect<ReadonlyArray<Crop>, never> =>
    Effect.gen(function* () {
      const allCrops = yield* Ref.get(crops)
      const values = Array.from(HashMap.values(allCrops))
      const filtered = values.filter((crop: Crop) => crop.type === type)
      return filtered as ReadonlyArray<Crop>
    })

  const getTotalAnimals = (): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      return HashMap.size(animals)
    })

  const getAnimalsByType = (type: AnimalType): Effect.Effect<ReadonlyArray<FarmAnimal>, never> =>
    Effect.gen(function* () {
      const animals = yield* Ref.get(farmAnimals)
      const values = Array.from(HashMap.values(animals))
      const filtered = values.filter((animal: FarmAnimal) => animal.type === type)
      return filtered as ReadonlyArray<FarmAnimal>
    })

  return AgricultureService.of({
    plantCrop,
    harvestCrop,
    updateGrowth,
    fertilizeCrop,
    checkGrowthConditions,
    getCrop,
    getCropAt,
    getCropsInChunk,
    destroyCrop,
    trampleFarmland,
    hydrateFarmland,
    breedAnimals,
    feedAnimal,
    tameAnimal,
    getAnimal,
    getAnimalsInRange,
    setLoveModeForAnimal,
    canBreedAnimals,
    tickGrowth,
    tickAnimals,
    getTotalCrops,
    getCropsByType,
    getTotalAnimals,
    getAnimalsByType,
  })
})

// ===================================
// Layer
// ===================================

export const AgricultureServiceLive = Layer.effect(AgricultureService, makeAgricultureService)
