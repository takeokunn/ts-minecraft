import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Schema } from 'effect'
import { KeyMappings, KeyMappingsSchema } from './key-mappings'

// All valid literal values in order matching the schema
const VALID_KEYS = [
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'Space',
  'ControlLeft',
  'ShiftRight',
  'F5',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'KeyE',
  'Escape',
] as const

describe('KeyMappings constant', () => {
  it('has non-empty string values for all movement keys', () => {
    expect(KeyMappings.MOVE_FORWARD).toBeTruthy()
    expect(KeyMappings.MOVE_BACKWARD).toBeTruthy()
    expect(KeyMappings.MOVE_LEFT).toBeTruthy()
    expect(KeyMappings.MOVE_RIGHT).toBeTruthy()
    expect(typeof KeyMappings.MOVE_FORWARD).toBe('string')
    expect(typeof KeyMappings.MOVE_BACKWARD).toBe('string')
    expect(typeof KeyMappings.MOVE_LEFT).toBe('string')
    expect(typeof KeyMappings.MOVE_RIGHT).toBe('string')
  })

  it('has non-empty string value for JUMP', () => {
    expect(KeyMappings.JUMP).toBeTruthy()
    expect(typeof KeyMappings.JUMP).toBe('string')
  })

  it('has non-empty string value for INVENTORY_OPEN', () => {
    expect(KeyMappings.INVENTORY_OPEN).toBeTruthy()
    expect(typeof KeyMappings.INVENTORY_OPEN).toBe('string')
  })

  it('has non-empty string value for ESCAPE', () => {
    expect(KeyMappings.ESCAPE).toBeTruthy()
    expect(typeof KeyMappings.ESCAPE).toBe('string')
  })

  it('has non-empty string values for all hotbar slot keys', () => {
    const hotbarKeys = [
      KeyMappings.HOTBAR_SLOT_1,
      KeyMappings.HOTBAR_SLOT_2,
      KeyMappings.HOTBAR_SLOT_3,
      KeyMappings.HOTBAR_SLOT_4,
      KeyMappings.HOTBAR_SLOT_5,
      KeyMappings.HOTBAR_SLOT_6,
      KeyMappings.HOTBAR_SLOT_7,
      KeyMappings.HOTBAR_SLOT_8,
      KeyMappings.HOTBAR_SLOT_9,
    ]
    for (const key of hotbarKeys) {
      expect(key).toBeTruthy()
      expect(typeof key).toBe('string')
    }
  })

  it('has non-empty string values for SPRINT, SNEAK, CAMERA_TOGGLE', () => {
    expect(KeyMappings.SPRINT).toBeTruthy()
    expect(KeyMappings.SNEAK).toBeTruthy()
    expect(KeyMappings.CAMERA_TOGGLE).toBeTruthy()
  })

  it('has exactly the expected literal values', () => {
    expect(KeyMappings.MOVE_FORWARD).toBe('KeyW')
    expect(KeyMappings.MOVE_BACKWARD).toBe('KeyS')
    expect(KeyMappings.MOVE_LEFT).toBe('KeyA')
    expect(KeyMappings.MOVE_RIGHT).toBe('KeyD')
    expect(KeyMappings.JUMP).toBe('Space')
    expect(KeyMappings.SPRINT).toBe('ControlLeft')
    expect(KeyMappings.SNEAK).toBe('ShiftRight')
    expect(KeyMappings.CAMERA_TOGGLE).toBe('F5')
    expect(KeyMappings.INVENTORY_OPEN).toBe('KeyE')
    expect(KeyMappings.ESCAPE).toBe('Escape')
  })
})

describe('KeyMappingsSchema', () => {
  it('decodes successfully with the KeyMappings constant values', () => {
    const result = Schema.decodeUnknownEither(KeyMappingsSchema)(KeyMappings)
    expect(result._tag).toBe('Right')
  })

  it('decodes the exact literal values for each field', () => {
    const result = Schema.decodeUnknownEither(KeyMappingsSchema)({
      MOVE_FORWARD: 'KeyW',
      MOVE_BACKWARD: 'KeyS',
      MOVE_LEFT: 'KeyA',
      MOVE_RIGHT: 'KeyD',
      JUMP: 'Space',
      SPRINT: 'ControlLeft',
      SNEAK: 'ShiftRight',
      CAMERA_TOGGLE: 'F5',
      HOTBAR_SLOT_1: 'Digit1',
      HOTBAR_SLOT_2: 'Digit2',
      HOTBAR_SLOT_3: 'Digit3',
      HOTBAR_SLOT_4: 'Digit4',
      HOTBAR_SLOT_5: 'Digit5',
      HOTBAR_SLOT_6: 'Digit6',
      HOTBAR_SLOT_7: 'Digit7',
      HOTBAR_SLOT_8: 'Digit8',
      HOTBAR_SLOT_9: 'Digit9',
      INVENTORY_OPEN: 'KeyE',
      ESCAPE: 'Escape',
    })
    expect(result._tag).toBe('Right')
  })

  it('rejects an object with a wrong MOVE_FORWARD value', () => {
    const result = Schema.decodeUnknownEither(KeyMappingsSchema)({
      ...KeyMappings,
      MOVE_FORWARD: 'KeyA', // wrong — should be 'KeyW'
    })
    expect(result._tag).toBe('Left')
  })

  it('rejects an object with a wrong ESCAPE value', () => {
    const result = Schema.decodeUnknownEither(KeyMappingsSchema)({
      ...KeyMappings,
      ESCAPE: 'Enter',
    })
    expect(result._tag).toBe('Left')
  })

  it('rejects an object missing required fields', () => {
    const { ESCAPE: _removed, ...withoutEscape } = KeyMappings
    const result = Schema.decodeUnknownEither(KeyMappingsSchema)(withoutEscape)
    expect(result._tag).toBe('Left')
  })

  it('rejects a non-object value', () => {
    expect(Schema.decodeUnknownEither(KeyMappingsSchema)(null)._tag).toBe('Left')
    expect(Schema.decodeUnknownEither(KeyMappingsSchema)(42)._tag).toBe('Left')
    expect(Schema.decodeUnknownEither(KeyMappingsSchema)('KeyW')._tag).toBe('Left')
  })
})

describe('KeyMappingsSchema (property-based)', () => {
  it.prop(
    'rejects arbitrary strings as MOVE_FORWARD values unless the exact literal matches',
    { randomStr: Arbitrary.make(Schema.String.pipe(Schema.filter((s) => s !== 'KeyW'))) },
    ({ randomStr }) => {
      const result = Schema.decodeUnknownEither(KeyMappingsSchema)({
        ...KeyMappings,
        MOVE_FORWARD: randomStr,
      })
      expect(result._tag).toBe('Left')
    }
  )

  it.prop(
    'rejects arbitrary strings as JUMP values unless the exact literal matches',
    { randomStr: Arbitrary.make(Schema.String.pipe(Schema.filter((s) => s !== 'Space'))) },
    ({ randomStr }) => {
      const result = Schema.decodeUnknownEither(KeyMappingsSchema)({
        ...KeyMappings,
        JUMP: randomStr,
      })
      expect(result._tag).toBe('Left')
    }
  )

  it.prop(
    'rejects arbitrary strings as INVENTORY_OPEN values unless the exact literal matches',
    { randomStr: Arbitrary.make(Schema.String.pipe(Schema.filter((s) => s !== 'KeyE'))) },
    ({ randomStr }) => {
      const result = Schema.decodeUnknownEither(KeyMappingsSchema)({
        ...KeyMappings,
        INVENTORY_OPEN: randomStr,
      })
      expect(result._tag).toBe('Left')
    }
  )

  it.prop(
    'rejects arbitrary strings as ESCAPE values unless the exact literal matches',
    { randomStr: Arbitrary.make(Schema.String.pipe(Schema.filter((s) => s !== 'Escape'))) },
    ({ randomStr }) => {
      const result = Schema.decodeUnknownEither(KeyMappingsSchema)({
        ...KeyMappings,
        ESCAPE: randomStr,
      })
      expect(result._tag).toBe('Left')
    }
  )

  it('accepts only exact valid key strings from the known valid set', () => {
    // Every value in VALID_KEYS should appear in the decoded KeyMappings
    const decoded = Schema.decodeUnknownEither(KeyMappingsSchema)(KeyMappings)
    expect(decoded._tag).toBe('Right')
    if (decoded._tag === 'Right') {
      const values = Object.values(decoded.right)
      for (const validKey of VALID_KEYS) {
        expect(values).toContain(validKey)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// B8: KeyMappings uniqueness assertion
// ---------------------------------------------------------------------------

describe('KeyMappings uniqueness', () => {
  it('all key mapping values are unique (no key bound twice)', () => {
    const values = Object.values(KeyMappings)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})
