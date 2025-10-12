export type GenerationError = {
  readonly _tag: 'BiomeGenerationError'
  readonly message: string
  readonly cause?: unknown
}

export type CreationError = {
  readonly _tag: 'BiomeCreationError'
  readonly message: string
  readonly cause?: unknown
}

export type ValidationError = {
  readonly _tag: 'BiomeValidationError'
  readonly message: string
  readonly cause?: unknown
}

export type OptimizationError = {
  readonly _tag: 'BiomeOptimizationError'
  readonly message: string
  readonly cause?: unknown
}

export const createGenerationError = (message: string, cause?: unknown): GenerationError => ({
  _tag: 'BiomeGenerationError',
  message,
  cause,
})

export const createCreationError = (message: string, cause?: unknown): CreationError => ({
  _tag: 'BiomeCreationError',
  message,
  cause,
})

export const createValidationError = (message: string, cause?: unknown): ValidationError => ({
  _tag: 'BiomeValidationError',
  message,
  cause,
})

export const createOptimizationError = (message: string, cause?: unknown): OptimizationError => ({
  _tag: 'BiomeOptimizationError',
  message,
  cause,
})
