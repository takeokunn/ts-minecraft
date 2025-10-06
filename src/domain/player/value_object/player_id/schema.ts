import { Schema } from 'effect'

/**
 * PlayerId Schema
 *
 * プレイヤーを一意に識別するID。
 * UUID v4ベースの形式 (player_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
 */
export const PlayerIdSchema = Schema.String.pipe(
  Schema.pattern(/^player_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
  Schema.brand('PlayerId'),
  Schema.annotations({
    title: 'Player ID',
    description: 'UUID-based player identifier with player_ prefix',
    examples: ['player_550e8400-e29b-41d4-a716-446655440000'],
  })
)

export type PlayerId = Schema.Schema.Type<typeof PlayerIdSchema>
