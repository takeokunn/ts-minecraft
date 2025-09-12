import { Effect, Layer, Context, Ref, pipe } from 'effect'
import * as S from 'effect/Schema'
import {
  AppConfigSchema,
  AppConfig,
  defaultAppConfig,
} from '../schemas/app.schema'

/**
 * AppConfig service using Effect-TS patterns
 * Provides environment-aware configuration management with validation
 */

// Environment interface for accessing import.meta.env
export class EnvironmentService extends Context.Tag('EnvironmentService')<
  EnvironmentService,
  {
    readonly getMode: Effect.Effect<string>
    readonly getApiUrl: Effect.Effect<string | undefined>
    readonly isDevelopment: Effect.Effect<boolean>
    readonly isProduction: Effect.Effect<boolean>
    readonly isTest: Effect.Effect<boolean>
  }
>() {}

// App configuration error types
export class AppConfigError extends S.TaggedError<AppConfigError>()(
  'AppConfigError',
  {
    reason: S.Literal('validation', 'environment', 'configuration'),
    message: S.String,
    cause: S.optional(S.Unknown),
  }
) {}

// AppConfig service interface
export class AppConfigService extends Context.Tag('AppConfigService')<
  AppConfigService,
  {
    readonly get: Effect.Effect<AppConfig, AppConfigError>
    readonly getEnvironment: Effect.Effect<AppConfig['environment'], AppConfigError>
    readonly getFeatureFlags: Effect.Effect<AppConfig['features'], AppConfigError>
    readonly getLoggingConfig: Effect.Effect<AppConfig['logging'], AppConfigError>
    readonly update: (config: Partial<AppConfig>) => Effect.Effect<void, AppConfigError>
    readonly reload: Effect.Effect<AppConfig, AppConfigError>
    readonly validate: (config: unknown) => Effect.Effect<AppConfig, AppConfigError>
    readonly isFeatureEnabled: (
      feature: keyof AppConfig['features']
    ) => Effect.Effect<boolean, AppConfigError>
    readonly isDebugEnabled: Effect.Effect<boolean, AppConfigError>
  }
>() {}

// Environment service implementation
export const EnvironmentServiceLive = Layer.succeed(
  EnvironmentService,
  EnvironmentService.of({
    getMode: Effect.sync(() => 
      typeof import.meta !== 'undefined' && import.meta.env?.MODE || 'development'
    ),
    
    getApiUrl: Effect.sync(() =>
      typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined
    ),
    
    isDevelopment: Effect.sync(() => {
      const mode = typeof import.meta !== 'undefined' && import.meta.env?.MODE || 'development'
      return mode === 'development'
    }),
    
    isProduction: Effect.sync(() => {
      const mode = typeof import.meta !== 'undefined' && import.meta.env?.MODE || 'development'
      return mode === 'production'
    }),
    
    isTest: Effect.sync(() => {
      const mode = typeof import.meta !== 'undefined' && import.meta.env?.MODE || 'development'
      return mode === 'test'
    }),
  })
)

// Helper to create environment-specific config
const createEnvironmentConfig = (mode: string, apiUrl?: string): AppConfig => {
  const config = { ...defaultAppConfig }

  switch (mode) {
    case 'development':
      return {
        ...config,
        environment: 'development',
        debug: true,
        apiUrl,
        logging: {
          ...config.logging,
          level: 'debug',
          enableConsole: true,
          enableRemote: false,
        },
        features: {
          ...config.features,
          enableMultiplayer: false,
          enableWebGPU: true,
          enableWasm: true,
          enableServiceWorker: false,
          enableHotReload: true,
        },
        storage: {
          ...config.storage,
          maxCacheSize: 500,
        },
        security: {
          ...config.security,
          enableCSP: false,
          allowedOrigins: ['*'],
        },
      }

    case 'production':
      return {
        ...config,
        environment: 'production',
        debug: false,
        apiUrl,
        logging: {
          ...config.logging,
          level: 'warn',
          enableConsole: false,
          enableRemote: true,
        },
        features: {
          ...config.features,
          enableMultiplayer: true,
          enableWebGPU: true,
          enableWasm: true,
          enableServiceWorker: true,
          enableHotReload: false,
        },
        storage: {
          ...config.storage,
          maxCacheSize: 200,
        },
        security: {
          ...config.security,
          enableCSP: true,
          allowedOrigins: ['https://your-domain.com'],
        },
      }

    case 'test':
      return {
        ...config,
        environment: 'test',
        debug: false,
        apiUrl,
        logging: {
          ...config.logging,
          level: 'error',
          enableConsole: false,
          enableRemote: false,
        },
        features: {
          ...config.features,
          enableMultiplayer: false,
          enableWebGPU: false,
          enableWasm: true,
          enableServiceWorker: false,
          enableHotReload: false,
        },
        storage: {
          ...config.storage,
          maxCacheSize: 100,
        },
        security: {
          ...config.security,
          enableCSP: false,
          allowedOrigins: ['*'],
        },
      }

    default:
      return config
  }
}

// AppConfig service implementation
export const AppConfigServiceLive = Layer.effect(
  AppConfigService,
  Effect.gen(function* () {
    const environment = yield* EnvironmentService
    
    // Initialize with environment-specific config
    const mode = yield* environment.getMode
    const apiUrl = yield* environment.getApiUrl
    const initialConfig = createEnvironmentConfig(mode, apiUrl)
    const configRef = yield* Ref.make(initialConfig)

    const validate = (config: unknown) =>
      pipe(
        S.decodeUnknown(AppConfigSchema)(config),
        Effect.mapError(
          (error) =>
            new AppConfigError({
              reason: 'validation',
              message: `AppConfig validation failed: ${error}`,
              cause: error,
            })
        )
      )

    const reload = () =>
      Effect.gen(function* () {
        const mode = yield* environment.getMode
        const apiUrl = yield* environment.getApiUrl
        const reloadedConfig = createEnvironmentConfig(mode, apiUrl)
        
        // Validate the configuration
        const validatedConfig = yield* validate(reloadedConfig)
        
        // Update the ref with the reloaded config
        yield* Ref.set(configRef, validatedConfig)
        
        return validatedConfig
      })

    return AppConfigService.of({
      get: Ref.get(configRef),

      getEnvironment: pipe(
        Ref.get(configRef),
        Effect.map((config) => config.environment)
      ),

      getFeatureFlags: pipe(
        Ref.get(configRef),
        Effect.map((config) => config.features)
      ),

      getLoggingConfig: pipe(
        Ref.get(configRef),
        Effect.map((config) => config.logging)
      ),

      update: (partial: Partial<AppConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          
          // Deep merge for nested objects
          const updated: AppConfig = {
            ...current,
            ...partial,
            logging: partial.logging ? { ...current.logging, ...partial.logging } : current.logging,
            features: partial.features ? { ...current.features, ...partial.features } : current.features,
            storage: partial.storage ? { ...current.storage, ...partial.storage } : current.storage,
            security: partial.security ? { ...current.security, ...partial.security } : current.security,
          }
          
          const validated = yield* validate(updated)
          yield* Ref.set(configRef, validated)
        }),

      reload,

      validate,

      isFeatureEnabled: (feature: keyof AppConfig['features']) =>
        pipe(
          Ref.get(configRef),
          Effect.map((config) => config.features[feature])
        ),

      isDebugEnabled: pipe(
        Ref.get(configRef),
        Effect.map((config) => config.debug || config.environment === 'development')
      ),
    })
  })
).pipe(
  Layer.provide(EnvironmentServiceLive)
)

// Test service implementation with mock environment
export const AppConfigServiceTest = Layer.effect(
  AppConfigService,
  Effect.gen(function* () {
    const testConfig = createEnvironmentConfig('test')
    const configRef = yield* Ref.make(testConfig)

    const validate = (config: unknown) =>
      pipe(
        S.decodeUnknown(AppConfigSchema)(config),
        Effect.mapError(
          (error) =>
            new AppConfigError({
              reason: 'validation',
              message: `AppConfig validation failed: ${error}`,
              cause: error,
            })
        )
      )

    return AppConfigService.of({
      get: Ref.get(configRef),

      getEnvironment: Effect.succeed('test' as const),

      getFeatureFlags: pipe(
        Ref.get(configRef),
        Effect.map((config) => config.features)
      ),

      getLoggingConfig: pipe(
        Ref.get(configRef),
        Effect.map((config) => config.logging)
      ),

      update: (partial: Partial<AppConfig>) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(configRef)
          
          const updated: AppConfig = {
            ...current,
            ...partial,
            logging: partial.logging ? { ...current.logging, ...partial.logging } : current.logging,
            features: partial.features ? { ...current.features, ...partial.features } : current.features,
            storage: partial.storage ? { ...current.storage, ...partial.storage } : current.storage,
            security: partial.security ? { ...current.security, ...partial.security } : current.security,
          }
          
          const validated = yield* validate(updated)
          yield* Ref.set(configRef, validated)
        }),

      reload: Effect.gen(function* () {
        const testConfig = createEnvironmentConfig('test')
        const validated = yield* validate(testConfig)
        yield* Ref.set(configRef, validated)
        return validated
      }),

      validate,

      isFeatureEnabled: (feature: keyof AppConfig['features']) =>
        pipe(
          Ref.get(configRef),
          Effect.map((config) => config.features[feature])
        ),

      isDebugEnabled: Effect.succeed(false),
    })
  })
)