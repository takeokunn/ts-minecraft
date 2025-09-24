#!/usr/bin/env bash
set -euo pipefail

echo "📝 Updating documentation files to remove fast-check references..."
echo ""

# Count initial references
INITIAL_COUNT=$(grep -r "fast-check" docs --include="*.md" 2>/dev/null | wc -l || echo "0")
echo "Found $INITIAL_COUNT fast-check references in documentation"
echo ""

# Update all markdown files
find docs -name "*.md" -type f -print0 | while IFS= read -r -d '' file; do
  if grep -q "fast-check" "$file" 2>/dev/null; then
    echo "Updating: $file"

    # Replace fast-check mentions with @effect/vitest
    sed -i 's/fast-check/@effect\/vitest/g' "$file"

    # Replace fc.property with it.prop
    sed -i 's/fc\.property/it.prop/g' "$file"

    # Replace fc.assert with it.prop
    sed -i 's/fc\.assert/it.prop/g' "$file"

    # Update import statements
    sed -i "s/import \* as fc from 'fast-check'/import { Schema } from '@effect\/schema'/g" "$file"

    # Update common patterns
    sed -i 's/fc\.integer()/Schema.Number.pipe(Schema.int())/g' "$file"
    sed -i 's/fc\.string()/Schema.String/g' "$file"
    sed -i 's/fc\.boolean()/Schema.Boolean/g' "$file"
    sed -i 's/fc\.array(/Schema.Array(/g' "$file"
  fi
done

# Count remaining references
FINAL_COUNT=$(grep -r "fast-check" docs --include="*.md" 2>/dev/null | wc -l || echo "0")
echo ""
echo "✅ Documentation update complete!"
echo "References reduced from $INITIAL_COUNT to $FINAL_COUNT"
