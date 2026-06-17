# 機能検証マトリクス — コアサバイバル準拠表

> **方針**: 公式 Minecraft Java Edition (1.21) を仕様ソースとし、本実装の定数・アルゴリズム・UX を原子レベルで列挙する。
> **スコープ**: コアサバイバル体験のみ（ネザー/エンド/エンチャント/ポーション/エリトラは対象外）。
> 更新日: 2026-06-13
> **調査モデルへ**: 各項目をコードと実際の動作で確認し、末尾に「OK / NG: 理由」を追記すること。

---

## 調査モデル向けガイド

### コードマップ

| 領域 | 主要ファイル |
|---|---|
| ブロック定義 | `packages/core/domain/block-type.ts` |
| アイテム定義 | `packages/core/domain/item-type.ts` |
| 地形定数 | `packages/core/domain/constants.ts` |
| チャンク座標 | `packages/core/domain/chunk-coords.ts` |
| バイオーム設定 | `packages/world/application/biome-service.config.ts` |
| 地形生成 | `packages/world/application/terrain-generation.ts` |
| 木生成 | `packages/world/domain/terrain/tree-placer.ts` |
| 湖生成 | `packages/world/domain/terrain/lake-generator.ts` |
| ブロック硬度・採掘・ドロップ | `packages/world/application/block-service.config.ts` |
| Mob定義 | `packages/entity/domain/mob/mobs/*.ts` |
| Mob状態機械 | `packages/entity/domain/mob/state-machine.ts` |
| Mob AI | `packages/entity/application/mob/entity-manager.ts` |
| 爆発ドメイン | `packages/entity/domain/explosion.ts` |
| 移動速度定数 | `packages/entity/application/movement-service.ts` |
| 体力ドメイン | `packages/entity/domain/player-health.ts` |
| 体力サービス設定 | `packages/entity/application/health-service.config.ts` |
| 空腹ドメイン | `packages/entity/domain/player-hunger.ts` |
| 空腹サービス設定 | `packages/entity/application/hunger-service.config.ts` |
| 環境ハザード定数 | `packages/entity/domain/environment-hazard.ts` |
| 食料テーブル | `packages/entity/domain/food.config.ts` |
| 戦闘ドメイン | `packages/entity/domain/combat.ts` |
| 防具定数 | `packages/inventory/domain/armor.ts` |
| 耐久値定数 | `packages/inventory/domain/durability.ts` |
| レシピ | `packages/inventory/application/recipes/` |
| かまど設定 | `packages/inventory/application/furnace-service.config.ts` |
| フレームハンドラ設定 | `packages/app/application/frame-handler.config.ts` |
| 物理ステージ | `packages/app/application/frame/stages/physics-stage.ts` |
| インタラクションステージ | `packages/app/application/frame/stages/interaction-stage.ts` |
| 設置ハンドラ | `packages/app/application/frame/stages/interaction-placement-handler.ts` |
| 近接攻撃ハンドラ | `packages/app/application/frame/stages/interaction-melee-handler.ts` |
| 弓ハンドラ | `packages/app/application/frame/stages/interaction-bow-handler.ts` |
| HUD HTML | `index.html` |
| 音声設定 | `packages/game/application/sound-manager.config.ts` |
| QA API | `packages/app/application/main/qa-api.ts` |

### 検証コマンド

```bash
pnpm test                  # ユニットテスト全件
pnpm typecheck             # TypeScript型チェック
pnpm verify                # 全チェック一括
pnpm test:e2e:headed       # Playwright E2E（ブラウザ表示あり）
```

### QA API（ブラウザDevConsoleで実行）

```javascript
const qa = window.__TS_MINECRAFT_QA__
qa.getInventorySnapshot()
qa.getEntitySnapshot()
qa.getRenderingSnapshot()
qa.getLoadedWaterBlockCount()
qa.setTimeOfDayForQA(0.0)            // 深夜にする
qa.setTimeOfDayForQA(0.5)            // 正午にする
qa.spawnLowHealthZombieInFront()
qa.aimAtStagedZombie()
qa.attackFirstZombie()
qa.dispatchMouseClick(0)             // 左クリック
qa.dispatchMouseClick(2)             // 右クリック
qa.moveItemToHotbar('WOODEN_SWORD', 0)
qa.selectHotbarSlot(0)
qa.craftRecipeForQA('wood-to-planks')
qa.getCurrentTargetForQA()           // 照準先ブロック情報
qa.getMobMovementSnapshot(3000)      // 3秒間のMob移動記録
```

---

## §A アルゴリズム数値検証（定数照合）

> 本セクションは実装コードから読み取った定数の一覧。調査モデルは各定数を実際のファイルで確認し、
> 公式仕様との差を記録すること。数値が一致していても、定数が**実際に使われているか**まで確認すること。

### A-1. 地形・チャンク定数

| 定数名 | 実装値 | 公式仕様値 | 参照ファイル |
|---|---|---|---|
| SEA_LEVEL | 63 | 63 | `packages/core/domain/constants.ts:17` |
| LAKE_LEVEL | SEA_LEVEL = 63 | — | `packages/core/domain/constants.ts:20` |
| CHUNK_HEIGHT | 256 (Y: 0〜255) | 384 (Y: -64〜319) | `packages/core/domain/chunk-coords.ts:10` |
| CHUNK_SIZE | 16 (XZ) | 16 | `packages/core/domain/chunk-coords.ts` |
| BEDROCK_LAYER_TOP | 4 (Y=0 必ず、Y=1-4 確率的) | 4 | `packages/world/domain/terrain/constants.ts:16` |
| BEDROCK_PROBABILITY | [1.0, 0.75, 0.5, 0.25, 0.0] (Y=0→4) | 類似 | `packages/world/domain/terrain/constants.ts:20` |
| DEEPSLATE_CEILING | 16 (Y≤16 は DEEPSLATE) | ~16 | `packages/world/domain/terrain/constants.ts:17` |
| CAVE_FLOOR | 5 (Y=5 から洞窟生成) | — | `packages/world/domain/terrain/constants.ts:45` |
| CAVE_CEILING | 80 (Y=80 まで洞窟生成) | — | `packages/world/domain/terrain/constants.ts:44` |
| CAVE_BASE_THRESHOLD | 0.18（ノイズ閾値）| — | `packages/world/domain/terrain/constants.ts:38` |
| CAVE_LAVA_MAX_Y | 10 (Y≤10 は洞窟がlavaで埋まる) | ~11 | `packages/world/domain/terrain/constants.ts:79` |

検証項目:
- SEA_LEVEL が 63 であることを `constants.ts:17` で確認する
- LAKE_LEVEL が SEA_LEVEL と同値（63）であることを `constants.ts:20` で確認する
- CHUNK_HEIGHT が 256 であることを `chunk-coords.ts:10` で確認する（公式は 384。負Y未対応）
- チャンクインデックス式が `y + z × CHUNK_HEIGHT + x × CHUNK_HEIGHT × CHUNK_SIZE` であることを確認する
- 公式がY=-64〜319なのに対し本実装はY=0〜255のみサポートする（地下256m以下は未対応）
- `BEDROCK_PROBABILITY=[1.0,0.75,0.5,0.25,0.0]` で Y=0 は必ず BEDROCK, Y=1-4 は確率的に BEDROCK になることを `constants.ts:20` で確認する
- Y ≤ `DEEPSLATE_CEILING=16` の範囲が DEEPSLATE で生成されることを `generator.ts` で確認する
- **洞窟生成は実装済み**（`cave-carver.ts` — 3D ノイズ三線形補間）— §12 #14 の「未実装の可能性」は誤り
- 洞窟が Y=5〜80 の範囲に生成されることを確認する（`CAVE_FLOOR=5`, `CAVE_CEILING=80`）
- Y ≤ `CAVE_LAVA_MAX_Y=10` の洞窟内が空気でなく溶岩で満たされることを確認する
- **Note**: MEMORY.md の SEA_LEVEL=48/LAKE_LEVEL=62 は古い。`constants.ts` が正）

### A-2. 物理・移動定数

| 定数名 | 実装値 | 公式仕様値 | 参照ファイル |
|---|---|---|---|
| GRAVITY_Y | -9.82 m/s² | ~-9.8 m/s² | `packages/game/application/game-state-service.ts:29` |
| DEFAULT_WALK_SPEED | 4.317 m/s | 4.317 m/s | `packages/entity/application/movement-service.ts:24` |
| DEFAULT_SPRINT_SPEED | 5.612 m/s | 5.612 m/s | `packages/entity/application/movement-service.ts:25` |
| DEFAULT_SNEAK_SPEED | 1.295 m/s | 1.295 m/s | `packages/entity/application/movement-service.ts:26` |
| DEFAULT_JUMP_VELOCITY | 5.0 m/s | — | `packages/entity/application/movement-service.ts:29` |
| EYE_LEVEL_OFFSET | 0.72 (AABB中心から) | 足から 1.62 = 中心+0.72 | `packages/app/application/frame-handler.config.ts:9` |
| PLAYER_ATTACK_REACH | 3.5 ブロック | 4.5 ブロック | `packages/app/application/frame-handler.config.ts:55` |
| PLAYER_ATTACK_RADIUS | 0.9 | — | `packages/app/application/frame-handler.config.ts:56` |
| ENTITY_CENTER_Y_OFFSET | 0.9 (AABB半高さ) | — | `packages/app/application/frame-handler.config.ts:58` |
| deltaTime クランプ下限 | 0.001 s | — | `packages/game/application/game-loop/index.ts` |
| deltaTime クランプ上限 | 0.05 s | — | `packages/game/application/game-loop/index.ts` |
| SWIM_UP_SPEED | 3.0 m/s（JUMP押下時の浮上速度）| — | `packages/game/application/game-state-service.ts:44` |
| WATER_SINK_SPEED | -1.2 m/s（受動的な沈降速度）| — | `packages/game/application/game-state-service.ts:50` |
| 水中水平抵抗係数 | 0.4×（通常速度の 40%）| — | `packages/game/application/game-state-service.ts:79,85` |

水中実効速度: walk=4.317×0.4=**1.727 m/s**, sprint=5.612×0.4=**2.245 m/s**

検証項目:
- walk=4.317/sprint=5.612/sneak=1.295 m/s の各定数が `movement-service.ts:24-26` にあることを確認する
- sprint/walk 比が約 1.30（= 5.612÷4.317 ≈ 1.30）であることを計算して確認する（公式と一致）
- jump 初速が 5.0 m/s であることを確認する（重力 -9.82 で約 1.27 ブロックの頂点）
- EYE_LEVEL_OFFSET=0.72 であることを `frame-handler.config.ts:9` で確認する（コメントも読むこと）
- PLAYER_ATTACK_REACH=3.5 と公式 4.5 の差（-1.0）を記録する
- deltaTime クランプが `game-loop/index.ts` に実装されていることを確認する
- 斜め移動ベクトルが正規化されていることを `movement-service.ts` で確認する（W+D で sqrt(2) 倍にならない）
- 水中で JUMP キーを押すと `SWIM_UP_SPEED=3 m/s` で浮上することを確認する（`game-state-service.ts:44`）
- 水中で何も押さないと `WATER_SINK_SPEED=-1.2 m/s` でゆっくり沈降することを確認する
- 水中の水平移動が陸上の 40% 速度（歩行時 1.73 m/s）になることを `applyWaterDrag` で確認する
- 水中移動速度に DEPTH_STRIDER 補正がないことを確認する（§12 #61 参照）

### A-3. 体力・ダメージ定数

| 定数名 | 実装値 | 公式仕様値 | 参照ファイル |
|---|---|---|---|
| PLAYER_MAX_HEALTH | 20 | 20 | `packages/entity/application/health-service.config.ts` |
| PLAYER_START_HEALTH | 20 | 20 | `packages/entity/application/health-service.config.ts` |
| INVINCIBILITY_TICKS_ON_HIT | 10 ticks = 0.5 s | 10 ticks (0.5 s) | `packages/entity/application/health-service.config.ts:4` |
| HEALTH_TICK_INTERVAL_SECS | 0.05 s (20 ticks/s) | 20 ticks/s | `packages/app/application/frame-handler.config.ts:35` |
| FALL_DAMAGE_FREE_BLOCKS | 3 | 3 | `packages/entity/application/health-service.config.ts:6` |

落下ダメージ計算式（`packages/entity/domain/player-health.ts:76`）:
```
fallDamage = max(0, ceil(fallDistance - FALL_DAMAGE_FREE_BLOCKS))
```

検証項目:
- 最大HP=20、初期HP=20 を `health-service.config.ts` で確認する
- INVINCIBILITY_TICKS_ON_HIT=10 ticks（0.05s × 10 = 0.5秒の無敵）を確認する
- 被弾中 invincibilityTicks > 0 のとき追加ダメージが無効になる実装を `player-health.ts:34` で確認する
- 落下ダメージ式 `max(0, ceil(fallDistance - 3))` を `player-health.ts:76` で確認する
- 3 ブロック以下の落下でダメージが 0 であることを式から確認する
- 4 ブロック落下で ceil(4-3)=1 ダメージになることを確認する
- 10 ブロック落下で ceil(10-3)=7 ダメージになることを確認する
- FEATHER_FALLING 附魔で 12%/レベル 軽減される処理を `physics-stage.ts:90-95` で確認する

### A-4. 環境ハザード定数

| 定数名 | 実装値 | 公式仕様値 | 参照ファイル |
|---|---|---|---|
| MAX_AIR_SECS | 15 s | 15 s (300 ticks) | `packages/entity/domain/environment-hazard.ts:9` |
| DROWN_DAMAGE | 2 | 2 | `packages/entity/domain/environment-hazard.ts:10` |
| DROWN_DAMAGE_INTERVAL_SECS | 1 s | 1 s (20 ticks) | `packages/entity/domain/environment-hazard.ts:11` |
| LAVA_DAMAGE | 4 | 4 | `packages/entity/domain/environment-hazard.ts:5` |
| LAVA_DAMAGE_INTERVAL_SECS | 0.5 s | 0.5 s (10 ticks) | `packages/entity/domain/environment-hazard.ts:6` |

検証項目:
- MAX_AIR_SECS=15 を `environment-hazard.ts:9` で確認する
- 気泡が 0 になると 1 秒ごとに 2 ダメージ受ける実装を `physics-stage.ts` で確認する
- 溶岩接触で 0.5 秒ごとに 4 ダメージ（実質 8/秒）を受ける実装を確認する
- `accrueHazardTicks()` / `nextAirSecs()` の実装がフレームレート非依存であることを確認する
- FLUID_TICK_INTERVAL_SECS=0.05s かつ HUNGER_TICK_INTERVAL_SECS=0.05s の tick が時刻ベースであることを確認する

### A-5. 空腹定数

| 定数名 | 実装値 | 公式仕様値 | 参照ファイル |
|---|---|---|---|
| MAX_FOOD_LEVEL | 20 | 20 | `packages/entity/application/hunger-service.config.ts:3` |
| MAX_SATURATION | 20 | 20 | `packages/entity/application/hunger-service.config.ts:4` |
| START_FOOD_LEVEL | 20 | 20 | `packages/entity/application/hunger-service.config.ts:7` |
| START_SATURATION | 5 | 5 | `packages/entity/application/hunger-service.config.ts:8` |
| MAX_EXHAUSTION | 4 | 4.0 | `packages/entity/application/hunger-service.config.ts:11` |
| FOOD_TICK_INTERVAL | 80 ticks | 80 ticks | `packages/entity/application/hunger-service.config.ts:15` |
| REGEN_FOOD_THRESHOLD | 18 | 18 | `packages/entity/application/hunger-service.config.ts:17` |
| HUNGER_TICK_INTERVAL_SECS | 0.05 s (20 ticks/s) | — | `packages/app/application/frame-handler.config.ts:39` |
| EXHAUSTION_WALK_PER_BLOCK | 0.01 | 0.01 | `packages/entity/application/hunger-service.config.ts:21` |
| EXHAUSTION_SPRINT_PER_BLOCK | 0.1 | 0.1 | `packages/entity/application/hunger-service.config.ts:22` |
| EXHAUSTION_JUMP | 0.05 | 0.05 | `packages/entity/application/hunger-service.config.ts:23` |
| EXHAUSTION_SPRINT_JUMP | 0.2 | 0.2 | `packages/entity/application/hunger-service.config.ts:24` |
| EXHAUSTION_ATTACK | 0.1 | 0.1 | `packages/entity/application/hunger-service.config.ts:25` |
| EXHAUSTION_DAMAGE | 0.1 | 0.1 | `packages/entity/application/hunger-service.config.ts:26` |
| EXHAUSTION_PER_REGEN | 6 | 6 | `packages/entity/application/hunger-service.config.ts:29` |

消費・回復計算式（`packages/entity/domain/player-hunger.ts`）:
```typescript
// exhaustion が MAX_EXHAUSTION(4) を超えるたびに saturation を 1 消費
// saturation が 0 のとき foodLevel を 1 消費（再帰的）
cascadeRaw(foodLevel, saturation, exhaustion, maxExhaustion)

// 食事時の saturation 加算式（player-hunger.ts:77）
saturation = min(foodLevel_new, prevSaturation + food * saturationModifier * 2)
```

検証項目:
- FOOD_TICK_INTERVAL=80 ticks × HUNGER_TICK_INTERVAL_SECS=0.05s = 4秒に1回の空腹 tick であることを確認する
- foodLevel≥18 かつ canRegen=true のとき `regen` を返し 1HP 回復することを `advanceFoodTimer` で確認する
- foodLevel=0 のとき `starve` を返すことを `advanceFoodTimer` で確認する
- starve のダメージが HP を 1 以下にする/しないルールを `physics-stage.ts` で確認する
- exhaustion cascade が末尾再帰（`cascadeRaw`）で実装されていることを `player-hunger.ts:35-48` で確認する
- exhaustion=Infinity のとき Number.isFinite ガードで無限ループを防いでいることを `player-hunger.ts:65` で確認する
- 食事の saturation 加算式 `min(foodLevel, sat + food × satMod × 2)` を `player-hunger.ts:77` で確認する
- saturation が foodLevel を超えないことを確認する（不変条件: `PlayerHungerInvariant`）
- 自然回復時に EXHAUSTION_PER_REGEN=6 の exhaustion が追加されることを `player-hunger.ts:107` で確認する
- スプリント移動で距離×0.1 の exhaustion が加算されることを `physics-stage.ts:186` で確認する
- ジャンプで 0.05（歩行）または 0.2（スプリントジャンプ）の exhaustion が加算されることを `physics-stage.ts:193` で確認する

### A-6. 戦闘定数

| 定数名 | 実装値 | 公式仕様値 | 参照ファイル |
|---|---|---|---|
| DEFAULT_ATTACK_COOLDOWN_SECS | 0.625 s | ~0.625 s (剣) | `packages/entity/domain/combat.ts:55` |
| CRITICAL_DAMAGE_MULTIPLIER | 1.5 | 1.5 | `packages/entity/domain/combat.ts:20` |
| KNOCKBACK_HORIZONTAL_SPEED | 5 m/s | — | `packages/entity/domain/combat.ts:122` |
| KNOCKBACK_VERTICAL_SPEED | 4.2 m/s | — | `packages/entity/domain/combat.ts:123` |
| KNOCKBACK_DURATION_SECS | 0.3 s | — | `packages/entity/domain/combat.ts:127` |

攻撃チャージ・ダメージ計算式（`packages/entity/domain/combat.ts`）:
```typescript
charge = max(0, min(1, secsSinceLastAttack / cooldownSecs))  // combat.ts:58-62
damage = base × (0.2 + 0.8 × charge²)
critMultiplier = isCritical ? 1.5 : 1.0
finalDamage = damage × critMultiplier
```

検証項目:
- チャージ計算式 `max(0, min(1, elapsed / cooldown))` を `combat.ts:58-62` で確認する
- ダメージ計算式 `base × (0.2 + 0.8 × charge²)` を `combat.ts` で確認する
- 最低チャージ(0)のダメージが base × 0.2（= 20%）になることを確認する
- 満チャージ(1)のダメージが base × 1.0（= 100%）になることを確認する
- クリティカルが「空中にいる間の攻撃」（疑似乱数ではない）で発動することを確認する
- クリティカル倍率が 1.5 であることを `combat.ts:20` で確認する
- ノックバック水平速度=5、垂直速度=4.2 を `combat.ts:122-123` で確認する
- ノックバック持続=0.3 秒間 AI の水平速度上書きが抑制されることを確認する
- 攻撃方向ベクトルが 0（同位置）のとき真上ノックバック（x=0, y=4.2, z=0）を確認する

### A-7. Mob 定数

| Mob | HP | attackDmg | speed | detectionRange | attackRange | xpReward | 参照ファイル |
|---|---|---|---|---|---|---|---|
| Zombie | 20 | 3 | 1.25 | 16 | 1.6 | 5 | `mobs/zombie.ts` |
| Skeleton | 20 | 2 | 1.0 | 20 | 12 | 5 | `mobs/skeleton.ts` |
| Creeper | 20 | — | — | 16 | 1.5 | 5 | `mobs/creeper.ts` |
| Spider | 16 | 2 | 1.45 | 16 | 1.4 | 5 | `mobs/spider.ts` |
| Enderman | 40 | 7 | — | 24 | 2.0 | 5 | `mobs/enderman.ts` |
| Cow | 10 | 0 | — | 12 | 0 | 2 | `mobs/cow.ts` |
| Pig | 10 | 0 | — | 10 | 0 | 2 | `mobs/pig.ts` |
| Sheep | 8 | 0 | — | — | 0 | 2 | `mobs/sheep.ts` |

公式仕様との差分:
| Mob | 公式HP | 公式attackDmg | 差分 |
|---|---|---|---|
| Zombie | 20 | 3 (Normal) | 一致 |
| Skeleton | 20 | 4（矢: 3〜5） | 実装は 2 |
| Creeper | 20 | 爆発 49 (Normal) | 爆発ダメージ/自爆/導火線フラッシュ/周辺ブロック破壊は実装済み |
| Spider | 16 | 2 | 一致 |
| Enderman | 40 | 7 (Normal) | 一致 |

検証項目:
- 各 Mob の HP/attackDamage/speed/detectionRange/attackRange/xpReward を上表と照合する
- Zombie の fleeHealthThreshold=0.1（HP10%以下で逃げる）を `zombie.ts` で確認する（公式は逃げない → 差分記録）
- Spider の speed=1.45（Zombie の 1.25 より速い）を `spider.ts` で確認する
- Enderman の detectionRange=24（他は 16）を `enderman.ts` で確認する
- Skeleton は接触ダメージではなく `getPlayerRangedDamage` の射撃判定で attackRange=12 を使い、frame path では cached solid-block blocker で壁越し射撃を遮ることを確認する
- Skeleton の物理矢エンティティ・弾道・飛翔表示は未実装差分として記録する

### A-8. Mob ドロップ（実装値 vs 公式）

| Mob | 実装ドロップ | 公式ドロップ |
|---|---|---|
| Zombie | ROTTEN_FLESH×1(常時), CARROT×1(2.5%) | ROTTEN_FLESH 0-2, CARROT 2.5%, POTATO 2.5%, IRON_INGOT 2.5% |
| Skeleton | BONE×1(常時), ARROW×2(常時) | BONE 0-2, ARROW 0-2 |
| Creeper | GUNPOWDER×?(確認する) | GUNPOWDER 0-2 |
| Spider | STRING×1(常時), SPIDER_EYE×1(常時) | STRING 0-2, SPIDER_EYE 33%(0-1) |
| Enderman | ENDER_PEARL×?(確認する) | ENDER_PEARL 0-1 |
| Cow | RAW_BEEF×?(確認する), LEATHER×?(確認する) | RAW_BEEF 1-3, LEATHER 0-2 |
| Pig | RAW_PORKCHOP×1(常時) | RAW_PORKCHOP 1-3 |
| Sheep | WOOL×1(常時), RAW_MUTTON×1(常時) | WOOL 1, RAW_MUTTON 1-2 |

検証項目:
- Zombie が常に ROTTEN_FLESH をドロップし、CARROT を 2.5% でドロップすることを `zombie.ts:drops` で確認する
- Skeleton が BONE×1 と ARROW×2 を確率なしで常にドロップすることを `skeleton.ts:drops` で確認する（公式 0-2 との差）
- Spider が STRING×1 と SPIDER_EYE×1 を確率なしで常にドロップすることを確認する（公式 SPIDER_EYE は 33% との差）
- RAW_PORKCHOP は `packages/core/domain/item-type.ts` に定義済みで、Pig が常時 ×1 ドロップする
- RAW_MUTTON は `packages/core/domain/item-type.ts` に定義済みで、Sheep が常時 ×1 ドロップする

### A-9. バイオーム分類定数

| バイオーム | treeDensity | temperature | humidity | 表層ブロック |
|---|---|---|---|---|
| PLAINS | 0.01 | 0.50 | 0.30 | GRASS |
| DESERT | 0.00 | 0.90 | 0.10 | SAND |
| FOREST | 0.30 | 0.50 | 0.60 | GRASS |
| OCEAN | 0.00 | 0.50 | 0.90 | SAND |
| MOUNTAINS | 0.02 | 0.30 | 0.40 | STONE |
| SNOW | 0.05 | 0.10 | 0.50 | SNOW |
| SWAMP | 0.20 | 0.60 | 0.80 | GRASS |
| JUNGLE | 0.50 | 0.90 | 0.80 | GRASS |
| BEACH | 0.00 | 0.70 | 0.55 | SAND |
| RIVER | 0.00 | 0.50 | 0.65 | SAND |
| TAIGA | 0.24 | 0.25 | 0.55 | GRASS |
| SAVANNA | 0.08 | 0.78 | 0.28 | GRASS |

参照ファイル: `packages/world/application/biome-service.config.ts:26-37`

検証項目:
- 各バイオームの treeDensity/temperature/humidity 値を `biome-service.config.ts:26-37` と照合する
- バイオーム分類関数の温度/湿度カットオフ境界値を `packages/world/domain/biome-classifier.ts` で確認する
- treeDensity=0.00 のバイオーム（DESERT/OCEAN/BEACH/RIVER）で樹木が生成されないことを確認する
- surfaceY < SEA_LEVEL(63) の列では木が生成されないことを `tree-placer.ts:177` で確認する

### A-10. 食料栄養値（実装値 vs 公式）

| 食料 | foodLevel(実装) | satMod(実装) | 公式 foodLevel | 公式 saturation |
|---|---|---|---|---|
| APPLE | 4 | 0.3 | 4 | 2.4 |
| BREAD | 5 | 0.6 | 5 | 6.0 |
| CARROT | 3 | 0.6 | 3 | 3.6 |
| COOKED_BEEF | 8 | 0.8 | 8 | 12.8 |
| COOKED_PORKCHOP | 8 | 0.8 | 8 | 12.8 |
| RAW_BEEF | 3 | 0.3 | 3 | 1.8 |
| ROTTEN_FLESH | 4 | 0.1 | 4 | 0.8 |
| GOLDEN_APPLE | 4 | 9.6 | 4 | 76.8 |

saturation 加算式（`player-hunger.ts:77`）: `min(foodLevel_new, prevSaturation + food × satMod × 2)`

検証項目:
- 各食料の foodLevel/saturationModifier を `food.config.ts` で上記表と照合する
- saturation 加算式が `min(foodLevel, sat + food × satMod × 2)` であることを `player-hunger.ts:77` で確認する
- ROTTEN_FLESH 消費で Nausea 効果がかかる処理（30% 確率）が実装されているか確認する
- GOLDEN_APPLE 消費で Absorption/Regeneration 効果がかかる処理が実装されているか確認する

---

## §1. 世界・地形

### 1-1. チャンク生成

- 地形ノイズが3次元で合成されている
- 地形ノイズのオクターブ数・周波数・振幅を `terrain-generation.ts` で確認する
- SEA_LEVEL=63 の水面が正しく機能していることを確認する（§A-1 参照）
- BEDROCK 層が Y=0 付近に配置されている
- 同一シードで同一地形が生成される（決定論的）
- 未生成チャンクに隣接するブロック参照でエラーが発生しない
- チャンク境界（x/z ±16）でブロック・高さが連続している（段差なし）
- 洞窟（地下空洞）が生成されているか `terrain-generation.ts` で確認する
- チャンクロード中にゲームがフリーズしない
- チャンク LRU キャッシュが機能し、遠くのチャンクがアンロードされる

### 1-2. バイオーム分類（§A-9 参照）

- PLAINS/DESERT/FOREST/OCEAN/MOUNTAINS/SNOW/SWAMP/JUNGLE/BEACH/RIVER/TAIGA/SAVANNA の各バイオームが生成される
- バイオーム分類関数の温度/湿度カットオフ境界値を `biome-classifier.ts` で確認する
- 各バイオームの表層ブロックが §A-9 の表と一致するか確認する

### 1-3. 昼夜サイクル

- 昼夜が時間経過とともに自動で進行する
- 正午（0.5）で太陽が真上に来る
- 深夜（0.0）で月が出て暗くなる
- 夕暮れ・夜明けの空の色がグラデーション遷移する（smoothstep 使用を確認する）
- 夕暮れ時に空が真っ黒にならないことを確認する
- 遠クリッピング面（far plane）が 352 以上であることを確認する（352 未満で天球がクリップされる）
- `setTimeOfDayForQA(0.0)` / `setTimeOfDayForQA(0.5)` が正しく機能することを確認する

### 1-4. 樹木生成

- バイオームの treeDensity に応じた本数が生成される（§A-9 参照）
- DESERT で treeDensity=0.00 → 樹木なし
- surfaceY < SEA_LEVEL(63) の列で樹木が生成されない（`tree-placer.ts:177`）
- TREE_MIN_SURFACE_Y 以下で樹木が生成されない（`tree-placer.ts:168`）
- 樹木が WOOD 幹 + LEAVES 樹冠で構成されている
- 樹冠が浮いていない（幹と連続している）
- 樹木がチャンク境界をまたいで正しく生成される

### 1-5. 鉱石分布

| 鉱石 | 最低採掘ティア | ドロップ |
|---|---|---|
| COAL_ORE / DEEPSLATE_COAL_ORE | 木ピッケル | COAL |
| IRON_ORE / DEEPSLATE_IRON_ORE | 石ピッケル | RAW_IRON |
| GOLD_ORE / DEEPSLATE_GOLD_ORE | 鉄ピッケル | RAW_GOLD |
| DIAMOND_ORE / DEEPSLATE_DIAMOND_ORE | 鉄ピッケル | DIAMOND |
| REDSTONE_ORE / DEEPSLATE_REDSTONE_ORE | 鉄ピッケル | REDSTONE_DUST |
| LAPIS_ORE / DEEPSLATE_LAPIS_ORE | 石ピッケル | LAPIS_LAZULI |
| EMERALD_ORE / DEEPSLATE_EMERALD_ORE | 鉄ピッケル | EMERALD |

- 各鉱石が正しい高度に生成されることを確認する
- 不適合ティアのツールでは採掘時にドロップしないことを `block-service.config.ts` で確認する
- GRANITE / DIORITE / ANDESITE が `block-type.ts` に定義されているか確認する
- DEEPSLATE（鉱石なし基盤）が `block-type.ts` に定義されているか確認する

### 1-6. 流体

- WATER が隣接セルへ伝播する
- 閉空間で無限増殖しない
- LAVA が配置・描画される
- 流体 tick が FLUID_TICK_INTERVAL_SECS=0.05 s（20 ticks/s）で発火することを `frame-handler.config.ts:30` で確認する

---

## §2. プレイヤー生存メカニクス

### 2-1. 体力（§A-3 参照）

- 最大HP=20、初期HP=20
- HP が 0 になると死亡画面が表示される
- 被弾後 0.5 秒間（10 game ticks）再ダメージを受けない
- 無敵時間経過後に再び被弾できる
- 死亡後にリスポーンできる
- リスポーン後の HP が満タン（20）になる
- リスポーン位置がワールドスポーンまたはベッド設定位置になる

### 2-2. 空腹（§A-5 参照）

- foodLevel が 0〜20 の範囲で管理される
- saturation が 0〜20 の範囲で管理される（saturation ≤ foodLevel の不変条件）
- exhaustion が 0〜40 の範囲で蓄積される
- exhaustion が 4 を超えるたびに saturation が 1 消費される
- saturation が 0 で foodLevel が 1 消費される
- foodLevel≥18 かつ saturation>0 のとき 4 秒ごとに 1HP 回復する
- foodLevel=0 のとき 4 秒ごとに 1HP ダメージを受ける
- 空腹 HUD が foodLevel の変化に追従する

### 2-3. 落下ダメージ（§A-3 参照）

- 3 ブロック以下の落下でダメージなし（`max(0, ceil(dist-3))` 式を確認する）
- 4 ブロック落下で 1 ダメージ、5 ブロックで 2 ダメージ
- 水面着地でダメージなし
- FEATHER_FALLING エンチャント: `12% × level` 軽減（`getFeatherFallingReduction(level)=0.12×level`、`enchantment.ts:57`）、`physics-stage.ts:90` で適用
- FEATHER_FALLING Lv4 で 48% 軽減されることを確認する

### 2-4. 溺死（§A-4 参照）

- 頭（目線位置）が WATER ブロック内のとき気泡が `MAX_AIR_SECS=15` 秒で尽きる
- 気泡 0 になると `DROWN_DAMAGE_INTERVAL_SECS=1 s` ごとに `DROWN_DAMAGE=2` ダメージを受ける
- 水面に出ると気泡が回復する
- 気泡 HUD が `🫧` emoji × 10 で表示される（公式のハートスプライトではなくテキスト）
- 気泡が 0 のとき `💀 Drowning` テキストが表示されることを `physics-stage.ts:315` で確認する
- RESPIRATION エンチャント: `15s × level` 追加気泡時間（`getRespirationBonusSecs(level)=15×level`、`enchantment.ts:62`）
- RESPIRATION Lv3 で合計 45 秒追加（最大 60 秒）になることを確認する

### 2-5. 溶岩・炎（§A-4 参照）

- LAVA ブロック接触で `LAVA_DAMAGE_INTERVAL_SECS=0.5 s` ごとに `LAVA_DAMAGE=4` ダメージ（= 実質 8/秒）を受ける
- 溶岩から出ても炎上継続ダメージが数秒続くか確認する
- FIRE_PROTECTION エンチャント: `8% × level` 溶岩ダメージ軽減（`getFireProtectionReduction(level)=0.08×level`、`enchantment.ts:53`）

### 2-6. 移動・物理（§A-2 参照）

- WASD で前/後/左/右に移動する
- **ControlLeft / ControlRight でスプリント開始**することを `key-mappings.ts:12-13` で確認する（double-tap W ではない）
- walk=4.317/sprint=5.612/sneak=1.295 m/s の速度（§A-2 参照）
- ShiftLeft でスニーク開始することを `key-mappings.ts:14` で確認する
- スニーク中はブロックの縁から落ちない（`aabb-collision.ts:180` — sneak edge-protection 実装済み）
- W+D 斜め移動で速度が正規化されている
- Space でジャンプする（初速 5.0 m/s, §A-2 参照）
- 空中での再ジャンプ不可
- 重力加速度が -9.82 m/s²（§A-2 参照）
- deltaTime が min=0.001/max=0.05 でクランプされる（§A-2 参照）
- 高速落下でもブロックをすり抜けない
- **foodLevel ≤ 6 でスプリントが無効になるか確認する**（公式バニラの仕様。本実装での実装有無を確認する。実装なしなら §12 に記録）

### 2-7. カメラ

- pitch が ±90° でクランプされる
- yaw が 360° で連続
- EYE_LEVEL_OFFSET=0.72（足から 1.62）であることを `frame-handler.config.ts:9` で確認する
- **F5 キー（CAMERA_TOGGLE）でサードパーソンビュー切替**ができることを `key-mappings.ts:15` で確認する
- サードパーソン時にプレイヤーモデルが前面に表示されるか確認する（または背面のみか）

### 2-8. XP システム（§A-7 参照）

参照ファイル: `packages/entity/domain/player-xp-calc.ts`, `packages/entity/domain/player-xp.ts`

**XP レベリング式（バニラ Java Edition 完全準拠）**

| レベル範囲 | 次レベルまでの必要 XP |
|---|---|
| 0-15 | `2 × level + 7` |
| 16-30 | `5 × level - 38` |
| 31+ | `9 × level - 158` |

例: Lv0→Lv1 = 7 XP、Lv30→Lv31 = 112 XP、Lv31→Lv32 = 121 XP

**XP 獲得ソース一覧（実装値）**

| ソース | 実装値 | 参照 |
|---|---|---|
| 各 Mob 撃破（近接）| Mob 別 `xpReward` | `interaction-melee-handler.ts:130` |
| 各 Mob 撃破（弓）| Mob 別 `xpReward` | `interaction-bow-handler.ts:55` |
| 鉱石採掘 | 種別ごと（§A-1 or 下表）| `interaction-break-handler.ts:66` |
| 繁殖成功 | `BREED_XP_REWARD=4`（公式 1-7 固定差分）| `entity-update-stage.ts:56` |
| 釣り成功 | 実装有（`xpService.getXP()` ゲート）| `interaction-item-use-handler.ts:21` |
| 精錬取り出し | 出力アイテム別 XP（§4-4 参照）| `furnace-service.config.ts` |

**鉱石採掘 XP ドロップ表（`blocks.config.ores.ts`）**

| ブロック | XP |
|---|---|
| COAL_ORE / DEEPSLATE_COAL_ORE | 5 |
| IRON_ORE / GOLD_ORE（通常鉱石）| 0（XP なし）|
| DIAMOND_ORE / DEEPSLATE_DIAMOND_ORE | 7 |
| EMERALD_ORE / DEEPSLATE_EMERALD_ORE | 7 |
| LAPIS_ORE / DEEPSLATE_LAPIS_ORE | 5 |
| REDSTONE_ORE / DEEPSLATE_REDSTONE_ORE | 5 |
| NETHER_QUARTZ_ORE | 5 |

検証項目:
- 各 Mob 撃破で `xpReward` に対応した XP が加算されるか確認する（§A-7 参照）
- 弓でのキルもメレーと同じ Mob XP が付与されるか確認する
- 鉱石を採掘すると上表の XP が付与されるか確認する（IRON_ORE は 0 のため XP なし）
- SILK_TOUCH で採掘した場合は XP が付与されないか確認する（`hasSilkTouch` 分岐）
- 繁殖成功時に `BREED_XP_REWARD=4` XP が付与されるか確認する（公式は 1-7 ランダム）
- 釣りで XP が付与されるか確認する
- かまどで精錬アイテムを取り出すと XP が付与されるか確認する（§4-4 参照）
- XP レベリング式が `player-xp-calc.ts` と一致するか確認する（Lv0→7XP、Lv15→37XP 等）
- XP バー HUD（`xpBarElement`, `xpLevelElement`, `xpBarMaxElement`）が画面に表示されるか確認する
- XP バーが XP 獲得とともに更新されるか確認する
- 死亡時に XP が 0 にリセットされるか確認する（`xpService.reset()` at `physics-stage.ts:146`）
- セーブ/ロード後も XP が保持されるか確認する

---

## §3. ブロック

### 3-1. 地形系ブロック

以下を各ブロックについて `block-service.config.ts` で確認する:
- 採掘ティア（素手/木/石/鉄/ダイヤ）
- ドロップアイテム
- 不適合ティアではドロップなし

**AIR**
- 描画されない
- 衝突判定がない
- 隣接面がカリングされない

**GRASS**
- 表層に配置される（biome surfaceBlock='GRASS'）
- 素手で破壊できる
- 破壊すると DIRT がドロップする（GRASS はドロップしない）

**DIRT**
- GRASS の下層に配置される
- 素手で破壊できる、DIRT がドロップする
- クワ（HOE）で右クリックすると FARMLAND に変換される

**STONE**
- 地中を充填する
- 木ピッケル以上で採掘できる
- 不適合ツール（素手）では採掘時にドロップしない
- 破壊すると COBBLESTONE がドロップする

**COBBLESTONE**
- 木ピッケル以上で採掘できる、COBBLESTONE がドロップする

**GRANITE / DIORITE / ANDESITE**
- `block-type.ts` に定義されているか確認する
- 地中に生成されているか確認する
- 採掘ティア/ドロップを `block-service.config.ts` で確認する

**DEEPSLATE**
- `block-type.ts` に定義されているか確認する
- Y 下層に生成されているか確認する

**SAND**
- DESERT/BEACH の表層に配置される
- 素手で破壊できる、SAND がドロップする
- 重力落下する処理が実装されているか確認する

**GRAVEL**
- 素手で破壊できる
- GRAVEL または FLINT がドロップする（条件を `block-service.config.ts` で確認する）
- 重力落下するか確認する

**WOOD（原木）**
- 樹木の幹として配置される
- 素手で破壊できる、WOOD がドロップする
- かまどで CHARCOAL に精錬できる

**LEAVES**
- 半透明レンダリング（transparentSolidMesh で描画されているか確認する）
- 素手で破壊できる
- APPLE がドロップする確率と実装を `block-service.config.ts` で確認する

**GLASS**
- 透明レンダリング
- 素手で破壊できる
- ドロップなし（公式と一致）
- SAND をかまどで精錬して作れる

**SNOW**
- SNOW バイオームの表層に配置される
- SNOWBALL は `item-type.ts` に定義済みで、SNOW は SNOWBALL×4 をドロップする

**BEDROCK**
- 最下層（Y=0付近）に配置される
- サバイバルモードで破壊できない

**WATER**
- SEA_LEVEL=63 以下に配置される
- 半透明描画される
- プレイヤーが通過できる（AABB で WATER を除外しているか確認する）
- WATER_BUCKET で回収できるか確認する

**LAVA**
- 地下深部に生成される
- 発光描画される
- 接触でダメージを受ける（§A-4 参照）
- LAVA_BUCKET で回収できるか確認する

**OBSIDIAN**
- ダイヤピッケルのみで採掘できることを `block-service.config.ts` で確認する
- 破壊すると OBSIDIAN がドロップする

### 3-2. 鉱石系ブロック（§1-5 の表参照）

- 各鉱石の採掘ティア/ドロップを `block-service.config.ts` で確認する
- DEEPSLATE_* 7種がすべて `block-type.ts` に定義されているか確認する

### 3-3. 鉱石ブロック（mineral block）

COAL_BLOCK / IRON_BLOCK / GOLD_BLOCK / DIAMOND_BLOCK / REDSTONE_BLOCK / LAPIS_BLOCK / EMERALD_BLOCK:
- これら7種が `block-type.ts` に定義されているか確認する
- 各素材×9 個でクラフトできるレシピが `recipes/` に存在するか確認する
- 逆クラフト（ブロック→素材×9）レシピも存在するか確認する

### 3-4. 加工・機能ブロック

**CRAFTING_TABLE**
- PLANKS×4 でクラフトできる
- 設置できる、右クリックで crafting_table UI が開く
- 破壊すると CRAFTING_TABLE がドロップする

**FURNACE**
- COBBLESTONE×8 でクラフトできる
- 設置できる、右クリックで furnace UI が開く
- 精錬中に発光する

**TORCH**
- COAL または CHARCOAL + STICKS でクラフトできる
- 設置できる、光源として機能する（lightLevel を確認する）

**BED**
- WOOL×3 + PLANKS×3 でクラフトできる
- 設置できる
- 夜に右クリックで就寝→夜が明ける
- 昼間に右クリックしても就寝できない
- リスポーン地点が設定される

**CHEST**
- `block-type.ts` に CHEST が存在する
- PLANKS×8 でクラフトできる
- 設置・破壊・ドロップ・通常描画ができる
- 右クリックで 27 スロット UI が開くか確認する（未実装）

**DOOR**
- `block-type.ts` に DOOR / DOOR_OPEN が存在する
- PLANKS×6 で DOOR×3 をクラフトできる
- 木製 DOOR は縦2マスで設置され、右クリックで上下の DOOR / DOOR_OPEN を同期して切り替えられる
- ヒンジ向き、薄い衝突形状、鉄ドアは未実装

**FARMLAND**
- クワ（HOE）で右クリックすると GRASS/DIRT が FARMLAND に変換される
- WHEAT_SEEDS を植え付けられる

**WHEAT_CROP**
- 7段階（0→7）で成長する
- 成熟（段階7）で WHEAT と WHEAT_SEEDS がドロップする
- BONE_MEAL で成長が加速する

**ENCHANTING_TABLE**
- `block-type.ts` に ENCHANTING_TABLE が存在するか確認する
- 設置できるか確認する、右クリックで UI が開くか確認する（機能実装の有無を確認する）

**TNT**
- `block-type.ts` に TNT が存在するか確認する
- FLINT_AND_STEEL で着火できるか確認する
- 着火後に爆発するか確認する（`explosion.ts` の実装を確認する）

### 3-5. ブロック操作メカニクス

- 左クリックでレイキャストヒットブロックが破壊される
- PLAYER_ATTACK_REACH=3.5 ブロックが到達距離（§A-2 参照、公式 4.5 との差を記録する）
- 到達距離外ではブロックをハイライトしない
- 到達距離外では破壊できない
- BEDROCK はサバイバルで破壊できない
- 右クリックでレイキャストヒット面の隣にブロックを設置する
- 設置後にインベントリのアイテムが 1 消費される
- ブロック破壊音が鳴る
- ブロック設置音が鳴る
- ブロック採掘時間が即時か時間がかかるか `interaction-stage.ts` で確認する（公式は素材・ツールで時間が変わる）

---

## §4. インベントリ・クラフト

### 4-1. インベントリ基本

- E キーでインベントリオーバーレイが開く
- Esc または E キーで閉じる
- 開いている間にポインタロックが解除される
- メインスロットが 27 個（3行×9列）
- ホットバースロットが 9 個
- 防具スロットが 4 つ（頭/胴/足/靴）
- 同種アイテムが同一スロットにスタックされる
- 一般アイテムのスタック上限が 64
- ツール・防具のスタック上限が 1
- セーブ/ロード後にインベントリが保持される

### 4-2. ホットバー操作

- Digit1〜9 でホットバースロットを選択できる
- マウスホイールでスロット切替できるか確認する（実装の有無を確認する → §12 参照）
- 選択スロットが視覚的にハイライトされる

### 4-3. クラフトシステム — レシピ一覧

**inventory station**

| レシピ | 材料 | 出力 |
|---|---|---|
| wood-to-planks | WOOD×1 | PLANKS×4 |
| planks-to-sticks | PLANKS×2 | STICKS×4 |
| planks-to-crafting-table | PLANKS×4 | CRAFTING_TABLE×1 |
| coal-torch | COAL×1+STICKS×1 | TORCH×4 |
| charcoal-torch | CHARCOAL×1+STICKS×1 | TORCH×4 |
| bone-meal | BONE×1 | BONE_MEAL×3 |
| bread | WHEAT×3 | BREAD×1 |
| chest | PLANKS×8 | CHEST×1 |
| bed | WOOL×3+PLANKS×3 | BED×1 |
| door | PLANKS×6 | DOOR×3 |

**crafting_table station**

| カテゴリ | 材料（確認する）|
|---|---|
| FURNACE | COBBLESTONE×8 |
| 剣5種（木/石/鉄/金/ダイヤ） | 各材料×2 + STICKS×1 |
| ピッケル5種 | 各材料×3 + STICKS×2 |
| 斧5種 | 各材料×3 + STICKS×2 |
| シャベル5種 | 各材料×1 + STICKS×2 |
| クワ5種 | 各材料×2 + STICKS×2 |
| 革防具4種 | LEATHER×4〜8 |
| 鉄防具4種 | IRON_INGOT×4〜8 |
| 金防具4種 | GOLD_INGOT×4〜8 |
| ダイヤ防具4種 | DIAMOND×4〜8 |
| BOW | STRING×3+STICKS×3 |
| ARROW | FLINT×1+STICKS×1+FEATHER×1 → ARROW×4 |
| SHIELD | PLANKS×6+IRON_INGOT×1 |
| BUCKET | IRON_INGOT×3 |
| SHEARS | IRON_INGOT×2 |
| FISHING_ROD | STICKS×3+STRING×2 |
| FLINT_AND_STEEL | FLINT×1+IRON_INGOT×1 |
| GOLDEN_APPLE | GOLD_INGOT×8+APPLE×1 |

- 各レシピが `packages/inventory/application/recipes/` に実装されているか確認する
- `crafting_table` station のレシピが CRAFTING_TABLE なしでは実行できないか確認する
- `furnace` station のレシピが FURNACE なしでは実行できないか確認する

### 4-4. かまど精錬

参照ファイル: `packages/inventory/application/furnace-service.config.ts`, `packages/inventory/application/furnace-service.ts`

**定数**

| 定数 | 実装値 | 公式値 |
|---|---|---|
| FURNACE_SMELT_DURATION_SECS | 10.0 秒 | 10 秒 |
| FURNACE_FUEL_BURN_DURATION_SECS | COAL/CHARCOAL=80 秒、WOOD/PLANKS/BOW/FISHING_ROD=15 秒、木製ツール=10 秒、STICKS=5 秒 | 石炭 80 秒、木材 15 秒、棒 5 秒など |

**燃料アイテム一覧（`furnace-service.config.ts`）**

COAL、CHARCOAL、STICKS、WOODEN_SWORD、WOODEN_PICKAXE、WOODEN_AXE、WOODEN_HOE、BOW、FISHING_ROD、PLANKS、WOOD。燃料ごとの燃焼時間は `FURNACE_FUEL_BURN_DURATION_SECS` で定義する。

**精錬レシピ一覧（確認対象）**

| 入力 | 出力 |
|---|---|
| RAW_IRON | IRON_INGOT |
| RAW_GOLD | GOLD_INGOT |
| RAW_BEEF | COOKED_BEEF |
| RAW_PORKCHOP | COOKED_PORKCHOP |
| RAW_MUTTON | COOKED_MUTTON |
| RAW_CHICKEN | COOKED_CHICKEN |
| RAW_COD | COOKED_COD |
| RAW_SALMON | COOKED_SALMON |
| WOOD | CHARCOAL |
| COBBLESTONE | STONE |
| SAND | GLASS |

**精錬 XP ドロップ表（`furnace-service.config.ts:19-28`）**

| 出力アイテム | XP（小数 = 確率的 XP）|
|---|---|
| IRON_INGOT | 0.7 |
| GOLD_INGOT | 1.0 |
| STONE | 0.1 |
| GLASS | 0.1 |
| CHARCOAL | 0.15 |
| COOKED_BEEF | 0.35 |
| COOKED_CHICKEN | 0.35 |
| COOKED_COD | 0.35 |
| COOKED_SALMON | 0.35 |

検証項目:
- FURNACE ブロックを右クリックすると `setSelectedFurnace(pos)` が呼ばれるか確認する（`interaction-placement-handler.ts:279`）
- 燃料スロットに燃料を配置すると精錬が開始されるか確認する
- `FURNACE_SMELT_DURATION_SECS=10.0 s` で 1 アイテムが精錬されるか確認する
- `simulation.furnace` デバッグフラグで精錬シミュレーションが停止/再開できるか確認する
- 精錬完了アイテムを取り出すと XP が付与されるか確認する（上表の値）
- STICKS/BOW/FISHING_ROD/木製ツールが燃料として使えるか確認する
- かまど状態（燃料残量・進行度・出力）がセーブ/ロード後に保持されるか確認する（`session-save.ts:34`）

---

## §5. 食料・農業（§A-10 参照）

### 5-1. 食料アイテム

- 各食料の foodLevel/saturationModifier を `food.config.ts` で §A-10 の表と照合する
- 食べると foodLevel/saturation が上昇する
- 満腹（foodLevel=MAX）では食べられない

| 食料 | 特殊効果確認 |
|---|---|
| ROTTEN_FLESH | Nausea 効果（30%確率）の実装確認 |
| GOLDEN_APPLE | Absorption/Regeneration 効果の実装確認 |
| PUFFERFISH | 毒効果の実装確認 |

### 5-2. 農業

参照ファイル:
- `packages/world/domain/crop-growth.ts:12` — `CROP_GROWTH_INTERVAL_SECS = 60`
- `packages/app/application/frame/frame-maintenance.ts:147-152` — `tickAll()` 自動成長
- `packages/app/application/frame/stages/interaction-farming-handler.ts` — plant/harvest/bone-meal
- `packages/app/application/frame/stages/interaction-break-handler.ts:69-75` — harvest drop logic

| 定数名 | 実装値 | 参照 |
|---|---|---|
| CROP_GROWTH_INTERVAL_SECS | 60 s（1分で1段階成長） | `crop-growth.ts:12` |
| 最大成長段階 | 7（0→7） | `crop-growth.ts` |

検証項目:
- クワ（HOE）で GRASS/DIRT を右クリックすると FARMLAND に変換される
- WHEAT_SEEDS をホットバーに持ち FARMLAND を右クリックすると種が植え付けられる
- 作物が `CROP_GROWTH_INTERVAL_SECS=60` 秒ごとに 1 段階自動成長することを `frame-maintenance.ts:147-152` で確認する
- 成熟段階（7）未満で破壊すると WHEAT_SEEDS のみドロップし WHEAT はドロップしないことを `interaction-break-handler.ts:73-75` で確認する
- 成熟段階（7）で破壊すると WHEAT + WHEAT_SEEDS がドロップすることを `interaction-break-handler.ts:69` で確認する（`wasRipe` フラグ）
- BONE_MEAL を右クリックすると `advanceByBoneMeal()` で成長が加速することを `interaction-farming-handler.ts:66` で確認する
- FARMLAND が水源（4ブロック以内）のないまま放置すると乾燥して DIRT に戻る処理が実装されているか確認する
- 作物成長に光量条件（light≥9）が実装されているか確認する
- crop データがセーブ/ロード後も保持されることを `session-save.ts` で確認する

---

## §6. Mob（§A-7, §A-8 参照）

### 6-1. Zombie

- HP=20, attackDamage=3, speed=1.25, detectionRange=16, attackRange=1.6 を `zombie.ts` で確認する
- fleeHealthThreshold=0.1 は公式と異なる差分として記録する
- 夜/暗所にスポーンする
- 日光下で発火する処理が実装されているか確認する

### 6-2. Skeleton

- HP=20, attackDamage=2, speed=1.0, detectionRange=20, attackRange=12 を `skeleton.ts` で確認する
- attackRange=12（弓近似）は公式の弓射撃とは異なる差分として記録する
- BONE×1+ARROW×2 を確率なしでドロップする（公式との差を記録する）
- 日光下で発火する処理が実装されているか確認する

### 6-3. Creeper

- HP=20, detectionRange=16, attackRange=1.5 を `creeper.ts` で確認する
- 接近すると発火シーケンスが開始される（ヒス音）
- 爆発処理が実装されているか `explosion.ts` で確認する
- 爆発でブロックが破壊されるか確認する
- 爆発でプレイヤーにダメージが入るか確認する

### 6-4. Spider

- HP=16, attackDamage=2, speed=1.45, detectionRange=16, attackRange=1.4 を `spider.ts` で確認する
- speed=1.45 が Zombie 1.25 より速いことを記録する
- STRING×1+SPIDER_EYE×1 を確率なしでドロップする（公式 SPIDER_EYE は 33% との差を記録する）
- 昼間は敵対しない処理が実装されているか確認する（コメント「neutral by day」に対する実装を確認する）

### 6-5. Enderman

- HP=40, attackDamage=7, detectionRange=24 を `enderman.ts` で確認する
- detectionRange=24 は他の Mob（16）より広い差分を記録する
- ENDER_PEARL のドロップを `enderman.ts` で確認する
- テレポート処理が実装されているか確認する
- 水に触れるとダメージを受けて逃げる処理が実装されているか確認する
- プレイヤーが直接見ると敵対する処理が実装されているか確認する

### 6-6. Cow / Pig / Sheep

- HP/xpReward を §A-7 と照合する
- RAW_PORKCHOP は item-type.ts に定義済みで、Pig が常時 ×1 ドロップする
- RAW_MUTTON は item-type.ts に定義済みで、Sheep が常時 ×1 ドロップする

**交配（§N 参照）:**
- 牛に WHEAT を右クリックで Love Mode に入ることを確認する（breedingItem='WHEAT', cow.ts）
- 豚に CARROT を右クリックで Love Mode に入ることを確認する（breedingItem='CARROT', pig.ts）
- 羊に WHEAT を右クリックで Love Mode に入ることを確認する（breedingItem='WHEAT', sheep.ts）
- Love Mode の 2 頭が近づくと仔動物が生まれることを確認する
- 仔動物がドロップなし/XP なしで確認できるか `interaction-melee-handler.ts:108` で確認する

**剪断:**
- 羊に SHEARS を右クリックで WOOL×1〜3 がドロップすることを `interaction-item-use-handler.ts:100-104` で確認する
- 剪断後 `WOOL_REGROWTH_TICKS=6000`（5分）で羊毛が再生することを `shearing.ts:10` で確認する
- 羊毛再生前は再剪断できないことを `canBeSheared()` で確認する
- SHEARS が耐久消費しないことを `interaction-item-use-handler.ts:84-85` のコメントで確認する（公式との差）
- SHEARS で Sheep を刈れるか確認する

### 6-7. Mob 共通 AI

- Idle → Wander → Chase → Attack の状態遷移を `state-machine.ts` で確認する
- `distanceToPlayer <= detectionRange` で Chase 開始することを `state-machine.ts:43` で確認する
- `distanceToPlayer <= attackRange` で Attack 発動することを `state-machine.ts:38` で確認する
- Knockback 受信中は AI の速度上書きが抑制されることを確認する
- DESPAWN_DISTANCE=64 ブロック超でデスポーンする処理が実装されているか確認する（`spawner-config.ts:4` — 公式の 128 と異なる）
- Mob スポーン条件（明るさ≤7、上方2マス空間）を `entity-manager.ts` で確認する

---

## §7. 戦闘（§A-6 参照）

### 7-1. 近接攻撃

- 左クリックで最寄りの Mob を攻撃する
- PLAYER_ATTACK_REACH=3.5 以内のみ当たる（§A-2 参照）
- チャージ式 `max(0, min(1, elapsed/0.625))` を `combat.ts:58-62` で確認する
- ダメージ式 `base × (0.2 + 0.8 × charge²)` を `combat.ts` で確認する
- 空中攻撃でクリティカル（1.5倍）が発動する
- 接地中ではクリティカルにならない

### 7-2. 武器ダメージ値（§A-7 参照）

| 武器 | baseDamage(実装) | 公式 |
|---|---|---|
| 素手 | 1 | 1 |
| WOODEN_SWORD | 4 | 4 |
| STONE_SWORD | 5 | 5 |
| IRON_SWORD | 6 | 6 |
| GOLD_SWORD | 4 | 4 |
| DIAMOND_SWORD | 7 | 7 |

各武器の baseDamage を `combat.ts` または対応する設定ファイルで確認する。

### 7-3. 武器耐久値（§A-3 参照）

| 武器 | 実装耐久 | 公式 |
|---|---|---|
| WOODEN_SWORD | 59 | 59 |
| STONE_SWORD | 131 | 131 |
| IRON_SWORD | 250 | 250 |
| GOLD_SWORD | 32 | 32 |
| DIAMOND_SWORD | 1561 | 1561 |

TOOL_MAX_DURABILITY を `packages/inventory/domain/durability.ts` で確認する。

### 7-4. ツール耐久値（全種別）

| ツール | 木(59) | 石(131) | 鉄(250) | 金(32) | ダイヤ(1561) |
|---|---|---|---|---|---|
| ピッケル | 確認 | 確認 | 確認 | 確認 | 確認 |
| 斧 | 確認 | 確認 | 確認 | 確認 | 確認 |
| シャベル | 確認 | 確認 | 確認 | 確認 | 確認 |
| クワ | 確認 | 確認 | 確認 | 確認 | 確認 |

金ツールの耐久値が 32 であることを `durability.ts` で確認する（公式との一致確認）。

### 7-5. 防具アーマー値

アーマー軽減式: `reduction = min(armorPoints × 0.04, 0.8)` を `armor.ts` で確認する

| 防具 | 公式アーマー値 |
|---|---|
| LEATHER_HELMET | 1 |
| LEATHER_CHESTPLATE | 3 |
| LEATHER_LEGGINGS | 2 |
| LEATHER_BOOTS | 1 |
| IRON_HELMET | 2 |
| IRON_CHESTPLATE | 6 |
| IRON_LEGGINGS | 5 |
| IRON_BOOTS | 2 |
| DIAMOND_HELMET | 3 |
| DIAMOND_CHESTPLATE | 8 |
| DIAMOND_LEGGINGS | 6 |
| DIAMOND_BOOTS | 3 |
| GOLD_HELMET | 2 |
| GOLD_CHESTPLATE | 5 |
| GOLD_LEGGINGS | 3 |
| GOLD_BOOTS | 1 |

各防具のアーマー値を `packages/inventory/domain/armor.ts` で確認する。

### 7-6. 弓攻撃

参照ファイル: `packages/entity/domain/bow.ts`, `packages/app/application/frame/stages/interaction-bow-handler.ts`

> **重要な差分**: 本実装は**ヒットスキャン**（瞬時判定）であり、公式 Minecraft の放物線弾道矢エンティティとは全く異なる。矢が飛ぶ視覚エフェクトは存在しない。

| 定数名 | 実装値 | 公式値 |
|---|---|---|
| BOW_MIN_CHARGE_SECS | 0.2 s | 0s（即発射可能） |
| BOW_FULL_CHARGE_SECS | 1.0 s | ~1.0 s |
| BOW_MAX_RANGE | 50 blocks（ヒットスキャン）| ~65 blocks（弾道） |
| BOW_MIN_DAMAGE | 1 | 1 |
| BOW_MAX_DAMAGE | 9 | 9 |
| ダメージ式 | `1 + charge² × 8`（quadratic）| 同様 |

検証項目:
- BOW を持ち右クリックを押すとチャージが開始されることを確認する（`bowChargeStartRef` セット）
- 0.2 秒（`BOW_MIN_CHARGE_SECS`）未満では発射されないことを確認する（`canFireBow` 判定）
- 右クリックを離すと発射が試みられることを確認する
- チャージ時間が `BOW_FULL_CHARGE_SECS=1.0 s` に達すると最大ダメージ 9 になることを確認する
- ダメージ式 `1 + charge² × 8` をコードで確認する（`bow.ts:17-19`）
- ARROW が存在しない場合は発射できないことを確認する（`removeBlock('ARROW',1)` が失敗 → 中断）
- INFINITY エンチャントで ARROW を消費せずに発射できることを確認する
- POWER エンチャントでダメージが増加することを確認する（`getPowerDamageMultiplier(level)` 乗算）
- PUNCH エンチャントで命中時にノックバックが追加されることを確認する
- UNBREAKING エンチャントで弓の耐久値消費がスキップされる確率を確認する
- 弓でのキルにもメレーと同じ Mob XP が付与されることを確認する（`xpService.addXP(xpReward)`）
- Mob 方向に向いて発射するとヒットスキャンで即座に判定されることを確認する（矢の弾道エフェクトはない）
- **公式との差分**: 矢エンティティが存在しないため、壁に刺さった矢の視覚効果・拾得は実装されていない（確認する）

### 7-7. シールドブロッキング

参照ファイル: `packages/app/application/frame/stages/physics-stage.ts:113-119`、`packages/app/application/frame/stages/interaction-stage.ts:167-169`

| 定数名 | 実装値 | 公式値 | 参照 |
|---|---|---|---|
| ダメージ軽減率 | 66% (係数 0.34) | 66% | `physics-stage.ts:116` |
| ブロッキング状態 | 右クリック長押し | 右クリック長押し | `interaction-stage.ts:167` |
| シールド耐久減少 | ヒット吸収時1 | ヒット時1 | `physics-stage.ts:117-119` |

検証項目:
- SHIELD をホットバーに持ち**右クリック長押し**でブロッキング状態になることを確認する
- ブロッキング中に Mob 攻撃を受けると 34%（= 1 - 0.66）のみダメージが通ることを確認する
- ブロッキング中にシールドの耐久値が 1 消費されることを確認する (`physics-stage.ts:117-119`)
- 右クリックを離すとブロッキング状態が解除されることを確認する (`interaction-stage.ts:112`)
- SHIELD の耐久値が 0 になると破壊されるか確認する
- `isShieldBlockingRef` が `interaction-stage` でセットされ `physics-stage` で読まれることを確認する（フレーム N+1 から有効 — フレーム遅れあり）

---

## §8. 音声

- ブロック破壊/設置音が鳴る
- 歩行/ジャンプ/着地音が鳴る
- Mob 撃破/被弾音が鳴る
- 食事音が鳴るか確認する
- `sound-manager.config.ts` の全 SOUND_EFFECTS で未配線のものがないか確認する
- `audioEnabled=false` のとき全 SE が無音になる
- `sfxVolume` / `musicVolume` で音量が変わる

---

## §9. UI（公式仕様との比較）

| 要素 | 現状実装 | 公式仕様 |
|---|---|---|
| 体力 | `♥ 20/20` テキスト (`index.html:29`) | ハートアイコン×10 ピクセルアート |
| 空腹 | `🍗 20/20` テキスト (`index.html:32`) | 骨付き肉アイコン×10 ピクセルアート |
| 防具 | `🛡 0` テキスト (`index.html:35`) | アーマーアイコン×10 ピクセルアート |
| XP | `⭐ Lv 0 0/7 XP` テキスト (`index.html:42`) | 画面下部横断の緑バー |
| 気泡 | `#air-display` 表示/非表示 (`index.html:38`) | 気泡アイコン×10 |

- 各 HUD 要素の現状実装と公式との差を確認して記録する
- ホットバーのアイテムアイコン/数字/耐久バーが表示されているか確認する
- クロスヘアが画面中央に表示されているか確認する
- インベントリ UI でドラッグ&ドロップが機能するか確認する
- FPS カウンタが画面右上に表示されているか（`index.html:26`）
- 気泡 HUD が水中で `🫧` emoji × 10 で表示されるか確認する（公式はピクセルアートスプライト）
- 溺死時に `💀 Drowning` テキストが表示されるか確認する（`physics-stage.ts:315`）

### 9-2. ポーズメニュー（M キー）

参照ファイル: `packages/presentation/menu/pause-menu.ts`

ポーズメニューには以下 3 つのオプションが実装されている:
1. **Resume** — メニューを閉じてゲームに戻る（ESC キーでも同じ）
2. **Settings** — 設定オーバーレイを開く（設定を閉じると再びポーズメニューに戻る）
3. **Save & Quit** — 確認ダイアログ（`SAVE_QUIT_CONFIRM_MESSAGE`）を経てワールドをセーブしてタイトルに戻る

検証項目:
- M キーでポーズメニューが開くことを確認する（ESC はポインタロック解除のみ）
- ポーズメニュー表示中にゲームループが一時停止するか確認する
- Resume でゲームに戻ることを確認する（ESC も同様）
- Settings でグラフィックス/音声/ゲーム設定画面が開くことを確認する
- Save & Quit に確認ダイアログが表示されることを確認する
- Save & Quit でワールドがセーブされタイトル画面に戻ることを確認する
- 公式 Minecraft のポーズメニューとの差分（Advancements/Statistics ボタン等がない）を記録する

---

## §10. 操作性・UX

### 10-1. ポインタロック

- ゲームキャンバスをクリックするとポインタロックが取得される
- Esc キーでポインタロックが解除される（ブラウザ標準）
- `OPEN_MENU_KEY='KeyM'` でメニューが開くことを `frame-handler.config.ts:23` で確認する（ESC はポインタロック解除のみ）
- インベントリを開くとポインタロックが解除される
- ポインタロック解除後に UI のクリックが機能する

### 10-2. キーボード応答性

- キー入力からゲーム内動作への遅延が体感できないレベル（1フレーム以内）
- WASD 長押しで継続的に移動する
- キーを離すと即座に停止する
- W+A+Space 等の複数キー同時押しが正常に処理される
- キーがスタックしない（離してもリピートが止まらないバグがない）

### 10-3. 視点操作の操作感

- マウス移動に対して視点がスムーズに追従する（加速/減速ラグなし）
- mouseSensitivity が低いと遅く、高いと速く動く
- pitch が ±90° でクランプされ視点が反転しない

### 10-4. ブロック操作のフィードバック

- 照準を向けたブロックが即座にハイライトされる
- ハイライトが到達距離外（3.5 ブロック超）では消える
- 左クリック後に即座にブロックが消える（または破壊進行バーが増加する）
- 右クリック後に即座にブロックが設置される

### 10-5. インベントリ操作の操作感

- E キーでインベントリが即座に開く/閉じる
- ドラッグ中にアイテムがマウスカーソルに追従する
- スロット外ドロップ時の挙動が明確（アイテムが消えない）

### 10-6. HUD 視認性

- HUD がゲームの背景色にかかわらず視認できる（コントラスト十分）
- 夜の暗い場面でも HUD が見える
- FPS カウンタが常に表示されている（`index.html:26`）

### 10-7. フィードバック・通知

- アイテム取得時に視覚的フィードバックがある
- 被弾時に画面エフェクト（赤フラッシュ等）がある
- 死亡時に明確な演出がある
- オートセーブ完了の通知が表示されるか確認する

### 10-8. エラー・クラッシュ耐性

- 存在しない座標へのアクセスでゲームがクラッシュしない
- チャンクロード失敗時に `Effect.catchAllCause` でガードされているか確認する
- ブラウザタブ非アクティブ→復帰後に正常動作する（deltaTime クランプで保護）
- 5分間プレイしてコンソールに繰り返しエラーがないことを確認する

### 10-9. パフォーマンス感

- 通常プレイで FPS が 30 以上を維持する
- チャンクロード時のカクつきが 0.5 秒以内
- Mob 10 体以上でも FPS が許容範囲内
- ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD=50 が機能していることを `frame-handler.config.ts:67` で確認する

### 10-10. キーバインド確認

参照ファイル: `packages/entity/domain/key-mappings.ts`, `packages/app/application/frame-handler.config.ts`

**基本操作**
- WASD / Arrow キーで移動できるか確認する
- Space で飛び/ジャンプ、Shift でスニーク、ControlLeft/ControlRight でスプリント（ダブルタップ W ではない）できるか確認する
- E キーでインベントリが開閉するか確認する
- Digit1-9 でホットバースロット切替できるか確認する
- Escape でポインタロック解除（メニューではない）、M キーでメニューが開くか確認する（`OPEN_MENU_KEY='KeyM'`, `frame-handler.config.ts:23`）
- F5 キーで視点（一人称/三人称）がトグルするか確認する（`CAMERA_TOGGLE='F5'`）
- F3 キーでデバッグオーバーレイがトグルするか確認する（§U）

**インベントリ・戦闘操作**
- G キーで防具が最初の占有スロットから外れるか確認する（`UNEQUIP_ARMOR_KEY='KeyG'`, `frame-handler.config.ts:53`）
- Q キーによるアイテムドロップが実装されているか確認する（key-mappings.ts に未定義の場合は差分として記録する）

**トレード操作**
- T キーで最寄り村人との取引 UI が開くか確認する（`TRADE_OPEN_KEY='KeyT'`, 距離 4 以内）
- ArrowDown/ArrowUp で取引リストが選択できるか確認する（`TRADE_NEXT/PREV_KEY`）
- Enter で取引が実行されるか確認する（`TRADE_EXECUTE_KEY='Enter'`）

**レッドストーン操作**
- R キーでレッドストーンワイヤーを設置できるか確認する（`REDSTONE_PLACE_WIRE_KEY='KeyR'`）
- L キーでレバーを設置できるか確認する（`REDSTONE_PLACE_LEVER_KEY='KeyL'`）
- B キーでボタンを設置できるか確認する（`REDSTONE_PLACE_BUTTON_KEY='KeyB'`）
- O キーでレッドストーントーチを設置できるか確認する（`REDSTONE_PLACE_TORCH_KEY='KeyO'`）
- P キーでピストンを設置できるか確認する（`REDSTONE_PLACE_PISTON_KEY='KeyP'`）
- Y キーでレバーを切り替えられるか確認する（`REDSTONE_TOGGLE_LEVER_KEY='KeyY'`）
- U キーでボタンを押せるか確認する（`REDSTONE_PRESS_BUTTON_KEY='KeyU'`）
- I キーでトーチを切り替えられるか確認する（`REDSTONE_TOGGLE_TORCH_KEY='KeyI'`）

**クリエイティブ / スペクテーター**
- F キーでフライトモードをトグルできるか確認する（`TOGGLE_FLIGHT='KeyF'`, クリエイティブ・スペクテーターのみ）

---

## §11. 永続化

- チャンクデータが IndexedDB（DB名: `minecraft-worlds`）に保存される — DB名を `storage-service.ts` で確認する
- ロード後にブロック変更が保持されている
- インベントリ/座標/体力/空腹/XP/防具がセーブ/ロード後も保持される
- 自動セーブが `Schedule.spaced(5s)` で実行される（`spaced` でバースト防止）
- セーブ中にフレーム落ちしない
- 複数ワールドを個別に保存できる
- 破損データロード時にクラッシュせずフォールバックする

---

## §B. プレイヤー AABB・物理詳細

### B-1. プレイヤー AABB サイズ

| 定数名 | 実装値 | 公式仕様値 | 参照ファイル |
|---|---|---|---|
| PLAYER_HALF_WIDTH | 0.3 (full: 0.6) | 0.3 (0.6) | `packages/core/domain/constants.ts:23` |
| PLAYER_HALF_HEIGHT | 0.9 (full: 1.8) | 0.9 (1.8) | `packages/core/domain/constants.ts:24` |
| FIRST_FRAME_DELTA_SECS | 0.016 s | — | `packages/core/domain/constants.ts:9` |

検証項目:
- PLAYER_HALF_WIDTH=0.3（幅 0.6 ブロック）を `constants.ts:23` で確認する
- PLAYER_HALF_HEIGHT=0.9（高さ 1.8 ブロック）を `constants.ts:24` で確認する（公式と一致）
- FIRST_FRAME_DELTA_SECS=0.016 が初回フレームに使われることを `game-loop/index.ts` で確認する
- プレイヤーの position.y が AABB 中心（足から +0.9）であることを `spawn-selection.ts:125` で確認する
- AABB 衝突解決の順序（Y軸優先 or XYZ同時）を `game-state-physics.ts:resolveBlockCollisions` で確認する
- 0.5 ブロックの段差を自動で登る（ステップアップ）処理が実装されているか確認する
- スニーク時にブロックの縁から落ちない処理が実装されているか確認する
- 水中の移動速度が陸上より遅くなる処理が実装されているか確認する
- 水中で Space を押すと浮上する処理が実装されているか確認する

---

## §C. 光伝播システム

参照ファイル:
- `packages/block/domain/break-speed.ts` ← ここではなく光系は以下
- `packages/world/application/terrain-generation.ts:77-84` （skyLight/blockLight 計算）
- `packages/world/application/light-engine-service.ts`
- `packages/block/domain/` 内の `computeSkyLight`, `computeBlockLight`

検証項目:
- skyLight と blockLight の2系統の光バッファが存在することを `terrain-generation.ts:77-84` で確認する
- `computeSkyLight()` と `computeBlockLight()` が BFS（幅優先探索）で実装されていることを確認する
- チャンク生成時に skyLight/blockLight が初期計算されることを `terrain-generation.ts:141-142` で確認する
- ブロック設置/破壊後に光が再伝播する処理が `light-engine-service.ts` に実装されているか確認する
- `propagateLightIncremental` が存在することを `light-engine-service.ts:78` で確認する
- TORCH が emissive=true であることを `blocks.config.crafted.ts:31` で確認する
- TORCH の光量（lightLevel）の値を `blocks.config.crafted.ts` で確認し公式（14）と照合する
- 光が隣接ブロックごとに 1 ずつ減衰することを確認する
- 日光（skyLight）が地表から垂直に降りてくる処理を確認する
- 光量が 0 の暗所でゾンビがスポーンできることを確認する
- 光量が 8 以上の明所でゾンビがスポーンできないことを確認する（スポーン条件と光の関係）

---

## §D. ブロック採掘時間・ツールボーナス

参照ファイル: `packages/block/domain/break-speed.ts`

### D-1. 採掘時間計算式

```typescript
// break-speed.ts:38
breakTicks = ceil(hardness * 3 / speedMult)
speedMult = baseSpeed + effBonus
effBonus = correctTool && efficiencyLevel !== undefined ? efficiencyLevel² + 1 : 0
// hardness <= 0 → 0（即時破壊）
// correctTool=false（不適切ツール）→ baseSpeed=1
```

### D-2. ツール速度倍率

| ツール種 | 木(2×) | 石(4×) | 鉄(6×) | ダイヤ(8×) | 金(2×) |
|---|---|---|---|---|---|
| ピッケル | WOODEN_PICKAXE | STONE_PICKAXE | IRON_PICKAXE | DIAMOND_PICKAXE | GOLD_PICKAXE |
| シャベル | WOODEN_SHOVEL | STONE_SHOVEL | IRON_SHOVEL | DIAMOND_SHOVEL | GOLD_SHOVEL |
| 斧 | WOODEN_AXE | STONE_AXE | IRON_AXE | DIAMOND_AXE | GOLD_AXE |

参照ファイル: `packages/block/domain/break-speed.ts:12-16`

### D-3. ブロック硬度値（実装値）

| ブロック | 実装 hardness | 公式（ゲームtick数）| 参照 |
|---|---|---|---|
| AIR | 0 | 0 | `blocks.config.terrain.ts:33` |
| GRASS | 8 | 0.45 s | `blocks.config.terrain.ts:10` |
| DIRT | 8 | 0.45 s | `blocks.config.terrain.ts` |
| STONE | 25 | 1.5 s | `blocks.config.terrain.ts:59` |
| COBBLESTONE | 35 | 2.0 s | `blocks.config.terrain.ts:69` |
| SAND | 10 | 0.5 s | `blocks.config.terrain.ts:78` |
| GRAVEL | 8 | 0.45 s | `blocks.config.terrain.ts:88` |
| WATER | 0 | 0 | `blocks.config.terrain.ts:98` |
| LAVA | 0 | 0 | `blocks.config.terrain.ts` |
| TORCH | 1 | 即時 | `blocks.config.crafted.ts:31` |
| PLANKS | 40 | 2.25 s | `blocks.config.crafted.ts:18` |
| CRAFTING_TABLE | 35 | 2.5 s | `blocks.config.crafted.ts:12` |
| FURNACE | 55 | 3.125 s | `blocks.config.crafted.ts:25` |
| OBSIDIAN | 9000 | 50 s (ダイヤ必須) | `blocks.config.crafted.ts:103` |
| BEDROCK | -1 (破壊不可) | — | — |

検証項目:
- 採掘時間計算式 `ceil(hardness * 3 / speedMult)` を `break-speed.ts:38` で確認する
- TOOL_SPEED 表（木2/石4/鉄6/ダイヤ8/金2）を `break-speed.ts:12-16` で確認する
- 金ツールが木と同じ倍率（2×）であることを確認する（公式は金が最速12×だが低耐久）
- EFFICIENCY 附魔のボーナス式 `level² + 1` を `break-speed.ts:36` で確認する
- 不適切ツール（correctTool=false）の場合 baseSpeed=1 になることを `break-speed.ts:34-35` で確認する
- hardness=0 のブロック（TORCH/WATER/LAVA等）が即時破壊になることを `break-speed.ts:28` で確認する
- BEDROCK の hardness が負値（-1）または特別値であり破壊不可になることを確認する
- 各ブロックの `correctTool` 判定（ピッケル→石系、斧→木系、シャベル→砂土系）が実装されているか `interaction-break-handler.ts` で確認する
- `blocks.config.terrain.ts` と `blocks.config.crafted.ts` の hardness 値が公式と妥当な比率を持つか確認する

---

## §E. Mob スポーン詳細

参照ファイル: `packages/entity/domain/mob/spawner-config.ts`

| 定数名 | 実装値 | 参照 |
|---|---|---|
| MIN_SPAWN_DISTANCE | 16 ブロック | `spawner-config.ts:2` |
| MAX_SPAWN_DISTANCE | 40 ブロック | `spawner-config.ts:3` |
| DESPAWN_DISTANCE | **64 ブロック** | `spawner-config.ts:4` |
| MAX_ENTITY_COUNT | 24 体 | `spawner-config.ts:11` |
| SPAWN_INTERVAL_SECS | 0.3 s | `spawner-config.ts:18` |

> **注意**: §6-7 で「128 ブロック超でデスポーン」と記述したが、実際の DESPAWN_DISTANCE=64。要確認。

検証項目:
- DESPAWN_DISTANCE=64 を `spawner-config.ts:4` で確認する（§6-7 の「128」は誤記 — 要修正）
- MIN_SPAWN_DISTANCE=16（プレイヤー付近にはスポーンしない）を確認する
- MAX_SPAWN_DISTANCE=40 でスポーンが打ち切られることを確認する
- MAX_ENTITY_COUNT=24 でスポーンが停止することを確認する
- SPAWN_INTERVAL_SECS=0.3s（0.3秒に1回スポーン試行）を確認する
- スポーン条件「明るさ≤7（torch14 が照らす範囲外）」の実装を `spawner-config.ts:21` のコメントで確認する
- スポーン条件「ソリッドブロックの上 2 マスの空間」の実装を確認する
- スポーン位置がプレイヤーから 16〜40 ブロックの範囲であることを `spawner.ts` で確認する
- MIN_SPAWN_BODY_Y=SEA_LEVEL+1+PLAYER_HALF_HEIGHT（海中スポーン防止）を `spawn-selection.ts:182` で確認する

---

## §F. 死亡・リスポーン詳細

検証項目:
- プレイヤーが死亡したときインベントリの全アイテムがドロップする処理が実装されているか確認する
- ドロップしたアイテムが世界に item entity として出現するか確認する
- ドロップしたアイテムがプレイヤーに近づくと自動で拾得されるか確認する
- ドロップしたアイテムが一定時間後に消滅するか確認する（タイマーの実装有無を確認する）
- リスポーン後にインベントリが空になっているか確認する
- 死亡画面が表示されるか確認する（`DeathScreenService` — `session-runtime.ts:11` でスコープ管理）
- リスポーンボタンでゲームが再開するか確認する
- リスポーン位置がベッドまたはワールドスポーンになるか確認する
- クリエイティブモードでは死亡画面が表示されず即時リスポーンすることを確認する（`physics-stage.ts:151-157`）
- ローディング画面がワールド作成・ロード中に表示されるか確認する（`LoadingScreenService` — `session.ts:18`）
- ローディング画面にプログレス表示があるか確認する
- ベッドが設置されている場合にベッドスポーンが優先されるか確認する
- ベッドが破壊されていた場合にワールドスポーンに戻るか確認する（または何が起きるか確認する）
- 死亡時に XP を失うか確認する（公式では50%消失）

---

## §G. レンダリング詳細

参照ファイル: `packages/rendering/`

### G-1. ブロックテクスチャ

- 全ブロックタイプにテクスチャが割り当てられているか確認する
- テクスチャが公式 Minecraft のブロックテクスチャに近いか確認する
- AIR が描画されないことを確認する（頂点出力ゼロ）
- GLASS/LEAVES/WATER の透明・半透明描画が正しく行われているか確認する
- 透明ブロック越しに背景が見えるか確認する

### G-2. 方向別面の明暗

- 上面が最も明るく、下面が最も暗く描画されているか確認する（方向別環境光）
- 太陽光の方向によって面の明暗が変化するか確認する
- 光量（skyLight/blockLight）が頂点色に反映されているか確認する

### G-3. 水シェーダー

- WATER が波打つアニメーションをするか確認する（`createWaterMaterial` の uTime uniform）
- 水中から外を見たときに屈折エフェクトがあるか確認する
- WATER のレンダリング順序が不透明メッシュより後であることを確認する

### G-4. LOD（レベルオブディテール）

- 遠距離チャンクが低解像度 LOD で描画されるか確認する（`lod-simplification.ts`）
- LOD の切り替え距離設定が renderDistance 設定と連動しているか確認する

### G-5. パーティクルシステム

- ブロック破壊時にブロックテクスチャのパーティクルが出るか確認する
- 近接攻撃ヒット時にパーティクルが出るか確認する（赤いパーティクルまたは REDSTONE_BLOCK UV）
- クリティカルヒット時にパーティクルが増加するか確認する
- パーティクルシステムが `packages/rendering/infrastructure/particles/particle-system.ts` に実装されているか確認する

### G-6. エンティティ描画

- Mob が 3D モデル（または Billboard スプライト）で描画されるか確認する
- Mob の位置が実際の AABB 位置と一致しているか確認する
- Mob の足元が地面に立っているか確認する（浮いていないか）
- 歩行アニメーション: `LIMB_SWING_AMPLITUDE = Math.PI / 6`（30°）で四肢が振れるか確認する（`packages/rendering/infrastructure/entity/walk-cycle.ts`）
- 移動速度に応じて四肢スイング速度が変化するか確認する
- 停止中は四肢が静止するか確認する
- ベビーモブが成体の半スケール（0.5×）で描画されるか確認する（`entity-renderer.ts:16`）
- ベビーモブの頭部が通常より相対的に大きく見えるか確認する（MC 準拠）
- エンティティの向き（ヨー）がカメラ・移動方向に正しく追従するか確認する

### G-7. 後処理効果

- Bloom / SSAO / DOF 等の後処理が設定に応じて ON/OFF できるか確認する
- God Rays が太陽方向に出るか確認する
- SMAA アンチエイリアシングが機能しているか確認する

---

## §H. インベントリ高度操作

検証項目:
- スロットを**左クリック**でアイテム全量を持ち上げる
- スロットを**右クリック**で半量を持ち上げる（奇数は切り上げ）
- 持ち上げ中に**左クリック**でスロットに全量を置く
- 持ち上げ中に**右クリック**でスロットに 1 個だけ置く
- **Shift+クリック**でホットバー↔メインインベントリを高速移動する
- ホットバーが満杯の場合に Shift+クリックでメインインベントリに移動するか確認する
- 同種アイテムのスロットに移動したとき自動でスタックされるか確認する
- **ドラッグ（左ボタン）**で複数スロットにアイテムを均等分配できるか確認する
- **ドラッグ（右ボタン）**で複数スロットに 1 個ずつ配置できるか確認する
- **2×2 クラフトグリッド**に材料を配置するとクラフト結果が出力スロットに現れるか確認する
- 出力スロットをクリックするとクラフト結果が取得され材料が消費されるか確認する
- Shift+クリック出力スロットで最大数のクラフトが一括実行されるか確認する
- インベントリを閉じたとき保持中のアイテムが正しく返却されるか確認する
- 防具スロットへのドラッグで防具が装備されるか確認する

---

## §I. アイテムエンティティ（ワールドドロップ）

検証項目:
- ブロック破壊後にドロップアイテムが世界に 3D オブジェクトとして出現するか確認する
- ドロップアイテムが回転アニメーションするか確認する（公式挙動）
- ドロップアイテムがプレイヤーに一定距離（約 1 ブロック）近づくと自動拾得されるか確認する
- 拾得時にインベントリの対応スロットにアイテムが追加されるか確認する
- 拾得不可能（インベントリ満杯）のときアイテムが消えないか確認する
- 拾得時に拾得音が鳴るか確認する
- アイテムエンティティが一定時間後に消滅するか確認する（タイマーの有無と時間を確認する）
- 同種アイテムが近くにある場合に合体（マージ）するか確認する
- 水上でアイテムが浮くか確認する
- インベントリから Q キーでアイテムをドロップできるか確認する

---

## §J. ワールド作成・管理

検証項目:
- 「New World」からワールド名を入力して作成できるか確認する
- ワールド作成時にシード値を指定できるか確認する（実装されているか）
- 未指定シードのとき乱数シードが使われることを確認する
- 同じシードを指定すると同一地形が生成されることを確認する
- 「Load World」でワールド一覧が表示されるか確認する
- ワールド一覧にワールド名・作成日時が表示されるか確認する
- 一覧からワールドを選択してロードできるか確認する
- ワールドを削除できるか確認する（確認ダイアログがあるか確認する）
- 複数ワールドが独立して IndexedDB に保存されるか確認する
- ワールド削除後に IndexedDB のデータが実際に消えるか確認する

---

## §M. 天候（Weather）

参照ファイル:
- `packages/game/application/weather-service.ts` — WeatherService、天候サイクル
- `packages/app/application/frame/stages/lighting-stage.ts:7-19` — `applyRainEnvironment`

### M-1. 天候定数（実装値）

| 天候 | 継続時間 | 公式 | 参照 |
|---|---|---|---|
| clear | 600 s (10 min) | 0.5〜7.5 min | `weather-service.ts:6` |
| rain | 240 s (4 min) | 0.5〜7.5 min | `weather-service.ts:7` |
| thunder | 120 s (2 min) | 0.5〜3.75 min | `weather-service.ts:8` |

天候サイクル: `clear → rain → thunder → clear`（公式はランダム、本実装は固定順序 — 差分記録すること）

### M-2. 天候検証項目

- 天候が `clear → rain → thunder → clear` の固定順序でサイクルすることを `weather-service.ts:16-19` で確認する
- 雨天時に環境光が 0.85 倍になることを `lighting-stage.ts:14` で確認する
- 雷天時に環境光が 0.6 倍になることを `lighting-stage.ts:11` で確認する
- 雨天時に空の色が曇り灰青（`HSL(0.6, 0.08, 0.35)` 相当）になることを `lighting-stage.ts:17` で確認する
- 天候の視覚変化が毎フレームの `weatherService.tick(deltaTime)` で更新されることを `lighting-stage.ts:38` で確認する
- 雨天時に Zombie の日光燃焼が抑制されるか確認する（実装有無を `entity-manager-internal-update.ts:227` で確認する）
- 雷天時に落雷エフェクトが実装されているか確認する
- WeatherService が `lighting-stage` の services に含まれていることを `lighting-stage.ts:31` で確認する

---

## §N. 動物交配・繁殖（Breeding）

参照ファイル:
- `packages/entity/domain/mob/breeding.ts` — breeding 定数・関数
- `packages/entity/application/mob/entity-manager-internal.ts:192-208` — feedEntity（Love Mode）
- `packages/entity/application/mob/entity-manager.ts:157` — ブリーディングペア検出・仔誕生

### N-1. 繁殖定数（実装値 vs 公式）

| 定数名 | 実装値 | 公式値 | 参照 |
|---|---|---|---|
| LOVE_DURATION_TICKS | 600 ticks (30s @ 20 tps) | 30s | `breeding.ts:7` |
| BREED_COOLDOWN_TICKS | 6000 ticks (5 min) | 5 min | `breeding.ts:8` |
| BABY_GROW_TICKS | 24000 ticks (20 min) | 20 min | `breeding.ts:9` |

### N-2. 交配アイテム

| 動物 | breedingItem | 参照 |
|---|---|---|
| Cow | WHEAT | `mobs/cow.ts:15` |
| Sheep | WHEAT | `mobs/sheep.ts:15` |
| Pig | CARROT | `mobs/pig.ts:15` |

### N-3. 繁殖検証項目

- 動物に breedingItem を右クリックで Love Mode に入ることを `entity-manager-internal.ts:208` で確認する
- `LOVE_DURATION_TICKS=600`（30秒）以内に Love Mode 同士が近くにいると仔動物が生まれることを確認する
- 交配後に `BREED_COOLDOWN_TICKS=6000`（5分）の再交配待機が発生することを確認する
- 仔動物の `ageTicks=0` から `BABY_GROW_TICKS=24000`（20分）で大人になることを確認する
- 仔動物を倒してもドロップなし・XP なしであることを `interaction-melee-handler.ts:108` コメントで確認する
- 仔動物が小さく描画されるか確認する（baby レンダリング実装の有無を確認する）
- 交配成功時に XP が付与されるか確認する (`entity-update-stage.ts:53`)

---

## §O. 音楽システム（Music）

参照ファイル:
- `packages/game/application/music-manager.ts` — MusicManager
- `packages/app/application/frame/stages/lighting-stage.ts:24-71` — `updateFromContext`
- `packages/app/application/frame/frame-stage-executor.ts:64-91` — `applySettings`

検証項目:
- `MusicManager.updateFromContext({ isNight, playerPosition })` が毎フレーム呼ばれることを `lighting-stage.ts:69-71` で確認する
- 昼間と夜間で異なる BGM が再生されるか（または BGM が切り替わるか）確認する
- `audioEnabled=false` のとき BGM が無音になることを確認する
- `musicVolume` で BGM 音量が変化することを確認する
- プレイヤー位置に応じて環境音楽（洞窟 BGM 等）が変化するか確認する
- §8 の `musicVolume` / `sfxVolume` 分離が正しく機能することを確認する

---

## §K. 釣り (Fishing)

参照ファイル:
- `packages/entity/domain/fishing.ts` — 釣りドメイン
- `packages/entity/domain/fishing.config.ts` — ロットテーブル・待機定数
- `packages/entity/application/fishing-service.ts` — FishingService (cast/tick/cancel/isFishing)
- `packages/app/application/frame/stages/interaction-stage.ts` — cast/cancel ハンドラ
- `packages/app/application/frame/stages/physics-stage.ts:221-229` — tick → catch → inventory 投入

### K-1. 釣りロットテーブル（実装値）

| カテゴリ | 確率 | アイテム（重み） |
|---|---|---|
| fish | 60% | RAW_COD(60), RAW_SALMON(25), TROPICAL_FISH(10), PUFFERFISH(5) |
| treasure | 5% | BOW(20), FISHING_ROD(15), EMERALD(15), DIAMOND(10), GOLD_INGOT(20), IRON_INGOT(20) |
| junk | 35% | BONE(30), STRING(25), STICKS(20), LEATHER(15), COAL(10) |
| 待機時間 | 5〜30 s | `FISHING_MIN_WAIT_SECS=5`, `FISHING_MAX_WAIT_SECS=30` |

参照: `packages/entity/domain/fishing.config.ts`

### K-2. 釣り検証項目

- FISHING_ROD をホットバーに持ち**右クリック**でキャスト（cast）が開始することを確認する
- キャスト済みの状態で再度右クリックするとキャンセルされることを確認する (`interaction-stage.ts:957` テスト参照)
- `fishingService.isFishing()` が cast 中 true を返すことを確認する
- キャスト後 5〜30 秒でバイトが発生することを確認する (`FISHING_MIN/MAX_WAIT_SECS`)
- バイト時に caught アイテムがインベントリに追加されることを確認する (`physics-stage.ts:226-229`)
- 釣れるアイテムが fish(60%) / treasure(5%) / junk(35%) の確率分布に従うことを確認する
- 死亡時に進行中の釣りがキャンセルされることを確認する (`physics-stage.ts:148-150`)
- 水のない場所でキャストしても魚が釣れない処理が実装されているか確認する
- 釣り中に視覚的なボブ（浮き）が表示されるか確認する

---

## §L. ゲームモード

参照ファイル:
- `packages/core/domain/game-mode.ts` — GameModeSchema（`survival/creative/spectator`）
- `packages/entity/domain/flight.ts` — クリエイティブフライト
- `packages/entity/domain/key-mappings.ts:17` — `TOGGLE_FLIGHT = 'KeyF'`
- `packages/app/application/frame/stages/physics-stage.ts:140-163` — 死亡・クリエイティブ分岐

### L-1. ゲームモード定数

| モード | DEFAULT? | 概要 |
|---|---|---|
| survival | DEFAULT_GAME_MODE | 空腹・ダメージあり、死亡→死亡画面 |
| creative | — | 即時リスポーン・フライト可能・ダメージなし？ |
| spectator | — | noclip・衝突なし・ダメージなし (`game-mode.ts:3` コメント) |

参照: `packages/core/domain/game-mode.ts:5-7`

### L-2. サバイバルモード

- `DEFAULT_GAME_MODE = 'survival'` を `game-mode.ts:7` で確認する
- サバイバルでは空腹・ダメージが有効であることを確認する
- 死亡時に XP がリセット (`xpService.reset()`) されることを `physics-stage.ts:145` で確認する
- 死亡時に防具がリセット (`equipmentService.reset()`) されることを確認する
- セーブ/ロード後もゲームモードが保持されることを `session-save.ts:45` で確認する

### L-3. クリエイティブモード

- **死亡時に即時リスポーン**（死亡画面なし）することを `physics-stage.ts:151-157` で確認する
- **F キー（TOGGLE_FLIGHT）でフライト ON/OFF** できることを `key-mappings.ts:17`, `flight.ts:28-30` で確認する
- フライト中に Space で上昇、Shift で下降することを `flight.ts` で確認する
- フライトがクリエイティブモード以外で使えないことを `nextFlightState(current, isCreative, toggle)` で確認する
- サバイバルに切り替えるとフライトが強制解除されることを `flight.ts:24-25` コメントで確認する
- クリエイティブモードで hunger ドレインがない（またはあっても効果なし）か確認する (`physics-stage.ts:163` の `inCreative` チェック)
- **クリエイティブモードで落下ダメージが無効か確認する**（実装コードに`!inCreative`ガードが存在するか `physics-stage.ts` を確認。未実装の場合は既知差分として記録）
- **クリエイティブモードでブロックを左クリックすると即座に破壊できるか確認する**（`interaction-stage.ts` が `GameModeService.isCreative()` を渡し、`interaction-break-handler.ts` が採掘時間・収穫可否・ドロップ・耐久消費をスキップする）
- クリエイティブモードでインベントリが無限か確認する（公式は creative inventory が別 UI）

### L-4. スペクテーターモード

- スペクテーターで衝突判定がない（noclip）か確認する（`game-mode.ts:3` コメント）
- スペクテーターでダメージを受けないか確認する
- スペクテーターで Mob と戦闘できないか確認する (`interaction-stage.ts:106` isSpectator チェック)

### L-5. ゲームモード切替

- ゲームモードをワールド作成時に指定できるか確認する
- セッション中にゲームモードを切り替える UI/コマンドが存在するか確認する
- 切替後の挙動（フライト解除、空腹再開等）を確認する

---

## §P. グラフィックス設定・品質プリセット

参照ファイル:
- `packages/game/application/settings-service.config.ts:27` — `GRAPHICS_PRESETS`
- `packages/game/application/settings.schema.ts` — `SettingsSchema` 各フィールド
- `packages/app/application/frame-handler.config.ts` — `ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD`

### P-1. グラフィックス品質プリセット（実装値）

| 設定 | low | medium | high | ultra | 参照 |
|---|---|---|---|---|---|
| shadowsEnabled | false | true | true | true | `settings-service.config.ts` |
| ssaoEnabled | false | false | true | true | `settings-service.config.ts` |
| bloomEnabled | false | false | true | true | `settings-service.config.ts` |
| godRaysEnabled | false | false | true | true | `settings-service.config.ts` |
| godRaysSamples | 0 | 0 | 25 | 40 | `settings-service.config.ts` |
| bloomStrength | 0 | 0 | 0.25 | 0.3 | `settings-service.config.ts` |
| pixelRatioCap | 0.75 | 1.0 | 1.25 | 2.0 | `settings-service.config.ts` |
| composerRtType | 1009 (UByte) | 1009 (UByte) | 1016 (HalfFloat) | 1016 (HalfFloat) | `settings-service.config.ts` |
| refractionThrottleFrames | 0 | 0 | 2 | 1 | `settings-service.config.ts` |

### P-2. グラフィックス設定検証項目

- 4つの品質プリセット（low/medium/high/ultra）をそれぞれ適用して映像品質が変化することを確認する
- `low` で影・SSAO・Bloom・GodRays がすべて OFF になることを確認する
- `ultra` で影・SSAO・Bloom・GodRays がすべて ON になることを確認する
- `pixelRatioCap=0.75`（low）で画面解像度が低下することを確認する
- `pixelRatioCap=2.0`（ultra）で高解像度レンダリングになることを確認する
- `composerRtType=1016`（HalfFloat）が high/ultra のみで使われることを確認する（Bloom に HDR が必要）
- renderDistance スライダーを変更すると表示チャンク数が変わることを確認する（範囲: 2〜16）
- 設定変更後に**リアルタイムで**描画に反映されるか確認する（再起動不要か）
- ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD=50 以下で画質が自動降格されるか確認する (`frame-handler.config.ts:67`)
- 各設定のトグル（shadowsEnabled/ssaoEnabled 等）を個別に ON/OFF できるか確認する
- mouseSensitivity スライダーが 0.1〜3.0 の範囲で機能することを確認する
- dayLengthSeconds スライダーが 120〜1200 秒の範囲で機能することを確認する

---

## §Q. 非機能要件（パフォーマンス・安定性・互換性）

### Q-1. フレームレート・レンダリング性能

- **medium 設定 + renderDistance=6 で 30 FPS 以上**を維持することを確認する
- **low 設定 + renderDistance=4 で 60 FPS 以上**を維持することを確認する
- **ultra 設定 + renderDistance=12 でもクラッシュしない**ことを確認する
- チャンクロード中（移動時）のフレームドロップが 0.5 秒以内に収まることを確認する
- Mob 24 体存在してもフレームレートが著しく低下しないことを確認する
- 長時間プレイ（30分）でメモリリークによる FPS 低下がないことを確認する
- `MAX_DIRTY_CHUNK_UPDATES_PER_FRAME` の計算が `DEFAULT_TARGET_FPS` に基づくことを `frame-budget.ts` で確認する

### Q-2. メモリ・ブラウザ安定性

- Chrome 最新版で IndexedDB へのセーブ/ロードが動作することを確認する
- Firefox 最新版で同様に動作することを確認する
- ブラウザタブのメモリ使用量が 30 分プレイ後に 2 GB を超えないことを確認する（目安）
- ブラウザタブを非アクティブにした後に復帰してゲームが継続できることを確認する
- `deltaTime クランプ max=0.05s` によりタブ非アクティブ後の物理暴走が防止されることを確認する
- 5 分間プレイしてブラウザコンソールに繰り返しエラーが出ないことを確認する

### Q-3. ロード時間

- 新規ワールド生成完了まで 10 秒以内であることを確認する（目安）
- 既存ワールドロードが 5 秒以内であることを確認する（目安）
- 初期チャンクが描画されるまでローディング表示があるか確認する
- プレイヤーが見えない位置のチャンクが非同期ロードされることを確認する

### Q-4. WebGL / レンダラー互換性

- WebGL2 が利用できないブラウザでの挙動を確認する（エラーメッセージ等）
- モバイルブラウザ（iOS Safari / Android Chrome）での動作を確認する（対応/非対応）
- ウィンドウリサイズ時にキャンバスが正しくリサイズされることを確認する
- 全画面表示（F11 相当）でゲームが正常動作することを確認する

### Q-5. アクセシビリティ・操作性（ブラウザ固有）

- ブラウザのズーム機能（Ctrl+/Ctrl-）を使用してもゲームがレイアウト崩れしないことを確認する
- ブラウザの「戻る」ボタンを誤押しした場合の挙動を確認する（セーブデータは保護されるか）
- キーボードショートカット（Ctrl+W でタブを閉じる等）の誤操作を防ぐ対策があるか確認する

---

## §R. アセット（テクスチャ・音声・BGM）

### R-1. テクスチャアトラス

参照ファイル:
- `packages/rendering/infrastructure/textures/block-texture-map.config.ts` — `TILE_MAP`
- `packages/rendering/infrastructure/textures/item-texture-map.config.ts` — `ITEM_TILE_MAP`
- `/textures/atlas.png` — 実際のテクスチャアトラス画像ファイル（公開 URL: Vite static asset）

検証項目:
- `/textures/atlas.png` が存在し、ブラウザでロードに成功するか確認する
- `TILE_MAP` が全 BlockType（`block-type.ts` の全 literal）を網羅しているか確認する（欠落があれば §12 に記録）
- `ITEM_TILE_MAP` が全 InventoryItem（`item-type.ts` の全 literal）を網羅しているか確認する
- 各ブロックのテクスチャが公式 Minecraft のテクスチャと類似しているか目視確認する
- テクスチャアトラスの解像度を確認する（16×16 の 1 タイル？64×64？128×128 アトラス全体？）
- ブロックの上面・側面・下面で異なるテクスチャが使われているか確認する（例: GRASS は上面が緑、側面が土肌）
- 半透明テクスチャ（GLASS/LEAVES/WATER）が正しく alpha チャネルを持つか確認する
- ITEM_TILE_MAP の食料・ツール・防具アイコンが正しく描画されるか確認する

### R-2. サウンドエフェクト（Web Audio 合成）

参照ファイル: `packages/game/application/sound-manager.config.ts`

> **重要な差分**: 本実装のサウンドはすべて **Web Audio API のオシレーター合成**（正弦波/方形波/三角波/ノコギリ波）であり、公式 Minecraft の録音サウンドファイル（.ogg）は一切使用していない。

| サウンド名 | 波形 | 周波数 | 長さ |
|---|---|---|---|
| blockBreak | square | 220 Hz | 70 ms |
| blockPlace | triangle | 320 Hz | 50 ms |
| playerHurt | sawtooth | 140 Hz | 120 ms |
| entityHit | square | 280 Hz | 90 ms |
| mobHurt | sawtooth | 200 Hz | 110 ms |
| mobDeath | sawtooth | 90 Hz | 220 ms |
| enchant | triangle | 660 Hz | 200 ms |

検証項目:
- `sound-manager.config.ts` の全サウンドエフェクト定義を確認し、上表と照合する
- AudioContext が正常に初期化されるか確認する（ブラウザのオートプレイ制限の対応確認）
- ブロック破壊・設置・被弾・エンティティヒット・Mob 被弾・Mob 死亡の各音が実際に鳴るか確認する
- `audioEnabled=false` 設定で全サウンドが無音になるか確認する
- `sfxVolume` スライダーで SE 音量が変化するか確認する
- Web Audio API が利用できないブラウザでのフォールバック動作を確認する

### R-3. BGM（Web Audio 合成）

参照ファイル: `packages/game/application/music-manager.config.ts`

> **重要な差分**: BGM も Web Audio API のオシレーター合成。公式 Minecraft の C418 BGM（.ogg）は使用していない。

| BGM コンテキスト | 波形 | 周波数 | ゲイン |
|---|---|---|---|
| day | sine | 174.61 Hz | 0.28 |
| night | triangle | 130.81 Hz | 0.24 |
| cave | sawtooth | 98.0 Hz | 0.20 |

検証項目:
- 昼間に `day` コンテキスト（174.61 Hz, sine）の BGM が再生されるか確認する
- 夜間に `night` コンテキスト（130.81 Hz, triangle）の BGM が再生されるか確認する
- 地下（洞窟内）に `cave` コンテキスト（98.0 Hz, sawtooth）の BGM が再生されるか確認する
- BGM がループするか、または一定周期で再生されるか確認する
- `musicVolume` スライダーで BGM 音量が変化するか確認する
- `audioEnabled=false` で BGM も無音になるか確認する

---

## §S. エンチャント

参照ファイル: `packages/inventory/domain/enchantment.config.ts`, `packages/app/application/frame/stages/interaction-placement-handler.ts:239`

> **重要な差分**: 公式 Minecraft のエンチャントテーブルは「3 択ランダム + ラピスラズリ消費 + XP 消費」UIだが、本実装は **ENCHANTING_TABLE を右クリック → 即時決定論的エンチャント（XP レベルで強度決定）**。ラピスラズリ消費・UI テーブルなし。

### S-1. エンチャント種別・最大レベル（実装値）

| エンチャント | 最大 Lv | 対象 |
|---|---|---|
| SHARPNESS | 5 | 全剣・全斧 |
| SMITE | 5 | 全剣 |
| BANE_OF_ARTHROPODS | 5 | 全剣 |
| KNOCKBACK | 2 | 全剣 |
| PROTECTION | 4 | 全防具 |
| PROJECTILE_PROTECTION | 4 | 全防具 |
| FIRE_PROTECTION | 4 | 全防具 |
| BLAST_PROTECTION | 4 | 全防具 |
| FEATHER_FALLING | 4 | ブーツ |
| RESPIRATION | 3 | ヘルメット |
| EFFICIENCY | 5 | ツルハシ・シャベル・斧・クワ |
| FORTUNE | 3 | ツルハシ・シャベル |
| SILK_TOUCH | 1 | ツルハシ・シャベル・斧 |
| UNBREAKING | 3 | 全ツール・全防具・BOW・FISHING_ROD・SHIELD |
| LOOTING | 3 | 全剣 |
| INFINITY | 1 | BOW |
| POWER | 5 | BOW |
| PUNCH | 2 | BOW |
| LURE | 3 | FISHING_ROD |
| LUCK_OF_THE_SEA | 3 | FISHING_ROD |

Fortune 倍率: Lv1=1.33×、Lv2=1.75×、Lv3=2.5×（`enchantment.config.ts:31`）

XP スケール: 最大レベル = `floor(xpLevel / 5)`、上限はエンチャント最大レベル（`enchantment.ts:133`）

> **実装済みエンチャント（追加確認済み）**
> - AQUA_AFFINITY: ヘルメット用。水中採掘速度ペナルティを解除（`interaction-break-handler.ts`）
> - DEPTH_STRIDER: ブーツ用。水中で横方向速度の減衰をレベルに応じて軽減（Lv3 で横方向減衰なし）
> - BLAST_PROTECTION: 防具用。TNT/クリーパー爆発ダメージを軽減（`equipment-service.ts`, `physics-stage.ts`, `interaction-placement-handler.ts`）
> - PROJECTILE_PROTECTION: 防具用。敵の飛び道具ダメージを軽減（`equipment-service.ts`, `physics-stage.ts`）
> - MENDING: 耐久値付きアイテム用。XP 取得時にインベントリ・装備中の MENDING アイテムを 1 XP = 耐久 2 で修理し、余った XP のみ通常加算（`item-stack.ts`, `inventory-service.ts`, `equipment-service.ts`, `xp-mending.ts`）
>
> **未実装エンチャント（公式 1.21 に存在するが本実装になし）**
> - CURSE_OF_BINDING / CURSE_OF_VANISHING: カーセ系（スコープ外）
>
> **定義済みだが実際に効果が適用されない可能性があるエンチャント**
> - FIRE_PROTECTION / BLAST_PROTECTION / PROJECTILE_PROTECTION はダメージ経路への適用を確認済み

### S-2. エンチャント検証項目

- ENCHANTING_TABLE ブロックが `block-type.ts:60` に定義されているか確認する
- ENCHANTING_TABLE を右クリックするとエンチャントが即時適用されるか確認する（ラピスラズリ・UI テーブル不要）
- XP レベル 0 では `selectEnchantment` が `Option.none()` を返すか確認する（エンチャント失敗）
- XP レベルが高いほど強いエンチャントレベルが付与されるか確認する
- エンチャント後に `enchantXPCost(level)` 分の XP が消費されるか確認する
- `canEnchantItem(item, enchantment)` が item に不適切なエンチャントを拒否するか確認する
- SILK_TOUCH 付きで鉱石を掘ると石炭岩・鉄鉱石そのものがドロップするか確認する（`block-service.ts:121-122`）
- FORTUNE 付きで鉱石を掘ると倍率に従い増量ドロップするか確認する（Lv3 で最大 2.5×）
- FORTUNE と SILK_TOUCH が相互排他か確認する（`interaction-break-handler.ts:90`）
- EFFICIENCY でブロック採掘速度が `level² + 1` 分追加されるか確認する（`break-speed.ts:36`）
- LOOTING 付き剣で Mob ドロップ数が増加するか確認する（`interaction-melee-handler.ts:117`）
- FEATHER_FALLING が落下ダメージを軽減するか確認する
- INFINITY 付き弓が矢を消費しないか確認する
- POWER 付き弓が通常より高いダメージを与えるか確認する
- KNOCKBACK 付き剣がノックバック距離を増加するか確認する
- エンチャント済みアイテムが保存・ロード後も enchantments フィールドを保持するか確認する
- 公式との差分（即時決定論的・UI なし・ラピスラズリ不要）を文書化する

---

## §T. 村・村人トレーディング

参照ファイル: `packages/app/application/frame-handler.config.ts:11-16`, `packages/app/application/frame/stages/input-stage.ts`

### T-1. 村トレード定数（実装値）

| 定数 | 値 | 確認ファイル |
|---|---|---|
| TRADE_OPEN_KEY | `'KeyT'` | `frame-handler.config.ts:13` |
| TRADE_NEXT_KEY | `'ArrowDown'` | `frame-handler.config.ts:14` |
| TRADE_PREV_KEY | `'ArrowUp'` | `frame-handler.config.ts:15` |
| TRADE_EXECUTE_KEY | `'Enter'` | `frame-handler.config.ts:16` |
| TRADE_DISTANCE | `4` ブロック | `frame-handler.config.ts:11` |

### T-2. 村トレード検証項目

- 村が地形生成時に自動スポーンするか確認する（`simulation.village` デバッグフラグ）
- 村人エンティティが村内に存在するか確認する
- プレイヤーが TRADE_DISTANCE=4 以内で T キーを押すと取引 UI が開くか確認する
- `villageService.findNearestVillager(playerPos, 4)` が最寄り村人を返すか確認する
- `tradingPresentation.open(villager.villagerId)` が UI を描画するか確認する
- 取引リストが ArrowDown/ArrowUp で選択できるか確認する
- Enter キーで選択した取引が実行されるか確認する
- EMERALD がトレード通貨として使われているか確認する
- 取引後にプレイヤーインベントリが正しく変化するか確認する（素材消費 + 商品受取）
- 4 ブロック以上離れると取引 UI が閉じるか確認する
- 村人の職業別取引リストが定義されているか確認する（農民/鍛冶屋/司書 等）
- 取引回数制限・在庫切れ表示が実装されているか確認する

---

## §U. F3 デバッグオーバーレイ

参照ファイル: `packages/presentation/hud/debug-overlay.ts`, `packages/app/application/main/session-runtime.ts:196`

> 公式 Minecraft の F3 デバッグ画面に相当。F3 キーでトグル（デフォルト非表示）。DOM 更新間隔: `DOM_UPDATE_INTERVAL_MS`。

### U-1. デバッグオーバーレイ表示項目（実装値）

| 順番 | 表示内容 | データソース |
|---|---|---|
| 1 | XYZ 座標（小数 1 桁）| `gameState.getPlayerPosition` |
| 2 | 向き（方角名 + 軸）| `cameraState.getRotation` → `facingFromYaw(yaw)` |
| 3 | バイオーム名 | `biomeService.getBiome(x, z)` |
| 4 | FPS（小数 1 桁）| `fpsCounter.getFPS()` |
| 5 | ロード済みチャンク数 | `chunkManager.getLoadedChunks().length` |
| 6 | 時刻（小数 3 桁、0-1）| `timeService.getTimeOfDay()` |

### U-2. デバッグオーバーレイ検証項目

- F3 キーを押すとオーバーレイが表示されるか確認する（デフォルト非表示）
- F3 キー再押下で非表示になるか確認する（トグル動作）
- XYZ 座標がプレイヤー移動に追従してリアルタイム更新されるか確認する
- 向きが正しい方角（North/South/East/West）と軸で表示されるか確認する
- バイオーム名が現在地と一致するか確認する
- FPS 値が実際のフレームレートと近い値か確認する
- ロード済みチャンク数が `renderDistance²` 程度になるか確認する
- 時刻が 0.0（夜明け）→ 0.5（正午）→ 1.0（夜）の範囲で変化するか確認する
- デバッグオーバーレイが他の HUD に重ならず視認できるか確認する
- F3 パネル内でデバッグフラグのトグルが機能するか確認する（§V）
- `document` が存在しない SSR 環境でクラッシュしないか確認する（`hasDom` フラグ分岐）

---

## §V. デバッグフラグ（開発者機能）

参照ファイル: `packages/app/application/debug-feature-flags.config.ts`

> F3 オーバーレイ内のトグルパネルで全フラグがランタイム切替可能。デフォルトは全 `true`。

### V-1. デバッグフラグ一覧（実装値・デフォルト全 true）

| フラグ ID | グループ | 説明 | バッジ |
|---|---|---|---|
| `rendering.postProcessing` | rendering | 後処理コンポーザーパイプライン | reload, perf |
| `rendering.shadows` | rendering | 太陽シャドウ描画 | perf |
| `rendering.sky` | rendering | 動的スカイドーム描画 | perf |
| `particles.update` | particles | パーティクルライフタイム更新 | perf |
| `particles.spawn` | particles | ブロック破壊パーティクル生成 | perf |
| `mobs.enabled` | mobs | Mob マスタースイッチ（全 Mob 停止）| danger |
| `mobs.spawn` | mobs | 環境 Mob スポーン | danger |
| `mobs.ai` | mobs | Mob AI・フレーム更新 | danger, perf |
| `mobs.physics` | mobs | Mob 物理・衝突解決 | danger, perf |
| `mobs.render` | mobs | Mob シーン同期・描画 | perf |
| `mobs.damage` | mobs | 敵 Mob 接触ダメージ | danger |
| `simulation.redstone` | simulation | レッドストーン固定ステップ更新 | perf |
| `simulation.fluid` | simulation | 流体固定ステップ更新 | perf |
| `simulation.furnace` | simulation | かまど進行度更新 | perf |
| `simulation.village` | simulation | 村人・村メンテナンス更新 | perf |
| `ui.fps` | ui | HUD FPS テキスト表示 | — |
| `ui.hotbar` | ui | ホットバー HUD 描画 | — |
| `ui.blockHighlight` | ui | ターゲットブロックハイライト | — |
| `world.chunkStreaming` | world | チャンクロード/アンロード | perf |
| `world.chunkSceneSync` | world | チャンクの Three.js シーン同期 | perf |
| `world.dirtyChunkFlush` | world | ダーティチャンクメッシュ更新 | perf |

### V-2. デバッグフラグ検証項目

- F3 パネルで各フラグがトグル可能か確認する
- `mobs.enabled=false` で Mob のスポーン・AI・描画・ダメージが全て停止するか確認する
- `rendering.postProcessing=false` で後処理なしの素のレンダリングになるか確認する
- `particles.spawn=false` でブロック破壊パーティクルが発生しなくなるか確認する
- `ui.fps=false` で FPS テキストが非表示になるか確認する
- `ui.blockHighlight=false` でブロックハイライトが消えるか確認する
- `simulation.village=false` で村人 AI が停止するか確認する
- `simulation.fluid=false` で水・溶岩の流れが停止するか確認する
- `world.chunkStreaming=false` でプレイヤーが移動してもチャンクが更新されないか確認する
- `mobs.damage=false` で敵 Mob に触れても体力が減らないか確認する（安全テスト用）
- `danger` バッジ付きフラグをオフにした後、再度オンにしてゲームが正常動作するか確認する
- フラグ状態がページリロードでデフォルト値（全 `true`）にリセットされるか確認する（IndexedDB 非保存）

---

## §W. マルチプレイヤー (Multiplayer)

参照ファイル:
- `packages/app/application/multiplayer/multiplayer-service.ts` — MultiplayerService 実装
- `packages/app/application/frame/stages/multiplayer-stage.ts` — フレームループでの位置/ブロック同期
- `packages/rendering/infrastructure/player/remote-player-renderer.ts` — リモートプレイヤー描画

> WebSocket ベース。公式とは異なりブラウザ版独自実装（UDP/Java プロトコル非対応）。
> ゲーム内サーバー接続 UI は未実装 — 接続は外部 API 呼び出しのみ。

### W-1. マルチプレイヤー定数（実装値）

| 定数/設定 | 値 | 参照 |
|---|---|---|
| MAX_CHAT_ENTRIES | 50 | `multiplayer-service.ts:61` |
| worldId (固定) | `'overworld'` | `multiplayer-service.ts:9` |
| リモートプレイヤー描画高さ | 1.8 ブロック | `remote-player-renderer.ts:34` |
| ネームタグ Y 座標 | 2.15 | `remote-player-renderer.ts:35` |
| 接続方式 | WebSocket | `multiplayer-service.ts:172` |

### W-2. マルチプレイヤー機能一覧（実装済み）

| 機能 | メソッド/フィールド | 参照 |
|---|---|---|
| 接続 | `connect(serverUrl, playerName)` | `multiplayer-service.ts:172` |
| 切断 | `disconnect` | `multiplayer-service.ts:183` |
| 接続状態取得 | `getConnectionState()` → `'disconnected'|'connecting'|'connected'` | `multiplayer-service.ts:188` |
| 位置・回転送信 | `sendPositionUpdate(pos, rot)` | `multiplayer-service.ts:207` |
| ブロック設置送信 | `sendBlockPlace(pos, blockType)` | `multiplayer-service.ts:217` |
| ブロック破壊送信 | `sendBlockBreak(pos)` | `multiplayer-service.ts:227` |
| 受信ブロック編集適用 | `drainBlockEdits` | `multiplayer-service.ts:236` |
| チャット送信 | `sendChat(text)` | `multiplayer-service.ts:197` |
| チャット受信 | `getChatMessages()` → `ChatEntry[]` | `multiplayer-service.ts:195` |
| リモートプレイヤー一覧 | `getRemotePlayers()` → `Map<id, RemotePlayerSnapshot>` | `multiplayer-service.ts:193` |

受信イベント種別: `BlockPlace`, `BlockBreak`, `PlayerJoin`, `PlayerLeave`, `PlayerMove`, `Chat`

### W-3. リモートプレイヤー描画

リモートプレイヤーはボックスジオメトリで近似描画される（公式スキン非対応）:
- 胴体: `0.5×0.75×0.25` 青色ボックス（`0x2f66d0`）
- 頭部: `0.45×0.45×0.45` 肌色ボックス（`0xd8b08a`）
- 四肢: ピボット付きボックス（左右腕/左右脚）、walk-cycle スイングあり
- ネームタグ: Canvas ベースの 256×64 スプライト（白文字）

### W-4. マルチプレイヤー検証項目

- `MultiplayerService.connect('ws://サーバーURL', 'PlayerName')` を Dev Console から呼び出して接続できるか確認する
- `getConnectionState()` が接続後 `'connected'` を返すか確認する
- ブロックを設置・破壊したとき `sendBlockPlace` / `sendBlockBreak` がサーバーに送信されるか確認する
- 別クライアントがブロックを編集したとき `drainBlockEdits` でローカルに反映されるか確認する（`multiplayer-stage.ts`）
- プレイヤー移動ごとに `sendPositionUpdate` がサーバーに送信されるか確認する（`multiplayer-stage.ts`）
- 別クライアントがログインしたとき `getRemotePlayers()` にエントリが追加されるか確認する
- リモートプレイヤーのボックスモデルとネームタグが Three.js シーンに表示されるか確認する
- リモートプレイヤーの移動が `updateFromSnapshot` で毎フレーム反映されるか確認する
- 別クライアントがログアウトしたとき `removePlayer` で Three.js シーンから削除・GPU メモリ解放されるか確認する
- `getChatMessages()` がサーバーから受信したチャットメッセージ（最大 50 件）を保持するか確認する
- チャットが DOM に表示されないこと（§12 #48）を確認する（サービスに実装あり、UI なし）
- `disconnect()` 後に再接続できるか確認する（ドレインファイバーが正しく停止・再起動するか）
- `worldId='overworld'` が固定であることを確認する（ネザー接続未対応）
- ゲーム内に「サーバーへ接続」UI が存在しないことを確認する（§12 #50）

---

## §12. 既知の差分・未実装（確認前に記録済み）

> 調査モデルは実際のコードと動作で最新状態を確認し、各行に「OK / NG / 差分詳細」を追記すること。

| # | 項目 | 想定差分 | 確認先ファイル |
|---|---|---|---|
| 1 | CHEST | ブロック定義・保存ID・クラフト・描画に加えて、通常チェストの 27 スロット収納 UI・ブロック座標ごとの永続コンテナ状態を実装済み | `packages/core/domain/block-type.ts`, `packages/core/domain/block-codec.ts`, `packages/inventory/application/chest-service.ts`, `packages/presentation/inventory/inventory-renderer.ts` |
| 2 | DOOR | DOOR / DOOR_OPEN はブロック定義・保存ID・クラフト・縦2マス設置・右クリック上下同期開閉・上下同時破壊が実装済み。ヒンジ向き、薄い形状、IRON_DOOR は未実装 | `packages/core/domain/block-type.ts`, `packages/core/domain/block-codec.ts`, `packages/world/application/block-service.ts`, `packages/app/application/frame/stages/interaction-placement-handler.ts` |
| 3 | RAW_PORKCHOP | 実装済み: item-type 定義、Pig RAW_PORKCHOP×1、食料、RAW_PORKCHOP→COOKED_PORKCHOP 精錬 | `packages/core/domain/item-type.ts`, `packages/entity/domain/mob/mobs/pig.ts`, `packages/entity/domain/food.config.ts`, `packages/inventory/application/recipes/misc-recipes.ts` |
| 4 | RAW_MUTTON | 実装済み: item-type 定義、Sheep RAW_MUTTON×1、食料、RAW_MUTTON→COOKED_MUTTON 精錬 | `packages/core/domain/item-type.ts`, `packages/entity/domain/mob/mobs/sheep.ts`, `packages/entity/domain/food.config.ts`, `packages/inventory/application/recipes/misc-recipes.ts` |
| 5 | SNOWBALL | 実装済み: item-type 定義、SNOW→SNOWBALL×4 ドロップ | `packages/core/domain/item-type.ts`, `packages/world/application/block-service.config.ts` |
| 6 | FEATHER | 実装済み: item-type 定義、ARROW レシピ材料 | `packages/core/domain/item-type.ts`, `packages/inventory/application/recipes/misc-recipes.ts` |
| 7 | Spider SPIDER_EYE | 常にドロップ（公式は 33%）| `packages/entity/domain/mob/mobs/spider.ts` |
| 8 | Skeleton BONE/ARROW | 常にドロップ（公式は 0-2）| `packages/entity/domain/mob/mobs/skeleton.ts` |
| 9 | Zombie flee | HP 10% 以下で逃げる（公式は逃げない）| `packages/entity/domain/mob/mobs/zombie.ts` |
| 10 | Skeleton attackDamage | 2（公式の矢は 3-5）| `packages/entity/domain/mob/mobs/skeleton.ts` |
| 11 | Creeper 爆発 | `explosion.ts` に domain あり。実際の発動を確認 | `packages/entity/domain/explosion.ts` |
| 12 | PLAYER_ATTACK_REACH | 3.5（公式 4.5）| `packages/app/application/frame-handler.config.ts:55` |
| 13 | CHUNK_HEIGHT | 256（公式 384、負Y未対応）| `packages/core/domain/chunk-coords.ts:10` |
| 14 | 洞窟生成 | **実装済み**（`cave-carver.ts` で 3D ノイズ三線形補間）。Y=5〜80 に生成。Y≤10 は溶岩 | `packages/world/domain/terrain/cave-carver.ts` |
| 15 | ブロック採掘時間 | 即時採掘の可能性（公式は時間がかかる）| `interaction-stage.ts` |
| 16 | マウスホイールホットバー | **実装済み** — `hotbar-service.ts:67-69` の `consumeWheelDelta()` でスロット切替。この行は誤り | `packages/inventory/application/hotbar-service.ts:67` |
| 17 | 金防具レシピ | **実装済み** — `GOLD_HELMET`/`GOLD_CHESTPLATE`/`GOLD_LEGGINGS`/`GOLD_BOOTS` の item type、装備値、耐久値、エンチャント対象、GOLD_INGOT レシピを追加 | `packages/inventory/application/recipes/armor-recipes.ts` |
| 18 | 状態効果 | Nausea/Absorption/Regeneration 等の実装有無 | 全体 |
| 19 | SEA_LEVEL 誤記 | MEMORY.md に 48/62 とあるが正しくは 63（`constants.ts:17`）| `packages/core/domain/constants.ts:17` |
| 20 | 金ツール耐久値 | **確認済み** — GOLD_SWORD/PICKAXE/SHOVEL/HOE/AXE はすべて 32。網羅テストも GOLD tier を対象化 | `packages/inventory/domain/durability.ts` |
| 21 | ARROW レシピ材料 | 実装済み: FLINT×1+STICKS×1+FEATHER×1 → ARROW×4 | `packages/inventory/application/recipes/misc-recipes.ts` |
| 22 | mineral block レシピ | 素材×9→ブロック および 逆クラフトのレシピ有無 | `packages/inventory/application/recipes/` |
| 23 | Q キー（アイテムドロップ入力）| **実装済み** — `DROP_ITEM='KeyQ'` を定義し、ゲームプレイ中の Q で選択ホットバーのアイテムを 1 個消費する。地面に浮く item entity は §12 #280 の残課題 | `packages/entity/domain/key-mappings.ts`, `packages/app/application/frame/stages/input-stage.ts` |
| 24 | クリエイティブ即時採掘 | **実装済み** — クリエイティブ中の左クリックは即時破壊し、`breakBlock(..., { requireHarvest: false, dropItems: false })` で収穫可否・ドロップをバイパス。XP・追加ドロップ・耐久消費もスキップ | `packages/app/application/frame/stages/interaction-stage.ts`, `packages/app/application/frame/stages/interaction-break-handler.ts`, `packages/world/application/block-service.ts` |
| 25 | クリエイティブ落下ダメージ無効 | クリエイティブでの落下ダメージ無効コードパス未確認 | `packages/app/application/frame/stages/physics-stage.ts` |
| 26 | エンチャント UI | 公式は 3 択ランダム＋ラピスラズリ消費。本実装は即時決定論的エンチャント（XP のみ）| `interaction-placement-handler.ts:239` |
| 27 | DESPAWN_DISTANCE | 64（公式 128）| `packages/entity/domain/spawner-config.ts:4` |
| 28 | 天候サイクル | 固定順序 clear→rain→thunder（公式はランダム長）| `packages/game/application/weather-service.ts` |
| 29 | SHEARS 耐久値 | **実装済み** — 最大耐久 238。羊の毛刈り成功時に選択スロットの SHEARS を 1 消耗し、0 到達で破損 | `packages/inventory/domain/durability.ts`, `packages/app/application/frame/stages/interaction-item-use-handler.ts` |
| 30 | 釣り待ち時間 | 5-30 秒（公式は 5-45 秒）| `packages/entity/domain/fishing.config.ts` |
| 31 | 弓のヒットスキャン | 矢エンティティなし・ヒットスキャン 50 ブロック（公式は弾道矢）| `packages/entity/domain/bow.ts:8` |
| 32 | 繁殖 XP | 固定 4（公式は 1-7 ランダム）| `packages/entity/domain/mob/breeding.ts:11` |
| 33 | IRON_ORE/GOLD_ORE XP | 0（公式は IRON_ORE=0, GOLD_ORE=0 — 一致）| `packages/block/domain/blocks.config.ores.ts` |
| 34 | ネザーでのベッド使用 | 爆発しない（安全に無視する）（公式は爆発）| `interaction-placement-handler.ts:230` |
| 35 | 月フェーズ | **実装済み** — 8 日周期の月フェーズを `TimeService` で算出し、Overworld の夜間に 8 フェーズ生成スプライトを表示。Nether/End では非表示 | `packages/game/application/time-service.ts`, `packages/game/application/day-night-cycle.ts`, `packages/app/application/main/session-lighting.ts` |
| 36 | 無限水源 | **実装済み** — 2 つ以上の水平隣接水源に挟まれ、下方向へ流れ落ちない水流は tick 時に level 0 の水源へ更新される | `packages/world/application/fluid-service.ts`, `packages/world/test/fluid-service-tick.test.ts` |
| 37 | 水中水泳速度 | 専用スイム速度定数未確認（WALK_SPEED と同一の可能性）| `physics-stage.ts` |
| 38 | 精錬 XP fractional | 精錬 XP が小数（0.7 など）= 確率的 XP の実装を確認（vanilla と同方式か）| `furnace-service.config.ts:19` |
| 39 | GRAVEL→FLINT ドロップ | 常にドロップ（公式は 10% 確率）。コメントに「deterministic / replayable」と明記 | `block-service.config.ts:139` |
| 40 | スプリント空腹制限実装済み | `foodLevel ≤ 6` ではスプリント入力を歩行扱いにし、移動速度・歩行/ジャンプ消耗も通常値へフォールバックする | `packages/entity/application/movement-service.ts`, `packages/app/application/frame/stages/physics-stage.ts` |
| 41 | ネザーベッド爆発 | 爆発せず `return false`（安全に無視）。公式は爆発でプレイヤーダメージ | `interaction-placement-handler.ts:230` |
| 42 | 洞窟生成（修正）| **§12 #14 は誤り** — `cave-carver.ts` で実装済み。Y=5〜80 に 3D ノイズで生成される | `cave-carver.ts` |
| 43 | 気泡 HUD 表示 | `🫧` emoji テキスト（公式はピクセルアートスプライト 10 個）。溺死時は `💀 Drowning` テキスト | `physics-stage.ts:315` |
| 44 | ポーズメニュー | Resume/Settings/Save&Quit の 3 択のみ（公式は Advancements/Statistics 等も） | `pause-menu.ts` |
| 45 | 植物ブロック欠如 | TALL_GRASS / FERN は BlockType と基本挙動、通常破壊の WHEAT_SEEDS 1/8 抽選、SHEARS 回収に接続済み。SUGAR_CANE / CACTUS / LILY_PAD も BlockType / codec index 85-87 / 初期ブロック / 支え判定 / 水破壊（SUGAR_CANE・CACTUS）/ 非衝突（SUGAR_CANE・LILY_PAD）/ スポーン面除外 / 仮タイル描画に接続済み。草・水辺植物の自然生成、専用描画は未実装 | `packages/core/domain/block-type.ts`, `packages/world/application/block-support.ts`, `packages/rendering/infrastructure/textures/block-texture-map.config.ts` |
| 46 | 乗り物未実装 | BOAT / MINECART / RAIL は item-type.ts・block-type.ts いずれにも未定義 | `packages/core/domain/item-type.ts` |
| 47 | 雨の視覚エフェクト | 天候が rain/thunder でも降水パーティクル（雨粒・雪片）なし。照明減衰のみ | `lighting-stage.ts:7-19` |
| 48 | チャット UI 未接続 | `getChatMessages()` / `sendChat()` はサービスに実装済みだが DOM 表示なし（ゲーム内チャット非表示） | `multiplayer-service.ts:39,195` |
| 49 | リモートプレイヤー描画 | ボックスジオメトリ＋カラー（0x2f66d0 / 0xd8b08a）の簡易表現。公式スキンなし | `packages/rendering/infrastructure/player/remote-player-renderer.ts` |
| 50 | マルチプレイ接続 UI | `connect(url, name)` は API で呼び出すのみ。ゲーム内サーバー接続 UI は未実装 | `multiplayer-service.ts:34` |
| 51 | 釣り待機時間上限 | FISHING_MAX_WAIT_SECS=30（公式は 45 秒。`§12 #30` 参照）| `packages/entity/domain/fishing.config.ts` |
| 52 | 雨天 Zombie 日光保護 | 雨天時に Zombie の日光ダメージを抑制するか未確認。実装の有無を確認すること | `packages/entity/application/mob/entity-manager-internal.ts` |
| 53 | COBWEB ブロック実装済み | **実装済み** — COBWEB を BlockType / codec index 77 / 初期ブロック / 非固体衝突 / 窒息除外 / スポーン面除外 / STRING ドロップ / 仮タイル描画 / 移動速度低下に接続。専用クモの巣アトラステクスチャと自然生成は未実装 | `packages/core/domain/block-type.ts`, `packages/game/application/game-state-service.ts`, `packages/world/application/block-service.config.ts` |
| 54 | SAPLING ブロック実装済み | **実装済み** — SAPLING を BlockType / codec index 78 / 初期ブロック / 非固体衝突 / 窒息除外 / スポーン面除外 / 支え判定 / 水破壊 / 葉ドロップ / 骨粉での木生成に接続。専用苗木テクスチャと自然成長 tick は未実装 | `packages/core/domain/block-type.ts`, `packages/app/application/frame/stages/interaction-farming-handler.ts` |
| 55 | GLOWSTONE 発光・dust 実装済み | GLOWSTONE は `block-type.ts` / codec / block-item texture map / self-light / `GLOWSTONE_DUST` drop+crafting まで実装済み。ネザー生成は未実装 | `packages/core/domain/block-type.ts`, `packages/core/domain/block-codec.ts`, `packages/block/domain/blocks.config.crafted.ts`, `packages/block/domain/light.ts`, `packages/world/application/block-service.config.ts`, `packages/inventory/application/recipes/misc-recipes.ts`, `packages/rendering/infrastructure/textures/item-texture-map.config.ts` |
| 56 | SLAB / STAIRS 未実装 | 石ハーフブロック（STONE_SLAB）・階段（OAK_STAIRS 等）が未定義。ただし PURPUR_SLAB/STAIRS は End 用に定義済み | `packages/core/domain/block-type.ts` |
| 57 | FLOWER / MUSHROOM ブロック実装済み | **実装済み** — DANDELION/POPPY/BROWN_MUSHROOM/RED_MUSHROOM を BlockType / codec index 79-82 / 初期ブロック / 非固体衝突 / 窒息除外 / スポーン面除外 / 支え判定 / 水破壊 / 自己ドロップ / 仮タイル描画に接続。自然生成、専用クロスモデル、光量制約付きキノコ設置は未実装 | `packages/core/domain/block-type.ts`, `packages/world/application/block-support.ts`, `packages/rendering/infrastructure/textures/block-texture-map.config.ts` |
| 58 | アイテム拾得距離定数なし | `ITEM_PICKUP_DISTANCE` 等の固定定数が見当たらない。実装詳細を `entity-manager.ts` 等で確認すること | `packages/entity/application/` |
| 59 | フェンス / トラップドア未実装、LADDER 簡易実装済み | LADDER は `block-type.ts` / codec / texture map / recipe に追加し、通過可能・非窒息ブロックとして扱う。JUMP/SNEAK による上昇/下降の速度制御は実装済み。壁面付着、薄い当たり判定は未実装。FENCE/GATE/TRAPDOOR は未定義。DOOR は縦2マスの木製ドアとして実装済み（§12 #2 参照）| `packages/core/domain/block-type.ts`, `packages/game/domain/block-collision-predicates.ts`, `packages/entity/domain/environment-hazard.ts`, `packages/inventory/application/recipes/misc-recipes.ts` |
| 60 | AQUA_AFFINITY 実装済み | **実装済み** — `EnchantmentType` / 最大 Lv1 / ヘルメット適用に追加し、水中採掘時の 5x ペナルティを AQUA_AFFINITY 付きヘルメットで解除。水中判定は `interaction-stage.ts` から採掘 handler に渡す | `packages/inventory/domain/enchantment.types.ts`, `packages/inventory/domain/enchantment.config.ts`, `packages/app/application/frame/stages/interaction-break-handler.ts`, `packages/app/application/frame/stages/interaction-stage.ts` |
| 61 | DEPTH_STRIDER 実装済み | **実装済み** — `EnchantmentType` / 最大 Lv3 / ブーツ適用に追加し、水中の横方向速度減衰をレベルに応じて軽減。Lv3 では横方向減衰なし | `packages/inventory/domain/enchantment.types.ts`, `packages/inventory/domain/enchantment.config.ts`, `packages/game/application/game-state-physics.ts`, `packages/game/application/game-state-service.ts`, `packages/app/application/frame/stages/physics-stage.ts` |
| 62 | MENDING 実装済み | `enchantment.config.ts` に MENDING を定義。XP 取得時にインベントリ・装備中の MENDING 耐久アイテムを 1 XP = 耐久 2 で修理し、余った XP を通常加算 | `packages/inventory/domain/enchantment.config.ts`, `packages/inventory/domain/item-stack.ts`, `packages/app/application/frame/stages/xp-mending.ts` |
| 63 | BLAST_PROTECTION 実装済み | **実装済み** — 防具の BLAST_PROTECTION を合算し、TNT/クリーパー爆発ダメージに適用。合算上限は 64% | `packages/inventory/application/equipment-service.ts`, `packages/app/application/frame/stages/physics-stage.ts`, `packages/app/application/frame/stages/interaction-placement-handler.ts` |
| 64 | PROJECTILE_PROTECTION 実装済み | **実装済み** — 防具の PROJECTILE_PROTECTION を合算し、敵の飛び道具ダメージに適用。合算上限は 64% | `packages/inventory/application/equipment-service.ts`, `packages/app/application/frame/stages/physics-stage.ts` |
| 65 | 水中採掘速度ペナルティ実装済み | **実装済み** — 水中採掘時は 5x 遅延し、AQUA_AFFINITY 付きヘルメットで解除する。水中判定は frame stage から採掘 handler に渡す | `packages/block/domain/break-speed.ts`, `packages/app/application/frame/stages/interaction-break-handler.ts`, `packages/app/application/frame/stages/interaction-stage.ts` |
| 66 | 雨天 SE なし | 雨・雷天候でも効果音なし（照明変化のみ）。`sound-manager.config.ts` に rain/thunder SE 未定義 | `packages/game/application/sound-manager.config.ts` |
| 67 | スプリントジャンプ水平加速実装済み | 地上で sprint+jump したフレームのみ水平速度へ `SPRINT_JUMP_HORIZONTAL_MULTIPLIER=1.2` を適用する。空腹で sprint 不可・sneak 中・空中押しっぱなしでは追加加速しない | `packages/entity/application/movement-service.ts`, `packages/entity/test/movement-service.test.ts`, `packages/entity/test/movement-service-integration.test.ts`, `packages/entity/test/movement-service-scenarios.test.ts` |
| 68 | ANVIL ブロック未実装 | 金床（ANVIL）が `block-type.ts` に未定義。アイテム修繕・名前変更不可 | `packages/core/domain/block-type.ts` |
| 69 | CAULDRON ブロック未実装 | 大釜（CAULDRON）が `block-type.ts` に未定義 | `packages/core/domain/block-type.ts` |
| 70 | PRESSURE_PLATE 未実装 | 感圧板（PRESSURE_PLATE）が `block-type.ts` に未定義 | `packages/core/domain/block-type.ts` |
| 71 | CHICKEN Mob 実装済み | `ChickenDefinition` を追加し、EntityType・PASSIVE_MOBS・昼間スポーン対象・FEATHER/RAW_CHICKEN ドロップ・WHEAT_SEEDS 繁殖・RAW_CHICKEN→COOKED_CHICKEN 精錬・簡易 Mob 描画に対応 | `packages/entity/domain/mob/mobs/chicken.ts`, `packages/entity/domain/mob/mob-categories.ts`, `packages/inventory/application/recipes/misc-recipes.ts`, `packages/rendering/infrastructure/entity/mob-geometry.ts` |
| 72 | 重力ブロック落下なし | SAND・GRAVEL は支持ブロックなしでも落下しない（公式は物理落下エンティティ化）| `packages/core/domain/block-type.ts` |
| 73 | 溶岩脱出後の炎上なし | LAVA ブロック外に出た後の継続炎上ダメージなし。`lavaDamageSecsRef` は LAVA 接触中のみ計上 | `packages/app/application/frame/stages/physics-stage.ts:242` |
| 74 | ENDER_PEARL 投擲なし | ENDER_PEARL が `item-type.ts` に定義・テクスチャあり・非設置物だが、投擲→テレポートのハンドラなし | `packages/core/domain/item-type.ts:53` |
| 75 | ホットバー選択アイテム名表示実装済み | Three.js ホットバー HUD が選択スロット/選択アイテム変更時に CanvasTexture のアイテム名ラベルを画面下部へ一時表示し、空スロットでは非表示、時間経過でフェードアウトする | `packages/presentation/hud/hotbar-three.ts`, `packages/presentation/hud/hotbar-three.test.ts` |
| 76 | 窒息ダメージ実装済み | プレイヤーの頭が窒息対象の固体ブロック内に入った際、クリエイティブ以外で 0.5 秒ごとに 1 ダメージを適用する。判定は `isSuffocatingBlock` と環境ダメージの蓄積経路で処理 | `packages/app/application/frame/stages/physics-stage.ts`, `packages/entity/domain/environment-hazard.ts` |
| 77 | TNT プレイヤーダメージ実装済み | FLINT_AND_STEEL による TNT 爆発で `computeExplosionDamageAt` + `TNT_EXPLOSION_POWER` を使ってプレイヤーへ爆発ダメージを適用する。spectator・死亡中・無敵時間中は無効、防具/Protection 軽減、満腹度 exhaustion、被ダメージ SE も通す | `packages/app/application/frame/stages/interaction-placement-handler.ts`, `packages/app/application/frame/stages/interaction-placement-handler.test.ts` |
| 78 | FIRE ブロック未実装 | 炎（FIRE）が `block-type.ts` に未定義。火のブロック・延焼システムなし。FLINT_AND_STEEL はポータル着火のみ | `packages/core/domain/block-type.ts` |
| 79 | エンディングクレジット実装済み | エンド突破後のエンディングクレジットが `ending-credits.ts` に実装（`ENDING_CREDITS_DURATION_MS=60000`）。エンドポータルフレーム（`END_PORTAL_FRAME`）・エンドテレポートも定義済み | `packages/presentation/ending-credits.ts:1` |
| 80 | アイテムドロップ（Qキー）| Q 入力は実装済み。選択スロットから 1 個捨てるが、浮遊 item entity/pickup 化は未実装（§12 #280）| `packages/entity/domain/key-mappings.ts`, `packages/app/application/frame/stages/input-stage.ts` |
| 81 | ヴォイドダメージ実装済み | プレイヤーの Y 座標が `VOID_DAMAGE_Y`（-64）未満になった際、クリエイティブ以外で 0.5 秒ごとに 4 ダメージを適用する。境界値 y=-64 では発火しない | `packages/app/application/frame/stages/physics-stage.ts`, `packages/entity/domain/environment-hazard.ts` |
| 82 | CHEST 通常収納実装済み | 通常チェスト（CHEST）は `block-type.ts` / `block-codec.ts` に定義済み。PLANKS×8 レシピ、ブロック・アイテム描画、設置・破壊ドロップ経路、右クリックで開く 27 スロット収納 UI、ブロック座標ごとの永続コンテナ状態に対応済み | `packages/core/domain/block-type.ts`, `packages/core/domain/block-codec.ts`, `packages/inventory/application/chest-service.ts`, `packages/presentation/inventory/inventory-renderer.ts` |
| 83 | クラフトUI がリスト型（公式は格子型）| インベントリクラフトは `craftingListEl` スクロールリストから選択。公式の 2×2 / 3×3 格子配置レシピ UI なし | `packages/presentation/inventory/inventory-renderer.ts:114` |
| 84 | ブロック破壊クラックアニメなし | ブロック掘削中の破壊段階テクスチャ（0〜9段階）なし。DOM `<progress>` 要素でバー表示のみ | `packages/app/application/frame/stages/interaction-break-handler.ts:116` |
| 85 | HUD バーがテキスト数値表示（公式はアイコン列）| 体力・空腹度・防具・経験値すべて `writeHudText` で数値テキスト出力。公式のハート列・ドラムスティック列・鎧アイコン列なし | `packages/app/application/frame/stages/physics-stage.ts:20` |
| 86 | 溺死ダメージ実装済み | 頭が WATER ブロックに入ると空気（airSecsRef）が減少し、0 になると DROWN_DAMAGE/DROWN_DAMAGE_INTERVAL_SECS でダメージ。RESPIRATION エンチャント対応済み | `packages/app/application/frame/stages/physics-stage.ts:273` |
| 87 | 落下ダメージ実装済み | `computeFallDamage`：`FALL_DAMAGE_FREE_BLOCKS=3`、`ceil(fallDistance−3)` で公式準拠。フレーム間累積で正確なトータル落下距離を計測 | `packages/entity/domain/player-health.ts:66` |
| 88 | ベッドスリープ実装済み | 夜に BED を右クリック→夜スキップ（setTimeOfDay 0.25=夜明け）＋スポーン地点を BED 上に設定 | `interaction-placement-handler.ts:221` |
| 89 | 空腹時スプリント停止実装済み | `MovementService` が `HungerService` を参照し、`foodLevel ≤ 6` のスプリント入力を無効化する。frame 側の消耗判定も同じ `canSprintWithFood` を使用 | `packages/entity/application/movement-service.ts`, `packages/app/application/frame/stages/physics-stage.ts` |
| 90 | モブドロップが直接インベントリに入る | 公式はドロップアイテムをワールドにエンティティとして落下生成→プレイヤーが拾う。本実装は `inventoryService.addBlock()` で即座にインベントリ追加 | `interaction-melee-handler.ts:115` |
| 91 | ポーション/ステータス効果未実装 | 醸造台（BREWING_STAND）ブロックなし、ポーションアイテムなし、速度・毒・夜目などのステータス効果システムなし | `packages/core/domain/block-type.ts` |
| 92 | バイオーム別草・水色ティントなし | 公式はバイオームごとに草・葉・水に色マスクをかける（砂漠=黄、ジャングル=緑など）。本実装は単一テクスチャカラーのみ | `packages/rendering/` |
| 93 | 火打石と鋼のネザーポータル限定 | FLINT_AND_STEEL は `interaction-placement-handler.ts` でネザーポータル点火のみ。一般ブロックへの着火（火ブロック生成）なし | `interaction-placement-handler.ts:257` |
| 94 | 落雷ダメージなし | 雷天候（thunder）時にプレイヤーへの落雷ダメージなし。`weather-service.ts` は状態遷移のみ。`physics-stage.ts` に lightning ダメージロジックなし | `packages/game/application/weather-service.ts` |
| 95 | 天候状態保存実装済み | `WeatherService` の `serialize`/`restore` と `WorldMetadata.weatherState` により `weather` と `remainingSecs` を保存・復元。ロード後も天候サイクルが継続 | `packages/app/application/main/session-save.ts`, `packages/game/application/weather-service.ts` |
| 96 | モブエンティティが永続化されない | セッション終了時にモブは消滅。`entity-manager.ts` に `serialize()` メソッドなく、`session-save.ts` にモブ状態保存なし | `packages/entity/application/mob/entity-manager.ts` |
| 97 | ピストンが設置ブロックではない | `redstone-model.ts` に `pistonExtended` 状態あり、`redstone-simulation.ts` に伸縮ロジックあり。ただし `block-type.ts` に PISTON が未定義で設置・描画不可 | `packages/entity/domain/redstone/redstone-model.ts:15` |
| 98 | 中クリックブロックピック実装済み | クリエイティブモードの中クリック（1）でターゲット座標の実ブロック種別を読み取り、選択中ホットバーへ最大スタックでコピーする。サバイバル/スペクテイター/空気/未ロードチャンクは無視 | `packages/app/application/frame/stages/interaction-stage.ts:55` |
| 99 | ESC ポーズメニュー実装済み | `KeyMappings.ESCAPE` 入力で他モーダルが開いていない場合に `PauseMenuService.openIfClosed()` を呼び、`gamePausedRef` を true にして同 tick からゲームを停止する。`OPEN_MENU_KEY` は副ショートカットとして残す | `packages/app/application/frame/stages/input-stage.ts`, `packages/presentation/menu/pause-menu.ts`, `packages/app/application/frame/stages/input-stage.test.ts` |
| 100 | 足音効果音実装済み | 接地中の水平移動距離を累積し、歩行/スプリント間隔で足音 SE を発火する。足元ブロックから草・石・木系の `footstepGrass`/`footstepStone`/`footstepWood` を選択し、スプリント時は短い間隔と `gainScale` で強調する | `packages/app/application/frame/stages/physics-stage.ts`, `packages/game/application/sound-manager.config.ts` |
| 101 | DOOR ブロック実装済み（一部簡略） | 木製 DOOR は `block-type.ts` に定義済み。縦2マスで設置され、DOOR_OPEN との状態切替で上下同期して右クリック開閉でき、片側破壊で上下とも除去される。IRON_DOOR、ヒンジ向き、薄い形状は未実装 | `packages/core/domain/block-type.ts`, `packages/world/application/block-service.ts`, `packages/app/application/frame/stages/interaction-placement-handler.ts` |
| 102 | コンパレータ・オブザーバー・レッドストーンランプ未実装 | `block-type.ts` のレッドストーン関連は REDSTONE_WIRE/TORCH/LEVER/STONE_BUTTON/REPEATER の 5 種のみ。COMPARATOR・OBSERVER・REDSTONE_LAMP なし | `packages/core/domain/block-type.ts:53` |
| 103 | 農作物がコムギのみ | ブロックタイプとして WHEAT_CROP のみ実装。ニンジン・ジャガイモ・ビートルート・スイカ・カボチャの農作物ブロックなし | `packages/core/domain/block-type.ts:51` |
| 104 | オフハンドスロットなし | 公式インベントリのオフハンド（盾・松明などを左手に装備）スロットなし。`INVENTORY_SIZE=36`（`HOTBAR_START=27`/`HOTBAR_SIZE=9`）にオフハンド枠未定義 | `packages/inventory/application/inventory-service.config.ts:1` |
| 105 | インベントリ右クリック半スタックなし | 公式はインベントリでスタックを右クリック→半分ピックアップ。`inventory-renderer-click-handler.ts` は左クリック（全スタック移動）とシフトクリック（quickMove）のみ | `packages/presentation/inventory/inventory-renderer-click-handler.ts:40` |
| 106 | インベントリ右クリック 1 個置きなし | 公式は保持中スタックをスロット右クリック→1 個だけ置く。本実装の click handler に右クリックリスナーなし | `packages/presentation/inventory/inventory-renderer-click-handler.ts` |
| 107 | ドラッグ分割なし | 公式はドラッグしてスタックを複数スロットに均等分配。本実装の click handler にマウスドラッグ追跡なし | `packages/presentation/inventory/inventory-renderer-click-handler.ts` |
| 108 | SUGAR_CANE・CACTUS 基本ブロック実装済み | **一部実装済み** — SUGAR_CANE は砂/土/草/自身の上、CACTUS は砂/自身の上に配置可能。BlockType / codec / 初期ブロック / 支え判定 / 水破壊 / 仮タイル描画に接続済み。サトウキビの隣接水条件、自動増殖、サボテンの横空き制約・接触ダメージ・細い当たり判定は未実装 | `packages/core/domain/block-type.ts`, `packages/world/application/block-support.ts` |
| 109 | レシピブック/解放システムなし | 全 158 レシピが常時表示。公式のアイテム収集に伴うレシピ解放システムなし | `packages/inventory/application/recipes/index.ts:6` |
| 110 | コンパス・地図アイテムなし | COMPASS・MAP が `item-type.ts` に未定義。方位・現在地表示機能なし | `packages/core/domain/item-type.ts` |
| 111 | クロスヘア実装済み | `presentation/hud/crosshair.ts` で画面中央に白十字（縦横 2px バー）の DOM 要素をレンダリング | `packages/presentation/hud/crosshair.ts:26` |
| 112 | ホットバー Three.js でビジュアル描画済み | `hotbar-three.ts` で 9 スロットを 60×60 平面メッシュ + アイテムアトラステクスチャで描画。選択スロットは 1.2× 拡大＋黄色ボーダー | `packages/presentation/hud/hotbar-three.ts:20` |
| 113 | F3 デバッグオーバーレイ実装済み | `debug-overlay.ts` で F3 トグル。座標・向き・バイオーム・FPS・ロード済みチャンク数・時刻を表示 | `packages/presentation/hud/debug-overlay.ts:81` |
| 114 | 第三者視点（F5）実装済み | `camera-stage.ts` で F5 → `playerCameraState.toggleMode()` により一人称↔三人称切替 | `packages/app/application/frame/stages/camera-stage.ts:28` |
| 115 | 3D 空間サウンド実装済み | `sound-manager.ts` で距離減衰 `1/(1+d/12)` ＋ Pan `dx/12` を計算しゲイン・パン調整。距離に応じた立体音響対応 | `packages/game/application/sound-manager.ts:11` |
| 116 | モブ固有の鳴き声なし | ゾンビの唸り声・スケルトンの骨音・クリーパーの点火音などモブ別アンビエント SE なし。定義は `mobHurt`/`mobDeath` の 2 種のみ（全モブ共通）| `packages/game/application/sound-manager.config.ts:15` |
| 117 | クリーパー爆発のブロック破壊実装済み | Fuse 完了時に `EntityManager.drainExplosions()` へ爆発イベントを積み、`physics-stage.ts` が `buildExplosionBreakPositions()` の範囲を `AIR` に置換。EntityManager/physics-stage の回帰テストで検証済み | `packages/entity/application/mob/entity-manager-internal.ts`, `packages/app/application/frame/stages/physics-stage.ts` |
| 118 | コマンド/チートシステムなし | `/gamemode`, `/give`, `/tp`, `/time`, `/weather` 等のコマンドパーサーなし。`app/application/` 全体をサーチしてもコマンド処理ロジック 0 件 | `packages/app/application/` |
| 119 | クリエイティブモードでインベントリが無限化しない | `GameModeService.isCreative()` フラグは存在するが、インベントリに全アイテム配布・無限所持などの処理なし。`inventory-service.ts` はモードによらず同一動作 | `packages/game/application/game-mode-service.ts:19` |
| 120 | ダンジョン・廃坑・要塞の構造物なし | `world/domain/terrain/` にあるのは end-city/end-gateway/cave-carver/lake/ore/tree のみ。ダンジョン（モブスポナー付き部屋）・廃坑・要塞（エンドポータル前室）の生成ジェネレータなし | `packages/world/domain/terrain/` |
| 121 | エンダーマン視線プロボーク実装済み | カメラ forward と Enderman 上半身ターゲットのレイ判定で敵対化し、眼からターゲットまでの線分が solid/passable 判定で遮蔽される場合は敵対化しない。詳細は #272 | `packages/entity/domain/mob/enderman-anger.ts`, `packages/app/application/frame/stages/entity-update-stage.ts` |
| 122 | ステップ高が 0.5 ブロック（公式 0.6）| `aabb-collision.ts:25` の `MAX_STEP_UP = 0.5`。公式 Java Edition は 0.6 ブロックの段差を自動昇段 | `packages/game/domain/aabb-collision.ts:25` |
| 123 | エンチャント台にラピスラズリ不要 | `interaction-placement-handler.ts:241` のコメント "No lapis cost (simplified vs vanilla)"。公式はラピスラズリ 1〜3 個消費 | `interaction-placement-handler.ts:241` |
| 124 | 本棚によるエンチャントレベル強化なし | 公式は周囲 15 個の本棚でエンチャントレベル最大 30 まで上昇。本実装の `handleEnchantingTable` に本棚スキャンロジックなし | `interaction-placement-handler.ts:242` |
| 125 | エンチャント台に選択 UI なし | 公式は 3 つのエンチャント候補から選択。本実装は右クリックで即時エンチャント（候補選択なし）| `interaction-placement-handler.ts:283` |
| 126 | 燃料ごとの燃焼時間実装済み | `FURNACE_FUEL_BURN_DURATION_SECS` で COAL/CHARCOAL=80 秒、WOOD/PLANKS/BOW/FISHING_ROD=15 秒、木製ツール=10 秒、STICKS=5 秒を定義。`FurnaceService.tick()` は残燃焼時間を保持し、不足時に次燃料を消費する | `packages/inventory/application/furnace-service.config.ts:5`, `packages/inventory/application/furnace-service.ts:139` |
| 127 | 葉・草ブロックのアニメなし | 公式は葉・草が風でゆらぐアニメーション。greedy meshing は静的ジオメトリを生成し頂点アニメーションなし | `packages/rendering/infrastructure/meshing/greedy-meshing.ts` |
| 128 | 水中スクリーンティントなし | 公式は水中でスクリーン全体に青いオーバーレイ。本実装は気泡 HUD 表示のみ。ポストプロセスもスクリーン空間ウォーターオーバーレイなし | `packages/app/application/frame/stages/physics-stage.ts:303` |
| 129 | 氷ブロックの滑走摩擦実装済み | 足元ブロックの `properties.friction` を `GameStateService.update()` が速度合成へ渡し、ICE（0.98）上で無入力時に水平慣性を保持する。通常地面では従来どおり停止 | `packages/game/application/game-state-service.ts`, `packages/game/application/game-state-physics.ts`, `packages/game/domain/block-collision-predicates.ts` |
| 130 | シフトクリックで防具が自動装備されない | `quickMove()` はメインインベントリ↔ホットバー間の汎用移動のみ。防具スロット（HELMET/CHESTPLATE 等）への自動振り分けなし | `packages/inventory/application/inventory-service.ts:72` |
| 131 | モブ経路探索が直線追跡（A* なし）| `state-machine.ts:97` の Chase は `directionBetween(entity, player)` で正規化速度ベクトルを返すのみ。A* や格子経路探索なし。壁に衝突するとスタック | `packages/entity/domain/mob/state-machine.ts:97` |
| 132 | モブ検知距離が公式と相違 | zombie: 16 / skeleton: 20 / creeper: 16 / enderman: 24 ブロック。公式 Java Edition はゾンビ 35・スケルトン 16・クリーパー 16・エンダーマン 64（敵対化後）| `packages/entity/domain/mob/mobs/` |
| 133 | 子モブ・成長システム実装済み | `BABY_GROW_TICKS=24000`（20 分で成体）、`ageTicks` フィールドで年齢追跡、`acceleratedBabyAge()` で餌による成長促進 | `packages/entity/domain/mob/breeding.ts:9` |
| 134 | 動物の繁殖実装済み | 豚+ニンジン・牛+コムギ・羊+コムギ。`canAcceptBreedingFood()` で成体＋クールダウンチェック後に中間地点に子エンティティをスポーン | `packages/entity/domain/mob/breeding.ts:41` |
| 135 | ツール採掘速度段階実装済み | 木/金:2×・石:4×・鉄:6×・ダイヤ:8×。`break-speed.ts` の `breakTicks = ceil(hardness×3/speedMult)` で計算 | `packages/block/domain/break-speed.ts:12` |
| 136 | 不適切ツールでドロップなし実装済み | `canHarvestBlock()` でブロック×ツール組み合わせを検証。不正ツール時は採掘中止＋ドロップスキップ | `packages/world/application/block-service.ts:88` |
| 137 | 頂点 AO（グリーディメッシュ）実装済み | `greedy-meshing-ao.ts` で 6 面各々の隣接ブロック 2×2 パターンを調べ AO レベル 0〜3 を頂点カラーへエンコード（255/204/153/102）| `packages/rendering/infrastructure/meshing/greedy-meshing-ao.ts:15` |
| 138 | 3D パーティクルシステム実装済み | `particle-system.ts` の `spawnBurst()` + `update()` で重力付き Euler 積分・寿命フェードアウト | `packages/rendering/infrastructure/particles/particle-system.ts:116` |
| 139 | 溶岩が水より遅く流れる実装済み | `LAVA_TICK_INTERVAL=3` で溶岩は 3 tick に 1 回だけ伝播。最大広がりレベルも水 7 に対し溶岩 3 | `packages/block/domain/fluid-model.ts:18` |
| 140 | 死亡時アイテムが地面に落ちない | 公式はプレイヤー死亡でアイテムをワールドにドロップ。本実装は `inventoryService.clear()` で直接削除。アイテムエンティティ生成なし | `packages/game/application/game-state-service.ts:276` |
| 141 | 無限水源なし | 公式は水源 2 個を L 字配置→新しい水源生成。`fluid-service.ts` は純粋なフロー伝播のみで隣接水源から新 source ブロックを生成する判定なし | `packages/world/application/fluid-service.ts` |
| 142 | 食事が即時完了（公式 1.6 秒）| `handleFoodConsumption()` は右クリック同一フレームでアイテム消費・空腹回復を完了。食べるアニメーション・所要時間なし | `packages/app/application/frame/stages/interaction-item-use-handler.ts:74` |
| 143 | 矢がワールドに残らない | 弓はヒットスキャン方式でダメージ計算。矢エンティティをワールドに生成しないため、矢の回収不可。矢は消耗品として在庫から消費されるのみ | `packages/app/application/frame/stages/interaction-bow-handler.ts:95` |
| 144 | ダイヤモンド鉱石の Y レンジが異なる | 本実装：`minY=5, maxY=16, peakY=8`（三角分布）。公式 Java 1.21 は Y=−64 〜 −58 付近に最頻出。Y 座標系の起点差（本実装 Y=0 ≈ 公式 Y=-64）を考慮しても分布範囲が異なる | `packages/world/domain/terrain/constants.ts:70` |
| 145 | ネザーのベッドが爆発しない | 公式はネザー/エンドでベッド使用→爆発。本実装は `getDimension()==='nether'` で `return false`（無効化のみ、爆発ダメージなし）| `interaction-placement-handler.ts:229` |
| 146 | 村にアイアンゴーレムなし | 村（VillageService）は実装済みだが防衛 NPC であるアイアンゴーレムの定義・スポーンロジックなし | `packages/entity/domain/mob/mobs/` |
| 147 | ワールドシード入力 UI なし | NoiseService に `setSeed(n)` は実装済みだが、ワールド作成 UI でシードを指定する入力欄なし。プレイヤーがシードを選択不可 | `packages/presentation/menu/main-menu-handlers.ts:43` |
| 148 | モブ昼間炎上が 1 秒ごと（公式は 1 game-tick ≒ 0.05 秒ごと判定）| `DAYTIME_BURN_INTERVAL_SECS=1.0` のアキュムレータで 1 秒間隔ダメージ。公式は毎 tick 光レベル検査し炎上継続。間隔が 20× 遅い | `packages/entity/application/mob/entity-manager-internal-update.ts:191` |
| 149 | 動物 XP ドロップが固定値（公式はランダム範囲）| 牛・豚・羊は `xpReward: 2` 固定。公式はプレイヤーによる死亡の場合 1〜3 ランダム | `packages/entity/domain/mob/mobs/cow.ts:14` |
| 150 | XP レベル計算式が公式準拠 | Lv0-15: `2L+7`、Lv16-30: `5L-38`、Lv31+: `9L-158`。公式 Java Edition と完全一致 | `packages/entity/domain/player-xp-calc.ts:5` |
| 151 | BEDROCK は破壊不可（公式準拠）| `block-service.ts` に BEDROCK の採掘コードなし。公式同様プレイヤーによる破壊不可 | `packages/world/application/block-service.ts` |
| 152 | ブロック選択ハイライト実装済み | `block-highlight.ts` でターゲットブロックに黒ワイヤーフレーム枠（1.01³ BoxGeometry EdgesGeometry）を描画 | `packages/presentation/highlight/block-highlight.ts:12` |
| 153 | BGM が時間帯・深度で変化 | day=174.61Hz sine / night=130.81Hz triangle / cave=98Hz sawtooth（Y<40 で cave 判定）| `packages/game/application/music-manager.config.ts:9` |
| 154 | 設定が localStorage に永続化 | `settings-service.ts` でキー `'minecraft-settings'` に JSON 保存。レンダー距離・感度・音量等を復元 | `packages/game/application/settings-service.ts:25` |
| 155 | ワールド選択 UI 実装済み | メインメニューに New World / Load World ボタン。保存済みワールドを lastPlayed 降順で一覧表示・削除可能 | `packages/presentation/menu/main-menu-handlers.ts:75` |
| 156 | 採掘・精錬で XP 付与 | 石炭/レッドストーン/ラピス/エメラルド採掘=5XP、ダイヤモンド採掘=3XP。精錬：鉄インゴット=0.7、金=1.0、食品=0.35 XP | `interaction-break-handler.ts:65` |
| 157 | 空腹消耗レートが公式準拠 | `EXHAUSTION_WALK_PER_BLOCK=0.01`、`EXHAUSTION_SPRINT_PER_BLOCK=0.1`、ジャンプ=0.05、スプリントジャンプ=0.2。公式値と完全一致 | `packages/entity/application/hunger-service.config.ts` |
| 158 | ネザー天井ベドロック実装済み | `NETHER_CEILING_Y=127`（常時 BEDROCK）、`NETHER_CEILING_BEDROCK_BOTTOM=124`（Y=124-126 確率的配置）| `packages/world/domain/terrain/nether-generator.ts:12` |
| 159 | F3 デバッグでバイオーム名表示 | `debug-overlay.ts` で `biomeService.getBiome(x, z)` を呼び出しバイオーム名を表示 | `packages/presentation/hud/debug-overlay.ts:21` |
| 160 | シールドは即時ブロック（公式準拠）| `rightMouseHeld && selectedIsShield` で同フレーム即時ブロック判定。公式 Java 1.9 以降もシールドに raise delay なし（仕様一致）| `interaction-stage.ts:170` |
| 161 | ブロック支持更新を実装済み | `block-support.ts` の支持判定を `block-service.ts` の breakBlock/forceSetBlock/placeBlock に接続。支持ブロック破壊で TORCH/REDSTONE_TORCH/REDSTONE_WIRE/WHEAT_CROP を上方向 cascade 除去し、支えなし設置も拒否 | `packages/world/application/block-service.ts`, `packages/world/application/block-support.ts`, `packages/world/test/block-service.test.ts` |
| 162 | デフォルトデイサイクルが 400 秒（公式 1200 秒）| `settings-service.ts:15` の `dayLengthSeconds` デフォルト値が 400 秒。公式は 20 分（1200 秒）。設定範囲 120-1200 秒は公式値を含む | `packages/game/application/settings-service.ts:15` |
| 163 | 全クラフトレシピが無形式（シェイプレス）| `crafting.ts` のレシピ構造に格子座標フィールドなし。`recipe-service.ts` は素材個数のみ照合。公式の形式レシピ（材料位置が重要）との区別なし | `packages/inventory/domain/crafting.ts:12` |
| 164 | ネザーポータルがアニメしない | NETHER_PORTAL のテクスチャタイル 86 は静的。公式のゆらぐポータルアニメーションなし | `packages/rendering/infrastructure/textures/block-texture-map.config.ts` |
| 165 | オートセーブに視覚フィードバックなし | `session-autosave.ts` はバックグラウンドで 5 秒ごと保存。セーブアイコン・トースト通知なし | `packages/app/application/main/session-autosave.ts:21` |
| 166 | 作業台右クリックが無効 | 公式は作業台右クリック→3×3 クラフトグリッドを開く。`handleRightClick` の処理対象に CRAFTING_TABLE なし。インベントリを開けばクラフトリストは使える | `interaction-placement-handler.ts:265` |
| 167 | インベントリ満杯時のドロップが消滅 | `addBlock().pipe(Effect.catchAllCause(()=>Effect.void))` でエラー無視。ブロック採掘時インベントリ満杯ならドロップは地面に落ちず無音で消える | `packages/world/application/block-service.ts:124` |
| 168 | モブ上限が公式より大幅に少ない | `MAX_ENTITY_COUNT=24`（全モブ共通）。公式は敵対 70 + 受動的 10 + 水棲 5 + 環境 15 の分類別上限。24 は公式の約 1/3 | `packages/entity/domain/mob/spawner-config.ts:11` |
| 169 | エンチャント台のクラフトレシピなし | ENCHANTING_TABLE ブロックはゲーム内に設置可能だがクラフトレシピ未定義。公式は黒曜石 4 + ダイヤ 2 + 本 1 | `packages/inventory/application/recipes/` |
| 170 | ブラウザキーショートカット非ブロック | `input-service.ts` の `preventDefault()` 対象はスペース・矢印キーのみ。Ctrl+W（タブ閉じ）・F1（ブラウザ UI 非表示）・F11（フルスクリーン）は未ブロック | `packages/presentation/input/input-service.ts:52` |
| 171 | エンチャント相互排他なし | `enchantment.config.ts` に排他グループ定義なし。公式で排他の FIRE_PROTECTION+BLAST_PROTECTION や SHARPNESS+SMITE+BANE_OF_ARTHROPODS を同一アイテムに重複付与可能 | `packages/inventory/domain/enchantment.config.ts` |
| 172 | 村人取引内容が非公式（基本ブロック 6 種のみ）| 農夫・司書・鍛冶師が各 2 種計 6 取引（草・砂・木材・ガラス・石・丸石）。公式の職業別アイテム（道具・エンチャント本・食料など）なし | `packages/entity/application/trading/trading-service.config.ts` |
| 173 | 水溶岩接触でコブル/黒曜石生成（公式準拠）| `fluid-contact.ts:11`：溶岩 source + 水→黒曜石、流れ溶岩 + 水→丸石。公式の生成ルールと一致 | `packages/world/domain/fluid-contact.ts:11` |
| 174 | バケツで水・溶岩 source を回収可能 | `interaction-placement-handler.ts:189-219`：BUCKET で WATER/LAVA source ブロックをピックアップ→WATER_BUCKET/LAVA_BUCKET。source のみ対象（流れは不可）| `interaction-placement-handler.ts:189` |
| 175 | 環境ダメージ定数が公式準拠 | LAVA: 4HP/0.5s、溺死: 2HP/1s、最大空気: 15s。すべて公式 Java Edition と一致 | `packages/entity/domain/environment-hazard.ts:5` |
| 176 | ネザーポータル座標 8:1 スケール | `nether-link.ts:19`：X/Z を `NETHER_HORIZONTAL_RATIO=8` で除算。公式のオーバーワールド座標÷8=ネザー座標に準拠 | `packages/world/domain/nether/nether-link.ts:19` |
| 177 | 釣りのルートテーブルが 3 カテゴリ対応 | `fishing.config.ts`：魚 60%（タラ/サーモン/熱帯魚/フグ）・財宝 5%（弓/釣竿/エメラルド/ダイヤ/金銀インゴット）・ガラクタ 35%（骨/糸/棒/革/石炭）。公式カテゴリ構造と一致 | `packages/entity/domain/fishing.config.ts:9` |
| 178 | テクスチャアトラス完全網羅 | `block-texture-map.config.ts`（72 ブロック）・`item-texture-map.config.ts`（全 ItemType を Record で網羅）ともに未定義エントリなし | `packages/rendering/infrastructure/textures/` |
| 179 | 基本クラフトレシピ収量が公式準拠 | 木材 1→板材 4、板材 2→棒 4、木製ツール素材数も公式と一致 | `packages/inventory/application/recipes/misc-recipes.ts:10` |
| 180 | 太陽・月・星・雲が描画されない | Three.js Sky アドオンによる空色グラデーションはあるが、太陽ディスク・月ディスク・星フィールド・雲レイヤーのジオメトリなし | `packages/rendering/` |
| 181 | 雨が視覚的に描画されない | 天候「rain」はライティング（暗化・青灰色）のみ変化。降雨パーティクル・雨線オーバーレイなし | `packages/app/application/frame/stages/lighting-stage.ts:8` |
| 182 | 雷光フラッシュが描画されない | 「thunder」天候は環境光を 0.6 倍に減光するのみ。落雷ボルトのフラッシュ・視覚エフェクトなし | `packages/app/application/frame/stages/lighting-stage.ts:11` |
| 183 | ネザーモブ未実装 | Ghast・Blaze・Wither Skeleton・Piglin の定義ファイルが `entity/domain/mob/mobs/` に存在しない。ネザーに固有モブなし | `packages/entity/domain/mob/mobs/index.ts` |
| 184 | エンダードラゴンがボスとして機能しない | `ender-dragon.ts` に HP=200・攻撃力=15・速度=0.8・検知距離=96 の定義はあるが、フェーズ移行・ブレス攻撃・エンドクリスタル回復リンク・ゼロHP後の演出なし | `packages/entity/domain/mob/mobs/ender-dragon.ts` |
| 185 | エンドクリスタル未実装 | `explosion.ts` に END_CRYSTAL 定義なし。クリスタル破壊→ドラゴン回復の連動ロジックなし | `packages/entity/domain/explosion.ts` |
| 186 | 斧による丸太剥ぎなし | WOOD ブロックを斧で右クリックしても STRIPPED_LOG に変換されない。インタラクションハンドラに axe+WOOD 変換ロジックなし | `packages/app/application/frame/stages/interaction-placement-handler.ts` |
| 187 | シャベルによるダートパスなし | GRASS/DIRT をシャベルで右クリックしても DIRT_PATH に変換されない。公式の右クリック→grass_path 生成なし | `packages/app/application/frame/stages/interaction-placement-handler.ts` |
| 188 | 実績/進捗システムなし | アチーブメント・アドバンスメントのトラッキングなし。初クラフト・初ダイヤ等のマイルストーン通知なし | `packages/` |
| 189 | ネザー要塞が生成されない | `nether-generator.ts` はネザー地形のみ。要塞（Fortress）・ブレイズスポナー・宝箱の生成ジェネレータなし | `packages/world/domain/terrain/nether-generator.ts` |
| 190 | 三人称（F5）でローカルプレイヤーモデルが表示されない | `remote-player-renderer.ts` にリモートプレイヤーのモデルあり。ローカルプレイヤーは三人称カメラで視点だけ移動し自身のモデルは表示されない | `packages/rendering/infrastructure/player/remote-player-renderer.ts` |
| 191 | ネザー水晶鉱石・ネザー金鉱石なし | NETHER_QUARTZ_ORE・NETHER_GOLD_ORE が `block-type.ts` に未定義。ネザーで採掘できる固有鉱石なし | `packages/core/domain/block-type.ts` |
| 192 | モブ接触ダメージでプレイヤーへのノックバックなし | `combat.ts` に `computeKnockback` は実装済みだが、`getPlayerContactDamage` を呼ぶ `physics-stage.ts:107` でプレイヤーへのノックバック速度設定なし | `packages/app/application/frame/stages/physics-stage.ts:107` |
| 193 | マルチプレイ中インゲームチャット入力 UI なし | 接続パネル（URL/名前入力）はあるが、ゲームプレイ中のチャット入力フィールド・送信 UI なし。`sendChat` API は実装済みだが呼び出す UI なし | `packages/presentation/multiplayer/connection-panel.ts` |
| 194 | ゲームルール相当の切替なし | `doMobSpawning`・`keepInventory`・`doDaylightCycle`・`doWeatherCycle` 相当のトグル設定なし。`debugFeatureFlags` で開発時フラグのみ提供 | `packages/game/application/settings.schema.ts` |
| 195 | ユーザー設定可能 FOV なし | `settings.schema.ts` に FOV フィールドなし。`BASE_FOV=75` がコードにハードコードされ変更不可 | `packages/app/application/frame/stages/camera-stage.ts:3` |
| 196 | バイオーム境界がハードカット | `biome-service.ts` はブロック単位で離散バイオームを分類。公式のブレンド（補間）なし。隣接バイオームで草色・水色が急変 | `packages/world/application/biome-service.ts:70` |
| 197 | 一人称視点でプレイヤーの腕が表示されない | 一人称カメラサービスはカメラ回転のみ管理。手/腕のファーストパーソンメッシュなし | `packages/entity/application/first-person-camera-service.ts` |
| 198 | XP バーがテキスト数値表示（グラフィカルバーなし）| `index.html:41` の `#xp-display` は `<span>` 要素で "Lv 0 0/7 XP" とテキスト表示。公式の緑色グラデーションバーなし | `index.html:41` |
| 199 | スクリーンショットキーなし | `key-mappings.ts` に F2/SCREENSHOT バインドなし | `packages/entity/domain/key-mappings.ts` |
| 200 | 死亡画面に死因メッセージなし | 死亡画面は "YOU DIED" タイトル＋リスポーンボタン＋タイトルへボタンの 3 要素のみ。公式の "Killed by Zombie" 等の死因表示なし | `packages/presentation/menu/death-screen-dom.ts:22` |
| 201 | クワで農地を耕せる | `interaction-farming-handler.ts:37`：HOE 系ツールで DIRT/GRASS を右クリック→`forceSetBlock(pos, 'FARMLAND')` | `packages/app/application/frame/stages/interaction-farming-handler.ts:37` |
| 202 | ハサミで羊から羊毛を刈れる | `interaction-item-use-handler.ts:87`：SHEARS で羊を右クリック→1〜3 個の WOOL を回収（殺さずに）。TALL_GRASS/FERN のハサミ回収にも対応。葉のハサミ収穫はなし | `packages/app/application/frame/stages/interaction-item-use-handler.ts:87` |
| 203 | レッドストーン信号が 1 ブロックごとに減衰（公式準拠）| `redstone-simulation.ts:69`：`power-1` を隣接ブロックへ伝播。`MAX_REDSTONE_POWER=15`。公式の 15 ブロック最大範囲と一致 | `packages/entity/domain/redstone/redstone-simulation.ts:69` |
| 204 | デバッグフィーチャーフラグでモブ制御可 | `debug-feature-flags.config.ts:43,50,78`：`mobs.enabled`・`mobs.spawn`・`mobs.damage` フラグでモブ全停止・スポーン停止・ダメージ停止が可能（開発用）| `packages/app/application/debug-feature-flags.config.ts:43` |
| 205 | 目標 FPS 60 cap | `game-loop.ts:18`：`TARGET_FRAME_RATE=60`、`MIN_FRAME_INTERVAL_MS=1000/60`。フレームレートを 60fps に制限 | `packages/game/application/game-loop.ts:18` |
| 206 | 海洋地形生成と水面充填（公式準拠）| SEA_LEVEL=48 以下の空洞に WATER を充填。湖・海底地形が自然生成される | `packages/world/domain/terrain/chunk-manager-service.ts:SEA_LEVEL` |
| 207 | セーブファイルバージョン移行対応 | `CURRENT_WORLD_SAVE_VERSION=1`。旧形式デコード失敗時は壊れたチャンクを空リストにフォールバック（ゲームクラッシュなし）| `packages/world/infrastructure/storage-service.ts` |
| 208 | 通常チェスト収納コンテナ実装済み / エンダーチェスト未実装 | 通常CHESTは 27 スロット UI・ブロック座標ごとの永続コンテナ状態・破壊時の内容物インベントリ戻し入れに対応済み。ENDER_CHEST は GUI・共有インベントリなし | `packages/inventory/application/chest-service.ts`, `packages/app/application/frame/stages/interaction-placement-handler.ts`, `packages/presentation/inventory/inventory-renderer.ts` |
| 209 | エンチャントテーブルに選択 GUI なし | 右クリックで XP を消費してランダムなエンチャントを即時付与。公式のラピス+XP コスト 3 段階選択画面なし | `packages/app/application/frame/stages/interaction-placement-handler.ts:239` |
| 210 | TNT のレッドストーン起爆・着弾起爆なし | TNT 起爆は火打ち石（FLINT_AND_STEEL）のみ。レッドストーン信号による起爆・矢の着弾起爆なし。火打ち石起爆のブロック破壊とプレイヤーダメージは実装済み | `packages/app/application/frame/stages/interaction-placement-handler.ts` |
| 211 | 弓矢がヒットスキャン（弾道飛翔なし）| `interaction-bow-handler.ts:113`：発射時にレイキャストで即時命中判定。矢エンティティの生成・重力落下・飛翔アニメーションなし | `packages/app/application/frame/stages/interaction-bow-handler.ts:113` |
| 212 | 矢（Arrow）プロジェクタイルエンティティなし | EntityType に Arrow 定義なし。矢は消耗品アイテムとしてのみ存在し、ワールド空間のエンティティとして表現されない | `packages/entity/domain/mob/entity.ts:11` |
| 213 | エンダーパールの投擲テレポートなし | ENDER_PEARL は `item-type.ts:53` に定義ありエンダーマンのドロップ品。右クリックで投擲→着地点へテレポートの使用ハンドラなし | `packages/core/domain/item-type.ts:53` |
| 214 | ポーション/醸造システムなし | POTION アイテム・BREWING_STAND ブロックともに未定義。ポーション効果（速度・再生・毒など）のシステムなし | `packages/core/domain/` |
| 215 | 本・書物アイテムなし | BOOK/BOOK_AND_QUILL/WRITTEN_BOOK が `item-type.ts` に未定義。テキスト編集 UI なし | `packages/core/domain/item-type.ts` |
| 216 | スポーンエッグなし | SPAWN_EGG 系アイテムが `item-type.ts` に未定義。アイテムによるモブ召喚なし | `packages/core/domain/item-type.ts` |
| 217 | アイテムフレーム・絵画エンティティなし | ITEM_FRAME・PAINTING が EntityType にも BlockType にも未定義。装飾エンティティなし | `packages/entity/domain/mob/entity.ts` |
| 218 | エンダーアイをフレームに設置してもエンドポータル未開放 | ENDER_EYE アイテムは `item-type.ts:60` に定義あり。END_PORTAL_FRAME への右クリック設置ハンドラなし。ポータル開放ロジックなし | `packages/core/domain/item-type.ts:60` |
| 219 | ウィザーボスなし | EntityType に WITHER 未定義。ウィザースカルプロジェクタイルなし。ウィザーソウルサンドフレーム召喚なし | `packages/entity/domain/mob/entity.ts` |
| 220 | 行商人・トレーダーリャマなし | WANDERING_TRADER・TRADER_LLAMA が EntityType に未定義。ランダム出現取引なし | `packages/entity/domain/mob/mobs/index.ts` |
| 221 | ピリジャー・レイドシステムなし | PILLAGER が EntityType に未定義。村人撃退→レイド開始の Bad Omen エフェクト・レイドウェーブシステムなし | `packages/entity/domain/mob/mobs/index.ts` |
| 222 | エンダーチェストに GUI・共有インベントリなし | ENDER_CHEST ブロックは `block-type.ts:72` に定義あり。右クリック時に共有インベントリ画面を開くインタラクションハンドラなし | `packages/core/domain/block-type.ts:72` |
| 223 | コンクリート・テラコッタ等装飾ブロックなし | CONCRETE/CONCRETE_POWDER/TERRACOTTA/STAINED_GLASS/CARPET/BANNER 等の装飾ブロックが `block-type.ts` に未定義（全 80 種のみ）| `packages/core/domain/block-type.ts` |
| 224 | 小麦の成長ステージが 3 段階（公式は 7 段階）| `crop-growth.ts:4`：`CROP_MAX_AGE=2`（0=seedling/1=growing/2=ripe）。公式は 0〜7 の 8 状態（ステージ 7 で収穫）| `packages/world/domain/crop-growth.ts:4` |
| 225 | 小麦成長に光レベル依存なし | `crop-growth-service.ts`：成長を固定 60 秒インターバルのみで進行。公式の光レベル 9 以上必要・屋内/地下で成長停止なし | `packages/world/application/crop-growth-service.ts` |
| 226 | ジュークボックス・音楽ディスクなし | JUKEBOX ブロック・MUSIC_DISC アイテムともに未定義 | `packages/core/domain/block-type.ts` |
| 227 | 音符ブロックなし | NOTE_BLOCK が `block-type.ts` に未定義。右クリックでの音程変更・レッドストーン連動演奏なし | `packages/core/domain/block-type.ts` |
| 228 | LADDER 簡易実装済み、蔦・足場ブロックなし | LADDER は定義・描画・クラフト・通過判定・登攀速度制御まで実装済み。VINE/SCAFFOLDING と、LADDER の壁面付着・薄い形状は未実装 | `packages/core/domain/block-type.ts`, `packages/game/domain/block-collision-predicates.ts`, `packages/inventory/application/recipes/misc-recipes.ts` |
| 229 | クモの巣（COBWEB）実装済み | **実装済み** — COBWEB を BlockType / codec index 77 / 非固体衝突 / STRING ドロップ / 移動速度低下に接続。専用クモの巣アトラステクスチャと自然生成は未実装 | `packages/core/domain/block-type.ts`, `packages/game/application/game-state-service.ts`, `packages/world/application/block-service.config.ts` |
| 230 | ファントムモブなし | PHANTOM が EntityType に未定義。3 日間未就寝でファントムスポーン条件・就寝日数カウンターなし | `packages/entity/domain/mob/entity.ts` |
| 231 | アイアンゴーレムなし | IRON_GOLEM が EntityType に未定義。村の自動防衛・鉄塊ドロップなし | `packages/entity/domain/mob/entity.ts` |
| 232 | サトウキビ・サボテン基本ブロック実装済み | SUGAR_CANE・CACTUS は BlockType / codec / 初期ブロック / 支え判定 / 水破壊 / 仮タイル描画に接続済み。砂浜/水辺/砂漠での自然生成、自動成長、サボテン接触ダメージは未実装 | `packages/core/domain/block-type.ts`, `packages/world/application/block-support.ts`, `packages/rendering/infrastructure/textures/block-texture-map.config.ts` |
| 233 | スライムモブなし | SLIME が EntityType に未定義。倒すと小スライムに分裂するメカニクスなし | `packages/entity/domain/mob/entity.ts` |
| 234 | ネザー醸造素材なし | NETHER_WART・BLAZE_ROD・MAGMA_CREAM が `item-type.ts` に未定義。ネザー固有クラフト・醸造素材なし | `packages/core/domain/item-type.ts` |
| 235 | コンパス・時計アイテムなし | COMPASS・CLOCK が `item-type.ts` に未定義。方位/時刻表示ユーティリティアイテムなし | `packages/core/domain/item-type.ts` |
| 236 | ベッドで就寝すると夜をスキップ | `interaction-placement-handler.ts:231`：BED 右クリック→`timeService.setTimeOfDay(0.25)` で夜明け（午前 6 時相当）へ。リスポーン位置もベッド座標に更新 | `packages/app/application/frame/stages/interaction-placement-handler.ts:231` |
| 237 | ネザーポータル通過で次元移動 | `physics-stage-portal.ts:19`：プレイヤーが NETHER_PORTAL ブロックに 4 秒間滞在後 `netherService.setDimension()` で次元切替。座標は 8:1 変換。帰還も同様 | `packages/app/application/frame/stages/physics-stage-portal.ts:19` |
| 238 | 釣りロッドが完全実装（ルートテーブル付き）| `interaction-item-use-handler.ts:11`：右クリックでキャスト/リール。LURE・LUCK_OF_THE_SEA エンチャント対応。魚 60%/財宝 5%/ガラクタ 35% | `packages/app/application/frame/stages/interaction-item-use-handler.ts:11` |
| 239 | エンチャントテーブルが XP 消費エンチャントを実施 | `interaction-placement-handler.ts:254`：プレイヤー XP レベルに基づきランダムにエンチャントを選択・付与。エンチャントレベル分 XP を消費 | `packages/app/application/frame/stages/interaction-placement-handler.ts:254` |
| 240 | 弓のチャージ＋リリース発射が実装済み | `interaction-stage.ts:172`：右クリックホールドでチャージタイマー起動。`interaction-bow-handler.ts:75`：リリース時に持続秒数からチャージ率（0〜1）→ダメージを計算して即時判定 | `packages/app/application/frame/stages/interaction-bow-handler.ts:75` |
| 241 | 苗木（SAPLING）ブロック実装済み | **実装済み** — DIRT/GRASS/FARMLAND 上に設置でき、BONE_MEAL で空間チェック後に WOOD/LEAVES の小型木へ成長。葉から SAPLING が確率ドロップする | `packages/world/application/block-support.ts`, `packages/world/application/block-service.config.ts`, `packages/app/application/frame/stages/interaction-farming-handler.ts` |
| 242 | 花・草・水辺装飾ブロック一部実装済み | DANDELION/POPPY/TALL_GRASS/FERN/SUGAR_CANE/CACTUS/LILY_PAD は BlockType/codec/初期ブロック/支え判定/スポーン面除外/仮タイル描画に接続済み。草の破壊時の WHEAT_SEEDS 1/8 抽選と SHEARS 回収は実装済み。SUGAR_CANE・LILY_PAD は非衝突、CACTUS は暫定の固体衝突。草・水辺植物の自然生成、専用クロス/薄板モデル、サボテンの細い当たり判定は未実装。CHORUS_FLOWER は End 専用として既存 | `packages/core/domain/block-type.ts`, `packages/world/application/block-support.ts` |
| 243 | ハーフブロック（スラブ）なし | STONE_SLAB/OAK_SLAB 等の汎用スラブブロックが未定義。PURPUR_SLAB（End専用）のみ存在 | `packages/core/domain/block-type.ts:75` |
| 244 | フェンス・フェンスゲートなし | FENCE/FENCE_GATE が `block-type.ts` に未定義。フェンスの衝突・接続ロジックなし | `packages/core/domain/block-type.ts` |
| 245 | ドアは木製のみ実装済み（一部簡略） | DOOR / DOOR_OPEN は定義済み。縦2マス設置、右クリック上下同期開閉、上下同時破壊は実装済み。IRON_DOOR、ヒンジ向き、薄い形状は未実装 | `packages/core/domain/block-type.ts`, `packages/world/application/block-service.ts`, `packages/app/application/frame/stages/interaction-placement-handler.ts` |
| 246 | グロウストーン発光・dust 実装済み | GLOWSTONE は定義・codec・描画/アイコン/self-light 対応済み。破壊時は `GLOWSTONE_DUST` を 4 個落とし、4 dust -> 1 GLOWSTONE のクラフトも実装済み。ネザー天井生成は未実装 | `packages/core/domain/block-type.ts`, `packages/core/domain/block-codec.ts`, `packages/block/domain/blocks.config.crafted.ts`, `packages/block/domain/light.ts`, `packages/world/application/block-service.config.ts`, `packages/inventory/application/recipes/misc-recipes.ts`, `packages/rendering/infrastructure/textures/item-texture-map.config.ts` |
| 247 | 感圧板なし | STONE_PRESSURE_PLATE/WOODEN_PRESSURE_PLATE が `block-type.ts` に未定義。踏むとレッドストーン信号を出すメカニクスなし | `packages/core/domain/block-type.ts` |
| 248 | 炎（FIRE）ブロックなし・延焼なし | FIRE ブロックが `block-type.ts` に未定義。ブロック延焼・木材への着火メカニクスなし。FLINT_AND_STEEL はネザーポータル点火専用 | `packages/core/domain/block-type.ts` |
| 249 | コンパレータ・オブザーバー・レッドストーンランプなし | COMPARATOR/OBSERVER/REDSTONE_LAMP が `block-type.ts` に未定義。信号比較・ブロック状態監視・レッドストーン駆動照明なし | `packages/core/domain/block-type.ts` |
| 250 | 金床（ANVIL）なし | ANVIL が `block-type.ts` に未定義。ツール修繕・アイテムリネームの UI なし | `packages/core/domain/block-type.ts` |
| 251 | 大釜（CAULDRON）なし | CAULDRON が `block-type.ts` に未定義。バケツで水を充填・ポーション保存の用途なし | `packages/core/domain/block-type.ts` |
| 252 | エンチャント済みリンゴなし | ENCHANTED_GOLDEN_APPLE が `item-type.ts` に未定義。GOLDEN_APPLE（item-type.ts:32）は存在し食べると 4HP 回復するが、吸収ハート・再生効果はなし | `packages/core/domain/item-type.ts:32` |
| 253 | 不死のトーテムなし | TOTEM_OF_UNDYING が `item-type.ts` に未定義。致死ダメージ時に 1 HP で生存する緊急回避なし | `packages/core/domain/item-type.ts` |
| 254 | ネザーでベッドを使っても爆発しない | `interaction-placement-handler.ts:230`：ネザー次元でベッド右クリック時に `return false` で無処理。公式の爆発ダメージなし（"safe mode" コメントあり）| `packages/app/application/frame/stages/interaction-placement-handler.ts:230` |
| 255 | サドル・乗り物モブなし | SADDLE が `item-type.ts` に未定義。HORSE/DONKEY が EntityType に未定義。モブ騎乗メカニクスなし | `packages/core/domain/item-type.ts` |
| 256 | エリトラアイテム存在するがグライドなし | ELYTRA は `item-type.ts:58` に定義あり（エンドシティのドロップ）。グライド中の揚力・速度計算・落下キャンセルのメカニクスなし | `packages/core/domain/item-type.ts:58` |
| 257 | 砂利が常にフリント 100% ドロップ（公式は 10%）| `block-service.config.ts:140`：GRAVEL→FLINT の固定マッピング。公式 Java Edition の 10% 確率とは異なる確定ドロップ（コメント "not random but we keep drops pure/replayable"）| `packages/world/application/block-service.config.ts:140` |
| 258 | ピストンブロック未実装（キーバインドのみ）| `frame-handler.config.ts:45`：`REDSTONE_PLACE_PISTON_KEY='KeyP'` はあるが、`interaction-redstone-handler.ts:40` は Piston コンポーネント登録のみ。実際のブロック押し出し・引き込みロジックなし | `packages/app/application/frame-handler.config.ts:45` |
| 259 | シュルカーボックスに GUI・収納なし | SHULKER_BOX は `block-type.ts:77` に定義ありエンドシティ装飾に使用。右クリックで 27 スロット収納インベントリを開くハンドラなし | `packages/core/domain/block-type.ts:77` |
| 260 | マップアイテムなし | MAP/FILLED_MAP が `item-type.ts` に未定義。ミニマップ・ワールドマップ描画なし | `packages/core/domain/item-type.ts` |
| 261 | エンチャント相互排他なし | `enchantment.config.ts` に排他グループ定義なし。公式で同一アイテムに付与不可の SHARPNESS+SMITE+BANE_OF_ARTHROPODS や PROTECTION 系の重複付与が可能 | `packages/inventory/domain/enchantment.config.ts` |
| 262 | トライデントなし | TRIDENT が `item-type.ts` に未定義。投擲→攻撃→帰還メカニクスなし | `packages/core/domain/item-type.ts` |
| 263 | クロスボウなし | CROSSBOW が `item-type.ts` に未定義 | `packages/core/domain/item-type.ts` |
| 264 | 望遠鏡（スパイグラス）・ズームなし | SPYGLASS が `item-type.ts` に未定義。視野角ズームメカニクスなし | `packages/core/domain/item-type.ts` |
| 265 | マルチプレイのプレイヤーリスト（TAB キー）なし | `multiplayer-stage.ts:9`：位置/ブロック編集同期のみ。TAB キーで接続中プレイヤー一覧を表示する UI なし | `packages/app/application/frame/stages/multiplayer-stage.ts:9` |
| 266 | 馬・ロバモブなし | HORSE/DONKEY が EntityType に未定義。騎乗・装備・テイムメカニクスなし | `packages/entity/domain/mob/entity.ts` |
| 267 | エンド湧き出し台の高度が非公式（y=64 vs 公式 y≈49）| `end-generator.ts:14`：`END_SURFACE_Y=64` で湧き出し台を y=64 に生成。公式 Java Edition の湧き出し台は y≈49 | `packages/world/domain/terrain/end-generator.ts:14` |
| 268 | 水流でトーチ等が消滅 | 水フルイドの置換対象に TORCH/REDSTONE_TORCH/REDSTONE_WIRE/WHEAT_CROP を追加。流体 tick で対象ブロックへ流れ込むと WATER に置換される | `packages/world/application/fluid-service.ts`, `packages/world/application/block-support.ts`, `packages/world/test/fluid-service-tick.test.ts` |
| 269 | クォーツブロック等装飾石材なし | QUARTZ_BLOCK/QUARTZ_PILLAR が `block-type.ts` に未定義。COAL_BLOCK（`block-type.ts:37`）のみ存在し、クォーツ系装飾ブロックなし | `packages/core/domain/block-type.ts:37` |
| 270 | クリーパー導火線フラッシュ実装済み | `Entity.fuseSecs` を公開スナップショットへ通し、InstancedMesh の per-instance color で起爆前の白フラッシュを描画する。導火線更新時の cached public entity も dirty 化済み | `packages/entity/domain/mob/entity.ts`, `packages/entity/application/mob/entity-manager-internal-update.ts`, `packages/rendering/infrastructure/entity/entity-renderer.ts`, `packages/rendering/infrastructure/entity/entity-instance-pool.ts`, `packages/rendering/test/entity-renderer.test.ts` |
| 271 | スケルトンの矢が物理エンティティではない | Skeleton は接触ダメージから分離され、`getPlayerRangedDamage` で 12 ブロック以内に 2 ダメージの射撃判定とクールダウンを行う。frame path は cached solid-block blocker を渡すため壁越し射撃は遮蔽される。ただし矢の飛翔・弾道・視覚エンティティ・刺さった矢は未実装 | `packages/entity/application/mob/entity-manager-internal.ts:138`, `packages/entity/domain/mob/mobs/skeleton.ts:4`, `packages/app/application/frame/stages/physics-stage.ts:173`, `packages/app/application/frame/stages/physics-stage.test.ts:492`, `packages/entity/test/mob/entity-manager.test.ts:281` |
| 272 | エンダーマン視線プロボーク実装済み | カメラ forward ベクトルが Enderman 上半身の判定半径を横切ると内部 `isProvoked` を保持し、以後 Chase/Attack と接触ダメージを有効化。攻撃された場合も敵対化。ブロックキャッシュの solid/passable 判定を使い、眼から上半身ターゲットまでのサンプル線分が遮蔽される場合はプロボークしない | `packages/entity/domain/mob/enderman-anger.ts`, `packages/entity/application/mob/entity-manager-internal-update.ts`, `packages/app/application/frame/stages/entity-update-stage.ts`, `packages/entity/test/enderman-anger.test.ts`, `packages/entity/test/mob/entity-manager.test.ts` |
| 273 | F3 デバッグ画面実装済み | `debug-overlay.ts:81`：F3 キーで座標 (x/y/z)・向き・バイオーム・FPS・ロード済みチャンク数・時刻のオーバーレイ表示 | `packages/presentation/hud/debug-overlay.ts:81` |
| 274 | 金のリンゴが 4HP 回復（公式準拠）| `interaction-item-use-handler.ts:75`：GOLDEN_APPLE 消費時に `healthService.heal(4)`。公式の即時回復ハート 2 個分に一致 | `packages/app/application/frame/stages/interaction-item-use-handler.ts:75` |
| 275 | シールドの右クリックブロックが実装済み | `interaction-stage.ts:169`：SHIELD 装備中の右クリックでブロッキング状態を設定。`physics-stage.ts:113`：ブロッキング中は受ダメージを 66% 軽減しシールドの耐久度を 1 減少 | `packages/app/application/frame/stages/physics-stage.ts:113` |
| 276 | ドラゴンエッグのランダムテレポートが実装済み | `dragon-egg.ts:16`：右クリックまたは破壊試行でランダムオフセット（水平 15 ブロック・垂直 7 ブロック）内にテレポート | `packages/block/domain/dragon-egg.ts:16` |
| 277 | ネザー天井が y=127 のベドロックで閉鎖 | `nether-generator.ts:12`：`NETHER_CEILING_Y=127`、y=124〜126 に確率的ベドロック生成。公式 Java Edition の天井構造に準拠 | `packages/world/domain/terrain/nether-generator.ts:12` |
| 278 | エンチャント最大レベルが公式準拠 | `enchantment.config.ts:6`：PROTECTION max 4・SHARPNESS max 5・EFFICIENCY max 5・FORTUNE max 3・POWER max 5。すべて公式 Java Edition の上限と一致 | `packages/inventory/domain/enchantment.config.ts:6` |
| 279 | XP オーブエンティティなし（即時加算）| モブ撃破時に XP オーブが空中に浮いてプレイヤーへ引き寄せられる演出なし。`xpService.addXP()` が即時にバーへ加算 | `packages/app/application/frame/stages/interaction-break-handler.ts:66` |
| 280 | 浮遊アイテムエンティティなし（インベントリ直行）| ブロック破壊・モブ死亡時にアイテムが 3D で地面に落下して回収待ちになるメカニクスなし。`inventoryService.addBlock()` で即インベントリへ直行 | `packages/world/application/block-service.ts:124` |
| 281 | 死亡時インベントリドロップなし（消去のみ）| サバイバル死亡時にアイテムをエンティティとして地面にばらまかず、インベントリを消去するのみ。コメントに "Phase-1: Phase 3 will add drops" と明記 | `packages/presentation/menu/death-screen.ts:18` |
| 282 | 要塞（Stronghold）生成なし | オーバーワールド地下の要塞・エンドポータルルーム構造物生成ジェネレータなし | `packages/world/domain/terrain/` |
| 283 | ダンジョン（モブスポナー+宝箱部屋）生成なし | 小石の部屋＋モブスポナー＋宝箱からなる地下ダンジョン構造物なし | `packages/world/domain/terrain/` |
| 284 | 廃坑（Mineshaft）生成なし | 木材と線路の廃坑ネットワーク地下構造なし | `packages/world/domain/terrain/` |
| 285 | 砂漠・ジャングル・海の神殿なし | サーフェス構造物（砂漠の神殿・ジャングルの神殿・魔女小屋）生成ジェネレータなし | `packages/world/domain/terrain/` |
| 286 | 海底神殿（Ocean Monument）生成なし | 海中に生成される大型構造物なし。エルダーガーディアンも未定義 | `packages/world/domain/terrain/` |
| 287 | F1 キーで HUD 非表示実装済み | `KeyMappings.HUD_TOGGLE='F1'` を `input-stage.ts` で消費し、`body.hud-hidden` でFPS/体力/空腹/防具/酸素/破壊バー/XP/クロスヘア/デバッグDOMを非表示化。`hud-stage.ts` は同じ状態で Three.js ホットバー描画も抑制 | `packages/entity/domain/key-mappings.ts`, `packages/app/application/frame/stages/input-stage.ts`, `index.html`, `packages/app/application/frame/stages/hud-stage.ts` |
| 288 | クラフト UI がグリッドではなくリスト形式 | インベントリ画面の 2×2・クラフトテーブルの 3×3 グリッドが視覚的に存在せず、テキストベースのレシピリスト（ボタン選択式）として実装。公式の直感的なグリッド UI なし | `packages/presentation/inventory/inventory-renderer-dom.ts:47` |
| 289 | レシピブック UI なし | インゲームでクラフトレシピを一覧・検索できるレシピブックなし | `packages/presentation/inventory/` |
| 290 | インベントリソートなし | インベントリ画面にソートボタン・キーバインドなし | `packages/presentation/inventory/inventory-renderer.ts` |
| 291 | アイテムホバーツールチップなし | インベントリ内アイテムにマウスオーバーしても名称・エンチャント一覧を表示するツールチップなし | `packages/presentation/inventory/inventory-renderer.ts` |
| 292 | 銅ブロック・酸化メカニクスなし | COPPER/COPPER_ORE/EXPOSED_COPPER 等が `block-type.ts` に未定義。時間経過による緑青（酸化）・ロウ付け(Wax)なし | `packages/core/domain/block-type.ts` |
| 293 | ネザーポータル通過後の再入場クールダウンなし | `physics-stage-portal.ts:8` の PORTAL_ACTIVATION_SECS=4.0 は入場時のみ。出口側ポータルで即座に逆方向へ戻れる（行き来ループ防止なし）| `packages/app/application/frame/stages/physics-stage-portal.ts:8` |
| 294 | リスポーンアンカー（ネザー拠点）なし | RESPAWN_ANCHOR が `block-type.ts` に未定義。ネザーでの拠点リスポーン設定なし | `packages/core/domain/block-type.ts` |
| 295 | 1.15〜1.20 新規モブ未実装 | BEE・AXOLOTL・FOX・GOAT・FROG・TADPOLE・ALLAY・WARDEN・CAMEL 等がすべて EntityType に未定義。実装モブは 17 種のみ | `packages/entity/domain/mob/entity.ts:11` |
| 296 | バンドルアイテムなし | BUNDLE が `item-type.ts` に未定義。複数種のアイテムを 1 スタックにまとめる収納アイテムなし | `packages/core/domain/item-type.ts` |
| 297 | Swift Sneak・Soul Speed エンチャントなし | `enchantment.config.ts` の 17 種一覧に SWIFT_SNEAK・SOUL_SPEED 未定義。1.17/1.19 追加エンチャントなし | `packages/inventory/domain/enchantment.config.ts` |
| 298 | ネザライト装備ティアなし | NETHERITE_INGOT が `item-type.ts` に未定義。NETHERITE 系ツール・武器・鎧のクラフト・鍛冶テーブル強化なし | `packages/core/domain/item-type.ts` |
| 299 | 鍛冶テーブル・アーマートリムなし | SMITHING_TABLE が `block-type.ts` に未定義。ダイヤ装備のネザライト強化・コスメティックトリムシステムなし | `packages/core/domain/block-type.ts` |
| 300 | インベントリ開閉 SE | **実装済み** — `sound-manager.config.ts` に inventoryOpen/inventoryClose を追加し、KeyE の開閉と Escape のインベントリ閉じで再生 | `packages/game/application/sound-manager.config.ts`; `packages/app/application/frame/stages/input-stage.ts` |
| 301 | ブロック種別ごとの効果音なし | `sound-manager.config.ts:11`：blockBreak=220Hz・blockPlace=320Hz の 2 音のみ。石・木・砂・金属で異なる音色の使い分けなし | `packages/game/application/sound-manager.config.ts:11` |
| 302 | ツール種別ハーベスト制限が実装済み | `interaction-break-handler.ts:178`：`canHarvestBlock()` で DIAMOND_PICKAXE_HARVESTABLE_BLOCKS（石・鉱石等）を正しいツールティアなしで採掘するとドロップしない | `packages/app/application/frame/stages/interaction-break-handler.ts:178` |
| 303 | ブロック硬度・採掘時間が実装済み | `break-speed.ts:22`：`HARDNESS_BY_TYPE` で全ブロックに個別硬度値設定。`computeBreakTicks()` で `ceil(hardness×3/speedMult)` を計算 | `packages/block/domain/break-speed.ts:22` |
| 304 | シルクタッチで鉱石そのままドロップ | `block-service.ts:121`：`silkTouch===true` のとき `blockType` 自体を dropItem に設定（DIAMOND_ORE→DIAMOND_ORE）| `packages/world/application/block-service.ts:121` |
| 305 | フォーチュンで鉱石ドロップ増加 | `interaction-break-handler.ts:91`：`rollFortuneExtraDrops(fortune.level, Math.random())` で鉱石ドロップを乗算。対象ブロックは `FORTUNE_ORE_BLOCKS` で管理 | `packages/app/application/frame/stages/interaction-break-handler.ts:91` |
| 306 | F5 三人称カメラ切替が実装済み | `key-mappings.ts:15`：`CAMERA_TOGGLE='F5'` でファーストパーソン/サードパーソンを切替 | `packages/entity/domain/key-mappings.ts:15` |
| 307 | 釣りのバイト待機メカニクス実装済み | `fishing-service.ts:32`：`resolveFishingWaitSecs()` でランダム待機秒数を決定し `elapsedSecs` を累積。`targetSecs` 到達でバイト発生 | `packages/entity/application/fishing-service.ts:32` |
| 308 | 満腹時に食事不可（公式準拠）| `interaction-item-use-handler.ts:70`：`if (hunger.foodLevel >= MAX_FOOD_LEVEL) return false` で満腹時の食事をガード | `packages/app/application/frame/stages/interaction-item-use-handler.ts:70` |
| 309 | マルチプレイでリモートプレイヤーの名前タグを表示 | `remote-player-renderer.ts:107`：リモートプレイヤーモデル上に `createNameTag(state.playerName)` でプレイヤー名を描画 | `packages/rendering/infrastructure/player/remote-player-renderer.ts:107` |
| 310 | マルチプレイでブロック編集がリアルタイム同期 | `multiplayer-stage.ts:26`：`applyInboundBlockEdits()` でリモートプレイヤーのブロック破壊/設置をローカルに反映しチャンクを再メッシュ | `packages/app/application/frame/stages/multiplayer-stage.ts:26` |
| 311 | 難易度設定が実装済み（Peaceful/Easy/Normal/Hard）| `SettingsSchema`/`GameSettings` に difficulty を追加しデフォルトは normal。physics で敵接触ダメージと飢餓ダメージを難易度別に調整し、maintenance で peaceful の hostile spawn を抑止 | `packages/game/application/settings-service.ts`, `packages/app/application/frame/stages/physics-stage.ts`, `packages/app/application/frame/frame-maintenance.ts` |
| 312 | 植えられる作物が小麦のみ（人参・ジャガイモ等なし）| `block-codec.ts:39` に FARMLAND・WHEAT_CROP のみ。CARROT/POTATO/BEETROOT/MELON/PUMPKIN の農地作物なし | `packages/core/domain/block-codec.ts:39` |
| 313 | マルチプレイでモブ状態が同期しない | `multiplayer-stage.ts:9` はブロック編集のみ同期。エンティティ位置・HP・死亡がリモートプレイヤーに伝播しない | `packages/app/application/frame/stages/multiplayer-stage.ts:9` |
| 314 | スプリント攻撃ボーナスノックバック実装済み | 前進＋スプリント＋非スニークの近接攻撃時、通常/エンチャントの水平ノックバック倍率へ走り攻撃ボーナスを加算。通常攻撃との差分を単体テストで固定 | `packages/app/application/frame/stages/interaction-melee-handler.ts:89` / `packages/entity/domain/combat.ts:139` |
| 315 | 窒息ダメージ実装済み | 頭位置のブロックを環境ダメージ経路で確認し、窒息対象の固体ブロック内では 0.5 秒ごとに 1 ダメージを適用する。非窒息ブロックとクリエイティブでは蓄積をリセット | `packages/app/application/frame/stages/physics-stage.ts`, `packages/entity/domain/environment-hazard.ts` |
| 316 | 虚空ダメージ実装済み | Y 座標が `VOID_DAMAGE_Y`（-64）未満のとき、落下距離とは別に 0.5 秒ごとに 4 ダメージを適用する。境界値はテストで保護 | `packages/app/application/frame/stages/physics-stage.ts`, `packages/entity/domain/environment-hazard.ts`, `packages/app/application/frame/stages/physics-stage.test.ts` |
| 317 | モブグリーフィングなし | クリーパー爆発で地形ブロックが破壊されない（パーティクル・サウンドのみ）。エンダーマンのブロック持ち去りメカニクスなし | `packages/app/application/frame/stages/physics-stage.ts` |
| 318 | 雪バイオームでの雪積もりなし | WeatherService に snow 状態あり、SNOW ブロックも定義済み。降雪で地形上面に SNOW ブロックが積もるタイマーティックなし | `packages/game/application/weather-service.ts` |
| 319 | 草の伝播が実装済み（DIRT→GRASS 自動変換）| `collectGrassSpreadTargets()` が loaded chunk 内の DIRT + 上 AIR + 水平 GRASS 隣接を検出し、maintenance の world block tick で `BlockService.forceSetBlock(..., 'GRASS')` に適用 | `packages/world/domain/grass-spread.ts`, `packages/app/application/frame/frame-maintenance.ts` |
| 320 | インゲームでのゲームモード切替コマンドなし | `game-mode-service.ts:17` は get/set を提供するが、ゲーム中に `/gamemode` コマンドで切り替えるコマンドパーサーなし。ワールド作成時のみ選択可 | `packages/game/application/game-mode-service.ts:17` |
| 321 | モブのアイドルサウンドなし | `sound-manager.config.ts` に mobHurt・mobDeath のみ。牛の鳴き声・豚のオインク・ゾンビのうめき声等のアンビエント SE なし | `packages/game/application/sound-manager.config.ts:10` |
| 322 | 足音サウンド実装済み | `footstepGrass`/`footstepStone`/`footstepWood` を SoundManager に定義し、物理ステージが接地中の水平移動距離から歩行/スプリント間隔で足音を再生する | `packages/app/application/frame/stages/physics-stage.ts`, `packages/game/application/sound-manager.config.ts` |
| 323 | 洞窟アンビエントサウンドなし | `music-manager.config.ts:12`：洞窟（Y<40）は BGM トラックのみ。水滴・洞窟エコー等の効果音なし | `packages/game/application/music-manager.config.ts:12` |
| 324 | バイオーム別 BGM なし | `music-manager.ts:12`：音楽切替は昼夜と深度（Y<40）のみ。海洋・ネザー・エンド固有の BGM トラックなし | `packages/game/application/music-manager.ts:12` |
| 325 | エンダードラゴン再召喚なし | 4 つのエンドクリスタルを End 天頂の柱に置いてドラゴンを再召喚するメカニクスなし | `packages/entity/domain/mob/ender-dragon/` |
| 326 | エンダーパール投擲でエンダーマイト湧きなし | `endermite.ts:4` コメントに "spawns from ender pearl throws" と明記されているが実装なし。投擲システム自体も未実装 | `packages/entity/domain/mob/mobs/endermite.ts:4` |
| 327 | コウモリ（BAT）Mob 実装済み | `BatDefinition` を追加し、EntityType・PASSIVE_MOBS・既存受動スポーンローテーション・ドロップなし/XPなし・簡易 Mob 描画に対応。飛行AI・洞窟暗所スポーンは未実装 | `packages/entity/domain/mob/mobs/bat.ts`, `packages/entity/domain/mob/mob-categories.ts`, `packages/rendering/infrastructure/entity/mob-geometry.ts` |
| 328 | イカ（SQUID）Mob 実装済み | `SquidDefinition` を追加し、EntityType・INK_SAC ドロップ・PASSIVE_MOBS・既存受動スポーンローテーション・簡易 Mob 描画に対応。Glow Squid と水中限定スポーン/泳ぎAIは未実装 | `packages/entity/domain/mob/mobs/squid.ts`, `packages/core/domain/item-type.ts`, `packages/rendering/infrastructure/entity/mob-geometry.ts` |
| 329 | ウィッチ（WITCH）Mob 実装済み | `WitchDefinition` を追加し、EntityType・HOSTILE_MOBS・既存敵対スポーンローテーション・簡易 Biped 描画に対応。ドロップは既存 ItemType の REDSTONE_DUST/GLOWSTONE_DUST/SPIDER_EYE/STICKS に限定。ポーション投擲AI・回復/耐性ポーション・専用ポーションアイテム/確率ドロップは未実装 | `packages/entity/domain/mob/mobs/witch.ts`, `packages/entity/domain/mob/mob-categories.ts`, `packages/rendering/infrastructure/entity/mob-geometry.ts` |
| 330 | ドラウンド（水中ゾンビ）Mob 実装済み | `DrownedDefinition` を追加し、EntityType・HOSTILE_MOBS・UNDEAD_MOB_TYPES・既存敵対スポーンローテーション・簡易 Biped 描画に対応。ドロップは既存 ItemType の ROTTEN_FLESH/RAW_COD に限定。水中限定スポーン/泳ぎAI・ゾンビ変換・TRIDENT/銅/オウムガイ殻ドロップ・トライデント投擲は未実装 | `packages/entity/domain/mob/mobs/drowned.ts`, `packages/entity/domain/mob/mob-categories.ts`, `packages/entity/domain/combat.ts`, `packages/rendering/infrastructure/entity/mob-geometry.ts` |
| 331 | 氷（ICE）ブロック基本実装済み | ICE を BlockType / codec index 88 / 初期ブロック / 衝突 / 仮タイル描画に追加し、寒冷バイオームの水面を ICE 化。滑走摩擦はゲーム物理へ接続済み。光源融解・Silk Touch ドロップは未実装 | `packages/core/domain/block-type.ts`, `packages/world/domain/terrain/lake-generator.ts`, `packages/game/application/game-state-physics.ts` |
| 332 | ゾンビビレジャー Mob 実装済み / 村人キュアなし | `ZombieVillagerDefinition` を追加し、EntityType・HOSTILE_MOBS・UNDEAD_MOB_TYPES・既存敵対スポーンローテーション・簡易 Biped 描画に対応。ドロップと戦闘値は Zombie 相当。弱化ポーション + 金のリンゴでの村人キュア、村人感染/変換、職業保持、村人ドメインとの連携は未実装 | `packages/entity/domain/mob/mobs/zombie-villager.ts`, `packages/entity/domain/mob/mob-categories.ts`, `packages/entity/domain/combat.ts`, `packages/rendering/infrastructure/entity/mob-geometry.ts` |
| 333 | 火炎アスペクト（FIRE_ASPECT）エンチャント実装済み | FIRE_ASPECT をエンチャント型・最大レベル 2・剣適用対象へ追加。近接攻撃で生存した対象を 4 秒/レベル燃焼させ、EntityManager が `fireSecs` を公開し、燃焼 1 秒ごとに 1 ダメージ、致死時は削除 | `packages/inventory/domain/enchantment.types.ts`, `packages/inventory/domain/enchantment.config.ts`, `packages/inventory/domain/enchantment.ts`, `packages/app/application/frame/stages/interaction-melee-handler.ts`, `packages/entity/application/mob/entity-manager-internal.ts`, `packages/entity/application/mob/entity-manager-internal-update.ts` |
| 334 | 一人称手持ちアイテムの 3D 表示を実装済み | `HotbarRendererService` が選択中ホットバー item から first-person held item scene を生成し、ブロックは atlas UV 付き cube、道具/食料などは atlas UV 付き flat model として右下前方に perspective overlay 描画。未選択/空スロット/AIR は非表示 | `packages/presentation/hud/hotbar-three.ts`, `packages/presentation/hud/hotbar-three.test.ts` |
| 335 | ワールドシードによる完全再現可能な地形生成 | `session-world-loader.ts:17`：`noiseService.setSeed(metadata.seed)` で同一シードから同一地形を再現可能 | `packages/app/application/main/session-world-loader.ts:17` |
| 336 | 複数ワールドの作成・一覧・削除が実装済み | `main-menu-handlers.ts:58`：listWorldMetadata（最終プレイ順）・:176（新規作成）・:118（削除 + 確認ダイアログ）。名前変更は未実装 | `packages/presentation/menu/main-menu-handlers.ts:58` |
| 337 | ?world= URL パラメータでメインメニューをスキップ | `main.ts:49`：`parseWorldParam()` でワールド ID を取得し直接セッションを開始。テスト自動化に活用可能 | `src/main.ts:49` |
| 338 | 骨粉（BONE_MEAL）で作物を 2 ステージ即時成長 | `interaction-farming-handler.ts:86`：BONE_MEAL 使用で `cropGrowthService.advanceCrop(pos, BONE_MEAL_ADVANCE=2)` | `packages/app/application/frame/stages/interaction-farming-handler.ts:86` |
| 339 | スペクテーターモードのブロック貫通（ノークリップ）実装済み | `game-state-physics.ts`：`resolveCollisionOrNoclipInto` がスペクテーター時は衝突解決をスキップ。`physics-stage.ts:85` でスペクテーター時の全ダメージもガード | `packages/game/application/game-state-physics.ts` |
| 340 | エンドシティ構造物生成済み | `end-city-generator.ts:104`：`placeCity()` で塔・橋・エンドシップを End 次元に生成 | `packages/world/domain/terrain/end-city-generator.ts:104` |
| 341 | エンドシップとエリトラチェストが生成される | `end-city-generator.ts:84`：`placeEndShip()` でエンドシップ構造を配置。`line 96` に ELYTRA プレースホルダーとして chest ブロックを設置 | `packages/world/domain/terrain/end-city-generator.ts:84` |
| 342 | コーラスプラント・フラワーが手続き的に成長 | `chorus-plant.ts:49`：`growChorusPlant()` でランダムな分岐と高さを生成。CHORUS_FLOWER・CHORUS_PLANT ともに `block-type.ts:65` に定義 | `packages/block/domain/chorus-plant.ts:49` |
| 343 | ノックバックエンチャントが近接攻撃に適用済み | `enchantment.config.ts:10`：KNOCKBACK max 2 定義。`interaction-melee-handler.ts:86`：`getKnockbackHorizontalMultiplier(level)` でノックバック距離を乗算 | `packages/inventory/domain/enchantment.config.ts:10` |
