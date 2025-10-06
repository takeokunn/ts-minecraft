import * as CANNON from 'cannon-es'
import { Effect, Schema } from 'effect'
import { PhysicsMaterialError } from '../errors'

/**
 * ContactMaterial - Cannon.js接触マテリアルのEffect-TSラッパー
 *
 * Phase 1.4: 2つのMaterial間の摩擦・反発係数を定義
 */

// ContactMaterialパラメータ Schema
export const ContactMaterialParamsSchema = Schema.Struct({
  materialA: Schema.Unknown.pipe(
    Schema.annotations({
      description: 'First material (CANNON.Material)',
    })
  ),
  materialB: Schema.Unknown.pipe(
    Schema.annotations({
      description: 'Second material (CANNON.Material)',
    })
  ),
  friction: Schema.optional(Schema.Number.pipe(Schema.nonNegative())).pipe(
    Schema.withDefault(() => 0.3),
    Schema.annotations({
      description: 'Friction coefficient between materials (default: 0.3)',
    })
  ),
  restitution: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))).pipe(
    Schema.withDefault(() => 0.3),
    Schema.annotations({
      description: 'Restitution (bounciness) coefficient (0=no bounce, 1=perfect bounce, default: 0.3)',
    })
  ),
  contactEquationStiffness: Schema.optional(Schema.Number.pipe(Schema.positive())).pipe(
    Schema.withDefault(() => 1e7),
    Schema.annotations({
      description: 'Contact equation stiffness (default: 1e7)',
    })
  ),
  contactEquationRelaxation: Schema.optional(Schema.Number.pipe(Schema.positive())).pipe(
    Schema.withDefault(() => 3),
    Schema.annotations({
      description: 'Contact equation relaxation (default: 3)',
    })
  ),
}).pipe(
  Schema.annotations({
    title: 'ContactMaterial Parameters',
    description: 'Configuration for creating a contact material between two materials',
  })
)

export type ContactMaterialParams = Schema.Schema.Type<typeof ContactMaterialParamsSchema>

/**
 * ContactMaterial生成
 *
 * @param params - ContactMaterialパラメータ
 * @returns Effect型でラップされたCANNON.ContactMaterial
 */
export const createContactMaterial = (
  params: ContactMaterialParams
): Effect.Effect<CANNON.ContactMaterial, PhysicsMaterialError> =>
  Effect.try({
    try: () => {
      const materialA = params.materialA as CANNON.Material
      const materialB = params.materialB as CANNON.Material

      const contactMaterial = new CANNON.ContactMaterial(materialA, materialB, {
        friction: params.friction,
        restitution: params.restitution,
        contactEquationStiffness: params.contactEquationStiffness,
        contactEquationRelaxation: params.contactEquationRelaxation,
      })

      return contactMaterial
    },
    catch: (error) =>
      new PhysicsMaterialError({
        operation: 'createContactMaterial',
        cause: error,
        message: 'Failed to create contact material',
      }),
  })

/**
 * ContactMaterialをWorldに追加
 *
 * @param world - 対象World
 * @param contactMaterial - 追加する接触マテリアル
 * @returns Effect型でラップされたvoid
 */
export const addContactMaterialToWorld = (
  world: CANNON.World,
  contactMaterial: CANNON.ContactMaterial
): Effect.Effect<void, PhysicsMaterialError> =>
  Effect.try({
    try: () => {
      world.addContactMaterial(contactMaterial)
    },
    catch: (error) =>
      new PhysicsMaterialError({
        operation: 'addContactMaterialToWorld',
        cause: error,
        message: 'Failed to add contact material to world',
      }),
  })

/**
 * Material生成（基本マテリアル）
 *
 * @param name - マテリアル名
 * @returns Effect型でラップされたCANNON.Material
 */
export const createMaterial = (name: string): Effect.Effect<CANNON.Material, PhysicsMaterialError> =>
  Effect.try({
    try: () => new CANNON.Material(name),
    catch: (error) =>
      new PhysicsMaterialError({
        operation: 'createMaterial',
        cause: error,
        message: `Failed to create material: ${name}`,
      }),
  })
