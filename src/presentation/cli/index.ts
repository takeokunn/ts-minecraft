// CLI Tools - Named exports for better tree-shaking
export { createGameDebugger, createGameDebuggerFactory, type GameDebuggerState, type GameDebuggerConfig } from './debugger'

export { createPerformanceProfiler, createPerformanceProfilerFactory, type PerformanceProfilerState, type PerformanceRecord, type PerformanceStats } from './performance-profiler'

export { createDevConsole, createDevConsoleFactory, type ConsoleCommand, type DevConsoleState } from './dev-console'

export { createEntityInspector, createEntityInspectorFactory, type EntityInspectorState, type EntityInspectorConfig, type EntityInfo } from './entity-inspector'

export { createWorldEditor, createWorldEditorFactory, type WorldEditorState, type WorldEditorConfig, type WorldEditAction } from './world-editor'

export { createNetworkInspector, createNetworkInspectorFactory, type NetworkInspectorState, type NetworkInspectorConfig } from './network-inspector'

export { createDevToolsManager, createDevToolsManagerFactory, type DevToolsState, type DevToolsConfig } from './dev-tools-manager'

export {
  createStateDebugger,
  createStateDebuggerFactory,
  type StateDebuggerState,
  type StateDebuggerConfig,
  type ComponentState,
  type StateSnapshot,
  type StateDiff,
} from './state-debugger'

// CLI configuration
export { defaultCliConfig } from './config'
