---
title: "03 HTTP API Specification"
description: "HTTP API仕様に関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ["typescript", "minecraft", "specification", "http", "api"]
prerequisites: ["basic-typescript", "http-protocol"]
estimated_reading_time: "45分"
---


# HTTP API仕様

## 概要

TypeScript Minecraft CloneプロジェクトのHTTP API仕様です。Effect-TS 3.17+の最新パターンを使用したRESTful API設計、WebSocket API、認証・認可、レート制限、キャッシング戦略を定義します。

本仕様では以下の技術と設計パターンを採用しています：

- **RESTful API Design**: リソースベースの直感的なAPI設計
- **GraphQL Support**: 柔軟なデータ取得のためのクエリAPI
- **WebSocket Real-time**: リアルタイム通信とゲーム状態同期
- **OpenAPI 3.1**: 自動生成されるAPI仕様書
- **OAuth 2.0 / JWT**: 安全な認証・認可メカニズム
- **Rate Limiting**: DDoS防護とリソース保護
- **Caching Strategy**: 効率的なレスポンス最適化

## RESTful API Design

### Core Resource APIs

#### World Resources

```typescript
// =============================================================================
// World管理API
// =============================================================================

export const WorldAPIRoutes = {
  // GET /api/v1/worlds - ワールド一覧取得
  listWorlds: {
    method: "GET" as const,
    path: "/api/v1/worlds",
    queryParams: Schema.Struct({
      limit: Schema.Optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 100))),
      offset: Schema.Optional(Schema.Number.pipe(Schema.int(), Schema.min(0))),
      status: Schema.Optional(Schema.Union(
        Schema.Literal("active"),
        Schema.Literal("inactive"),
        Schema.Literal("maintenance")
      )),
      search: Schema.Optional(Schema.String.pipe(Schema.maxLength(100)))
    }),
    response: Schema.Struct({
      worlds: Schema.Array(WorldSummarySchema),
      pagination: PaginationSchema,
      totalCount: Schema.Number
    }),
    errors: Schema.Union(
      UnauthorizedErrorSchema,
      ValidationErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/worlds/{worldId} - ワールド詳細取得
  getWorld: {
    method: "GET" as const,
    path: "/api/v1/worlds/{worldId}",
    pathParams: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId))
    }),
    response: WorldDetailSchema,
    errors: Schema.Union(
      NotFoundErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // POST /api/v1/worlds - 新しいワールド作成
  createWorld: {
    method: "POST" as const,
    path: "/api/v1/worlds",
    body: Schema.Struct({
      name: Schema.String.pipe(
        Schema.minLength(1, { message: () => "ワールド名は必須です" }),
        Schema.maxLength(50, { message: () => "ワールド名は50文字以下にしてください" })
      ),
      description: Schema.Optional(Schema.String.pipe(Schema.maxLength(500))),
      gameMode: GameModeSchema,
      difficulty: DifficultySchema,
      seed: Schema.Optional(Schema.Number.pipe(Schema.int())),
      isPublic: Schema.Optional(Schema.Boolean),
      maxPlayers: Schema.Optional(Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 100)
      )),
      worldType: Schema.Optional(Schema.Union(
        Schema.Literal("normal"),
        Schema.Literal("flat"),
        Schema.Literal("large_biomes"),
        Schema.Literal("amplified")
      ))
    }),
    response: WorldDetailSchema,
    errors: Schema.Union(
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      ConflictErrorSchema,
      ServerErrorSchema
    )
  },

  // PUT /api/v1/worlds/{worldId} - ワールド更新
  updateWorld: {
    method: "PUT" as const,
    path: "/api/v1/worlds/{worldId}",
    pathParams: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId))
    }),
    body: Schema.Struct({
      name: Schema.Optional(Schema.String.pipe(
        Schema.minLength(1),
        Schema.maxLength(50)
      )),
      description: Schema.Optional(Schema.String.pipe(Schema.maxLength(500))),
      difficulty: Schema.Optional(DifficultySchema),
      isPublic: Schema.Optional(Schema.Boolean),
      maxPlayers: Schema.Optional(Schema.Number.pipe(
        Schema.int(),
        Schema.between(1, 100)
      )),
      status: Schema.Optional(Schema.Union(
        Schema.Literal("active"),
        Schema.Literal("inactive"),
        Schema.Literal("maintenance")
      ))
    }),
    response: WorldDetailSchema,
    errors: Schema.Union(
      NotFoundErrorSchema,
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      ConflictErrorSchema,
      ServerErrorSchema
    )
  },

  // DELETE /api/v1/worlds/{worldId} - ワールド削除
  deleteWorld: {
    method: "DELETE" as const,
    path: "/api/v1/worlds/{worldId}",
    pathParams: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId))
    }),
    response: Schema.Struct({
      message: Schema.String,
      deletedAt: Schema.Number
    }),
    errors: Schema.Union(
      NotFoundErrorSchema,
      UnauthorizedErrorSchema,
      ConflictErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/worlds/{worldId}/players - ワールド内プレイヤー一覧
  getWorldPlayers: {
    method: "GET" as const,
    path: "/api/v1/worlds/{worldId}/players",
    pathParams: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId))
    }),
    queryParams: Schema.Struct({
      status: Schema.Optional(Schema.Union(
        Schema.Literal("online"),
        Schema.Literal("offline"),
        Schema.Literal("all")
      )),
      limit: Schema.Optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 100))),
      offset: Schema.Optional(Schema.Number.pipe(Schema.int(), Schema.min(0)))
    }),
    response: Schema.Struct({
      players: Schema.Array(PlayerSummarySchema),
      onlineCount: Schema.Number,
      totalCount: Schema.Number,
      pagination: PaginationSchema
    }),
    errors: Schema.Union(
      NotFoundErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/worlds/{worldId}/chunks - チャンク情報取得
  getWorldChunks: {
    method: "GET" as const,
    path: "/api/v1/worlds/{worldId}/chunks",
    pathParams: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId))
    }),
    queryParams: Schema.Struct({
      minX: Schema.Number.pipe(Schema.int()),
      maxX: Schema.Number.pipe(Schema.int()),
      minZ: Schema.Number.pipe(Schema.int()),
      maxZ: Schema.Number.pipe(Schema.int()),
      includeEmpty: Schema.Optional(Schema.Boolean)
    }),
    response: Schema.Struct({
      chunks: Schema.Array(ChunkSummarySchema),
      totalChunks: Schema.Number,
      loadedChunks: Schema.Number
    }),
    errors: Schema.Union(
      NotFoundErrorSchema,
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  }
}

// World関連のスキーマ定義
export const WorldSummarySchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(WorldId)),
  name: Schema.String,
  description: Schema.Optional(Schema.String),
  gameMode: GameModeSchema,
  difficulty: DifficultySchema,
  status: Schema.Union(
    Schema.Literal("active"),
    Schema.Literal("inactive"),
    Schema.Literal("maintenance")
  ),
  isPublic: Schema.Boolean,
  playerCount: Schema.Number,
  maxPlayers: Schema.Number,
  createdAt: Schema.Number,
  lastActivity: Schema.Number
})

export const WorldDetailSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(WorldId)),
  name: Schema.String,
  description: Schema.Optional(Schema.String),
  gameMode: GameModeSchema,
  difficulty: DifficultySchema,
  seed: Schema.Number,
  status: Schema.Union(
    Schema.Literal("active"),
    Schema.Literal("inactive"),
    Schema.Literal("maintenance")
  ),
  isPublic: Schema.Boolean,
  playerCount: Schema.Number,
  maxPlayers: Schema.Number,
  worldType: Schema.String,
  spawnPoint: PositionSchema,
  time: Schema.Number,
  weather: WeatherSchema,
  loadedChunks: Schema.Number,
  totalChunks: Schema.Number,
  worldSize: Schema.Number, // バイト単位
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  lastActivity: Schema.Number,
  ownerId: Schema.String.pipe(Schema.brand(PlayerId)),
  permissions: Schema.Array(PermissionSchema)
})
```

#### Player Resources

```typescript
// =============================================================================
// Player管理API
// =============================================================================

export const PlayerAPIRoutes = {
  // GET /api/v1/players/me - 自分のプレイヤー情報取得
  getMyProfile: {
    method: "GET" as const,
    path: "/api/v1/players/me",
    response: PlayerProfileSchema,
    errors: Schema.Union(
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // PUT /api/v1/players/me - 自分のプレイヤー情報更新
  updateMyProfile: {
    method: "PUT" as const,
    path: "/api/v1/players/me",
    body: Schema.Struct({
      displayName: Schema.Optional(Schema.String.pipe(
        Schema.minLength(1),
        Schema.maxLength(20)
      )),
      avatar: Schema.Optional(Schema.String.pipe(Schema.url())),
      preferences: Schema.Optional(PlayerPreferencesSchema),
      privacy: Schema.Optional(PrivacySettingsSchema)
    }),
    response: PlayerProfileSchema,
    errors: Schema.Union(
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      ConflictErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/players/{playerId} - 他のプレイヤー情報取得
  getPlayer: {
    method: "GET" as const,
    path: "/api/v1/players/{playerId}",
    pathParams: Schema.Struct({
      playerId: Schema.String.pipe(Schema.brand(PlayerId))
    }),
    response: PlayerPublicProfileSchema,
    errors: Schema.Union(
      NotFoundErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/players/me/inventory - インベントリ取得
  getMyInventory: {
    method: "GET" as const,
    path: "/api/v1/players/me/inventory",
    queryParams: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId))
    }),
    response: InventorySchema,
    errors: Schema.Union(
      NotFoundErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // PUT /api/v1/players/me/inventory - インベントリ更新
  updateMyInventory: {
    method: "PUT" as const,
    path: "/api/v1/players/me/inventory",
    body: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId)),
      items: Schema.Array(ItemStackSchema),
      hotbarSelection: Schema.Optional(Schema.Number.pipe(
        Schema.int(),
        Schema.between(0, 8)
      ))
    }),
    response: InventorySchema,
    errors: Schema.Union(
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      ConflictErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/players/me/stats - プレイヤー統計情報
  getMyStats: {
    method: "GET" as const,
    path: "/api/v1/players/me/stats",
    queryParams: Schema.Struct({
      worldId: Schema.Optional(Schema.String.pipe(Schema.brand(WorldId))),
      period: Schema.Optional(Schema.Union(
        Schema.Literal("day"),
        Schema.Literal("week"),
        Schema.Literal("month"),
        Schema.Literal("all")
      ))
    }),
    response: PlayerStatsSchema,
    errors: Schema.Union(
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/players/me/achievements - 実績一覧取得
  getMyAchievements: {
    method: "GET" as const,
    path: "/api/v1/players/me/achievements",
    queryParams: Schema.Struct({
      status: Schema.Optional(Schema.Union(
        Schema.Literal("unlocked"),
        Schema.Literal("locked"),
        Schema.Literal("all")
      )),
      category: Schema.Optional(Schema.String)
    }),
    response: Schema.Struct({
      achievements: Schema.Array(AchievementSchema),
      totalUnlocked: Schema.Number,
      completionPercentage: Schema.Number
    }),
    errors: Schema.Union(
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  }
}

// Player関連のスキーマ定義
export const PlayerProfileSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(PlayerId)),
  username: Schema.String,
  displayName: Schema.String,
  email: Schema.String.pipe(Schema.email()),
  avatar: Schema.Optional(Schema.String.pipe(Schema.url())),
  level: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  experience: Schema.Number.pipe(Schema.min(0)),
  preferences: PlayerPreferencesSchema,
  privacy: PrivacySettingsSchema,
  status: Schema.Union(
    Schema.Literal("online"),
    Schema.Literal("offline"),
    Schema.Literal("away"),
    Schema.Literal("busy")
  ),
  lastLogin: Schema.Number,
  createdAt: Schema.Number,
  updatedAt: Schema.Number
})

export const PlayerPublicProfileSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand(PlayerId)),
  displayName: Schema.String,
  avatar: Schema.Optional(Schema.String.pipe(Schema.url())),
  level: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  status: Schema.Union(
    Schema.Literal("online"),
    Schema.Literal("offline"),
    Schema.Literal("away")
  ),
  lastSeen: Schema.Optional(Schema.Number),
  achievements: Schema.Array(PublicAchievementSchema),
  stats: Schema.Optional(PublicStatsSchema)
})

export const PlayerPreferencesSchema = Schema.Struct({
  language: Schema.String,
  theme: Schema.Union(
    Schema.Literal("light"),
    Schema.Literal("dark"),
    Schema.Literal("auto")
  ),
  renderDistance: Schema.Number.pipe(Schema.int(), Schema.between(2, 32)),
  fov: Schema.Number.pipe(Schema.between(30, 120)),
  mouseSensitivity: Schema.Number.pipe(Schema.between(0.1, 5.0)),
  soundVolume: Schema.Number.pipe(Schema.between(0, 1)),
  musicVolume: Schema.Number.pipe(Schema.between(0, 1)),
  showParticles: Schema.Boolean,
  showClouds: Schema.Boolean,
  smoothLighting: Schema.Boolean,
  vsync: Schema.Boolean
})

export const PrivacySettingsSchema = Schema.Struct({
  showEmail: Schema.Boolean,
  showOnlineStatus: Schema.Boolean,
  showStats: Schema.Boolean,
  showAchievements: Schema.Boolean,
  allowDirectMessages: Schema.Boolean,
  allowFriendRequests: Schema.Boolean
})
```

#### Game Session APIs

```typescript
// =============================================================================
// ゲームセッション管理API
// =============================================================================

export const GameSessionAPIRoutes = {
  // POST /api/v1/sessions - ゲームセッション開始
  createSession: {
    method: "POST" as const,
    path: "/api/v1/sessions",
    body: Schema.Struct({
      worldId: Schema.String.pipe(Schema.brand(WorldId)),
      gameMode: Schema.Optional(GameModeSchema),
      clientVersion: Schema.String,
      clientCapabilities: ClientCapabilitiesSchema
    }),
    response: SessionSchema,
    errors: Schema.Union(
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      ConflictErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/sessions/me - 現在のセッション情報取得
  getMySession: {
    method: "GET" as const,
    path: "/api/v1/sessions/me",
    response: SessionSchema,
    errors: Schema.Union(
      NotFoundErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // PUT /api/v1/sessions/me - セッション更新
  updateMySession: {
    method: "PUT" as const,
    path: "/api/v1/sessions/me",
    body: Schema.Struct({
      position: Schema.Optional(PositionSchema),
      health: Schema.Optional(HealthSchema),
      status: Schema.Optional(Schema.Union(
        Schema.Literal("playing"),
        Schema.Literal("idle"),
        Schema.Literal("afk")
      ))
    }),
    response: SessionSchema,
    errors: Schema.Union(
      NotFoundErrorSchema,
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // DELETE /api/v1/sessions/me - セッション終了
  endMySession: {
    method: "DELETE" as const,
    path: "/api/v1/sessions/me",
    response: Schema.Struct({
      message: Schema.String,
      sessionDuration: Schema.Number,
      endedAt: Schema.Number
    }),
    errors: Schema.Union(
      NotFoundErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/sessions/me/heartbeat - セッションキープアライブ
  heartbeat: {
    method: "GET" as const,
    path: "/api/v1/sessions/me/heartbeat",
    response: Schema.Struct({
      sessionId: Schema.String,
      serverTime: Schema.Number,
      nextHeartbeat: Schema.Number
    }),
    errors: Schema.Union(
      NotFoundErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  }
}

export const SessionSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("SessionId" as any)),
  playerId: Schema.String.pipe(Schema.brand(PlayerId)),
  worldId: Schema.String.pipe(Schema.brand(WorldId)),
  status: Schema.Union(
    Schema.Literal("active"),
    Schema.Literal("idle"),
    Schema.Literal("disconnected")
  ),
  position: PositionSchema,
  health: HealthSchema,
  gameMode: GameModeSchema,
  connectedAt: Schema.Number,
  lastActivity: Schema.Number,
  clientInfo: ClientInfoSchema,
  serverEndpoint: Schema.String.pipe(Schema.url())
})

export const ClientCapabilitiesSchema = Schema.Struct({
  webGL: Schema.Boolean,
  webGL2: Schema.Boolean,
  webAssembly: Schema.Boolean,
  webWorkers: Schema.Boolean,
  offscreenCanvas: Schema.Boolean,
  sharedArrayBuffer: Schema.Boolean,
  maxTextureSize: Schema.Number,
  maxRenderBufferSize: Schema.Number,
  supportedFormats: Schema.Array(Schema.String)
})

export const ClientInfoSchema = Schema.Struct({
  userAgent: Schema.String,
  platform: Schema.String,
  version: Schema.String,
  capabilities: ClientCapabilitiesSchema,
  performance: Schema.Struct({
    cpuCores: Schema.Number,
    memory: Schema.Number,
    gpu: Schema.Optional(Schema.String)
  })
})
```

## Authentication & Authorization

### OAuth 2.0 / JWT Implementation

```typescript
// =============================================================================
// 認証・認可API
// =============================================================================

export const AuthAPIRoutes = {
  // POST /api/v1/auth/login - ユーザーログイン
  login: {
    method: "POST" as const,
    path: "/api/v1/auth/login",
    body: Schema.Struct({
      email: Schema.String.pipe(Schema.email()),
      password: Schema.String.pipe(Schema.minLength(8)),
      rememberMe: Schema.Optional(Schema.Boolean),
      captcha: Schema.Optional(Schema.String)
    }),
    response: AuthResponseSchema,
    errors: Schema.Union(
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      TooManyRequestsErrorSchema,
      ServerErrorSchema
    )
  },

  // POST /api/v1/auth/register - ユーザー登録
  register: {
    method: "POST" as const,
    path: "/api/v1/auth/register",
    body: Schema.Struct({
      username: Schema.String.pipe(
        Schema.minLength(3),
        Schema.maxLength(20),
        Schema.pattern(/^[a-zA-Z0-9_-]+$/)
      ),
      email: Schema.String.pipe(Schema.email()),
      password: Schema.String.pipe(
        Schema.minLength(8),
        Schema.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      ),
      displayName: Schema.String.pipe(
        Schema.minLength(1),
        Schema.maxLength(30)
      ),
      termsAccepted: Schema.Boolean,
      captcha: Schema.String
    }),
    response: AuthResponseSchema,
    errors: Schema.Union(
      ValidationErrorSchema,
      ConflictErrorSchema,
      TooManyRequestsErrorSchema,
      ServerErrorSchema
    )
  },

  // POST /api/v1/auth/refresh - トークンリフレッシュ
  refresh: {
    method: "POST" as const,
    path: "/api/v1/auth/refresh",
    body: Schema.Struct({
      refreshToken: Schema.String
    }),
    response: AuthResponseSchema,
    errors: Schema.Union(
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // POST /api/v1/auth/logout - ログアウト
  logout: {
    method: "POST" as const,
    path: "/api/v1/auth/logout",
    body: Schema.Struct({
      refreshToken: Schema.Optional(Schema.String)
    }),
    response: Schema.Struct({
      message: Schema.String
    }),
    errors: Schema.Union(
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // POST /api/v1/auth/forgot-password - パスワードリセット要求
  forgotPassword: {
    method: "POST" as const,
    path: "/api/v1/auth/forgot-password",
    body: Schema.Struct({
      email: Schema.String.pipe(Schema.email())
    }),
    response: Schema.Struct({
      message: Schema.String
    }),
    errors: Schema.Union(
      ValidationErrorSchema,
      TooManyRequestsErrorSchema,
      ServerErrorSchema
    )
  },

  // POST /api/v1/auth/reset-password - パスワードリセット
  resetPassword: {
    method: "POST" as const,
    path: "/api/v1/auth/reset-password",
    body: Schema.Struct({
      token: Schema.String,
      newPassword: Schema.String.pipe(
        Schema.minLength(8),
        Schema.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      )
    }),
    response: Schema.Struct({
      message: Schema.String
    }),
    errors: Schema.Union(
      ValidationErrorSchema,
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  },

  // GET /api/v1/auth/me - 現在のユーザー情報取得
  getMe: {
    method: "GET" as const,
    path: "/api/v1/auth/me",
    response: UserSchema,
    errors: Schema.Union(
      UnauthorizedErrorSchema,
      ServerErrorSchema
    )
  }
}

export const AuthResponseSchema = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: Schema.String,
  tokenType: Schema.Literal("Bearer"),
  expiresIn: Schema.Number,
  user: UserSchema
})

export const UserSchema = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("UserId" as any)),
  username: Schema.String,
  email: Schema.String.pipe(Schema.email()),
  displayName: Schema.String,
  avatar: Schema.Optional(Schema.String.pipe(Schema.url())),
  roles: Schema.Array(RoleSchema),
  permissions: Schema.Array(PermissionSchema),
  isVerified: Schema.Boolean,
  isActive: Schema.Boolean,
  lastLogin: Schema.Optional(Schema.Number),
  createdAt: Schema.Number,
  updatedAt: Schema.Number
})

export const RoleSchema = Schema.Union(
  Schema.Literal("admin"),
  Schema.Literal("moderator"),
  Schema.Literal("premium"),
  Schema.Literal("user")
)

export const PermissionSchema = Schema.Union(
  Schema.Literal("world.create"),
  Schema.Literal("world.edit"),
  Schema.Literal("world.delete"),
  Schema.Literal("player.kick"),
  Schema.Literal("player.ban"),
  Schema.Literal("chat.moderate"),
  Schema.Literal("system.admin")
)
```

### JWT Middleware Implementation

```typescript
// =============================================================================
// JWT認証ミドルウェア
// =============================================================================

export const JWTAuthMiddleware = Context.GenericTag<{
  readonly authenticate: (token: string) => Effect.Effect<AuthenticatedUser, AuthenticationError>
  readonly authorize: (user: AuthenticatedUser, permission: Permission) => Effect.Effect<void, AuthorizationError>
  readonly generateTokens: (user: User) => Effect.Effect<TokenPair, TokenGenerationError>
  readonly validateRefreshToken: (token: string) => Effect.Effect<User, TokenValidationError>
}>()("JWTAuthMiddleware")

export const JWTAuthMiddlewareLive = Layer.effect(
  JWTAuthMiddleware,
  Effect.gen(function* () {
    const jwtSecret = yield* Config.string("JWT_SECRET")
    const refreshSecret = yield* Config.string("JWT_REFRESH_SECRET")
    const accessTokenExpiry = yield* Config.duration("JWT_ACCESS_EXPIRY").pipe(
      Effect.orElse(() => Effect.succeed(Duration.minutes(15)))
    )
    const refreshTokenExpiry = yield* Config.duration("JWT_REFRESH_EXPIRY").pipe(
      Effect.orElse(() => Effect.succeed(Duration.days(30)))
    )

    return {
      authenticate: (token) => Effect.gen(function* () {
        try {
          const payload = jwt.verify(token, jwtSecret) as JWTPayload

          // トークンの期限チェック
          if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            yield* Effect.fail(new AuthenticationError({
              message: "Token expired",
              code: "TOKEN_EXPIRED"
            }))
          }

          // ユーザー情報の取得
          const user = yield* UserRepository.pipe(
            Effect.flatMap(repo => repo.findById(payload.sub))
          )

          if (!user.isActive) {
            yield* Effect.fail(new AuthenticationError({
              message: "User account is inactive",
              code: "USER_INACTIVE"
            }))
          }

          return {
            id: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles,
            permissions: user.permissions,
            tokenIssued: payload.iat || 0,
            tokenExpires: payload.exp || 0
          }
        } catch (error) {
          yield* Effect.fail(new AuthenticationError({
            message: "Invalid token",
            code: "INVALID_TOKEN",
            cause: error
          }))
        }
      }),

      authorize: (user, permission) => Effect.gen(function* () {
        // 管理者は全権限を持つ
        if (user.roles.includes("admin")) {
          return
        }

        // 直接的な権限チェック
        if (user.permissions.includes(permission)) {
          return
        }

        // ロールベースの権限チェック
        const hasRolePermission = yield* checkRolePermission(user.roles, permission)
        if (hasRolePermission) {
          return
        }

        yield* Effect.fail(new AuthorizationError({
          message: "Insufficient permissions",
          requiredPermission: permission,
          userPermissions: user.permissions
        }))
      }),

      generateTokens: (user) => Effect.gen(function* () {
        const now = Math.floor(Date.now() / 1000)
        const accessExpiry = now + Duration.toSeconds(accessTokenExpiry)
        const refreshExpiry = now + Duration.toSeconds(refreshTokenExpiry)

        const accessTokenPayload: JWTPayload = {
          sub: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
          permissions: user.permissions,
          iat: now,
          exp: accessExpiry,
          type: "access"
        }

        const refreshTokenPayload: JWTPayload = {
          sub: user.id,
          iat: now,
          exp: refreshExpiry,
          type: "refresh"
        }

        const accessToken = jwt.sign(accessTokenPayload, jwtSecret)
        const refreshToken = jwt.sign(refreshTokenPayload, refreshSecret)

        // リフレッシュトークンをデータベースに保存
        yield* TokenRepository.pipe(
          Effect.flatMap(repo => repo.saveRefreshToken({
            userId: user.id,
            token: refreshToken,
            expiresAt: refreshExpiry * 1000
          }))
        )

        return {
          accessToken,
          refreshToken,
          accessTokenExpiresAt: accessExpiry * 1000,
          refreshTokenExpiresAt: refreshExpiry * 1000
        }
      }),

      validateRefreshToken: (token) => Effect.gen(function* () {
        try {
          const payload = jwt.verify(token, refreshSecret) as JWTPayload

          if (payload.type !== "refresh") {
            yield* Effect.fail(new TokenValidationError({
              message: "Invalid token type",
              code: "INVALID_TOKEN_TYPE"
            }))
          }

          // データベース内のトークンをチェック
          const storedToken = yield* TokenRepository.pipe(
            Effect.flatMap(repo => repo.findRefreshToken(token)),
            Effect.option
          )

          if (Option.isNone(storedToken)) {
            yield* Effect.fail(new TokenValidationError({
              message: "Token not found",
              code: "TOKEN_NOT_FOUND"
            }))
          }

          // ユーザー情報の取得
          const user = yield* UserRepository.pipe(
            Effect.flatMap(repo => repo.findById(payload.sub))
          )

          if (!user.isActive) {
            yield* Effect.fail(new TokenValidationError({
              message: "User account is inactive",
              code: "USER_INACTIVE"
            }))
          }

          return user
        } catch (error) {
          yield* Effect.fail(new TokenValidationError({
            message: "Invalid refresh token",
            code: "INVALID_REFRESH_TOKEN",
            cause: error
          }))
        }
      })
    }
  })
)

interface JWTPayload {
  sub: string // User ID
  username?: string
  email?: string
  roles?: string[]
  permissions?: string[]
  iat?: number // Issued at
  exp?: number // Expires at
  type: "access" | "refresh"
}

interface AuthenticatedUser {
  id: string
  username: string
  email: string
  roles: string[]
  permissions: string[]
  tokenIssued: number
  tokenExpires: number
}

interface TokenPair {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: number
  refreshTokenExpiresAt: number
}
```

## WebSocket Real-time APIs

### Real-time Game Events

```typescript
// =============================================================================
// WebSocketリアルタイムAPI
// =============================================================================

export const WebSocketAPIEvents = {
  // Client -> Server Events
  clientEvents: {
    // プレイヤー移動
    "player:move": Schema.Struct({
      position: PositionSchema,
      rotation: RotationSchema,
      timestamp: Schema.Number
    }),

    // ブロック配置/破壊
    "world:block-update": Schema.Struct({
      position: PositionSchema,
      blockType: Schema.Optional(BlockTypeSchema), // null = 破壊
      action: Schema.Union(
        Schema.Literal("place"),
        Schema.Literal("break")
      ),
      timestamp: Schema.Number
    }),

    // チャットメッセージ
    "chat:message": Schema.Struct({
      content: Schema.String.pipe(
        Schema.minLength(1),
        Schema.maxLength(500)
      ),
      type: Schema.Optional(Schema.Union(
        Schema.Literal("public"),
        Schema.Literal("private"),
        Schema.Literal("team")
      )),
      targetPlayerId: Schema.Optional(Schema.String.pipe(Schema.brand(PlayerId))),
      timestamp: Schema.Number
    }),

    // インベントリ更新
    "inventory:update": Schema.Struct({
      items: Schema.Array(ItemStackSchema),
      hotbarSelection: Schema.Number.pipe(Schema.int(), Schema.between(0, 8)),
      timestamp: Schema.Number
    }),

    // プレイヤーアクション
    "player:action": Schema.Struct({
      action: Schema.Union(
        Schema.Literal("jump"),
        Schema.Literal("crouch"),
        Schema.Literal("sprint"),
        Schema.Literal("use-item"),
        Schema.Literal("attack")
      ),
      target: Schema.Optional(PositionSchema),
      timestamp: Schema.Number
    })
  },

  // Server -> Client Events
  serverEvents: {
    // ワールド更新
    "world:update": Schema.Struct({
      changes: Schema.Array(BlockChangeSchema),
      timestamp: Schema.Number
    }),

    // プレイヤー状態更新
    "player:update": Schema.Struct({
      playerId: Schema.String.pipe(Schema.brand(PlayerId)),
      position: Schema.Optional(PositionSchema),
      health: Schema.Optional(HealthSchema),
      status: Schema.Optional(PlayerStatusSchema),
      timestamp: Schema.Number
    }),

    // 他のプレイヤーの参加/退出
    "player:joined": Schema.Struct({
      player: PlayerSummarySchema,
      timestamp: Schema.Number
    }),

    "player:left": Schema.Struct({
      playerId: Schema.String.pipe(Schema.brand(PlayerId)),
      reason: Schema.Optional(Schema.String),
      timestamp: Schema.Number
    }),

    // チャットメッセージ配信
    "chat:broadcast": Schema.Struct({
      messageId: Schema.String,
      senderId: Schema.String.pipe(Schema.brand(PlayerId)),
      senderName: Schema.String,
      content: Schema.String,
      type: Schema.Union(
        Schema.Literal("public"),
        Schema.Literal("system"),
        Schema.Literal("admin")
      ),
      timestamp: Schema.Number
    }),

    // サーバー統計情報
    "server:stats": Schema.Struct({
      playerCount: Schema.Number,
      tps: Schema.Number, // Ticks Per Second
      memoryUsage: Schema.Number,
      loadedChunks: Schema.Number,
      timestamp: Schema.Number
    }),

    // エラー通知
    "error": Schema.Struct({
      code: Schema.String,
      message: Schema.String,
      details: Schema.Optional(Schema.Unknown),
      timestamp: Schema.Number
    })
  }
}

// WebSocket接続管理
export const WebSocketManager = Context.GenericTag<{
  readonly connect: (params: {
    sessionId: string
    worldId: string
    auth: AuthenticatedUser
  }) => Effect.Effect<WebSocketConnection, ConnectionError>

  readonly disconnect: (connectionId: string) => Effect.Effect<void>

  readonly broadcast: (params: {
    worldId: string
    event: string
    data: unknown
    excludeConnectionId?: string
  }) => Effect.Effect<void>

  readonly sendToPlayer: (params: {
    playerId: string
    event: string
    data: unknown
  }) => Effect.Effect<void, PlayerNotConnectedError>

  readonly getConnectedPlayers: (worldId: string) => Effect.Effect<ReadonlyArray<ConnectedPlayer>>
}>()("WebSocketManager")

export const WebSocketManagerLive = Layer.effect(
  WebSocketManager,
  Effect.gen(function* () {
    const connections = yield* Ref.make(new Map<string, WebSocketConnection>())
    const playerConnections = yield* Ref.make(new Map<string, string>()) // playerId -> connectionId

    return {
      connect: (params) => Effect.gen(function* () {
        const connectionId = generateConnectionId()
        const connection: WebSocketConnection = {
          id: connectionId,
          sessionId: params.sessionId,
          worldId: params.worldId,
          playerId: params.auth.id,
          user: params.auth,
          connectedAt: Date.now(),
          lastActivity: Date.now(),
          isAlive: true
        }

        yield* Ref.update(connections, conns =>
          new Map([...conns, [connectionId, connection]])
        )

        yield* Ref.update(playerConnections, players =>
          new Map([...players, [params.auth.id, connectionId]])
        )

        // プレイヤー参加をブロードキャスト
        yield* WebSocketManager.pipe(
          Effect.flatMap(manager => manager.broadcast({
            worldId: params.worldId,
            event: "player:joined",
            data: {
              player: {
                id: params.auth.id,
                displayName: params.auth.username,
                status: "online"
              },
              timestamp: Date.now()
            },
            excludeConnectionId: connectionId
          }))
        )

        return connection
      }),

      disconnect: (connectionId) => Effect.gen(function* () {
        const conns = yield* Ref.get(connections)
        const connection = conns.get(connectionId)

        if (!connection) {
          return
        }

        // プレイヤー退出をブロードキャスト
        yield* WebSocketManager.pipe(
          Effect.flatMap(manager => manager.broadcast({
            worldId: connection.worldId,
            event: "player:left",
            data: {
              playerId: connection.playerId,
              reason: "disconnect",
              timestamp: Date.now()
            },
            excludeConnectionId: connectionId
          }))
        )

        yield* Ref.update(connections, conns => {
          const newConns = new Map(conns)
          newConns.delete(connectionId)
          return newConns
        })

        yield* Ref.update(playerConnections, players => {
          const newPlayers = new Map(players)
          newPlayers.delete(connection.playerId)
          return newPlayers
        })
      }),

      broadcast: (params) => Effect.gen(function* () {
        const conns = yield* Ref.get(connections)

        const targetConnections = Array.from(conns.values()).filter(conn =>
          conn.worldId === params.worldId &&
          conn.id !== params.excludeConnectionId &&
          conn.isAlive
        )

        yield* Effect.all(
          targetConnections.map(conn =>
            Effect.promise(() =>
              conn.socket.send(JSON.stringify({
                event: params.event,
                data: params.data
              }))
            ).pipe(
              Effect.catchAll(error =>
                Effect.logError(`Failed to send message to connection ${conn.id}: ${error}`)
              )
            )
          ),
          { concurrency: 10 }
        )
      }),

      sendToPlayer: (params) => Effect.gen(function* () {
        const players = yield* Ref.get(playerConnections)
        const connectionId = players.get(params.playerId)

        if (!connectionId) {
          yield* Effect.fail(new PlayerNotConnectedError({
            playerId: params.playerId,
            message: "Player is not connected"
          }))
        }

        const conns = yield* Ref.get(connections)
        const connection = conns.get(connectionId)

        if (!connection || !connection.isAlive) {
          yield* Effect.fail(new PlayerNotConnectedError({
            playerId: params.playerId,
            message: "Player connection is not active"
          }))
        }

        yield* Effect.promise(() =>
          connection.socket.send(JSON.stringify({
            event: params.event,
            data: params.data
          }))
        )
      }),

      getConnectedPlayers: (worldId) => Effect.gen(function* () {
        const conns = yield* Ref.get(connections)

        return Array.from(conns.values())
          .filter(conn => conn.worldId === worldId && conn.isAlive)
          .map(conn => ({
            id: conn.playerId,
            username: conn.user.username,
            connectedAt: conn.connectedAt,
            lastActivity: conn.lastActivity
          }))
      })
    }
  })
)

interface WebSocketConnection {
  id: string
  sessionId: string
  worldId: string
  playerId: string
  user: AuthenticatedUser
  socket: WebSocket
  connectedAt: number
  lastActivity: number
  isAlive: boolean
}

interface ConnectedPlayer {
  id: string
  username: string
  connectedAt: number
  lastActivity: number
}
```

## Rate Limiting & Caching

### Rate Limiting Implementation

```typescript
// =============================================================================
// レート制限実装
// =============================================================================

export const RateLimiter = Context.GenericTag<{
  readonly checkLimit: (params: {
    key: string
    limit: number
    window: Duration.Duration
    identifier?: string
  }) => Effect.Effect<RateLimitResult, RateLimitError>

  readonly resetLimit: (key: string) => Effect.Effect<void>

  readonly getCurrentUsage: (key: string) => Effect.Effect<RateLimitStatus, never>
}>()("RateLimiter")

export const RateLimiterLive = Layer.effect(
  RateLimiter,
  Effect.gen(function* () {
    const storage = yield* Ref.make(new Map<string, RateLimitEntry>())

    return {
      checkLimit: (params) => Effect.gen(function* () {
        const now = Date.now()
        const windowMs = Duration.toMillis(params.window)

        const current = yield* Ref.get(storage)
        const entry = current.get(params.key)

        if (!entry || (now - entry.windowStart) >= windowMs) {
          // 新しいウィンドウの開始
          const newEntry: RateLimitEntry = {
            count: 1,
            windowStart: now,
            limit: params.limit,
            window: windowMs
          }

          yield* Ref.update(storage, s => new Map([...s, [params.key, newEntry]]))

          return {
            allowed: true,
            count: 1,
            limit: params.limit,
            remaining: params.limit - 1,
            resetTime: now + windowMs
          }
        }

        if (entry.count >= entry.limit) {
          // 制限に達している
          return {
            allowed: false,
            count: entry.count,
            limit: entry.limit,
            remaining: 0,
            resetTime: entry.windowStart + entry.window,
            retryAfter: entry.windowStart + entry.window - now
          }
        }

        // カウント増加
        const updatedEntry = { ...entry, count: entry.count + 1 }
        yield* Ref.update(storage, s => new Map([...s, [params.key, updatedEntry]]))

        return {
          allowed: true,
          count: updatedEntry.count,
          limit: params.limit,
          remaining: params.limit - updatedEntry.count,
          resetTime: entry.windowStart + entry.window
        }
      }),

      resetLimit: (key) => Effect.gen(function* () {
        yield* Ref.update(storage, s => {
          const newStorage = new Map(s)
          newStorage.delete(key)
          return newStorage
        })
      }),

      getCurrentUsage: (key) => Effect.gen(function* () {
        const current = yield* Ref.get(storage)
        const entry = current.get(key)

        if (!entry) {
          return {
            count: 0,
            limit: 0,
            remaining: 0,
            resetTime: 0
          }
        }

        const now = Date.now()
        if ((now - entry.windowStart) >= entry.window) {
          return {
            count: 0,
            limit: entry.limit,
            remaining: entry.limit,
            resetTime: now + entry.window
          }
        }

        return {
          count: entry.count,
          limit: entry.limit,
          remaining: Math.max(0, entry.limit - entry.count),
          resetTime: entry.windowStart + entry.window
        }
      })
    }
  })
)

interface RateLimitEntry {
  count: number
  windowStart: number
  limit: number
  window: number
}

interface RateLimitResult {
  allowed: boolean
  count: number
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

interface RateLimitStatus {
  count: number
  limit: number
  remaining: number
  resetTime: number
}

// レート制限ミドルウェア
export const createRateLimitMiddleware = (params: {
  keyGenerator: (request: Request) => string
  limit: number
  window: Duration.Duration
  skipSuccessful?: boolean
  skipFailedRequests?: boolean
}) => {
  return (request: Request, response: Response, next: () => Effect.Effect<Response>) =>
    Effect.gen(function* () {
      const rateLimiter = yield* RateLimiter
      const key = params.keyGenerator(request)

      const result = yield* rateLimiter.checkLimit({
        key,
        limit: params.limit,
        window: params.window
      })

      if (!result.allowed) {
        return new Response(JSON.stringify({
          error: "Too Many Requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((result.retryAfter || 0) / 1000)} seconds.`,
          retryAfter: result.retryAfter
        }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": new Date(result.resetTime).toISOString(),
            "Retry-After": Math.ceil((result.retryAfter || 0) / 1000).toString()
          }
        })
      }

      const finalResponse = yield* next()

      // ヘッダーを追加
      finalResponse.headers.set("X-RateLimit-Limit", result.limit.toString())
      finalResponse.headers.set("X-RateLimit-Remaining", result.remaining.toString())
      finalResponse.headers.set("X-RateLimit-Reset", new Date(result.resetTime).toISOString())

      return finalResponse
    })
}
```

### Caching Strategies

```typescript
// =============================================================================
// キャッシング戦略
// =============================================================================

export const HTTPCacheManager = Context.GenericTag<{
  readonly get: <T>(params: {
    key: string
    schema: Schema.Schema<T>
  }) => Effect.Effect<Option.Option<CachedResponse<T>>, CacheError>

  readonly set: <T>(params: {
    key: string
    value: T
    ttl?: Duration.Duration
    tags?: ReadonlyArray<string>
  }) => Effect.Effect<void, CacheError>

  readonly invalidate: (key: string) => Effect.Effect<void, CacheError>

  readonly invalidateByTags: (tags: ReadonlyArray<string>) => Effect.Effect<void, CacheError>

  readonly warmup: <T>(params: {
    key: string
    generator: () => Effect.Effect<T, never>
    ttl?: Duration.Duration
  }) => Effect.Effect<void, CacheError>
}>()("HTTPCacheManager")

export const HTTPCacheManagerLive = Layer.effect(
  HTTPCacheManager,
  Effect.gen(function* () {
    const cache = yield* Ref.make(new Map<string, CacheEntry>())
    const tagIndex = yield* Ref.make(new Map<string, Set<string>>()) // tag -> keys

    return {
      get: (params) => Effect.gen(function* () {
        const cacheData = yield* Ref.get(cache)
        const entry = cacheData.get(params.key)

        if (!entry) {
          return Option.none()
        }

        // TTL チェック
        if (Date.now() > entry.expiresAt) {
          yield* HTTPCacheManager.pipe(
            Effect.flatMap(manager => manager.invalidate(params.key))
          )
          return Option.none()
        }

        const parsed = yield* Schema.decodeUnknownEither(params.schema)(entry.value)

        if (Either.isLeft(parsed)) {
          yield* Effect.logWarn(`Cache entry for key ${params.key} failed schema validation`)
          yield* HTTPCacheManager.pipe(
            Effect.flatMap(manager => manager.invalidate(params.key))
          )
          return Option.none()
        }

        return Option.some({
          value: parsed.right,
          cachedAt: entry.cachedAt,
          expiresAt: entry.expiresAt,
          tags: entry.tags,
          hitCount: entry.hitCount + 1
        })
      }),

      set: (params) => Effect.gen(function* () {
        const now = Date.now()
        const ttl = params.ttl || Duration.minutes(5)
        const expiresAt = now + Duration.toMillis(ttl)

        const entry: CacheEntry = {
          value: params.value,
          cachedAt: now,
          expiresAt,
          tags: params.tags || [],
          hitCount: 0
        }

        yield* Ref.update(cache, c => new Map([...c, [params.key, entry]]))

        // タグインデックス更新
        if (params.tags && params.tags.length > 0) {
          yield* Ref.update(tagIndex, index => {
            const newIndex = new Map(index)
            params.tags?.forEach(tag => {
              const keys = newIndex.get(tag) || new Set()
              keys.add(params.key)
              newIndex.set(tag, keys)
            })
            return newIndex
          })
        }
      }),

      invalidate: (key) => Effect.gen(function* () {
        const cacheData = yield* Ref.get(cache)
        const entry = cacheData.get(key)

        if (!entry) {
          return
        }

        yield* Ref.update(cache, c => {
          const newCache = new Map(c)
          newCache.delete(key)
          return newCache
        })

        // タグインデックスからも削除
        yield* Ref.update(tagIndex, index => {
          const newIndex = new Map(index)
          entry.tags.forEach(tag => {
            const keys = newIndex.get(tag)
            if (keys) {
              keys.delete(key)
              if (keys.size === 0) {
                newIndex.delete(tag)
              }
            }
          })
          return newIndex
        })
      }),

      invalidateByTags: (tags) => Effect.gen(function* () {
        const index = yield* Ref.get(tagIndex)
        const keysToInvalidate = new Set<string>()

        tags.forEach(tag => {
          const keys = index.get(tag)
          if (keys) {
            keys.forEach(key => keysToInvalidate.add(key))
          }
        })

        yield* Effect.all(
          Array.from(keysToInvalidate).map(key =>
            HTTPCacheManager.pipe(
              Effect.flatMap(manager => manager.invalidate(key))
            )
          )
        )
      }),

      warmup: (params) => Effect.gen(function* () {
        const value = yield* params.generator()
        yield* HTTPCacheManager.pipe(
          Effect.flatMap(manager => manager.set({
            key: params.key,
            value,
            ttl: params.ttl
          }))
        )
      })
    }
  })
)

interface CacheEntry {
  value: unknown
  cachedAt: number
  expiresAt: number
  tags: ReadonlyArray<string>
  hitCount: number
}

interface CachedResponse<T> {
  value: T
  cachedAt: number
  expiresAt: number
  tags: ReadonlyArray<string>
  hitCount: number
}

// キャッシュミドルウェア
export const createCacheMiddleware = <T>(params: {
  keyGenerator: (request: Request) => string
  ttl?: Duration.Duration
  tags?: ReadonlyArray<string>
  schema: Schema.Schema<T>
  skipCache?: (request: Request) => boolean
}) => {
  return (request: Request, response: Response, next: () => Effect.Effect<Response>) =>
    Effect.gen(function* () {
      const cacheManager = yield* HTTPCacheManager

      // キャッシュをスキップする条件
      if (params.skipCache?.(request) || request.method !== "GET") {
        return yield* next()
      }

      const cacheKey = params.keyGenerator(request)

      // キャッシュから取得を試行
      const cached = yield* cacheManager.get({
        key: cacheKey,
        schema: params.schema
      }).pipe(Effect.option)

      if (Option.isSome(cached)) {
        // キャッシュヒット
        return new Response(JSON.stringify(cached.value.value), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Cache": "HIT",
            "X-Cache-Expires": new Date(cached.value.expiresAt).toISOString()
          }
        })
      }

      // キャッシュミス - レスポンスを生成
      const originalResponse = yield* next()

      // 成功したレスポンスをキャッシュ
      if (originalResponse.status === 200) {
        const responseText = yield* Effect.promise(() => originalResponse.text())
        const responseData = JSON.parse(responseText)

        yield* cacheManager.set({
          key: cacheKey,
          value: responseData,
          ttl: params.ttl,
          tags: params.tags
        })

        return new Response(responseText, {
          status: originalResponse.status,
          headers: {
            ...Object.fromEntries(originalResponse.headers.entries()),
            "X-Cache": "MISS"
          }
        })
      }

      return originalResponse
    })
}
```

## Error Handling & Validation

### Common Error Schemas

```typescript
// =============================================================================
// 共通エラースキーマ定義
// =============================================================================

export const ValidationErrorSchema = Schema.Struct({
  error: Schema.Literal("ValidationError"),
  message: Schema.String,
  code: Schema.Literal("VALIDATION_FAILED"),
  details: Schema.Array(Schema.Struct({
    field: Schema.String,
    message: Schema.String,
    value: Schema.Optional(Schema.Unknown)
  })),
  timestamp: Schema.Number
})

export const UnauthorizedErrorSchema = Schema.Struct({
  error: Schema.Literal("UnauthorizedError"),
  message: Schema.String,
  code: Schema.Union(
    Schema.Literal("TOKEN_MISSING"),
    Schema.Literal("TOKEN_INVALID"),
    Schema.Literal("TOKEN_EXPIRED"),
    Schema.Literal("INSUFFICIENT_PERMISSIONS")
  ),
  timestamp: Schema.Number
})

export const NotFoundErrorSchema = Schema.Struct({
  error: Schema.Literal("NotFoundError"),
  message: Schema.String,
  code: Schema.Literal("RESOURCE_NOT_FOUND"),
  resource: Schema.String,
  resourceId: Schema.Optional(Schema.String),
  timestamp: Schema.Number
})

export const ConflictErrorSchema = Schema.Struct({
  error: Schema.Literal("ConflictError"),
  message: Schema.String,
  code: Schema.Union(
    Schema.Literal("RESOURCE_ALREADY_EXISTS"),
    Schema.Literal("CONCURRENT_MODIFICATION"),
    Schema.Literal("BUSINESS_RULE_VIOLATION")
  ),
  timestamp: Schema.Number
})

export const TooManyRequestsErrorSchema = Schema.Struct({
  error: Schema.Literal("TooManyRequestsError"),
  message: Schema.String,
  code: Schema.Literal("RATE_LIMIT_EXCEEDED"),
  retryAfter: Schema.Number,
  limit: Schema.Number,
  remaining: Schema.Number,
  resetTime: Schema.Number,
  timestamp: Schema.Number
})

export const ServerErrorSchema = Schema.Struct({
  error: Schema.Literal("InternalServerError"),
  message: Schema.String,
  code: Schema.Literal("INTERNAL_ERROR"),
  requestId: Schema.String,
  timestamp: Schema.Number
})

// 統合エラーレスポンススキーマ
export const APIErrorSchema = Schema.Union(
  ValidationErrorSchema,
  UnauthorizedErrorSchema,
  NotFoundErrorSchema,
  ConflictErrorSchema,
  TooManyRequestsErrorSchema,
  ServerErrorSchema
)

// ページネーション用スキーマ
export const PaginationSchema = Schema.Struct({
  page: Schema.Number.pipe(Schema.int(), Schema.min(1)),
  pageSize: Schema.Number.pipe(Schema.int(), Schema.between(1, 100)),
  totalPages: Schema.Number.pipe(Schema.int(), Schema.min(0)),
  hasNextPage: Schema.Boolean,
  hasPreviousPage: Schema.Boolean
})

// 統計情報スキーマ
export const PlayerStatsSchema = Schema.Struct({
  playTime: Schema.Number, // 秒
  blocksPlaced: Schema.Number,
  blocksBroken: Schema.Number,
  deaths: Schema.Number,
  distanceWalked: Schema.Number,
  distanceFlown: Schema.Number,
  jumps: Schema.Number,
  itemsCrafted: Schema.Number,
  achievements: Schema.Array(AchievementSchema),
  favoriteBlocks: Schema.Array(Schema.Struct({
    blockType: BlockTypeSchema,
    count: Schema.Number
  })),
  worldsCreated: Schema.Number,
  worldsVisited: Schema.Number,
  lastPlayed: Schema.Number
})

export const AchievementSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.String,
  category: Schema.String,
  icon: Schema.String.pipe(Schema.url()),
  rarity: Schema.Union(
    Schema.Literal("common"),
    Schema.Literal("uncommon"),
    Schema.Literal("rare"),
    Schema.Literal("epic"),
    Schema.Literal("legendary")
  ),
  isUnlocked: Schema.Boolean,
  unlockedAt: Schema.Optional(Schema.Number),
  progress: Schema.Optional(Schema.Struct({
    current: Schema.Number,
    target: Schema.Number
  }))
})
```

## OpenAPI Specification

### Auto-Generated Documentation

```typescript
// =============================================================================
// OpenAPI仕様自動生成
// =============================================================================

export const generateOpenAPISpec = (): OpenAPISpec => {
  return {
    openapi: "3.1.0",
    info: {
      title: "TypeScript Minecraft Clone API",
      version: "1.0.0",
      description: "RESTful API for TypeScript Minecraft Clone game",
      contact: {
        name: "Development Team",
        url: "https://github.com/typescript-minecraft/api",
        email: "api@typescript-minecraft.dev"
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT"
      }
    },
    servers: [
      {
        url: "https://api.typescript-minecraft.dev",
        description: "Production server"
      },
      {
        url: "https://staging-api.typescript-minecraft.dev",
        description: "Staging server"
      },
      {
        url: "http://localhost:3000",
        description: "Development server"
      }
    ],
    paths: {
      ...generateWorldAPIPaths(),
      ...generatePlayerAPIPaths(),
      ...generateAuthAPIPaths(),
      ...generateSessionAPIPaths()
    },
    components: {
      schemas: {
        ...generateSchemaComponents(),
        ...generateErrorComponents()
      },
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key"
        }
      },
      responses: {
        UnauthorizedError: {
          description: "Authentication required",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UnauthorizedError" }
            }
          }
        },
        ValidationError: {
          description: "Request validation failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ValidationError" }
            }
          }
        },
        NotFoundError: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/NotFoundError" }
            }
          }
        },
        ServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/InternalServerError" }
            }
          }
        }
      }
    },
    security: [
      { BearerAuth: [] }
    ],
    tags: [
      {
        name: "Authentication",
        description: "User authentication and authorization"
      },
      {
        name: "Worlds",
        description: "World management operations"
      },
      {
        name: "Players",
        description: "Player profile and statistics"
      },
      {
        name: "Sessions",
        description: "Game session management"
      },
      {
        name: "Real-time",
        description: "WebSocket real-time communication"
      }
    ]
  }
}

interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    version: string
    description: string
    contact: {
      name: string
      url: string
      email: string
    }
    license: {
      name: string
      url: string
    }
  }
  servers: Array<{
    url: string
    description: string
  }>
  paths: Record<string, any>
  components: {
    schemas: Record<string, any>
    securitySchemes: Record<string, any>
    responses: Record<string, any>
  }
  security: Array<Record<string, string[]>>
  tags: Array<{
    name: string
    description: string
  }>
}
```

## API Testing & Documentation

### Integration Test Examples

```typescript
// =============================================================================
// API統合テスト例
// =============================================================================

describe("World API Integration Tests", () => {
  const testLayer = Layer.mergeAll(
    HTTPCacheManagerLive,
    RateLimiterLive,
    JWTAuthMiddlewareLive,
    WebSocketManagerLive
  )

  test("ワールド作成から削除までのフルフロー", async () => {
    const program = Effect.gen(function* () {
      // 1. 認証
      const authResponse = yield* Effect.promise(() =>
        fetch("/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "TestPassword123!"
          })
        })
      )

      const { accessToken } = yield* Effect.promise(() => authResponse.json())

      // 2. ワールド作成
      const createResponse = yield* Effect.promise(() =>
        fetch("/api/v1/worlds", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            name: "Test World",
            description: "A test world",
            gameMode: "creative",
            difficulty: "peaceful",
            isPublic: false,
            maxPlayers: 10
          })
        })
      )

      expect(createResponse.status).toBe(201)
      const world = yield* Effect.promise(() => createResponse.json())
      expect(world.name).toBe("Test World")

      // 3. ワールド詳細取得
      const getResponse = yield* Effect.promise(() =>
        fetch(`/api/v1/worlds/${world.id}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
      )

      expect(getResponse.status).toBe(200)
      const worldDetails = yield* Effect.promise(() => getResponse.json())
      expect(worldDetails.id).toBe(world.id)

      // 4. ワールド更新
      const updateResponse = yield* Effect.promise(() =>
        fetch(`/api/v1/worlds/${world.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            description: "Updated test world",
            maxPlayers: 20
          })
        })
      )

      expect(updateResponse.status).toBe(200)
      const updatedWorld = yield* Effect.promise(() => updateResponse.json())
      expect(updatedWorld.description).toBe("Updated test world")
      expect(updatedWorld.maxPlayers).toBe(20)

      // 5. ワールド削除
      const deleteResponse = yield* Effect.promise(() =>
        fetch(`/api/v1/worlds/${world.id}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
      )

      expect(deleteResponse.status).toBe(200)

      // 6. 削除確認
      const getDeletedResponse = yield* Effect.promise(() =>
        fetch(`/api/v1/worlds/${world.id}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`
          }
        })
      )

      expect(getDeletedResponse.status).toBe(404)

      return { world, updatedWorld }
    })

    const result = await Effect.runPromise(program.pipe(
      Effect.provide(testLayer)
    ))

    expect(result.world.name).toBe("Test World")
  })

  test("認証なしでのAPI呼び出しは401エラー", async () => {
    const response = await fetch("/api/v1/worlds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unauthorized World",
        gameMode: "survival",
        difficulty: "normal"
      })
    })

    expect(response.status).toBe(401)

    const error = await response.json()
    expect(error.error).toBe("UnauthorizedError")
    expect(error.code).toBe("TOKEN_MISSING")
  })

  test("レート制限のテスト", async () => {
    const accessToken = "valid-test-token" // テスト用トークン

    // 制限に達するまで連続リクエスト
    const requests = Array.from({ length: 102 }, (_, i) =>
      fetch("/api/v1/worlds", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      })
    )

    const responses = await Promise.all(requests)

    // 最初の100リクエストは成功
    const successfulResponses = responses.slice(0, 100)
    successfulResponses.forEach(response => {
      expect(response.status).toBe(200)
    })

    // 101番目と102番目は制限に達する
    const rateLimitedResponses = responses.slice(100)
    rateLimitedResponses.forEach(response => {
      expect(response.status).toBe(429)
    })

    const rateLimitError = await rateLimitedResponses[0].json()
    expect(rateLimitError.error).toBe("TooManyRequestsError")
    expect(rateLimitError.code).toBe("RATE_LIMIT_EXCEEDED")
  })
})
```

## Related Documents

**Core System Integration**:
- [Domain & Application APIs](./domain-application-apis.md) - ビジネスロジック層API
- [Infrastructure APIs](./infrastructure-apis.md) - インフラ層API
- [Event Bus Specification](./event-bus-specification.md) - イベント駆動API

**Security & Performance**:
- [Security Specification](../04-security-specification.md) - セキュリティ詳細仕様
- [Performance Guidelines](../../03-guidelines/02-performance-guidelines.md) - 性能最適化指針

**Architecture**:
- [Layered Architecture](../../01-architecture/04-layered-architecture.md) - API階層設計
- [Effect-TS Patterns](../../01-architecture/06-effect-ts-patterns.md) - Effect実装パターン

## Glossary Terms Used

- **RESTful API**: HTTP上のリソースベースAPI ([詳細](../../04-appendix/00-glossary.md#restful-api))
- **JWT (JSON Web Token)**: 認証トークン規格 ([詳細](../../04-appendix/00-glossary.md#jwt))
- **Rate Limiting**: API使用頻度制限 ([詳細](../../04-appendix/00-glossary.md#rate-limiting))
- **WebSocket**: 双方向リアルタイム通信 ([詳細](../../04-appendix/00-glossary.md#websocket))
- **OpenAPI**: API仕様記述規格 ([詳細](../../04-appendix/00-glossary.md#openapi))