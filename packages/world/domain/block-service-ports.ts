/**
 * Port interfaces for services that BlockService depends on from sibling packages.
 *
 * By depending on these interfaces (defined in world/domain) rather than on the
 * concrete application-layer services from entity/inventory packages, the world
 * application layer avoids cross-package application-to-application imports.
 *
 * Concrete implementations are wired in the app composition root via Layer.provide.
 */
import { Context, Effect, Option } from 'effect'
import type { Position, PlayerId, SlotIndex } from '@ts-minecraft/core'
import type { InventoryItem } from '@ts-minecraft/core'
import { Data } from 'effect'

// ---------------------------------------------------------------------------
// Error mirrors (same tag, no cross-package import required)
// ---------------------------------------------------------------------------

export class PlayerServicePortError extends Data.TaggedError('PlayerError')<{
  readonly playerId: string
  readonly reason: string
}> {
  override get message(): string {
    return `Player error for '${this.playerId}': ${this.reason}`
  }
}

export class InventoryServicePortError extends Data.TaggedError('InventoryError')<{
  readonly operation: string
  readonly cause?: unknown
}> {
  override get message(): string {
    return this.cause
      ? `Inventory error [${this.operation}]: ${String(this.cause)}`
      : `Inventory error [${this.operation}]`
  }
}

// ---------------------------------------------------------------------------
// PlayerServicePort
// ---------------------------------------------------------------------------

export type PlayerServicePortShape = {
  readonly getPosition: (id: PlayerId) => Effect.Effect<Position, PlayerServicePortError>
}

export class PlayerServicePort extends Context.Tag('@minecraft/domain/PlayerServicePort')<
  PlayerServicePort,
  PlayerServicePortShape
>() {}

// ---------------------------------------------------------------------------
// InventoryServicePort
// ---------------------------------------------------------------------------

export type InventoryServicePortShape = {
  readonly addBlock: (itemType: InventoryItem, count: number) => Effect.Effect<void, InventoryServicePortError>
  readonly removeBlock: (itemType: InventoryItem, count: number, preferredSlot?: SlotIndex) => Effect.Effect<void, InventoryServicePortError>
}

export class InventoryServicePort extends Context.Tag('@minecraft/domain/InventoryServicePort')<
  InventoryServicePort,
  InventoryServicePortShape
>() {}

// ---------------------------------------------------------------------------
// HotbarServicePort
// ---------------------------------------------------------------------------

export type HotbarServicePortShape = {
  readonly getSelectedBlockType: () => Effect.Effect<Option.Option<InventoryItem>, never>
}

export class HotbarServicePort extends Context.Tag('@minecraft/domain/HotbarServicePort')<
  HotbarServicePort,
  HotbarServicePortShape
>() {}

// ---------------------------------------------------------------------------
// FurnaceServicePort
// ---------------------------------------------------------------------------

export type FurnaceServicePortShape = {
  readonly dismantleFurnace: (position: { readonly x: number; readonly y: number; readonly z: number }) => Effect.Effect<boolean, never>
}

export class FurnaceServicePort extends Context.Tag('@minecraft/domain/FurnaceServicePort')<
  FurnaceServicePort,
  FurnaceServicePortShape
>() {}
