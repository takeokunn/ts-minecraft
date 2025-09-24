#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import * as path from 'path'

interface MigrationResult {
  file: string
  success: boolean
  changes: string[]
  error?: string
}

const results: MigrationResult[] = []

// Get all test files
function getTestFiles(): string[] {
  const output = execSync('find src -name "*.spec.ts" -type f', { encoding: 'utf-8' })
  return output.split('\n').filter((f) => f.trim())
}

// Process a single test file
function processTestFile(filePath: string): MigrationResult {
  const result: MigrationResult = { file: filePath, success: false, changes: [] }

  try {
    let content = readFileSync(filePath, 'utf-8')
    const originalContent = content

    // 1. Remove fast-check imports
    if (content.includes('fast-check')) {
      content = content.replace(/import \* as fc from ['"]fast-check['"]\n?/g, '')
      result.changes.push('Removed fast-check import')
    }

    // 2. Update vitest imports to include it from @effect/vitest
    if (!content.includes("import { it } from '@effect/vitest'") && content.includes('describe')) {
      // Check if vitest import exists
      if (content.includes('import { describe')) {
        // Keep describe and expect from vitest, add it from @effect/vitest
        content = content.replace(/import \{ ([^}]+) \} from ['"]vitest['"]/, (match, imports) => {
          const importList = imports.split(',').map((s: string) => s.trim())
          const vitestImports = importList.filter((i: string) => i !== 'it')
          let newImports = `import { ${vitestImports.join(', ')} } from 'vitest'\n`
          newImports += `import { it } from '@effect/vitest'`
          return newImports
        })
        result.changes.push('Added @effect/vitest import')
      }
    }

    // 3. Add Effect import if not present
    if (!content.includes('import { Effect') && !content.includes('import * as Effect')) {
      const firstImportIndex = content.indexOf('import')
      const firstNewlineAfterImport = content.indexOf('\n', firstImportIndex)
      if (firstNewlineAfterImport !== -1) {
        content =
          content.slice(0, firstNewlineAfterImport + 1) +
          "import { Effect } from 'effect'\n" +
          content.slice(firstNewlineAfterImport + 1)
        result.changes.push('Added Effect import')
      }
    }

    // 4. Convert regular it() to it.effect()
    // This regex matches it('...', () => { ... })
    const itRegex = /(\s*)it\s*\(\s*(['"`][^'"`]+['"`])\s*,\s*(\(\)\s*=>\s*\{[\s\S]*?\n\1\})\)/g

    let hasConversions = false
    content = content.replace(itRegex, (match, indent, testName, testBody) => {
      // Skip if already it.effect
      if (match.includes('it.effect') || match.includes('itEffect')) {
        return match
      }

      // Skip if body already contains Effect.gen
      if (testBody.includes('Effect.gen')) {
        return match
      }

      hasConversions = true

      // Extract the body content (remove arrow function wrapper)
      const bodyMatch = testBody.match(/\(\)\s*=>\s*\{([\s\S]*)\}/)
      const bodyContent = bodyMatch ? bodyMatch[1] : ''

      // Wrap in Effect.gen
      return `${indent}it.effect(${testName}, () =>
${indent}  Effect.gen(function* () {${bodyContent}
${indent}  })
${indent})`
    })

    if (hasConversions) {
      result.changes.push('Converted it() to it.effect()')
    }

    // 5. Handle fast-check property tests (basic conversion)
    if (content.includes('fc.')) {
      result.changes.push('WARNING: File contains fast-check usage that needs manual conversion')
      result.error = 'Contains fc. usage - needs manual review'
    }

    // Write changes if any were made
    if (content !== originalContent) {
      writeFileSync(filePath, content)
      result.success = true
    } else {
      result.success = true
      result.changes.push('No changes needed')
    }
  } catch (error) {
    result.error = String(error)
  }

  return result
}

// Main execution
function main() {
  console.log('🚀 Starting comprehensive test migration to Effect-TS...\n')

  const testFiles = getTestFiles()
  console.log(`Found ${testFiles.length} test files to process\n`)

  let successCount = 0
  let errorCount = 0
  let warningCount = 0

  for (const file of testFiles) {
    const result = processTestFile(file)
    results.push(result)

    if (result.error) {
      console.log(`❌ ${path.relative(process.cwd(), file)}`)
      console.log(`   Error: ${result.error}`)
      errorCount++
    } else if (result.changes.some((c) => c.includes('WARNING'))) {
      console.log(`⚠️  ${path.relative(process.cwd(), file)}`)
      result.changes.forEach((change) => console.log(`   - ${change}`))
      warningCount++
    } else if (result.changes.length > 0 && !result.changes.includes('No changes needed')) {
      console.log(`✅ ${path.relative(process.cwd(), file)}`)
      result.changes.forEach((change) => console.log(`   - ${change}`))
      successCount++
    } else {
      console.log(`⏭️  ${path.relative(process.cwd(), file)} (no changes needed)`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Migration Summary:')
  console.log('='.repeat(60))
  console.log(`Total files: ${testFiles.length}`)
  console.log(`Modified: ${successCount}`)
  console.log(`Warnings: ${warningCount}`)
  console.log(`Errors: ${errorCount}`)

  // List files that need manual attention
  const needsAttention = results.filter((r) => r.error && r.error.includes('fc.'))
  if (needsAttention.length > 0) {
    console.log('\n⚠️  Files requiring manual fast-check conversion:')
    needsAttention.forEach((r) => {
      console.log(`   - ${path.relative(process.cwd(), r.file)}`)
    })
  }

  console.log('\n✨ Migration complete!')
  console.log('\nNext steps:')
  console.log('1. Review the changes with: git diff')
  console.log('2. Run type checking: pnpm typecheck')
  console.log('3. Run tests: pnpm test')
  console.log('4. Manually convert remaining fast-check tests to it.prop()')
}

// Run the migration
main()
