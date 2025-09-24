#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'fs'
import { globSync } from 'glob'
import * as path from 'path'

interface MigrationStats {
  totalFiles: number
  modifiedFiles: number
  itConversions: number
  fastCheckRemovals: number
  errors: string[]
}

const stats: MigrationStats = {
  totalFiles: 0,
  modifiedFiles: 0,
  itConversions: 0,
  fastCheckRemovals: 0,
  errors: [],
}

function migrateTestFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, 'utf-8')
    const originalContent = content
    let modified = false

    // Remove fast-check imports
    if (content.includes('fast-check')) {
      content = content.replace(/import \* as fc from ['"]fast-check['"]\n?/g, '')
      content = content.replace(/import \{ .+ \} from ['"]fast-check['"]\n?/g, '')
      stats.fastCheckRemovals++
      modified = true
    }

    // Add @effect/schema import if needed for property tests
    if (content.includes('fc.property') || content.includes('fc.assert')) {
      if (!content.includes('@effect/schema')) {
        const effectImportIndex = content.indexOf('import { Effect')
        if (effectImportIndex !== -1) {
          const endOfLine = content.indexOf('\n', effectImportIndex)
          content =
            content.slice(0, endOfLine + 1) + "import { Schema } from '@effect/schema'\n" + content.slice(endOfLine + 1)
        }
        modified = true
      }
    }

    // Convert fast-check property tests to it.prop
    const fcPropertyRegex = /fc\.assert\s*\(\s*fc\.property\s*\(([^)]+)\)\s*(?:,\s*\{[^}]*\})?\s*\)/g
    let match
    while ((match = fcPropertyRegex.exec(originalContent)) !== null) {
      // This is a simplified conversion - real implementation would need more sophisticated parsing
      console.log(`Found fc.property in ${filePath}, manual conversion may be needed`)
      stats.errors.push(`${filePath}: Contains fc.property that needs manual conversion`)
    }

    // Convert regular it() to it.effect() with proper formatting
    // First, ensure we have the right import
    if (!content.includes('import { it }') && content.match(/\bit\(/)) {
      // Add it import from @effect/vitest
      if (content.includes('import { describe')) {
        content = content.replace(
          /import \{ describe([^}]*)\} from ['"]vitest['"]/,
          "import { describe$1 } from 'vitest'\nimport { it } from '@effect/vitest'"
        )
      } else {
        content = "import { it } from '@effect/vitest'\n" + content
      }
      modified = true
    }

    // Convert it() to it.effect()
    // Match multiline it() blocks
    const itRegex = /\bit\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*(async\s*)?\(\s*\)\s*=>\s*\{/g
    let itMatch
    let replacements: Array<{ start: number; end: number; replacement: string }> = []

    while ((itMatch = itRegex.exec(content)) !== null) {
      const testName = itMatch[1]
      const startIndex = itMatch.index

      // Find the matching closing brace
      let braceCount = 1
      let i = itMatch.index + itMatch[0].length
      let endIndex = -1

      while (i < content.length && braceCount > 0) {
        if (content[i] === '{') braceCount++
        if (content[i] === '}') braceCount--
        if (braceCount === 0) {
          endIndex = i + 1
          // Check for closing parenthesis
          while (i < content.length && /\s/.test(content[i + 1])) i++
          if (content[i + 1] === ')') endIndex = i + 2
          break
        }
        i++
      }

      if (endIndex !== -1) {
        const testBody = content.slice(startIndex + itMatch[0].length, endIndex - 2)

        // Check if it already uses Effect
        if (!testBody.includes('Effect.gen') && !testBody.includes('Effect.succeed')) {
          // Create Effect.gen wrapper
          const indentMatch = testBody.match(/\n(\s+)/)
          const indent = indentMatch ? indentMatch[1] : '    '

          const replacement = `it.effect(${testName}, () =>
  Effect.gen(function* () {${testBody}
  })
)`
          replacements.push({ start: startIndex, end: endIndex, replacement })
          stats.itConversions++
        }
      }
    }

    // Apply replacements in reverse order to maintain indices
    replacements.sort((a, b) => b.start - a.start)
    for (const { start, end, replacement } of replacements) {
      content = content.slice(0, start) + replacement + content.slice(end)
      modified = true
    }

    // Ensure Effect is imported if we made conversions
    if (modified && !content.includes('import { Effect')) {
      content = "import { Effect } from 'effect'\n" + content
    }

    if (modified) {
      writeFileSync(filePath, content)
      stats.modifiedFiles++
      return true
    }
    return false
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error)
    stats.errors.push(`${filePath}: ${error}`)
    return false
  }
}

function main() {
  console.log('🚀 Starting test migration to Effect-TS pattern...\n')

  const testFiles = globSync('src/**/*.spec.ts')
  stats.totalFiles = testFiles.length

  console.log(`Found ${stats.totalFiles} test files to process\n`)

  for (const file of testFiles) {
    const relativePath = path.relative(process.cwd(), file)
    process.stdout.write(`Processing ${relativePath}...`)

    if (migrateTestFile(file)) {
      console.log(' ✅')
    } else {
      console.log(' (no changes)')
    }
  }

  console.log('\n📊 Migration Statistics:')
  console.log('─'.repeat(50))
  console.log(`Total files processed: ${stats.totalFiles}`)
  console.log(`Files modified: ${stats.modifiedFiles}`)
  console.log(`it() → it.effect() conversions: ${stats.itConversions}`)
  console.log(`fast-check imports removed: ${stats.fastCheckRemovals}`)

  if (stats.errors.length > 0) {
    console.log('\n⚠️  Files requiring manual attention:')
    stats.errors.forEach((error) => console.log(`  - ${error}`))
  }

  console.log('\n✨ Migration script completed!')
  console.log('Next steps:')
  console.log('1. Review the changes')
  console.log('2. Run pnpm typecheck to check for type errors')
  console.log('3. Run pnpm test to verify tests still pass')
  console.log('4. Manually convert any complex fast-check property tests')
}

main()
