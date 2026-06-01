import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const packagesDir = path.join(rootDir, 'packages')
const skippedDirectories = new Set(['node_modules', 'dist', 'coverage', 'e2e', '.git'])
const packageLayers = new Set(['domain', 'application', 'infrastructure', 'presentation', 'test'])

type PackageJson = {
  readonly name?: string
  readonly dependencies?: Record<string, string>
}

type PackageInfo = {
  readonly directory: string
  readonly name: string
  readonly dependencies: ReadonlySet<string>
}

type Violation = {
  readonly packageName: string
  readonly importedPackage: string
  readonly filePath: string
  readonly line: number
}

const toPosix = (filePath: string): string => filePath.split(path.sep).join('/')

const isTypeScriptSource = (filePath: string): boolean => filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')

const parseJson = <T>(source: string, filePath: string): T => {
  try {
    return JSON.parse(source) as T
  } catch {
    throw new Error(`Failed to parse ${filePath}`)
  }
}

const readPackageInfo = async (packageDirectory: string): Promise<PackageInfo | undefined> => {
  const packageJsonPath = path.join(packageDirectory, 'package.json')
  const packageJson = parseJson<PackageJson>(await readFile(packageJsonPath, 'utf8'), packageJsonPath)

  if (packageJson.name === undefined) {
    return undefined
  }

  const dependencies = Object.entries(packageJson.dependencies ?? {})
    .filter(([, version]) => version === 'workspace:*')
    .map(([dependency]) => dependency)

  return {
    directory: packageDirectory,
    name: packageJson.name,
    dependencies: new Set(dependencies),
  }
}

const collectPackages = async (): Promise<ReadonlyArray<PackageInfo>> => {
  const entries = await readdir(packagesDir, { withFileTypes: true })
  const packages: PackageInfo[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const packageInfo = await readPackageInfo(path.join(packagesDir, entry.name))
    if (packageInfo !== undefined) {
      packages.push(packageInfo)
    }
  }

  return packages
}

const isPackageSource = (packageDirectory: string, absolutePath: string): boolean => {
  const relativePath = toPosix(path.relative(packageDirectory, absolutePath))
  const segments = relativePath.split('/')

  return packageLayers.has(segments[0] ?? '') && isTypeScriptSource(relativePath)
}

const collectPackageFiles = async (packageDirectory: string, currentDirectory = packageDirectory): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(currentDirectory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (skippedDirectories.has(entry.name)) {
      continue
    }

    const absolutePath = path.join(currentDirectory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectPackageFiles(packageDirectory, absolutePath)))
      continue
    }

    if (entry.isFile() && isPackageSource(packageDirectory, absolutePath)) {
      files.push(absolutePath)
    }
  }

  return files
}

const extractWorkspacePackageName = (specifier: string): string | undefined => {
  const match = /^@ts-minecraft\/([^/]+)/u.exec(specifier)

  if (match?.[1] === undefined) {
    return undefined
  }

  return `@ts-minecraft/${match[1]}`
}

const checkFile = async (packageInfo: PackageInfo, filePath: string): Promise<ReadonlyArray<Violation>> => {
  const source = await readFile(filePath, 'utf8')
  const violations: Violation[] = []
  const importPattern = /\bfrom\s*['"]([^'"]+)['"]/gu
  const lines = source.split(/\r?\n/)

  lines.forEach((lineSource, index) => {
    importPattern.lastIndex = 0
    for (const match of lineSource.matchAll(importPattern)) {
      const specifier = match[1]
      if (specifier === undefined) {
        continue
      }

      const importedPackage = extractWorkspacePackageName(specifier)
      if (importedPackage === undefined || importedPackage === packageInfo.name) {
        continue
      }

      if (!packageInfo.dependencies.has(importedPackage)) {
        violations.push({
          packageName: packageInfo.name,
          importedPackage,
          filePath: toPosix(path.relative(rootDir, filePath)),
          line: index + 1,
        })
      }
    }
  })

  return violations
}

const checkPackage = async (packageInfo: PackageInfo): Promise<ReadonlyArray<Violation>> => {
  const files = await collectPackageFiles(packageInfo.directory)
  return (await Promise.all(files.map((filePath) => checkFile(packageInfo, filePath)))).flat()
}

const main = async (): Promise<void> => {
  const packages = await collectPackages()
  const violations = (await Promise.all(packages.map((packageInfo) => checkPackage(packageInfo)))).flat()

  if (violations.length === 0) {
    console.log('check-ddd-boundaries: OK - all @ts-minecraft imports have workspace dependencies.')
    return
  }

  console.error(`check-ddd-boundaries: ${violations.length} missing workspace package dependenc(ies):`)
  for (const violation of violations) {
    console.error(
      `- ${violation.filePath}:${violation.line} ${violation.packageName} imports ${violation.importedPackage} but package.json is missing "${violation.importedPackage}": "workspace:*"`,
    )
  }

  process.exitCode = 1
}

await main()
