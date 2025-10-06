/**
 * @fileoverview シーン定義のバレルエクスポート
 * すべてのシーン実装を集約
 */

// Base Scene
export type {
  FrameTime,
  Scene,
  SceneBlueprint,
  SceneContext,
  SceneController,
  SceneControllerError,
  SceneDefinition,
  SceneFactory,
  SceneRuntime,
  SceneSnapshot,
} from './index'
export {
  SceneCleanupError,
  SceneFactoryTag,
  SceneInitializationError,
  SceneLifecycleError,
  SceneRenderError,
  SceneUpdateError,
  buildSceneRuntime,
  createSceneController,
  createSceneRuntime,
  makeSceneLayer,
} from './index'

// Game Scene
export type { GameMetadata, GameSceneContext, GameSceneController, GameState } from './index'
export { GameDefinition, GameScene, GameSceneBlueprint, createGameSceneController, gameDefinition } from './index'

// Loading Scene
export type { LoadingMetadata, LoadingSceneContext, LoadingSceneController, LoadingState } from './index'
export {
  LoadingDefinition,
  LoadingScene,
  LoadingSceneBlueprint,
  createLoadingSceneController,
  loadingDefinition,
} from './index'

// Main Menu Scene
export type { MainMenuMetadata, MainMenuSceneContext, MainMenuController, MainMenuState } from './index'
export {
  MainMenuBlueprint,
  MainMenuDefinition,
  MainMenuScene,
  createMainMenuController,
  mainMenuDefinition,
} from './index'
export * from './index';
export * from './base';
