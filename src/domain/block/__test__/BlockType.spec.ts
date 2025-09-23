import { describe, it, expect } from 'vitest'
import { Schema } from '@effect/schema'
import { Either, pipe } from 'effect'
import {
  BlockId,
  TextureId,
  ToolTypeSchema,
  TextureFacesSchema,
  SimpleTextureSchema,
  BlockTextureSchema,
  ItemDropSchema,
  BlockSoundSchema,
  BlockPhysicsSchema,
  BlockCategorySchema,
  BlockTypeSchema,
  createDefaultPhysics,
  createDefaultSound,
  type BlockType,
  type BlockPhysics,
  type BlockSound,
} from '../BlockType'

describe('BlockType', () => {
  describe('Branded Types', () => {
    it('BlockIdをBranded型として作成できる', () => {
      const id = BlockId('stone')
      expect(id).toBe('stone')
      expect(typeof id).toBe('string')
    })

    it('TextureIdをBranded型として作成できる', () => {
      const textureId = TextureId('stone_texture')
      expect(textureId).toBe('stone_texture')
      expect(typeof textureId).toBe('string')
    })
  })

  describe('ToolTypeSchema', () => {
    it('有効なツールタイプを検証できる', () => {
      const validTools = ['none', 'pickaxe', 'axe', 'shovel', 'hoe', 'shears', 'sword'] as const

      validTools.forEach((tool) => {
        const result = Schema.decodeEither(ToolTypeSchema)(tool)
        pipe(
          result,
          Either.match({
            onLeft: () => expect.fail(`Expected success for tool '${tool}' but got error`),
            onRight: (value) => {
              expect(value).toBe(tool)
            },
          })
        )
      })
    })

    it('無効なツールタイプを拒否する', () => {
      const result = Schema.decodeEither(ToolTypeSchema)('invalid_tool' as any)
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('TextureFacesSchema', () => {
    it('6面のテクスチャを定義できる', () => {
      const textureFaces = {
        top: 'top_texture',
        bottom: 'bottom_texture',
        north: 'north_texture',
        south: 'south_texture',
        east: 'east_texture',
        west: 'west_texture',
      }

      const result = Schema.decodeEither(TextureFacesSchema)(textureFaces)
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for texture faces but got error'),
          onRight: (value) => {
            expect(value).toEqual(textureFaces)
          },
        })
      )
    })

    it('不完全なテクスチャ面定義を拒否する', () => {
      const incompleteTexture = {
        top: 'top_texture',
        bottom: 'bottom_texture',
        // north, south, east, west are missing
      }

      const result = Schema.decodeEither(TextureFacesSchema)(incompleteTexture as any)
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('BlockTextureSchema', () => {
    it('単純なテクスチャ文字列を受け入れる', () => {
      const result = Schema.decodeEither(BlockTextureSchema)('stone')
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for simple texture but got error'),
          onRight: (value) => {
            expect(value).toBe('stone')
          },
        })
      )
    })

    it('面別テクスチャオブジェクトを受け入れる', () => {
      const textureFaces = {
        top: 'grass_top',
        bottom: 'dirt',
        north: 'grass_side',
        south: 'grass_side',
        east: 'grass_side',
        west: 'grass_side',
      }

      const result = Schema.decodeEither(BlockTextureSchema)(textureFaces)
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for texture faces object but got error'),
          onRight: (value) => {
            expect(value).toEqual(textureFaces)
          },
        })
      )
    })
  })

  describe('ItemDropSchema', () => {
    it('アイテムドロップを定義できる', () => {
      const itemDrop = {
        itemId: 'diamond',
        minCount: 1,
        maxCount: 3,
        chance: 0.5,
      }

      const result = Schema.decodeEither(ItemDropSchema)(itemDrop)
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for item drop but got error'),
          onRight: (value) => {
            expect(value).toEqual(itemDrop)
          },
        })
      )
    })

    it('確率が範囲外でも受け入れる（バリデーションは別レイヤー）', () => {
      const itemDrop = {
        itemId: 'diamond',
        minCount: 1,
        maxCount: 3,
        chance: 1.5, // 範囲外だが型的には有効
      }

      const result = Schema.decodeEither(ItemDropSchema)(itemDrop)
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for item drop with out-of-range chance but got error'),
          onRight: () => {
            // 成功することを確認
          },
        })
      )
    })
  })

  describe('BlockSoundSchema', () => {
    it('ブロックサウンドを定義できる', () => {
      const sound = {
        break: 'block.stone.break',
        place: 'block.stone.place',
        step: 'block.stone.step',
      }

      const result = Schema.decodeEither(BlockSoundSchema)(sound)
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for block sound but got error'),
          onRight: (value) => {
            expect(value).toEqual(sound)
          },
        })
      )
    })
  })

  describe('BlockPhysicsSchema', () => {
    it('ブロック物理特性を定義できる', () => {
      const physics = {
        hardness: 1.5,
        resistance: 6.0,
        luminance: 0,
        opacity: 15,
        flammable: false,
        gravity: false,
        solid: true,
        replaceable: false,
        waterloggable: false,
      }

      const result = Schema.decodeEither(BlockPhysicsSchema)(physics)
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for block physics but got error'),
          onRight: (value) => {
            expect(value).toEqual(physics)
          },
        })
      )
    })

    it('数値が範囲外でも受け入れる（バリデーションは別レイヤー）', () => {
      const physics = {
        hardness: -1.0, // 破壊不可
        resistance: 3600000.0, // 超高耐性
        luminance: 20, // 範囲外
        opacity: 20, // 範囲外
        flammable: false,
        gravity: false,
        solid: true,
        replaceable: false,
        waterloggable: false,
      }

      const result = Schema.decodeEither(BlockPhysicsSchema)(physics)
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for block physics with out-of-range values but got error'),
          onRight: () => {
            // 成功することを確認
          },
        })
      )
    })
  })

  describe('BlockCategorySchema', () => {
    it('有効なカテゴリーを検証できる', () => {
      const validCategories = [
        'natural',
        'building',
        'decoration',
        'redstone',
        'transportation',
        'miscellaneous',
        'food',
        'tools',
        'combat',
      ] as const

      validCategories.forEach((category) => {
        const result = Schema.decodeEither(BlockCategorySchema)(category)
        pipe(
          result,
          Either.match({
            onLeft: () => expect.fail(`Expected success for category '${category}' but got error`),
            onRight: (value) => {
              expect(value).toBe(category)
            },
          })
        )
      })
    })

    it('無効なカテゴリーを拒否する', () => {
      const result = Schema.decodeEither(BlockCategorySchema)('invalid_category' as any)
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('BlockTypeSchema', () => {
    it('完全なブロック定義を検証できる', () => {
      const blockType: BlockType = {
        id: 'stone',
        name: 'Stone',
        category: 'natural',
        texture: 'stone',
        physics: createDefaultPhysics(),
        tool: 'pickaxe',
        minToolLevel: 0,
        drops: [
          {
            itemId: 'cobblestone',
            minCount: 1,
            maxCount: 1,
            chance: 1.0,
          },
        ],
        sound: createDefaultSound(),
        stackSize: 64,
        tags: ['mineable', 'stone'],
      }

      const result = Schema.decodeEither(BlockTypeSchema)(blockType)
      pipe(
        result,
        Either.match({
          onLeft: () => expect.fail('Expected success for complete block type but got error'),
          onRight: (value) => {
            expect(value).toEqual(blockType)
          },
        })
      )
    })

    it('必須フィールドが欠けている場合は拒否する', () => {
      const incompleteBlock = {
        id: 'stone',
        name: 'Stone',
        // category以降が欠落
      }

      const result = Schema.decodeEither(BlockTypeSchema)(incompleteBlock as any)
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('Default Helpers', () => {
    it('createDefaultPhysicsがデフォルト物理特性を返す', () => {
      const physics: BlockPhysics = createDefaultPhysics()

      expect(physics.hardness).toBe(1.0)
      expect(physics.resistance).toBe(1.0)
      expect(physics.luminance).toBe(0)
      expect(physics.opacity).toBe(15)
      expect(physics.flammable).toBe(false)
      expect(physics.gravity).toBe(false)
      expect(physics.solid).toBe(true)
      expect(physics.replaceable).toBe(false)
      expect(physics.waterloggable).toBe(false)
    })

    it('createDefaultSoundがデフォルトサウンドを返す', () => {
      const sound: BlockSound = createDefaultSound()

      expect(sound.break).toBe('block.stone.break')
      expect(sound.place).toBe('block.stone.place')
      expect(sound.step).toBe('block.stone.step')
    })
  })
})
