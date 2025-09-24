import { describe, expect } from 'vitest'
import { Effect } from 'effect'
import { it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import {
  HealthSchema,
  HungerSchema,
  ExperienceSchema,
  LevelSchema,
  ScoreSchema,
  StackSizeSchema,
  DurabilitySchema,
  GameBrands,
  type Health,
  type Hunger,
  type Experience,
  type Level,
  type Score,
  type StackSize,
  type Durability,
} from '../game-brands'

describe('Game Brand Types', () => {
  describe('HealthSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 1, 10, 20, 5.5, 15.7]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(HealthSchema)(value)).not.toThrow()
        })
      })
    )

    it.effect('境界値をテストする', () =>
      Effect.gen(function* () {
        expect(() => Schema.decodeSync(HealthSchema)(0)).not.toThrow()
        expect(() => Schema.decodeSync(HealthSchema)(20)).not.toThrow()
      })
    )
  })

  describe('HungerSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 1, 10, 20, 15.5]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(HungerSchema)(value)).not.toThrow()
        })
      })
    )
  })

  describe('ExperienceSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 100, 1000, 50000, 1000000]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(ExperienceSchema)(value)).not.toThrow()
        })
      })
    )
  })

  describe('LevelSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 1, 10, 30, 100, 1000]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(LevelSchema)(value)).not.toThrow()
        })
      })
    )
  })

  describe('ScoreSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 500, 10000, 1000000]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(ScoreSchema)(value)).not.toThrow()
        })
      })
    )
  })

  describe('StackSizeSchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [1, 16, 32, 64]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(StackSizeSchema)(value)).not.toThrow()
        })
      })
    )

    it.effect('境界値をテストする', () =>
      Effect.gen(function* () {
        expect(() => Schema.decodeSync(StackSizeSchema)(1)).not.toThrow()
        expect(() => Schema.decodeSync(StackSizeSchema)(64)).not.toThrow()
      })
    )
  })

  describe('DurabilitySchema', () => {
    it.effect('正常な値を受け入れる', () =>
      Effect.gen(function* () {
        const validValues = [0, 1, 100, 500, 1000]

        validValues.forEach((value) => {
          expect(() => Schema.decodeSync(DurabilitySchema)(value)).not.toThrow()
        })
      })
    )
  })

  describe('GameBrands helpers', () => {
    describe('Health helpers', () => {
      it.effect('createHealth - 正常な体力を作成する', () =>
        Effect.gen(function* () {
          const health = GameBrands.createHealth(15)
          expect(health).toBe(15)
        })
      )

      it.effect('fullHealth - 満タンの体力を作成する', () =>
        Effect.gen(function* () {
          const health = GameBrands.fullHealth()
          expect(health).toBe(20)
        })
      )
    })

    describe('Hunger helpers', () => {
      it.effect('createHunger - 正常な空腹度を作成する', () =>
        Effect.gen(function* () {
          const hunger = GameBrands.createHunger(10)
          expect(hunger).toBe(10)
        })
      )

      it.effect('fullHunger - 満タンの空腹度を作成する', () =>
        Effect.gen(function* () {
          const hunger = GameBrands.fullHunger()
          expect(hunger).toBe(20)
        })
      )
    })

    describe('Experience and Level helpers', () => {
      it.effect('createExperience - 正常な経験値を作成する', () =>
        Effect.gen(function* () {
          const exp = GameBrands.createExperience(1000)
          expect(exp).toBe(1000)
        })
      )

      it.effect('createLevel - 正常なレベルを作成する', () =>
        Effect.gen(function* () {
          const level = GameBrands.createLevel(50)
          expect(level).toBe(50)
        })
      )

      it.effect('levelFromExperience - 経験値からレベルを計算する', () =>
        Effect.gen(function* () {
          const exp0: Experience = GameBrands.createExperience(0)
          const exp100: Experience = GameBrands.createExperience(100)
          const exp400: Experience = GameBrands.createExperience(400)
          const exp10000: Experience = GameBrands.createExperience(10000)

          expect(GameBrands.levelFromExperience(exp0)).toBe(0)
          expect(GameBrands.levelFromExperience(exp100)).toBe(1) // floor(sqrt(100/100)) = 1
          expect(GameBrands.levelFromExperience(exp400)).toBe(2) // floor(sqrt(400/100)) = 2
          expect(GameBrands.levelFromExperience(exp10000)).toBe(10) // floor(sqrt(10000/100)) = 10
        })
      )

      it.effect('levelFromExperience - 上限を超える場合は1000に制限される', () =>
        Effect.gen(function* () {
          const hugExp: Experience = GameBrands.createExperience(100000000) // 非常に大きな経験値
          const level = GameBrands.levelFromExperience(hugExp)
          expect(level).toBe(1000)
        })
      )
    })

    describe('Score helpers', () => {
      it.effect('createScore - 正常なスコアを作成する', () =>
        Effect.gen(function* () {
          const score = GameBrands.createScore(50000)
          expect(score).toBe(50000)
        })
      )
    })

    describe('StackSize helpers', () => {
      it.effect('createStackSize - 正常なスタックサイズを作成する', () =>
        Effect.gen(function* () {
          const stackSize = GameBrands.createStackSize(32)
          expect(stackSize).toBe(32)
        })
      )

      it.effect('defaultStackSize - デフォルトスタックサイズを作成する', () =>
        Effect.gen(function* () {
          const stackSize = GameBrands.defaultStackSize()
          expect(stackSize).toBe(64)
        })
      )

      it.effect('singleStack - 単一スタックを作成する', () =>
        Effect.gen(function* () {
          const stackSize = GameBrands.singleStack()
          expect(stackSize).toBe(1)
        })
      )
    })

    describe('Durability helpers', () => {
      it.effect('createDurability - 正常な耐久度を作成する', () =>
        Effect.gen(function* () {
          const durability = GameBrands.createDurability(500)
          expect(durability).toBe(500)
        })
      )

      it.effect('maxDurability - 最大耐久度を作成する', () =>
        Effect.gen(function* () {
          const durability = GameBrands.maxDurability()
          expect(durability).toBe(1000)
        })
      )

      it.effect('isBroken - アイテムの破損状態を判定する', () =>
        Effect.gen(function* () {
          const broken: Durability = GameBrands.createDurability(0)
          const notBroken: Durability = GameBrands.createDurability(1)

          expect(GameBrands.isBroken(broken)).toBe(true)
          expect(GameBrands.isBroken(notBroken)).toBe(false)
        })
      )

      it.effect('durabilityPercentage - 耐久度の割合を計算する', () =>
        Effect.gen(function* () {
          const current50: Durability = GameBrands.createDurability(50)
          const current100: Durability = GameBrands.createDurability(100)
          const max100: Durability = GameBrands.createDurability(100)
          const maxZero: Durability = GameBrands.createDurability(0)

          expect(GameBrands.durabilityPercentage(current50, max100)).toBe(50)
          expect(GameBrands.durabilityPercentage(current100, max100)).toBe(100)
          expect(GameBrands.durabilityPercentage(current50, maxZero)).toBe(0) // ゼロ除算対策
        })
      )
    })
  })

  describe('実用的なゲームシナリオテスト', () => {
    it.effect('プレイヤー状態の管理', () =>
      Effect.gen(function* () {
        const maxHealth = GameBrands.fullHealth()
        const currentHealth = GameBrands.createHealth(15)
        const maxHunger = GameBrands.fullHunger()
        const currentHunger = GameBrands.createHunger(12)

        expect(maxHealth).toBe(20)
        expect(currentHealth).toBe(15)
        expect(maxHunger).toBe(20)
        expect(currentHunger).toBe(12)
      })
    )

    it.effect('アイテムスタック管理', () =>
      Effect.gen(function* () {
        const stoneStack = GameBrands.defaultStackSize() // 64
        const toolStack = GameBrands.singleStack() // 1
        const customStack = GameBrands.createStackSize(16)

        expect(stoneStack).toBe(64)
        expect(toolStack).toBe(1)
        expect(customStack).toBe(16)
      })
    )

    it.effect('レベルとスコアの進行', () =>
      Effect.gen(function* () {
        const startExp = GameBrands.createExperience(0)
        const midExp = GameBrands.createExperience(1000)
        const highExp = GameBrands.createExperience(10000)

        const startLevel = GameBrands.levelFromExperience(startExp)
        const midLevel = GameBrands.levelFromExperience(midExp)
        const highLevel = GameBrands.levelFromExperience(highExp)

        expect(startLevel).toBe(0)
        expect(midLevel).toBe(3) // floor(sqrt(1000/100)) = 3
        expect(highLevel).toBe(10) // floor(sqrt(10000/100)) = 10

        // レベルが経験値に応じて適切に増加することを確認
        expect(highLevel).toBeGreaterThan(midLevel)
        expect(midLevel).toBeGreaterThan(startLevel)
      })
    )

    it.effect('アイテム耐久度の管理', () =>
      Effect.gen(function* () {
        const newTool = GameBrands.maxDurability()
        const damagedTool = GameBrands.createDurability(250)
        const brokenTool = GameBrands.createDurability(0)

        expect(GameBrands.isBroken(newTool)).toBe(false)
        expect(GameBrands.isBroken(damagedTool)).toBe(false)
        expect(GameBrands.isBroken(brokenTool)).toBe(true)

        expect(GameBrands.durabilityPercentage(newTool, newTool)).toBe(100)
        expect(GameBrands.durabilityPercentage(damagedTool, newTool)).toBe(25)
        expect(GameBrands.durabilityPercentage(brokenTool, newTool)).toBe(0)
      })
    )
  })

  describe('型の互換性テスト', () => {
    it.effect('異なるBrand型は互換性がない', () =>
      Effect.gen(function* () {
        const health: Health = GameBrands.createHealth(20)
        const hunger: Hunger = GameBrands.createHunger(20)

        // 値は同じだが、型として区別される
        expect(health).toBe(hunger) // 値レベルでは同じ
        expect(typeof health).toBe('number')
        expect(typeof hunger).toBe('number')
      })
    )

    it.effect('整数型と非整数型の区別', () =>
      Effect.gen(function* () {
        const experience: Experience = GameBrands.createExperience(1000) // 整数のみ
        const health: Health = GameBrands.createHealth(15.5) // 小数点可

        expect(Number.isInteger(experience)).toBe(true)
        expect(Number.isInteger(health)).toBe(false)
      })
    )
  })
})
