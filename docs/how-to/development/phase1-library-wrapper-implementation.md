---
title: 'Phase 1: 外部ライブラリラッパー完全実装ガイド'
description: 'Three.js/Cannon.js/idb-keyvalのEffect-TS完全ラッピング実装計画と実践パターン集'
category: 'guide'
difficulty: 'advanced'
tags: ['effect-ts', 'library-wrapper', 'three.js', 'cannon.js', 'idb-keyval', 'schema', 'brand-types']
prerequisites: ['effect-ts-fundamentals', 'effect-ts-patterns', 'development-conventions']
estimated_reading_time: '30分'
related_docs:
  - '../../tutorials/effect-ts-fundamentals/effect-ts-patterns.md'
  - './development-conventions.md'
  - '../../reference/effect-ts-types/type-reference.md'
---

# Phase 1: 外部ライブラリラッパー完全実装ガイド

## エグゼクティブサマリー

### 目的

Three.js、Cannon.js、idb-keyvalの全APIをEffect-TSで完全にラッピングし、プロジェクト全体で外部ライブラリへの直接アクセスを撲滅する。

### プロジェクト規模

- **総工数**: 60-80時間
- **対象ファイル**: ~20ファイル（新規作成）
- **影響範囲**: ~15ファイル（既存コード置換）
- **優先度**: **最高**（全ての実装がこれに依存）

### 達成基準

- [ ] Three.js直接インポート: 0件（ラッパー経由のみ）
- [ ] CANNON直接インポート: 0件（ラッパー経由のみ）
- [ ] idb-keyval直接インポート: 0件（indexed-db.ts除く）
- [ ] 全API操作がEffect型を返す
- [ ] Brand型による型安全性の確保
- [ ] Schema検証による実行時安全性

### 期待効果

- **型安全性**: コンパイル時エラー検出率90%向上
- **テスタビリティ**: 100%モック可能なEffect-based DI
- **保守性**: 外部ライブラリ更新の影響範囲を限定
- **一貫性**: 全てのAPIがEffect型を返す統一インターフェース

---

## 実装前提知識

### 必須パターン

このガイドで使用する核となるパターンです。実装前に必ず理解してください。

#### 1. Brand型によるラッパー型定義

```typescript
import { Schema } from 'effect'

// Three.js Vector3のBrand型ラッパー
const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(Schema.brand('Vector3'))

type Vector3 = Schema.Schema.Type<typeof Vector3Schema>
```

> 📚 **詳細**: [Effect-TS型システム](../../tutorials/effect-ts-fundamentals/effect-ts-type-system.md#brand型)

#### 2. Effect.tryによる安全な変換

```typescript
import { Effect } from 'effect'
import * as THREE from 'three'

// mutableなThree.js APIをimmutableなEffect型に変換
const createVector = (x: number, y: number, z: number): Effect.Effect<Vector3, never> =>
  Effect.sync(() => Vector3Schema.make({ x, y, z }))

const toThreeVector = (v: Vector3): THREE.Vector3 => new THREE.Vector3(v.x, v.y, v.z)
```

#### 3. Service/Layerパターン

```typescript
import { Context, Layer, Effect } from 'effect'

// Service定義
interface Vector3Service {
  readonly create: (x: number, y: number, z: number) => Effect.Effect<Vector3, never>
  readonly add: (a: Vector3, b: Vector3) => Effect.Effect<Vector3, never>
  readonly toThree: (v: Vector3) => THREE.Vector3
}

const Vector3Service = Context.GenericTag<Vector3Service>('@minecraft/infrastructure/three/Vector3Service')

// Layer実装
const Vector3ServiceLive = Layer.succeed(
  Vector3Service,
  Vector3Service.of({
    create: (x, y, z) => Effect.succeed(Vector3Schema.make({ x, y, z })),
    add: (a, b) =>
      Effect.succeed(
        Vector3Schema.make({
          x: a.x + b.x,
          y: a.y + b.y,
          z: a.z + b.z,
        })
      ),
    toThree: (v) => new THREE.Vector3(v.x, v.y, v.z),
  })
)
```

> 📚 **詳細**: [Effect-TSパターン](../../tutorials/effect-ts-fundamentals/effect-ts-patterns.md)

#### 4. Schema.decodeUnknownによる検証

```typescript
import { Schema, Effect } from 'effect'

// 外部データの検証付き読み込み
const parseVector3 = (data: unknown): Effect.Effect<Vector3, Schema.ParseError> =>
  Schema.decodeUnknown(Vector3Schema)(data)
```

> 📚 **詳細**: [開発規約](./development-conventions.md)

---

## Phase 1.1: Three.js Core Types（推定20時間）

### 実装優先度（データドリブン）

既存コード分析の結果、以下の順序で実装することを推奨します：

#### 優先度A: 即座に実装（5時間）

```typescript
// src/infrastructure/three/core/vector3.ts
import { Schema, Effect, Match, pipe } from 'effect'
import * as THREE from 'three'

/**
 * Three.js Vector3のEffect-TSラッパー
 *
 * **設計方針**:
 * - Immutableなデータ構造
 * - 全操作がEffect型を返す
 * - Brand型による型安全性
 */

// Brand型定義
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(
  Schema.brand('Vector3'),
  Schema.annotations({
    title: 'Vector3',
    description: '3次元ベクトル（Immutable）',
    examples: [
      { x: 0, y: 0, z: 0 },
      { x: 1.5, y: -2.3, z: 4.7 },
    ],
  })
)

export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

// コンストラクタ
export const makeVector3 = (x: number, y: number, z: number): Effect.Effect<Vector3, never> =>
  Effect.succeed(Vector3Schema.make({ x, y, z }))

export const zero: Vector3 = Vector3Schema.make({ x: 0, y: 0, z: 0 })
export const one: Vector3 = Vector3Schema.make({ x: 1, y: 1, z: 1 })
export const up: Vector3 = Vector3Schema.make({ x: 0, y: 1, z: 0 })
export const down: Vector3 = Vector3Schema.make({ x: 0, y: -1, z: 0 })
export const left: Vector3 = Vector3Schema.make({ x: -1, y: 0, z: 0 })
export const right: Vector3 = Vector3Schema.make({ x: 1, y: 0, z: 0 })
export const forward: Vector3 = Vector3Schema.make({ x: 0, y: 0, z: -1 })
export const backward: Vector3 = Vector3Schema.make({ x: 0, y: 0, z: 1 })

// Three.js相互変換
export const fromThreeVector = (v: THREE.Vector3): Effect.Effect<Vector3, never> =>
  Effect.succeed(Vector3Schema.make({ x: v.x, y: v.y, z: v.z }))

export const toThreeVector = (v: Vector3): THREE.Vector3 => new THREE.Vector3(v.x, v.y, v.z)

// ベクトル演算（Immutable）
export const add = (a: Vector3, b: Vector3): Effect.Effect<Vector3, never> =>
  Effect.succeed(
    Vector3Schema.make({
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z,
    })
  )

export const subtract = (a: Vector3, b: Vector3): Effect.Effect<Vector3, never> =>
  Effect.succeed(
    Vector3Schema.make({
      x: a.x - b.x,
      y: a.y - b.y,
      z: a.z - b.z,
    })
  )

export const scale = (v: Vector3, s: number): Effect.Effect<Vector3, never> =>
  Effect.succeed(
    Vector3Schema.make({
      x: v.x * s,
      y: v.y * s,
      z: v.z * s,
    })
  )

export const dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z

export const cross = (a: Vector3, b: Vector3): Effect.Effect<Vector3, never> =>
  Effect.succeed(
    Vector3Schema.make({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    })
  )

export const length = (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)

export const lengthSquared = (v: Vector3): number => v.x * v.x + v.y * v.y + v.z * v.z

export const normalize = (v: Vector3): Effect.Effect<Vector3, DivisionByZeroError> =>
  Effect.gen(function* () {
    const len = length(v)

    return yield* pipe(
      Match.value(len),
      Match.when(0, () => Effect.fail(new DivisionByZeroError({ vector: v }))),
      Match.when(Match.number.greaterThan(0), () =>
        Effect.succeed(
          Vector3Schema.make({
            x: v.x / len,
            y: v.y / len,
            z: v.z / len,
          })
        )
      ),
      Match.exhaustive
    )
  })

export const distance = (a: Vector3, b: Vector3): number =>
  length(
    Vector3Schema.make({
      x: b.x - a.x,
      y: b.y - a.y,
      z: b.z - a.z,
    })
  )

// エラー定義
export class DivisionByZeroError extends Schema.TaggedError<DivisionByZeroError>()('DivisionByZeroError', {
  vector: Vector3Schema,
  message: Schema.optional(Schema.String).pipe(Schema.withDefault(() => 'Cannot normalize zero-length vector')),
}) {}

// Schema検証付きパース
export const parseVector3 = (data: unknown): Effect.Effect<Vector3, Schema.ParseError> =>
  Schema.decodeUnknown(Vector3Schema)(data)

// JSON変換
export const toJSON = (v: Vector3): { x: number; y: number; z: number } => ({
  x: v.x,
  y: v.y,
  z: v.z,
})

export const fromJSON = (json: { x: number; y: number; z: number }): Effect.Effect<Vector3, Schema.ParseError> =>
  parseVector3(json)
```

#### 優先度B: Quaternion/Euler（5時間）

```typescript
// src/infrastructure/three/core/quaternion.ts
import { Schema, Effect } from 'effect'
import * as THREE from 'three'
import type { Vector3 } from './vector3'
import { toThreeVector } from './vector3'

export const QuaternionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  w: Schema.Number,
}).pipe(
  Schema.brand('Quaternion'),
  Schema.annotations({
    title: 'Quaternion',
    description: '四元数による回転表現（Immutable）',
  })
)

export type Quaternion = Schema.Schema.Type<typeof QuaternionSchema>

export const identity: Quaternion = QuaternionSchema.make({ x: 0, y: 0, z: 0, w: 1 })

export const makeQuaternion = (x: number, y: number, z: number, w: number): Effect.Effect<Quaternion, never> =>
  Effect.succeed(QuaternionSchema.make({ x, y, z, w }))

export const fromThreeQuaternion = (q: THREE.Quaternion): Effect.Effect<Quaternion, never> =>
  Effect.succeed(QuaternionSchema.make({ x: q.x, y: q.y, z: q.z, w: q.w }))

export const toThreeQuaternion = (q: Quaternion): THREE.Quaternion => new THREE.Quaternion(q.x, q.y, q.z, q.w)

export const fromAxisAngle = (axis: Vector3, angle: number): Effect.Effect<Quaternion, never> =>
  Effect.sync(() => {
    const threeQuat = new THREE.Quaternion().setFromAxisAngle(toThreeVector(axis), angle)
    return QuaternionSchema.make({ x: threeQuat.x, y: threeQuat.y, z: threeQuat.z, w: threeQuat.w })
  })

export const multiply = (a: Quaternion, b: Quaternion): Effect.Effect<Quaternion, never> =>
  Effect.sync(() => {
    const result = toThreeQuaternion(a).multiply(toThreeQuaternion(b))
    return QuaternionSchema.make({ x: result.x, y: result.y, z: result.z, w: result.w })
  })

export const slerp = (a: Quaternion, b: Quaternion, t: number): Effect.Effect<Quaternion, never> =>
  Effect.sync(() => {
    const result = toThreeQuaternion(a).slerp(toThreeQuaternion(b), t)
    return QuaternionSchema.make({ x: result.x, y: result.y, z: result.z, w: result.w })
  })
```

#### 優先度C: Matrix4/Color（10時間）

```typescript
// src/infrastructure/three/core/matrix4.ts
import { Schema, Effect } from 'effect'
import * as THREE from 'three'

// 4x4行列（列優先）
export const Matrix4Schema = Schema.Struct({
  elements: Schema.Array(Schema.Number).pipe(
    Schema.filter((arr) => arr.length === 16, {
      message: () => 'Matrix4 must have exactly 16 elements',
    })
  ),
}).pipe(
  Schema.brand('Matrix4'),
  Schema.annotations({
    title: 'Matrix4',
    description: '4x4変換行列（列優先、Immutable）',
  })
)

export type Matrix4 = Schema.Schema.Type<typeof Matrix4Schema>

export const identity: Matrix4 = Matrix4Schema.make({
  elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
})

export const fromThreeMatrix4 = (m: THREE.Matrix4): Effect.Effect<Matrix4, never> =>
  Effect.succeed(Matrix4Schema.make({ elements: [...m.elements] }))

export const toThreeMatrix4 = (m: Matrix4): THREE.Matrix4 => new THREE.Matrix4().fromArray(m.elements)

// src/infrastructure/three/core/color.ts
export const ColorSchema = Schema.Struct({
  r: Schema.Number.pipe(Schema.between(0, 1)),
  g: Schema.Number.pipe(Schema.between(0, 1)),
  b: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.brand('Color'),
  Schema.annotations({
    title: 'Color',
    description: 'RGB色（0.0-1.0、Immutable）',
  })
)

export type Color = Schema.Schema.Type<typeof ColorSchema>

export const makeColor = (r: number, g: number, b: number): Effect.Effect<Color, Schema.ParseError> =>
  Schema.decodeUnknown(ColorSchema)({ r, g, b })

export const fromHex = (hex: string): Effect.Effect<Color, ColorParseError> =>
  Effect.gen(function* () {
    const threeColor = new THREE.Color(hex)
    return yield* Schema.decodeUnknown(ColorSchema)({
      r: threeColor.r,
      g: threeColor.g,
      b: threeColor.b,
    }).pipe(Effect.mapError((error) => new ColorParseError({ hex, cause: error })))
  })

export class ColorParseError extends Schema.TaggedError<ColorParseError>()('ColorParseError', {
  hex: Schema.String,
  cause: Schema.Unknown,
}) {}
```

### ディレクトリ構成

```
src/infrastructure/three/
├── core/
│   ├── vector3.ts        # Vector3ラッパー（最優先）
│   ├── quaternion.ts     # Quaternionラッパー
│   ├── euler.ts          # Eulerラッパー
│   ├── matrix4.ts        # Matrix4ラッパー
│   ├── matrix3.ts        # Matrix3ラッパー
│   ├── color.ts          # Colorラッパー
│   ├── box3.ts           # Box3ラッパー
│   ├── sphere.ts         # Sphereラッパー
│   └── index.ts          # バレルエクスポート
├── types.ts              # 共通型定義
└── index.ts              # 全体エクスポート
```

---

## Phase 1.2: Three.js Geometry/Material（推定15時間）

### 実装戦略

Geometry/MaterialはThree.jsのmutableなAPIを多用するため、以下の戦略で実装：

1. **Builder Pattern**: パラメータをSchemaで定義し、検証後に生成
2. **Dispose管理**: Effect.Scopeによる自動リソース解放
3. **Immutable Config**: 設定は全てBrand型で型安全化

### 実装例: BoxGeometry

```typescript
// src/infrastructure/three/geometry/box.ts
import { Schema, Effect } from 'effect'
import * as THREE from 'three'

/**
 * BoxGeometry Parameters
 *
 * Three.jsのBoxGeometryコンストラクタパラメータを型安全に定義
 */
export const BoxGeometryParamsSchema = Schema.Struct({
  width: Schema.Number.pipe(Schema.positive()),
  height: Schema.Number.pipe(Schema.positive()),
  depth: Schema.Number.pipe(Schema.positive()),
  widthSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())).pipe(Schema.withDefault(() => 1)),
  heightSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())).pipe(
    Schema.withDefault(() => 1)
  ),
  depthSegments: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())).pipe(Schema.withDefault(() => 1)),
}).pipe(
  Schema.annotations({
    title: 'BoxGeometry Parameters',
    description: 'Parameters for creating a box geometry',
  })
)

export type BoxGeometryParams = Schema.Schema.Type<typeof BoxGeometryParamsSchema>

// エラー定義
export class GeometryCreationError extends Schema.TaggedError<GeometryCreationError>()('GeometryCreationError', {
  geometryType: Schema.Literal('box', 'sphere', 'plane', 'cylinder'),
  params: Schema.Unknown,
  cause: Schema.Unknown,
}) {}

/**
 * BoxGeometry生成（Effect.Scopeで自動dispose）
 */
export const createBoxGeometry = (
  params: BoxGeometryParams
): Effect.Effect<THREE.BoxGeometry, GeometryCreationError, never> =>
  Effect.acquireRelease(
    // Acquire: Geometryを生成
    Effect.try({
      try: () =>
        new THREE.BoxGeometry(
          params.width,
          params.height,
          params.depth,
          params.widthSegments,
          params.heightSegments,
          params.depthSegments
        ),
      catch: (error) =>
        new GeometryCreationError({
          geometryType: 'box',
          params,
          cause: error,
        }),
    }),
    // Release: 自動でdispose
    (geometry) => Effect.sync(() => geometry.dispose())
  )

/**
 * 使用例
 */
const exampleUsage = Effect.gen(function* () {
  // Schemaによるパラメータ検証
  const params = yield* Schema.decodeUnknown(BoxGeometryParamsSchema)({
    width: 1,
    height: 1,
    depth: 1,
    widthSegments: 2,
  })

  // Scope内で自動管理
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const geometry = yield* createBoxGeometry(params)
      // geometryを使用した処理
      console.log('Vertex count:', geometry.attributes.position.count)
      return geometry
    })
  )
  // Scopeを抜けると自動でgeometry.dispose()が呼ばれる
})
```

### Material実装パターン

```typescript
// src/infrastructure/three/material/basic.ts
import { Schema, Effect } from 'effect'
import * as THREE from 'three'
import type { Color } from '../core/color'
import { toThreeColor } from '../core/color'

export const BasicMaterialParamsSchema = Schema.Struct({
  color: Schema.optional(ColorSchema).pipe(Schema.withDefault(() => ColorSchema.make({ r: 1, g: 1, b: 1 }))),
  opacity: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))).pipe(Schema.withDefault(() => 1)),
  transparent: Schema.optional(Schema.Boolean).pipe(Schema.withDefault(() => false)),
  side: Schema.optional(Schema.Literal('front', 'back', 'double')).pipe(Schema.withDefault(() => 'front' as const)),
  wireframe: Schema.optional(Schema.Boolean).pipe(Schema.withDefault(() => false)),
}).pipe(
  Schema.annotations({
    title: 'MeshBasicMaterial Parameters',
  })
)

export type BasicMaterialParams = Schema.Schema.Type<typeof BasicMaterialParamsSchema>

const sideToThreeSide = (side: 'front' | 'back' | 'double'): THREE.Side => {
  switch (side) {
    case 'front':
      return THREE.FrontSide
    case 'back':
      return THREE.BackSide
    case 'double':
      return THREE.DoubleSide
  }
}

export const createBasicMaterial = (
  params: BasicMaterialParams
): Effect.Effect<THREE.MeshBasicMaterial, MaterialCreationError, never> =>
  Effect.acquireRelease(
    Effect.sync(
      () =>
        new THREE.MeshBasicMaterial({
          color: toThreeColor(params.color),
          opacity: params.opacity,
          transparent: params.transparent,
          side: sideToThreeSide(params.side),
          wireframe: params.wireframe,
        })
    ),
    (material) => Effect.sync(() => material.dispose())
  )

export class MaterialCreationError extends Schema.TaggedError<MaterialCreationError>()('MaterialCreationError', {
  materialType: Schema.String,
  params: Schema.Unknown,
  cause: Schema.Unknown,
}) {}
```

---

## Phase 1.3: Three.js Scene/Renderer（推定10時間）

### 既存実装との統合戦略

現在、以下のファイルでThree.jsが直接使用されています：

- `src/domain/camera/*.ts` (4ファイル)
- `src/infrastructure/audio/audio-service-live.ts`
- その他レンダリング関連

これらを段階的に置換します。

### PerspectiveCameraラッパー実装（最優先）

```typescript
// src/infrastructure/three/camera/perspective.ts
import { Schema, Effect, Context, Layer } from 'effect'
import * as THREE from 'three'

/**
 * PerspectiveCamera Parameters
 */
export const PerspectiveCameraParamsSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.between(1, 179), Schema.annotations({ description: 'Field of view in degrees' })),
  aspect: Schema.Number.pipe(Schema.positive(), Schema.annotations({ description: 'Aspect ratio (width/height)' })),
  near: Schema.Number.pipe(Schema.positive(), Schema.annotations({ description: 'Near clipping plane' })),
  far: Schema.Number.pipe(Schema.positive(), Schema.annotations({ description: 'Far clipping plane' })),
}).pipe(
  Schema.annotations({
    title: 'PerspectiveCamera Parameters',
  })
)

export type PerspectiveCameraParams = Schema.Schema.Type<typeof PerspectiveCameraParamsSchema>

/**
 * PerspectiveCamera Service
 *
 * カメラインスタンスの管理をServiceパターンで実装
 */
export interface PerspectiveCameraService {
  readonly create: (params: PerspectiveCameraParams) => Effect.Effect<THREE.PerspectiveCamera, CameraCreationError>
  readonly updateAspect: (camera: THREE.PerspectiveCamera, aspect: number) => Effect.Effect<void, never>
  readonly updateProjectionMatrix: (camera: THREE.PerspectiveCamera) => Effect.Effect<void, never>
}

export const PerspectiveCameraService = Context.GenericTag<PerspectiveCameraService>(
  '@minecraft/infrastructure/three/PerspectiveCameraService'
)

export class CameraCreationError extends Schema.TaggedError<CameraCreationError>()('CameraCreationError', {
  cameraType: Schema.String,
  params: Schema.Unknown,
  cause: Schema.Unknown,
}) {}

/**
 * PerspectiveCameraService Live Implementation
 */
export const PerspectiveCameraServiceLive = Layer.succeed(
  PerspectiveCameraService,
  PerspectiveCameraService.of({
    create: (params) =>
      Effect.acquireRelease(
        Effect.try({
          try: () => new THREE.PerspectiveCamera(params.fov, params.aspect, params.near, params.far),
          catch: (error) =>
            new CameraCreationError({
              cameraType: 'PerspectiveCamera',
              params,
              cause: error,
            }),
        }),
        (camera) =>
          Effect.sync(() => {
            // カメラのクリーンアップ処理があれば追加
          })
      ),

    updateAspect: (camera, aspect) =>
      Effect.sync(() => {
        camera.aspect = aspect
      }),

    updateProjectionMatrix: (camera) =>
      Effect.sync(() => {
        camera.updateProjectionMatrix()
      }),
  })
)

/**
 * 使用例: 既存のdomain/camera/*.tsの置換
 */
const createGameCamera = Effect.gen(function* () {
  const cameraService = yield* PerspectiveCameraService

  // Schemaによるパラメータ検証
  const params = yield* Schema.decodeUnknown(PerspectiveCameraParamsSchema)({
    fov: 75,
    aspect: window.innerWidth / window.innerHeight,
    near: 0.1,
    far: 1000,
  })

  // Effect.Scopeで自動管理
  return yield* cameraService.create(params)
})
```

### Scene/Rendererラッパー

```typescript
// src/infrastructure/three/scene/scene-service.ts
import { Schema, Effect, Context, Layer } from 'effect'
import * as THREE from 'three'
import type { Color } from '../core/color'
import { toThreeColor } from '../core/color'

export const SceneConfigSchema = Schema.Struct({
  background: Schema.optional(ColorSchema),
  fog: Schema.optional(
    Schema.Struct({
      color: ColorSchema,
      near: Schema.Number.pipe(Schema.positive()),
      far: Schema.Number.pipe(Schema.positive()),
    })
  ),
})

export type SceneConfig = Schema.Schema.Type<typeof SceneConfigSchema>

export interface SceneService {
  readonly create: (config?: SceneConfig) => Effect.Effect<THREE.Scene, never>
  readonly add: (scene: THREE.Scene, object: THREE.Object3D) => Effect.Effect<void, never>
  readonly remove: (scene: THREE.Scene, object: THREE.Object3D) => Effect.Effect<void, never>
  readonly clear: (scene: THREE.Scene) => Effect.Effect<void, never>
}

export const SceneService = Context.GenericTag<SceneService>('@minecraft/infrastructure/three/SceneService')

export const SceneServiceLive = Layer.succeed(
  SceneService,
  SceneService.of({
    create: (config) =>
      Effect.sync(() => {
        const scene = new THREE.Scene()

        if (config?.background) {
          scene.background = toThreeColor(config.background)
        }

        if (config?.fog) {
          scene.fog = new THREE.Fog(toThreeColor(config.fog.color), config.fog.near, config.fog.far)
        }

        return scene
      }),

    add: (scene, object) =>
      Effect.sync(() => {
        scene.add(object)
      }),

    remove: (scene, object) =>
      Effect.sync(() => {
        scene.remove(object)
      }),

    clear: (scene) =>
      Effect.sync(() => {
        scene.clear()
      }),
  })
)
```

---

## Phase 1.4: Cannon.js Physics（推定20時間）

### 3段階実装戦略

Cannon.jsは**mutableなAPI**が多いため、以下の戦略で段階的に実装：

#### Stage 1: Immutable型定義（5時間）

```typescript
// src/infrastructure/cannon/types/vector3.ts
import { Schema } from 'effect'

/**
 * Cannon.js Vec3のImmutableラッパー
 *
 * Three.jsのVector3と互換性を保つ
 */
export const PhysicsVector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(
  Schema.brand('PhysicsVector3'),
  Schema.annotations({
    title: 'PhysicsVector3',
    description: '物理演算用3次元ベクトル（Immutable）',
  })
)

export type PhysicsVector3 = Schema.Schema.Type<typeof PhysicsVector3Schema>

// src/infrastructure/cannon/types/quaternion.ts
export const PhysicsQuaternionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  w: Schema.Number,
}).pipe(
  Schema.brand('PhysicsQuaternion'),
  Schema.annotations({
    title: 'PhysicsQuaternion',
    description: '物理演算用四元数（Immutable）',
  })
)

export type PhysicsQuaternion = Schema.Schema.Type<typeof PhysicsQuaternionSchema>
```

#### Stage 2: Body/Shape API（10時間）

```typescript
// src/infrastructure/cannon/body/body-config.ts
import { Schema, Effect } from 'effect'
import * as CANNON from 'cannon-es'
import type { PhysicsVector3, PhysicsQuaternion } from '../types'

/**
 * RigidBody Configuration
 */
export const RigidBodyConfigSchema = Schema.Struct({
  mass: Schema.Number.pipe(Schema.nonNegative(), Schema.annotations({ description: 'Body mass (0 = static)' })),
  position: Schema.optional(PhysicsVector3Schema).pipe(
    Schema.withDefault(() => PhysicsVector3Schema.make({ x: 0, y: 0, z: 0 }))
  ),
  velocity: Schema.optional(PhysicsVector3Schema).pipe(
    Schema.withDefault(() => PhysicsVector3Schema.make({ x: 0, y: 0, z: 0 }))
  ),
  quaternion: Schema.optional(PhysicsQuaternionSchema).pipe(
    Schema.withDefault(() => PhysicsQuaternionSchema.make({ x: 0, y: 0, z: 0, w: 1 }))
  ),
  angularVelocity: Schema.optional(PhysicsVector3Schema).pipe(
    Schema.withDefault(() => PhysicsVector3Schema.make({ x: 0, y: 0, z: 0 }))
  ),
  linearDamping: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))).pipe(Schema.withDefault(() => 0.01)),
  angularDamping: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))).pipe(Schema.withDefault(() => 0.01)),
  fixedRotation: Schema.optional(Schema.Boolean).pipe(Schema.withDefault(() => false)),
  allowSleep: Schema.optional(Schema.Boolean).pipe(Schema.withDefault(() => true)),
})

export type RigidBodyConfig = Schema.Schema.Type<typeof RigidBodyConfigSchema>

/**
 * Shape Definitions
 */
export const BoxShapeSchema = Schema.Struct({
  type: Schema.Literal('box'),
  halfExtents: PhysicsVector3Schema,
}).pipe(Schema.brand('BoxShape'))

export const SphereShapeSchema = Schema.Struct({
  type: Schema.Literal('sphere'),
  radius: Schema.Number.pipe(Schema.positive()),
}).pipe(Schema.brand('SphereShape'))

export const PlaneShapeSchema = Schema.Struct({
  type: Schema.Literal('plane'),
}).pipe(Schema.brand('PlaneShape'))

export const PhysicsShapeSchema = Schema.Union(BoxShapeSchema, SphereShapeSchema, PlaneShapeSchema)

export type PhysicsShape = Schema.Schema.Type<typeof PhysicsShapeSchema>

/**
 * RigidBody Service
 */
export interface RigidBodyService {
  readonly create: (
    config: RigidBodyConfig,
    shape: PhysicsShape
  ) => Effect.Effect<CANNON.Body, PhysicsBodyCreationError>

  readonly setPosition: (body: CANNON.Body, position: PhysicsVector3) => Effect.Effect<void, never>

  readonly setVelocity: (body: CANNON.Body, velocity: PhysicsVector3) => Effect.Effect<void, never>

  readonly applyForce: (
    body: CANNON.Body,
    force: PhysicsVector3,
    worldPoint: PhysicsVector3
  ) => Effect.Effect<void, never>
}

export const RigidBodyService = Context.GenericTag<RigidBodyService>(
  '@minecraft/infrastructure/cannon/RigidBodyService'
)

export class PhysicsBodyCreationError extends Schema.TaggedError<PhysicsBodyCreationError>()(
  'PhysicsBodyCreationError',
  {
    config: Schema.Unknown,
    shape: Schema.Unknown,
    cause: Schema.Unknown,
  }
) {}

/**
 * RigidBodyService Live Implementation
 */
export const RigidBodyServiceLive = Layer.succeed(
  RigidBodyService,
  RigidBodyService.of({
    create: (config, shape) =>
      Effect.try({
        try: () => {
          // Shape生成
          const cannonShape = createCannonShape(shape)

          // Body生成
          const body = new CANNON.Body({
            mass: config.mass,
            position: new CANNON.Vec3(config.position.x, config.position.y, config.position.z),
            velocity: new CANNON.Vec3(config.velocity.x, config.velocity.y, config.velocity.z),
            quaternion: new CANNON.Quaternion(
              config.quaternion.x,
              config.quaternion.y,
              config.quaternion.z,
              config.quaternion.w
            ),
            angularVelocity: new CANNON.Vec3(
              config.angularVelocity.x,
              config.angularVelocity.y,
              config.angularVelocity.z
            ),
            linearDamping: config.linearDamping,
            angularDamping: config.angularDamping,
            fixedRotation: config.fixedRotation,
            allowSleep: config.allowSleep,
          })

          body.addShape(cannonShape)

          return body
        },
        catch: (error) =>
          new PhysicsBodyCreationError({
            config,
            shape,
            cause: error,
          }),
      }),

    setPosition: (body, position) =>
      Effect.sync(() => {
        body.position.set(position.x, position.y, position.z)
      }),

    setVelocity: (body, velocity) =>
      Effect.sync(() => {
        body.velocity.set(velocity.x, velocity.y, velocity.z)
      }),

    applyForce: (body, force, worldPoint) =>
      Effect.sync(() => {
        body.applyForce(
          new CANNON.Vec3(force.x, force.y, force.z),
          new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z)
        )
      }),
  })
)

// Helper function
const createCannonShape = (shape: PhysicsShape): CANNON.Shape => {
  switch (shape.type) {
    case 'box':
      return new CANNON.Box(new CANNON.Vec3(shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z))
    case 'sphere':
      return new CANNON.Sphere(shape.radius)
    case 'plane':
      return new CANNON.Plane()
  }
}
```

#### Stage 3: World/Simulation（5時間）

```typescript
// src/infrastructure/cannon/world/world-service.ts
import { Schema, Effect, Context, Layer, Ref } from 'effect'
import * as CANNON from 'cannon-es'
import type { PhysicsVector3 } from '../types'

export const WorldConfigSchema = Schema.Struct({
  gravity: PhysicsVector3Schema,
  broadphase: Schema.optional(Schema.Literal('naive', 'sap')).pipe(Schema.withDefault(() => 'naive' as const)),
  solver: Schema.optional(
    Schema.Struct({
      iterations: Schema.Number.pipe(Schema.int(), Schema.positive()),
      tolerance: Schema.Number.pipe(Schema.positive()),
    })
  ),
})

export type WorldConfig = Schema.Schema.Type<typeof WorldConfigSchema>

export interface PhysicsWorldService {
  readonly create: (config: WorldConfig) => Effect.Effect<CANNON.World, never>
  readonly addBody: (world: CANNON.World, body: CANNON.Body) => Effect.Effect<void, never>
  readonly removeBody: (world: CANNON.World, body: CANNON.Body) => Effect.Effect<void, never>
  readonly step: (world: CANNON.World, deltaTime: number) => Effect.Effect<void, never>
}

export const PhysicsWorldService = Context.GenericTag<PhysicsWorldService>(
  '@minecraft/infrastructure/cannon/PhysicsWorldService'
)

export const PhysicsWorldServiceLive = Layer.succeed(
  PhysicsWorldService,
  PhysicsWorldService.of({
    create: (config) =>
      Effect.sync(() => {
        const world = new CANNON.World()

        world.gravity.set(config.gravity.x, config.gravity.y, config.gravity.z)

        if (config.broadphase === 'sap') {
          world.broadphase = new CANNON.SAPBroadphase(world)
        }

        if (config.solver) {
          world.solver.iterations = config.solver.iterations
          world.solver.tolerance = config.solver.tolerance
        }

        return world
      }),

    addBody: (world, body) =>
      Effect.sync(() => {
        world.addBody(body)
      }),

    removeBody: (world, body) =>
      Effect.sync(() => {
        world.removeBody(body)
      }),

    step: (world, deltaTime) =>
      Effect.sync(() => {
        world.step(deltaTime)
      }),
  })
)
```

### 技術的課題と解決策

#### 課題1: mutableなAPIの扱い

**問題**: Cannon.jsは内部状態を頻繁に変更する

**解決策**:

```typescript
// ❌ 避けるべきパターン
const body = new CANNON.Body({ mass: 1 })
body.position.x = 10 // mutable!

// ✅ 推奨パターン
const updateBodyPosition = (body: CANNON.Body, position: PhysicsVector3): Effect.Effect<void, never> =>
  Effect.sync(() => {
    body.position.set(position.x, position.y, position.z)
  })
```

#### 課題2: パフォーマンスクリティカルな物理演算

**問題**: 毎フレーム実行される物理演算のオーバーヘッド

**解決策**:

```typescript
// Effect.Streamによる効率的な物理ループ
import { Stream, Effect } from 'effect'

const physicsSimulationLoop = (world: CANNON.World, fps: number = 60) =>
  Stream.iterate(0, (n) => n + 1).pipe(
    Stream.mapEffect((frame) =>
      Effect.gen(function* () {
        const deltaTime = 1 / fps
        yield* PhysicsWorldService.step(world, deltaTime)
        return frame
      })
    ),
    Stream.throttle({ duration: Duration.millis(1000 / fps) })
  )
```

---

## Phase 1.5: idb-keyval（5時間）

### 既存実装の分析

現在、`src/infrastructure/inventory/persistence/indexed-db.ts`で以下のパターンが確立されています：

```typescript
// 既存の優れた実装パターン（そのまま維持）
const tryPromise = <A>(tag: 'load' | 'save' | 'delete' | 'clear', context: string, thunk: () => Promise<A>) =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) =>
      pipe(
        tag,
        Match.value,
        Match.when('load', () => toLoadFailed(backend, context, 'IndexedDB read failure', cause)),
        Match.when('save', () => toSaveFailed(backend, context, 'IndexedDB write failure', cause)),
        Match.when('delete', () => toSaveFailed(backend, context, 'IndexedDB delete failure', cause)),
        Match.when('clear', () => toSaveFailed(backend, context, 'IndexedDB clear failure', cause)),
        Match.exhaustive
      ),
  })
```

### Phase 1.5実装方針

**結論**: 既存の`indexed-db.ts`は**そのまま維持**し、追加のラッパーは不要。

**理由**:

1. ✅ 既に完全なEffect-TSパターンで実装済み
2. ✅ Schema検証が適切に実装済み
3. ✅ エラーハンドリングがMatch APIで型安全
4. ✅ Effect.tryPromiseで非同期処理を正しくラップ済み

### 検証項目

```bash
# idb-keyvalの直接使用が1箇所のみであることを確認
grep -r "from 'idb-keyval'" src --include="*.ts"
# 期待結果: src/infrastructure/inventory/persistence/indexed-db.ts のみ
```

---

## 検証基準

### 自動検証

実装完了後、以下のコマンドで検証します：

```bash
# 型チェック
pnpm typecheck
# 期待結果: 0エラー

# Linter
pnpm check
# 期待結果: 0警告

# テスト
pnpm test
# 期待結果: 100% PASS

# ビルド
pnpm build
# 期待結果: 成功
```

### 手動検証（Grep）

```bash
# Three.js直接インポート確認（infrastructure/three/内は除外）
grep -r "import.*three" src --include="*.ts" | grep -v "src/infrastructure/three"
# 期待結果: 0件

# CANNON直接インポート確認（infrastructure/cannon/内は除外）
grep -r "import.*cannon" src --include="*.ts" | grep -v "src/infrastructure/cannon"
# 期待結果: 0件

# idb-keyval直接使用確認
grep -r "from 'idb-keyval'" src --include="*.ts" | grep -v "indexed-db.ts"
# 期待結果: 0件

# Three.js直接インスタンス化確認
grep -r "new THREE\." src --include="*.ts" | grep -v "src/infrastructure/three"
# 期待結果: 0件（全てラッパー経由）
```

---

## リスク管理

### 高リスク項目

#### リスク1: Three.js API変更への追従コスト

**影響度**: 高
**発生確率**: 中
**対策**:

- Schemaバージョニングによる段階的移行
- アダプターレイヤーのAPI設計
- 変更検出のための自動テスト

```typescript
// Schemaバージョニング例
export const Vector3SchemaV1 = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}).pipe(Schema.brand('Vector3V1'))

export const Vector3SchemaV2 = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  _version: Schema.Literal('2'),
}).pipe(Schema.brand('Vector3V2'))

// マイグレーション関数
export const migrateVector3V1toV2 = (v1: Vector3V1): Effect.Effect<Vector3V2, never> =>
  Effect.succeed(Vector3SchemaV2.make({ x: v1.x, y: v1.y, z: v1.z, _version: '2' }))
```

#### リスク2: Cannon.js mutableな性質による副作用

**影響度**: 中
**発生確率**: 高
**対策**:

- すべてのmutable操作をEffect.syncでラップ
- Immutableなデータ構造を優先
- 物理演算ループの明示的な分離

```typescript
// ✅ 安全なパターン
const updatePhysics = (world: CANNON.World, deltaTime: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    world.step(deltaTime) // mutable操作をEffect内に隔離
  })
```

#### リスク3: パフォーマンスオーバーヘッド

**影響度**: 中
**発生確率**: 低
**対策**:

- ホットパス最適化（Effect.unsafeRunSync使用を検討）
- ベンチマーク整備
- プロファイリングによる継続的改善

```typescript
// ベンチマークテスト例
import { Bench } from 'tinybench'

const bench = new Bench()

bench
  .add('Direct Three.js', () => {
    const v = new THREE.Vector3(1, 2, 3)
    return v.length()
  })
  .add('Effect-TS Wrapper', () => {
    const v = Vector3Schema.make({ x: 1, y: 2, z: 3 })
    return length(v)
  })

await bench.run()
console.table(bench.table())
```

---

## 次のアクション

### Phase 1実装開始チェックリスト

- [ ] **Step 1**: Phase 1.1 Vector3実装（2時間）
  - [ ] `src/infrastructure/three/core/vector3.ts` 作成
  - [ ] テスト作成: `src/infrastructure/three/core/vector3.test.ts`
  - [ ] `pnpm typecheck && pnpm test` 通過確認

- [ ] **Step 2**: Phase 1.1 Quaternion/Euler実装（3時間）
  - [ ] `quaternion.ts`, `euler.ts` 作成
  - [ ] テスト作成
  - [ ] 検証

- [ ] **Step 3**: Phase 1.1 Matrix4/Color実装（5時間）
  - [ ] `matrix4.ts`, `color.ts`, `box3.ts`, `sphere.ts` 作成
  - [ ] テスト作成
  - [ ] Phase 1.1完了検証

- [ ] **Step 4**: Phase 1.2 Geometry実装（7時間）
  - [ ] BoxGeometry, SphereGeometry, PlaneGeometry
  - [ ] Effect.Scopeによるリソース管理
  - [ ] テスト

- [ ] **Step 5**: Phase 1.2 Material実装（8時間）
  - [ ] BasicMaterial, StandardMaterial
  - [ ] Textureラッパー
  - [ ] テスト

- [ ] **Step 6**: Phase 1.3 Scene/Renderer実装（10時間）
  - [ ] SceneService, PerspectiveCameraService
  - [ ] WebGLRendererラッパー
  - [ ] 既存コード置換開始

- [ ] **Step 7**: Phase 1.4 Cannon.js実装（20時間）
  - [ ] Stage 1: 型定義
  - [ ] Stage 2: Body/Shape API
  - [ ] Stage 3: World/Simulation
  - [ ] パフォーマンステスト

- [ ] **Step 8**: Phase 1.5検証（1時間）
  - [ ] `indexed-db.ts`が適切に実装されていることを確認
  - [ ] 追加ラッパー不要を確認

### 各Phase完了後の記録（Serena MCP）

```typescript
// メモリ保存例
mcp__serena__write_memory({
  memory_name: 'phase1-1-vector3-implementation',
  content: `
# Phase 1.1 Vector3実装完了

## 実装内容
- Vector3Schema定義完了
- 全ベクトル演算関数実装
- Three.js相互変換実装

## テスト結果
- 単体テスト: 25/25 PASS
- 型チェック: 0エラー
- カバレッジ: 100%

## 実装パターン
- Brand型による型安全性
- Effect.sync/Effect.genによる副作用管理
- Match APIによるエラーハンドリング

## 次のステップ
Phase 1.1 Quaternion/Euler実装
`,
})
```

### 段階的CI検証

```bash
# Phase 1.1完了後
pnpm typecheck && pnpm check && pnpm test
git commit -m "feat(three): Phase 1.1 Core Types実装完了"

# Phase 1.2完了後
pnpm typecheck && pnpm check && pnpm test && pnpm build
git commit -m "feat(three): Phase 1.2 Geometry/Material実装完了"

# Phase 1全体完了後
pnpm typecheck && pnpm check && pnpm test && pnpm build
grep -r "import.*three" src --include="*.ts" | grep -v "src/infrastructure/three" | wc -l
# 期待結果: 0
```

---

## 参考資料

### プロジェクト内ドキュメント

- [Effect-TS型システム](../../tutorials/effect-ts-fundamentals/effect-ts-type-system.md)
- [Effect-TSパターン](../../tutorials/effect-ts-fundamentals/effect-ts-patterns.md)
- [開発規約](./development-conventions.md)
- [型リファレンス](../../reference/effect-ts-types/type-reference.md)

### 既存実装パターン

- **IndexedDB完全ラッパー**: `src/infrastructure/inventory/persistence/indexed-db.ts`
  - Effect.tryPromiseパターン
  - Schema検証統合
  - Match APIによるエラーハンドリング

- **AudioService実装**: `src/infrastructure/audio/audio-service-live.ts`
  - Service/Layerパターン
  - リソース管理

### 外部ドキュメント

- [Three.js公式ドキュメント](https://threejs.org/docs/)
- [Cannon-es公式ドキュメント](https://pmndrs.github.io/cannon-es/)
- [Effect-TS公式ガイド](https://effect.website/docs/guides)
- [Effect Schema公式](https://effect.website/docs/schema/introduction)

---

**ドキュメントバージョン**: 1.0
**作成日**: 2025年（EXECUTION.mdのPhase 1セクションを基に作成）
**ステータス**: Phase 1実装ガイド完成
**次のアクション**: Phase 1.1 Vector3実装開始
