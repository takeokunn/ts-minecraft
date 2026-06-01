import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export const rootDir = process.cwd()
export const packagesDir = path.join(rootDir, 'packages')

export type Violation = {
  readonly filePath: string
  readonly line: number
  readonly rule: string
  readonly message: string
}

export type ImportRecord = {
  readonly specifier: string
  readonly line: number
  readonly text: string
}

export type PackageInfo = {
  readonly directory: string
  readonly directoryName: string
  readonly name: string
  readonly dependencies: ReadonlySet<string>
}

const skippedDirectories = new Set(['node_modules', 'dist', 'coverage', 'e2e', '.git', '.sisyphus'])
const packageLayerNames = new Set(['domain', 'application', 'infrastructure', 'presentation', 'test'])

export const toPosix = (filePath: string): string => filePath.split(path.sep).join('/')

export const isTypeScriptSource = (filePath: string): boolean => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')

export const isTestFile = (relativePath: string): boolean =>
  relativePath.startsWith('test/') ||
  relativePath.includes('/test/') ||
  relativePath.endsWith('.test.ts') ||
  relativePath.endsWith('.spec.ts') ||
  relativePath.endsWith('.property.test.ts')

export const isConfigFile = (relativePath: string): boolean =>
  relativePath.endsWith('.config.ts') || relativePath.endsWith('/config.ts')

export const relativeFromRoot = (absolutePath: string): string => toPosix(path.relative(rootDir, absolutePath))

export const getPackageLayer = (relativePath: string): string | undefined => {
  const segments = relativePath.split('/')
  if (segments[0] !== 'packages') {
    return undefined
  }
  return packageLayerNames.has(segments[2] ?? '') ? segments[2] : undefined
}

export const getPackageDirectoryName = (relativePath: string): string | undefined => {
  const segments = relativePath.split('/')
  return segments[0] === 'packages' ? segments[1] : undefined
}

export const isPackageLayerSource = (absolutePath: string): boolean => {
  const relativePath = relativeFromRoot(absolutePath)
  const segments = relativePath.split('/')
  return segments[0] === 'packages' && packageLayerNames.has(segments[2] ?? '') && isTypeScriptSource(relativePath)
}

export const isProductionPackageSource = (absolutePath: string): boolean => {
  const relativePath = relativeFromRoot(absolutePath)
  return isPackageLayerSource(absolutePath) && !isTestFile(relativePath) && !relativePath.includes('/test/')
}

export const collectFiles = async (
  directory: string,
  predicate: (absolutePath: string) => boolean,
): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (skippedDirectories.has(entry.name)) {
      continue
    }

    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, predicate)))
      continue
    }

    if (entry.isFile() && predicate(absolutePath)) {
      files.push(absolutePath)
    }
  }

  return files
}

export const collectPackageLayerFiles = (): Promise<ReadonlyArray<string>> => collectFiles(rootDir, isPackageLayerSource)

export const collectProductionPackageFiles = (): Promise<ReadonlyArray<string>> => collectFiles(rootDir, isProductionPackageSource)

export const collectTestFiles = (): Promise<ReadonlyArray<string>> =>
  collectFiles(rootDir, (absolutePath) => isTypeScriptSource(absolutePath) && isTestFile(relativeFromRoot(absolutePath)))

export const readPackageInfos = async (): Promise<ReadonlyArray<PackageInfo>> => {
  const entries = await readdir(packagesDir, { withFileTypes: true })
  const packages: PackageInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const packageJsonPath = path.join(packagesDir, entry.name, 'package.json')
    if (!existsSync(packageJsonPath)) {
      continue
    }

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
      readonly name?: string
      readonly dependencies?: Record<string, string>
      readonly devDependencies?: Record<string, string>
    }

    if (packageJson.name === undefined) {
      continue
    }

    const dependencies = new Set(
      Object.entries({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) })
        .filter(([, version]) => version === 'workspace:*')
        .map(([dependency]) => dependency),
    )

    packages.push({
      directory: path.join(packagesDir, entry.name),
      directoryName: entry.name,
      name: packageJson.name,
      dependencies,
    })
  }

  return packages
}

export const extractWorkspacePackageName = (specifier: string): string | undefined => {
  const match = /^@ts-minecraft\/([^/]+)/u.exec(specifier)
  return match?.[1] === undefined ? undefined : `@ts-minecraft/${match[1]}`
}

export const parseImports = (source: string): ReadonlyArray<ImportRecord> => {
  const imports: ImportRecord[] = []
  const importPattern = /\bimport\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|\bexport\s+(?:type\s+)?[^'";]+?\s+from\s+['"]([^'"]+)['"]/gu
  const lines = source.split(/\r?\n/)

  lines.forEach((line, index) => {
    importPattern.lastIndex = 0
    for (const match of line.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2]
      if (specifier !== undefined) {
        imports.push({ specifier, line: index + 1, text: line })
      }
    }
  })

  return imports
}

export const lineOfIndex = (source: string, index: number): number => source.slice(0, index).split(/\r?\n/).length

export const lineForPattern = (source: string, pattern: RegExp): number => {
  pattern.lastIndex = 0
  const match = pattern.exec(source)
  return match === null ? 1 : lineOfIndex(source, match.index)
}

export const printViolationsAndExit = (checkName: string, okMessage: string, violations: ReadonlyArray<Violation>): never => {
  if (violations.length === 0) {
    console.log(`${checkName}: OK - ${okMessage}`)
    process.exit(0)
  }

  console.error(`${checkName}: ${violations.length} violation(s) found:`)
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line} [${violation.rule}] ${violation.message}`)
  }
  process.exit(1)
}

export const targetPackageAliases: Readonly<Record<string, string>> = {
  '@ts-minecraft/core': 'core',
  '@ts-minecraft/kernel': 'core',
  '@ts-minecraft/block': 'block',
  '@ts-minecraft/terrain': 'block',
  '@ts-minecraft/inventory': 'inventory',
  '@ts-minecraft/entity': 'entity',
  '@ts-minecraft/entities': 'entity',
  '@ts-minecraft/player': 'entity',
  '@ts-minecraft/world': 'world',
  '@ts-minecraft/world-state': 'world',
  '@ts-minecraft/game': 'game',
  '@ts-minecraft/physics': 'game',
  '@ts-minecraft/rendering': 'rendering',
  '@ts-minecraft/worker': 'worker',
  '@ts-minecraft/presentation': 'presentation',
  '@ts-minecraft/app': 'app',
}

export const targetNameForPackage = (packageName: string): string | undefined => targetPackageAliases[packageName]

const preserveNewlines = (value: string): string => value.replace(/[^\r\n]/gu, ' ')

export const stripCommentsAndStrings = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//gu, (match) => preserveNewlines(match))
    .replace(/\/\/.*$/gmu, (match) => preserveNewlines(match))
    .replace(/`(?:\\.|[^`])*`/gu, (match) => preserveNewlines(match))
    .replace(/'(?:\\.|[^'])*'/gu, (match) => preserveNewlines(match))
    .replace(/"(?:\\.|[^"])*"/gu, (match) => preserveNewlines(match))
