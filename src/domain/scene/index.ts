/**
 * Scene Domain Module
 *
 * シーン管理システムのメインエクスポート
 * Effect-TS + Match.valueを使用した型安全なシーン管理
 */

// Core Scene definitions
export * from './Scene.js'
export * from './SceneManager.js'
export * from './SceneManagerLive.js'

// Scene implementations
export { MainMenuScene } from './scenes/MainMenuScene.js'
export { GameScene } from './scenes/GameScene.js'
export { LoadingScene } from './scenes/LoadingScene.js'