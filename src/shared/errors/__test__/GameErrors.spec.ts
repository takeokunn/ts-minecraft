import { describe, it, expect } from "vitest"
import { Effect, Exit } from "effect"
import {
  GameError,
  InvalidStateError,
  ResourceNotFoundError,
  ValidationError,
  PerformanceError,
  ConfigError,
  RenderError,
  WorldGenerationError,
  EntityError,
  PhysicsError
} from "../GameErrors"

describe("GameErrors", () => {
  describe("GameError", () => {
    it("should create a basic game error", () => {
      const error = new GameError({
        message: "Game error occurred",
        code: "GAME_001",
        cause: new Error("Underlying cause")
      })

      expect(error._tag).toBe("GameError")
      expect(error.message).toBe("Game error occurred")
      expect(error.code).toBe("GAME_001")
      expect(error.cause).toBeInstanceOf(Error)
    })

    it("should work with Effect", async () => {
      const program = Effect.fail(
        new GameError({
          message: "Test error"
        })
      )

      const result = await Effect.runPromiseExit(program)
      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause._tag === "Fail" ? result.cause.error : null
        expect(error).toBeInstanceOf(GameError)
      }
    })
  })

  describe("InvalidStateError", () => {
    it("should track state transitions", () => {
      const error = new InvalidStateError({
        message: "Invalid state transition",
        currentState: "menu",
        expectedState: "game",
        context: { playerId: "player1" }
      })

      expect(error._tag).toBe("InvalidStateError")
      expect(error.currentState).toBe("menu")
      expect(error.expectedState).toBe("game")
      expect(error.context).toEqual({ playerId: "player1" })
    })
  })

  describe("ResourceNotFoundError", () => {
    it("should track missing resources", () => {
      const error = new ResourceNotFoundError({
        message: "Texture not found",
        resourceType: "texture",
        resourceId: "grass_block",
        searchPath: "/assets/textures/"
      })

      expect(error._tag).toBe("ResourceNotFoundError")
      expect(error.resourceType).toBe("texture")
      expect(error.resourceId).toBe("grass_block")
      expect(error.searchPath).toBe("/assets/textures/")
    })
  })

  describe("ValidationError", () => {
    it("should track validation failures", () => {
      const error = new ValidationError({
        message: "Invalid player position",
        field: "position.y",
        value: -1000,
        constraints: { min: -64, max: 320 }
      })

      expect(error._tag).toBe("ValidationError")
      expect(error.field).toBe("position.y")
      expect(error.value).toBe(-1000)
      expect(error.constraints).toEqual({ min: -64, max: 320 })
    })
  })

  describe("PerformanceError", () => {
    it("should track performance issues", () => {
      const error = new PerformanceError({
        message: "FPS below threshold",
        metric: "fps",
        currentValue: 15,
        threshold: 30,
        severity: "critical"
      })

      expect(error._tag).toBe("PerformanceError")
      expect(error.metric).toBe("fps")
      expect(error.currentValue).toBe(15)
      expect(error.threshold).toBe(30)
      expect(error.severity).toBe("critical")
    })
  })

  describe("ConfigError", () => {
    it("should track configuration errors", () => {
      const error = new ConfigError({
        message: "Invalid config value",
        configKey: "renderDistance",
        configValue: "far",
        expectedType: "number"
      })

      expect(error._tag).toBe("ConfigError")
      expect(error.configKey).toBe("renderDistance")
      expect(error.configValue).toBe("far")
      expect(error.expectedType).toBe("number")
    })
  })

  describe("RenderError", () => {
    it("should track rendering errors", () => {
      const error = new RenderError({
        message: "WebGL context lost",
        component: "ChunkRenderer",
        phase: "render",
        gpuInfo: { vendor: "Intel", renderer: "Iris" }
      })

      expect(error._tag).toBe("RenderError")
      expect(error.component).toBe("ChunkRenderer")
      expect(error.phase).toBe("render")
      expect(error.gpuInfo).toEqual({ vendor: "Intel", renderer: "Iris" })
    })
  })

  describe("WorldGenerationError", () => {
    it("should track world generation failures", () => {
      const error = new WorldGenerationError({
        message: "Failed to generate chunk",
        chunkX: 10,
        chunkZ: -5,
        generationType: "terrain",
        seed: 12345
      })

      expect(error._tag).toBe("WorldGenerationError")
      expect(error.chunkX).toBe(10)
      expect(error.chunkZ).toBe(-5)
      expect(error.generationType).toBe("terrain")
      expect(error.seed).toBe(12345)
    })
  })

  describe("EntityError", () => {
    it("should track entity errors", () => {
      const error = new EntityError({
        message: "Failed to spawn entity",
        entityId: "entity_001",
        entityType: "zombie",
        operation: "spawn",
        position: { x: 100, y: 64, z: 200 }
      })

      expect(error._tag).toBe("EntityError")
      expect(error.entityId).toBe("entity_001")
      expect(error.entityType).toBe("zombie")
      expect(error.operation).toBe("spawn")
      expect(error.position).toEqual({ x: 100, y: 64, z: 200 })
    })
  })

  describe("PhysicsError", () => {
    it("should track physics calculation errors", () => {
      const error = new PhysicsError({
        message: "Collision detection failed",
        calculationType: "collision",
        affectedEntities: ["player1", "entity_002"],
        deltaTime: 16.67
      })

      expect(error._tag).toBe("PhysicsError")
      expect(error.calculationType).toBe("collision")
      expect(error.affectedEntities).toEqual(["player1", "entity_002"])
      expect(error.deltaTime).toBeCloseTo(16.67)
    })
  })
})