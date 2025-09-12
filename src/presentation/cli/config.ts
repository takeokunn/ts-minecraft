import { Effect } from 'effect'
import { DevToolsConfig } from '@presentation/cli/dev-tools-manager'

// Config Error types
export class ConfigError extends Error {
  readonly _tag = 'ConfigError'
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
  }
}

export class LocalStorageError extends ConfigError {
  readonly _tag = 'LocalStorageError'
  constructor(operation: string, cause?: unknown) {
    super(`LocalStorage ${operation} failed`, cause)
  }
}

export const DEFAULT_DEV_CONFIG: DevToolsConfig = {
  enableDebugger: true,
  enablePerformanceProfiler: true,
  enableDevConsole: true,
  enableEntityInspector: true,
  enableWorldEditor: true,
  enableNetworkInspector: true,
  autoStart: true,
  showWelcome: true,
}

export const PRODUCTION_DEV_CONFIG: DevToolsConfig = {
  enableDebugger: false,
  enablePerformanceProfiler: false,
  enableDevConsole: false,
  enableEntityInspector: false,
  enableWorldEditor: false,
  enableNetworkInspector: false,
  autoStart: false,
  showWelcome: false,
}

export const MINIMAL_DEV_CONFIG: DevToolsConfig = {
  enableDebugger: true,
  enablePerformanceProfiler: true,
  enableDevConsole: false,
  enableEntityInspector: false,
  enableWorldEditor: false,
  enableNetworkInspector: false,
  autoStart: false,
  showWelcome: false,
}

// 環境に応じた設定を取得
export function getDevToolsConfig(): Effect.Effect<DevToolsConfig, ConfigError, never> {
  return Effect.gen(function* () {
    try {
      const mode = import.meta.env.MODE

      switch (mode) {
        case 'development':
          return DEFAULT_DEV_CONFIG
        case 'profile':
          return {
            ...DEFAULT_DEV_CONFIG,
            enableWorldEditor: false,
            enableEntityInspector: false,
          }
        case 'production':
          return PRODUCTION_DEV_CONFIG
        default:
          return DEFAULT_DEV_CONFIG
      }
    } catch (error) {
      return yield* Effect.fail(new ConfigError('Failed to get dev tools config', error))
    }
  })
}

// ローカルストレージから設定を読み込み (Effect-TS版)
export const loadDevToolsConfigEffect = (browserApi: BrowserApiService): Effect.Effect<Partial<DevToolsConfig>, ConfigError, never> =>
  Effect.gen(function* () {
    const saved = yield* Effect.orElse(
      browserApi.getItem('ts-minecraft-dev-config'),
      () => Effect.succeed(null)
    )
    
    if (saved) {
      try {
        return JSON.parse(saved) as Partial<DevToolsConfig>
      } catch (error) {
        return yield* Effect.fail(new ConfigError('Failed to parse config JSON', error))
      }
    }
    return {}
  })

// ローカルストレージから設定を読み込み (Legacy版)
export function loadDevToolsConfig(): Effect.Effect<Partial<DevToolsConfig>, ConfigError, never> {
  return Effect.gen(function* () {
    try {
      const saved = localStorage.getItem('ts-minecraft-dev-config')
      if (saved) {
        return JSON.parse(saved) as Partial<DevToolsConfig>
      }
      return {}
    } catch (error) {
      return yield* Effect.fail(new LocalStorageError('read', error))
    }
  })
}

// ローカルストレージに設定を保存 (Effect-TS版)
export const saveDevToolsConfigEffect = (browserApi: BrowserApiService, config: Partial<DevToolsConfig>): Effect.Effect<void, ConfigError, never> =>
  Effect.gen(function* () {
    try {
      const configString = JSON.stringify(config)
      yield* Effect.orElse(
        browserApi.setItem('ts-minecraft-dev-config', configString),
        (error) => Effect.fail(new ConfigError('Failed to save config', error))
      )
    } catch (error) {
      return yield* Effect.fail(new ConfigError('Failed to stringify config', error))
    }
  })

// ローカルストレージに設定を保存 (Legacy版)
export function saveDevToolsConfig(config: Partial<DevToolsConfig>): Effect.Effect<void, ConfigError, never> {
  return Effect.gen(function* () {
    try {
      localStorage.setItem('ts-minecraft-dev-config', JSON.stringify(config))
    } catch (error) {
      return yield* Effect.fail(new LocalStorageError('write', error))
    }
  })
}
