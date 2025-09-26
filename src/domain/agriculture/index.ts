// ===================================
// Agriculture Domain Exports
// ===================================

// Types and Schemas
export {
  // Branded Types
  type CropId,
  type GrowthStage,
  type LightLevel,
  type Moisture,
  type GrowthRate,
  type WaterRadius,
  type BreedingCooldown,
  CropId as CropIdBrand,
  GrowthStage as GrowthStageBrand,
  LightLevel as LightLevelBrand,
  Moisture as MoistureBrand,
  GrowthRate as GrowthRateBrand,
  WaterRadius as WaterRadiusBrand,
  BreedingCooldown as BreedingCooldownBrand,
  // Schemas
  CropIdSchema,
  GrowthStageSchema,
  LightLevelSchema,
  MoistureSchema,
  GrowthRateSchema,
  WaterRadiusSchema,
  BreedingCooldownSchema,
  CropTypeSchema,
  AnimalTypeSchema,
  CropSchema,
  GrowthRequirementsSchema,
  GrowthConditionsSchema,
  FarmAnimalSchema,
  DestroyReasonSchema,
  AgricultureEventSchema,
  AgricultureErrorReasonSchema,
  AgricultureErrorSchema,
  // Types
  type CropType,
  type AnimalType,
  type Crop,
  type GrowthRequirements,
  type GrowthConditions,
  type FarmAnimal,
  type DestroyReason,
  type AgricultureEvent,
  type AgricultureErrorReason,
  type AgricultureError,
  type CropDrops,
  type AnimalDrops,
  type BreedingResult,
  // Error Constructors
  createAgricultureError,
  InvalidSoilError,
  CropAlreadyExistsError,
  CropNotFoundError,
  CropNotMatureError,
  InsufficientLightError,
  NoWaterNearbyError,
  AnimalNotFoundError,
  IncompatibleAnimalsError,
  AnimalTooYoungError,
  BreedingCooldownError,
  InvalidFoodError,
  // Type Guards
  isCrop,
  isFarmAnimal,
  isAgricultureError,
} from './AgricultureTypes.js'

// Service Interface
export {
  type AgricultureService,
  AgricultureService,
  // Helper functions
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
} from './AgricultureService.js'

// Service Implementation
export {
  AgricultureServiceLive,
} from './AgricultureServiceLive.js'