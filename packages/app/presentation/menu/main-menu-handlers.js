import { Array as Arr, Cause, Deferred, Effect, MutableRef, Option, Order } from 'effect';
import { WorldId } from '@ts-minecraft/kernel';
import { cycleGameMode, generateWorldId } from './main-menu-utils';
import { renderValidRow, renderCorruptRow } from './main-menu-dom';
export const makeMenuRefs = () => ({
    subStateRef: MutableRef.make('root'),
    newWorldModeRef: MutableRef.make('survival'),
    activeDeferredRef: MutableRef.make(Option.none()),
    escHandlerRef: MutableRef.make(Option.none()),
});
// --- State helpers ---
export const makeSetSubState = (refs, rootCard, newWorldCard, loadWorldCard) => (next) => {
    MutableRef.set(refs.subStateRef, next);
    rootCard.style.display = next === 'root' ? 'flex' : 'none';
    newWorldCard.style.display = next === 'new-world' ? 'flex' : 'none';
    loadWorldCard.style.display = next === 'load-world' ? 'flex' : 'none';
};
export const makeUpdateModeButton = (refs, buttons) => () => {
    const mode = MutableRef.get(refs.newWorldModeRef);
    buttons.nwMode.textContent = mode === 'survival' ? 'Survival' : 'Creative';
};
export const makeCompleteWith = (refs) => (choice) => {
    const deferredOpt = MutableRef.get(refs.activeDeferredRef);
    MutableRef.set(refs.activeDeferredRef, Option.none());
    Option.map(deferredOpt, (deferred) => {
        Effect.runFork(Deferred.succeed(deferred, choice));
    });
};
// --- Load list ---
export const makeRefreshLoadList = (dom, storageService, buttons, completeWith, openDeleteConfirm) => () => storageService.listWorldMetadata.pipe(Effect.matchEffect({
    onFailure: (err) => Effect.logWarning(`MainMenu: listWorldMetadata failed: ${String(err)}`).pipe(Effect.andThen(Effect.sync(() => {
        dom.setInnerHTML(buttons.lwList, '<div style="opacity:0.7">Failed to load worlds</div>');
    }))),
    onSuccess: ({ valid, corrupt }) => Effect.sync(() => {
        if (valid.length === 0 && corrupt.length === 0) {
            dom.setInnerHTML(buttons.lwList, '<div style="opacity:0.7;padding:8px">No saved worlds yet</div>');
            return;
        }
        // Sort valid by lastPlayed desc.
        const lastPlayedDesc = Order.reverse(Order.mapInput(Order.number, (entry) => entry.metadata.lastPlayed.getTime()));
        const sorted = Arr.sort(valid, lastPlayedDesc);
        dom.setInnerHTML(buttons.lwList, '');
        Arr.forEach(sorted, ({ worldId, metadata }) => {
            renderValidRow(dom, buttons.lwList, worldId, metadata, () => completeWith({ action: 'loadWorld', worldId }), () => openDeleteConfirm(worldId, String(worldId)));
        });
        Arr.forEach(corrupt, (worldId) => {
            renderCorruptRow(dom, buttons.lwList, worldId, () => openDeleteConfirm(worldId, `${String(worldId)} (corrupt)`));
        });
    }),
}));
// --- Delete confirm ---
export const makeOpenDeleteConfirm = (storageService, confirmDialog, refreshLoadList) => (worldId, label) => {
    Effect.runFork(confirmDialog
        .show(`Delete '${label}'? This cannot be undone.`, 'Delete', 'Cancel')
        .pipe(Effect.flatMap((confirmed) => confirmed
        ? storageService.deleteWorld(worldId).pipe(Effect.catchAllCause((cause) => Effect.logError(`MainMenu: deleteWorld failed: ${Cause.pretty(cause)}`)), Effect.andThen(refreshLoadList()))
        : Effect.void)));
};
export const makeClickHandlers = (refs, buttons, setSubState, updateModeButton, completeWith, refreshLoadList) => ({
    onNewWorldClick: () => {
        MutableRef.set(refs.newWorldModeRef, 'survival');
        buttons.nwName.value = '';
        updateModeButton();
        setSubState('new-world');
        buttons.nwName.focus();
    },
    onLoadWorldClick: () => {
        setSubState('load-world');
        Effect.runFork(refreshLoadList());
    },
    onNwModeClick: () => {
        MutableRef.set(refs.newWorldModeRef, cycleGameMode(MutableRef.get(refs.newWorldModeRef)));
        updateModeButton();
    },
    onNwCancelClick: () => {
        setSubState('root');
        buttons.newWorld.focus();
    },
    onNwConfirmClick: () => {
        const trimmed = buttons.nwName.value.trim();
        const worldId = trimmed.length > 0 ? WorldId.make(trimmed) : generateWorldId();
        const gameMode = MutableRef.get(refs.newWorldModeRef);
        completeWith({ action: 'newWorld', worldId, gameMode });
    },
    onLwBackClick: () => {
        setSubState('root');
        buttons.loadWorld.focus();
    },
    onEsc: (ev) => {
        if (ev.key !== 'Escape')
            return;
        const sub = MutableRef.get(refs.subStateRef);
        if (sub === 'root')
            return;
        ev.preventDefault();
        setSubState('root');
        const focusTarget = sub === 'new-world' ? buttons.newWorld : buttons.loadWorld;
        focusTarget.focus();
    },
});
//# sourceMappingURL=../../../../dist/packages/app/presentation/menu/main-menu-handlers.js.map