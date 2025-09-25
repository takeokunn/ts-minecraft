#!/bin/bash

# Fix all remaining Effect.when issues by converting to if statements where appropriate
echo "Fixing remaining TypeScript errors..."

# Fix ActionCommandService
cat > /tmp/fix1.patch << 'EOF'
--- a/src/domain/input/ActionCommandService.ts
+++ b/src/domain/input/ActionCommandService.ts
@@ -337,7 +337,7 @@
                 // 前のグループをマージして追加
-                yield* Effect.when(
-                  Effect.succeed(currentGroup.length > 0),
+                if (currentGroup.length > 0) {
                   const merged = yield* mergeActionGroup(currentGroup)
                   mergedActions.push(merged)
+                }
@@ -354,7 +354,7 @@
       // 最後のグループを処理
-      yield* Effect.when(
-        Effect.succeed(currentGroup.length > 0),
+      if (currentGroup.length > 0) {
         const merged = yield* mergeActionGroup(currentGroup)
         mergedActions.push(merged)
+      }
EOF

echo "Applying patches..."
patch -p1 < /tmp/fix1.patch 2>/dev/null || true

echo "Fix completed"