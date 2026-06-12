import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Option, Schema } from 'effect'
import { WorldMetadataSchema } from '@ts-minecraft/world'

// Regression guard for the save/load encode↔decode SYMMETRY.
//
// The real persistence path is: saveWorldMetadata -> Schema.encode -> IndexedDB
// `put` (structured clone) -> ... -> IndexedDB `get` -> Schema.decodeUnknown ->
// loadWorldMetadata. IndexedDB's structured clone strips the prototype off Effect
// `Option` instances (Some -> { value }, None -> {}), so storing DECODED Options
// and decoding them back fails — OptionFromNullOr expects the encoded `null | value`
// shape. Encoding on save makes the stored representation structured-clone-safe.
//
// These tests model that path WITHOUT a real IndexedDB (none is wired in node):
// encode -> structuredClone (what `put` does) -> decode. The in-memory storage
// mock used elsewhere stores object references and never encodes/decodes, so it
// CANNOT catch a regression here — this test must exercise the schema directly.

const metadata = {
  seed: 42,
  createdAt: new Date(0),
  lastPlayed: new Date(1000),
  playerSpawn: { x: 0, y: 64, z: 0 },
  playerState: {
    position: { x: 1, y: 64, z: 2 },
    health: 20,
    inventory: { slots: [Option.some({ slot: 0, itemType: 'WOOD', count: 3 }), Option.none()] },
    timeOfDay: 0.5,
    hunger: { foodLevel: 20, saturation: 5 },
    totalXP: 7,
    equipment: {},
  },
  // A mid-smelt furnace: occupied input + fuel, empty output, active recipe, partial progress.
  furnaceStates: [{
    position: { x: 8, y: 64, z: 8 },
    input: Option.some({ itemType: 'RAW_IRON', count: 1 }),
    fuel: Option.some({ itemType: 'COAL', count: 1 }),
    output: Option.none(),
    activeRecipeId: Option.some('raw-iron-to-iron-ingot'),
    progressSecs: 0.5,
  }],
  gameMode: 'survival' as const,
  saveVersion: 1,
}

describe('storage/WorldMetadata encode↔decode round-trip (real persistence path)', () => {
  it('encodes Options to a structured-clone-safe shape (no live Option instances stored)', async () => {
    const encoded = await Effect.runPromise(Schema.encode(WorldMetadataSchema)(metadata as never))
    const furnace = (encoded as { furnaceStates: ReadonlyArray<Record<string, unknown>> }).furnaceStates[0]!
    // Some -> the plain value, None -> null. Neither is an Effect Option instance,
    // so the structured clone IndexedDB performs on `put` preserves them.
    expect(Option.isOption(furnace['input'])).toBe(false)
    expect(furnace['input']).toEqual({ itemType: 'RAW_IRON', count: 1 })
    expect(furnace['output']).toBeNull()
    expect(furnace['activeRecipeId']).toBe('raw-iron-to-iron-ingot')
  })

  it('survives encode -> structured clone -> decode with every furnace + inventory field intact', async () => {
    const encoded = await Effect.runPromise(Schema.encode(WorldMetadataSchema)(metadata as never))
    // structuredClone is exactly what IndexedDB.put does to the encoded value.
    const stored = structuredClone(encoded)
    const loaded = await Effect.runPromise(Schema.decodeUnknown(WorldMetadataSchema)(stored))

    const f = loaded.furnaceStates![0]!
    expect(f.position).toEqual({ x: 8, y: 64, z: 8 })
    expect(f.input).toEqual(Option.some({ itemType: 'RAW_IRON', count: 1 }))
    expect(f.fuel).toEqual(Option.some({ itemType: 'COAL', count: 1 }))
    expect(f.output).toEqual(Option.none())
    expect(f.activeRecipeId).toEqual(Option.some('raw-iron-to-iron-ingot'))
    expect(f.progressSecs).toBe(0.5)

    // Inventory shares the same OptionFromNullOr pattern — verify it too.
    expect(loaded.playerState!.inventory.slots[0]).toEqual(Option.some({ slot: 0, itemType: 'WOOD', count: 3 }))
    expect(loaded.playerState!.inventory.slots[1]).toEqual(Option.none())
  })

  it('storing DECODED Options directly (the pre-fix bug) would NOT survive a structured clone', async () => {
    // Documents the bug the encode step fixes: skip encoding, clone the Option-bearing
    // object as IndexedDB would, and decoding fails because the prototype (and `_tag`)
    // is gone. This is what made saved worlds with items unloadable.
    const storedWithoutEncode = structuredClone(metadata)
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* Schema.decodeUnknown(WorldMetadataSchema)(storedWithoutEncode)
        return 'OK' as const
      }).pipe(Effect.catchAll(() => Effect.succeed('FAILED' as const))),
    )
    expect(result).toBe('FAILED')
  })
})
