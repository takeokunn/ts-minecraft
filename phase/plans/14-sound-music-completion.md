# Phase 14 (Sound & Music) Completion — Mob Vocalizations Increment

## Context

Repo verification confirms **Phase 14 is ~80% shipped**. The audio infrastructure is complete and tested:

- Web Audio engine behind `AudioEnginePort` (tone synthesis only, no sampled assets) — `packages/game/infrastructure/audio-engine.ts`.
- `SoundManager` 3D spatial gain + stereo pan via `computeSpatial` (`sound-manager.ts:7-15`).
- Player-following listener — `frame-handler.ts` calls `setListenerPosition(playerPos)` every frame.
- `MusicManager` live day/night/cave BGM switching — `music-manager.ts` + `lighting-stage.ts` `updateFromContext`.
- master/sfx/music volume flowing to the audio graph — `applySettings` → `audioEngine.setMasterGain` + per-tone multipliers.
- SFX wired for block break (`interaction-block-handler.ts:106`), block place (`:365` + `physics-stage.ts:135`), player attack `entityHit` (`:170`), player hurt (`physics-stage.ts`).

The **only acceptance criterion with zero implementation** that fits the tone-synth engine cleanly is **mob vocalizations** (`phase/14:20` 「モブの鳴き声がある」). This plan adds two synthesized literals (`mobHurt`, `mobDeath`) and triggers them at the existing mob-damage point, then reconciles the phase/14 checkboxes against what is genuinely shipped.

**Out of scope / deferred (flag, do NOT build):** sampled audio (`loadSound`/`AudioBuffer`/biome music/brand-typed Volume-Frequency-Duration), footstep sounds, user-facing volume-adjustment UI slider, burn-death mob sound (crosses the entities→audio DDD boundary), ambient idle mob cries, DOM floating damage numbers, crit-star sprite texture, armor equip/break sounds.

**Critical repo gotcha:** stale adjacent `.js`/`.d.ts` artifacts shadow `.ts` in vitest/vite — spies silently show 0 calls. Every edited production file is an EXISTING `.ts`. Purge before every vitest/typecheck/build and again after build/typecheck (which re-emit `.js`).

## Ordered Tasks

### 1. Purge stale adjacent .js/.d.ts before any vitest/typecheck/build
- **Files:** `packages/game/application/sound-manager.ts`, `packages/game/application/sound-manager.config.ts`, `packages/app/application/frame/stages/interaction-block-handler.ts`
- **Test:** none (hygiene gate); verify `find ... | grep -v node_modules | wc -l` returns 0.
- **Acceptance:** enables the trigger spies to actually fire.

### 2. Add mobHurt/mobDeath synth definitions + schema literals (single source of truth)
- **Files:** `packages/game/application/sound-manager.config.ts`, `packages/game/application/sound-manager.ts`
- Add two `SoundDefinition` entries to `SOUND_LIBRARY` clearly separated from `entityHit` (280Hz square) and `playerHurt` (140Hz sawtooth): e.g. `mobHurt { frequency: 200, durationMs: 110, wave: 'sawtooth', baseGain: 0.42 }`, `mobDeath { frequency: 90, durationMs: 220, wave: 'sawtooth', baseGain: 0.5 }`. Tone-synth only (no `AudioBuffer`).
- Widen `SoundEffectSchema` (line 17) to add `'mobHurt'`, `'mobDeath'`. `satisfies Record<string,SoundDefinition>` + `SOUND_LIBRARY[effect]` indexing makes a schema/table mismatch a tsc error (if `playEffect` is not typed against the union, add an exhaustiveness guard). No `playEffect` signature change.
- **Test:** covered by Task 3; `tsc --noEmit` 0 errors.
- **Acceptance:** Mob sounds exist (phase/14:20).

### 3. Extend SoundManager unit tests for the new literals (routing + spatial)
- **Files:** `packages/game/test/sound-manager.test.ts`
- New `it.effect`: `applySettings({enabled:true,masterVolume:1,sfxVolume:1})` then `playEffect('mobHurt'|'mobDeath',{position})` against `makeFakeAudioEngine`. Assert two `playRequests`; each `frequency` equals the **imported `SOUND_LIBRARY` constant** (no duplicated numbers); `gain ≈ baseGain×sfx×attenuation`; `loop===false`. Add a positional assertion (`{x:24,...}` → `pan≈1`, `gain≈baseGain/3`) proving the spatial path.
- **Test:** this task IS the test.
- **Acceptance:** Mob sounds exist + 3D spatial applies to mob sounds.

### 4. Trigger mobDeath (kill) / mobHurt (survive) in handleLeftClick via Option.match
- **Files:** `packages/app/application/frame/stages/interaction-block-handler.ts`
- KEEP `entityHit` at `:170` (player swing cue). After `const drops = yield* services.entityManager.applyDamage(entityId, damage)` (`:189`), **yield\*-sequence** (NOT inside the parallel `Effect.all([applyKnockback, entityHit])`) `Option.match(drops, { onNone: () => playEffect('mobHurt', {position: <live entity position>}), onSome: () => playEffect('mobDeath', {position: entityOpt-pre-kill-snapshot.position}) })`.
- Kill plays ONLY `mobDeath`; survive plays ONLY `mobHurt` (mutually exclusive) — no double mob-vocalization. Position from the captured `entityOpt` snapshot (`:160-163`), never a post-kill `getEntity` (entity is removed on a lethal hit).
- **VERIFY:** `applyDamage` returns `Some` on death even with an empty drop list; if it can return `None` on death, switch to an explicit removed/isDead signal.
- `soundManager` is already in the Pick (`:58`) — no signature change, no THREE/Web Audio import. Discrete event → no per-frame alloc. Entities-domain `applyDamage`/`combat.ts` untouched.
- **Test:** covered by Task 5.
- **Acceptance:** Mob sounds exist (PRIMARY deliverable).

### 5. App-stage test: kill→mobDeath only, survive→mobHurt only (local spy)
- **Files:** `packages/app/test/frame/stages/interaction-mob-sound.test.ts` (new), `test/frame-handler-test-kit.ts`
- Plain vitest `it` + `Effect.runPromise` (per effect-vitest deadlock guidance). Spy LOCALLY on the returned `services.soundManager.playEffect` (`vi.fn`) — do NOT mutate the shared kit mock. Arrange `findAttackableEntity` to select one in-range target (`makeCamera()`).
  - Case A (LETHAL): `applyDamage → Effect.succeed(Option.some([]))` (empty drops on death) → assert `'mobDeath'` + position, NOT `'mobHurt'`.
  - Case B (NON-LETHAL): `applyDamage → Effect.succeed(Option.none())` → assert `'mobHurt'` + position, NOT `'mobDeath'`.
  - Both: assert `'entityHit'` still fired (regression guard).
- **Test:** this task IS the test (headless-safe via mock).
- **Acceptance:** Mob sounds exist — app-stage proof + lethal-hit single-sound semantics.

### 6. Verify shipped paths, then reconcile phase/14 checkboxes (deterministic, conservative)
- **Files:** `phase/14-sound-music.md`
- FIRST verify (don't trust cites blindly) each shipped path exists / is test-covered. THEN check ONLY verified+tested boxes: break/place/attack/モブの鳴き声(NEW); 3D 距離減衰/方向性/移動追従; BGM再生 + 環境別BGM昼/夜/洞窟; 設定→graph ボリューム; Day-3 test tasks.
- Legacy `src/audio/*` + Panner/`loadSound` boxes: check the capability-level parent + annotate the path delta (monorepo uses StereoPanner + tone synth, no `loadSound`); do NOT check `loadSound` sub-bullets.
- LEAVE UNCHECKED: volume-adjustment UI slider (29), 歩行/footstep (47), 環境音 水/風/雷 (47), 音声ファイルの読み込み. Do NOT check any '画面で確認'/user-audible box while `audioEnabled` defaults false and no volume UI exists.
- Add a 実装状況 note (combat-system.md precedent): tone-synth only; audio off by default; **burn-death deaths intentionally silent (only player-kills vocalize)**; ambient idle cries out of scope.
- **Test:** none (doc); DoD = checked↔verified file:line + passing test; unchecked↔documented gap.
- **Acceptance:** checkboxes updated + volume-scope decision + footstep deferral + DEFERRED items flagged.

### 7. Full gate
- **Files:** all edited + new test files.
- Purge → `pnpm typecheck` → purge → `pnpm lint` → affected suites → full `pnpm vitest run` → `pnpm build` → purge.
- E2E: no audible-output assertion (headless autoplay blocked → `playTone` no-ops); existence/no-throw only.
- **Acceptance:** all gates green after the purge.

## Consolidated Risks

- **Stale-adjacent-.js (highest likelihood):** purge before every vitest/typecheck/build and after every build/typecheck.
- **Lethal-hit semantics RESOLVED:** `Option.match` plays only `mobDeath` on kill / only `mobHurt` on survive; `entityHit` still fires (intended).
- **Kill-signal robustness:** verify `applyDamage` returns `Some` on death even with empty drops (Task 5 Case A proves it); else switch to an explicit isDead signal.
- **Pre-kill snapshot:** `mobDeath` position from `entityOpt` snapshot, not post-kill `getEntity`.
- **Burn-death intentionally silent (documented):** EntityManager (entities package) has no `AudioEnginePort`; surfacing it needs a new app-layer death-event channel — out of scope. Only player-kills vocalize; recorded in the phase/14 note.
- **Ambient idle cries out of scope:** needs a change-gated MutableRef timer to avoid per-frame alloc — separate slice.
- **audioEnabled=false default:** out-of-box silence; no '画面で確認' box checked; memory forbids flipping the default — defer a settings-overlay toggle/sliders or a default flip to a follow-up. Correctness verified via mocked tests.
- **Test-kit coupling:** spy locally, don't mutate the shared mock.
- **Synth tones:** keep freq/wave/duration clearly separated from playerHurt/entityHit; do not introduce sampled audio.
- **DEFERRED (flag, not build):** sampled audio/loadSound/AudioBuffer/biome music/brand-typed units; footsteps; volume UI; armor sounds; damage numbers; crit-star texture.

## Definition of Done

- `mobHurt`/`mobDeath` in `SOUND_LIBRARY` (single source) + `SoundEffectSchema`; tsc enforces lockstep.
- `handleLeftClick` plays `mobDeath`-only on kill / `mobHurt`-only on survive via `Option.match`, pre-kill snapshot position, sequenced after `applyDamage`; `entityHit` still fires.
- No new services/DI/Layer/Pick/migration/per-frame-hook/THREE/Web Audio in app layer; entities-domain untouched.
- `sound-manager.test.ts` asserts freq/gain (constants, not literals) + spatial path; new app-stage test asserts kill/survive single-sound semantics + entityHit.
- phase/14 boxes checked↔verified+tested; footstep/volume-UI/sampled/'画面で確認' unchecked; 実装状況 note added.
- Purge discipline applied; `pnpm vitest run` green (baseline + new, 0 skipped), `tsc --noEmit` 0 errors, oxlint 0 warnings, `vite build` exit 0; E2E unchanged.
- All deferred items flagged, not built.

## Validation Commands

```sh
# 1. purge stale adjacent .js BEFORE anything
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f

# 2. typecheck (emits .js)
pnpm typecheck

# 3. purge again (typecheck re-emitted .js)
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f

# 4. lint
pnpm lint

# 5. affected suites first
pnpm vitest run packages/game/test/sound-manager.test.ts packages/app/test/frame/stages/interaction-mob-sound.test.ts

# 6. full suite (baseline intact, 0 skipped)
pnpm vitest run

# 7. build (emits .js)
pnpm build

# 8. final purge (build re-emitted .js)
find packages test src dist -type f \( -name '*.js' -o -name '*.d.ts' -o -name '*.js.map' -o -name '*.d.ts.map' \) | grep -v node_modules | xargs rm -f
```

E2E: no audible-output assertion (headless autoplay blocked → `playTone` no-ops); existence/no-throw only.
