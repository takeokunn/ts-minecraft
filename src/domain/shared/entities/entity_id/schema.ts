import { Schema } from 'effect'

/**
 * EntityId Schema
 *
 * エンティティを一意に識別するID。
 * UUID v4ベースの形式 (entity_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
 */
export const EntityIdSchema = Schema.String.pipe(
  Schema.pattern(/^entity_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\$/),
  Schema.brand('EntityId'),
  Schema.annotations({
    title: 'Entity ID',
    description: 'UUID-based entity identifier for domain layer',
    examples: ['entity_550e8400-e29b-41d4-a716-446655440000'],
  })
)

export type EntityId = Schema.Schema.Type<typeof EntityIdSchema>
