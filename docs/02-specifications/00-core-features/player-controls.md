---
title: "プレイヤー制御システム仕様 - 入力処理・操作レスポンス"
description: "キーボード・マウス入力、プレイヤー移動、ブロック操作、インベントリ管理の完全仕様。レスポンシブなゲームプレイ体験。"
category: "specification"
difficulty: "intermediate"
tags: ["player-controls", "input-system", "mouse-keyboard", "movement-system", "block-interaction", "inventory-controls"]
prerequisites: ["effect-ts-fundamentals", "event-handling", "player-system-basics"]
estimated_reading_time: "25分"
related_patterns: ["event-driven-patterns", "state-machine-patterns", "input-handling-patterns"]
related_docs: ["./02-player-system.md", "./18-input-controls.md", "./01-inventory-system.md"]
---

# プレイヤー制御

TypeScript Minecraftのプレイヤー制御システムは、マウス・キーボード入力の処理、プレイヤー移動、ブロック配置・破壊、インベントリ管理、及びターゲティングシステムを統合的に提供する。Effect-TSによる関数型アプローチにより、レスポンシブで予測可能な操作体験を実現している。

## アーキテクチャ概要

```
プレイヤー制御システム構成:
┌─────────────────────────────────────────┐
│ アプリケーション層                        │
│ - PlayerMoveUseCase                     │
│ - BlockPlaceUseCase                     │
│ - InputHandlingWorkflow                 │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ ドメイン層                               │
│ - CameraControlService                  │
│ - TargetingService                      │
│ - PlayerMovementService                 │
│ - InventoryService                      │
└─────────────────────────────────────────┘
           │
┌─────────────────────────────────────────┐
│ インフラストラクチャ層                      │
│ - BrowserInputAdapter                   │
│ - InputStateManager                     │
└─────────────────────────────────────────┘
```

## 入力処理（キーボード、マウス）

### 入力状態管理

```typescript
import { Schema, Effect, Layer, Context, Ref } from "effect"

// Schema-based data structures
const MouseState = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  deltaX: Schema.Number,
  deltaY: Schema.Number,
  leftButton: Schema.Boolean,
  rightButton: Schema.Boolean,
  middleButton: Schema.Boolean,
  wheel: Schema.Number
})

const GamepadState = Schema.Struct({
  connected: Schema.Boolean,
  axes: Schema.Array(Schema.Number),
  buttons: Schema.Array(Schema.Boolean)
})

const InputState = Schema.Struct({
  keys: Schema.Record(Schema.String, Schema.Boolean),
  mouse: MouseState,
  gamepad: GamepadState
})

type InputState = Schema.Schema.Type<typeof InputState>

interface InputPortInterface {
  readonly getInputState: () => Effect.Effect<InputState, never>
  readonly addEventListener: (event: InputEvent, callback: (data: unknown) => void) => Effect.Effect<void, never>
  readonly removeEventListener: (event: InputEvent, callback: (data: unknown) => void) => Effect.Effect<void, never>
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean, never>
  readonly isMouseButtonPressed: (button: MouseButton) => Effect.Effect<boolean, never>
}

export const InputPort = Context.GenericTag<InputPortInterface>("@app/InputPort")
```

### ブラウザ入力アダプタ

```typescript
interface BrowserInputAdapterInterface extends InputPortInterface {
  readonly startListening: () => Effect.Effect<void, never>
  readonly stopListening: () => Effect.Effect<void, never>
  readonly lockPointer: () => Effect.Effect<void, InputError>
  readonly unlockPointer: () => Effect.Effect<void, never>
}

export const BrowserInputAdapter = Context.GenericTag<BrowserInputAdapterInterface>("@app/BrowserInputAdapter")

// Error types
const InputError = Schema.Struct({
  _tag: Schema.Literal("InputError"),
  message: Schema.String,
  timestamp: Schema.Number
})

type InputError = Schema.Schema.Type<typeof InputError>

const makeBrowserInputAdapter = Effect.gen(function* () {
  // 内部状態管理
  const inputState = yield* Ref.make<InputState>({
    keys: {},
    mouse: {
      x: 0, y: 0,
      deltaX: 0, deltaY: 0,
      leftButton: false,
      rightButton: false,
      middleButton: false,
      wheel: 0
    },
    gamepad: {
      connected: false,
      axes: [],
      buttons: []
    }
  })

    // キーボードイベントハンドラ
    const handleKeyDown = (event: KeyboardEvent) =>
      Ref.update(inputState, state => ({
        ...state,
        keys: { ...state.keys, [event.code]: true }
      }))

    const handleKeyUp = (event: KeyboardEvent) =>
      Ref.update(inputState, state => ({
        ...state,
        keys: { ...state.keys, [event.code]: false }
      }))

    // マウスイベントハンドラ
    const handleMouseMove = (event: MouseEvent) =>
      Ref.update(inputState, state => ({
        ...state,
        mouse: {
          ...state.mouse,
          x: event.clientX,
          y: event.clientY,
          deltaX: event.movementX || 0,
          deltaY: event.movementY || 0
        }
      }))

    const handleMouseDown = (event: MouseEvent) =>
      Ref.update(inputState, state => ({
        ...state,
        mouse: {
          ...state.mouse,
          leftButton: event.button === 0 ? true : state.mouse.leftButton,
          rightButton: event.button === 2 ? true : state.mouse.rightButton,
          middleButton: event.button === 1 ? true : state.mouse.middleButton
        }
      }))

    const handleMouseUp = (event: MouseEvent) =>
      Ref.update(inputState, state => ({
        ...state,
        mouse: {
          ...state.mouse,
          leftButton: event.button === 0 ? false : state.mouse.leftButton,
          rightButton: event.button === 2 ? false : state.mouse.rightButton,
          middleButton: event.button === 1 ? false : state.mouse.middleButton
        }
      }))

    const handleWheel = (event: WheelEvent) =>
      Ref.update(inputState, state => ({
        ...state,
        mouse: {
          ...state.mouse,
          wheel: event.deltaY
        }
      }))

    // イベントリスナー登録
    const startListening = () =>
      Effect.sync(() => {
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keyup', handleKeyUp)
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mousedown', handleMouseDown)
        document.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('wheel', handleWheel)
      })

    const stopListening = () =>
      Effect.sync(() => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('keyup', handleKeyUp)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mousedown', handleMouseDown)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('wheel', handleWheel)
      })

    // ポインターロック
    const lockPointer = () =>
      Effect.tryPromise({
        try: () => document.body.requestPointerLock(),
        catch: (error) => ({
          _tag: "InputError" as const,
          message: 'Failed to lock pointer',
          timestamp: Date.now()
        })
      })

    const getInputState = (): Effect.Effect<InputState, never> =>
      Ref.get(inputState)

    const unlockPointer = () => Effect.sync(() => {
      if (document.pointerLockElement) {
        document.exitPointerLock()
      }
    })

    const addEventListener = (event: InputEvent, callback: (data: unknown) => void) =>
      Effect.sync(() => {
        // Implementation depends on specific event type
      })

    const removeEventListener = (event: InputEvent, callback: (data: unknown) => void) =>
      Effect.sync(() => {
        // Implementation depends on specific event type
      })

    const isKeyPressed = (key: string) =>
      Ref.get(inputState).pipe(
        Effect.map(state => state.keys[key] || false)
      )

    const isMouseButtonPressed = (button: MouseButton) =>
      Ref.get(inputState).pipe(
        Effect.map(state => {
          if (button === "left") return state.mouse.leftButton
          if (button === "right") return state.mouse.rightButton
          if (button === "middle") return state.mouse.middleButton
          return false
        })
      )

    return BrowserInputAdapter.of({
      getInputState,
      startListening,
      stopListening,
      lockPointer,
      unlockPointer,
      addEventListener,
      removeEventListener,
      isKeyPressed,
      isMouseButtonPressed
    })
  })

export const BrowserInputAdapterLive = Layer.effect(
  BrowserInputAdapter,
  makeBrowserInputAdapter
)
```

### 入力マッピングシステム

```typescript
// Schema-based Input Mapping
const InputMapping = Schema.Struct({
  action: Schema.String,
  keys: Schema.Array(Schema.String),
  mouseButtons: Schema.Array(Schema.String), // "left" | "right" | "middle"
  gamepadButtons: Schema.Array(Schema.Number)
})

type InputMapping = Schema.Schema.Type<typeof InputMapping>

const InputActions = Schema.Struct({
  moveForward: Schema.Boolean,
  moveBackward: Schema.Boolean,
  moveLeft: Schema.Boolean,
  moveRight: Schema.Boolean,
  jump: Schema.Boolean,
  sneak: Schema.Boolean,
  run: Schema.Boolean,
  placeBlock: Schema.Boolean,
  breakBlock: Schema.Boolean,
  openInventory: Schema.Boolean,
  pickBlock: Schema.Boolean
})

type InputActions = Schema.Schema.Type<typeof InputActions>

const InputMappingService = {
  defaultMappings: [
    { action: 'moveForward', keys: ['KeyW'], mouseButtons: [], gamepadButtons: [] },
    { action: 'moveBackward', keys: ['KeyS'], mouseButtons: [], gamepadButtons: [] },
    { action: 'moveLeft', keys: ['KeyA'], mouseButtons: [], gamepadButtons: [] },
    { action: 'moveRight', keys: ['KeyD'], mouseButtons: [], gamepadButtons: [] },
    { action: 'jump', keys: ['Space'], mouseButtons: [], gamepadButtons: [] },
    { action: 'sneak', keys: ['ShiftLeft'], mouseButtons: [], gamepadButtons: [] },
    { action: 'run', keys: ['ControlLeft'], mouseButtons: [], gamepadButtons: [] },
    { action: 'placeBlock', keys: [], mouseButtons: ['right'], gamepadButtons: [] },
    { action: 'breakBlock', keys: [], mouseButtons: ['left'], gamepadButtons: [] },
    { action: 'openInventory', keys: ['KeyE'], mouseButtons: [], gamepadButtons: [] },
    { action: 'pickBlock', keys: [], mouseButtons: ['middle'], gamepadButtons: [] }
  ] as ReadonlyArray<InputMapping>,

  mapInputToActions: (inputState: InputState, mappings: ReadonlyArray<InputMapping>): InputActions => {
    const actions: Record<string, boolean> = {}
    
    for (const mapping of mappings) {
      let isActive = false
      
      // キーボードチェック
      for (const key of mapping.keys) {
        if (inputState.keys[key]) {
          isActive = true
          break
        }
      }
      
      // マウスボタンチェック（早期リターンパターン）
      if (!isActive) {
        for (const button of mapping.mouseButtons) {
          const buttonActive = (() => {
            if (button === "left") return inputState.mouse.leftButton
            if (button === "right") return inputState.mouse.rightButton
            if (button === "middle") return inputState.mouse.middleButton
            return false
          })()

          if (buttonActive) {
            isActive = true
            break
          }
        }
      }
      
      // ゲームパッドボタンチェック
      if (!isActive && inputState.gamepad.connected) {
        for (const buttonIndex of mapping.gamepadButtons) {
          if (inputState.gamepad.buttons[buttonIndex]) {
            isActive = true
            break
          }
        }
      }
      
      actions[mapping.action] = isActive
    }
    
    return actions as InputActions
  }
}
```

## 移動システム

### プレイヤー移動ロジック

```typescript
// Schema-based configuration
const PlayerMovementConfig = Schema.Struct({
  walkSpeed: Schema.Number.pipe(Schema.positive()),
  runSpeed: Schema.Number.pipe(Schema.positive()),
  jumpHeight: Schema.Number.pipe(Schema.positive()),
  gravity: Schema.Number.pipe(Schema.positive()),
  friction: Schema.Number.pipe(Schema.between(0, 1)),
  airControl: Schema.Number.pipe(Schema.between(0, 1))
})

type PlayerMovementConfig = Schema.Schema.Type<typeof PlayerMovementConfig>

interface PlayerMoveUseCaseInterface {
  readonly movePlayer: (actions: InputActions, deltaTime: number) => Effect.Effect<void, MovementError>
  readonly updateCamera: (mouseDelta: Vector2, deltaTime: number) => Effect.Effect<void, CameraError>
  readonly applyPhysics: (deltaTime: number) => Effect.Effect<void, PhysicsError>
}

export const PlayerMoveUseCase = Context.GenericTag<PlayerMoveUseCaseInterface>("@app/PlayerMoveUseCase")

// Error types
const MovementError = Schema.Struct({
  _tag: Schema.Literal("MovementError"),
  message: Schema.String
})

const CameraError = Schema.Struct({
  _tag: Schema.Literal("CameraError"),
  message: Schema.String
})

const PhysicsError = Schema.Struct({
  _tag: Schema.Literal("PhysicsError"),
  message: Schema.String
})

type MovementError = Schema.Schema.Type<typeof MovementError>
type CameraError = Schema.Schema.Type<typeof CameraError>
type PhysicsError = Schema.Schema.Type<typeof PhysicsError>

const makePlayerMoveUseCase = Effect.gen(function* () {
  const entityService = yield* EntityDomainService
  const physicsService = yield* PhysicsDomainService
  const cameraService = yield* CameraControlService

  const config: PlayerMovementConfig = {
    walkSpeed: 4.5,
    runSpeed: 6.0,
    jumpHeight: 1.25,
    gravity: 9.8,
    friction: 0.8,
    airControl: 0.3
  }

    const movePlayer = (actions: InputActions, deltaTime: number) =>
      Effect.gen(function* () {
        // プレイヤーエンティティ取得
        const playerId = yield* getPlayerEntityId()
        const position = yield* entityService.getComponent(playerId, 'position')
        const velocity = yield* entityService.getComponent(playerId, 'velocity')
        const onGround = yield* entityService.getComponent(playerId, 'onGround')

        // 早期リターン: 必要なコンポーネントが存在しない場合
        if (!position || !velocity) {
          return yield* Effect.fail({
            _tag: "MovementError" as const,
            message: "Required components not found"
          })
        }

        // 移動ベクトル計算
        const moveVector = calculateMoveVector(actions, config)
        const currentSpeed = actions.run ? config.runSpeed : config.walkSpeed

        // カメラの向きを取得
        const camera = yield* cameraService.getCamera()
        const forward = calculateForwardVector(camera.rotation)
        const right = calculateRightVector(camera.rotation)

        // ワールド座標での移動ベクトル
        const worldMoveVector = {
          x: right.x * moveVector.x + forward.x * moveVector.z,
          y: 0,
          z: right.z * moveVector.x + forward.z * moveVector.z
        }

        // 地面接触時の制御
        if (onGround?.value) {
          // ジャンプ処理
          if (actions.jump) {
            const jumpVelocity = Math.sqrt(2 * config.gravity * config.jumpHeight)
            yield* entityService.updateComponent(playerId, 'velocity', {
              ...velocity,
              y: jumpVelocity
            })
          }

          // 水平移動
          const newVelocity = {
            x: worldMoveVector.x * currentSpeed,
            y: velocity.y,
            z: worldMoveVector.z * currentSpeed
          }

          yield* entityService.updateComponent(playerId, 'velocity', newVelocity)
        } else {
          // 空中制御
          const airControlFactor = config.airControl
          const newVelocity = {
            x: velocity.x + worldMoveVector.x * currentSpeed * airControlFactor * deltaTime,
            y: velocity.y,
            z: velocity.z + worldMoveVector.z * currentSpeed * airControlFactor * deltaTime
          }

          yield* entityService.updateComponent(playerId, 'velocity', newVelocity)
        }
      })

    const updateCamera = (mouseDelta: Vector2, deltaTime: number) =>
      Effect.gen(function* () {
        const sensitivity = 0.002
        const maxPitch = Math.PI / 2 - 0.1

        const camera = yield* cameraService.getCamera()
        
        const newRotation = {
          x: Math.max(-maxPitch, Math.min(maxPitch, camera.rotation.x - mouseDelta.y * sensitivity)),
          y: camera.rotation.y - mouseDelta.x * sensitivity,
          z: 0
        }

        yield* cameraService.setRotation(newRotation)
      })

    const applyPhysics = (deltaTime: number) =>
      Effect.gen(function* () {
        // Physics implementation
        const playerId = yield* getPlayerEntityId()
        const velocity = yield* entityService.getComponent(playerId, 'velocity')

        if (!velocity) {
          return yield* Effect.fail({
            _tag: "PhysicsError" as const,
            message: "Velocity component not found"
          })
        }

        // Apply gravity
        const newVelocity = {
          ...velocity,
          y: velocity.y - config.gravity * deltaTime
        }

        yield* entityService.updateComponent(playerId, 'velocity', newVelocity)
      })

    return PlayerMoveUseCase.of({
      movePlayer,
      updateCamera,
      applyPhysics
    })
  })

export const PlayerMoveUseCaseLive = Layer.effect(
  PlayerMoveUseCase,
  makePlayerMoveUseCase
)

// ヘルパー関数
const calculateMoveVector = (actions: InputActions, config: PlayerMovementConfig): Vector3 => {
  let x = 0
  let z = 0

  if (actions.moveForward) z += 1
  if (actions.moveBackward) z -= 1
  if (actions.moveLeft) x -= 1
  if (actions.moveRight) x += 1

  // 正規化（斜め移動の速度調整）
  const magnitude = Math.sqrt(x * x + z * z)
  if (magnitude > 0) {
    x /= magnitude
    z /= magnitude
  }

  return { x, y: 0, z }
}

const calculateForwardVector = (rotation: Vector3): Vector3 => ({
  x: Math.sin(rotation.y),
  y: 0,
  z: Math.cos(rotation.y)
})

const calculateRightVector = (rotation: Vector3): Vector3 => ({
  x: Math.cos(rotation.y),
  y: 0,
  z: -Math.sin(rotation.y)
})
```

### 衝突検知と移動補正

```typescript
const applyMovementEffects = (
  position: Vector3,
  velocity: Vector3,
  deltaTime: number
): Effect.Effect<{ position: Vector3; velocity: Vector3; onGround: boolean }> =>
  Effect.gen(function* () {
    const worldRepository = yield* WorldRepositoryPort
    
    // 新しい位置計算
    const newPosition = {
      x: position.x + velocity.x * deltaTime,
      y: position.y + velocity.y * deltaTime,
      z: position.z + velocity.z * deltaTime
    }

    // プレイヤーAABB
    const playerAABB = createAABB(newPosition, { x: 0.6, y: 1.8, z: 0.6 })

    // 衝突検知
    const collisions = yield* checkCollisions(playerAABB)
    
    let finalPosition = newPosition
    let finalVelocity = velocity
    let onGround = false

    // 各軸での衝突解決
    for (const collision of collisions) {
      if (collision.normal.y > 0.5) {
        // 地面衝突
        finalPosition.y = collision.contactPoint.y + 0.9 // プレイヤー高さの半分
        finalVelocity.y = 0
        onGround = true
      } else if (collision.normal.y < -0.5) {
        // 天井衝突
        finalPosition.y = collision.contactPoint.y - 0.9
        finalVelocity.y = 0
      }
      
      if (Math.abs(collision.normal.x) > 0.5) {
        // X軸壁衝突
        finalPosition.x = collision.contactPoint.x + collision.normal.x * 0.3
        finalVelocity.x = 0
      }
      
      if (Math.abs(collision.normal.z) > 0.5) {
        // Z軸壁衝突
        finalPosition.z = collision.contactPoint.z + collision.normal.z * 0.3
        finalVelocity.z = 0
      }
    }

    return {
      position: finalPosition,
      velocity: finalVelocity,
      onGround
    }
  })

const checkCollisions = (playerAABB: AABB): Effect.Effect<ReadonlyArray<Collision>> =>
  Effect.gen(function* () {
    const worldRepository = yield* WorldRepositoryPort
    const collisions: Collision[] = []

    // AABBが含むブロック座標の範囲計算
    const minX = Math.floor(playerAABB.minX)
    const maxX = Math.floor(playerAABB.maxX)
    const minY = Math.floor(playerAABB.minY)
    const maxY = Math.floor(playerAABB.maxY)
    const minZ = Math.floor(playerAABB.minZ)
    const maxZ = Math.floor(playerAABB.maxZ)

    // 各ブロックとの衝突チェック
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = yield* worldRepository.getBlock(x, y, z)
          
          if (Option.isSome(block) && block.value.isSolid) {
            const blockAABB = createAABB(
              { x: x + 0.5, y: y + 0.5, z: z + 0.5 },
              { x: 1, y: 1, z: 1 }
            )
            
            if (areAABBsIntersecting(playerAABB, blockAABB)) {
              const collision = calculateCollisionNormal(playerAABB, blockAABB)
              collisions.push(collision)
            }
          }
        }
      }
    }

    return collisions
  })
```

## ブロック配置・破壊

### ターゲティングシステム

```typescript
// Schema-based targeting system
const Vector3 = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})

type Vector3 = Schema.Schema.Type<typeof Vector3>

const BlockFace = Schema.Union(
  Schema.Literal("top"),
  Schema.Literal("bottom"),
  Schema.Literal("north"),
  Schema.Literal("south"),
  Schema.Literal("west"),
  Schema.Literal("east")
)

type BlockFace = Schema.Schema.Type<typeof BlockFace>

const TargetingResult = Schema.Struct({
  hit: Schema.Boolean,
  blockPosition: Schema.optional(Vector3),
  placePosition: Schema.optional(Vector3),
  face: Schema.optional(BlockFace),
  distance: Schema.optional(Schema.Number.pipe(Schema.nonNegative()))
})

type TargetingResult = Schema.Schema.Type<typeof TargetingResult>

interface TargetingServiceInterface {
  readonly raycastBlocks: (origin: Vector3, direction: Vector3, maxDistance: number) => Effect.Effect<TargetingResult, never>
  readonly getTargetedBlock: () => Effect.Effect<Option.Option<TargetingResult>, never>
  readonly updateTargeting: (cameraPosition: Vector3, cameraDirection: Vector3) => Effect.Effect<void, never>
}

export const TargetingService = Context.GenericTag<TargetingServiceInterface>("@app/TargetingService")

const makeTargetingService = Effect.gen(function* () {
  const currentTarget = yield* Ref.make<Option.Option<TargetingResult>>(Option.none())

    const raycastBlocks = (origin: Vector3, direction: Vector3, maxDistance: number): Effect.Effect<TargetingResult> =>
      Effect.gen(function* () {
        const worldRepository = yield* WorldRepositoryPort
        
        const stepSize = 0.1
        let currentDistance = 0

        while (currentDistance < maxDistance) {
          const currentPoint = {
            x: origin.x + direction.x * currentDistance,
            y: origin.y + direction.y * currentDistance,
            z: origin.z + direction.z * currentDistance
          }

          const blockX = Math.floor(currentPoint.x)
          const blockY = Math.floor(currentPoint.y)
          const blockZ = Math.floor(currentPoint.z)

          const block = yield* worldRepository.getBlock(blockX, blockY, blockZ)
          
          if (Option.isSome(block) && block.value.isSolid) {
            // ヒット面の計算
            const face = calculateHitFace(currentPoint, { x: blockX, y: blockY, z: blockZ })
            const placePosition = calculatePlacePosition({ x: blockX, y: blockY, z: blockZ }, face)

            return {
              hit: true,
              blockPosition: { x: blockX, y: blockY, z: blockZ },
              placePosition,
              face,
              distance: currentDistance
            }
          }

          currentDistance += stepSize
        }

        return { hit: false }
      })

    const calculateHitFace = (hitPoint: Vector3, blockPos: Vector3): BlockFace => {
      const relativeX = hitPoint.x - blockPos.x
      const relativeY = hitPoint.y - blockPos.y
      const relativeZ = hitPoint.z - blockPos.z

      const absX = Math.abs(relativeX - 0.5)
      const absY = Math.abs(relativeY - 0.5)
      const absZ = Math.abs(relativeZ - 0.5)

      if (absY > absX && absY > absZ) {
        return relativeY > 0.5 ? 'top' : 'bottom'
      } else if (absX > absZ) {
        return relativeX > 0.5 ? 'east' : 'west'
      } else {
        return relativeZ > 0.5 ? 'south' : 'north'
      }
    }

    // 純粋関数として分離（PBTテスト対応）
    const calculatePlacePosition = (blockPos: Vector3, face: BlockFace): Vector3 => {
      if (face === "top") return { x: blockPos.x, y: blockPos.y + 1, z: blockPos.z }
      if (face === "bottom") return { x: blockPos.x, y: blockPos.y - 1, z: blockPos.z }
      if (face === "north") return { x: blockPos.x, y: blockPos.y, z: blockPos.z - 1 }
      if (face === "south") return { x: blockPos.x, y: blockPos.y, z: blockPos.z + 1 }
      if (face === "west") return { x: blockPos.x - 1, y: blockPos.y, z: blockPos.z }
      if (face === "east") return { x: blockPos.x + 1, y: blockPos.y, z: blockPos.z }
      // 網羅性チェック（never型が返る）
      const _exhaustive: never = face
      return _exhaustive
    }

    const updateTargeting = (cameraPosition: Vector3, cameraDirection: Vector3) =>
      Effect.gen(function* () {
        const result = yield* raycastBlocks(cameraPosition, cameraDirection, 5.0)
        yield* Ref.set(currentTarget, result.hit ? Option.some(result) : Option.none())
      })

    return TargetingService.of({
      raycastBlocks,
      getTargetedBlock: () => Ref.get(currentTarget),
      updateTargeting
    })
  })

export const TargetingServiceLive = Layer.effect(
  TargetingService,
  makeTargetingService
)
```

### ブロック配置・破壊ユースケース

```typescript
interface BlockPlaceUseCaseInterface {
  readonly placeBlock: (blockType: BlockType) => Effect.Effect<boolean, BlockPlaceError>
  readonly breakBlock: () => Effect.Effect<boolean, BlockBreakError>
  readonly canPlaceBlock: (position: Vector3, blockType: BlockType) => Effect.Effect<boolean, never>
}

export const BlockPlaceUseCase = Context.GenericTag<BlockPlaceUseCaseInterface>("@app/BlockPlaceUseCase")

// Error types
const BlockPlaceError = Schema.Struct({
  _tag: Schema.Literal("BlockPlaceError"),
  message: Schema.String,
  position: Schema.optional(Vector3)
})

const BlockBreakError = Schema.Struct({
  _tag: Schema.Literal("BlockBreakError"),
  message: Schema.String,
  position: Schema.optional(Vector3)
})

type BlockPlaceError = Schema.Schema.Type<typeof BlockPlaceError>
type BlockBreakError = Schema.Schema.Type<typeof BlockBreakError>

const makeBlockPlaceUseCase = Effect.gen(function* () {
  const targetingService = yield* TargetingService
  const worldRepository = yield* WorldRepositoryPort
  const inventoryService = yield* InventoryService

    const placeBlock = (blockType: BlockType): Effect.Effect<boolean, BlockPlaceError> =>
      Effect.gen(function* () {
        // 早期リターン: ターゲット確認
        const target = yield* targetingService.getTargetedBlock()
        if (Option.isNone(target) || !target.value.hit || !target.value.placePosition) {
          return yield* Effect.fail({
            _tag: "BlockPlaceError" as const,
            message: "No valid target for block placement"
          })
        }

        const placePos = target.value.placePosition

        // 早期リターン: 配置可能性チェック
        const canPlace = yield* canPlaceBlock(placePos, blockType)
        if (!canPlace) {
          return yield* Effect.fail({
            _tag: "BlockPlaceError" as const,
            message: "Cannot place block at this position",
            position: placePos
          })
        }

        // 早期リターン: インベントリからブロック消費
        const hasBlock = yield* inventoryService.hasItem(blockType, 1)
        if (!hasBlock) {
          return yield* Effect.fail({
            _tag: "BlockPlaceError" as const,
            message: "Not enough items in inventory"
          })
        }

        yield* inventoryService.removeItem(blockType, 1)

        // ブロック配置
        const newBlock = createBlock(blockType, placePos)
        yield* worldRepository.setBlock(placePos.x, placePos.y, placePos.z, newBlock)

        // 音効果再生
        yield* playBlockPlaceSound(blockType)

        return true
      })

    const breakBlock = (): Effect.Effect<boolean, BlockBreakError> =>
      Effect.gen(function* () {
        // 早期リターン: ターゲット確認
        const target = yield* targetingService.getTargetedBlock()
        if (Option.isNone(target) || !target.value.hit || !target.value.blockPosition) {
          return yield* Effect.fail({
            _tag: "BlockBreakError" as const,
            message: "No valid target for block breaking"
          })
        }

        const blockPos = target.value.blockPosition
        const block = yield* worldRepository.getBlock(blockPos.x, blockPos.y, blockPos.z)

        // 早期リターン: ブロックが存在しない場合
        if (Option.isNone(block)) {
          return yield* Effect.fail({
            _tag: "BlockBreakError" as const,
            message: "No block found at target position",
            position: blockPos
          })
        }

        // ブロック破壊
        yield* worldRepository.removeBlock(blockPos.x, blockPos.y, blockPos.z)

        // アイテムドロップ
        const dropItems = calculateBlockDrops(block.value)
        for (const item of dropItems) {
          yield* inventoryService.addItem(item.type, item.count)
        }

        // 音効果再生
        yield* playBlockBreakSound(block.value.type)

        return true
      })

    const canPlaceBlock = (position: Vector3, blockType: BlockType): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        // 既存ブロックチェック
        const existingBlock = yield* worldRepository.getBlock(position.x, position.y, position.z)
        if (Option.isSome(existingBlock)) return false

        // プレイヤー衝突チェック
        const playerId = yield* getPlayerEntityId()
        const playerPosition = yield* entityService.getComponent(playerId, 'position')
        
        if (playerPosition) {
          const playerAABB = createAABB(playerPosition.position, { x: 0.6, y: 1.8, z: 0.6 })
          const blockAABB = createAABB(position, { x: 1, y: 1, z: 1 })
          
          if (areAABBsIntersecting(playerAABB, blockAABB)) {
            return false
          }
        }

        return true
      })

    return BlockPlaceUseCase.of({
      placeBlock,
      breakBlock,
      canPlaceBlock
    })
  })

export const BlockPlaceUseCaseLive = Layer.effect(
  BlockPlaceUseCase,
  makeBlockPlaceUseCase
)
```

## インベントリ管理

### インベントリシステム

```typescript
// Schema-based inventory system
const InventorySlot = Schema.Struct({
  itemType: Schema.NullOr(Schema.String), // ItemType
  count: Schema.Number.pipe(Schema.nonNegative(), Schema.int()),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

type InventorySlot = Schema.Schema.Type<typeof InventorySlot>

const Inventory = Schema.Struct({
  slots: Schema.Array(InventorySlot),
  size: Schema.Number.pipe(Schema.positive(), Schema.int()),
  selectedSlotIndex: Schema.Number.pipe(Schema.nonNegative(), Schema.int())
})

type Inventory = Schema.Schema.Type<typeof Inventory>

interface InventoryServiceInterface {
  readonly getInventory: () => Effect.Effect<Inventory, never>
  readonly addItem: (itemType: ItemType, count: number) => Effect.Effect<number, never> // 実際に追加された数
  readonly removeItem: (itemType: ItemType, count: number) => Effect.Effect<number, never> // 実際に削除された数
  readonly hasItem: (itemType: ItemType, count: number) => Effect.Effect<boolean, never>
  readonly setSelectedSlot: (index: number) => Effect.Effect<void, InventoryError>
  readonly getSelectedItem: () => Effect.Effect<Option.Option<InventorySlot>, never>
  readonly swapSlots: (from: number, to: number) => Effect.Effect<void, InventoryError>
}

export const InventoryService = Context.GenericTag<InventoryServiceInterface>("@app/InventoryService")

// Error types
const InventoryError = Schema.Struct({
  _tag: Schema.Literal("InventoryError"),
  message: Schema.String
})

type InventoryError = Schema.Schema.Type<typeof InventoryError>

const makeInventoryService = Effect.gen(function* () {
  const inventoryRef = yield* Ref.make<Inventory>({
    slots: Array.from({ length: 36 }, () => ({ itemType: null, count: 0 })),
    size: 36,
    selectedSlotIndex: 0
  })

    // 純粋関数として分離
    const getMaxStackSize = (itemType: ItemType): number => {
      // アイテムタイプによるスタックサイズの決定
      if (itemType === "dirt" || itemType === "stone") return 64
      if (itemType === "diamond" || itemType === "gold") return 16
      return 1
    }

    const addItem = (itemType: ItemType, count: number): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const inventory = yield* Ref.get(inventoryRef)
        let remainingCount = count
        const newSlots = [...inventory.slots]

        // 既存スタックに追加
        for (let i = 0; i < newSlots.length && remainingCount > 0; i++) {
          const slot = newSlots[i]
          if (slot.itemType === itemType) {
            const maxStack = getMaxStackSize(itemType)
            const addAmount = Math.min(remainingCount, maxStack - slot.count)
            if (addAmount > 0) {
              newSlots[i] = { ...slot, count: slot.count + addAmount }
              remainingCount -= addAmount
            }
          }
        }

        // 空きスロットに追加
        for (let i = 0; i < newSlots.length && remainingCount > 0; i++) {
          const slot = newSlots[i]
          if (slot.itemType === null) {
            const maxStack = getMaxStackSize(itemType)
            const addAmount = Math.min(remainingCount, maxStack)
            newSlots[i] = { itemType, count: addAmount }
            remainingCount -= addAmount
          }
        }

        yield* Ref.set(inventoryRef, { ...inventory, slots: newSlots })
        yield* Ref.set(inventoryRef, { ...inventory, slots: newSlots })
        return count - remainingCount
      })

    const removeItem = (itemType: ItemType, count: number): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const inventory = yield* Ref.get(inventoryRef)
        let remainingCount = count
        const newSlots = [...inventory.slots]

        for (let i = 0; i < newSlots.length && remainingCount > 0; i++) {
          const slot = newSlots[i]
          if (slot.itemType === itemType) {
            const removeAmount = Math.min(remainingCount, slot.count)
            const newCount = slot.count - removeAmount
            
            if (newCount <= 0) {
              newSlots[i] = { itemType: null, count: 0 }
            } else {
              newSlots[i] = { ...slot, count: newCount }
            }
            
            remainingCount -= removeAmount
          }
        }

        yield* Ref.set(inventoryRef, { ...inventory, slots: newSlots })
        yield* Ref.set(inventoryRef, { ...inventory, slots: newSlots })
        return count - remainingCount
      })

    const hasItem = (itemType: ItemType, count: number): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const inventory = yield* Ref.get(inventoryRef)
        let totalCount = 0

        for (const slot of inventory.slots) {
          if (slot.itemType === itemType) {
            totalCount += slot.count
          }
        }

        return totalCount >= count
      })

    const setSelectedSlot = (index: number): Effect.Effect<void, InventoryError> =>
      Effect.gen(function* () {
        const inventory = yield* Ref.get(inventoryRef)

        // 早期リターン: インデックス範囲チェック
        if (index < 0 || index >= inventory.size) {
          return yield* Effect.fail({
            _tag: "InventoryError" as const,
            message: `Invalid slot index: ${index}`
          })
        }

        yield* Ref.set(inventoryRef, { ...inventory, selectedSlotIndex: index })
      })

    const getSelectedItem = (): Effect.Effect<Option.Option<InventorySlot>, never> =>
      Effect.gen(function* () {
        const inventory = yield* Ref.get(inventoryRef)
        const slot = inventory.slots[inventory.selectedSlotIndex]
        return slot && slot.itemType ? Option.some(slot) : Option.none()
      })

    const swapSlots = (from: number, to: number): Effect.Effect<void, InventoryError> =>
      Effect.gen(function* () {
        const inventory = yield* Ref.get(inventoryRef)

        // 早期リターン: インデックス範囲チェック
        if (from < 0 || from >= inventory.size || to < 0 || to >= inventory.size) {
          return yield* Effect.fail({
            _tag: "InventoryError" as const,
            message: `Invalid slot indices: ${from}, ${to}`
          })
        }

        const newSlots = [...inventory.slots]
        ;[newSlots[from], newSlots[to]] = [newSlots[to], newSlots[from]]

        yield* Ref.set(inventoryRef, { ...inventory, slots: newSlots })
      })

    return InventoryService.of({
      getInventory: () => Ref.get(inventoryRef),
      addItem,
      removeItem,
      hasItem,
      setSelectedSlot,
      getSelectedItem,
      swapSlots
    })
  })

export const InventoryServiceLive = Layer.effect(
  InventoryService,
  makeInventoryService
)
```

### ホットバー管理

```typescript
interface HotbarServiceInterface {
  readonly getHotbarSlots: () => Effect.Effect<ReadonlyArray<InventorySlot>, never>
  readonly selectSlot: (index: number) => Effect.Effect<void, InventoryError>
  readonly getSelectedSlot: () => Effect.Effect<number, never>
  readonly scrollHotbar: (delta: number) => Effect.Effect<void, never>
}

export const HotbarService = Context.GenericTag<HotbarServiceInterface>("@app/HotbarService")

const makeHotbarService = Effect.gen(function* () {
  const inventoryService = yield* InventoryService
  const HOTBAR_SIZE = 9

    const getHotbarSlots = (): Effect.Effect<ReadonlyArray<InventorySlot>, never> =>
      Effect.gen(function* () {
        const inventory = yield* inventoryService.getInventory()
        return inventory.slots.slice(0, HOTBAR_SIZE)
      })

    const scrollHotbar = (delta: number): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const inventory = yield* inventoryService.getInventory()
        const direction = delta > 0 ? 1 : -1
        const newIndex = (inventory.selectedSlotIndex + direction + HOTBAR_SIZE) % HOTBAR_SIZE
        // エラーは内部で処理され、外部に伝播しない
        yield* inventoryService.setSelectedSlot(newIndex).pipe(
          Effect.catchAll(() => Effect.unit)
        )
      })

    return HotbarService.of({
      getHotbarSlots,
      selectSlot: inventoryService.setSelectedSlot,
      getSelectedSlot: () => inventoryService.getInventory().pipe(
        Effect.map(inv => inv.selectedSlotIndex)
      ),
      scrollHotbar
    })
  })

export const HotbarServiceLive = Layer.effect(
  HotbarService,
  makeHotbarService
)
```

## 入力処理統合

### 入力ワークフロー

```typescript
const InputHandlingWorkflow = {
  processInput: (deltaTime: number) =>
    Effect.gen(function* () {
      const inputAdapter = yield* BrowserInputAdapter
      const inputState = yield* inputAdapter.getInputState()
      
      // 入力をアクションにマッピング
      const actions = InputMappingService.mapInputToActions(
        inputState,
        InputMappingService.defaultMappings
      )

      // プレイヤー移動処理
      const playerMoveUseCase = yield* PlayerMoveUseCase
      yield* playerMoveUseCase.movePlayer(actions, deltaTime)

      // カメラ更新
      yield* playerMoveUseCase.updateCamera(
        { x: inputState.mouse.deltaX, y: inputState.mouse.deltaY },
        deltaTime
      )

      // ブロック操作
      if (actions.placeBlock) {
        const blockPlaceUseCase = yield* BlockPlaceUseCase
        const selectedItem = yield* inventoryService.getSelectedItem()
        
        if (Option.isSome(selectedItem) && selectedItem.value.itemType) {
          yield* blockPlaceUseCase.placeBlock(selectedItem.value.itemType as BlockType)
        }
      }

      if (actions.breakBlock) {
        const blockPlaceUseCase = yield* BlockPlaceUseCase
        yield* blockPlaceUseCase.breakBlock()
      }

      // ホットバースクロール
      if (inputState.mouse.wheel !== 0) {
        const hotbarService = yield* HotbarService
        yield* hotbarService.scrollHotbar(inputState.mouse.wheel)
      }

      // インベントリ開閉
      if (actions.openInventory) {
        const uiService = yield* UIService
        yield* uiService.toggleInventory()
      }
    })
}
```

このプレイヤー制御システムは、リアルタイムでレスポンシブな操作体験を提供し、Effect-TSによる型安全性により、複雑な入力処理でも予測可能で保守性の高い実装を実現している。入力マッピング、移動物理、ターゲティング、インベントリ管理が統合され、完全なプレイヤー体験を提供する。