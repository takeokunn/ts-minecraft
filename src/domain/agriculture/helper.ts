import type {
  AgricultureErrorReason,
  CropId,
  AgricultureError,
  AnimalType
} from './types'

export const createAgricultureError = (
  reason: AgricultureErrorReason,
  message: string,
  details?: {
    position?: { x: number; y: number; z: number }
    cropId?: CropId
    animalId?: string
    cause?: unknown
  }
): AgricultureError => ({
  _tag: 'AgricultureError' as const,
  reason,
  message,
  position: details?.position,
  cropId: details?.cropId,
  animalId: details?.animalId,
  cause: details?.cause,
})

export const InvalidSoilError = (position: { x: number; y: number; z: number }) =>
  createAgricultureError('INVALID_SOIL', `Invalid soil at position (${position.x}, ${position.y}, ${position.z})`, {
    position,
  })

export const CropAlreadyExistsError = (position: { x: number; y: number; z: number }) =>
  createAgricultureError(
    'CROP_ALREADY_EXISTS',
    `Crop already exists at position (${position.x}, ${position.y}, ${position.z})`,
    { position }
  )

export const CropNotFoundError = (cropId: CropId) =>
  createAgricultureError('CROP_NOT_FOUND', `Crop ${cropId} not found`, { cropId })

export const CropNotMatureError = (cropId: CropId) =>
  createAgricultureError('CROP_NOT_MATURE', `Crop ${cropId} is not mature enough to harvest`, { cropId })

export const InsufficientLightError = (position: { x: number; y: number; z: number }, lightLevel: number) =>
  createAgricultureError(
    'INSUFFICIENT_LIGHT',
    `Insufficient light level (${lightLevel}) at position (${position.x}, ${position.y}, ${position.z})`,
    { position }
  )

export const NoWaterNearbyError = (position: { x: number; y: number; z: number }) =>
  createAgricultureError(
    'NO_WATER_NEARBY',
    `No water source found near position (${position.x}, ${position.y}, ${position.z})`,
    { position }
  )

export const AnimalNotFoundError = (animalId: string) =>
  createAgricultureError('ANIMAL_NOT_FOUND', `Animal ${animalId} not found`, { animalId })

export const IncompatibleAnimalsError = (animal1: string, animal2: string) =>
  createAgricultureError('INCOMPATIBLE_ANIMALS', `Animals ${animal1} and ${animal2} are not compatible for breeding`)

export const AnimalTooYoungError = (animalId: string) =>
  createAgricultureError('ANIMAL_TOO_YOUNG', `Animal ${animalId} is too young to breed`, { animalId })

export const BreedingCooldownError = (animalId: string) =>
  createAgricultureError('BREEDING_COOLDOWN', `Animal ${animalId} is still in breeding cooldown`, { animalId })

export const InvalidFoodError = (animalType: AnimalType, foodId: string) =>
  createAgricultureError('INVALID_FOOD', `${foodId} is not valid food for ${animalType}`)
