// Controllers - Core controllers only
export {
  DebugController,
  DebugControllerLive,
  createDebugController,
  type DebugControllerInterface,
  GameController,
  GameControllerLive,
  createGameController,
  type GameControllerInterface,
  UIController,
  UIControllerLive,
  createUIController,
  type UIControllerInterface,
} from './controllers'

// View Models - Core view models only
export {
  GameStateViewModel,
  GameStateViewModelLive,
  createGameStateViewModel,
  type GameStateViewModelInterface,
  PlayerStatusViewModel,
  PlayerStatusViewModelLive,
  createPlayerStatusViewModel,
  type PlayerStatusViewModelInterface,
  WorldInfoViewModel,
  WorldInfoViewModelLive,
  createWorldInfoViewModel,
  type WorldInfoViewModelInterface,
} from './view-models'

// CLI Tools - Core CLI tools only (used in dev tools manager)
export {
  createGameDebugger,
  createPerformanceProfiler,
  createDevConsole,
  createEntityInspector,
  createWorldEditor,
  createNetworkInspector,
  createDevToolsManager,
  createStateDebugger,
  createCommandPalette,
  createHotReloadManager,
  defaultCliConfig,
} from './cli'

// Web application entry point
export { startWebApplication } from './web'
