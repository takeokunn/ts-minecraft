/**
 * Item Definition Repository Type Definitions
 */

/**
 * Repository の設定タイプ
 */
export type ItemDefinitionRepositoryType = 'memory' | 'json_file'

/**
 * Repository の初期化設定
 */
export interface ItemDefinitionRepositoryConfig {
  readonly type: ItemDefinitionRepositoryType
  readonly jsonFileConfig?: {
    readonly filePath: string
    readonly autoSaveEnabled?: boolean
    readonly backupEnabled?: boolean
    readonly validationEnabled?: boolean
  }
}

/**
 * Repository のキャッシュ設定
 */
export interface ItemDefinitionRepositoryCacheConfig {
  readonly enableCache?: boolean
  readonly cacheSize?: number
  readonly cacheTtl?: number
  readonly preloadCategories?: ReadonlyArray<string>
}

/**
 * Repository のバリデーション設定
 */
export interface ItemDefinitionRepositoryValidationConfig {
  readonly validateSchema?: boolean
  readonly validateUniqueness?: boolean
  readonly validateReferences?: boolean
  readonly strictMode?: boolean
}

/**
 * 統合Repository設定
 */
export interface ItemDefinitionRepositorySettings {
  readonly config: ItemDefinitionRepositoryConfig
  readonly cache?: ItemDefinitionRepositoryCacheConfig
  readonly validation?: ItemDefinitionRepositoryValidationConfig
}

/**
 * デフォルト設定
 */
export const DefaultItemDefinitionRepositoryConfig: ItemDefinitionRepositoryConfig = {
  type: 'memory',
  jsonFileConfig: {
    filePath: './data/item-definitions.json',
    autoSaveEnabled: true,
    backupEnabled: true,
    validationEnabled: true,
  },
}

export const DefaultItemDefinitionRepositoryCacheConfig: ItemDefinitionRepositoryCacheConfig = {
  enableCache: true,
  cacheSize: 10000,
  cacheTtl: 300000, // 5分
  preloadCategories: ['weapon', 'tool', 'building', 'food'],
}

export const DefaultItemDefinitionRepositoryValidationConfig: ItemDefinitionRepositoryValidationConfig = {
  validateSchema: true,
  validateUniqueness: true,
  validateReferences: true,
  strictMode: false,
}

export const DefaultItemDefinitionRepositorySettings: ItemDefinitionRepositorySettings = {
  config: DefaultItemDefinitionRepositoryConfig,
  cache: DefaultItemDefinitionRepositoryCacheConfig,
  validation: DefaultItemDefinitionRepositoryValidationConfig,
}
