# Nether Portals - 異次元システム

## 概要

Nether Portalsシステムは、Minecraft クローンにおける異次元間の移動システムを実装します。このシステムは、ポータルの構築・アクティベーション、座標変換アルゴリズム、異次元環境の管理、およびポータルリンクシステムを提供し、プレイヤーに本格的な異次元体験を届けます。

Effect-TS 3.17+の最新機能を活用し、純粋関数型プログラミングとDDDアーキテクチャに基づいて設計されています。

## システム要件

### 機能要件
- **ポータル構築システム**: オブシディアンフレームの自動検出と構築
- **アクティベーションシステム**: 火打ち石による点火メカニズム
- **座標変換システム**: オーバーワールドとネザー間の座標計算（1:8比率）
- **異次元環境管理**: ネザー固有の地形生成とバイオーム
- **ポータルリンク管理**: ポータル間の自動リンクとルーティング
- **異次元エンティティ**: ネザー固有のMobとスポーンシステム
- **並列チャンク処理**: 複数次元の同時読み込み
- **状態同期**: 次元間での状態保持

### 非機能要件
- **パフォーマンス**: ポータル移動時の遅延 < 100ms
- **メモリ効率**: 非アクティブ次元のメモリ開放
- **並行性**: 複数プレイヤーの同時次元移動
- **一貫性**: 次元間でのアイテム・状態保持

## アーキテクチャ設計

### システム構成

```
NetherPortalSystem
├── DimensionManager     # 次元管理
├── PortalEngine         # ポータル制御
├── CoordinateTransform  # 座標変換
├── PortalLinking        # ポータルリンク
├── DimensionLoader      # 次元読み込み
└── NetherGenerator      # ネザー生成
```

### コアモデル

```typescript
import { Schema } from "@effect/schema";
import { Brand, Context, Effect, Layer, Option, STM, Match } from "effect";

// === ドメインモデル ===

export type DimensionId = Brand.Brand<string, "DimensionId">;
export const DimensionId = Brand.nominal<DimensionId>();

export type PortalId = Brand.Brand<string, "PortalId">;
export const PortalId = Brand.nominal<PortalId>();

export interface WorldCoordinate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly dimensionId: DimensionId;
}

export const WorldCoordinateSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  dimensionId: Schema.String.pipe(Schema.brand(DimensionId))
});

export interface PortalFrame {
  readonly corners: readonly [WorldCoordinate, WorldCoordinate];
  readonly orientation: "x" | "z";
  readonly isValid: boolean;
}

export const PortalFrameSchema = Schema.Struct({
  corners: Schema.Tuple(WorldCoordinateSchema, WorldCoordinateSchema),
  orientation: Schema.Literal("x", "z"),
  isValid: Schema.Boolean
});

export interface Portal {
  readonly id: PortalId;
  readonly frame: PortalFrame;
  readonly isActive: boolean;
  readonly linkedPortalId: Option.Option<PortalId>;
  readonly lastUsed: number;
}

export const PortalSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(PortalId)),
  frame: PortalFrameSchema,
  isActive: Schema.Boolean,
  linkedPortalId: Schema.OptionFromNullOr(Schema.String.pipe(Schema.brand(PortalId))),
  lastUsed: Schema.Number
});

export interface DimensionInfo {
  readonly id: DimensionId;
  readonly name: string;
  readonly coordinateScale: number;
  readonly hasRoof: boolean;
  readonly hasSkylight: boolean;
  readonly ambientLight: number;
}

export const DimensionInfoSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(DimensionId)),
  name: Schema.String,
  coordinateScale: Schema.Number,
  hasRoof: Schema.Boolean,
  hasSkylight: Schema.Boolean,
  ambientLight: Schema.Number
});
```

## システム実装

### 1. Portal Engine - ポータルエンジン

```typescript
import { Effect, STM, TRef, TMap } from "effect";

export interface PortalEngine {
  readonly detectPortalFrame: (
    position: WorldCoordinate
  ) => Effect.Effect<Option.Option<PortalFrame>, PortalError>;

  readonly activatePortal: (
    frame: PortalFrame,
    activatorPosition: WorldCoordinate
  ) => Effect.Effect<Portal, PortalError>;

  readonly deactivatePortal: (
    portalId: PortalId
  ) => Effect.Effect<void, PortalError>;

  readonly teleportEntity: (
    entityId: EntityId,
    sourcePortalId: PortalId
  ) => Effect.Effect<WorldCoordinate, PortalError>;
}

export const PortalEngine = Context.GenericTag<PortalEngine>("PortalEngine");

const makePortalEngineImpl = Effect.gen(function* () {
  const portals = yield* TRef.make(TMap.empty<PortalId, Portal>())
  const blockSystem = yield* BlockSystem
  const coordinateTransform = yield* CoordinateTransform
  const portalLinking = yield* PortalLinking

  return PortalEngine.of({

    detectPortalFrame: (
      position: WorldCoordinate
    ): Effect.Effect<Option.Option<PortalFrame>, PortalError> =>
      Effect.gen(function* () {
        // オブシディアンブロックの検出
        const obsidianPositions = yield* scanForObsidian(position);

        // 早期リターン: オブシディアンが不十分な場合
        if (obsidianPositions.length < 10) {
          return Option.none();
        }

        // フレーム形状の検証
        const frame = yield* validatePortalFrame(obsidianPositions);

        return frame;
      }),

  private scanForObsidian = (
    center: WorldCoordinate,
    radius: number = 10
  ): Effect.Effect<readonly WorldCoordinate[], PortalError> =>
    Effect.gen(this, function* () {
      const positions: WorldCoordinate[] = [];

      for (let x = center.x - radius; x <= center.x + radius; x++) {
        for (let y = center.y - radius; y <= center.y + radius; y++) {
          for (let z = center.z - radius; z <= center.z + radius; z++) {
            const pos: WorldCoordinate = { x, y, z, dimensionId: center.dimensionId };
            const block = yield* this.blockSystem.getBlock(pos);

            if (block.blockType === "obsidian") {
              positions.push(pos);
            }
          }
        }
      }

      return positions;
    });

  private validatePortalFrame = (
    obsidianPositions: readonly WorldCoordinate[]
  ): Effect.Effect<Option.Option<PortalFrame>, PortalError> =>
    Effect.gen(this, function* () {
      // 矩形フレームの検出（最小サイズ: 4x5, 最大サイズ: 23x23）
      const frames = yield* this.findRectangularFrames(obsidianPositions);

      for (const frame of frames) {
        const isValid = yield* this.validateFrameStructure(frame);
        if (isValid) {
          return Option.some(frame);
        }
      }

      return Option.none();
    });

  private findRectangularFrames = (
    positions: readonly WorldCoordinate[]
  ): Effect.Effect<readonly PortalFrame[], PortalError> =>
    Effect.gen(this, function* () {
      const frames: PortalFrame[] = [];

      // X軸方向のフレーム検出
      const xFrames = yield* this.detectFramesInDirection(positions, "x");
      frames.push(...xFrames);

      // Z軸方向のフレーム検出
      const zFrames = yield* this.detectFramesInDirection(positions, "z");
      frames.push(...zFrames);

      return frames;
    });

  activatePortal = (
    frame: PortalFrame,
    activatorPosition: WorldCoordinate
  ): Effect.Effect<Portal, PortalError> =>
    Effect.gen(this, function* () {
      // 火による点火の検証
      yield* this.validateIgnition(frame, activatorPosition);

      // 新しいポータルの作成
      const portalId = PortalId(crypto.randomUUID());
      const portal: Portal = {
        id: portalId,
        frame,
        isActive: true,
        linkedPortalId: Option.none(),
        lastUsed: Date.now()
      };

      // ポータルの登録
      yield* STM.commit(
        STM.gen(function* () {
          const portalsMap = yield* STM.readTRef(this.portals);
          yield* STM.writeTRef(this.portals, TMap.set(portalsMap, portalId, portal));
        })
      );

      // リンクポータルの検索・作成
      yield* this.portalLinking.linkPortal(portal);

      // ポータルブロックの生成
      yield* this.generatePortalBlocks(frame);

      return portal;
    });

  private validateIgnition = (
    frame: PortalFrame,
    activatorPosition: WorldCoordinate
  ): Effect.Effect<void, PortalError> =>
    Effect.gen(this, function* () {
      // 点火位置がフレーム内部かどうかチェック
      const isInsideFrame = this.isPositionInsideFrame(activatorPosition, frame);

      if (!isInsideFrame) {
        return yield* Effect.fail(new PortalError("Ignition must be inside portal frame"));
      }

      // 火ブロックの存在確認
      const fireBlock = yield* this.blockSystem.getBlock(activatorPosition);

      if (fireBlock.blockType !== "fire") {
        return yield* Effect.fail(new PortalError("Portal activation requires fire"));
      }
    });

  teleportEntity = (
    entityId: EntityId,
    sourcePortalId: PortalId
  ): Effect.Effect<WorldCoordinate, PortalError> =>
    Effect.gen(this, function* () {
      // ソースポータルの取得
      const sourcePortal = yield* this.getPortal(sourcePortalId);

      // リンクポータルの取得
      const targetPortal = yield* this.getLinkedPortal(sourcePortal);

      // 座標変換の実行
      const entityPosition = yield* this.getEntityPosition(entityId);
      const targetPosition = yield* this.coordinateTransform.transformCoordinate(
        entityPosition,
        sourcePortal,
        targetPortal
      );

      // テレポート実行
      yield* this.executeEntityTeleport(entityId, targetPosition);

      // ポータル使用時刻更新
      yield* this.updatePortalLastUsed(sourcePortalId);

      return targetPosition;
    });
}
```

### 2. Coordinate Transform - 座標変換システム

```typescript
export interface CoordinateTransform {
  readonly transformCoordinate: (
    sourcePosition: WorldCoordinate,
    sourcePortal: Portal,
    targetPortal: Portal
  ) => Effect.Effect<WorldCoordinate, CoordinateError>;

  readonly calculateNetherCoordinate: (
    overworldCoordinate: WorldCoordinate
  ) => Effect.Effect<WorldCoordinate, CoordinateError>;

  readonly calculateOverworldCoordinate: (
    netherCoordinate: WorldCoordinate
  ) => Effect.Effect<WorldCoordinate, CoordinateError>;
}

export const CoordinateTransform = Context.GenericTag<CoordinateTransform>("CoordinateTransform");

class CoordinateTransformImpl implements CoordinateTransform {
  private readonly NETHER_SCALE = 8;
  private readonly OVERWORLD_ID = DimensionId("overworld");
  private readonly NETHER_ID = DimensionId("nether");

  transformCoordinate = (
    sourcePosition: WorldCoordinate,
    sourcePortal: Portal,
    targetPortal: Portal
  ): Effect.Effect<WorldCoordinate, CoordinateError> =>
    Effect.gen(this, function* () {
      // ポータル内での相対位置を計算
      const relativePosition = this.calculateRelativePosition(sourcePosition, sourcePortal.frame);

      // ターゲットポータルでの絶対位置を計算
      const targetPosition = this.calculateAbsolutePosition(relativePosition, targetPortal.frame);

      // 安全な出現位置を検索
      const safePosition = yield* this.findSafeSpawnPosition(targetPosition);

      return safePosition;
    });

  calculateNetherCoordinate = (
    overworldCoordinate: WorldCoordinate
  ): Effect.Effect<WorldCoordinate, CoordinateError> =>
    Effect.gen(this, function* () {
      if (overworldCoordinate.dimensionId !== this.OVERWORLD_ID) {
        return yield* Effect.fail(new CoordinateError("Source must be overworld coordinate"));
      }

      const netherX = Math.floor(overworldCoordinate.x / this.NETHER_SCALE);
      const netherZ = Math.floor(overworldCoordinate.z / this.NETHER_SCALE);

      // Y座標は特別な処理（ネザーの高度制限）
      const netherY = Math.max(1, Math.min(127, Math.floor(overworldCoordinate.y / 2)));

      return {
        x: netherX,
        y: netherY,
        z: netherZ,
        dimensionId: this.NETHER_ID
      };
    });

  calculateOverworldCoordinate = (
    netherCoordinate: WorldCoordinate
  ): Effect.Effect<WorldCoordinate, CoordinateError> =>
    Effect.gen(this, function* () {
      if (netherCoordinate.dimensionId !== this.NETHER_ID) {
        return yield* Effect.fail(new CoordinateError("Source must be nether coordinate"));
      }

      const overworldX = netherCoordinate.x * this.NETHER_SCALE;
      const overworldZ = netherCoordinate.z * this.NETHER_SCALE;
      const overworldY = Math.max(1, Math.min(319, netherCoordinate.y * 2));

      return {
        x: overworldX,
        y: overworldY,
        z: overworldZ,
        dimensionId: this.OVERWORLD_ID
      };
    });

  private calculateRelativePosition = (
    entityPosition: WorldCoordinate,
    portalFrame: PortalFrame
  ): { x: number; y: number; z: number } => {
    const [corner1, corner2] = portalFrame.corners;
    const minX = Math.min(corner1.x, corner2.x);
    const maxX = Math.max(corner1.x, corner2.x);
    const minY = Math.min(corner1.y, corner2.y);
    const maxY = Math.max(corner1.y, corner2.y);
    const minZ = Math.min(corner1.z, corner2.z);
    const maxZ = Math.max(corner1.z, corner2.z);

    // フレーム内での相対位置（0.0-1.0の範囲）
    const relativeX = (entityPosition.x - minX) / (maxX - minX);
    const relativeY = (entityPosition.y - minY) / (maxY - minY);
    const relativeZ = (entityPosition.z - minZ) / (maxZ - minZ);

    return {
      x: Math.max(0, Math.min(1, relativeX)),
      y: Math.max(0, Math.min(1, relativeY)),
      z: Math.max(0, Math.min(1, relativeZ))
    };
  };

  private findSafeSpawnPosition = (
    targetPosition: WorldCoordinate
  ): Effect.Effect<WorldCoordinate, CoordinateError> =>
    Effect.gen(this, function* () {
      // 周辺のブロックをチェックして安全な位置を探す
      const searchRadius = 16;

      for (let y = targetPosition.y; y <= targetPosition.y + searchRadius; y++) {
        for (let radius = 0; radius <= searchRadius; radius++) {
          const candidates = this.generateSpawnCandidates(targetPosition, radius, y);

          for (const candidate of candidates) {
            const isSafe = yield* this.isPositionSafe(candidate);
            if (isSafe) {
              return candidate;
            }
          }
        }
      }

      // 安全な位置が見つからない場合はブロックを生成
      return yield* this.createSafePlatform(targetPosition);
    });
}
```

### 3. Portal Linking - ポータルリンクシステム

```typescript
export interface PortalLinking {
  readonly linkPortal: (
    portal: Portal
  ) => Effect.Effect<Option.Option<Portal>, LinkingError>;

  readonly findNearestPortal: (
    position: WorldCoordinate,
    dimension: DimensionId
  ) => Effect.Effect<Option.Option<Portal>, LinkingError>;

  readonly createLinkedPortal: (
    sourcePortal: Portal,
    targetDimension: DimensionId
  ) => Effect.Effect<Portal, LinkingError>;
}

export const PortalLinking = Context.GenericTag<PortalLinking>("PortalLinking");

class PortalLinkingImpl implements PortalLinking {
  private readonly LINKING_DISTANCE = 128;

  constructor(
    private readonly portals: TRef.TRef<TMap.TMap<PortalId, Portal>>,
    private readonly coordinateTransform: CoordinateTransform,
    private readonly portalEngine: PortalEngine,
    private readonly worldGenerator: WorldGenerator
  ) {}

  linkPortal = (
    portal: Portal
  ): Effect.Effect<Option.Option<Portal>, LinkingError> =>
    Effect.gen(this, function* () {
      // 対応次元の決定
      const targetDimension = yield* this.getTargetDimension(portal.frame.corners[0].dimensionId);

      // 対応座標の計算
      const targetCoordinate = yield* this.calculateTargetCoordinate(portal, targetDimension);

      // 既存ポータルの検索
      const existingPortal = yield* this.findNearestPortal(targetCoordinate, targetDimension);

      if (Option.isSome(existingPortal)) {
        // 既存ポータルとのリンク
        yield* this.establishLink(portal, existingPortal.value);
        return existingPortal;
      } else {
        // 新しいポータルの作成
        const newPortal = yield* this.createLinkedPortal(portal, targetDimension);
        return Option.some(newPortal);
      }
    });

  findNearestPortal = (
    position: WorldCoordinate,
    dimension: DimensionId
  ): Effect.Effect<Option.Option<Portal>, LinkingError> =>
    Effect.gen(this, function* () {
      const portalsMap = yield* STM.readTRef(this.portals);
      const allPortals = TMap.values(portalsMap);

      let nearestPortal: Option.Option<Portal> = Option.none();
      let nearestDistance = Infinity;

      for (const portal of allPortals) {
        if (portal.frame.corners[0].dimensionId === dimension && portal.isActive) {
          const distance = this.calculateDistance(position, portal.frame.corners[0]);

          if (distance < nearestDistance && distance <= this.LINKING_DISTANCE) {
            nearestDistance = distance;
            nearestPortal = Option.some(portal);
          }
        }
      }

      return nearestPortal;
    });

  createLinkedPortal = (
    sourcePortal: Portal,
    targetDimension: DimensionId
  ): Effect.Effect<Portal, LinkingError> =>
    Effect.gen(this, function* () {
      // ターゲット位置の計算
      const targetPosition = yield* this.calculateTargetCoordinate(sourcePortal, targetDimension);

      // ポータル生成に適した位置の検索
      const portalLocation = yield* this.findPortalGenerationLocation(targetPosition);

      // 地形の生成・修正
      yield* this.preparePortalSite(portalLocation);

      // ポータルフレームの生成
      const portalFrame = yield* this.generatePortalFrame(portalLocation);

      // ポータルの作成とアクティベーション
      const newPortal = yield* this.portalEngine.activatePortal(
        portalFrame,
        this.getFrameCenter(portalFrame)
      );

      // 相互リンクの確立
      yield* this.establishLink(sourcePortal, newPortal);

      return newPortal;
    });

  private calculateTargetCoordinate = (
    sourcePortal: Portal,
    targetDimension: DimensionId
  ): Effect.Effect<WorldCoordinate, LinkingError> =>
    Effect.gen(this, function* () {
      const sourcePosition = sourcePortal.frame.corners[0];

      if (targetDimension === DimensionId("nether")) {
        return yield* this.coordinateTransform.calculateNetherCoordinate(sourcePosition);
      } else {
        return yield* this.coordinateTransform.calculateOverworldCoordinate(sourcePosition);
      }
    });

  private preparePortalSite = (
    location: WorldCoordinate
  ): Effect.Effect<void, LinkingError> =>
    Effect.gen(this, function* () {
      // 5x5の範囲で地面を平坦化
      const platformSize = 5;
      const platformY = location.y - 1;

      for (let x = -platformSize; x <= platformSize; x++) {
        for (let z = -platformSize; z <= platformSize; z++) {
          const blockPos: WorldCoordinate = {
            x: location.x + x,
            y: platformY,
            z: location.z + z,
            dimensionId: location.dimensionId
          };

          // ネザーレックまたは石のプラットフォームを作成
          const platformBlock = location.dimensionId === DimensionId("nether") ? "netherrack" : "stone";
          yield* this.worldGenerator.setBlock(blockPos, platformBlock);
        }
      }

      // 空間を確保（高さ4ブロック）
      for (let y = 0; y < 4; y++) {
        for (let x = -2; x <= 2; x++) {
          for (let z = -2; z <= 2; z++) {
            const airPos: WorldCoordinate = {
              x: location.x + x,
              y: location.y + y,
              z: location.z + z,
              dimensionId: location.dimensionId
            };

            yield* this.worldGenerator.setBlock(airPos, "air");
          }
        }
      }
    });
}
```

### 4. Dimension Manager - 次元管理システム

```typescript
export interface DimensionManager {
  readonly loadDimension: (
    dimensionId: DimensionId
  ) => Effect.Effect<DimensionInfo, DimensionError>;

  readonly unloadDimension: (
    dimensionId: DimensionId
  ) => Effect.Effect<void, DimensionError>;

  readonly getDimensionInfo: (
    dimensionId: DimensionId
  ) => Effect.Effect<DimensionInfo, DimensionError>;

  readonly transferEntity: (
    entityId: EntityId,
    fromDimension: DimensionId,
    toDimension: DimensionId,
    position: WorldCoordinate
  ) => Effect.Effect<void, DimensionError>;
}

export const DimensionManager = Context.GenericTag<DimensionManager>("DimensionManager");

class DimensionManagerImpl implements DimensionManager {
  constructor(
    private readonly loadedDimensions: TRef.TRef<TMap.TMap<DimensionId, DimensionInfo>>,
    private readonly dimensionChunks: TRef.TRef<TMap.TMap<DimensionId, TMap.TMap<ChunkId, Chunk>>>,
    private readonly entityManager: EntityManager,
    private readonly chunkLoader: ChunkLoader
  ) {}

  loadDimension = (
    dimensionId: DimensionId
  ): Effect.Effect<DimensionInfo, DimensionError> =>
    Effect.gen(this, function* () {
      // 既に読み込み済みかチェック
      const loadedDims = yield* STM.readTRef(this.loadedDimensions);
      const existing = TMap.get(loadedDims, dimensionId);

      if (Option.isSome(existing)) {
        return existing.value;
      }

      // 次元情報の作成
      const dimensionInfo = yield* this.createDimensionInfo(dimensionId);

      // チャンクマップの初期化
      const emptyChunkMap = TMap.empty<ChunkId, Chunk>();

      // 状態の更新
      yield* STM.commit(
        STM.gen(function* () {
          const dims = yield* STM.readTRef(this.loadedDimensions);
          const chunks = yield* STM.readTRef(this.dimensionChunks);

          yield* STM.writeTRef(this.loadedDimensions, TMap.set(dims, dimensionId, dimensionInfo));
          yield* STM.writeTRef(this.dimensionChunks, TMap.set(chunks, dimensionId, emptyChunkMap));
        })
      );

      return dimensionInfo;
    });

  transferEntity = (
    entityId: EntityId,
    fromDimension: DimensionId,
    toDimension: DimensionId,
    position: WorldCoordinate
  ): Effect.Effect<void, DimensionError> =>
    Effect.gen(this, function* () {
      // ターゲット次元の読み込み
      yield* this.loadDimension(toDimension);

      // エンティティの状態保存
      const entityState = yield* this.entityManager.saveEntityState(entityId);

      // ソース次元からエンティティを削除
      yield* this.entityManager.removeEntityFromDimension(entityId, fromDimension);

      // ターゲット次元にエンティティを追加
      yield* this.entityManager.addEntityToDimension(entityId, toDimension, position);

      // エンティティ状態の復元
      yield* this.entityManager.restoreEntityState(entityId, entityState);

      // 周辺チャンクの読み込み
      yield* this.loadSurroundingChunks(position, toDimension);
    });

  private createDimensionInfo = (
    dimensionId: DimensionId
  ): Effect.Effect<DimensionInfo, DimensionError> =>
    Effect.gen(this, function* () {
      return yield* Match.value(dimensionId).pipe(
        Match.when(DimensionId("overworld"), () => Effect.succeed({
          id: dimensionId,
          name: "Overworld",
          coordinateScale: 1.0,
          hasRoof: false,
          hasSkylight: true,
          ambientLight: 0.0
        })),
        Match.when(DimensionId("nether"), () => Effect.succeed({
          id: dimensionId,
          name: "The Nether",
          coordinateScale: 8.0,
          hasRoof: true,
          hasSkylight: false,
          ambientLight: 0.1
        })),
        Match.when(DimensionId("end"), () => Effect.succeed({
          id: dimensionId,
          name: "The End",
          coordinateScale: 1.0,
          hasRoof: false,
          hasSkylight: false,
          ambientLight: 0.0
        })),
        Match.orElse(() => Effect.fail(new DimensionError(`Unknown dimension: ${dimensionId}`)))
      )
    });

  private loadSurroundingChunks = (
    center: WorldCoordinate,
    dimensionId: DimensionId,
    radius: number = 3
  ): Effect.Effect<void, DimensionError> =>
    Effect.gen(this, function* () {
      const chunkX = Math.floor(center.x / 16);
      const chunkZ = Math.floor(center.z / 16);

      const loadPromises: Effect.Effect<void, DimensionError>[] = [];

      for (let x = chunkX - radius; x <= chunkX + radius; x++) {
        for (let z = chunkZ - radius; z <= chunkZ + radius; z++) {
          const chunkId = ChunkId(`${x},${z}`);
          const loadEffect = this.chunkLoader.loadChunk(chunkId, dimensionId);
          loadPromises.push(loadEffect);
        }
      }

      yield* Effect.all(loadPromises, { concurrency: 4 });
    });
}
```

## コア機能統合

### ワールドシステム統合

```typescript
// ワールドシステムとの統合
export const integrateWithWorldSystem = (
  worldSystem: WorldSystem
): Effect.Effect<void, IntegrationError> =>
  Effect.gen(function* () {
    // 次元管理の統合
    yield* worldSystem.registerDimensionHandler(NetherPortalSystem);

    // チャンク生成の統合
    yield* worldSystem.registerChunkGenerator("nether", NetherChunkGenerator);

    // ポータル検出の統合
    yield* worldSystem.registerBlockUpdateHandler("obsidian", PortalDetectionHandler);
  });

// ブロックシステムとの統合
export const integrateWithBlockSystem = (
  blockSystem: BlockSystem
): Effect.Effect<void, IntegrationError> =>
  Effect.gen(function* () {
    // ポータルブロックの登録
    yield* blockSystem.registerBlock({
      id: "portal",
      properties: {
        solid: false,
        transparent: true,
        lightEmission: 11,
        portalBlock: true
      },
      onEntityCollision: (entity, block) =>
        NetherPortalSystem.handleEntityPortalEntry(entity.id, block.position)
    });

    // オブシディアンブロックの拡張
    yield* blockSystem.enhanceBlock("obsidian", {
      onBlockUpdate: (position) =>
        PortalEngine.detectPortalFrame(position)
    });
  });
```

### エンティティシステム統合

```typescript
// エンティティとの統合
export const integrateWithEntitySystem = (
  entitySystem: EntitySystem
): Effect.Effect<void, IntegrationError> =>
  Effect.gen(function* () {
    // ポータル移動コンポーネント
    yield* entitySystem.registerComponent("PortalTraveler", {
      lastPortalUse: 0,
      portalCooldown: 4000, // 4秒のクールダウン
      currentDimension: DimensionId("overworld")
    });

    // ネザー耐性コンポーネント
    yield* entitySystem.registerComponent("NetherResistance", {
      fireResistance: true,
      lavaResistance: true,
      netherDamageImmunity: true
    });

    // ディメンションシンクシステム
    yield* entitySystem.registerSystem("DimensionSync",
      createDimensionSyncSystem(DimensionManager)
    );
  });
```

## 段階的実装アプローチ

### フェーズ1: 基本ポータル機能（2-3週間）

```typescript
export const Phase1Implementation = Layer.effectDiscard(
  Effect.gen(function* () {
    // 1. ポータル検出システム
    yield* Effect.log("Implementing portal frame detection");
    yield* implementPortalDetection();

    // 2. 基本的なアクティベーション
    yield* Effect.log("Implementing basic portal activation");
    yield* implementBasicActivation();

    // 3. 単純な座標変換
    yield* Effect.log("Implementing basic coordinate transformation");
    yield* implementBasicCoordinateTransform();

    // 4. 基本テレポート機能
    yield* Effect.log("Implementing basic teleportation");
    yield* implementBasicTeleportation();

    yield* Effect.log("Phase 1 implementation completed");
  })
).pipe(
  Layer.provide(PortalEngineLayer),
  Layer.provide(CoordinateTransformLayer)
);
```

### フェーズ2: ネザー次元（3-4週間）

```typescript
export const Phase2Implementation = Layer.effectDiscard(
  Effect.gen(function* () {
    // 1. ネザー次元の実装
    yield* Effect.log("Implementing Nether dimension");
    yield* implementNetherDimension();

    // 2. ネザー地形生成
    yield* Effect.log("Implementing Nether terrain generation");
    yield* implementNetherTerrain();

    // 3. ネザー固有Mobシステム
    yield* Effect.log("Implementing Nether mob system");
    yield* implementNetherMobs();

    // 4. ネザー環境効果
    yield* Effect.log("Implementing Nether environmental effects");
    yield* implementNetherEnvironment();

    yield* Effect.log("Phase 2 implementation completed");
  })
).pipe(
  Layer.provide(DimensionManagerLayer),
  Layer.provide(NetherGeneratorLayer)
);
```

### フェーズ3: 高度なポータル機能（2-3週間）

```typescript
export const Phase3Implementation = Layer.effectDiscard(
  Effect.gen(function* () {
    // 1. インテリジェントポータルリンク
    yield* Effect.log("Implementing intelligent portal linking");
    yield* implementIntelligentLinking();

    // 2. 複数ポータル管理
    yield* Effect.log("Implementing multiple portal management");
    yield* implementMultiPortalManagement();

    // 3. ポータル最適化
    yield* Effect.log("Implementing portal optimization");
    yield* implementPortalOptimization();

    // 4. デバッグ・監視システム
    yield* Effect.log("Implementing portal debugging system");
    yield* implementPortalDebugging();

    yield* Effect.log("Phase 3 implementation completed");
  })
).pipe(
  Layer.provide(PortalLinkingLayer),
  Layer.provide(PortalOptimizationLayer)
);
```

## パフォーマンス最適化

### メモリ管理最適化

```typescript
export interface PortalMemoryOptimizer {
  readonly optimizePortalMemory: () => Effect.Effect<void, never>;
  readonly unloadInactivePortals: (maxInactive: number) => Effect.Effect<void, never>;
  readonly preloadPortalChunks: (portalId: PortalId) => Effect.Effect<void, never>;
}

class PortalMemoryOptimizerImpl implements PortalMemoryOptimizer {
  private readonly INACTIVE_THRESHOLD = 5 * 60 * 1000; // 5分

  optimizePortalMemory = (): Effect.Effect<void, never> =>
    Effect.gen(this, function* () {
      // 非アクティブポータルの特定
      const inactivePortals = yield* this.findInactivePortals();

      // チャンクのアンロード
      for (const portal of inactivePortals) {
        yield* this.unloadPortalChunks(portal.id);
      }

      // メモリ使用量の最適化
      yield* this.optimizePortalChunkCache();

      // ガベージコレクションの実行
      if (global.gc) {
        global.gc();
      }
    });

  private optimizePortalChunkCache = (): Effect.Effect<void, never> =>
    Effect.gen(this, function* () {
      // LRUベースのチャンクキャッシュ最適化
      const maxCacheSize = 1024; // 1024チャンク
      const currentCacheSize = yield* this.getCurrentCacheSize();

      if (currentCacheSize > maxCacheSize) {
        const chunksToEvict = currentCacheSize - maxCacheSize;
        yield* this.evictOldestChunks(chunksToEvict);
      }
    });
}
```

### 並行処理最適化

```typescript
export const createOptimizedPortalSystem = (): Layer.Layer<NetherPortalSystem> =>
  Layer.effect(
    NetherPortalSystem,
    Effect.gen(function* () {
      // 並行ポータル処理のセットアップ
      const portalQueue = yield* Queue.bounded<PortalOperation>(100);
      const portalWorkers = yield* Effect.forkAll(
        Array.from({ length: 4 }, () => createPortalWorker(portalQueue)),
        { concurrency: 4 }
      );

      // ポータル状態の監視
      const monitorFiber = yield* Effect.fork(
        createPortalMonitor().pipe(
          Effect.repeat(Schedule.fixed("5 seconds"))
        )
      );

      return new NetherPortalSystemImpl(portalQueue, portalWorkers, monitorFiber);
    })
  );

const createPortalWorker = (
  queue: Queue.Queue<PortalOperation>
) =>
  Effect.gen(function* () {
    while (true) {
      const operation = yield* Queue.take(queue);
      yield* processPortalOperation(operation);
    }
  }).pipe(
    Effect.catchAllCause(cause =>
      Effect.logError("Portal worker error", cause)
    ),
    Effect.forever
  );
```

## テスト戦略

### 単体テスト

```typescript
import { Effect, TestServices, TestClock } from "effect";
import { describe, it, expect } from "vitest";

describe("NetherPortalSystem", () => {
  it("should detect valid portal frame", () =>
    Effect.gen(function* () {
      // テスト用のポータルフレームを作成
      const testFrame = createTestPortalFrame();
      const portalEngine = yield* PortalEngine;

      // フレーム検出をテスト
      const detectedFrame = yield* portalEngine.detectPortalFrame(testFrame.corners[0]);

      expect(Option.isSome(detectedFrame)).toBe(true);
      expect(detectedFrame.value.isValid).toBe(true);
    }).pipe(
      Effect.provide(TestPortalEngineLayer)
    )
  );

  it("should transform coordinates correctly", () =>
    Effect.gen(function* () {
      const coordinateTransform = yield* CoordinateTransform;

      // オーバーワールド座標
      const overworldPos: WorldCoordinate = {
        x: 800,
        y: 64,
        z: 1600,
        dimensionId: DimensionId("overworld")
      };

      // ネザー座標への変換
      const netherPos = yield* coordinateTransform.calculateNetherCoordinate(overworldPos);

      expect(netherPos.x).toBe(100);
      expect(netherPos.z).toBe(200);
      expect(netherPos.dimensionId).toBe(DimensionId("nether"));
    }).pipe(
      Effect.provide(TestCoordinateTransformLayer)
    )
  );
});
```

### 統合テスト

```typescript
describe("Portal Integration Tests", () => {
  it("should handle full portal creation and teleportation", () =>
    Effect.gen(function* () {
      const system = yield* NetherPortalSystem;

      // 1. ポータルフレームの構築
      const framePosition = createTestWorldPosition();
      yield* buildTestPortalFrame(framePosition);

      // 2. ポータルの検出とアクティベーション
      const portal = yield* system.activatePortal(framePosition);

      // 3. エンティティのテレポート
      const entityId = EntityId("test-entity");
      const targetPosition = yield* system.teleportEntity(entityId, portal.id);

      // 4. 結果の検証
      expect(targetPosition.dimensionId).toBe(DimensionId("nether"));

      // 5. リンクポータルの存在確認
      const linkedPortal = yield* system.getLinkedPortal(portal.id);
      expect(Option.isSome(linkedPortal)).toBe(true);
    }).pipe(
      Effect.provide(TestNetherPortalSystemLayer),
      Effect.provide(TestWorldSystemLayer)
    )
  );
});
```

### パフォーマンステスト

```typescript
describe("Portal Performance Tests", () => {
  it("should handle multiple concurrent teleportations", () =>
    Effect.gen(function* () {
      const system = yield* NetherPortalSystem;

      // 100体のエンティティを準備
      const entities = Array.from({ length: 100 }, (_, i) => EntityId(`entity-${i}`));

      // 並行テレポートの実行
      const teleportations = entities.map(entityId =>
        system.teleportEntity(entityId, testPortalId)
      );

      const startTime = yield* TestClock.currentTimeMillis;
      yield* Effect.all(teleportations, { concurrency: 10 });
      const endTime = yield* TestClock.currentTimeMillis;

      // パフォーマンス検証（100ms以内）
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
    }).pipe(
      Effect.provide(TestNetherPortalSystemLayer),
      Effect.provide(TestServices.TestClock)
    )
  );
});
```

## エラーハンドリング

### カスタムエラー型

```typescript
export class PortalError extends Data.TaggedError("PortalError")<{
  readonly message: string;
  readonly portalId?: PortalId;
  readonly position?: WorldCoordinate;
}> {}

export class CoordinateError extends Data.TaggedError("CoordinateError")<{
  readonly message: string;
  readonly sourceCoordinate?: WorldCoordinate;
  readonly targetDimension?: DimensionId;
}> {}

export class LinkingError extends Data.TaggedError("LinkingError")<{
  readonly message: string;
  readonly sourcePortal?: PortalId;
  readonly targetPortal?: PortalId;
}> {}

export class DimensionError extends Data.TaggedError("DimensionError")<{
  readonly message: string;
  readonly dimensionId?: DimensionId;
}> {}
```

### エラー回復戦略

```typescript
export const createResilientPortalSystem = () =>
  Layer.effect(
    NetherPortalSystem,
    Effect.gen(function* () {
      const portalEngine = yield* PortalEngine;

      return {
        teleportEntity: (entityId: EntityId, portalId: PortalId) =>
          portalEngine.teleportEntity(entityId, portalId).pipe(
            Effect.retry({
              schedule: Schedule.exponential("1 second").pipe(
                Schedule.intersect(Schedule.recurs(3))
              )
            }),
            Effect.catchAll(error => {
              if (error._tag === "PortalError") {
                return Effect.gen(function* () {
                  // ポータルリンクの再構築を試行
                  yield* Effect.logWarning("Portal error, attempting to rebuild link", error);
                  yield* portalEngine.rebuildPortalLink(portalId);

                  // 再試行
                  return yield* portalEngine.teleportEntity(entityId, portalId);
                });
              }
              return Effect.fail(error);
            }),
            Effect.tapError(error =>
              Effect.logError("Critical portal system error", error)
            )
          )
      };
    })
  );
```

## まとめ

NetherPortalsシステムは、Minecraft クローンにおける本格的な異次元システムを提供します。Effect-TS 3.17+の最新機能を活用し、型安全性とパフォーマンスを両立させた実装により、プレイヤーに臨場感のある異次元体験を提供します。

### 主要な特徴

1. **インテリジェントポータルリンク**: 座標変換アルゴリズムによる自動ポータル配置
2. **高性能座標変換**: オーバーワールドとネザー間の1:8スケール変換
3. **並行処理対応**: 複数プレイヤーの同時次元移動サポート
4. **メモリ効率**: 非アクティブ次元の自動アンロード
5. **拡張性**: 新しい次元の簡単な追加

段階的な実装アプローチにより、基本機能から高度な最適化まで体系的に開発を進めることができ、Minecraft クローンの核となる異次元システムを確実に構築できます。