#!/usr/bin/env node

import { createRequire } from 'module'
import { execSync } from 'child_process'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync, brotliCompressSync } from 'zlib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

// ビルドサイズ分析ツール
class BuildAnalyzer {
  constructor(projectRoot) {
    this.projectRoot = projectRoot
    this.distPath = join(projectRoot, 'dist')
  }

  // ビルドサイズを測定（強化版）
  analyzeBuildSizes() {
    console.log('📊 ビルドサイズ分析を開始...\n')
    
    if (!existsSync(this.distPath)) {
      console.log('❌ distディレクトリが見つかりません。先にビルドを実行してください。')
      return
    }

    try {
      // 全アセットファイルを取得
      const sizes = execSync(`find ${this.distPath} -type f | xargs ls -la | awk '{print $5, $9}'`, 
        { encoding: 'utf8' })
      
      const files = sizes.trim().split('\n').map(line => {
        const parts = line.split(' ')
        const size = parseInt(parts[0])
        const path = parts.slice(1).join(' ')
        const relativePath = path.replace(this.distPath + '/', '')
        
        return {
          name: relativePath,
          path: path,
          size: size,
          sizeKB: Math.round(size / 1024 * 100) / 100,
          type: this.getFileType(relativePath),
          compressed: null // 後で計算
        }
      }).filter(file => file.size > 0)

      // 実際の圧縮サイズを計算
      files.forEach(file => {
        if (file.type === 'js' || file.type === 'css' || file.type === 'html') {
          try {
            const content = readFileSync(file.path)
            const gzipped = gzipSync(content)
            const brotlied = brotliCompressSync(content)
            
            file.compressed = {
              gzip: Math.round(gzipped.length / 1024 * 100) / 100,
              brotli: Math.round(brotlied.length / 1024 * 100) / 100
            }
          } catch (e) {
            file.compressed = { gzip: 0, brotli: 0 }
          }
        }
      })

      // ファイルタイプ別統計
      const stats = this.calculateDetailedStats(files)
      
      // サイズ別にソート
      files.sort((a, b) => b.size - a.size)

      console.log('🏆 最大のファイル（トップ15）:')
      files.slice(0, 15).forEach((file, index) => {
        const compressedInfo = file.compressed 
          ? ` (gzip: ${file.compressed.gzip}KB, brotli: ${file.compressed.brotli}KB)`
          : ''
        console.log(`${(index + 1).toString().padStart(2)}.  ${file.name.padEnd(45)} ${file.sizeKB.toString().padStart(8)}KB${compressedInfo}`)
      })

      console.log('\n📈 詳細統計:')
      Object.entries(stats).forEach(([type, data]) => {
        const compressedTotal = data.files.reduce((sum, f) => {
          return sum + (f.compressed?.gzip || 0)
        }, 0)
        
        console.log(`${type.toUpperCase().padEnd(10)}: ${data.count.toString().padStart(3)}個 | ` +
                   `${data.totalKB.toString().padStart(8)}KB | ` +
                   `gzip: ${compressedTotal.toFixed(1).padStart(6)}KB`)
      })

      const totalSizeKB = stats.total.totalKB
      const totalGzipKB = stats.total.files.reduce((sum, f) => sum + (f.compressed?.gzip || 0), 0)
      const totalBrotliKB = stats.total.files.reduce((sum, f) => sum + (f.compressed?.brotli || 0), 0)
      
      console.log('\n🗜️ 圧縮効果:')
      console.log(`原サイズ: ${totalSizeKB}KB`)
      console.log(`gzip圧縮: ${totalGzipKB.toFixed(1)}KB (${(100 - totalGzipKB / totalSizeKB * 100).toFixed(1)}% 削減)`)
      console.log(`brotli圧縮: ${totalBrotliKB.toFixed(1)}KB (${(100 - totalBrotliKB / totalSizeKB * 100).toFixed(1)}% 削減)`)

      return {
        totalSizeKB,
        totalGzipKB,
        totalBrotliKB,
        fileCount: files.length,
        files,
        stats
      }
    } catch (error) {
      console.error('❌ サイズ分析エラー:', error.message)
    }
  }

  // ファイルタイプを判定
  getFileType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js': return 'js'
      case 'css': return 'css'
      case 'html': return 'html'
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
      case 'avif': return 'image'
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'eot': return 'font'
      case 'json': return 'json'
      case 'map': return 'sourcemap'
      default: return 'other'
    }
  }

  // 詳細統計を計算
  calculateDetailedStats(files) {
    const stats = {}
    
    // タイプ別に分類
    files.forEach(file => {
      if (!stats[file.type]) {
        stats[file.type] = { count: 0, totalKB: 0, files: [] }
      }
      stats[file.type].count++
      stats[file.type].totalKB += file.sizeKB
      stats[file.type].files.push(file)
    })

    // 合計を追加
    stats.total = {
      count: files.length,
      totalKB: files.reduce((sum, f) => sum + f.sizeKB, 0),
      files: files
    }

    return stats
  }

  // チャンク分析（強化版）
  analyzeChunks() {
    console.log('🧩 詳細チャンク分析...\n')
    
    try {
      const allJsFiles = execSync(`find ${this.distPath} -name "*.js"`, 
        { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
      
      const chunks = allJsFiles.map(file => {
        const stat = execSync(`ls -la "${file}"`, { encoding: 'utf8' })
        const size = parseInt(stat.split(/\s+/)[4])
        const name = file.replace(this.distPath + '/', '')
        
        let category = 'other'
        if (name.includes('vendor')) category = 'vendor'
        else if (name.includes('effect')) category = 'effect'
        else if (name.includes('three')) category = 'three'
        else if (name.includes('chunk')) category = 'chunk'
        else if (name.includes('worker')) category = 'worker'
        else if (name.includes('index') || name.includes('main')) category = 'entry'
        
        return {
          name,
          size,
          sizeKB: Math.round(size / 1024 * 100) / 100,
          category
        }
      }).sort((a, b) => b.size - a.size)

      // カテゴリ別統計
      const categoryStats = {}
      chunks.forEach(chunk => {
        if (!categoryStats[chunk.category]) {
          categoryStats[chunk.category] = { count: 0, totalKB: 0, chunks: [] }
        }
        categoryStats[chunk.category].count++
        categoryStats[chunk.category].totalKB += chunk.sizeKB
        categoryStats[chunk.category].chunks.push(chunk)
      })

      console.log('📦 チャンクカテゴリ別統計:')
      Object.entries(categoryStats).sort((a, b) => b[1].totalKB - a[1].totalKB).forEach(([cat, data]) => {
        console.log(`${cat.toUpperCase().padEnd(10)}: ${data.count.toString().padStart(2)}個 | ${data.totalKB.toFixed(1).padStart(8)}KB`)
      })

      console.log('\n🎯 最大チャンク（トップ10）:')
      chunks.slice(0, 10).forEach((chunk, index) => {
        console.log(`${(index + 1).toString().padStart(2)}.  [${chunk.category.padEnd(7)}] ${chunk.name.padEnd(40)} ${chunk.sizeKB.toString().padStart(8)}KB`)
      })

      // 最適化推奨
      console.log('\n💡 チャンク最適化推奨:')
      const largeChunks = chunks.filter(c => c.sizeKB > 200)
      if (largeChunks.length > 0) {
        console.log(`- ${largeChunks.length}個の大きなチャンク (>200KB) を分割検討`)
        largeChunks.slice(0, 3).forEach(chunk => {
          console.log(`  - ${chunk.name} (${chunk.sizeKB}KB)`)
        })
      } else {
        console.log('- チャンクサイズは適切です')
      }

      return { chunks, categoryStats }
    } catch (error) {
      console.log('  チャンクファイルが見つかりませんでした')
      return null
    }
  }

  // 依存関係分析
  analyzeDependencies() {
    console.log('\n🔗 依存関係分析...\n')
    
    try {
      // package.jsonから依存関係を読み取り
      const packagePath = join(this.projectRoot, 'package.json')
      if (!existsSync(packagePath)) {
        console.log('  package.jsonが見つかりません')
        return
      }

      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
      
      // バンドルサイズ推定（人気ライブラリの概算）
      const knownSizes = {
        'three': 580,
        'effect': 120,
        '@effect/platform': 80,
        '@effect/schema': 150,
        'gl-matrix': 45,
        'uuid': 15,
        'alea': 8,
        'simplex-noise': 12,
        'stats.js': 25
      }

      console.log('📦 依存関係とバンドルサイズ推定:')
      let totalEstimatedKB = 0
      Object.keys(deps).forEach(dep => {
        const estimatedSize = knownSizes[dep] || 50 // デフォルト推定
        totalEstimatedKB += estimatedSize
        const marker = knownSizes[dep] ? '' : ' (推定)'
        console.log(`  ${dep.padEnd(25)} ${estimatedSize.toString().padStart(6)}KB${marker}`)
      })

      console.log(`\n📊 総推定サイズ: ${totalEstimatedKB}KB`)
      
      return { deps, totalEstimatedKB }
    } catch (error) {
      console.log('  依存関係分析エラー:', error.message)
    }
  }

  // Tree shaking 効果分析
  analyzeTreeShaking(stats) {
    console.log('\n🌳 Tree Shaking 効果分析...\n')
    
    if (!stats) return

    const jsStats = stats.js || { totalKB: 0 }
    const totalBundleKB = jsStats.totalKB

    // 推定される未使用コード量（経験値ベース）
    const estimatedUnusedPercentage = 15 // 15%が一般的
    const potentialSavingsKB = totalBundleKB * (estimatedUnusedPercentage / 100)

    console.log('🎯 Tree Shaking 効果:')
    console.log(`現在のJSバンドルサイズ: ${totalBundleKB.toFixed(1)}KB`)
    console.log(`推定未使用コード: ${potentialSavingsKB.toFixed(1)}KB (${estimatedUnusedPercentage}%)`)
    console.log(`最適化後予想サイズ: ${(totalBundleKB - potentialSavingsKB).toFixed(1)}KB`)

    // 最適化推奨
    console.log('\n💡 Tree Shaking 最適化推奨:')
    if (potentialSavingsKB > 50) {
      console.log('- より厳密なES modulesの使用を検討')
      console.log('- 未使用のエクスポートを削除')
      console.log('- Dynamic importの活用を検討')
    } else {
      console.log('- Tree shakingは適切に機能しています')
    }

    return { totalBundleKB, potentialSavingsKB }
  }

  // レポート生成
  generateReport(analysis, chunkAnalysis, depAnalysis, treeShakingAnalysis) {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: analysis?.fileCount || 0,
        totalSizeKB: analysis?.totalSizeKB || 0,
        gzipSizeKB: analysis?.totalGzipKB || 0,
        brotliSizeKB: analysis?.totalBrotliKB || 0
      },
      chunks: chunkAnalysis?.categoryStats || {},
      dependencies: depAnalysis || {},
      treeShaking: treeShakingAnalysis || {},
      stats: analysis?.stats || {}
    }

    const reportPath = join(this.projectRoot, 'build-analysis-report.json')
    writeFileSync(reportPath, JSON.stringify(reportData, null, 2))
    
    console.log(`\n📄 詳細レポートを生成: ${reportPath}`)
    return reportData
  }

  // パフォーマンス評価
  evaluatePerformance(analysis) {
    console.log('⚡ パフォーマンス評価:\n')
    
    const { totalSizeKB, estimatedGzipSize } = analysis
    
    // 目標値との比較
    const targets = {
      initialBundle: 200, // 200KB以下
      totalBundle: 1000,  // 1MB以下  
      gzipBundle: 300     // 300KB以下（gzip後）
    }

    console.log('🎯 目標達成度:')
    console.log(`初期バンドル目標 (${targets.initialBundle}KB): ${totalSizeKB <= targets.initialBundle ? '✅' : '❌'} 現在: ${totalSizeKB}KB`)
    console.log(`総バンドル目標 (${targets.totalBundle}KB): ${totalSizeKB <= targets.totalBundle ? '✅' : '❌'} 現在: ${totalSizeKB}KB`)
    console.log(`gzip後目標 (${targets.gzipBundle}KB): ${estimatedGzipSize <= targets.gzipBundle ? '✅' : '❌'} 現在: ${estimatedGzipSize}KB`)

    // 改善提案
    console.log('\n💡 最適化提案:')
    if (totalSizeKB > targets.totalBundle) {
      console.log('- より積極的なコード分割を検討してください')
      console.log('- 未使用のライブラリやコードを削除してください')
    }
    if (estimatedGzipSize > targets.gzipBundle) {
      console.log('- Brotli圧縮の導入を検討してください')
      console.log('- 動的インポートの利用を増やしてください')
    }
    
    return {
      initialBundleOk: totalSizeKB <= targets.initialBundle,
      totalBundleOk: totalSizeKB <= targets.totalBundle,
      gzipBundleOk: estimatedGzipSize <= targets.gzipBundle
    }
  }
}

// メイン実行
async function main() {
  console.log('🚀 TypeScript Minecraft ビルド分析ツール\n')
  
  const projectRoot = join(__dirname, '..')
  const analyzer = new BuildAnalyzer(projectRoot)
  
  const analysis = analyzer.analyzeBuildSizes()
  if (analysis) {
    analyzer.analyzeChunks()
    analyzer.evaluatePerformance(analysis)
  }
  
  console.log('\n✨ 分析完了!')
}

main().catch(console.error)