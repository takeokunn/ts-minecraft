/**
 * Config exports
 */

// GameError系は errors/ から提供されるため、config/effect からは EffectConfig のみをエクスポート
export { EffectConfig, createGameError as createSimpleGameError, type GameResult } from './effect'
