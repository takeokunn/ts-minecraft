#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findSpecFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findSpecFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function completeTestMigration(content, filepath) {
  let result = content;

  // Step 1: Ensure correct imports
  if (result.includes('it.effect(') || result.includes('it(')) {
    // Fix imports
    result = fixImports(result);
  }

  // Step 2: Convert any remaining it() tests
  result = convertRemainingItTests(result);

  // Step 3: Fix malformed it.effect tests
  result = fixMalformedItEffect(result);

  return result;
}

function fixImports(content) {
  const lines = content.split('\n');
  const newLines = [];
  let hasVitestImport = false;
  let hasEffectVitestImport = false;
  let hasEffectImport = false;

  // First pass - identify and fix existing imports
  for (const line of lines) {
    if (line.match(/import.*from\s*['"]vitest['"]/)) {
      hasVitestImport = true;
      // Remove 'it' from vitest imports
      let fixedLine = line.replace(/\bit\s*,?\s*/g, '');
      fixedLine = fixedLine.replace(/,\s*,/g, ',');
      fixedLine = fixedLine.replace(/\{\s*,/g, '{');
      fixedLine = fixedLine.replace(/,\s*\}/g, '}');
      newLines.push(fixedLine);
    } else if (line.match(/import.*from\s*['"]@effect\/vitest['"]/)) {
      hasEffectVitestImport = true;
      newLines.push(line);
    } else if (line.match(/import.*from\s*['"]effect['"]/)) {
      hasEffectImport = true;
      // Ensure Effect is included
      if (!line.includes('Effect')) {
        const fixedLine = line.replace('}', ', Effect}');
        newLines.push(fixedLine);
      } else {
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }

  // Second pass - add missing imports
  if (!hasVitestImport && content.includes('describe(')) {
    newLines.unshift("import { describe, expect } from 'vitest'");
  }

  if (!hasEffectVitestImport && (content.includes('it.effect(') || content.includes('it('))) {
    const vitestIndex = newLines.findIndex(line => line.includes("from 'vitest'"));
    newLines.splice(vitestIndex + 1, 0, "import { it } from '@effect/vitest'");
  }

  if (!hasEffectImport && content.includes('Effect.gen')) {
    const effectVitestIndex = newLines.findIndex(line => line.includes("@effect/vitest"));
    const insertIndex = effectVitestIndex >= 0 ? effectVitestIndex + 1 : 1;
    newLines.splice(insertIndex, 0, "import { Effect } from 'effect'");
  }

  return newLines.join('\n');
}

function convertRemainingItTests(content) {
  // Convert any remaining it() tests that weren't converted
  return content.replace(
    /(\s*)it\(([^,]+),\s*\(\)\s*=>\s*\{([\s\S]*?)\n(\s*)\}/gm,
    (match, indent, testName, testBody, closingIndent) => {
      // Clean and properly indent test body
      const lines = testBody.split('\n');
      const cleanedLines = [];

      for (const line of lines) {
        if (line.trim()) {
          cleanedLines.push('        ' + line.trim());
        } else {
          cleanedLines.push('');
        }
      }

      const cleanedBody = cleanedLines.join('\n');

      return `${indent}it.effect(${testName}, () =>
${indent}  Effect.gen(function* () {${cleanedBody}
${indent}  })
${indent})`;
    }
  );
}

function fixMalformedItEffect(content) {
  let result = content;

  // Fix various malformed patterns

  // Pattern 1: Extra closing braces
  result = result.replace(
    /(\s*)it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n\s*Effect\.gen\(function\*\s*\(\)\s*\{\s*([\s\S]*?)\n\s*\}\s*\)\s*\n\s*\}\s*\)\s*\n\s*\)/gm,
    (match, indent, testName, testBody) => {
      const cleanedBody = cleanTestBody(testBody);
      return `${indent}it.effect(${testName}, () =>\n${indent}  Effect.gen(function* () {\n${cleanedBody}\n${indent}  })\n${indent})`;
    }
  );

  // Pattern 2: Wrong indentation
  result = result.replace(
    /(\s*)it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n[\s]*Effect\.gen\(function\*\s*\(\)\s*\{\s*([\s\S]*?)\n[\s]*\}\)\n[\s]*\)/gm,
    (match, indent, testName, testBody) => {
      const cleanedBody = cleanTestBody(testBody);
      return `${indent}it.effect(${testName}, () =>\n${indent}  Effect.gen(function* () {\n${cleanedBody}\n${indent}  })\n${indent})`;
    }
  );

  return result;
}

function cleanTestBody(testBody) {
  const lines = testBody.split('\n');
  const cleanedLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.match(/^\}+\)?$/)) {
      cleanedLines.push('        ' + trimmed);
    }
  }

  return cleanedLines.join('\n');
}

function needsProcessing(content) {
  // Check if file needs processing
  return content.includes('it(') ||
         (content.includes('it.effect(') && (
           content.includes('      })') ||
           content.includes('    })') ||
           /\n\s*\}\s*\)\s*\n\s*\}\s*\)\s*\n\s*\)/m.test(content)
         ));
}

function processFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');

    if (!needsProcessing(content)) {
      return { processed: false, reason: 'no-issues' };
    }

    const migrated = completeTestMigration(content, filepath);

    if (migrated !== content) {
      fs.writeFileSync(filepath, migrated);
      return { processed: true, reason: 'fixed' };
    }

    return { processed: false, reason: 'no-changes' };
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error.message);
    return { processed: false, reason: 'error', error: error.message };
  }
}

function main() {
  const baseDir = path.join(process.cwd(), 'src');

  try {
    console.log(`Completing test migration in ${baseDir}...`);
    const allFiles = findSpecFiles(baseDir);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`Processing ${allFiles.length} test files...`);

    for (const filepath of allFiles) {
      const result = processFile(filepath);

      if (result.processed) {
        processed++;
        console.log(`✓ Migrated ${path.relative(process.cwd(), filepath)}`);
      } else if (result.reason === 'error') {
        errors++;
        console.log(`✗ Error with ${path.relative(process.cwd(), filepath)}: ${result.error}`);
      } else {
        skipped++;
      }
    }

    console.log(`\n=== Migration Summary ===`);
    console.log(`✓ Processed: ${processed} files`);
    console.log(`- Skipped: ${skipped} files (no issues)`);
    console.log(`✗ Errors: ${errors} files`);
    console.log(`Total: ${allFiles.length} files`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { completeTestMigration, needsProcessing };