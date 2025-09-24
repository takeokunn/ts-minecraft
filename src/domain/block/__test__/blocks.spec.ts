import { describe, it, expect } from 'vitest'
import { pipe, Array as EffectArray, Match } from 'effect'
import {
  allBlocks,
  stoneBlock,
  dirtBlock,
  grassBlock,
  cobblestoneBlock,
  sandBlock,
  gravelBlock,
  bedrockBlock,
  oakLogBlock,
  oakPlanksBlock,
  coalOreBlock,
  ironOreBlock,
  diamondOreBlock,
  glassBlock,
  torchBlock,
  waterBlock,
  lavaBlock,
  furnaceBlock,
  craftingTableBlock,
  chestBlock,
} from '../blocks'
import type { BlockType, BlockCategory } from '../BlockType'

describe('blocks', () => {
  describe('Block definitions', () => {
    it('53種類のブロックが定義されている', () => {
      expect(allBlocks.length).toBe(53)
    })

    it('全てのブロックが必須フィールドを持つ', () => {
      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          expect(block.id).toBeDefined()
          expect(block.name).toBeDefined()
          expect(block.category).toBeDefined()
          expect(block.texture).toBeDefined()
          expect(block.physics).toBeDefined()
          expect(block.tool).toBeDefined()
          expect(block.minToolLevel).toBeDefined()
          expect(block.drops).toBeDefined()
          expect(block.sound).toBeDefined()
          expect(block.stackSize).toBeDefined()
          expect(block.tags).toBeDefined()
        })
      )
    })

    it('全てのブロックIDがユニーク', () => {
      const ids = pipe(
        allBlocks,
        EffectArray.map((block) => block.id)
      )
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(allBlocks.length)
    })
  })

  describe('Natural blocks', () => {
    const naturalBlocks = [stoneBlock, dirtBlock, grassBlock, sandBlock, gravelBlock, bedrockBlock]

    it('自然ブロックが正しくカテゴリー分けされている', () => {
      pipe(
        naturalBlocks,
        EffectArray.forEach((block) => {
          expect(block.category).toBe('natural')
        })
      )
    })

    it('stoneBlockが正しく定義されている', () => {
      expect(stoneBlock.id).toBe('stone')
      expect(stoneBlock.name).toBe('Stone')
      expect(stoneBlock.texture).toBe('stone')
      expect(stoneBlock.physics.hardness).toBe(1.5)
      expect(stoneBlock.tool).toBe('pickaxe')
    })

    it('grassBlockが面別テクスチャを持つ', () => {
      pipe(
        grassBlock.texture,
        Match.value,
        Match.when(
          (texture): texture is string => typeof texture === 'string',
          () => expect.fail('草ブロックは面別テクスチャを持つべき')
        ),
        Match.when(
          (
            texture
          ): texture is { top: string; bottom: string; north: string; south: string; east: string; west: string } =>
            typeof texture === 'object' && texture !== null && 'top' in texture,
          (texture) => {
            expect(texture.top).toBe('grass_block_top')
            expect(texture.bottom).toBe('dirt')
            expect(texture.north).toBe('grass_block_side')
          }
        ),
        Match.exhaustive
      )
    })

    it('重力影響ブロックが正しく設定されている', () => {
      expect(sandBlock.physics.gravity).toBe(true)
      expect(gravelBlock.physics.gravity).toBe(true)
      expect(stoneBlock.physics.gravity).toBe(false)
    })

    it('bedrockが破壊不可', () => {
      expect(bedrockBlock.physics.hardness).toBe(-1.0)
      expect(bedrockBlock.physics.resistance).toBe(3600000.0)
    })
  })

  describe('Wood blocks', () => {
    it('原木ブロックが面別テクスチャを持つ', () => {
      pipe(
        oakLogBlock.texture,
        Match.value,
        Match.when(
          (
            texture
          ): texture is { top: string; bottom: string; north: string; south: string; east: string; west: string } =>
            typeof texture === 'object' && texture !== null && 'top' in texture,
          (texture) => {
            expect(texture.top).toBe('oak_log_top')
            expect(texture.bottom).toBe('oak_log_top')
            expect(texture.north).toBe('oak_log')
          }
        ),
        Match.orElse(() => expect.fail('原木は面別テクスチャを持つべき'))
      )
    })

    it('木材ブロックが可燃性', () => {
      expect(oakLogBlock.physics.flammable).toBe(true)
      expect(oakPlanksBlock.physics.flammable).toBe(true)
    })

    it('木材は斧で採掘', () => {
      expect(oakLogBlock.tool).toBe('axe')
      expect(oakPlanksBlock.tool).toBe('axe')
    })
  })

  describe('Ore blocks', () => {
    const oreBlocks = [coalOreBlock, ironOreBlock, diamondOreBlock]

    it('鉱石ブロックが正しいツールレベルを持つ', () => {
      expect(coalOreBlock.minToolLevel).toBe(0) // 木のツルハシ
      expect(ironOreBlock.minToolLevel).toBe(1) // 石のツルハシ
      expect(diamondOreBlock.minToolLevel).toBe(2) // 鉄のツルハシ
    })

    it('鉱石ブロックがツルハシで採掘', () => {
      pipe(
        oreBlocks,
        EffectArray.forEach((block) => {
          expect(block.tool).toBe('pickaxe')
        })
      )
    })

    it('鉱石ブロックがドロップアイテムを持つ', () => {
      pipe(
        oreBlocks,
        EffectArray.forEach((block) => {
          expect(block.drops.length).toBeGreaterThan(0)
        })
      )
    })
  })

  describe('Building blocks', () => {
    it('ガラスが透明', () => {
      expect(glassBlock.physics.opacity).toBe(0)
    })

    it('ガラスがドロップしない', () => {
      expect(glassBlock.drops).toEqual([])
    })

    it('建築ブロックのカテゴリー', () => {
      expect(glassBlock.category).toBe('building')
      expect(cobblestoneBlock.category).toBe('building')
    })
  })

  describe('Light-emitting blocks', () => {
    it('発光ブロックが光度を持つ', () => {
      expect(torchBlock.physics.luminance).toBe(14)
      expect(lavaBlock.physics.luminance).toBe(15)
    })
  })

  describe('Liquid blocks', () => {
    it('液体ブロックが破壊不可', () => {
      expect(waterBlock.physics.hardness).toBe(-1.0)
      expect(lavaBlock.physics.hardness).toBe(-1.0)
    })

    it('液体ブロックが非固体', () => {
      expect(waterBlock.physics.solid).toBe(false)
      expect(lavaBlock.physics.solid).toBe(false)
    })

    it('液体ブロックが置換可能', () => {
      expect(waterBlock.physics.replaceable).toBe(true)
      expect(lavaBlock.physics.replaceable).toBe(true)
    })

    it('液体ブロックのスタックサイズが1', () => {
      expect(waterBlock.stackSize).toBe(1)
      expect(lavaBlock.stackSize).toBe(1)
    })
  })

  describe('Technical blocks', () => {
    const technicalBlocks = [furnaceBlock, craftingTableBlock, chestBlock]

    it('技術ブロックがmiscellaneousカテゴリー', () => {
      pipe(
        technicalBlocks,
        EffectArray.forEach((block) => {
          expect(block.category).toBe('miscellaneous')
        })
      )
    })

    it('かまどが面別テクスチャを持つ', () => {
      pipe(
        furnaceBlock.texture,
        Match.value,
        Match.when(
          (
            texture
          ): texture is { top: string; bottom: string; north: string; south: string; east: string; west: string } =>
            typeof texture === 'object' && texture !== null && 'top' in texture,
          (texture) => {
            expect(texture.north).toBe('furnace_front')
            expect(texture.south).toBe('furnace_side')
          }
        ),
        Match.orElse(() => expect.fail('かまどは面別テクスチャを持つべき'))
      )
    })
  })

  describe('Block categories distribution', () => {
    it('全てのカテゴリーにブロックが存在する', () => {
      const categoryCounts = new Map<string, number>()
      allBlocks.forEach((block) => {
        categoryCounts.set(block.category, (categoryCounts.get(block.category) || 0) + 1)
      })

      expect(categoryCounts.get('natural')).toBeGreaterThanOrEqual(10)
      expect(categoryCounts.get('building')).toBeGreaterThanOrEqual(10)
      expect(categoryCounts.get('decoration')).toBeGreaterThanOrEqual(3)
      expect(categoryCounts.get('miscellaneous')).toBeGreaterThanOrEqual(3)
      expect(categoryCounts.get('redstone')).toBeGreaterThanOrEqual(2)
      expect(categoryCounts.get('food')).toBeGreaterThanOrEqual(1)
    })

    it('カテゴリーが有効な値のみ', () => {
      const validCategories: BlockCategory[] = [
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

      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          expect(validCategories).toContain(block.category)
        })
      )
    })
  })

  describe('Block physics consistency', () => {
    it('全てのブロックの光度が0-15の範囲', () => {
      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          expect(block.physics.luminance).toBeGreaterThanOrEqual(0)
          expect(block.physics.luminance).toBeLessThanOrEqual(15)
        })
      )
    })

    it('全てのブロックの不透明度が0-15の範囲', () => {
      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          expect(block.physics.opacity).toBeGreaterThanOrEqual(0)
          expect(block.physics.opacity).toBeLessThanOrEqual(15)
        })
      )
    })

    it('スタックサイズが1または64', () => {
      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          expect([1, 64]).toContain(block.stackSize)
        })
      )
    })
  })

  describe('Tool requirements', () => {
    it('全てのブロックが有効なツールタイプを持つ', () => {
      const validTools = ['none', 'pickaxe', 'axe', 'shovel', 'hoe', 'shears', 'sword']

      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          expect(validTools).toContain(block.tool)
        })
      )
    })

    it('ツールレベルが0-4の範囲', () => {
      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          expect(block.minToolLevel).toBeGreaterThanOrEqual(0)
          expect(block.minToolLevel).toBeLessThanOrEqual(4)
        })
      )
    })
  })

  describe('Sound configuration', () => {
    it('全てのブロックがサウンド設定を持つ', () => {
      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          expect(block.sound.break).toContain('block.')
          expect(block.sound.place).toContain('block.')
          expect(block.sound.step).toContain('block.')
        })
      )
    })
  })

  describe('Texture configuration', () => {
    it('全てのブロックがテクスチャを持つ', () => {
      pipe(
        allBlocks,
        EffectArray.forEach((block) => {
          pipe(
            block.texture,
            Match.value,
            Match.when(
              (texture): texture is string => typeof texture === 'string',
              (texture) => expect(texture).not.toBe('')
            ),
            Match.when(
              (
                texture
              ): texture is { top: string; bottom: string; north: string; south: string; east: string; west: string } =>
                typeof texture === 'object' && texture !== null && 'top' in texture,
              (texture) => {
                expect(texture.top).toBeDefined()
                expect(texture.bottom).toBeDefined()
                expect(texture.north).toBeDefined()
                expect(texture.south).toBeDefined()
                expect(texture.east).toBeDefined()
                expect(texture.west).toBeDefined()
              }
            ),
            Match.exhaustive
          )
        })
      )
    })
  })
})
