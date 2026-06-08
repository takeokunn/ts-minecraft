import { describe, it } from "@effect/vitest";
import { expect } from "vitest";
import { Array as Arr, Option } from "effect";
import {
  ItemStack,
  createStack,
  addToStack,
  removeFromStack,
  canMerge,
  mergeStacks,
  damageStack,
} from "../domain/item-stack";
import { getMaxDurability } from "../domain/durability";

describe("domain/item-stack — durability", () => {
  describe("createStack — durability", () => {
    const toolCases = [
      "WOODEN_SWORD",
      "STONE_SWORD",
      "IRON_SWORD",
      "DIAMOND_SWORD",
      "WOODEN_PICKAXE",
      "DIAMOND_PICKAXE",
    ] as const;
    Arr.forEach(toolCases, (tool) => {
      it(`initializes ${tool} at full durability`, () => {
        const stack = createStack(tool);
        expect(stack.durability).toBe(
          Option.getOrThrow(getMaxDurability(tool)),
        );
      });
    });

    const nonToolCases = ["DIRT", "STONE", "WOOD", "GLASS"] as const;
    Arr.forEach(nonToolCases, (item) => {
      it(`leaves durability undefined for non-tool ${item}`, () => {
        const stack = createStack(item, 5);
        expect(stack.durability).toBeUndefined();
      });
    });
  });

  describe("damageStack", () => {
    it("decrements a durable tool by the default amount (1)", () => {
      const stack = createStack("IRON_SWORD");
      const result = damageStack(stack);
      expect(Option.isSome(result)).toBe(true);
      const next = Option.getOrThrow(result);
      expect(next.durability).toBe(
        Option.getOrThrow(getMaxDurability("IRON_SWORD")) - 1,
      );
      expect(next.itemType).toBe("IRON_SWORD");
      expect(next.count).toBe(1);
    });

    it("decrements by a custom amount", () => {
      const stack = createStack("DIAMOND_SWORD");
      const result = damageStack(stack, 10);
      expect(Option.getOrThrow(result).durability).toBe(
        Option.getOrThrow(getMaxDurability("DIAMOND_SWORD")) - 10,
      );
    });

    it("returns Option.none when the tool breaks (durability hits 0)", () => {
      const stack = createStack("WOODEN_SWORD");
      const result = damageStack(stack, 59);
      expect(Option.isNone(result)).toBe(true);
    });

    it("returns Option.none when damage exceeds remaining durability", () => {
      const stack = createStack("WOODEN_SWORD");
      const result = damageStack(stack, 1000);
      expect(Option.isNone(result)).toBe(true);
    });

    it("passes a non-durable stack through unchanged", () => {
      const stack = createStack("DIRT", 10);
      const result = damageStack(stack, 5);
      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result)).toBe(stack);
    });
  });

  describe("canMerge — durability", () => {
    it("refuses to merge durable tools of the same type", () => {
      const a = createStack("IRON_SWORD");
      const b = createStack("IRON_SWORD");
      expect(canMerge(a, b)).toBe(false);
    });

    it("still merges identical non-durable items", () => {
      const a = createStack("DIRT", 5);
      const b = createStack("DIRT", 10);
      expect(canMerge(a, b)).toBe(true);
    });
  });

  describe("durability preservation through stack ops", () => {
    it("addToStack carries the durability field onto the reconstructed stack", () => {
      const stack = new ItemStack({
        itemType: "IRON_SWORD",
        count: 1,
        durability: 100,
      });
      const result = addToStack(stack, 5);
      expect(result.itemType).toBe("IRON_SWORD");
      expect(result.count).toBe(1);
      expect(result.durability).toBe(100);
    });

    it("removeFromStack carries the durability field onto the reduced stack", () => {
      const stack = new ItemStack({
        itemType: "IRON_SWORD",
        count: 3,
        durability: 100,
      });
      const result = removeFromStack(stack, 1);
      expect(Option.isSome(result)).toBe(true);
      const next = Option.getOrThrow(result);
      expect(next.itemType).toBe("IRON_SWORD");
      expect(next.count).toBe(2);
      expect(next.durability).toBe(100);
    });

    it("mergeStacks leaves both durable tool stacks unchanged and preserves durability", () => {
      const a = new ItemStack({
        itemType: "IRON_SWORD",
        count: 1,
        durability: 100,
      });
      const b = new ItemStack({
        itemType: "IRON_SWORD",
        count: 1,
        durability: 50,
      });
      const [newA, remainderB] = mergeStacks(a, b);
      expect(newA).toBe(a);
      expect(newA.durability).toBe(100);
      expect(Option.isSome(remainderB)).toBe(true);
      const unwrappedB = Option.getOrThrow(remainderB);
      expect(unwrappedB).toBe(b);
      expect(unwrappedB.durability).toBe(50);
    });
  });
});
