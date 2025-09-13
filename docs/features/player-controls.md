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
interface InputState {
  readonly keys: Record<string, boolean>
  readonly mouse: {
    readonly x: number
    readonly y: number
    readonly deltaX: number
    readonly deltaY: number
    readonly leftButton: boolean
    readonly rightButton: boolean
    readonly middleButton: boolean
    readonly wheel: number
  }
  readonly gamepad: {
    readonly connected: boolean
    readonly axes: ReadonlyArray<number>
    readonly buttons: ReadonlyArray<boolean>
  }
}

interface InputPort {
  readonly getInputState: () => Effect.Effect<InputState>
  readonly addEventListener: (event: InputEvent, callback: (data: unknown) => void) => Effect.Effect<void>
  readonly removeEventListener: (event: InputEvent, callback: (data: unknown) => void) => Effect.Effect<void>
  readonly isKeyPressed: (key: string) => Effect.Effect<boolean>
  readonly isMouseButtonPressed: (button: MouseButton) => Effect.Effect<boolean>
}
```

### ブラウザ入力アダプタ

```typescript
interface IBrowserInputAdapter extends InputPort {
  readonly startListening: () => Effect.Effect<void>
  readonly stopListening: () => Effect.Effect<void>
  readonly lockPointer: () => Effect.Effect<void>
  readonly unlockPointer: () => Effect.Effect<void>
}

const BrowserInputAdapterLive = Layer.scoped(
  BrowserInputAdapter,
  Effect.gen(function* () {
    // 内部状態管理
    const inputState = yield* Ref.make<InternalInputState>({
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
        catch: (error) => new InfrastructureError({
          message: 'Failed to lock pointer',
          timestamp: Date.now()
        })
      })

    const getInputState = (): Effect.Effect<InputState> =>
      Ref.get(inputState).pipe(
        Effect.map(state => ({
          keys: state.keys,
          mouse: state.mouse,
          gamepad: state.gamepad
        }))
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
)
```

### 入力マッピングシステム

```typescript
interface InputMapping {
  readonly action: string
  readonly keys: ReadonlyArray<string>
  readonly mouseButtons: ReadonlyArray<MouseButton>
  readonly gamepadButtons: ReadonlyArray<number>
}

interface InputActions {
  readonly moveForward: boolean
  readonly moveBackward: boolean
  readonly moveLeft: boolean
  readonly moveRight: boolean
  readonly jump: boolean
  readonly sneak: boolean
  readonly run: boolean
  readonly placeBlock: boolean
  readonly breakBlock: boolean
  readonly openInventory: boolean
  readonly pickBlock: boolean
}

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
      
      // マウスボタンチェック
      if (!isActive) {
        for (const button of mapping.mouseButtons) {
          switch (button) {
            case 'left':
              if (inputState.mouse.leftButton) isActive = true
              break
            case 'right':
              if (inputState.mouse.rightButton) isActive = true
              break
            case 'middle':
              if (inputState.mouse.middleButton) isActive = true
              break
          }
          if (isActive) break
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
interface PlayerMovementConfig {
  readonly walkSpeed: number
  readonly runSpeed: number
  readonly jumpHeight: number
  readonly gravity: number
  readonly friction: number
  readonly airControl: number
}

interface PlayerMoveUseCase {
  readonly movePlayer: (actions: InputActions, deltaTime: number) => Effect.Effect<void>
  readonly updateCamera: (mouseDelta: Vector2, deltaTime: number) => Effect.Effect<void>
  readonly applyPhysics: (deltaTime: number) => Effect.Effect<void>
}

const PlayerMoveUseCaseLive = Layer.effect(
  PlayerMoveUseCase,
  Effect.gen(function* () {
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

        if (!position || !velocity) return

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

    return PlayerMoveUseCase.of({
      movePlayer,
      updateCamera,
      applyPhysics
    })
  })
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
interface TargetingResult {
  readonly hit: boolean
  readonly blockPosition?: Vector3
  readonly placePosition?: Vector3
  readonly face?: BlockFace
  readonly distance?: number
}

interface TargetingService {
  readonly raycastBlocks: (origin: Vector3, direction: Vector3, maxDistance: number) => Effect.Effect<TargetingResult>
  readonly getTargetedBlock: () => Effect.Effect<Option.Option<TargetingResult>>
  readonly updateTargeting: (cameraPosition: Vector3, cameraDirection: Vector3) => Effect.Effect<void>
}

const TargetingServiceLive = Layer.effect(
  TargetingService,
  Effect.gen(function* () {
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

    const calculatePlacePosition = (blockPos: Vector3, face: BlockFace): Vector3 => {
      switch (face) {
        case 'top': return { x: blockPos.x, y: blockPos.y + 1, z: blockPos.z }
        case 'bottom': return { x: blockPos.x, y: blockPos.y - 1, z: blockPos.z }
        case 'north': return { x: blockPos.x, y: blockPos.y, z: blockPos.z - 1 }
        case 'south': return { x: blockPos.x, y: blockPos.y, z: blockPos.z + 1 }
        case 'west': return { x: blockPos.x - 1, y: blockPos.y, z: blockPos.z }
        case 'east': return { x: blockPos.x + 1, y: blockPos.y, z: blockPos.z }
      }
    }

    return TargetingService.of({
      raycastBlocks,
      getTargetedBlock: () => Ref.get(currentTarget),
      updateTargeting
    })
  })
)
```

### ブロック配置・破壊ユースケース

```typescript
interface BlockPlaceUseCase {
  readonly placeBlock: (blockType: BlockType) => Effect.Effect<boolean>
  readonly breakBlock: () => Effect.Effect<boolean>
  readonly canPlaceBlock: (position: Vector3, blockType: BlockType) => Effect.Effect<boolean>
}

const BlockPlaceUseCaseLive = Layer.effect(
  BlockPlaceUseCase,
  Effect.gen(function* () {
    const targetingService = yield* TargetingService
    const worldRepository = yield* WorldRepositoryPort
    const inventoryService = yield* InventoryService

    const placeBlock = (blockType: BlockType): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        // ターゲット確認
        const target = yield* targetingService.getTargetedBlock()
        if (Option.isNone(target) || !target.value.hit || !target.value.placePosition) {
          return false
        }

        const placePos = target.value.placePosition

        // 配置可能性チェック
        const canPlace = yield* canPlaceBlock(placePos, blockType)
        if (!canPlace) return false

        // インベントリからブロック消費
        const hasBlock = yield* inventoryService.hasItem(blockType, 1)
        if (!hasBlock) return false

        yield* inventoryService.removeItem(blockType, 1)

        // ブロック配置
        const newBlock = createBlock(blockType, placePos)
        yield* worldRepository.setBlock(placePos.x, placePos.y, placePos.z, newBlock)

        // 音効果再生
        yield* playBlockPlaceSound(blockType)

        return true
      })

    const breakBlock = (): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const target = yield* targetingService.getTargetedBlock()
        if (Option.isNone(target) || !target.value.hit || !target.value.blockPosition) {
          return false
        }

        const blockPos = target.value.blockPosition
        const block = yield* worldRepository.getBlock(blockPos.x, blockPos.y, blockPos.z)
        
        if (Option.isNone(block)) return false

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
)
```

## インベントリ管理

### インベントリシステム

```typescript
interface InventorySlot {
  readonly itemType: ItemType | null
  readonly count: number
  readonly metadata?: Record<string, unknown>
}

interface Inventory {
  readonly slots: ReadonlyArray<InventorySlot>
  readonly size: number
  readonly selectedSlotIndex: number
}

interface InventoryService {
  readonly getInventory: () => Effect.Effect<Inventory>
  readonly addItem: (itemType: ItemType, count: number) => Effect.Effect<number> // 実際に追加された数
  readonly removeItem: (itemType: ItemType, count: number) => Effect.Effect<number> // 実際に削除された数
  readonly hasItem: (itemType: ItemType, count: number) => Effect.Effect<boolean>
  readonly setSelectedSlot: (index: number) => Effect.Effect<void>
  readonly getSelectedItem: () => Effect.Effect<Option.Option<InventorySlot>>
  readonly swapSlots: (from: number, to: number) => Effect.Effect<void>
}

const InventoryServiceLive = Layer.effect(
  InventoryService,
  Effect.gen(function* () {
    const inventoryRef = yield* Ref.make<Inventory>({
      slots: Array.from({ length: 36 }, () => ({ itemType: null, count: 0 })),
      size: 36,
      selectedSlotIndex: 0
    })

    const addItem = (itemType: ItemType, count: number): Effect.Effect<number> =>
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
        return count - remainingCount
      })

    const removeItem = (itemType: ItemType, count: number): Effect.Effect<number> =>
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
        return count - remainingCount
      })

    const hasItem = (itemType: ItemType, count: number): Effect.Effect<boolean> =>
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
)
```

### ホットバー管理

```typescript
interface HotbarService {
  readonly getHotbarSlots: () => Effect.Effect<ReadonlyArray<InventorySlot>>
  readonly selectSlot: (index: number) => Effect.Effect<void>
  readonly getSelectedSlot: () => Effect.Effect<number>
  readonly scrollHotbar: (delta: number) => Effect.Effect<void>
}

const HotbarServiceLive = Layer.effect(
  HotbarService,
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService
    const HOTBAR_SIZE = 9

    const getHotbarSlots = (): Effect.Effect<ReadonlyArray<InventorySlot>> =>
      Effect.gen(function* () {
        const inventory = yield* inventoryService.getInventory()
        return inventory.slots.slice(0, HOTBAR_SIZE)
      })

    const scrollHotbar = (delta: number): Effect.Effect<void> =>
      Effect.gen(function* () {
        const inventory = yield* inventoryService.getInventory()
        const direction = delta > 0 ? 1 : -1
        const newIndex = (inventory.selectedSlotIndex + direction + HOTBAR_SIZE) % HOTBAR_SIZE
        yield* inventoryService.setSelectedSlot(newIndex)
      })

    return HotbarService.of({
      getHotbarSlots,
      selectSlot: inventoryService.setSelectedSlot,
      getSelectedSlot: () => inventoryService.getInventory().pipe(Effect.map(inv => inv.selectedSlotIndex)),
      scrollHotbar
    })
  })
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