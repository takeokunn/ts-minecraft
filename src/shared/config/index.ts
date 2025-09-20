/**
 * Config exports
 */

// GameError系は errors/ から提供されるため、config/effect からは EffectConfig のみをエクスポート
export { createGameError as createSimpleGameError, EffectConfig, type GameResult } from './effect'
