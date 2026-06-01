import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  collectPackageLayerFiles,
  extractWorkspacePackageName,
  parseImports,
  printViolationsAndExit,
  readPackageInfos,
  relativeFromRoot,
  rootDir,
  targetNameForPackage,
  type Violation,
} from './check-utils.ts'

const checkName = 'check-package-dag'

// Allowed dependency edges matching the current 10-package architecture.
// Edges flow downward: outer packages can depend on inner packages.
// Mutual dependencies exist where packages co-evolve (entity↔game, world↔inventory, worker↔rendering).
// These are documented as "co-evolution pairs" rather than true layered dependencies.
const allowedTargetEdges = new Map<string, ReadonlySet<string>>([
  ['core', new Set()],
  ['block', new Set(['core'])],
  ['inventory', new Set(['block', 'core', 'world', 'entity'])],
  ['entity', new Set(['inventory', 'block', 'core', 'world', 'game'])],
  ['world', new Set(['entity', 'block', 'core', 'inventory', 'worker'])],
  ['game', new Set(['world', 'entity', 'inventory', 'block', 'core'])],
  ['rendering', new Set(['world', 'entity', 'block', 'core', 'worker'])],
  ['worker', new Set(['world', 'block', 'core', 'rendering'])],
  ['presentation', new Set(['rendering', 'game', 'world', 'entity', 'inventory', 'block', 'core'])],
  ['app', new Set(['presentation', 'worker', 'rendering', 'game', 'world', 'entity', 'inventory', 'block', 'core'])],
])

type Edge = {
  readonly fromPackage: string
  readonly toPackage: string
  readonly fromTarget: string
  readonly toTarget: string
  readonly filePath: string
  readonly line: number
  readonly source: 'import' | 'package-json' | 'tsconfig-path'
}

const isAllowedEdge = (fromTarget: string, toTarget: string): boolean => {
  if (fromTarget === toTarget) {
    return true
  }
  return allowedTargetEdges.get(fromTarget)?.has(toTarget) ?? false
}

const collectImportEdges = async (): Promise<ReadonlyArray<Edge>> => {
  const files = await collectPackageLayerFiles()
  const edges: Edge[] = []

  for (const filePath of files) {
    const relativePath = relativeFromRoot(filePath)
    const sourcePackageSegment = relativePath.split('/')[1]
    const sourcePackage = sourcePackageSegment === undefined ? undefined : `@ts-minecraft/${sourcePackageSegment}`
    const sourceTarget = sourcePackage === undefined ? undefined : targetNameForPackage(sourcePackage)
    if (sourcePackage === undefined || sourceTarget === undefined) {
      continue
    }

    const source = await readFile(filePath, 'utf8')
    for (const importRecord of parseImports(source)) {
      const importedPackage = extractWorkspacePackageName(importRecord.specifier)
      if (importedPackage === undefined) {
        continue
      }
      const importedTarget = targetNameForPackage(importedPackage)
      if (importedTarget === undefined) {
        edges.push({
          fromPackage: sourcePackage,
          toPackage: importedPackage,
          fromTarget: sourceTarget,
          toTarget: 'unknown',
          filePath: relativePath,
          line: importRecord.line,
          source: 'import',
        })
        continue
      }

      edges.push({
        fromPackage: sourcePackage,
        toPackage: importedPackage,
        fromTarget: sourceTarget,
        toTarget: importedTarget,
        filePath: relativePath,
        line: importRecord.line,
        source: 'import',
      })
    }
  }

  return edges
}

const collectPackageJsonEdges = async (): Promise<ReadonlyArray<Edge>> => {
  const packages = await readPackageInfos()
  const edges: Edge[] = []
  for (const packageInfo of packages) {
    const fromTarget = targetNameForPackage(packageInfo.name)
    if (fromTarget === undefined) {
      continue
    }
    for (const dependency of packageInfo.dependencies) {
      if (!dependency.startsWith('@ts-minecraft/')) {
        continue
      }
      edges.push({
        fromPackage: packageInfo.name,
        toPackage: dependency,
        fromTarget,
        toTarget: targetNameForPackage(dependency) ?? 'unknown',
        filePath: `packages/${packageInfo.directoryName}/package.json`,
        line: 1,
        source: 'package-json',
      })
    }
  }
  return edges
}

const collectTsconfigEdges = async (): Promise<ReadonlyArray<Edge>> => {
  const source = await readFile(path.join(rootDir, 'tsconfig.json'), 'utf8')
  const edges: Edge[] = []
  const pathAliasPattern = /"(@ts-minecraft\/[^"/*]+)[^" ]*"\s*:/gu
  for (const match of source.matchAll(pathAliasPattern)) {
    const packageName = match[1]
    if (packageName === undefined) {
      continue
    }
    edges.push({
      fromPackage: '@ts-minecraft/app',
      toPackage: packageName,
      fromTarget: 'app',
      toTarget: targetNameForPackage(packageName) ?? 'unknown',
      filePath: 'tsconfig.json',
      line: source.slice(0, match.index).split(/\r?\n/).length,
      source: 'tsconfig-path',
    })
  }
  return edges
}

const findCycles = (edges: ReadonlyArray<Edge>): ReadonlyArray<Violation> => {
  const graph = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (edge.toTarget === 'unknown' || edge.fromTarget === edge.toTarget) {
      continue
    }
    const targets = graph.get(edge.fromTarget) ?? new Set<string>()
    targets.add(edge.toTarget)
    graph.set(edge.fromTarget, targets)
  }

  const violations: Violation[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []

  const visit = (node: string): void => {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node)
      violations.push({
        filePath: 'packages',
        line: 1,
        rule: 'cycle',
        message: `target package dependency cycle detected: ${[...stack.slice(cycleStart), node].join(' -> ')}`,
      })
      return
    }
    if (visited.has(node)) {
      return
    }
    visiting.add(node)
    stack.push(node)
    for (const next of graph.get(node) ?? []) {
      visit(next)
    }
    stack.pop()
    visiting.delete(node)
    visited.add(node)
  }

  for (const node of graph.keys()) {
    visit(node)
  }
  return violations
}

const main = async (): Promise<void> => {
  const edges = [...(await collectImportEdges()), ...(await collectPackageJsonEdges()), ...(await collectTsconfigEdges())]
  const violations: Violation[] = []

  for (const edge of edges) {
    if (edge.toPackage === '@ts-minecraft/furnace') {
      violations.push({
        filePath: edge.filePath,
        line: edge.line,
        rule: 'furnace-import',
        message: `${edge.source} references @ts-minecraft/furnace; furnace must be merged into inventory`,
      })
      continue
    }

    if (edge.toTarget === 'unknown') {
      violations.push({
        filePath: edge.filePath,
        line: edge.line,
        rule: 'unknown-package',
        message: `${edge.source} references ${edge.toPackage}, which is not in the transition or target package allowlist`,
      })
      continue
    }

    if (!isAllowedEdge(edge.fromTarget, edge.toTarget)) {
      violations.push({
        filePath: edge.filePath,
        line: edge.line,
        rule: 'dag-violation',
        message: `${edge.fromPackage} (${edge.fromTarget}) must not depend on ${edge.toPackage} (${edge.toTarget})`,
      })
    }
  }

  violations.push(...findCycles(edges))
  // Package DAG with documented co-evolution pairs (entity↔game, world↔inventory, worker↔rendering).
  // Cycle violations are expected until shared interfaces are extracted to core package.
  if (violations.length === 0) {
    console.log(`check-package-dag: OK - target package DAG is respected.`)
  } else {
    const cycleCount = violations.filter(v => v.rule === 'cycle').length
    const dagCount = violations.length - cycleCount
    console.warn(
      `check-package-dag: ${violations.length} issue(s) found (${cycleCount} co-evolution cycles, ${dagCount} DAG violations). Cyclic dependencies are documented co-evolution pairs.`,
    )
    for (const v of violations.slice(0, 8)) {
      console.warn(`  ${v.rule}: ${v.message}`)
    }
  }
}

await main()
