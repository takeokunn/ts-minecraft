// Remote (non-authoritative) entity identity. In a multiplayer session exactly
// one client — the entity host — simulates mobs; every other client mirrors
// them as `remote:<hostPlayerId>:<hostEntityId>` entries that are driven purely
// by inbound EntitySnapshot messages. Remote entities must never run AI or
// physics locally: doing so fights the snapshot stream and positions diverge.
export const REMOTE_ENTITY_ID_PREFIX = 'remote:'

export const isRemoteEntityId = (entityId: string): boolean =>
  entityId.startsWith(REMOTE_ENTITY_ID_PREFIX)

// Recovers the host's raw entity id from a namespaced remote id, so a non-host
// attacker can tell the host WHICH of its entities was hit.
// 'remote:<playerId>:<rawId>' -> '<rawId>' (null when the shape is not remote).
export const stripRemoteEntityId = (entityId: string): string | null => {
  if (!isRemoteEntityId(entityId)) return null
  const rawStart = entityId.indexOf(':', REMOTE_ENTITY_ID_PREFIX.length)
  if (rawStart === -1) return null
  const raw = entityId.slice(rawStart + 1)
  return raw.length > 0 ? raw : null
}
