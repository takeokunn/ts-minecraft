/**
 * @fileoverview Equipment Domain Layer
 * Domain層の依存関係を提供（Repository層のみ）
 */

import type { EquipmentRepository } from './repository'
import { Layer } from 'effect'

/**
 * Equipment Domain Layer Factory
 *
 * Domain層はリポジトリ契約のみを期待し、具体実装の注入は外部で行う。
 */
export const createEquipmentDomainLayer = (
  repositoryLayer: Layer.Layer<EquipmentRepository>
): Layer.Layer<EquipmentRepository> => repositoryLayer
