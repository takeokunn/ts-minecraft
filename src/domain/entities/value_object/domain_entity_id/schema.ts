import { Schema } from 'effect'

// -----------------------------------------------------------------------------
// DomainEntityId Brand型定義
// -----------------------------------------------------------------------------

/**
 * ドメインエンティティ識別子
 * UUID-based entity identifier for domain layer
 *
 * Format: entity_[uuid]
 * Example: entity_550e8400-e29b-41d4-a716-446655440000
 */
export const DomainEntityIdSchema = Schema.String.pipe(
  Schema.pattern(/^entity_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
  Schema.brand('DomainEntityId'),
  Schema.annotations({
    title: 'Domain Entity ID',
    description: 'UUID-based entity identifier for domain layer',
    examples: ['entity_550e8400-e29b-41d4-a716-446655440000'],
  })
)

export type DomainEntityId = Schema.Schema.Type<typeof DomainEntityIdSchema>
