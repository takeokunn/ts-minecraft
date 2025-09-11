#!/usr/bin/env npx ts-node

import { Project } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

interface MigrationRule {
  from: string;
  to: string;
}

// 移行ルール定義
const migrationRules: MigrationRule[] = [
  // エンティティ関連
  { from: '@/domain/entity', to: '@/core/entities/entity' },
  { from: '@/domain/block', to: '@/core/entities/block' },
  { from: '@/domain/block-definitions', to: '@/core/entities/block-definitions' },
  
  // 値オブジェクト関連
  { from: '@/domain/block-types', to: '@/core/values/block-type' },
  { from: '@/domain/values/block-type', to: '@/core/values/block-type' },
  { from: '@/domain/values/coordinates', to: '@/core/values/coordinates' },
  { from: '@/domain/values/entity-id', to: '@/core/values/entity-id' },
  
  // その他の一般的な移行
  { from: '@/domain/common', to: '@/core/common' },
  { from: '@/domain/types', to: '@/core/types' },
];

class ImportPathMigrator {
  private project: Project;
  private updateCount = 0;
  private fileCount = 0;
  private migrationStats = new Map<string, number>();

  constructor() {
    this.project = new Project({
      tsConfigFilePath: 'tsconfig.json',
    });
  }

  async migrate(): Promise<void> {
    console.log('🔄 Starting comprehensive import path migration...\n');

    // srcディレクトリ下のすべてのTypeScriptファイルを処理
    const sourceFiles = this.project.getSourceFiles('src/**/*.{ts,tsx}');
    console.log(`📁 Found ${sourceFiles.length} TypeScript files to process\n`);

    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      const relativeFilePath = path.relative(process.cwd(), filePath);
      
      let fileUpdated = false;
      const importDeclarations = sourceFile.getImportDeclarations();

      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        
        // 移行ルールをチェック
        for (const rule of migrationRules) {
          if (moduleSpecifier === rule.from) {
            console.log(`  📝 ${relativeFilePath}: ${rule.from} → ${rule.to}`);
            importDecl.setModuleSpecifier(rule.to);
            
            // 統計を更新
            this.migrationStats.set(rule.from, (this.migrationStats.get(rule.from) || 0) + 1);
            this.updateCount++;
            fileUpdated = true;
            break;
          }
        }
      }

      if (fileUpdated) {
        this.fileCount++;
      }
    }

    // 変更をファイルに保存
    await this.project.save();
    
    this.printResults();
  }

  private printResults(): void {
    console.log('\n✅ Migration completed!\n');
    console.log('📊 Migration Summary:');
    console.log(`  - Files updated: ${this.fileCount}`);
    console.log(`  - Total import statements updated: ${this.updateCount}\n`);
    
    if (this.migrationStats.size > 0) {
      console.log('📋 Detailed migration breakdown:');
      for (const [fromPath, count] of this.migrationStats.entries()) {
        const toPath = migrationRules.find(rule => rule.from === fromPath)?.to || 'unknown';
        console.log(`  - ${fromPath} → ${toPath}: ${count} occurrences`);
      }
    }

    console.log('\n🔍 Verifying migration...');
    this.verifyMigration();
  }

  private verifyMigration(): void {
    const sourceFiles = this.project.getSourceFiles('src/**/*.{ts,tsx}');
    const remainingOldImports: string[] = [];

    for (const sourceFile of sourceFiles) {
      const importDeclarations = sourceFile.getImportDeclarations();
      
      for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        
        // 古いドメインパスが残っているかチェック
        if (moduleSpecifier.startsWith('@/domain/')) {
          const filePath = path.relative(process.cwd(), sourceFile.getFilePath());
          remainingOldImports.push(`${filePath}: ${moduleSpecifier}`);
        }
      }
    }

    if (remainingOldImports.length === 0) {
      console.log('✅ All @/domain imports successfully migrated!');
    } else {
      console.log(`⚠️  Found ${remainingOldImports.length} remaining old imports:`);
      remainingOldImports.slice(0, 10).forEach(line => {
        console.log(`    ${line}`);
      });
      if (remainingOldImports.length > 10) {
        console.log(`    ... and ${remainingOldImports.length - 10} more`);
      }
    }
  }
}

// スクリプト実行
async function main(): Promise<void> {
  try {
    const migrator = new ImportPathMigrator();
    await migrator.migrate();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}