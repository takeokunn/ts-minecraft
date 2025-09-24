#!/usr/bin/env tsx
/**
 * forループパターン分析ツール
 * プロジェクト全体のforループを分析し、Stream API移行のための情報を収集
 */

import * as fs from 'fs/promises'
import * as path from 'path'

// forループパターンの分類
interface ForLoopPattern {
  type: 'simple-iteration' | 'nested-loop' | 'range-iteration' | 'complex-loop'
  file: string
  line: number
  code: string
  context: string
  nestingLevel: number
  iterationVariable: string
  complexity: 'low' | 'medium' | 'high'
}

// forループの分析結果
interface AnalysisResult {
  totalLoops: number
  patternCounts: Record<ForLoopPattern['type'], number>
  complexityCounts: Record<ForLoopPattern['complexity'], number>
  patterns: ForLoopPattern[]
  fileStats: Record<string, number>
}

class ForLoopAnalyzer {
  private patterns: ForLoopPattern[] = []

  async analyze(): Promise<AnalysisResult> {
    console.log('🔍 forループ分析を開始...')

    // TypeScriptファイルを検索
    const files = await this.findTypeScriptFiles('src')

    console.log(`📁 ${files.length}個のファイルを分析中...`)

    for (const file of files) {
      await this.analyzeFile(file)
    }

    return this.generateReport()
  }

  private async findTypeScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    async function traverse(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
            await traverse(fullPath)
          }
        } else if (entry.isFile()) {
          if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath)
          }
        }
      }
    }

    await traverse(dir)
    return files
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const forLoopMatch = line.match(/for\s*\(/)

        if (forLoopMatch) {
          const pattern = this.analyzeForLoopPattern(
            filePath,
            i + 1,
            line,
            lines,
            i
          )
          if (pattern) {
            this.patterns.push(pattern)
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  ファイル分析エラー: ${filePath}`, error)
    }
  }

  private analyzeForLoopPattern(
    file: string,
    lineNumber: number,
    line: string,
    allLines: string[],
    lineIndex: number
  ): ForLoopPattern | null {
    // コンテキスト抽出（前後3行）
    const contextStart = Math.max(0, lineIndex - 1)
    const contextEnd = Math.min(allLines.length, lineIndex + 4)
    const context = allLines.slice(contextStart, contextEnd).join('\n')

    // ネストレベルを計算
    const nestingLevel = this.calculateNestingLevel(allLines, lineIndex)

    // forループのタイプを判定
    const type = this.determineLoopType(line, allLines, lineIndex)

    // 複雑度を評価
    const complexity = this.evaluateComplexity(line, context, nestingLevel)

    // 反復変数を抽出
    const iterationVariable = this.extractIterationVariable(line)

    return {
      type,
      file: file.replace(process.cwd() + '/', ''),
      line: lineNumber,
      code: line.trim(),
      context,
      nestingLevel,
      iterationVariable,
      complexity
    }
  }

  private calculateNestingLevel(lines: string[], currentIndex: number): number {
    let level = 0
    for (let i = 0; i < currentIndex; i++) {
      const line = lines[i]
      // 簡易的なブロックネストレベル計算
      level += (line.match(/\{/g) || []).length
      level -= (line.match(/\}/g) || []).length
    }
    return Math.max(0, level)
  }

  private determineLoopType(
    line: string,
    allLines: string[],
    lineIndex: number
  ): ForLoopPattern['type'] {
    // 範囲反復パターン（for (let i = 0; i < n; i++)）
    if (line.match(/for\s*\(\s*let\s+\w+\s*=\s*\d+\s*;\s*\w+\s*<\s*\w+\s*;\s*\w+\+\+\s*\)/)) {
      return 'range-iteration'
    }

    // 配列反復パターン（for (const item of items)）
    if (line.match(/for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)/)) {
      return 'simple-iteration'
    }

    // ネストループの検出
    const nextFewLines = allLines.slice(lineIndex, lineIndex + 10).join('\n')
    if (nextFewLines.match(/for\s*\(/g)?.length > 1) {
      return 'nested-loop'
    }

    return 'complex-loop'
  }

  private evaluateComplexity(
    line: string,
    context: string,
    nestingLevel: number
  ): ForLoopPattern['complexity'] {
    let complexityScore = 0

    // ネストレベルによる複雑度
    complexityScore += nestingLevel * 2

    // 条件文の複雑さ
    if (context.match(/if\s*\(/g)?.length > 2) {
      complexityScore += 2
    }

    // 関数呼び出しの多さ
    const functionCalls = context.match(/\w+\(/g)?.length || 0
    if (functionCalls > 5) {
      complexityScore += 2
    }

    // 配列操作
    if (context.match(/\.(push|pop|shift|unshift|splice)/)) {
      complexityScore += 1
    }

    if (complexityScore >= 5) return 'high'
    if (complexityScore >= 2) return 'medium'
    return 'low'
  }

  private extractIterationVariable(line: string): string {
    const matches = line.match(/for\s*\(\s*(?:let|const)\s+(\w+)/)
    return matches ? matches[1] : 'unknown'
  }

  private generateReport(): AnalysisResult {
    const patternCounts = {
      'simple-iteration': 0,
      'nested-loop': 0,
      'range-iteration': 0,
      'complex-loop': 0
    }

    const complexityCounts = {
      'low': 0,
      'medium': 0,
      'high': 0
    }

    const fileStats: Record<string, number> = {}

    for (const pattern of this.patterns) {
      patternCounts[pattern.type]++
      complexityCounts[pattern.complexity]++

      fileStats[pattern.file] = (fileStats[pattern.file] || 0) + 1
    }

    return {
      totalLoops: this.patterns.length,
      patternCounts,
      complexityCounts,
      patterns: this.patterns,
      fileStats
    }
  }

  async generateDetailedReport(result: AnalysisResult): Promise<string> {
    const report = `
# forループ分析レポート

## 📊 統計サマリー

- **総forループ数**: ${result.totalLoops}

### パターン別分布
- 単純反復: ${result.patternCounts['simple-iteration']}個
- ネストループ: ${result.patternCounts['nested-loop']}個
- 範囲反復: ${result.patternCounts['range-iteration']}個
- 複雑ループ: ${result.patternCounts['complex-loop']}個

### 複雑度別分布
- 低複雑度: ${result.complexityCounts['low']}個
- 中複雑度: ${result.complexityCounts['medium']}個
- 高複雑度: ${result.complexityCounts['high']}個

## 📁 ファイル別統計
${Object.entries(result.fileStats)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([file, count]) => `- ${file}: ${count}個`)
  .join('\n')}

## 🎯 移行優先順位

### Phase 2: テストコード（低リスク）
${result.patterns
  .filter(p => p.file.includes('__test__') || p.file.includes('.spec.') || p.file.includes('.test.'))
  .slice(0, 5)
  .map(p => `- ${p.file}:${p.line} (${p.complexity}複雑度)`)
  .join('\n')}

### Phase 3: 単純反復（低リスク）
${result.patterns
  .filter(p => p.type === 'simple-iteration' && p.complexity === 'low')
  .slice(0, 5)
  .map(p => `- ${p.file}:${p.line} (${p.type})`)
  .join('\n')}

### Phase 4: 範囲反復（中リスク）
${result.patterns
  .filter(p => p.type === 'range-iteration')
  .slice(0, 5)
  .map(p => `- ${p.file}:${p.line} (${p.complexity}複雑度)`)
  .join('\n')}

### Phase 5: 高複雑度（高リスク）
${result.patterns
  .filter(p => p.complexity === 'high')
  .slice(0, 5)
  .map(p => `- ${p.file}:${p.line} (${p.type}, nest:${p.nestingLevel})`)
  .join('\n')}

## 🔧 推奨変換パターン

### パターンA: 単純配列反復
\`\`\`typescript
// Before
for (const item of items) {
  process(item)
}

// After
yield* Stream.fromIterable(items).pipe(
  Stream.runForEach((item) => process(item))
)
\`\`\`

### パターンB: 範囲反復
\`\`\`typescript
// Before
for (let i = 0; i < count; i++) {
  processIndex(i)
}

// After
yield* Stream.range(0, count - 1).pipe(
  Stream.runForEach((i) => processIndex(i))
)
\`\`\`

### パターンC: ネストループ→flatMap
\`\`\`typescript
// Before
for (let x = 0; x < width; x++) {
  for (let y = 0; y < height; y++) {
    processCoord(x, y)
  }
}

// After
yield* Stream.range(0, width - 1).pipe(
  Stream.flatMap((x) =>
    Stream.range(0, height - 1).pipe(
      Stream.map((y) => ({ x, y }))
    )
  ),
  Stream.runForEach(({ x, y }) => processCoord(x, y))
)
\`\`\`

生成日時: ${new Date().toISOString()}
`

    return report
  }
}

// メイン実行
async function main() {
  const analyzer = new ForLoopAnalyzer()
  const result = await analyzer.analyze()

  console.log(`\n📈 分析完了: ${result.totalLoops}個のforループを検出`)

  // 詳細レポート生成
  const report = await analyzer.generateDetailedReport(result)

  // レポートをファイルに保存
  const reportPath = 'for-loop-analysis-report.md'
  await fs.writeFile(reportPath, report, 'utf-8')

  console.log(`📄 詳細レポートを生成: ${reportPath}`)

  // JSON形式でも保存（ツール用）
  await fs.writeFile(
    'for-loop-patterns.json',
    JSON.stringify(result, null, 2),
    'utf-8'
  )

  console.log('📄 JSON形式のデータを生成: for-loop-patterns.json')
}

// ESモジュール対応のメイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { ForLoopAnalyzer, type ForLoopPattern, type AnalysisResult }