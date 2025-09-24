#!/bin/bash

# Fix TypeScript syntax errors in test files

echo "Fixing TypeScript syntax errors..."

# Find all .spec.ts files with errors
FILES=$(find /home/nixos/ts-minecraft/src -name "*.spec.ts")

for file in $FILES; do
    echo "Processing $file..."

    # Fix "return true" statements (with 8 spaces indentation)
    sed -i 's/        return true$//' "$file"

    # Fix malformed Match expressions - add missing commas and Match.exhaustive
    # This pattern fixes: }})$ -> })),\nMatch.exhaustive
    sed -i 's/}})$/})),\n          Match.exhaustive/' "$file"

    # Fix missing commas in pipe chains
    sed -i 's/})\s*$/}),/' "$file"

    # Fix missing commas after forEach statements
    sed -i 's/^\s*})\s*$/        }),/' "$file"

    # Fix pipe structure issues - ensure proper parentheses
    sed -i 's/yield\* pipe(/yield\* pipe(\n    /' "$file"

done

echo "Syntax fixes applied to all test files."
