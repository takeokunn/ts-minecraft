/**
 * Scene Domain Module
 *
 * シーン管理システムのメインエクスポート
 * Effect-TS + Match.valueを使用した型安全なシーン管理
 */

// Core Scene definitions
export * from './Scene'
export * from './SceneManager'
export * from './SceneManagerLive'

// Scene implementations
export { MainMenuScene } from './scenes/MainMenuScene'
export { GameScene } from './scenes/GameScene'
export { LoadingScene } from './scenes/LoadingScene'
