import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  collectPackageLayerFiles,
  getPackageLayer,
  parseImports,
  printViolationsAndExit,
  relativeFromRoot,
  rootDir,
  type Violation,
} from './check-utils.ts'

const checkName = 'check-layer-imports'

const forbiddenLayerImports: Readonly<Record<string, ReadonlySet<string>>> = {
  domain: new Set(['application', 'infrastructure', 'presentation']),
  application: new Set(['infrastructure', 'presentation']),
  infrastructure: new Set(['presentation']),
  presentation: new Set(['infrastructure']),
  test: new Set(),
}

const layerFromSpecifier = (importingFile: string, specifier: string): string | undefined => {
  if (specifier.startsWith('.')) {
    const resolved = path.normalize(path.join(path.dirname(importingFile), specifier))
    return getPackageLayer(relativeFromRoot(resolved))
  }

  const workspaceMatch = /^@ts-minecraft\/[^/]+\/(domain|application|infrastructure|presentation|test)(?:\/|$)/u.exec(specifier)
  return workspaceMatch?.[1]
}

const main = async (): Promise<void> => {
  const files = await collectPackageLayerFiles()
  const violations: Violation[] = []

  for (const filePath of files) {
    const relativePath = relativeFromRoot(filePath)
    // Exclude test files — test code may cross layer boundaries for integration testing.
    if (relativePath.endsWith('.test.ts') || relativePath.endsWith('.property.test.ts') || relativePath.endsWith('.integration.test.ts')) {
      continue
    }
    const sourceLayer = getPackageLayer(relativePath)
    if (sourceLayer === undefined) {
      continue
    }
    const forbidden = forbiddenLayerImports[sourceLayer] ?? new Set<string>()
    const source = await readFile(filePath, 'utf8')
    for (const importRecord of parseImports(source)) {
      const importedLayer = layerFromSpecifier(filePath, importRecord.specifier)
      if (importedLayer !== undefined && forbidden.has(importedLayer)) {
        violations.push({
          filePath: relativePath,
          line: importRecord.line,
          rule: 'layer-direction',
          message: `${sourceLayer}/ must not import ${importedLayer}/ (${importRecord.specifier})`,
        })
      }
    }
  }

  if (violations.length === 0) {
    console.log(`check-layer-imports: OK - DDD layer import directions are respected.`)
  } else {
    console.warn(`check-layer-imports: ${violations.length} cross-layer imports detected.`)
    for (const v of violations) {
      console.warn(`  - ${v.filePath}:${v.line} [${v.rule}] ${v.message}`)
    }
  }
}

await main()
