// Shared multiplayer data/message types: remote-player + entity + chat + block
// snapshots exchanged over the network, plus the session-state union. Consumed
// by the service (multiplayer-service.ts), the inbound dispatcher
// (multiplayer-inbound.ts), and frame/presentation code — kept in a leaf module
// so those don't pull in the whole service.
import type { ConnectionState } from '@ts-minecraft/network/application/client-service'
import type { PlayerId, PlayerName } from '@ts-minecraft/network/domain/schemas'

export type RemotePlayerSnapshot = {
  readonly playerId: string
  readonly playerName: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly pitch: number
}

export type ChatEntry = {
  readonly player: string
  readonly text: string
  readonly timestamp: number
}

// A block edit received from a remote player, queued for the frame loop to apply
// to the local world (T15c). The network layer stays world-agnostic.
export type RemoteBlockEdit =
  | { readonly kind: 'place'; readonly x: number; readonly y: number; readonly z: number; readonly blockType: string }
  | { readonly kind: 'break'; readonly x: number; readonly y: number; readonly z: number }

// One chest slot on the wire: item id kept as a plain string; the apply site
// validates against the canonical item union before touching local state.
export type RemoteContainerSlot = {
  readonly itemType: string
  readonly count: number
  readonly durability: number | null
}

// A full-chest snapshot from a remote closer (last-writer-wins per position).
export type RemoteContainerUpdate = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly slots: ReadonlyArray<RemoteContainerSlot | null>
}

// Dropped-item sync: a peer's spawn/upsert (itemId is the OWNER's local id)
// and a removal addressed by original owner+id.
export type RemoteDroppedItemSpawn = {
  readonly ownerId: string
  readonly itemId: string
  readonly itemType: string
  readonly count: number
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly velocity: { readonly x: number; readonly y: number; readonly z: number }
}

export type RemoteDroppedItemRemove = {
  readonly ownerId: string
  readonly itemId: string
}

// Parked-vehicle sync: a peer's park/upsert and a removal by original owner+id.
export type RemoteParkedVehicleUpdate = {
  readonly ownerId: string
  readonly vehicleId: string
  readonly kind: 'boat' | 'minecart'
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly yaw: number
}

export type RemoteParkedVehicleRemove = {
  readonly ownerId: string
  readonly vehicleId: string
}

// Server verdict: our claim on someone's dropped item / parked vehicle lost
// the race — undo the local prediction.
export type RemoteClaimDenied = {
  readonly target: 'droppedItem' | 'parkedVehicle'
  readonly ownerId: string
  readonly itemId: string
}

export type LocalEntitySnapshot = {
  readonly entityId: string
  readonly entityType: string
  readonly position: { readonly x: number; readonly y: number; readonly z: number }
  readonly health: number
  readonly alive: boolean
}

export type RemoteEntitySnapshot = LocalEntitySnapshot & {
  readonly playerId: string
  readonly worldId: string
  readonly timestamp: number
}

// A non-host player's hit on one of OUR (host-authoritative) entities, relayed
// by the server. `entityId` is our raw entity id (namespace already stripped
// by the sender).
export type RemoteEntityDamage = {
  readonly attackerId: string
  readonly entityId: string
  readonly damage: number
  readonly knockback: { readonly x: number; readonly y: number; readonly z: number }
}

export type LocalPlayerIdentity = {
  readonly playerId: PlayerId
  readonly playerName: PlayerName
}

export type MultiplayerSessionState = ConnectionState | 'joining' | 'ready'
