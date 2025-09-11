import { defineConfig } from 'vite'

// アセット最適化の設定
export const assetOptimizationConfig = {
  // 画像最適化
  assetsInlineLimit: 4096, // 4KB以下の画像はBase64エンコード
  
  // 画像圧縮設定（production時）
  imageOptimization: {
    jpeg: { quality: 85 },
    png: { quality: 90 },
    webp: { quality: 85 },
    avif: { quality: 80 }
  },
  
  // フォント最適化
  fontDisplay: 'swap', // フォント読み込み戦略
  fontPreload: ['woff2'], // 優先的に読み込むフォント形式
}