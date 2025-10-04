/**
 * ChunkState Optics - ADT状態への安全なアクセス・更新
 *
 * 簡略化されたChunkState操作関数群
 */

import type { ChunkState } from './core'

/**
 * ChunkState ADTへの型安全なアクセス関数群
 */
export const ChunkStateOptics = {
  /**
   * 現在のChunkStateのタグを取得
   */
  getTag: (state: ChunkState) => state._tag,

  /**
   * 状態の型判定関数群
   */
  isUnloaded: (state: ChunkState) => state._tag === 'Unloaded',
  isLoading: (state: ChunkState) => state._tag === 'Loading',
  isLoaded: (state: ChunkState) => state._tag === 'Loaded',
  isFailed: (state: ChunkState) => state._tag === 'Failed',
  isDirty: (state: ChunkState) => state._tag === 'Dirty',
  isSaving: (state: ChunkState) => state._tag === 'Saving',
  isCached: (state: ChunkState) => state._tag === 'Cached',
} as const