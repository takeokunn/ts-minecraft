// Controllers - Named exports for better tree-shaking and explicit dependencies
export { DebugController, DebugControllerLive, createDebugController, type DebugControllerInterface, type DebugState } from './debug.controller'

export { GameController, GameControllerLive, createGameController, type GameControllerInterface, type GameControllerState } from './game.controller'

export { UIController, UIControllerLive, createUIController, type UIControllerInterface, type UIState, type HotbarItem, type Notification } from './ui.controller'
