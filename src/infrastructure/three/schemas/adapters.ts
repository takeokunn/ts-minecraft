/**
 * @fileoverview THREE.js Schema Adapters
 *
 * THREE.jsの型とドメイン型の相互変換用アダプター。
 * パフォーマンスクリティカルな変換のためのmakeUnsafe系ヘルパーを提供。
 */

import { unsafeCoerce } from 'effect/Function'

/**
 * THREE.Matrix4.elementsをタプル型に変換（型安全）
 *
 * THREE.jsのMatrix4.elementsはnumber[]型だが、
 * 常に16要素の配列であることが保証されている。
 * このヘルパーは型安全にタプル型へ変換する。
 *
 * パフォーマンス: 実行時コストなし（型のみの変換）
 */
export const matrix4ElementsToTuple = (
  elements: number[]
): readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
] => {
  if (elements.length !== 16) {
    throw new Error(`Expected 16 elements, got ${elements.length}`)
  }
  return unsafeCoerce(elements)
}

/**
 * THREE.Matrix3.elementsをタプル型に変換（型安全）
 *
 * THREE.jsのMatrix3.elementsはnumber[]型だが、
 * 常に9要素の配列であることが保証されている。
 *
 * パフォーマンス: 実行時コストなし（型のみの変換）
 */
export const matrix3ElementsToTuple = (
  elements: number[]
): readonly [number, number, number, number, number, number, number, number, number] => {
  if (elements.length !== 9) {
    throw new Error(`Expected 9 elements, got ${elements.length}`)
  }
  return unsafeCoerce(elements)
}

/**
 * 型アサーション削除のためのヘルパー関数
 *
 * これらの関数は、THREE.jsのオブジェクトが内部で正しい構造を持つことを
 * 保証しつつ、TypeScriptの型システムに適合させる。
 */
