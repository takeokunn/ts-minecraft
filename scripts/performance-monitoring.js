#!/usr/bin/env node

import { execSync, spawn } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// パフォーマンス監視ツール
class PerformanceMonitor {
  constructor(projectRoot) {
    this.projectRoot = projectRoot
    this.reportPath = join(projectRoot, 'performance-report.json')
    this.historyPath = join(projectRoot, 'performance-history.json')
  }

  // ビルド時間を測定
  async measureBuildTime() {
    console.log('⏱️ ビルド時間測定...\n')
    
    const configurations = [
      { name: 'development', command: 'pnpm run build:dev' },
      { name: 'production', command: 'pnpm run build:production' },
      { name: 'workers', command: 'pnpm run build:workers' }
    ]

    const results = {}

    for (const config of configurations) {
      console.log(`📦 ${config.name} ビルド測定中...`)
      
      const startTime = Date.now()
      try {
        execSync(config.command, { 
          cwd: this.projectRoot,
          stdio: 'pipe'
        })
        const endTime = Date.now()
        const duration = endTime - startTime
        
        results[config.name] = {
          duration: duration,
          durationSeconds: Math.round(duration / 1000 * 100) / 100,
          success: true
        }
        
        console.log(`  ✅ ${config.name}: ${results[config.name].durationSeconds}秒`)
      } catch (error) {
        results[config.name] = {
          duration: 0,
          durationSeconds: 0,
          success: false,
          error: error.message
        }
        console.log(`  ❌ ${config.name}: ビルド失敗`)
      }
    }

    return results
  }

  // バンドルサイズ監視
  async monitorBundleSize() {
    console.log('\n📊 バンドルサイズ監視...\n')
    
    const distPath = join(this.projectRoot, 'dist')
    if (!existsSync(distPath)) {
      console.log('  ❌ distディレクトリが見つかりません')
      return null
    }

    try {
      // 全ファイルのサイズを取得
      const sizes = execSync(`find ${distPath} -type f | xargs ls -la | awk '{print $5, $9}'`, 
        { encoding: 'utf8' })
      
      const files = sizes.trim().split('\n').map(line => {
        const parts = line.split(' ')
        const size = parseInt(parts[0])
        const path = parts.slice(1).join(' ')
        const name = path.replace(distPath + '/', '')
        
        return {
          name,
          size,
          sizeKB: Math.round(size / 1024 * 100) / 100,
          type: this.getFileType(name)
        }
      }).filter(file => file.size > 0)

      // タイプ別統計
      const stats = this.calculateBundleStats(files)
      
      console.log('📈 バンドルサイズ統計:')
      Object.entries(stats).forEach(([type, data]) => {
        console.log(`  ${type.toUpperCase().padEnd(10)}: ${data.count.toString().padStart(3)}個 | ${data.totalKB.toString().padStart(8)}KB`)
      })

      return stats
    } catch (error) {
      console.log('  ❌ バンドルサイズ取得エラー:', error.message)
      return null
    }
  }

  // メモリ使用量監視
  async monitorMemoryUsage() {
    console.log('\n🧠 メモリ使用量監視...\n')
    
    try {
      // Node.jsのメモリ使用量
      const memUsage = process.memoryUsage()
      
      const usage = {
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100
      }

      console.log('💾 現在のメモリ使用量:')
      console.log(`  RSS: ${usage.rss}MB`)
      console.log(`  Heap Total: ${usage.heapTotal}MB`)
      console.log(`  Heap Used: ${usage.heapUsed}MB`)
      console.log(`  External: ${usage.external}MB`)

      return usage
    } catch (error) {
      console.log('  ❌ メモリ監視エラー:', error.message)
      return null
    }
  }

  // 依存関係サイズ分析
  async analyzeDependencySizes() {
    console.log('\n📦 依存関係サイズ分析...\n')
    
    try {
      const packagePath = join(this.projectRoot, 'package.json')
      if (!existsSync(packagePath)) {
        console.log('  ❌ package.jsonが見つかりません')
        return null
      }

      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
      const deps = packageJson.dependencies || {}
      
      // node_modulesのサイズを測定
      const nodeModulesPath = join(this.projectRoot, 'node_modules')
      if (!existsSync(nodeModulesPath)) {
        console.log('  ❌ node_modulesが見つかりません')
        return null
      }

      console.log('📊 主要依存関係のサイズ:')
      const dependencySizes = {}
      
      for (const dep of Object.keys(deps)) {
        try {
          const depPath = join(nodeModulesPath, dep)
          if (existsSync(depPath)) {
            const size = execSync(`du -sk "${depPath}" | cut -f1`, { encoding: 'utf8' })
            const sizeKB = parseInt(size.trim())
            dependencySizes[dep] = sizeKB
            
            console.log(`  ${dep.padEnd(25)}: ${sizeKB.toString().padStart(8)}KB`)
          }
        } catch (e) {
          // サイズ取得に失敗した依存関係はスキップ
        }
      }

      const totalSizeKB = Object.values(dependencySizes).reduce((sum, size) => sum + size, 0)
      console.log(`\n📊 総依存関係サイズ: ${totalSizeKB}KB (${(totalSizeKB / 1024).toFixed(1)}MB)`)

      return { dependencies: dependencySizes, totalSizeKB }
    } catch (error) {
      console.log('  ❌ 依存関係分析エラー:', error.message)
      return null
    }
  }

  // 圧縮率計測
  async measureCompressionRatio() {
    console.log('\n🗜️ 圧縮率計測...\n')
    
    const distPath = join(this.projectRoot, 'dist')
    if (!existsSync(distPath)) {
      console.log('  ❌ distディレクトリが見つかりません')
      return null
    }

    try {
      // 圧縮前の総サイズ
      const originalSize = execSync(`du -sk "${distPath}" | cut -f1`, { encoding: 'utf8' })
      const originalKB = parseInt(originalSize.trim())

      // gzipシミュレーション
      const jsFiles = execSync(`find ${distPath} -name "*.js"`, { encoding: 'utf8' })
        .trim().split('\n').filter(Boolean)
      
      let totalOriginal = 0
      let totalGzip = 0
      
      jsFiles.forEach(file => {
        try {
          const original = execSync(`wc -c < "${file}"`, { encoding: 'utf8' })
          const gzipped = execSync(`gzip -c "${file}" | wc -c`, { encoding: 'utf8' })
          
          totalOriginal += parseInt(original.trim())
          totalGzip += parseInt(gzipped.trim())
        } catch (e) {
          // ファイル処理に失敗した場合はスキップ
        }
      })

      const compressionRatio = totalOriginal > 0 ? (1 - totalGzip / totalOriginal) * 100 : 0

      console.log('📊 圧縮統計:')
      console.log(`  原サイズ: ${Math.round(totalOriginal / 1024)}KB`)
      console.log(`  gzip後: ${Math.round(totalGzip / 1024)}KB`)
      console.log(`  圧縮率: ${compressionRatio.toFixed(1)}%`)

      return {
        originalKB: Math.round(totalOriginal / 1024),
        gzipKB: Math.round(totalGzip / 1024),
        compressionRatio: compressionRatio
      }
    } catch (error) {
      console.log('  ❌ 圧縮率計測エラー:', error.message)
      return null
    }
  }

  // パフォーマンス推移監視
  trackPerformanceHistory(currentReport) {
    let history = []
    
    if (existsSync(this.historyPath)) {
      try {
        history = JSON.parse(readFileSync(this.historyPath, 'utf8'))
      } catch (e) {
        history = []
      }
    }

    // 現在のデータを追加
    history.push({
      timestamp: new Date().toISOString(),
      ...currentReport
    })

    // 最新30件のみ保持
    if (history.length > 30) {
      history = history.slice(-30)
    }

    writeFileSync(this.historyPath, JSON.stringify(history, null, 2))
    
    console.log('\n📈 パフォーマンス推移分析:')
    if (history.length >= 2) {
      const previous = history[history.length - 2]
      const current = history[history.length - 1]
      
      this.comparePerformance(previous, current)
    } else {
      console.log('  初回測定のため、比較データがありません')
    }

    return history
  }

  // パフォーマンス比較
  comparePerformance(previous, current) {
    // ビルド時間比較
    if (previous.buildTimes && current.buildTimes) {
      console.log('⏱️ ビルド時間変化:')
      Object.keys(current.buildTimes).forEach(config => {
        const prev = previous.buildTimes[config]?.durationSeconds || 0
        const curr = current.buildTimes[config]?.durationSeconds || 0
        const change = curr - prev
        const changePercent = prev > 0 ? (change / prev * 100) : 0
        
        const indicator = change > 0 ? '📈' : change < 0 ? '📉' : '➡️'
        console.log(`  ${config}: ${curr}秒 ${indicator} ${change > 0 ? '+' : ''}${change.toFixed(1)}秒 (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`)
      })
    }

    // バンドルサイズ比較
    if (previous.bundleSize && current.bundleSize) {
      console.log('\n📊 バンドルサイズ変化:')
      Object.keys(current.bundleSize).forEach(type => {
        const prev = previous.bundleSize[type]?.totalKB || 0
        const curr = current.bundleSize[type]?.totalKB || 0
        const change = curr - prev
        const changePercent = prev > 0 ? (change / prev * 100) : 0
        
        const indicator = change > 0 ? '📈' : change < 0 ? '📉' : '➡️'
        console.log(`  ${type}: ${curr}KB ${indicator} ${change > 0 ? '+' : ''}${change.toFixed(1)}KB (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)`)
      })
    }
  }

  // レポート生成
  generateReport(buildTimes, bundleSize, memoryUsage, dependencyAnalysis, compressionStats) {
    const report = {
      timestamp: new Date().toISOString(),
      buildTimes,
      bundleSize,
      memoryUsage,
      dependencyAnalysis,
      compressionStats,
      recommendations: this.generateRecommendations(buildTimes, bundleSize, compressionStats)
    }

    writeFileSync(this.reportPath, JSON.stringify(report, null, 2))
    
    console.log(`\n📄 パフォーマンスレポート生成: ${this.reportPath}`)
    return report
  }

  // 改善推奨事項生成
  generateRecommendations(buildTimes, bundleSize, compressionStats) {
    const recommendations = []

    // ビルド時間の推奨
    if (buildTimes?.production?.durationSeconds > 60) {
      recommendations.push({
        type: 'build_time',
        severity: 'warning',
        message: '本番ビルド時間が60秒を超えています。並列処理の最適化を検討してください。'
      })
    }

    // バンドルサイズの推奨
    if (bundleSize?.js?.totalKB > 1000) {
      recommendations.push({
        type: 'bundle_size',
        severity: 'warning',
        message: 'JavaScriptバンドルが1MBを超えています。コード分割を検討してください。'
      })
    }

    // 圧縮率の推奨
    if (compressionStats?.compressionRatio < 70) {
      recommendations.push({
        type: 'compression',
        severity: 'info',
        message: '圧縮率が70%未満です。Brotli圧縮の導入を検討してください。'
      })
    }

    return recommendations
  }

  // ユーティリティメソッド
  getFileType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js': return 'js'
      case 'css': return 'css'
      case 'html': return 'html'
      default: return 'other'
    }
  }

  calculateBundleStats(files) {
    const stats = {}
    
    files.forEach(file => {
      if (!stats[file.type]) {
        stats[file.type] = { count: 0, totalKB: 0 }
      }
      stats[file.type].count++
      stats[file.type].totalKB += file.sizeKB
    })

    return stats
  }
}

// メイン実行
async function main() {
  console.log('🚀 TypeScript Minecraft パフォーマンス監視ツール\n')
  
  const projectRoot = join(__dirname, '..')
  const monitor = new PerformanceMonitor(projectRoot)
  
  try {
    // 各種測定実行
    const buildTimes = await monitor.measureBuildTime()
    const bundleSize = await monitor.monitorBundleSize()
    const memoryUsage = await monitor.monitorMemoryUsage()
    const dependencyAnalysis = await monitor.analyzeDependencySizes()
    const compressionStats = await monitor.measureCompressionRatio()
    
    // レポート生成
    const report = monitor.generateReport(
      buildTimes, 
      bundleSize, 
      memoryUsage, 
      dependencyAnalysis, 
      compressionStats
    )
    
    // 推移監視
    monitor.trackPerformanceHistory(report)
    
    console.log('\n✨ パフォーマンス監視完了!')
    
    // 推奨事項表示
    if (report.recommendations.length > 0) {
      console.log('\n💡 改善推奨事項:')
      report.recommendations.forEach((rec, index) => {
        const icon = rec.severity === 'warning' ? '⚠️' : 'ℹ️'
        console.log(`${index + 1}. ${icon} ${rec.message}`)
      })
    } else {
      console.log('\n✅ 現在のパフォーマンスは良好です!')
    }
    
  } catch (error) {
    console.error('❌ パフォーマンス監視エラー:', error.message)
    process.exit(1)
  }
}

main().catch(console.error)