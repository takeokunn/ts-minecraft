#!/usr/bin/env node
/**
 * Fix invalid `yield * Clock.currentTimeMillis` syntax in object literals
 * by converting factory functions to Effect.gen
 */

import { readFile, writeFile } from 'node:fs/promises'

const filesToFix = [
  'src/domain/camera/application_service/player_camera/types.ts',
  'src/domain/camera/types/events.ts',
  'src/domain/inventory/types/commands.ts',
  'src/domain/inventory/types/errors.ts',
  'src/domain/inventory/types/events.ts',
  'src/domain/inventory/types/queries.ts',
  'src/domain/world/application_service/progressive_loading/memory_monitor.ts',
]

/**
 * Fix a factory function that has invalid `yield *` in object literal
 * Pattern:
 *   factoryName: (params) =>
 *     Data.struct({
 *       field1: value1,
 *       timestamp: yield * Clock.currentTimeMillis,
 *     })
 *
 * Becomes:
 *   factoryName: (params): Effect.Effect<ReturnType> =>
 *     Effect.gen(function* () {
 *       const timestampValue = yield* Clock.currentTimeMillis
 *       return Data.struct({
 *         field1: value1,
 *         timestamp: timestampValue,
 *       })
 *     })
 */
async function fixFile(filePath) {
  console.log(`Processing ${filePath}...`)
  let content = await readFile(filePath, 'utf-8')
  let modified = false

  // Add Clock import if not present
  if (!content.includes('import') || !content.includes('Clock')) {
    // Find the effect import and add Clock
    content = content.replace(/from ['"]effect['"]/, (match) => {
      if (!match.includes('Clock')) {
        return match.replace('from', ', Clock } from')
      }
      return match
    })
    content = content.replace(/import \{([^}]+)\} from ['"]effect['"]/, (match, imports) => {
      if (!imports.includes('Clock')) {
        return `import { ${imports.trim()}, Clock } from 'effect'`
      }
      return match
    })
  }

  // Pattern: Find factory functions with yield * in object literal
  // This is complex, so we'll use a simpler approach: replace line by line
  const lines = content.split('\n')
  const newLines = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Check if this is a factory function line with Data.struct
    if (
      line.trim().includes(': (') &&
      line.trim().includes(') =>') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith('Data.struct({')
    ) {
      // Look ahead to find the closing })
      let j = i + 1
      let braceCount = 0
      let hasInvalidYield = false
      let closingLine = -1

      while (j < lines.length) {
        if (lines[j].includes('{')) braceCount++
        if (lines[j].includes('}')) braceCount--
        if (lines[j].includes('timestamp: yield *')) {
          hasInvalidYield = true
        }
        if (braceCount === 0) {
          closingLine = j
          break
        }
        j++
      }

      if (hasInvalidYield && closingLine > 0) {
        // Extract function info
        const funcLine = lines[i]
        const funcName = funcLine.match(/(\w+):\s*\(/)?.[1]
        const params = funcLine.match(/\(([^)]*)\)/)?.[1] || ''

        // Build new function
        newLines.push(`  ${funcName}: (${params}): Effect.Effect<any> =>`)
        newLines.push('    Effect.gen(function* () {')
        newLines.push('      const timestampValue = yield* Clock.currentTimeMillis')
        newLines.push('      return Data.struct({')

        // Copy body lines, replacing timestamp line
        for (let k = i + 2; k < closingLine; k++) {
          const bodyLine = lines[k]
          if (bodyLine.includes('timestamp: yield *')) {
            newLines.push('        timestamp: timestampValue,')
          } else {
            newLines.push(bodyLine)
          }
        }

        newLines.push('      })')
        newLines.push('    }),')

        modified = true
        i = closingLine + 1
        continue
      }
    }

    newLines.push(line)
    i++
  }

  if (modified) {
    await writeFile(filePath, newLines.join('\n'))
    console.log(`✓ Fixed ${filePath}`)
    return true
  } else {
    console.log(`  No changes needed for ${filePath}`)
    return false
  }
}

async function main() {
  let totalFixed = 0

  for (const file of filesToFix) {
    try {
      const wasFixed = await fixFile(file)
      if (wasFixed) totalFixed++
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message)
    }
  }

  console.log(`\n✓ Fixed ${totalFixed} files`)
}

main().catch(console.error)
