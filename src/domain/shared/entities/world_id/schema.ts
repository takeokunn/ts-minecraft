import { Schema } from 'effect'

/**
 * WorldId Schema
 *
 * ワールドを一意に識別するID。
 * 英数字、アンダースコア、ハイフンのみ許可、1-255文字
 */
export const WorldIdSchema = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(255),
  Schema.pattern(/^[a-zA-Z0-9_-]+$/),
  Schema.brand('WorldId'),
  Schema.annotations({
    title: 'World ID',
    description: 'Unique identifier for a world instance',
    examples: ['world_main', 'creative_world', 'adventure_map', 'overworld', 'nether', 'the_end'],
  })
)

export type WorldId = Schema.Schema.Type<typeof WorldIdSchema>
