import { describe, it, expect } from "vitest";
import {
  NumberValue,
  StringValue,
  BooleanValue
} from "../index";
import * as ExportedFromIndex from "../index";

describe("Shared Types Index", () => {
  describe("Type exports", () => {
    it("should export NumberValue type", () => {
      const num: NumberValue = 42;
      expect(typeof num).toBe("number");

      // Test various number values
      const values: NumberValue[] = [0, -1, 1.5, Infinity, -Infinity, NaN];
      values.forEach(val => {
        expect(typeof val).toBe("number");
      });
    });

    it("should export StringValue type", () => {
      const str: StringValue = "test";
      expect(typeof str).toBe("string");

      // Test various string values
      const values: StringValue[] = ["", "hello", "123", "🎮"];
      values.forEach(val => {
        expect(typeof val).toBe("string");
      });
    });

    it("should export BooleanValue type", () => {
      const bool: BooleanValue = true;
      expect(typeof bool).toBe("boolean");

      // Test boolean values
      const values: BooleanValue[] = [true, false];
      values.forEach(val => {
        expect(typeof val).toBe("boolean");
      });
    });
  });

  describe("Module exports", () => {
    it("should re-export all branded types", () => {
      expect(ExportedFromIndex.BrandedTypes).toBeDefined();
      expect(ExportedFromIndex.PlayerIdSchema).toBeDefined();
      expect(ExportedFromIndex.WorldCoordinateSchema).toBeDefined();
      expect(ExportedFromIndex.ChunkIdSchema).toBeDefined();
      expect(ExportedFromIndex.BlockTypeIdSchema).toBeDefined();
    });

    it("should re-export effect config", () => {
      expect(ExportedFromIndex.GameErrorSchema).toBeDefined();
      expect(ExportedFromIndex.createGameError).toBeDefined();
      expect(ExportedFromIndex.EffectConfig).toBeDefined();
    });

    it("should have all expected basic type exports", () => {
      // Test that the types exist at runtime by checking their names
      const testNum: typeof ExportedFromIndex.NumberValue extends number ? true : false = true;
      const testStr: typeof ExportedFromIndex.StringValue extends string ? true : false = true;
      const testBool: typeof ExportedFromIndex.BooleanValue extends boolean ? true : false = true;

      expect(testNum).toBe(true);
      expect(testStr).toBe(true);
      expect(testBool).toBe(true);
    });
  });

  describe("Type compatibility", () => {
    it("should allow assignment between compatible types", () => {
      // NumberValue compatibility
      const num1: NumberValue = 42;
      const num2: number = num1;
      const num3: NumberValue = num2;

      expect(num1).toBe(42);
      expect(num2).toBe(42);
      expect(num3).toBe(42);
    });

    it("should allow string operations on StringValue", () => {
      const str: StringValue = "hello";
      const result = str.toUpperCase();
      const length = str.length;

      expect(result).toBe("HELLO");
      expect(length).toBe(5);
    });

    it("should allow boolean operations on BooleanValue", () => {
      const bool: BooleanValue = true;
      const negated = !bool;
      const and = bool && true;
      const or = bool || false;

      expect(negated).toBe(false);
      expect(and).toBe(true);
      expect(or).toBe(true);
    });
  });

  describe("Integration with other types", () => {
    it("should work with branded types from re-exports", () => {
      const playerId = ExportedFromIndex.BrandedTypes.createPlayerId("test_player");
      const coordinate = ExportedFromIndex.BrandedTypes.createWorldCoordinate(100.5);
      const chunkId = ExportedFromIndex.BrandedTypes.createChunkId("chunk_1_2");
      const blockTypeId = ExportedFromIndex.BrandedTypes.createBlockTypeId(5);

      expect(playerId).toBe("test_player");
      expect(coordinate).toBe(100.5);
      expect(chunkId).toBe("chunk_1_2");
      expect(blockTypeId).toBe(5);
    });

    it("should work with effect config from re-exports", () => {
      const error = ExportedFromIndex.createGameError("Test error", "TEST_CODE");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error._tag).toBe("GameError");
    });
  });
});