// View Models - Named exports for better tree-shaking and explicit dependencies
export {
  GameStateViewModel,
  GameStateViewModelLive,
  createGameStateViewModel,
  type GameStateViewModelInterface,
  type GameStateViewModelExtended,
  type GameStateView,
  type MemoryUsage,
} from './game-state.vm'

export {
  PlayerStatusViewModel,
  PlayerStatusViewModelLive,
  createPlayerStatusViewModel,
  type PlayerStatusViewModelInterface,
  type PlayerStatusView,
  type Position3D,
  type HealthStatus,
} from './player-status.vm'

export {
  WorldInfoViewModel,
  WorldInfoViewModelLive,
  createWorldInfoViewModel,
  type WorldInfoViewModelInterface,
  type WorldInfoView,
  type TimeInfo,
  type WeatherInfo,
} from './world-info.vm'
