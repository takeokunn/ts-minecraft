/**
 * Camera Domain - Test Helpers Barrel Export
 *
 * 世界最高峰のテストヘルパー統合エクスポート
 */

// Generators
export * from './generators'

// Fixtures
export * from './fixtures'

// Test Layer
export * from './test-layer'

// Re-export frequently used testing utilities
export {
  DeterministicTestLayer,
  IntegrationTestLayer,
  PerformanceTestLayer,
  TestLayer,
  assertEffectFails,
  assertEffectSucceeds,
  assertErrorTag,
  cleanupTestEnvironment,
  initializeTestEnvironment,
  resetAllMocks,
  runDeterministicTest,
  runIntegrationTest,
  runPerformanceTest,
  runTest,
} from './test-layer'

export {
  DEFAULT_ANIMATION_TIMELINE,
  DEFAULT_CAMERA_DISTANCE,
  DEFAULT_CINEMATIC_SETTINGS,
  DEFAULT_FIRST_PERSON_SETTINGS,
  DEFAULT_POSITION,
  DEFAULT_ROTATION,
  DEFAULT_SPECTATOR_SETTINGS,
  DEFAULT_THIRD_PERSON_SETTINGS,
  DEFAULT_VIEW_OFFSET,
  createExtremeCameraState,
  createExtremeMouseInput,
  createGameplayCameraState,
  createHighSensitivityMouseInput,
  createMassiveCameraStates,
  createStandardCameraState,
  createStandardMouseInput,
} from './fixtures'

export {
  boundedPosition3DGenerator,
  boundingBoxGenerator,
  cameraDistanceGenerator,
  cameraRotationGenerator,
  combineGenerators,
  createPropertyTest,
  direction3DGenerator,
  edgeCasePosition3DGenerator,
  fullCameraStateGenerator,
  invalidCoordinateGenerator,
  lerpFactorGenerator,
  mouseInputGenerator,
  position3DGenerator,
  velocity3DGenerator,
  viewModeGenerator,
  viewOffsetGenerator,
} from './generators'
