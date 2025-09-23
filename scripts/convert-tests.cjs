#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

function convertItToEffect(content) {
  // Skip if already converted
  if (content.includes('it.effect(')) {
    return content;
  }

  // Convert it() to it.effect() with Effect.gen pattern
  const itPattern = /(\s*)it\(([^,]+),\s*\(\)\s*=>\s*\{([\s\S]*?)\n(\s*)\}\)/g;

  let result = content.replace(itPattern, (match, indent, testName, testBody, closingIndent) => {
    // Clean up test body and add proper indentation
    const lines = testBody.split('\n');
    const indentedLines = lines.map(line => {
      if (line.trim()) {
        return '      ' + line.trim();
      }
      return line;
    });
    const indentedBody = indentedLines.join('\n');

    return `${indent}it.effect(${testName}, () =>
${indent}  Effect.gen(function* () {${indentedBody}
${indent}  })
${indent})`;
  });

  // Fix imports
  result = fixImports(result);

  return result;
}

function fixImports(content) {
  if (!content.includes('it.effect(')) {
    return content;
  }

  const lines = content.split('\n');
  const newLines = [];
  let vitestImportFound = false;
  let effectVitestImportFound = false;
  let effectImportFound = false;

  for (const line of lines) {
    // Handle vitest imports
    if (line.match(/import\s*\{[^}]*\}\s*from\s*['"]vitest['"]/)) {
      vitestImportFound = true;
      // Remove 'it' from vitest imports, keep describe, expect
      let fixedLine = line.replace(/\bit\s*,?\s*/g, '');
      fixedLine = fixedLine.replace(/,\s*,/g, ',');
      fixedLine = fixedLine.replace(/\{\s*,/g, '{');
      fixedLine = fixedLine.replace(/,\s*\}/g, '}');
      newLines.push(fixedLine);

      // Add @effect/vitest import right after
      if (!effectVitestImportFound) {
        newLines.push("import { it } from '@effect/vitest'");
        effectVitestImportFound = true;
      }
    }
    // Handle existing effect imports
    else if (line.match(/import\s*\{[^}]*\}\s*from\s*['"]effect['"]/)) {
      effectImportFound = true;
      // Ensure Effect is in the import
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

  // Add missing imports if needed
  if (!vitestImportFound && content.includes('describe(')) {
    newLines.unshift("import { describe, expect } from 'vitest'");
  }

  if (!effectVitestImportFound && content.includes('it.effect(')) {
    const insertPos = newLines.findIndex(line => line.includes("from 'vitest'")) + 1;
    newLines.splice(insertPos, 0, "import { it } from '@effect/vitest'");
  }

  if (!effectImportFound && content.includes('Effect.gen')) {
    const insertPos = newLines.findIndex(line => line.includes("@effect/vitest")) + 1;
    newLines.splice(insertPos, 0, "import { Effect } from 'effect'");
  }

  return newLines.join('\n');
}

async function processFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');

    // Skip if no it() tests or already converted
    if (!content.includes('it(') || content.includes('it.effect(')) {
      return false;
    }

    const converted = convertItToEffect(content);

    // Only write if content changed
    if (converted !== content) {
      fs.writeFileSync(filepath, converted);
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error.message);
    return false;
  }

  return false;
}

async function main() {
  const baseDir = path.join(process.cwd(), 'src');
  const pattern = '**/*.spec.ts';

  try {
    const files = await glob(pattern, { cwd: baseDir });
    const fullPaths = files.map(file => path.join(baseDir, file));

    // Filter files that need conversion
    const filesToProcess = [];
    for (const filepath of fullPaths) {
      try {
        const content = fs.readFileSync(filepath, 'utf8');
        if (content.includes('it(') && !content.includes('it.effect(')) {
          filesToProcess.push(filepath);
        }
      } catch (error) {
        // Skip files we can't read
        continue;
      }
    }

    let converted = 0;
    console.log(`Processing ${filesToProcess.length} files that need conversion...`);

    for (const filepath of filesToProcess) {
      if (await processFile(filepath)) {
        converted++;
        console.log(`✓ Converted ${filepath}`);
      } else {
        console.log(`- Skipped ${filepath}`);
      }
    }

    console.log(`\nConversion complete: ${converted}/${filesToProcess.length} files converted`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { convertItToEffect, fixImports };