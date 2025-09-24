#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Starting test migration to Effect-TS pattern..."
echo ""

# Statistics
TOTAL_FILES=0
MODIFIED_FILES=0

# Function to process a test file
process_file() {
  local file="$1"
  local modified=false

  # Create backup
  cp "$file" "$file.bak"

  # Remove fast-check imports
  if grep -q "fast-check" "$file"; then
    sed -i "s/import \* as fc from 'fast-check'//g" "$file"
    sed -i "/^$/d" "$file"  # Remove empty lines
    modified=true
  fi

  # Convert basic it() to it.effect() - only for tests that don't already use it.effect
  if grep -q "^[[:space:]]*it(" "$file" && ! grep -q "it\.effect" "$file"; then
    # First add the import if not present
    if ! grep -q "@effect/vitest" "$file"; then
      # Add import after vitest imports
      sed -i "/import.*vitest/a import { it } from '@effect/vitest'" "$file"
      # Add Effect import if not present
      if ! grep -q "import.*Effect.*from 'effect'" "$file"; then
        sed -i "/import.*@effect\/vitest/a import { Effect } from 'effect'" "$file"
      fi
    fi

    # Convert simple it() calls to it.effect()
    # This is a simplified conversion - complex cases need manual work
    perl -i -pe 's/^(\s*)it\(/\1it.effect(/g' "$file"

    modified=true
  fi

  # Check if file was actually modified
  if ! diff -q "$file" "$file.bak" > /dev/null; then
    echo "✅ Modified: $file"
    rm "$file.bak"
    ((MODIFIED_FILES++))
  else
    echo "  No changes: $file"
    rm "$file.bak"
  fi
}

# Find all test files
echo "Scanning for test files..."
TEST_FILES=$(find src -name "*.spec.ts" -type f)
TOTAL_FILES=$(echo "$TEST_FILES" | wc -l)

echo "Found $TOTAL_FILES test files"
echo ""

# Process each file
for file in $TEST_FILES; do
  process_file "$file"
done

echo ""
echo "📊 Migration Statistics:"
echo "─────────────────────────────────"
echo "Total files processed: $TOTAL_FILES"
echo "Files modified: $MODIFIED_FILES"
echo ""

# Check remaining fast-check references
REMAINING_FC=$(grep -r "fast-check" src --include="*.spec.ts" | wc -l || echo "0")
echo "⚠️  Remaining fast-check references: $REMAINING_FC"

if [ "$REMAINING_FC" -gt 0 ]; then
  echo "Files still using fast-check:"
  grep -l "fast-check" src/**/*.spec.ts 2>/dev/null || true
fi

echo ""
echo "✨ Basic migration completed!"
echo ""
echo "Next steps:"
echo "1. Manually review and fix complex test conversions"
echo "2. Run 'pnpm typecheck' to check for type errors"
echo "3. Run 'pnpm test' to verify tests"
