import { DevToolsConfig } from './dev-tools-manager'

export const DEFAULT_DEV_CONFIG: DevToolsConfig = {
  enableDebugger: true,
  enablePerformanceProfiler: true,
  enableDevConsole: true,
  enableEntityInspector: true,
  enableWorldEditor: true,
  enableNetworkInspector: true,
  autoStart: true,
  showWelcome: true
}

export const PRODUCTION_DEV_CONFIG: DevToolsConfig = {
  enableDebugger: false,
  enablePerformanceProfiler: false,
  enableDevConsole: false,
  enableEntityInspector: false,
  enableWorldEditor: false,
  enableNetworkInspector: false,
  autoStart: false,
  showWelcome: false
}

export const MINIMAL_DEV_CONFIG: DevToolsConfig = {
  enableDebugger: true,
  enablePerformanceProfiler: true,
  enableDevConsole: false,
  enableEntityInspector: false,
  enableWorldEditor: false,
  enableNetworkInspector: false,
  autoStart: false,
  showWelcome: false
}

// 環境に応じた設定を取得
export function getDevToolsConfig(): DevToolsConfig {
  const mode = import.meta.env.MODE
  
  switch (mode) {
    case 'development':
      return DEFAULT_DEV_CONFIG
    case 'profile':
      return {
        ...DEFAULT_DEV_CONFIG,
        enableWorldEditor: false,
        enableEntityInspector: false
      }
    case 'production':
      return PRODUCTION_DEV_CONFIG
    default:
      return DEFAULT_DEV_CONFIG
  }
}

// ローカルストレージから設定を読み込み
export function loadDevToolsConfig(): Partial<DevToolsConfig> {
  try {
    const saved = localStorage.getItem('ts-minecraft-dev-config')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.warn('Failed to load dev tools config:', error)
  }
  return {}
}

// ローカルストレージに設定を保存
export function saveDevToolsConfig(config: Partial<DevToolsConfig>): void {
  try {
    localStorage.setItem('ts-minecraft-dev-config', JSON.stringify(config))
  } catch (error) {
    console.warn('Failed to save dev tools config:', error)
  }
}