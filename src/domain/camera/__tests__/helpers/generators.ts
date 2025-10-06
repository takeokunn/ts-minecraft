/**
 * Camera Domain - Property-based Testing Generators
 *
 * FastCheck generatorsとEffect-TSの完全統合による
 * 世界最高峰のProperty-based Testing支援
 */

import { Brand, Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import type {
  Axis,
  BoundingBox,
  CameraDistance,
  Direction3D,
  LerpFactor,
  Position3D,
  Velocity3D,
  ViewOffset,
} from '../../value_object/camera_position/types'
import type { Angle, CameraRotation, Pitch, Yaw } from '../../value_object/camera_rotation/types'
// 値として使用するものは通常のimportに変更
import { PositionError, ViewMode, ViewModeError } from '../../value_object'

/**
 * === Position3D Generators ===
 */

// 有効な座標値のGenerator
export const coordinateGenerator = fc.float({
  min: Math.fround(-1000),
  max: Math.fround(1000),
  noNaN: true,
  noDefaultInfinity: true,
})

// Position3D Generator
export const position3DGenerator = fc
  .record({
    x: coordinateGenerator,
    y: coordinateGenerator,
    z: coordinateGenerator,
  })
  .map(({ x, y, z }) => Brand.nominal<Position3D>()({ x, y, z } as const))

// 境界内のPosition3D Generator
export const boundedPosition3DGenerator = (minX = -100, maxX = 100, minY = -100, maxY = 100, minZ = -100, maxZ = 100) =>
  fc
    .record({
      x: fc.float({ min: Math.fround(minX), max: Math.fround(maxX), noNaN: true, noDefaultInfinity: true }),
      y: fc.float({ min: Math.fround(minY), max: Math.fround(maxY), noNaN: true, noDefaultInfinity: true }),
      z: fc.float({ min: Math.fround(minZ), max: Math.fround(maxZ), noNaN: true, noDefaultInfinity: true }),
    })
    .map(({ x, y, z }) => Brand.nominal<Position3D>()({ x, y, z } as const))

// CameraDistance Generator（1-50の制約付き）
export const cameraDistanceGenerator = fc
  .float({
    min: Math.fround(1),
    max: Math.fround(50),
    noNaN: true,
    noDefaultInfinity: true,
  })
  .map((distance) => Brand.nominal<CameraDistance>()(distance))

// ViewOffset Generator
export const viewOffsetGenerator = fc
  .record({
    x: fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true, noDefaultInfinity: true }),
    y: fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true, noDefaultInfinity: true }),
    z: fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ x, y, z }) => Brand.nominal<ViewOffset>()({ x, y, z } as const))

// LerpFactor Generator（0-1の制約付き）
export const lerpFactorGenerator = fc
  .float({
    min: Math.fround(0),
    max: Math.fround(1),
    noNaN: true,
    noDefaultInfinity: true,
  })
  .map((factor) => Brand.nominal<LerpFactor>()(factor))

// Velocity3D Generator
export const velocity3DGenerator = fc
  .record({
    x: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true, noDefaultInfinity: true }),
    y: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true, noDefaultInfinity: true }),
    z: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ x, y, z }) => Brand.nominal<Velocity3D>()({ x, y, z } as const))

// Direction3D Generator（正規化されたベクトル）
export const direction3DGenerator = fc
  .record({
    x: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    y: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    z: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
  })
  .filter(({ x, y, z }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z)
    return magnitude > Math.fround(0.001) // ゼロベクトルを除外
  })
  .map(({ x, y, z }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z)
    return Brand.nominal<Direction3D>()({
      x: x / magnitude,
      y: y / magnitude,
      z: z / magnitude,
    } as const)
  })

// BoundingBox Generator
export const boundingBoxGenerator = fc.tuple(position3DGenerator, position3DGenerator).map(([pos1, pos2]) => {
  const minX = Math.min(pos1.x, pos2.x)
  const maxX = Math.max(pos1.x, pos2.x)
  const minY = Math.min(pos1.y, pos2.y)
  const maxY = Math.max(pos1.y, pos2.y)
  const minZ = Math.min(pos1.z, pos2.z)
  const maxZ = Math.max(pos1.z, pos2.z)

  return Brand.nominal<BoundingBox>()({
    min: Brand.nominal<Position3D>()({ x: minX, y: minY, z: minZ }),
    max: Brand.nominal<Position3D>()({ x: maxX, y: maxY, z: maxZ }),
  } as const)
})

// Position関連エラーGenerator
export const positionErrorGenerator = fc.oneof(
  fc
    .record({
      axis: fc.constantFrom('x', 'y', 'z') as fc.Arbitrary<Axis>,
      value: fc.float(),
      expected: fc.string(),
    })
    .map((data) => PositionError.InvalidCoordinate(data)),

  fc
    .record({
      position: position3DGenerator,
      bounds: boundingBoxGenerator,
    })
    .map((data) => PositionError.OutOfBounds(data)),

  fc
    .record({
      distance: fc.float({ noNaN: true, noDefaultInfinity: true }),
      min: fc.float({ min: Math.fround(0), noNaN: true, noDefaultInfinity: true }),
      max: fc.float({ min: Math.fround(0), noNaN: true, noDefaultInfinity: true }),
    })
    .map((data) => PositionError.InvalidDistance(data))
)

/**
 * === CameraRotation Generators ===
 */

// Angle Generator（度数法）
export const angleGenerator = fc
  .float({
    min: Math.fround(-360),
    max: Math.fround(360),
    noNaN: true,
    noDefaultInfinity: true,
  })
  .map((angle) => Brand.nominal<Angle>()(angle))

// Pitch Generator（-90 to 90度の制約）
export const pitchGenerator = fc
  .float({
    min: Math.fround(-90),
    max: Math.fround(90),
    noNaN: true,
    noDefaultInfinity: true,
  })
  .map((pitch) => Brand.nominal<Pitch>()(pitch))

// Yaw Generator（0 to 360度）
export const yawGenerator = fc
  .float({
    min: Math.fround(0),
    max: Math.fround(360),
    noNaN: true,
    noDefaultInfinity: true,
  })
  .map((yaw) => Brand.nominal<Yaw>()(yaw))

// CameraRotation Generator
export const cameraRotationGenerator = fc
  .record({
    pitch: pitchGenerator,
    yaw: yawGenerator,
    roll: angleGenerator,
  })
  .map((rotation) => Brand.nominal<CameraRotation>()(rotation))

/**
 * === ViewMode Settings Generators ===
 */

// FirstPersonSettings Generator
export const firstPersonSettingsGenerator = fc.record({
  bobbing: fc.boolean(),
  mouseSensitivity: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true, noDefaultInfinity: true }),
  smoothing: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
  headOffset: fc.float({ min: Math.fround(0), max: Math.fround(2), noNaN: true, noDefaultInfinity: true }),
})

// ThirdPersonSettings Generator
export const thirdPersonSettingsGenerator = fc.record({
  mouseSensitivity: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true, noDefaultInfinity: true }),
  smoothing: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
  distance: fc.float({ min: Math.fround(1.0), max: Math.fround(50.0), noNaN: true, noDefaultInfinity: true }),
  verticalOffset: fc.float({ min: Math.fround(-2), max: Math.fround(2), noNaN: true, noDefaultInfinity: true }),
  collisionEnabled: fc.boolean(),
})

// SpectatorSettings Generator
export const spectatorSettingsGenerator = fc.record({
  movementSpeed: fc.float({ min: Math.fround(1), max: Math.fround(50), noNaN: true, noDefaultInfinity: true }),
  mouseSensitivity: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true, noDefaultInfinity: true }),
  freefly: fc.boolean(),
  nightVision: fc.boolean(),
})

// CinematicSettings Generator
export const cinematicSettingsGenerator = fc.record({
  easing: fc.boolean(),
  duration: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true, noDefaultInfinity: true }),
  interpolation: fc.constantFrom('linear', 'smooth', 'bezier'),
  lockInput: fc.boolean(),
})

// AnimationKeyframe Generator
export const animationKeyframeGenerator = fc.record({
  time: fc.float({ min: Math.fround(0), max: Math.fround(10), noNaN: true, noDefaultInfinity: true }),
  position: fc.record({
    x: coordinateGenerator,
    y: coordinateGenerator,
    z: coordinateGenerator,
  }),
  rotation: fc.record({
    pitch: fc.float({ min: Math.fround(-90), max: Math.fround(90), noNaN: true, noDefaultInfinity: true }),
    yaw: fc.float({ min: Math.fround(0), max: Math.fround(360), noNaN: true, noDefaultInfinity: true }),
  }),
  easing: fc.constantFrom('linear', 'ease-in', 'ease-out', 'ease-in-out'),
})

// AnimationTimeline Generator
export const animationTimelineGenerator = fc.record({
  keyframes: fc.array(animationKeyframeGenerator, { minLength: 2, maxLength: 10 }),
  duration: fc.float({ min: Math.fround(1), max: Math.fround(30), noNaN: true, noDefaultInfinity: true }),
  loop: fc.boolean(),
})

/**
 * === ViewMode ADT Generators ===
 */

// ViewMode Generator
export const viewModeGenerator = fc.oneof(
  fc
    .record({
      settings: firstPersonSettingsGenerator,
    })
    .map((data) => ViewMode.FirstPerson(data)),

  fc
    .record({
      settings: thirdPersonSettingsGenerator,
      distance: cameraDistanceGenerator,
    })
    .map((data) => ViewMode.ThirdPerson(data)),

  fc
    .record({
      settings: spectatorSettingsGenerator,
    })
    .map((data) => ViewMode.Spectator(data)),

  fc
    .record({
      settings: cinematicSettingsGenerator,
      timeline: animationTimelineGenerator,
    })
    .map((data) => ViewMode.Cinematic(data))
)

// ViewModeError Generator
export const viewModeErrorGenerator = fc.oneof(
  fc
    .record({
      distance: fc.float({ noNaN: true, noDefaultInfinity: true }),
      min: fc.float({ min: Math.fround(0), noNaN: true, noDefaultInfinity: true }),
      max: fc.float({ min: Math.fround(0), noNaN: true, noDefaultInfinity: true }),
    })
    .map((data) => ViewModeError.InvalidDistance(data)),

  fc
    .record({
      field: fc.string(),
      value: fc.anything(),
      expected: fc.string(),
    })
    .map((data) => ViewModeError.InvalidSettings(data)),

  fc
    .record({
      reason: fc.string(),
    })
    .map((data) => ViewModeError.InvalidTimeline(data)),

  fc
    .record({
      mode: fc.anything(),
    })
    .map((data) => ViewModeError.InvalidMode(data))
)

/**
 * === 複合Generators ===
 */

// カメラ状態の完全なGenerator
export const fullCameraStateGenerator = fc.record({
  position: position3DGenerator,
  rotation: cameraRotationGenerator,
  viewMode: viewModeGenerator,
  distance: cameraDistanceGenerator,
  offset: viewOffsetGenerator,
})

// マウス入力Generator
export const mouseInputGenerator = fc.record({
  deltaX: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true, noDefaultInfinity: true }),
  deltaY: fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true, noDefaultInfinity: true }),
  sensitivity: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0), noNaN: true, noDefaultInfinity: true }),
})

// 無効値のGenerator（境界値テスト用）
export const invalidCoordinateGenerator = fc.oneof(
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.float({ min: Math.fround(1e10), max: Math.fround(1e20) }),
  fc.float({ min: Math.fround(-1e20), max: Math.fround(-1e10) })
)

// エッジケース用Position3D Generator
export const edgeCasePosition3DGenerator = fc.oneof(
  // ゼロ座標
  fc.constant(Brand.nominal<Position3D>()({ x: 0, y: 0, z: 0 })),
  // 境界値
  fc.constant(Brand.nominal<Position3D>()({ x: 1000, y: 1000, z: 1000 })),
  fc.constant(Brand.nominal<Position3D>()({ x: -1000, y: -1000, z: -1000 })),
  // 小数点以下が多い値
  fc
    .record({
      x: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
      y: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
      z: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    })
    .map(({ x, y, z }) =>
      Brand.nominal<Position3D>()({
        x: Number(x.toFixed(10)),
        y: Number(y.toFixed(10)),
        z: Number(z.toFixed(10)),
      })
    )
)

/**
 * === Helper関数 ===
 */

// Property-basedテスト用のヘルパー
export const createPropertyTest = <T>(
  generator: fc.Arbitrary<T>,
  predicate: (value: T) => Effect.Effect<boolean, any, any>
) => fc.property(generator, predicate)

// 複数のGeneratorを組み合わせるヘルパー
export const combineGenerators = <T extends readonly unknown[]>(
  ...generators: { [K in keyof T]: fc.Arbitrary<T[K]> }
): fc.Arbitrary<T> => fc.tuple(...generators)
