# 高度なテスト技法ガイド

このドキュメントでは、TypeScript Minecraftプロジェクトにおける高度なテスト技法と、テストの保守性・効率性を最大化するための実践的なパターンを提供します。

## 目次

1. [テストのデバッグ効率化](#テストのデバッグ効率化)
2. [スナップショットテスト戦略](#スナップショットテスト戦略)
3. [ビジュアルリグレッションテスト](#ビジュアルリグレッションテスト)
4. [契約テスト (Contract Testing)](#契約テスト-contract-testing)
5. [ゴールデンファイルテスト](#ゴールデンファイルテスト)
6. [テストダブルの高度な活用](#テストダブルの高度な活用)
7. [テストのメンテナンス戦略](#テストのメンテナンス戦略)
8. [テストパフォーマンス最適化](#テストパフォーマンス最適化)
9. [アクセシビリティテスト](#アクセシビリティテスト)
10. [セキュリティテスト](#セキュリティテスト)

## テストのデバッグ効率化

### 1. 詳細なエラーメッセージ

```typescript
import { Effect, pipe } from 'effect'
import { expect } from 'vitest'

// カスタムマッチャーで詳細なエラー情報を提供
expect.extend({
  toMatchBlock(received: Block, expected: BlockProperties) {
    const mismatches: string[] = []

    if (received.type !== expected.type) {
      mismatches.push(
        `Block type mismatch:\n` +
        `  Expected: ${expected.type}\n` +
        `  Received: ${received.type}\n` +
        `  At position: (${received.position.x}, ${received.position.y}, ${received.position.z})`
      )
    }

    if (received.metadata && expected.metadata) {
      const metadataDiff = diffObjects(received.metadata, expected.metadata)
      if (metadataDiff.length > 0) {
        mismatches.push(
          `Metadata differences:\n` +
          metadataDiff.map(d => `  ${d.path}: ${d.expected} → ${d.actual}`).join('\n')
        )
      }
    }

    return {
      pass: mismatches.length === 0,
      message: () => mismatches.join('\n\n'),
      actual: received,
      expected
    }
  }
})

// 使用例
describe('Block Placement', () => {
  it('ブロックが正しく配置される', () => {
    const block = placeBlock(position, BlockType.Stone)

    // 詳細なエラーメッセージが表示される
    expect(block).toMatchBlock({
      type: BlockType.Stone,
      metadata: { hardness: 1.5, toolRequired: 'pickaxe' }
    })
  })
})
```

### 2. テスト実行のトレーシング

```typescript
import { Effect, Console } from 'effect'

// テスト実行のトレースを記録
export const withTestTracing = <A, E, R>(
  testName: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  pipe(
    effect,
    Effect.tap(() => Console.log(`[START] ${testName}`)),
    Effect.tapError(error => Console.error(`[ERROR] ${testName}:`, error)),
    Effect.tap(() => Console.log(`[END] ${testName}`)),
    Effect.withSpan(testName, { attributes: { test: true } })
  )

// デバッグモードでの詳細ログ
export const debugTest = <T>(name: string, value: T): T => {
  if (process.env.DEBUG_TESTS === 'true') {
    console.log(`[DEBUG] ${name}:`, JSON.stringify(value, null, 2))
  }
  return value
}

describe('Complex Game Flow', () => {
  it('複雑なゲームフローをトレース付きでテスト', async () => {
    await Effect.runPromise(
      pipe(
        withTestTracing('player-spawn', spawnPlayer('TestPlayer')),
        Effect.flatMap(player =>
          withTestTracing('move-player', movePlayer(player, { x: 10, y: 64, z: 10 }))
        ),
        Effect.flatMap(player =>
          withTestTracing('place-block', placeBlockAsPlayer(player, BlockType.Wood))
        ),
        Effect.tap(result => debugTest('final-result', result))
      )
    )
  })
})
```

### 3. テスト失敗時のスナップショット自動保存

```typescript
import * as fs from 'fs/promises'
import { format } from 'date-fns'

class TestFailureRecorder {
  private static readonly FAILURE_DIR = '.test-failures'

  static async recordFailure(
    testName: string,
    error: Error,
    context: any
  ): Promise<void> {
    const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss')
    const fileName = `${testName.replace(/\s+/g, '-')}-${timestamp}.json`
    const filePath = `${this.FAILURE_DIR}/${fileName}`

    await fs.mkdir(this.FAILURE_DIR, { recursive: true })

    await fs.writeFile(filePath, JSON.stringify({
      testName,
      timestamp,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      environment: {
        node: process.version,
        platform: process.platform,
        memory: process.memoryUsage()
      }
    }, null, 2))

    console.log(`Test failure recorded: ${filePath}`)
  }

  static async generateFailureReport(): Promise<string> {
    const files = await fs.readdir(this.FAILURE_DIR)
    const failures = await Promise.all(
      files.map(async file => {
        const content = await fs.readFile(`${this.FAILURE_DIR}/${file}`, 'utf-8')
        return JSON.parse(content)
      })
    )

    // パターン分析
    const patterns = this.analyzeFailurePatterns(failures)

    return `
# Test Failure Report

## Summary
- Total failures: ${failures.length}
- Unique tests: ${new Set(failures.map(f => f.testName)).size}
- Time range: ${this.getTimeRange(failures)}

## Common Patterns
${patterns.map(p => `- ${p.pattern}: ${p.count} occurrences`).join('\n')}

## Recommendations
${this.generateRecommendations(patterns)}
    `
  }

  private static analyzeFailurePatterns(failures: any[]): FailurePattern[] {
    // エラーメッセージのパターンを分析
    const patterns = new Map<string, number>()

    failures.forEach(failure => {
      const pattern = this.extractPattern(failure.error.message)
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1)
    })

    return Array.from(patterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
  }

  private static extractPattern(errorMessage: string): string {
    // 数値や特定の値を汎化してパターンを抽出
    return errorMessage
      .replace(/\d+/g, '<number>')
      .replace(/0x[0-9a-fA-F]+/g, '<hex>')
      .replace(/["'][^"']+["']/g, '<string>')
  }
}
```

## スナップショットテスト戦略

### 1. インラインスナップショット

```typescript
import { expect } from 'vitest'

describe('World Generation', () => {
  it('バイオーム配置のスナップショット', () => {
    const world = generateWorld({ seed: 12345, size: 16 })
    const biomeMap = world.getBiomeMap()

    // インラインスナップショット（初回実行時に自動更新）
    expect(biomeMap).toMatchInlineSnapshot(`
      [
        ["plains", "plains", "forest", "forest"],
        ["plains", "river", "forest", "mountains"],
        ["desert", "river", "plains", "mountains"],
        ["desert", "desert", "plains", "plains"]
      ]
    `)
  })

  it('構造体生成のスナップショット', () => {
    const structure = generateStructure('village', { seed: 99999 })

    // 重要な部分のみをスナップショット
    expect({
      buildingCount: structure.buildings.length,
      roadLength: structure.roads.totalLength,
      population: structure.villagers.length,
      layout: structure.layout.type
    }).toMatchInlineSnapshot(`
      {
        "buildingCount": 12,
        "roadLength": 145,
        "population": 8,
        "layout": "circular"
      }
    `)
  })
})
```

### 2. カスタムシリアライザー

```typescript
// test-utils/snapshot-serializers.ts
import { Plugin } from 'pretty-format'

// Three.jsオブジェクトのシリアライザー
export const Vector3Serializer: Plugin = {
  test: (value) => value && value.isVector3,
  serialize: (value, config, indentation, depth, refs, printer) => {
    return `Vector3(${value.x}, ${value.y}, ${value.z})`
  }
}

// エンティティのシリアライザー
export const EntitySerializer: Plugin = {
  test: (value) => value && value._tag === 'Entity',
  serialize: (value, config, indentation, depth, refs, printer) => {
    const indent = indentation + config.indent
    return `Entity {
${indent}id: "${value.id}"
${indent}type: "${value.type}"
${indent}position: ${printer(value.position, config, indent, depth + 1, refs)}
${indent}health: ${value.health}/${value.maxHealth}
${indentation}}`
  }
}

// vitest.config.ts で登録
export default defineConfig({
  test: {
    snapshotSerializers: [
      './test-utils/snapshot-serializers.ts'
    ]
  }
})
```

### 3. 動的スナップショット

```typescript
describe('Dynamic Snapshots', () => {
  it('時間依存のデータを正規化してスナップショット', () => {
    const gameState = captureGameState()

    // 動的な値を正規化
    const normalizedState = {
      ...gameState,
      timestamp: '<TIMESTAMP>',
      sessionId: '<SESSION_ID>',
      entities: gameState.entities.map(e => ({
        ...e,
        id: `<ENTITY_${e.type.toUpperCase()}>`,
        createdAt: '<CREATED_AT>'
      }))
    }

    expect(normalizedState).toMatchSnapshot()
  })

  it('差分のみをスナップショット', () => {
    const beforeState = getInitialState()
    const afterState = applyAction(beforeState, { type: 'PLACE_BLOCK' })

    const diff = createStateDiff(beforeState, afterState)

    expect(diff).toMatchSnapshot('state-after-block-placement')
  })
})
```

## ビジュアルリグレッションテスト

### 1. Canvas/WebGLのビジュアルテスト

```typescript
import { test } from '@playwright/test'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

describe('Visual Regression', () => {
  test('レンダリング結果の視覚的テスト', async ({ page }) => {
    await page.goto('/game')
    await page.waitForSelector('canvas')

    // ゲームを特定の状態にする
    await page.evaluate(() => {
      window.game.loadTestScene('desert-temple')
      window.game.setCameraPosition(100, 50, 100)
      window.game.setTimeOfDay('noon')
    })

    // スクリーンショットを取得
    const screenshot = await page.locator('canvas').screenshot()

    // 基準画像と比較
    const baseline = await fs.readFile('test/visual/baseline/desert-temple.png')
    const img1 = PNG.sync.read(baseline)
    const img2 = PNG.sync.read(screenshot)
    const { width, height } = img1
    const diff = new PNG({ width, height })

    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      {
        threshold: 0.1, // 10%の差異まで許容
        includeAA: true // アンチエイリアスを考慮
      }
    )

    const diffPercentage = (numDiffPixels / (width * height)) * 100

    expect(diffPercentage).toBeLessThan(1) // 1%未満の差異

    if (diffPercentage > 0) {
      // 差分画像を保存
      await fs.writeFile(
        'test/visual/diff/desert-temple-diff.png',
        PNG.sync.write(diff)
      )
    }
  })

  test('パーティクルエフェクトのビジュアルテスト', async ({ page }) => {
    await page.goto('/game')

    // パーティクルエフェクトをトリガー
    await page.evaluate(() => {
      window.game.spawnParticles('explosion', { x: 0, y: 0, z: 0 })
    })

    // アニメーションの複数フレームをキャプチャ
    const frames = []
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(100) // 100msごと
      const frame = await page.locator('canvas').screenshot()
      frames.push(frame)
    }

    // 各フレームが期待通りに変化しているか確認
    for (let i = 1; i < frames.length; i++) {
      const diff = compareFrames(frames[i - 1], frames[i])
      expect(diff).toBeGreaterThan(0) // フレーム間で変化がある
      expect(diff).toBeLessThan(50) // しかし変化は50%未満
    }
  })
})
```

### 2. シェーダーのビジュアルテスト

```typescript
describe('Shader Visual Tests', () => {
  it('水面シェーダーの波紋効果', async () => {
    const renderer = createTestRenderer()
    const waterShader = new WaterShader()

    // テスト用のシーンを構築
    const scene = new THREE.Scene()
    const waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      waterShader.material
    )
    scene.add(waterMesh)

    // 時間経過による変化をテスト
    const snapshots = []
    for (let time = 0; time < 2; time += 0.5) {
      waterShader.uniforms.time.value = time
      renderer.render(scene, camera)

      const imageData = renderer.domElement.toDataURL()
      snapshots.push(imageData)
    }

    // 各スナップショットが異なることを確認（アニメーション）
    expect(new Set(snapshots).size).toBe(snapshots.length)

    // 基準スナップショットと比較
    expect(snapshots[0]).toMatchImageSnapshot({
      customSnapshotIdentifier: 'water-shader-t0'
    })
  })
})
```

## 契約テスト (Contract Testing)

### 1. API契約テスト

```typescript
import { Schema } from 'effect'

// API契約の定義
const PlayerAPIContract = {
  getPlayer: {
    request: Schema.Struct({
      playerId: Schema.String.pipe(Schema.uuid)
    }),
    response: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      position: Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
        z: Schema.Number
      }),
      health: Schema.Number.pipe(Schema.between(0, 100))
    }),
    errors: {
      PlayerNotFound: Schema.Struct({
        code: Schema.Literal('PLAYER_NOT_FOUND'),
        playerId: Schema.String
      })
    }
  }
}

describe('API Contract Tests', () => {
  it('クライアントとサーバーの契約が一致', async () => {
    // サーバー側の実装
    const serverImplementation = {
      getPlayer: async (request: unknown) => {
        const validated = Schema.decodeUnknownSync(
          PlayerAPIContract.getPlayer.request
        )(request)

        // 実際の処理...
        const response = await fetchPlayer(validated.playerId)

        // レスポンスが契約に準拠
        return Schema.decodeUnknownSync(
          PlayerAPIContract.getPlayer.response
        )(response)
      }
    }

    // クライアント側の期待
    const clientExpectation = async (playerId: string) => {
      const request = { playerId }

      // リクエストが契約に準拠
      const validRequest = Schema.decodeUnknownSync(
        PlayerAPIContract.getPlayer.request
      )(request)

      const response = await api.getPlayer(validRequest)

      // レスポンスが契約に準拠
      return Schema.decodeUnknownSync(
        PlayerAPIContract.getPlayer.response
      )(response)
    }

    // 契約の検証
    const testPlayerId = '123e4567-e89b-12d3-a456-426614174000'
    const serverResponse = await serverImplementation.getPlayer({ playerId: testPlayerId })
    const clientResponse = await clientExpectation(testPlayerId)

    expect(serverResponse).toEqual(clientResponse)
  })
})
```

### 2. モジュール間契約テスト

```typescript
// モジュール間の契約定義
interface ChunkGeneratorContract {
  generateChunk(coord: ChunkCoordinate): Effect.Effect<Chunk, ChunkGenerationError>
  getRequirements(): ChunkGenerationRequirements
}

interface ChunkConsumerContract {
  consumeChunk(chunk: Chunk): Effect.Effect<void, ChunkConsumptionError>
  acceptedChunkVersion(): string
}

describe('Module Contract Tests', () => {
  it('ChunkGeneratorとChunkConsumerの契約が適合', async () => {
    const generator: ChunkGeneratorContract = new TerrainGenerator()
    const consumer: ChunkConsumerContract = new ChunkRenderer()

    // バージョン互換性チェック
    const requirements = generator.getRequirements()
    const acceptedVersion = consumer.acceptedChunkVersion()

    expect(requirements.outputVersion).toBe(acceptedVersion)

    // データフロー契約のテスト
    const coord = { x: 0, z: 0 }
    const chunk = await Effect.runPromise(generator.generateChunk(coord))

    // Consumerが生成されたチャンクを処理できる
    await expect(
      Effect.runPromise(consumer.consumeChunk(chunk))
    ).resolves.toBeUndefined()
  })
})
```

## ゴールデンファイルテスト

### 1. 出力ファイルの検証

```typescript
import * as fs from 'fs/promises'
import * as path from 'path'

describe('Golden File Tests', () => {
  const GOLDEN_DIR = 'test/golden'

  it('ワールド生成の出力をゴールデンファイルと比較', async () => {
    const world = generateWorld({ seed: 'golden-test-seed' })
    const output = world.serialize()

    const goldenPath = path.join(GOLDEN_DIR, 'world-generation.golden.json')

    if (process.env.UPDATE_GOLDEN === 'true') {
      // ゴールデンファイルを更新
      await fs.writeFile(goldenPath, JSON.stringify(output, null, 2))
      console.log(`Updated golden file: ${goldenPath}`)
    } else {
      // ゴールデンファイルと比較
      const golden = JSON.parse(await fs.readFile(goldenPath, 'utf-8'))
      expect(output).toEqual(golden)
    }
  })

  it('複雑な構造のゴールデンファイルテスト', async () => {
    const dungeon = generateDungeon({
      seed: 42,
      size: 'medium',
      difficulty: 'hard'
    })

    // 重要な構造のみを抽出
    const goldenData = {
      roomCount: dungeon.rooms.length,
      totalArea: dungeon.calculateTotalArea(),
      treasureRooms: dungeon.rooms.filter(r => r.hasTreasure).length,
      bossRoom: dungeon.bossRoom !== null,
      connectivity: dungeon.calculateConnectivity(),
      layout: dungeon.rooms.map(r => ({
        id: r.id,
        type: r.type,
        connections: r.connections.map(c => c.targetId).sort()
      }))
    }

    await compareWithGolden('dungeon-structure.golden.json', goldenData)
  })
})

async function compareWithGolden(fileName: string, actual: any) {
  const goldenPath = path.join('test/golden', fileName)

  if (process.env.UPDATE_GOLDEN === 'true') {
    await fs.mkdir(path.dirname(goldenPath), { recursive: true })
    await fs.writeFile(goldenPath, JSON.stringify(actual, null, 2))
    console.log(`✅ Updated golden file: ${fileName}`)
  } else {
    try {
      const expected = JSON.parse(await fs.readFile(goldenPath, 'utf-8'))
      expect(actual).toEqual(expected)
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(
          `Golden file not found: ${fileName}\n` +
          `Run with UPDATE_GOLDEN=true to create it.`
        )
      }
      throw error
    }
  }
}
```

## テストダブルの高度な活用

### 1. スマートモック

```typescript
import { Effect, Ref } from 'effect'

// 状態を持つスマートモック
class SmartMockInventory {
  private items = new Map<string, number>()

  addItem(itemId: string, quantity: number): Effect.Effect<void, InventoryFullError> {
    return Effect.gen(function* () {
      const current = this.items.get(itemId) || 0
      const total = current + quantity

      if (this.getTotalItems() + quantity > 36) {
        return yield* Effect.fail(new InventoryFullError())
      }

      this.items.set(itemId, total)
    }.bind(this))
  }

  removeItem(itemId: string, quantity: number): Effect.Effect<void, ItemNotFoundError> {
    return Effect.gen(function* () {
      const current = this.items.get(itemId) || 0

      if (current < quantity) {
        return yield* Effect.fail(new ItemNotFoundError(itemId))
      }

      this.items.set(itemId, current - quantity)
      if (current - quantity === 0) {
        this.items.delete(itemId)
      }
    }.bind(this))
  }

  private getTotalItems(): number {
    return Array.from(this.items.values()).reduce((sum, q) => sum + q, 0)
  }

  // テスト用のアサーションヘルパー
  assertHasItem(itemId: string, expectedQuantity: number) {
    const actual = this.items.get(itemId) || 0
    expect(actual).toBe(expectedQuantity)
  }

  assertEmpty() {
    expect(this.items.size).toBe(0)
  }
}

describe('Smart Mock Tests', () => {
  it('インベントリ操作の複雑なシナリオ', async () => {
    const inventory = new SmartMockInventory()

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* inventory.addItem('diamond', 5)
        yield* inventory.addItem('iron', 10)
        yield* inventory.removeItem('iron', 3)

        inventory.assertHasItem('diamond', 5)
        inventory.assertHasItem('iron', 7)
      })
    )
  })
})
```

### 2. 条件付きスタブ

```typescript
class ConditionalStub<T> {
  private conditions: Array<{
    predicate: (...args: any[]) => boolean
    response: T | Error
  }> = []

  when(predicate: (...args: any[]) => boolean): {
    thenReturn: (value: T) => void
    thenThrow: (error: Error) => void
  } {
    const condition = { predicate, response: null as any }
    this.conditions.push(condition)

    return {
      thenReturn: (value: T) => {
        condition.response = value
      },
      thenThrow: (error: Error) => {
        condition.response = error
      }
    }
  }

  execute(...args: any[]): T {
    const condition = this.conditions.find(c => c.predicate(...args))

    if (!condition) {
      throw new Error(`No matching condition for arguments: ${JSON.stringify(args)}`)
    }

    if (condition.response instanceof Error) {
      throw condition.response
    }

    return condition.response
  }
}

describe('Conditional Stub Tests', () => {
  it('条件に応じて異なる応答を返す', () => {
    const stubBlockService = new ConditionalStub<Block>()

    stubBlockService
      .when((pos) => pos.y < 0)
      .thenThrow(new Error('Invalid position: below world'))

    stubBlockService
      .when((pos) => pos.y === 0)
      .thenReturn(new Block(BlockType.Bedrock))

    stubBlockService
      .when((pos) => pos.y > 0 && pos.y < 64)
      .thenReturn(new Block(BlockType.Stone))

    stubBlockService
      .when((pos) => pos.y >= 64)
      .thenReturn(new Block(BlockType.Air))

    expect(() => stubBlockService.execute({ y: -1 })).toThrow()
    expect(stubBlockService.execute({ y: 0 }).type).toBe(BlockType.Bedrock)
    expect(stubBlockService.execute({ y: 32 }).type).toBe(BlockType.Stone)
    expect(stubBlockService.execute({ y: 100 }).type).toBe(BlockType.Air)
  })
})
```

### 3. 録画・再生モック

```typescript
class RecordReplayMock<T extends Record<string, any>> {
  private recordings: Array<{
    method: string
    args: any[]
    result: any
    timestamp: number
  }> = []

  private mode: 'record' | 'replay' = 'record'
  private replayIndex = 0

  record(target: T): T {
    this.mode = 'record'

    return new Proxy(target, {
      get: (obj, prop: string) => {
        if (typeof obj[prop] === 'function') {
          return (...args: any[]) => {
            const result = obj[prop](...args)
            this.recordings.push({
              method: prop,
              args,
              result,
              timestamp: Date.now()
            })
            return result
          }
        }
        return obj[prop]
      }
    })
  }

  replay(): T {
    this.mode = 'replay'
    this.replayIndex = 0

    return new Proxy({} as T, {
      get: (_, prop: string) => {
        return (...args: any[]) => {
          if (this.replayIndex >= this.recordings.length) {
            throw new Error('No more recorded calls')
          }

          const recording = this.recordings[this.replayIndex++]

          if (recording.method !== prop) {
            throw new Error(
              `Expected method ${recording.method}, but ${prop} was called`
            )
          }

          if (!this.argsMatch(recording.args, args)) {
            throw new Error(
              `Arguments mismatch for ${prop}\n` +
              `Expected: ${JSON.stringify(recording.args)}\n` +
              `Actual: ${JSON.stringify(args)}`
            )
          }

          return recording.result
        }
      }
    })
  }

  private argsMatch(expected: any[], actual: any[]): boolean {
    return JSON.stringify(expected) === JSON.stringify(actual)
  }

  save(filename: string) {
    fs.writeFileSync(filename, JSON.stringify(this.recordings, null, 2))
  }

  load(filename: string) {
    this.recordings = JSON.parse(fs.readFileSync(filename, 'utf-8'))
  }
}
```

## テストのメンテナンス戦略

### 1. テストコードのリファクタリング

```typescript
// テストユーティリティの共通化
class TestScenarioBuilder {
  private world: World
  private players: Map<string, Player> = new Map()

  constructor() {
    this.world = new World({ seed: 'test' })
  }

  withPlayer(name: string, position?: Position): this {
    const player = new Player({
      name,
      position: position || { x: 0, y: 64, z: 0 }
    })
    this.players.set(name, player)
    this.world.addPlayer(player)
    return this
  }

  withBlock(position: Position, type: BlockType): this {
    this.world.setBlock(position, type)
    return this
  }

  withStructure(type: StructureType, position: Position): this {
    const structure = generateStructure(type)
    this.world.placeStructure(structure, position)
    return this
  }

  playerInteracts(playerName: string, action: Action): this {
    const player = this.players.get(playerName)
    if (!player) throw new Error(`Player ${playerName} not found`)

    this.world.processAction(player, action)
    return this
  }

  build(): { world: World, players: Map<string, Player> } {
    return { world: this.world, players: this.players }
  }
}

// 使いやすいテストシナリオ
describe('Game Scenarios', () => {
  it('プレイヤーが家を建てる', () => {
    const { world, players } = new TestScenarioBuilder()
      .withPlayer('Steve', { x: 0, y: 64, z: 0 })
      .withBlock({ x: 1, y: 64, z: 0 }, BlockType.Wood)
      .withBlock({ x: 2, y: 64, z: 0 }, BlockType.Wood)
      .withBlock({ x: 1, y: 65, z: 0 }, BlockType.Wood)
      .withBlock({ x: 2, y: 65, z: 0 }, BlockType.Wood)
      .playerInteracts('Steve', { type: 'place_door', position: { x: 1, y: 64, z: 0 } })
      .build()

    const steve = players.get('Steve')!
    expect(world.getBlock({ x: 1, y: 64, z: 0 }).type).toBe(BlockType.Door)
    expect(steve.achievements).toContain('first_house')
  })
})
```

### 2. テストの可読性向上

```typescript
// DSL (Domain Specific Language) for tests
class GameTestDSL {
  given = {
    aNewWorld: (seed?: string) => new World({ seed: seed || 'test' }),
    aPlayer: (name: string) => new Player({ name }),
    anItem: (type: ItemType, quantity: number = 1) => new Item(type, quantity)
  }

  when = {
    playerMoves: (player: Player, to: Position) => {
      player.moveTo(to)
      return player
    },
    playerCrafts: (player: Player, recipe: Recipe) => {
      return player.craft(recipe)
    },
    timePassesBy: (world: World, ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        world.tick()
      }
      return world
    }
  }

  then = {
    playerShouldBeAt: (player: Player, position: Position) => {
      expect(player.position).toEqual(position)
    },
    playerShouldHave: (player: Player, item: Item) => {
      expect(player.inventory.has(item)).toBe(true)
    },
    worldShouldHaveBlockAt: (world: World, position: Position, type: BlockType) => {
      expect(world.getBlock(position).type).toBe(type)
    }
  }
}

const game = new GameTestDSL()

describe('Readable Game Tests', () => {
  it('プレイヤーが移動する', () => {
    const world = game.given.aNewWorld()
    const steve = game.given.aPlayer('Steve')

    game.when.playerMoves(steve, { x: 10, y: 64, z: 10 })

    game.then.playerShouldBeAt(steve, { x: 10, y: 64, z: 10 })
  })
})
```

## テストパフォーマンス最適化

### 1. 並列実行の最適化

```typescript
// テストの並列度を制御
describe.concurrent('Parallel Tests', () => {
  // これらのテストは並列実行される
  it.concurrent('heavy calculation 1', async () => {
    const result = await heavyCalculation1()
    expect(result).toBe(42)
  })

  it.concurrent('heavy calculation 2', async () => {
    const result = await heavyCalculation2()
    expect(result).toBe(84)
  })

  it.concurrent('heavy calculation 3', async () => {
    const result = await heavyCalculation3()
    expect(result).toBe(126)
  })
})

// リソース競合を避ける
describe('Resource Intensive Tests', () => {
  const resourcePool = new ResourcePool(3) // 最大3並列

  it('uses shared resource', async () => {
    await resourcePool.use(async (resource) => {
      // リソースを使用したテスト
      const result = await processWithResource(resource)
      expect(result).toBeDefined()
    })
  })
})
```

### 2. テストデータの遅延生成

```typescript
// 重いテストデータの遅延生成
class LazyTestData {
  private cache = new Map<string, any>()

  private generators = {
    largeWorld: () => generateWorld({ size: 1000 }),
    complexDungeon: () => generateDungeon({ rooms: 100 }),
    manyEntities: () => Array.from({ length: 1000 }, (_, i) =>
      new Entity({ id: `entity-${i}` })
    )
  }

  get<K extends keyof typeof this.generators>(
    key: K
  ): ReturnType<typeof this.generators[K]> {
    if (!this.cache.has(key)) {
      console.log(`Generating test data: ${key}`)
      this.cache.set(key, this.generators[key]())
    }
    return this.cache.get(key)
  }

  // テスト後のクリーンアップ
  clear() {
    this.cache.clear()
  }
}

const testData = new LazyTestData()

describe('Performance Optimized Tests', () => {
  afterAll(() => testData.clear())

  it('uses large world only when needed', () => {
    // 必要な時だけ生成される
    const world = testData.get('largeWorld')
    expect(world.size).toBe(1000)
  })

  it('reuses the same large world', () => {
    // キャッシュから取得（高速）
    const world = testData.get('largeWorld')
    expect(world.size).toBe(1000)
  })
})
```

### 3. インクリメンタルテスト

```typescript
// 変更影響分析によるテスト選択
class TestDependencyAnalyzer {
  private dependencyGraph = new Map<string, Set<string>>()

  addDependency(testFile: string, sourceFile: string) {
    if (!this.dependencyGraph.has(sourceFile)) {
      this.dependencyGraph.set(sourceFile, new Set())
    }
    this.dependencyGraph.get(sourceFile)!.add(testFile)
  }

  getAffectedTests(changedFiles: string[]): string[] {
    const affectedTests = new Set<string>()

    for (const file of changedFiles) {
      const tests = this.dependencyGraph.get(file)
      if (tests) {
        tests.forEach(test => affectedTests.add(test))
      }
    }

    return Array.from(affectedTests)
  }
}

// Git差分からテスト対象を決定
async function getTestsToRun(): Promise<string[]> {
  const changedFiles = await getGitChangedFiles()
  const analyzer = new TestDependencyAnalyzer()

  // 依存関係を分析
  await analyzeDependencies(analyzer)

  return analyzer.getAffectedTests(changedFiles)
}
```

## アクセシビリティテスト

### 1. UIアクセシビリティテスト

```typescript
import { axe } from 'jest-axe'

describe('Accessibility Tests', () => {
  it('ゲームメニューがアクセシブル', async () => {
    const { container } = render(<GameMenu />)
    const results = await axe(container)

    expect(results).toHaveNoViolations()
  })

  it('キーボードナビゲーションが機能する', async () => {
    const { getByRole } = render(<InventoryUI />)

    const firstSlot = getByRole('button', { name: 'Slot 1' })
    firstSlot.focus()

    // 矢印キーでナビゲーション
    fireEvent.keyDown(firstSlot, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(getByRole('button', { name: 'Slot 2' }))

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(getByRole('button', { name: 'Slot 11' }))
  })

  it('スクリーンリーダー対応', () => {
    const block = new Block(BlockType.Stone, { x: 0, y: 64, z: 0 })

    expect(block.getAriaLabel()).toBe('Stone block at position 0, 64, 0')
    expect(block.getAriaDescription()).toBe(
      'A solid stone block. Can be mined with a pickaxe.'
    )
  })
})
```

## セキュリティテスト

### 1. 入力検証テスト

```typescript
describe('Security - Input Validation', () => {
  it('SQLインジェクション攻撃を防ぐ', async () => {
    const maliciousInput = "'; DROP TABLE players; --"

    const result = await Effect.runPromiseEither(
      validatePlayerName(maliciousInput)
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(InvalidInputError)
    }
  })

  it('XSS攻撃を防ぐ', () => {
    const xssPayload = '<script>alert("XSS")</script>'
    const sanitized = sanitizeChatMessage(xssPayload)

    expect(sanitized).not.toContain('<script>')
    expect(sanitized).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;')
  })

  it('パストラバーサル攻撃を防ぐ', async () => {
    const maliciousPath = '../../../etc/passwd'

    await expect(
      loadWorldFile(maliciousPath)
    ).rejects.toThrow(SecurityError)
  })
})
```

### 2. 認証・認可テスト

```typescript
describe('Security - Authorization', () => {
  it('管理者以外はサーバーコマンドを実行できない', async () => {
    const normalPlayer = createPlayer({ role: 'player' })
    const adminCommand = { type: 'server_stop' }

    const result = await Effect.runPromiseEither(
      executeCommand(normalPlayer, adminCommand)
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(UnauthorizedError)
    }
  })

  it('レート制限が機能する', async () => {
    const player = createPlayer()
    const requests = Array.from({ length: 100 }, () =>
      Effect.runPromiseEither(
        performAction(player, { type: 'place_block' })
      )
    )

    const results = await Promise.all(requests)
    const failures = results.filter(Either.isLeft)

    // 10リクエスト/秒の制限
    expect(failures.length).toBeGreaterThan(90)
    expect(failures[0].left).toBeInstanceOf(RateLimitError)
  })
})
```

## まとめ

これらの高度なテスト技法を組み合わせることで：

1. **デバッグ効率の向上** - 詳細なエラー情報とトレーシング
2. **視覚的な品質保証** - ビジュアルリグレッションテスト
3. **契約の一貫性** - Contract Testingによるモジュール間の整合性
4. **長期的な安定性** - ゴールデンファイルによる出力の保証
5. **保守性の向上** - DSLとリファクタリング戦略
6. **パフォーマンスの最適化** - 並列実行と遅延生成
7. **包括的な品質** - アクセシビリティとセキュリティの保証

これらのテスト技法を既存のテスト戦略と組み合わせることで、TypeScript Minecraftプロジェクトの品質を最高レベルに保つことができます。