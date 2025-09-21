import { describe, it, expect } from 'vitest'
import { Schema } from '@effect/schema'
import { Either } from 'effect'
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

      validTools.forEach(tool => {
        const result = Schema.decodeEither(ToolTypeSchema)(tool)
        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right).toBe(tool)
        }
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
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toEqual(textureFaces)
      }
    })

    it('不完全なテクスチャ面定義を拒否する', () => {
      const incompleteTexture = {
        top: 'top_texture',
        bottom: 'bottom_texture',
        // 他の面が欠落
      }

      const result = Schema.decodeEither(TextureFacesSchema)(incompleteTexture)
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('BlockTextureSchema', () => {
    it('単純なテクスチャ文字列を受け入れる', () => {
      const result = Schema.decodeEither(BlockTextureSchema)('stone')
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toBe('stone')
      }
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
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toEqual(textureFaces)
      }
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
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toEqual(itemDrop)
      }
    })

    it('確率が範囲外でも受け入れる（バリデーションは別レイヤー）', () => {
      const itemDrop = {
        itemId: 'diamond',
        minCount: 1,
        maxCount: 3,
        chance: 1.5, // 範囲外だが型的には有効
      }

      const result = Schema.decodeEither(ItemDropSchema)(itemDrop)
      expect(Either.isRight(result)).toBe(true)
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
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toEqual(sound)
      }
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
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toEqual(physics)
      }
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
      expect(Either.isRight(result)).toBe(true)
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
      ]

      validCategories.forEach(category => {
        const result = Schema.decodeEither(BlockCategorySchema)(category)
        expect(Either.isRight(result)).toBe(true)
        if (Either.isRight(result)) {
          expect(result.right).toBe(category)
        }
      })
    })

    it('無効なカテゴリーを拒否する', () => {
      const result = Schema.decodeEither(BlockCategorySchema)('invalid_category')
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
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right).toEqual(blockType)
      }
    })

    it('必須フィールドが欠けている場合は拒否する', () => {
      const incompleteBlock = {
        id: 'stone',
        name: 'Stone',
        // category以降が欠落
      }

      const result = Schema.decodeEither(BlockTypeSchema)(incompleteBlock)
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