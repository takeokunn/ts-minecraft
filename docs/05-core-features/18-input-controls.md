# 入力制御システム

TypeScript Minecraftのキーボード・マウス・ゲームパッド操作を統合した入力制御システム。柔軟な入力マッピングと複数デバイスの同時サポートにより、快適な操作体験を提供する。

## デフォルトキーマッピング

### 基本移動操作

| 操作 | キーボード | ゲームパッド | 説明 |
|------|------------|--------------|------|
| 前進 | W | 左スティック↑ | プレイヤーを前方に移動 |
| 後退 | S | 左スティック↓ | プレイヤーを後方に移動 |
| 左移動 | A | 左スティック← | プレイヤーを左に移動 |
| 右移動 | D | 左スティック→ | プレイヤーを右に移動 |
| ジャンプ | Space | Aボタン | プレイヤーをジャンプさせる |
| しゃがみ | Shift (左) | Bボタン | プレイヤーをしゃがませる |
| 走る | Ctrl (左) | 左スティック押込み | 通常より高速で移動 |

### カメラ操作

| 操作 | マウス | ゲームパッド | 説明 |
|------|--------|--------------|------|
| 視点移動 | マウス移動 | 右スティック | カメラの向きを変更 |
| 感度調整 | 設定で変更 | 設定で変更 | カメラの回転感度 |

### ブロック操作

| 操作 | マウス | ゲームパッド | 説明 |
|------|--------|--------------|------|
| ブロック破壊 | 左クリック | 右トリガー | ターゲットしたブロックを破壊 |
| ブロック配置 | 右クリック | 左トリガー | 選択中のブロックを配置 |
| ブロック選択 | 中クリック | 右スティック押込み | ターゲットブロックを選択 |

### インベントリ操作

| 操作 | キーボード | ゲームパッド | 説明 |
|------|------------|--------------|------|
| インベントリ開閉 | E | Yボタン | インベントリ画面の表示/非表示 |
| ホットバー選択 | 1-9キー | 十字キー | ホットバースロットを選択 |
| ホットバースクロール | マウスホイール | LB/RBボタン | ホットバーを順次選択 |

## 入力マッピングカスタマイズ

### 設定ファイル形式

```json
{
  "inputMappings": {
    "moveForward": {
      "keys": ["KeyW"],
      "gamepadButtons": [],
      "gamepadAxes": [{ "axis": 1, "direction": "positive" }]
    },
    "moveBackward": {
      "keys": ["KeyS"],
      "gamepadButtons": [],
      "gamepadAxes": [{ "axis": 1, "direction": "negative" }]
    },
    "moveLeft": {
      "keys": ["KeyA"],
      "gamepadButtons": [],
      "gamepadAxes": [{ "axis": 0, "direction": "negative" }]
    },
    "moveRight": {
      "keys": ["KeyD"],
      "gamepadButtons": [],
      "gamepadAxes": [{ "axis": 0, "direction": "positive" }]
    },
    "jump": {
      "keys": ["Space"],
      "gamepadButtons": [0],
      "gamepadAxes": []
    },
    "sneak": {
      "keys": ["ShiftLeft"],
      "gamepadButtons": [1],
      "gamepadAxes": []
    },
    "run": {
      "keys": ["ControlLeft"],
      "gamepadButtons": [10],
      "gamepadAxes": []
    }
  },
  "sensitivity": {
    "mouse": 0.002,
    "gamepad": 0.05
  },
  "deadzone": {
    "leftStick": 0.15,
    "rightStick": 0.15,
    "triggers": 0.1
  }
}
```

### キーコード対応表

#### よく使用されるキー

| 物理キー | キーコード | 説明 |
|----------|------------|------|
| W | KeyW | 英字キー |
| A | KeyA | 英字キー |
| S | KeyS | 英字キー |
| D | KeyD | 英字キー |
| Space | Space | スペースキー |
| Shift (左) | ShiftLeft | 左シフトキー |
| Shift (右) | ShiftRight | 右シフトキー |
| Ctrl (左) | ControlLeft | 左コントロールキー |
| Ctrl (右) | ControlRight | 右コントロールキー |
| E | KeyE | インベントリキー |
| Escape | Escape | エスケープキー |

#### 数字キー (ホットバー)

| 物理キー | キーコード |
|----------|------------|
| 1 | Digit1 |
| 2 | Digit2 |
| 3 | Digit3 |
| 4 | Digit4 |
| 5 | Digit5 |
| 6 | Digit6 |
| 7 | Digit7 |
| 8 | Digit8 |
| 9 | Digit9 |

### ゲームパッドボタン対応表

Xbox Controllerを基準とした標準マッピング:

| ボタン | インデックス | Xbox名称 |
|--------|--------------|----------|
| 0 | A | Aボタン |
| 1 | B | Bボタン |
| 2 | X | Xボタン |
| 3 | Y | Yボタン |
| 4 | LB | 左バンパー |
| 5 | RB | 右バンパー |
| 6 | LT | 左トリガー |
| 7 | RT | 右トリガー |
| 8 | Back | Backボタン |
| 9 | Start | Startボタン |
| 10 | LS | 左スティック押込み |
| 11 | RS | 右スティック押込み |
| 12 | ↑ | 十字キー上 |
| 13 | ↓ | 十字キー下 |
| 14 | ← | 十字キー左 |
| 15 | → | 十字キー右 |

### ゲームパッド軸対応表

| 軸インデックス | 説明 | 範囲 |
|----------------|------|------|
| 0 | 左スティック X軸 | -1.0 ～ 1.0 |
| 1 | 左スティック Y軸 | -1.0 ～ 1.0 |
| 2 | 右スティック X軸 | -1.0 ～ 1.0 |
| 3 | 右スティック Y軸 | -1.0 ～ 1.0 |

## 操作の詳細設定

### マウス感度調整

```typescript
interface MouseSettings {
  sensitivity: number     // 基本感度 (0.001 - 0.01)
  invertX: boolean       // X軸反転
  invertY: boolean       // Y軸反転
  acceleration: number   // マウス加速度 (0.0 - 2.0)
}
```

### ゲームパッド設定

```typescript
interface GamepadSettings {
  sensitivity: number         // 基本感度 (0.01 - 0.1)
  invertX: boolean           // X軸反転
  invertY: boolean           // Y軸反転
  deadzone: {               // デッドゾーン設定
    leftStick: number       // 左スティック (0.0 - 0.3)
    rightStick: number      // 右スティック (0.0 - 0.3)
    triggers: number        // トリガー (0.0 - 0.3)
  }
  vibration: boolean        // 振動有効/無効
}
```

### アクセシビリティ設定

```typescript
interface AccessibilitySettings {
  holdToSprint: boolean      // 走りをホールド式にする
  toggleCrouch: boolean      // しゃがみをトグル式にする
  autoJump: boolean          // オートジャンプ
  mouseKeyNavigation: boolean // マウスキーナビゲーション
  colorBlindSupport: boolean // 色覚サポート
}
```

## 入力処理の実装パターン

### 基本入力チェック

```typescript
// キー押下状態の確認
const isForwardPressed = inputState.keys['KeyW'] ||
                        (inputState.gamepad.connected &&
                         inputState.gamepad.axes[1] < -0.5)

// マウスボタン状態の確認
const isLeftClickPressed = inputState.mouse.leftButton ||
                          (inputState.gamepad.connected &&
                           inputState.gamepad.buttons[7]) // 右トリガー
```

### 連続入力と単発入力の区別

```typescript
interface InputTracker {
  wasPressed: boolean
  isPressed: boolean
  justPressed: boolean    // このフレームで押された
  justReleased: boolean   // このフレームで離された
}

const updateInputTracker = (tracker: InputTracker, currentState: boolean): InputTracker => ({
  wasPressed: tracker.isPressed,
  isPressed: currentState,
  justPressed: !tracker.isPressed && currentState,
  justReleased: tracker.isPressed && !currentState
})
```

### 複合入力の処理

```typescript
// 走り + ジャンプ = 高跳び
const isHighJump = inputActions.run && inputActions.jump && onGround

// しゃがみ + 移動 = 忍び歩き
const isSneaking = inputActions.sneak && (
  inputActions.moveForward ||
  inputActions.moveBackward ||
  inputActions.moveLeft ||
  inputActions.moveRight
)
```

## デバッグとトラブルシューティング

### 入力状態デバッグ表示

開発モード時の入力状態確認:

```typescript
const debugInputState = (inputState: InputState) => {
  console.log('Input Debug:', {
    keys: Object.keys(inputState.keys).filter(key => inputState.keys[key]),
    mouse: {
      position: `${inputState.mouse.x}, ${inputState.mouse.y}`,
      delta: `${inputState.mouse.deltaX}, ${inputState.mouse.deltaY}`,
      buttons: [
        inputState.mouse.leftButton && 'left',
        inputState.mouse.rightButton && 'right',
        inputState.mouse.middleButton && 'middle'
      ].filter(Boolean)
    },
    gamepad: inputState.gamepad.connected ? {
      axes: inputState.gamepad.axes,
      buttons: inputState.gamepad.buttons.map((pressed, index) => pressed ? index : null).filter(x => x !== null)
    } : 'disconnected'
  })
}
```

### よくある問題と解決方法

#### ゲームパッドが認識されない
1. ブラウザのゲームパッドAPIサポート確認
2. ゲームパッドドライバーの更新
3. 一度ボタンを押してアクティブ化

#### マウス感度が高すぎる/低すぎる
1. 設定ファイルのsensitivity値を調整
2. OSレベルのマウス設定確認
3. ポインターロックの確認

#### キー入力が反応しない
1. キーコードの確認 (KeyW vs KeyQ など)
2. ブラウザフォーカス状態確認
3. 他のアプリケーションとのキー競合確認

このドキュメントは、プレイヤーが快適にゲームを操作できるよう、包括的な入力制御情報を提供している。技術的な実装詳細は `docs/features/player-controls.md` を参照。