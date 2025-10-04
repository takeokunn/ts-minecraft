import { describe, expect, it } from '@effect/vitest'
import * as Effect from 'effect/Effect'
import { makeBlockTag } from '../../value_object/block_identity'
import {
  ToolTypeSchema,
  makeBlockProperties,
  makeDrop,
  makeDrops,
  makePhysics,
  makeSound,
  makeTool,
} from '../block_properties'

describe('block_properties', () => {
  it.effect('デフォルト物理値を生成する', () =>
    makePhysics().pipe(
      Effect.tap((physics) =>
        Effect.sync(() => {
          expect(physics.solid).toBe(true)
          expect(physics.opacity).toBe(15)
        })
      )
    )
  )

  it.effect('物理値検証エラーを返す', () =>
    makePhysics({ hardness: -1 }).pipe(
      Effect.flip,
      Effect.tap((error) =>
        Effect.sync(() => expect(error._tag).toBe('InvalidPhysics'))
      )
    )
  )

  it.effect('音設定を上書きする', () =>
    makeSound({ break: 'block.wood.break' }).pipe(
      Effect.tap((sound) =>
        Effect.sync(() => expect(sound.break).toBe('block.wood.break'))
      )
    )
  )

  it.effect('ドロップ設定を生成する', () =>
    makeDrop({ itemId: 'diamond' }).pipe(
      Effect.tap((drop) =>
        Effect.sync(() => expect(drop.itemId).toBe('diamond'))
      )
    )
  )

  it.effect('ドロップ検証エラーを返す', () =>
    makeDrop({ quantity: 0 }).pipe(
      Effect.flip,
      Effect.tap((error) =>
        Effect.sync(() => expect(error._tag).toBe('InvalidDrops'))
      )
    )
  )

  it.effect('複数ドロップを生成する', () =>
    makeDrops([{ itemId: 'diamond' }, { itemId: 'emerald' }]).pipe(
      Effect.tap((drops) =>
        Effect.sync(() => expect(drops.map((drop) => drop.itemId)).toEqual(['diamond', 'emerald']))
      )
    )
  )

  it.effect('ToolTypeを検証する', () =>
    makeTool({ _tag: 'Pickaxe', level: 2 }).pipe(
      Effect.tap((tool) =>
        Effect.sync(() => expect(tool).toEqual({ _tag: 'Pickaxe', level: 2 }))
      )
    )
  )

  it.effect('ツール検証エラーを返す', () =>
    makeTool({ _tag: 'Pickaxe', level: 10 }).pipe(
      Effect.flip,
      Effect.tap((error) =>
        Effect.sync(() => expect(error._tag).toBe('InvalidTool'))
      )
    )
  )

  it.effect('ブロックプロパティを組み立てる', () =>
    Effect.gen(function* () {
      const tag = yield* makeBlockTag('mineable')
      const properties = yield* makeBlockProperties({
        physics: { luminance: 5 },
        sound: { place: 'block.glass.place' },
        tool: { _tag: 'Pickaxe', level: 1 },
        tags: [tag],
        drops: [{ itemId: 'stone', quantity: 1, chance: 1 }],
        stackSize: 16,
      })
      return properties
    }).pipe(
      Effect.tap((properties) =>
        Effect.sync(() => {
          expect(properties.physics.luminance).toBe(5)
          expect(properties.sound.place).toBe('block.glass.place')
          expect(properties.tags).toEqual(['mineable'])
          expect(properties.stackSize).toBe(16)
        })
      )
    )
  )

  it.effect('ブロックプロパティ検証エラーを返す', () =>
    makeBlockProperties({ stackSize: 0 }).pipe(
      Effect.flip,
      Effect.tap((error) =>
        Effect.sync(() => expect(error._tag).toBe('InvalidProperties'))
      )
    )
  )

  it.effect.prop('ToolTypeSchemaで生成された値を受け入れる', [ToolTypeSchema], ([tool]) =>
    makeTool(tool).pipe(
      Effect.tap((validated) => Effect.sync(() => expect(validated).toEqual(tool)))
    )
  )
})
