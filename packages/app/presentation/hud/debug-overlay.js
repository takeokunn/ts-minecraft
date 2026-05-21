// F3 debug overlay (FR-1.5). Runtime-toggled, distinct from URL-gated `?debug=perf` perf-hud.
// z-index 5500 — above perf-hud (5000), so F3 stays readable when both are active.
// Pre-allocated DOM text nodes (no innerHTML churn); 4 Hz daemon; acquireRelease lifecycle.
import { Array as Arr, Cause, Duration, Effect, MutableRef, Schedule } from 'effect';
import { DEBUG_FEATURE_FLAG_CATALOG, DEBUG_FEATURE_FLAG_DEFAULTS, } from '@ts-minecraft/app/debug-feature-flags';
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel';
// -----------------------------------------------------------------------------
// Facing direction conversion (vanilla format)
// -----------------------------------------------------------------------------
// Vanilla mapping (Three.js +Z = south): yaw≈0→south, ≈π/2→west, ≈±π→north, ≈-π/2→east. Normalized to (-π, π].
export const facingFromYaw = (yawRad) => {
    // Normalize to (-π, π].
    let y = yawRad % (2 * Math.PI);
    if (y > Math.PI)
        y -= 2 * Math.PI;
    if (y <= -Math.PI)
        y += 2 * Math.PI;
    const QUARTER = Math.PI / 4;
    if (y >= -QUARTER && y < QUARTER)
        return { name: 'south', axis: 'Towards positive Z' };
    if (y >= QUARTER && y < 3 * QUARTER)
        return { name: 'west', axis: 'Towards negative X' };
    if (y >= -3 * QUARTER && y < -QUARTER)
        return { name: 'east', axis: 'Towards positive X' };
    return { name: 'north', axis: 'Towards negative Z' };
};
export const debugFeatureGroupLabels = {
    rendering: 'Rendering',
    particles: 'Particles',
    mobs: 'Mobs',
    simulation: 'Simulation',
    ui: 'UI',
    world: 'World / Chunks',
};
const DEBUG_FEATURE_GROUP_ORDER = [
    'rendering',
    'particles',
    'mobs',
    'simulation',
    'ui',
    'world',
];
export const debugFeatureSearchMatches = (entry, query) => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length === 0)
        return true;
    const haystack = [
        entry.id,
        entry.label,
        entry.group,
        debugFeatureGroupLabels[entry.group],
        entry.description,
        ...debugFeatureBadges(entry),
    ].join(' ').toLowerCase();
    return haystack.includes(normalized);
};
const debugFeatureBadges = (entry) => 'badges' in entry ? entry.badges : [];
const DOM_UPDATE_INTERVAL_MS = 250; // 4 Hz
const formatNumber = (n, decimals) => Number.isFinite(n) ? n.toFixed(decimals) : '--';
const badgeStyles = {
    danger: 'color:#fecaca;border-color:#ef4444;background:rgba(127,29,29,0.55)',
    reload: 'color:#fde68a;border-color:#f59e0b;background:rgba(120,53,15,0.45)',
    perf: 'color:#bae6fd;border-color:#38bdf8;background:rgba(8,47,73,0.45)',
};
export class DebugOverlayService extends Effect.Service()('@minecraft/presentation/DebugOverlayService', {
    scoped: Effect.sync(() => {
        // -------------------------------------------------------------------
        // SSR-safe path — when `document` is undefined (vitest node env),
        // `attach` becomes a no-op so tests don't crash on DOM access.
        // -------------------------------------------------------------------
        const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';
        const visibleRef = MutableRef.make(false);
        const domRef = MutableRef.make(null);
        const setStatus = (dom, message) => {
            dom.statusText.nodeValue = message;
        };
        const updateToggleRowsFromFlags = (dom, flags) => {
            let enabledCount = 0;
            for (const row of dom.toggleRows) {
                const enabled = flags[row.id];
                if (enabled)
                    enabledCount += 1;
                row.button.setAttribute('aria-checked', enabled ? 'true' : 'false');
                row.button.style.background = enabled ? 'rgba(34,197,94,0.22)' : 'rgba(148,163,184,0.12)';
                row.button.style.borderColor = enabled ? '#22c55e' : '#64748b';
                row.button.style.color = enabled ? '#dcfce7' : '#cbd5e1';
                row.stateText.nodeValue = enabled ? 'ON' : 'OFF';
                row.row.style.opacity = enabled ? '1' : '0.56';
            }
            dom.enabledCountText.nodeValue = `${enabledCount}/${dom.toggleRows.length} enabled`;
        };
        const filterToggleRows = (dom) => {
            const query = dom.searchInput.value;
            for (const groupSection of dom.groupSections) {
                let visibleRows = 0;
                for (const row of dom.toggleRows) {
                    if (row.entry.group !== groupSection.group)
                        continue;
                    const visible = debugFeatureSearchMatches(row.entry, query);
                    row.row.style.display = visible ? 'flex' : 'none';
                    if (visible)
                        visibleRows += 1;
                }
                groupSection.section.style.display = visibleRows > 0 ? 'block' : 'none';
            }
        };
        const refreshTogglePanel = (dom, deps, statusMessage) => deps.debugFeatureFlags.getSnapshot().pipe(Effect.map((snapshot) => {
            updateToggleRowsFromFlags(dom, snapshot.flags);
            filterToggleRows(dom);
            if (statusMessage !== undefined) {
                setStatus(dom, statusMessage);
            }
        }));
        const runPanelEffect = (dom, effect) => {
            void Effect.runPromise(effect.pipe(Effect.catchAllCause((cause) => Effect.sync(() => setStatus(dom, `Debug toggle failed: ${Cause.pretty(cause)}`)))));
        };
        const makeBadge = (badge) => {
            const span = document.createElement('span');
            span.textContent = badge;
            span.title = badge === 'danger'
                ? 'Debug-only: may alter runtime state'
                : badge === 'reload'
                    ? 'May require a scene/settings refresh for full visual effect'
                    : 'Useful for performance isolation';
            span.style.cssText = [
                'font-size:9px',
                'line-height:1',
                'padding:2px 4px',
                'border:1px solid',
                'border-radius:999px',
                'text-transform:uppercase',
                'letter-spacing:0.04em',
                badgeStyles[badge],
            ].join(';');
            return span;
        };
        const buildDom = (deps) => {
            const overlay = document.createElement('div');
            overlay.id = 'debug-overlay';
            overlay.style.cssText = [
                'position: fixed',
                'top: 10px',
                'left: 10px',
                // Above perf-hud (z=5000) so F3 stays readable when both are visible.
                'z-index: 5500',
                'display: none',
                'grid-template-columns: 240px minmax(320px, 400px)',
                'gap: 8px',
                'align-items: start',
                'color: #ffffff',
                'font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                'font-size: 12px',
                'line-height: 1.35',
                'user-select: none',
            ].join(';');
            const metricsPanel = document.createElement('div');
            metricsPanel.style.cssText = [
                'padding: 8px 10px',
                'background: rgba(0, 0, 0, 0.65)',
                'border-radius: 4px',
                'pointer-events: none',
                'min-width: 220px',
                'white-space: pre',
            ].join(';');
            // 6 lines: XYZ, Facing, Biome, FPS, Chunks, Time.
            const labels = [
                'XYZ:    ',
                'Facing: ',
                'Biome:  ',
                'FPS:    ',
                'Chunks: ',
                'Time:   ',
            ];
            const initialValues = ['--', '--', '--', '--', '--', '--'];
            const nodes = Arr.map(Arr.zip(labels, initialValues), ([label, initial]) => {
                const line = document.createElement('div');
                line.appendChild(document.createTextNode(label));
                const valueNode = document.createTextNode(initial);
                line.appendChild(valueNode);
                metricsPanel.appendChild(line);
                return valueNode;
            });
            const panel = document.createElement('div');
            panel.id = 'debug-toggle-panel';
            panel.setAttribute('role', 'region');
            panel.setAttribute('aria-label', 'Debug feature toggles');
            panel.style.cssText = [
                'padding: 10px',
                'background: rgba(0, 0, 0, 0.82)',
                'border: 1px solid rgba(148, 163, 184, 0.35)',
                'border-radius: 6px',
                'box-shadow: 0 10px 30px rgba(0,0,0,0.35)',
                'pointer-events: auto',
                'white-space: normal',
                'max-height: min(70vh, 560px)',
                'overflow: auto',
            ].join(';');
            const header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px';
            const titleWrap = document.createElement('div');
            const title = document.createElement('div');
            title.textContent = 'Debug Toggles';
            title.style.cssText = 'font-weight:700;font-size:13px;letter-spacing:0.02em';
            const enabledCountText = document.createTextNode('0/0 enabled');
            const enabledCount = document.createElement('div');
            enabledCount.style.cssText = 'color:#cbd5e1;font-size:11px;margin-top:2px';
            enabledCount.appendChild(enabledCountText);
            titleWrap.appendChild(title);
            titleWrap.appendChild(enabledCount);
            const resetAllButton = document.createElement('button');
            resetAllButton.type = 'button';
            resetAllButton.textContent = 'Reset All';
            resetAllButton.style.cssText = [
                'cursor:pointer',
                'border:1px solid rgba(148,163,184,0.45)',
                'border-radius:4px',
                'background:rgba(15,23,42,0.7)',
                'color:#e2e8f0',
                'font:inherit',
                'font-size:11px',
                'padding:4px 7px',
            ].join(';');
            header.appendChild(titleWrap);
            header.appendChild(resetAllButton);
            const searchInput = document.createElement('input');
            searchInput.type = 'search';
            searchInput.placeholder = 'Search features...';
            searchInput.setAttribute('aria-label', 'Search debug toggles');
            searchInput.style.cssText = [
                'box-sizing:border-box',
                'width:100%',
                'margin-bottom:8px',
                'padding:6px 7px',
                'border:1px solid rgba(148,163,184,0.45)',
                'border-radius:4px',
                'background:rgba(15,23,42,0.82)',
                'color:#f8fafc',
                'font:inherit',
                'font-size:12px',
                'outline:none',
            ].join(';');
            const groupSections = [];
            const toggleRows = [];
            const groupsContainer = document.createElement('div');
            groupsContainer.style.cssText = 'display:flex;flex-direction:column;gap:7px';
            for (const group of DEBUG_FEATURE_GROUP_ORDER) {
                const entries = DEBUG_FEATURE_FLAG_CATALOG.filter((entry) => entry.group === group);
                if (entries.length === 0)
                    continue;
                const section = document.createElement('div');
                section.style.cssText = 'border-top:1px solid rgba(148,163,184,0.18);padding-top:7px';
                const groupHeader = document.createElement('div');
                groupHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px';
                const groupTitle = document.createElement('div');
                groupTitle.textContent = debugFeatureGroupLabels[group];
                groupTitle.style.cssText = 'font-weight:700;color:#f8fafc;font-size:12px';
                const resetGroupButton = document.createElement('button');
                resetGroupButton.type = 'button';
                resetGroupButton.textContent = 'Reset';
                resetGroupButton.style.cssText = [
                    'cursor:pointer',
                    'border:1px solid rgba(148,163,184,0.35)',
                    'border-radius:4px',
                    'background:rgba(15,23,42,0.62)',
                    'color:#cbd5e1',
                    'font:inherit',
                    'font-size:10px',
                    'padding:2px 5px',
                ].join(';');
                groupHeader.appendChild(groupTitle);
                groupHeader.appendChild(resetGroupButton);
                section.appendChild(groupHeader);
                const rowsWrap = document.createElement('div');
                rowsWrap.setAttribute('role', 'group');
                rowsWrap.setAttribute('aria-label', debugFeatureGroupLabels[group]);
                rowsWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px';
                for (const entry of entries) {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px';
                    row.dataset['debugFeatureId'] = entry.id;
                    const info = document.createElement('div');
                    info.style.cssText = 'min-width:0;display:flex;flex-direction:column;gap:1px';
                    const labelLine = document.createElement('div');
                    labelLine.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap';
                    const label = document.createElement('span');
                    label.textContent = entry.label;
                    label.style.cssText = 'color:#f8fafc';
                    labelLine.appendChild(label);
                    for (const badge of debugFeatureBadges(entry)) {
                        labelLine.appendChild(makeBadge(badge));
                    }
                    const description = document.createElement('div');
                    description.textContent = entry.description;
                    description.style.cssText = 'color:#94a3b8;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px';
                    info.appendChild(labelLine);
                    info.appendChild(description);
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.setAttribute('role', 'switch');
                    button.setAttribute('aria-label', entry.label);
                    button.setAttribute('aria-checked', 'true');
                    button.style.cssText = [
                        'cursor:pointer',
                        'min-width:48px',
                        'border:1px solid #22c55e',
                        'border-radius:999px',
                        'background:rgba(34,197,94,0.22)',
                        'color:#dcfce7',
                        'font:inherit',
                        'font-size:10px',
                        'padding:3px 6px',
                        'text-align:center',
                    ].join(';');
                    const stateText = document.createTextNode('ON');
                    button.appendChild(stateText);
                    const activate = () => {
                        const nextEffect = deps.debugFeatureFlags.isEnabled(entry.id).pipe(Effect.flatMap((enabled) => deps.debugFeatureFlags.setEnabled(entry.id, !enabled)), Effect.flatMap((changed) => refreshTogglePanel(MutableRef.get(domRef) ?? dom, deps, changed ? `${entry.label} toggled` : `${entry.label} unchanged`)));
                        runPanelEffect(MutableRef.get(domRef) ?? dom, nextEffect);
                    };
                    button.addEventListener('click', activate);
                    button.addEventListener('keydown', (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ')
                            return;
                        event.preventDefault();
                        activate();
                    });
                    row.appendChild(info);
                    row.appendChild(button);
                    rowsWrap.appendChild(row);
                    toggleRows.push({ id: entry.id, entry, row, button, stateText });
                }
                resetGroupButton.addEventListener('click', () => {
                    const dom = MutableRef.get(domRef);
                    if (dom === null)
                        return;
                    runPanelEffect(dom, deps.debugFeatureFlags.resetGroup(group).pipe(Effect.andThen(refreshTogglePanel(dom, deps, `${debugFeatureGroupLabels[group]} reset`))));
                });
                section.appendChild(rowsWrap);
                groupsContainer.appendChild(section);
                groupSections.push({ group, section });
            }
            const status = document.createElement('div');
            status.setAttribute('aria-live', 'polite');
            status.style.cssText = 'margin-top:8px;color:#cbd5e1;font-size:10px;min-height:14px';
            const statusText = document.createTextNode('F3 toggles are session-only');
            status.appendChild(statusText);
            const keyboardHint = document.createElement('div');
            keyboardHint.textContent = 'Tip: / or Ctrl+F searches, Enter/Space toggles, Esc leaves search.';
            keyboardHint.style.cssText = 'margin-top:4px;color:#64748b;font-size:10px';
            panel.appendChild(header);
            panel.appendChild(searchInput);
            panel.appendChild(groupsContainer);
            panel.appendChild(status);
            panel.appendChild(keyboardHint);
            overlay.appendChild(metricsPanel);
            overlay.appendChild(panel);
            const dom = {
                overlay,
                metricsPanel,
                panel,
                searchInput,
                enabledCountText,
                statusText,
                textNodes: nodes,
                toggleRows,
                groupSections,
            };
            resetAllButton.addEventListener('click', () => {
                runPanelEffect(dom, deps.debugFeatureFlags.resetAll().pipe(Effect.andThen(refreshTogglePanel(dom, deps, 'All debug toggles reset'))));
            });
            searchInput.addEventListener('input', () => filterToggleRows(dom));
            searchInput.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape')
                    return;
                event.preventDefault();
                searchInput.blur();
            });
            document.body.appendChild(overlay);
            updateToggleRowsFromFlags(dom, { ...DEBUG_FEATURE_FLAG_DEFAULTS });
            return dom;
        };
        const applyVisibility = (visible) => {
            const dom = MutableRef.get(domRef);
            if (dom === null)
                return;
            dom.overlay.style.display = visible ? 'grid' : 'none';
        };
        const setVisible = (next) => Effect.sync(() => {
            MutableRef.set(visibleRef, next);
            applyVisibility(next);
        });
        const toggle = () => Effect.sync(() => {
            const next = !MutableRef.get(visibleRef);
            MutableRef.set(visibleRef, next);
            applyVisibility(next);
        });
        const isVisible = () => Effect.sync(() => MutableRef.get(visibleRef));
        // -------------------------------------------------------------------
        // attach(): mount DOM + register F3 listener + start update daemon.
        // Single-shot (idempotent) — repeat calls bail out early.
        // -------------------------------------------------------------------
        const attach = (deps) => Effect.gen(function* () {
            if (!hasDom)
                return;
            if (MutableRef.get(domRef) !== null)
                return;
            // Build DOM scaffold inside acquireRelease so scope teardown removes it.
            const dom = yield* Effect.acquireRelease(Effect.sync(() => {
                const nextDom = buildDom(deps);
                MutableRef.set(domRef, nextDom);
                return nextDom;
            }), (nextDom) => Effect.sync(() => {
                nextDom.overlay.remove();
                MutableRef.set(domRef, null);
            }));
            yield* refreshTogglePanel(dom, deps);
            // F3 keydown listener — toggles visibility. Captured as a separate
            // resource so its finalizer runs even if the daemon fork errors.
            const keyHandler = (event) => {
                if (event.key === 'F3') {
                    // Prevent the browser's default F3 (search) behavior.
                    event.preventDefault();
                    const next = !MutableRef.get(visibleRef);
                    MutableRef.set(visibleRef, next);
                    applyVisibility(next);
                    return;
                }
                if (!MutableRef.get(visibleRef))
                    return;
                const activeDom = MutableRef.get(domRef);
                if (activeDom === null)
                    return;
                const wantsSearch = event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f');
                if (!wantsSearch)
                    return;
                event.preventDefault();
                activeDom.searchInput.focus();
                activeDom.searchInput.select();
            };
            yield* Effect.acquireRelease(Effect.sync(() => {
                window.addEventListener('keydown', keyHandler);
            }), () => Effect.sync(() => {
                window.removeEventListener('keydown', keyHandler);
            }));
            // 4 Hz update daemon — only does work when overlay is visible to keep
            // the cost zero in the default-hidden state. Runs on a forkDaemon so
            // it lives for the session scope (independent of caller's fiber).
            const updateOnce = Effect.gen(function* () {
                if (!MutableRef.get(visibleRef))
                    return;
                const activeDom = MutableRef.get(domRef);
                if (activeDom === null)
                    return;
                const [position, rotation, fps, loadedChunks, timeOfDay] = yield* Effect.all([
                    deps.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAll(() => Effect.succeed({ x: 0, y: 0, z: 0 }))),
                    deps.cameraState.getRotation(),
                    deps.fpsCounter.getFPS(),
                    deps.chunkManager.getLoadedChunks(),
                    deps.timeService.getTimeOfDay(),
                ], { concurrency: 'unbounded' });
                const biome = yield* deps.biomeService.getBiome(Math.floor(position.x), Math.floor(position.z));
                const facing = facingFromYaw(rotation.yaw);
                // Pre-allocated text node mutations — no innerHTML / textContent.
                activeDom.textNodes[0].nodeValue = `${formatNumber(position.x, 1)} / ${formatNumber(position.y, 1)} / ${formatNumber(position.z, 1)}`;
                activeDom.textNodes[1].nodeValue = `${facing.name} (${facing.axis})`;
                activeDom.textNodes[2].nodeValue = biome;
                activeDom.textNodes[3].nodeValue = formatNumber(fps, 1);
                activeDom.textNodes[4].nodeValue = String(loadedChunks.length);
                activeDom.textNodes[5].nodeValue = formatNumber(timeOfDay, 3);
            });
            yield* Effect.forkDaemon(Effect.repeat(updateOnce.pipe(Effect.catchAllCause((cause) => Effect.logError(`debug-overlay daemon error: ${Cause.pretty(cause)}`))), Schedule.spaced(Duration.millis(DOM_UPDATE_INTERVAL_MS))));
        });
        const impl = {
            attach,
            toggle,
            show: () => setVisible(true),
            hide: () => setVisible(false),
            isVisible,
        };
        return impl;
    }),
}) {
}
export const DebugOverlayLive = DebugOverlayService.Default;
//# sourceMappingURL=../../../../dist/packages/app/presentation/hud/debug-overlay.js.map