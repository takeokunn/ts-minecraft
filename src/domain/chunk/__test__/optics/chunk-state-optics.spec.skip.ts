/**
 * ChunkStateOptics テストスイート
 *
 * ADT状態への型安全なアクセス・更新システムの包括的テスト
 * 状態遷移とOptics操作の整合性を検証
 */

import { describe, it, expect } from 'vitest'
import { Effect, Match, pipe, Option } from 'effect'
import {
  ChunkStateOptics,
  ChunkStateOpticsHelpers,
  ChunkStateGuards,
  ChunkStateCompoundOperations
} from '../../types/state-optics'
import {
  AdvancedChunkStateOptics,
  ChunkStateTransitionOptics,
  ParallelChunkStateOptics,
  ReactiveChunkStateOptics,
  SafeChunkStateOptics
} from '../../types/advanced-state-optics'
import type {
  ChunkState,
  ChunkTimestamp,
  LoadProgress,
  RetryCount,
  ChangeSet,
  ChunkDataBytes
} from '../../types/core'
import type { ChunkMetadata } from '../../value_object/chunk-metadata'

// テスト用の状態作成ヘルパー
const createTestMetadata = (): ChunkMetadata => ({
  biome: 'plains',
  lightLevel: 15,
  heightMap: new Array(256).fill(64) as any[],
  timestamp: Date.now() as ChunkTimestamp,
  isModified: false
})

const createTestData = (): ChunkDataBytes => new Uint8Array(1024)

const createLoadingState = (): Extract<ChunkState, { _tag: 'Loading' }> => ({
  _tag: 'Loading',
  progress: 50 as LoadProgress,
  startTime: Date.now() as ChunkTimestamp
})

const createLoadedState = (): Extract<ChunkState, { _tag: 'Loaded' }> => ({
  _tag: 'Loaded',
  data: createTestData(),
  loadTime: Date.now() as ChunkTimestamp,
  metadata: createTestMetadata()
})

const createFailedState = (): Extract<ChunkState, { _tag: 'Failed' }> => ({
  _tag: 'Failed',
  error: 'Test error',
  retryCount: 3 as RetryCount,
  lastAttempt: Date.now() as ChunkTimestamp
})

const createDirtyState = (): Extract<ChunkState, { _tag: 'Dirty' }> => ({
  _tag: 'Dirty',
  data: createTestData(),
  changes: {} as ChangeSet,
  metadata: createTestMetadata()
})

const createSavingState = (): Extract<ChunkState, { _tag: 'Saving' }> => ({
  _tag: 'Saving',
  data: createTestData(),
  progress: 75 as LoadProgress,
  metadata: createTestMetadata()
})

const createCachedState = (): Extract<ChunkState, { _tag: 'Cached' }> => ({
  _tag: 'Cached',
  data: createTestData(),
  cacheTime: Date.now() as ChunkTimestamp,
  metadata: createTestMetadata()
})

describe('ChunkStateOptics', () => {
  describe('状態タグアクセス', () => {
    it('状態タグを正確に取得できる', () => {
      const loadingState = createLoadingState()
      const loadedState = createLoadedState()
      const failedState = createFailedState()

      expect(ChunkStateOptics.tag.get(loadingState)).toBe('Loading')
      expect(ChunkStateOptics.tag.get(loadedState)).toBe('Loaded')
      expect(ChunkStateOptics.tag.get(failedState)).toBe('Failed')
    })
  })

  describe('Loading状態への型安全なアクセス', () => {
    it('Loading状態の進行度にアクセスできる', () => {
      const state = createLoadingState()
      const progress = ChunkStateOptics.loadingProgress.get(state)
      expect(progress).toBe(50)
    })

    it('Loading状態の開始時刻にアクセスできる', () => {
      const state = createLoadingState()
      const startTime = ChunkStateOptics.loadingStartTime.get(state)
      expect(typeof startTime).toBe('number')
      expect(startTime).toBeGreaterThan(0)
    })

    it('非Loading状態からはアクセスできない', () => {
      const loadedState = createLoadedState()

      // 非Loading状態では進行度は取得できない（undefinedまたはエラー）
      expect(() => {
        ChunkStateOptics.loadingProgress.get(loadedState)
      }).toThrow()
    })
  })

  describe('Loaded状態への型安全なアクセス', () => {
    it('Loaded状態のデータにアクセスできる', () => {
      const state = createLoadedState()
      const data = ChunkStateOptics.loadedData.get(state)
      expect(data).toBeInstanceOf(Uint8Array)
    })

    it('Loaded状態のロード時刻にアクセスできる', () => {
      const state = createLoadedState()
      const loadTime = ChunkStateOptics.loadedLoadTime.get(state)
      expect(typeof loadTime).toBe('number')
    })

    it('Loaded状態のメタデータにアクセスできる', () => {
      const state = createLoadedState()
      const metadata = ChunkStateOptics.loadedMetadata.get(state)
      expect(metadata.biome).toBe('plains')
      expect(metadata.lightLevel).toBe(15)
    })
  })

  describe('Failed状態への型安全なアクセス', () => {
    it('Failed状態のエラーメッセージにアクセスできる', () => {
      const state = createFailedState()
      const error = ChunkStateOptics.failedError.get(state)
      expect(error).toBe('Test error')
    })

    it('Failed状態のリトライ回数にアクセスできる', () => {
      const state = createFailedState()
      const retryCount = ChunkStateOptics.failedRetryCount.get(state)
      expect(retryCount).toBe(3)
    })

    it('Failed状態の最終試行時刻にアクセスできる', () => {
      const state = createFailedState()
      const lastAttempt = ChunkStateOptics.failedLastAttempt.get(state)
      expect(typeof lastAttempt).toBe('number')
    })
  })

  describe('不変性の検証', () => {
    it('状態更新時に元のオブジェクトが変更されない', () => {
      const originalState = createLoadingState()
      const originalProgress = originalState.progress

      // 進行度を更新
      const updatedState = ChunkStateOptics.loadingProgress.replace(75 as LoadProgress)(originalState)

      // 元のオブジェクトは変更されていない
      expect(originalState.progress).toBe(originalProgress)
      expect(originalState).not.toBe(updatedState)

      // 新しいオブジェクトは更新されている
      expect(ChunkStateOptics.loadingProgress.get(updatedState)).toBe(75)
    })
  })
})

describe('ChunkStateOpticsHelpers', () => {
  describe('Loading状態操作', () => {
    it('進行度を安全に更新できる', () => {
      const state = createLoadingState()
      const updatedState = ChunkStateOpticsHelpers.updateLoadingProgress(state, 80 as LoadProgress)

      expect(ChunkStateOptics.loadingProgress.get(updatedState)).toBe(80)
    })

    it('進行度を変換関数で更新できる', () => {
      const state = createLoadingState()
      const updatedState = ChunkStateOpticsHelpers.modifyLoadingProgress(
        state,
        (progress) => (progress + 25) as LoadProgress
      )

      expect(ChunkStateOptics.loadingProgress.get(updatedState)).toBe(75)
    })
  })

  describe('Failed状態操作', () => {
    it('リトライ回数を増加できる', () => {
      const state = createFailedState()
      const updatedState = ChunkStateOpticsHelpers.incrementRetryCount(state)

      expect(ChunkStateOptics.failedRetryCount.get(updatedState)).toBe(4)
    })

    it('エラーメッセージを更新できる', () => {
      const state = createFailedState()
      const updatedState = ChunkStateOpticsHelpers.updateFailedError(state, 'New error message')

      expect(ChunkStateOptics.failedError.get(updatedState)).toBe('New error message')
    })
  })

  describe('メタデータ操作', () => {
    it('データを持つ状態のメタデータを更新できる', () => {
      const loadedState = createLoadedState()
      const metadataUpdate = { biome: 'desert' as const, lightLevel: 10 }

      const updatedState = ChunkStateOpticsHelpers.updateMetadata(loadedState, metadataUpdate)

      const metadata = ChunkStateOptics.loadedMetadata.get(updatedState)
      expect(metadata.biome).toBe('desert')
      expect(metadata.lightLevel).toBe(10)
    })

    it('データを持たない状態では変更されない', () => {
      const loadingState = createLoadingState()
      const metadataUpdate = { biome: 'desert' as const }

      const result = ChunkStateOpticsHelpers.updateMetadata(loadingState, metadataUpdate)

      // Loading状態はメタデータを持たないため、そのまま返される
      expect(result).toBe(loadingState)
    })
  })
})

describe('ChunkStateGuards', () => {
  describe('状態判定', () => {
    it('Loading状態を正確に判定できる', () => {
      const loadingState = createLoadingState()
      const loadedState = createLoadedState()

      expect(ChunkStateGuards.isLoading(loadingState)).toBe(true)
      expect(ChunkStateGuards.isLoading(loadedState)).toBe(false)
    })

    it('Loaded状態を正確に判定できる', () => {
      const loadedState = createLoadedState()
      const failedState = createFailedState()

      expect(ChunkStateGuards.isLoaded(loadedState)).toBe(true)
      expect(ChunkStateGuards.isLoaded(failedState)).toBe(false)
    })

    it('Failed状態を正確に判定できる', () => {
      const failedState = createFailedState()
      const loadingState = createLoadingState()

      expect(ChunkStateGuards.isFailed(failedState)).toBe(true)
      expect(ChunkStateGuards.isFailed(loadingState)).toBe(false)
    })

    it('データを持つ状態を正確に判定できる', () => {
      const loadedState = createLoadedState()
      const dirtyState = createDirtyState()
      const loadingState = createLoadingState()

      expect(ChunkStateGuards.hasData(loadedState)).toBe(true)
      expect(ChunkStateGuards.hasData(dirtyState)).toBe(true)
      expect(ChunkStateGuards.hasData(loadingState)).toBe(false)
    })

    it('進行度を持つ状態を正確に判定できる', () => {
      const loadingState = createLoadingState()
      const savingState = createSavingState()
      const loadedState = createLoadedState()

      expect(ChunkStateGuards.hasProgress(loadingState)).toBe(true)
      expect(ChunkStateGuards.hasProgress(savingState)).toBe(true)
      expect(ChunkStateGuards.hasProgress(loadedState)).toBe(false)
    })
  })
})

describe('AdvancedChunkStateOptics', () => {
  describe('複数状態対応アクセス', () => {
    it('任意のデータ保持状態からデータにアクセスできる', () => {
      const loadedState = createLoadedState()
      const dirtyState = createDirtyState()

      const loadedData = AdvancedChunkStateOptics.anyStateData.get(loadedState)
      const dirtyData = AdvancedChunkStateOptics.anyStateData.get(dirtyState)

      expect(loadedData).toBeInstanceOf(Uint8Array)
      expect(dirtyData).toBeInstanceOf(Uint8Array)
    })

    it('任意のメタデータ保持状態からメタデータにアクセスできる', () => {
      const cachedState = createCachedState()
      const savingState = createSavingState()

      const cachedMetadata = AdvancedChunkStateOptics.anyStateMetadata.get(cachedState)
      const savingMetadata = AdvancedChunkStateOptics.anyStateMetadata.get(savingState)

      expect(cachedMetadata.biome).toBe('plains')
      expect(savingMetadata.biome).toBe('plains')
    })

    it('任意の進行度保持状態から進行度にアクセスできる', () => {
      const loadingState = createLoadingState()
      const savingState = createSavingState()

      const loadingProgress = AdvancedChunkStateOptics.anyStateProgress.get(loadingState)
      const savingProgress = AdvancedChunkStateOptics.anyStateProgress.get(savingState)

      expect(loadingProgress).toBe(50)
      expect(savingProgress).toBe(75)
    })
  })

  describe('関連タイムスタンプアクセス', () => {
    it('状態に応じて適切なタイムスタンプを取得できる', () => {
      const loadingState = createLoadingState()
      const loadedState = createLoadedState()
      const failedState = createFailedState()

      const loadingTimestamp = AdvancedChunkStateOptics.relevantTimestamp(loadingState)
      const loadedTimestamp = AdvancedChunkStateOptics.relevantTimestamp(loadedState)
      const failedTimestamp = AdvancedChunkStateOptics.relevantTimestamp(failedState)

      expect(Option.isSome(loadingTimestamp)).toBe(true)
      expect(Option.isSome(loadedTimestamp)).toBe(true)
      expect(Option.isSome(failedTimestamp)).toBe(true)
    })
  })
})

describe('ParallelChunkStateOptics', () => {
  describe('並列状態処理', () => {
    it('複数状態の並列更新ができる', async () => {
      const states = [
        createLoadingState(),
        createLoadedState(),
        createFailedState()
      ]

      const operation = (state: ChunkState) =>
        Effect.succeed(
          state._tag === 'Loading'
            ? ChunkStateOpticsHelpers.updateLoadingProgress(state, 100 as LoadProgress)
            : state
        )

      const result = await Effect.runPromise(
        ParallelChunkStateOptics.parallelUpdate(states, operation)
      )

      expect(result).toHaveLength(3)
      expect(result[0]._tag).toBe('Loading')
      expect(ChunkStateOptics.loadingProgress.get(result[0] as any)).toBe(100)
    })

    it('状態統計の並列計算ができる', async () => {
      const states = [
        createLoadingState(),
        createLoadedState(),
        createFailedState(),
        createDirtyState(),
        createSavingState()
      ]

      const statistics = await Effect.runPromise(
        ParallelChunkStateOptics.parallelStatistics(states)
      )

      expect(statistics.total).toBe(5)
      expect(statistics.byState.Loading).toBe(1)
      expect(statistics.byState.Loaded).toBe(1)
      expect(statistics.byState.Failed).toBe(1)
      expect(statistics.byState.Dirty).toBe(1)
      expect(statistics.byState.Saving).toBe(1)
      expect(statistics.hasData).toBe(3) // Loaded, Dirty, Saving
      expect(statistics.hasProgress).toBe(2) // Loading, Saving
      expect(statistics.hasErrors).toBe(1) // Failed
    })
  })
})

describe('SafeChunkStateOptics', () => {
  describe('安全な状態操作', () => {
    it('安全なプロパティアクセスができる', () => {
      const loadingState = createLoadingState()
      const fallbackValue = 0 as LoadProgress

      // 存在するプロパティへのアクセス
      const progress = SafeChunkStateOptics.safeGet(
        ChunkStateOptics.loadingProgress,
        fallbackValue
      )(loadingState)

      expect(progress).toBe(50)

      // 存在しないプロパティへのアクセス（loadedStateからloadingProgress）
      const loadedState = createLoadedState()
      const safeProgress = SafeChunkStateOptics.safeGet(
        ChunkStateOptics.loadingProgress,
        fallbackValue
      )(loadedState)

      expect(safeProgress).toBe(fallbackValue)
    })

    it('安全なプロパティ更新ができる', () => {
      const loadingState = createLoadingState()

      const result = SafeChunkStateOptics.safeSet(
        ChunkStateOptics.loadingProgress,
        90 as LoadProgress
      )(loadingState)

      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(ChunkStateOptics.loadingProgress.get(result.right)).toBe(90)
      }
    })
  })
})

describe('パフォーマンステスト', () => {
  it('大量の状態アクセスが効率的に実行される', () => {
    const states = Array.from({ length: 1000 }, () => createLoadedState())
    const startTime = performance.now()

    // 1000個の状態から情報を抽出
    const results = states.map(state => ({
      tag: ChunkStateOptics.tag.get(state),
      data: ChunkStateOptics.loadedData.get(state),
      metadata: ChunkStateOptics.loadedMetadata.get(state)
    }))

    const endTime = performance.now()
    const executionTime = endTime - startTime

    // パフォーマンス要件: 1000個の状態アクセスが50ms以内
    expect(executionTime).toBeLessThan(50)
    expect(results).toHaveLength(1000)
    expect(results.every(r => r.tag === 'Loaded')).toBe(true)
  })
})

describe('状態遷移テスト', () => {
  it('型安全な状態遷移が正常に動作する', () => {
    const loadingState = createLoadingState()

    // Loading -> Loadedの遷移
    const transition = ChunkStateTransitionOptics.safeTransition(
      'Loading',
      createLoadedState(),
      (state) => state.progress >= 100
    )

    // 進行度が100未満の場合は遷移失敗
    const failResult = transition(loadingState)
    expect(failResult._tag).toBe('Left')

    // 進行度を100に設定して再試行
    const completedState = ChunkStateOpticsHelpers.updateLoadingProgress(
      loadingState,
      100 as LoadProgress
    )
    const successResult = transition(completedState)
    expect(successResult._tag).toBe('Right')
  })
})