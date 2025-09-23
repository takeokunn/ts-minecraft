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

function fixConvertedFile(content) {
  // Fix malformed it.effect() tests
  let result = content;

  // Pattern 1: Fix broken it.effect() with malformed indentation
  result = result.replace(
    /(\s*)it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n\s*Effect\.gen\(function\*\s*\(\)\s*\{\s*([\s\S]*?)\s*\}\s*\)\s*\)\s*\)/gm,
    (match, indent, testName, testBody) => {
      // Clean up the test body
      const lines = testBody.split('\n');
      const cleanedLines = [];

      for (let line of lines) {
        // Skip empty closing braces or malformed lines
        if (line.trim() === '}' || line.trim() === '})' || line.trim() === '') {
          continue;
        }
        // Add proper indentation
        if (line.trim()) {
          cleanedLines.push('        ' + line.trim());
        }
      }

      const cleanedBody = cleanedLines.join('\n');

      return `${indent}it.effect(${testName}, () =>
${indent}  Effect.gen(function* () {
${cleanedBody}
${indent}  })
${indent})`;
    }
  );

  // Pattern 2: Fix badly indented Effect.gen functions
  result = result.replace(
    /(\s*)it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n[\s]*Effect\.gen\(function\*\s*\(\)\s*\{\s*([\s\S]*?)\n[\s]*\}\)\n[\s]*\}\)\n[\s]*\)/gm,
    (match, indent, testName, testBody) => {
      // Process the test body
      const lines = testBody.split('\n');
      const cleanedLines = [];

      for (let line of lines) {
        if (line.trim() && !line.trim().match(/^\s*\}\s*$/)) {
          cleanedLines.push('        ' + line.trim());
        }
      }

      const cleanedBody = cleanedLines.join('\n');

      return `${indent}it.effect(${testName}, () =>
${indent}  Effect.gen(function* () {
${cleanedBody}
${indent}  })
${indent})`;
    }
  );

  // Pattern 3: Fix simple cases with wrong indentation
  const lines = result.split('\n');
  const fixedLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for it.effect pattern
    const itEffectMatch = line.match(/^(\s*)it\.effect\(([^,]+),\s*\(\)\s*=>/);

    if (itEffectMatch) {
      const indent = itEffectMatch[1];
      const testName = itEffectMatch[2];

      // Look for the next Effect.gen line
      let j = i + 1;
      let foundEffectGen = false;

      while (j < lines.length && !foundEffectGen) {
        if (lines[j].includes('Effect.gen(function* () {')) {
          foundEffectGen = true;
          break;
        }
        j++;
      }

      if (foundEffectGen) {
        // Start collecting the test body
        fixedLines.push(`${indent}it.effect(${testName}, () =>`);
        fixedLines.push(`${indent}  Effect.gen(function* () {`);

        j++; // Skip the Effect.gen line
        let braceCount = 1;

        // Collect content until we close the Effect.gen
        while (j < lines.length && braceCount > 0) {
          let contentLine = lines[j];

          // Count braces
          for (const char of contentLine) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }

          if (braceCount > 0 && contentLine.trim()) {
            // Add content with proper indentation
            fixedLines.push(`${indent}    ${contentLine.trim()}`);
          }

          j++;
        }

        fixedLines.push(`${indent}  })`);
        fixedLines.push(`${indent})`);

        i = j; // Skip processed lines
      } else {
        fixedLines.push(line);
        i++;
      }
    } else {
      fixedLines.push(line);
      i++;
    }
  }

  return fixedLines.join('\n');
}

function processFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');

    // Only process files that have conversion issues
    if (!content.includes('it.effect(') || !content.includes('TS1005') && !content.includes('TS1128')) {
      // Check for syntax issues
      if (!content.includes('    it.effect(') && content.includes('it.effect(')) {
        const fixed = fixConvertedFile(content);
        if (fixed !== content) {
          fs.writeFileSync(filepath, fixed);
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error.message);
    return false;
  }
}

function main() {
  const baseDir = path.join(process.cwd(), 'src');

  try {
    console.log(`Fixing converted .spec.ts files in ${baseDir}...`);
    const allFiles = findSpecFiles(baseDir);

    let fixed = 0;
    console.log(`Processing ${allFiles.length} test files...`);

    for (const filepath of allFiles) {
      if (processFile(filepath)) {
        fixed++;
        console.log(`✓ Fixed ${path.relative(process.cwd(), filepath)}`);
      }
    }

    console.log(`\nFix complete: ${fixed} files fixed`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixConvertedFile };