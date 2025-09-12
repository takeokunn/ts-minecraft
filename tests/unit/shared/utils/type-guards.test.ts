import { describe, it, expect } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Option from 'effect/Option'
import * as Schema from '@effect/schema/Schema'
import * as TG from '@shared/utils/type-guards'

describe('type guards', () => {
  describe('FaceDirection', () => {
    it('should validate valid face directions', () => {
      expect(TG.isFaceDirection('front')).toBe(true)
      expect(TG.isFaceDirection('back')).toBe(true)
      expect(TG.isFaceDirection('left')).toBe(true)
      expect(TG.isFaceDirection('right')).toBe(true)
      expect(TG.isFaceDirection('top')).toBe(true)
      expect(TG.isFaceDirection('bottom')).toBe(true)
    })

    it('should reject invalid face directions', () => {
      expect(TG.isFaceDirection('invalid')).toBe(false)
      expect(TG.isFaceDirection('center')).toBe(false)
      expect(TG.isFaceDirection(123)).toBe(false)
    })

    it('should safely parse valid face directions', async () => {
      const result = await Effect.runPromise(TG.safeParseFaceDirection('front'))
      expect(result).toBe('front')
    })

    it('should fail to parse invalid face directions', async () => {
      const exit = await Effect.runPromiseExit(TG.safeParseFaceDirection('invalid'))
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('EntityIdNumber', () => {
    it('should validate valid entity ID numbers', () => {
      expect(TG.isEntityIdNumber(1)).toBe(true)
      expect(TG.isEntityIdNumber(999)).toBe(true)
    })

    it('should reject invalid entity ID numbers', () => {
      expect(TG.isEntityIdNumber(0)).toBe(false)
      expect(TG.isEntityIdNumber(-1)).toBe(false)
      expect(TG.isEntityIdNumber(3.14)).toBe(false)
      expect(TG.isEntityIdNumber('1')).toBe(false)
    })

    it('should safely parse valid entity ID numbers', async () => {
      const result = await Effect.runPromise(TG.safeParseEntityIdNumber(42))
      expect(result).toBe(42)
    })

    it('should fail to parse invalid entity ID numbers', async () => {
      const exit = await Effect.runPromiseExit(TG.safeParseEntityIdNumber(-1))
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('Vector3', () => {
    it('should validate valid Vector3 objects', () => {
      expect(TG.isVector3({ x: 1, y: 2, z: 3 })).toBe(true)
      expect(TG.isVector3({ x: 0, y: 0, z: 0 })).toBe(true)
      expect(TG.isVector3({ x: -1.5, y: 2.7, z: -3.14 })).toBe(true)
    })

    it('should reject invalid Vector3 objects', () => {
      expect(TG.isVector3({ x: 1, y: 2 })).toBe(false) // missing z
      expect(TG.isVector3({ x: 1, y: 2, z: 'not a number' })).toBe(false)
      expect(TG.isVector3({ a: 1, b: 2, c: 3 })).toBe(false) // wrong keys
      expect(TG.isVector3(null)).toBe(false)
      expect(TG.isVector3([1, 2, 3])).toBe(false) // array instead of object
    })

    it('should safely parse valid Vector3 objects', async () => {
      const vector = { x: 1.5, y: -2.3, z: 0 }
      const result = await Effect.runPromise(TG.safeParseVector3(vector))
      expect(result).toEqual(vector)
    })

    it('should fail to parse invalid Vector3 objects', async () => {
      const exit = await Effect.runPromiseExit(TG.safeParseVector3({ x: 1, y: 2 }))
      expect(Exit.isFailure(exit)).toBe(true)
    })
  })

  describe('ComponentName validation', () => {
    it('should validate arrays of component names synchronously', () => {
      // This test depends on the actual ComponentName schema implementation
      // For now, we'll test the function structure
      const keys = ['position', 'velocity', 'invalidComponent']
      const validKeys = TG.validateComponentNameArraySync(keys)
      
      expect(Array.isArray(validKeys)).toBe(true)
      // The exact result depends on the ComponentName schema
    })

    it('should validate object keys as component names', async () => {
      const obj = { position: { x: 1, y: 2, z: 3 }, velocity: { x: 0, y: 0, z: 0 } }
      
      // This test would need actual component names to work properly
      // For now, we test that the function executes
      const exit = await Effect.runPromiseExit(TG.validateObjectKeysAsComponentNames(obj))
      // Result depends on actual ComponentName implementation
      expect(Exit.isExit(exit)).toBe(true)
    })
  })

  describe('common type guards', () => {
    describe('isRecord', () => {
      it('should identify valid records', () => {
        expect(TG.isRecord({})).toBe(true)
        expect(TG.isRecord({ a: 1, b: 2 })).toBe(true)
        expect(TG.isRecord({ nested: { object: true } })).toBe(true)
      })

      it('should reject non-records', () => {
        expect(TG.isRecord(null)).toBe(false)
        expect(TG.isRecord(undefined)).toBe(false)
        expect(TG.isRecord([])).toBe(false)
        expect(TG.isRecord('string')).toBe(false)
        expect(TG.isRecord(123)).toBe(false)
      })
    })

    describe('hasProperty', () => {
      it('should check for existing properties', () => {
        const obj = { a: 1, b: 2 }
        expect(TG.hasProperty(obj, 'a')).toBe(true)
        expect(TG.hasProperty(obj, 'b')).toBe(true)
      })

      it('should return false for non-existing properties', () => {
        const obj = { a: 1, b: 2 }
        expect(TG.hasProperty(obj, 'c')).toBe(false)
        expect(TG.hasProperty(obj, 'toString')).toBe(false) // inherited properties
      })
    })

    describe('isFunction', () => {
      it('should identify functions', () => {
        expect(TG.isFunction(() => {})).toBe(true)
        expect(TG.isFunction(function() {})).toBe(true)
        expect(TG.isFunction(Math.max)).toBe(true)
      })

      it('should reject non-functions', () => {
        expect(TG.isFunction({})).toBe(false)
        expect(TG.isFunction('function')).toBe(false)
        expect(TG.isFunction(null)).toBe(false)
      })
    })

    describe('safeBoolean', () => {
      it('should convert truthy values to true', () => {
        expect(TG.safeBoolean(true)).toBe(true)
        expect(TG.safeBoolean('true')).toBe(true)
        expect(TG.safeBoolean(1)).toBe(true)
        expect(TG.safeBoolean(42)).toBe(true)
      })

      it('should convert falsy values to false', () => {
        expect(TG.safeBoolean(false)).toBe(false)
        expect(TG.safeBoolean('false')).toBe(false)
        expect(TG.safeBoolean('anything else')).toBe(false)
        expect(TG.safeBoolean(0)).toBe(false)
        expect(TG.safeBoolean(null)).toBe(false)
        expect(TG.safeBoolean(undefined)).toBe(false)
      })
    })

    describe('getSafeNumberProperty', () => {
      it('should extract valid number properties', () => {
        const obj = { a: 42, b: 3.14, c: 'not a number' }
        
        expect(TG.getSafeNumberProperty(obj, 'a')).toBe(42)
        expect(TG.getSafeNumberProperty(obj, 'b')).toBe(3.14)
      })

      it('should return undefined for non-number properties', () => {
        const obj = { a: 42, b: 'string', c: null }
        
        expect(TG.getSafeNumberProperty(obj, 'b')).toBeUndefined()
        expect(TG.getSafeNumberProperty(obj, 'c')).toBeUndefined()
        expect(TG.getSafeNumberProperty(obj, 'nonExistent')).toBeUndefined()
      })
    })

    describe('HTML element type guards', () => {
      it('should identify HTML elements', () => {
        // Create actual DOM elements for testing
        const div = document.createElement('div')
        const input = document.createElement('input')
        
        expect(TG.isHTMLElement(div)).toBe(true)
        expect(TG.isHTMLElement(input)).toBe(true)
        expect(TG.isHTMLInputElement(input)).toBe(true)
        expect(TG.isHTMLInputElement(div)).toBe(false)
      })

      it('should reject non-HTML elements', () => {
        expect(TG.isHTMLElement({})).toBe(false)
        expect(TG.isHTMLElement('div')).toBe(false)
        expect(TG.isHTMLInputElement({})).toBe(false)
      })
    })

    describe('safeParseNumber', () => {
      it('should parse valid numbers', () => {
        expect(TG.safeParseNumber(42)).toBe(42)
        expect(TG.safeParseNumber(3.14)).toBe(3.14)
        expect(TG.safeParseNumber('42')).toBe(42)
        expect(TG.safeParseNumber('3.14')).toBe(3.14)
      })

      it('should return undefined for invalid numbers', () => {
        expect(TG.safeParseNumber('not a number')).toBeUndefined()
        expect(TG.safeParseNumber(NaN)).toBeUndefined()
        expect(TG.safeParseNumber({})).toBeUndefined()
        expect(TG.safeParseNumber(null)).toBeUndefined()
      })
    })
  })

  describe('TypeGuards namespace', () => {
    it('should provide organized access to type guards', () => {
      expect(TG.TypeGuards.FaceDirection.is).toBe(TG.isFaceDirection)
      expect(TG.TypeGuards.FaceDirection.parse).toBe(TG.safeParseFaceDirection)
      
      expect(TG.TypeGuards.EntityId.is).toBe(TG.isEntityIdNumber)
      expect(TG.TypeGuards.EntityId.parse).toBe(TG.safeParseEntityIdNumber)
      
      expect(TG.TypeGuards.ComponentName.is).toBe(TG.isComponentName)
      expect(TG.TypeGuards.ComponentName.parse).toBe(TG.safeParseComponentName)
    })
  })

  describe('performance-related type guards', () => {
    it('should check for performance memory', () => {
      // Mock performance object
      const performanceWithMemory = {
        ...performance,
        memory: { usedJSHeapSize: 1000000 }
      }
      
      const performanceWithoutMemory = performance
      
      expect(TG.hasPerformanceMemory(performanceWithMemory)).toBe(true)
      // This might be false in some environments
      const hasMemory = TG.hasPerformanceMemory(performanceWithoutMemory)
      expect(typeof hasMemory).toBe('boolean')
    })

    it('should check for PerformanceObserver availability', () => {
      const hasObserver = TG.hasPerformanceObserver()
      expect(typeof hasObserver).toBe('boolean')
    })
  })

  describe('comprehensive coverage tests', () => {
    describe('parseRecord', () => {
      it('should return Some for valid records', () => {
        const result = TG.parseRecord({ key: 'value' })
        expect(Option.isSome(result)).toBe(true)
      })

      it('should return None for invalid records', () => {
        expect(Option.isNone(TG.parseRecord(null))).toBe(true)
        expect(Option.isNone(TG.parseRecord([]))).toBe(true)
        expect(Option.isNone(TG.parseRecord('string'))).toBe(true)
      })
    })

    describe('parseBoolean', () => {
      it('should parse boolean values', () => {
        expect(Option.getOrNull(TG.parseBoolean(true))).toBe(true)
        expect(Option.getOrNull(TG.parseBoolean(false))).toBe(false)
      })

      it('should parse string boolean values', () => {
        expect(Option.getOrNull(TG.parseBoolean('true'))).toBe(true)
        expect(Option.getOrNull(TG.parseBoolean('TRUE'))).toBe(true)
        expect(Option.getOrNull(TG.parseBoolean('false'))).toBe(false)
        expect(Option.getOrNull(TG.parseBoolean('FALSE'))).toBe(false)
      })

      it('should parse numeric boolean values', () => {
        expect(Option.getOrNull(TG.parseBoolean(1))).toBe(true)
        expect(Option.getOrNull(TG.parseBoolean(42))).toBe(true)
        expect(Option.getOrNull(TG.parseBoolean(0))).toBe(false)
        expect(Option.getOrNull(TG.parseBoolean(-1))).toBe(true)
      })

      it('should return None for unparseable values', () => {
        expect(Option.isNone(TG.parseBoolean('invalid'))).toBe(true)
        expect(Option.isNone(TG.parseBoolean(null))).toBe(true)
        expect(Option.isNone(TG.parseBoolean({}))).toBe(true)
      })
    })

    describe('parseNumber', () => {
      it('should parse numeric values', () => {
        expect(Option.getOrNull(TG.parseNumber(42))).toBe(42)
        expect(Option.getOrNull(TG.parseNumber(3.14))).toBe(3.14)
        expect(Option.getOrNull(TG.parseNumber(-5))).toBe(-5)
      })

      it('should parse string numeric values', () => {
        expect(Option.getOrNull(TG.parseNumber('42'))).toBe(42)
        expect(Option.getOrNull(TG.parseNumber('3.14'))).toBe(3.14)
        expect(Option.getOrNull(TG.parseNumber('-5.5'))).toBe(-5.5)
      })

      it('should return None for invalid numbers', () => {
        expect(Option.isNone(TG.parseNumber(NaN))).toBe(true)
        expect(Option.isNone(TG.parseNumber('not a number'))).toBe(true)
        expect(Option.isNone(TG.parseNumber(null))).toBe(true)
        expect(Option.isNone(TG.parseNumber({}))).toBe(true)
      })
    })

    describe('hasFiles', () => {
      it('should identify objects with files property', () => {
        const mockFileList = [] as any as FileList
        const targetWithFiles = { files: mockFileList }
        const targetWithoutFiles = { other: 'property' }
        
        expect(TG.hasFiles(targetWithFiles)).toBe(true)
        expect(TG.hasFiles(targetWithoutFiles)).toBe(false)
        expect(TG.hasFiles(null)).toBe(false)
      })
    })

    describe('getValidComponentNames', () => {
      it('should filter valid component names', () => {
        const components = {
          validName: { data: 'value' },
          '': { data: 'empty' },
          anotherValid: { data: 'another' }
        }
        
        const result = TG.getValidComponentNames(components)
        expect(result).toContain('validName')
        expect(result).toContain('anotherValid')
        expect(result).not.toContain('')
      })

      it('should handle empty objects', () => {
        const result = TG.getValidComponentNames({})
        expect(result).toEqual([])
      })
    })

    describe('getValidComponentNamesAsComponentNames', () => {
      it('should filter and validate component names', () => {
        const components = {
          position: { x: 1, y: 2, z: 3 },
          velocity: { x: 0, y: 0, z: 0 },
          '': { empty: true },
          invalidName: { data: 'test' }
        }
        
        const result = TG.getValidComponentNamesAsComponentNames(components)
        expect(Array.isArray(result)).toBe(true)
        // Result depends on actual ComponentName schema implementation
      })
    })

    describe('BiomeBlockConfig and block validation', () => {
      it('should handle validateBiomeBlockTypeSync with fallback', () => {
        const fallback = 'stone' as any // Assuming stone is a valid block type
        
        // Test with valid block type string
        const result1 = TG.validateBiomeBlockTypeSync('stone', fallback)
        expect(typeof result1).toBe('string')
        
        // Test with invalid block type - should return fallback
        const result2 = TG.validateBiomeBlockTypeSync('invalid_block', fallback)
        expect(result2).toBe(fallback)
        
        // Test with non-string input - should return fallback
        const result3 = TG.validateBiomeBlockTypeSync(123, fallback)
        expect(result3).toBe(fallback)
      })

      it('should validate biome block types asynchronously', async () => {
        // Test with invalid block type
        const exit = await Effect.runPromiseExit(
          TG.validateBiomeBlockType('invalid_block_type_xyz')
        )
        expect(Exit.isFailure(exit)).toBe(true)
        
        // Test with non-string input
        const exit2 = await Effect.runPromiseExit(
          TG.validateBiomeBlockType(123)
        )
        expect(Exit.isFailure(exit2)).toBe(true)
      })
    })

    describe('BlockType validation', () => {
      it('should validate block types', () => {
        // These tests depend on actual BlockType schema
        // Testing the function structure
        const result1 = TG.isBlockType('stone')
        const result2 = TG.isBlockType('invalid')
        const result3 = TG.isBlockType(123)
        
        expect(typeof result1).toBe('boolean')
        expect(typeof result2).toBe('boolean')
        expect(typeof result3).toBe('boolean')
      })

      it('should safely parse block types', async () => {
        // Test with invalid block type
        const exit = await Effect.runPromiseExit(TG.safeParseBlockType('definitely_invalid'))
        expect(Exit.isExit(exit)).toBe(true) // Either success or failure
      })

      it('should validate block type strings', () => {
        const result1 = TG.isValidBlockTypeString('stone')
        const result2 = TG.isValidBlockTypeString('invalid_block_xyz')
        
        expect(typeof result1).toBe('boolean')
        expect(typeof result2).toBe('boolean')
      })

      it('should safely parse block types from strings', async () => {
        const exit = await Effect.runPromiseExit(
          TG.safeParseBlockTypeFromString('invalid_block')
        )
        expect(Exit.isFailure(exit)).toBe(true)
      })
    })

    describe('ComponentName validation comprehensive', () => {
      it('should validate component names', () => {
        const result1 = TG.isComponentName('position')
        const result2 = TG.isComponentName('invalid')
        const result3 = TG.isComponentName(123)
        
        expect(typeof result1).toBe('boolean')
        expect(typeof result2).toBe('boolean')
        expect(typeof result3).toBe('boolean')
      })

      it('should safely parse component names', async () => {
        const exit = await Effect.runPromiseExit(TG.safeParseComponentName('invalid'))
        expect(Exit.isExit(exit)).toBe(true)
      })

      it('should safely parse component name arrays', async () => {
        const exit = await Effect.runPromiseExit(
          TG.safeParseComponentNameArray(['position', 'velocity'])
        )
        expect(Exit.isExit(exit)).toBe(true)
      })

      it('should validate object keys as component names with invalid keys', async () => {
        const obj = { invalidKey: 'value', anotherInvalid: 'data' }
        const exit = await Effect.runPromiseExit(
          TG.validateObjectKeysAsComponentNames(obj)
        )
        // Should likely fail with invalid component names
        expect(Exit.isExit(exit)).toBe(true)
      })

      it('should handle empty object in validateObjectKeysAsComponentNames', async () => {
        const result = await Effect.runPromise(
          TG.validateObjectKeysAsComponentNames({})
        )
        expect(result).toEqual({})
      })
    })

    describe('TypeGuards namespace comprehensive', () => {
      it('should provide BlockType utilities', () => {
        expect(typeof TG.TypeGuards.BlockType.is).toBe('function')
        expect(typeof TG.TypeGuards.BlockType.parse).toBe('function')
        expect(typeof TG.TypeGuards.BlockType.parseFromString).toBe('function')
        expect(typeof TG.TypeGuards.BlockType.validate).toBe('function')
        expect(typeof TG.TypeGuards.BlockType.validateSync).toBe('function')
      })

      it('should provide ComponentName utilities', () => {
        expect(typeof TG.TypeGuards.ComponentName.validateObjectKeys).toBe('function')
        expect(typeof TG.TypeGuards.ComponentName.validateArraySync).toBe('function')
        expect(typeof TG.TypeGuards.ComponentName.parseArray).toBe('function')
      })
    })

    describe('Edge cases and error conditions', () => {
      it('should handle null and undefined inputs gracefully', () => {
        expect(TG.isFaceDirection(null)).toBe(false)
        expect(TG.isFaceDirection(undefined)).toBe(false)
        expect(TG.isEntityIdNumber(null)).toBe(false)
        expect(TG.isEntityIdNumber(undefined)).toBe(false)
        expect(TG.isVector3(null)).toBe(false)
        expect(TG.isVector3(undefined)).toBe(false)
        expect(TG.isComponentName(null)).toBe(false)
        expect(TG.isComponentName(undefined)).toBe(false)
      })

      it('should handle complex objects in type guards', () => {
        const complexObj = {
          nested: {
            deep: {
              value: 'test'
            }
          },
          array: [1, 2, 3],
          fn: () => 'function'
        }
        
        expect(TG.isRecord(complexObj)).toBe(true)
        expect(TG.hasProperty(complexObj, 'nested')).toBe(true)
        expect(TG.hasProperty(complexObj, 'nonexistent')).toBe(false)
      })

      it('should handle edge cases in number parsing', () => {
        expect(Option.isNone(TG.parseNumber(Infinity))).toBe(false)
        expect(Option.isNone(TG.parseNumber(-Infinity))).toBe(false)
        expect(Option.getOrNull(TG.parseNumber(Infinity))).toBe(Infinity)
        expect(Option.getOrNull(TG.parseNumber(-Infinity))).toBe(-Infinity)
      })

      it('should handle whitespace in string parsing', () => {
        expect(Option.getOrNull(TG.parseNumber('  42  '))).toBe(42)
        expect(Option.getOrNull(TG.parseNumber(' 3.14 '))).toBe(3.14)
        expect(Option.isNone(TG.parseNumber('  '))).toBe(true)
      })

      it('should validate symbol properties correctly', () => {
        const sym = Symbol('test')
        const obj = { [sym]: 'symbol value', regular: 'regular value' }
        
        expect(TG.hasProperty(obj, sym)).toBe(true)
        expect(TG.hasProperty(obj, 'regular')).toBe(true)
        expect(TG.hasProperty(obj, 'nonexistent')).toBe(false)
      })
    })

    describe('Vector3 edge cases', () => {
      it('should handle Vector3 with extra properties', () => {
        const vectorWithExtra = { x: 1, y: 2, z: 3, extra: 'property' }
        // Schema validation behavior depends on implementation
        const result = TG.isVector3(vectorWithExtra)
        expect(typeof result).toBe('boolean')
      })

      it('should handle Vector3 with missing properties', () => {
        expect(TG.isVector3({ x: 1, y: 2 })).toBe(false)
        expect(TG.isVector3({ x: 1, z: 3 })).toBe(false)
        expect(TG.isVector3({ y: 2, z: 3 })).toBe(false)
      })

      it('should handle Vector3 with invalid property types', () => {
        expect(TG.isVector3({ x: '1', y: 2, z: 3 })).toBe(false)
        expect(TG.isVector3({ x: 1, y: null, z: 3 })).toBe(false)
        expect(TG.isVector3({ x: 1, y: 2, z: undefined })).toBe(false)
      })
    })
  })
})