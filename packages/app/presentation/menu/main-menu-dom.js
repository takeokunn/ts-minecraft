import { Array as Arr, Option } from 'effect';
import { overlayBaseStyle, cardStyle, buttonStyle, dangerButtonStyle, inputStyle } from './main-menu-styles';
import { formatLastPlayed } from './main-menu-utils';
// --- DOM build ---
export const buildMenuDOM = (dom) => {
    const overlay = dom.createElement('div');
    overlay.id = 'main-menu-overlay';
    overlay.style.cssText = `${overlayBaseStyle};display:none`;
    // ROOT card
    const rootCard = dom.createElement('div');
    rootCard.id = 'main-menu-root';
    rootCard.style.cssText = cardStyle;
    dom.setInnerHTML(rootCard, `
    <h1 style="margin:0 0 16px;text-align:center;font-size:28px">ts-minecraft</h1>
    <button type="button" id="mm-new-world" style="${buttonStyle}">New World</button>
    <button type="button" id="mm-load-world" style="${buttonStyle}">Load World</button>
  `);
    // NEW_WORLD card
    const newWorldCard = dom.createElement('div');
    newWorldCard.id = 'main-menu-new-world';
    newWorldCard.style.cssText = `${cardStyle};display:none`;
    dom.setInnerHTML(newWorldCard, `
    <h2 style="margin:0 0 8px;font-size:20px">Create New World</h2>
    <label style="display:flex;flex-direction:column;gap:4px">
      <span>World name</span>
      <input type="text" id="mm-nw-name" style="${inputStyle}" placeholder="My World" />
    </label>
    <label style="display:flex;flex-direction:column;gap:4px">
      <span>Game mode</span>
      <button type="button" id="mm-nw-mode" style="${buttonStyle}">Survival</button>
    </label>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button type="button" id="mm-nw-cancel" style="${buttonStyle};flex:1">Cancel</button>
      <button type="button" id="mm-nw-confirm" style="${buttonStyle};flex:1;background:#3a6a3a">Confirm</button>
    </div>
  `);
    // LOAD_WORLD card
    const loadWorldCard = dom.createElement('div');
    loadWorldCard.id = 'main-menu-load-world';
    loadWorldCard.style.cssText = `${cardStyle};min-width:480px;max-height:80vh;display:none;overflow:auto`;
    dom.setInnerHTML(loadWorldCard, `
    <h2 style="margin:0 0 8px;font-size:20px">Load World</h2>
    <div id="mm-lw-list" style="display:flex;flex-direction:column;gap:8px;min-height:60px"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button type="button" id="mm-lw-back" style="${buttonStyle};flex:1">Back</button>
    </div>
  `);
    overlay.appendChild(rootCard);
    overlay.appendChild(newWorldCard);
    overlay.appendChild(loadWorldCard);
    dom.appendChild(overlay);
    const required = (parent, selector) => Option.getOrElse(dom.querySelector(parent, selector), () => {
        throw new Error(`MainMenuService: missing required DOM element ${selector}`);
    });
    const buttons = {
        newWorld: required(rootCard, '#mm-new-world'),
        loadWorld: required(rootCard, '#mm-load-world'),
        nwName: required(newWorldCard, '#mm-nw-name'),
        nwMode: required(newWorldCard, '#mm-nw-mode'),
        nwCancel: required(newWorldCard, '#mm-nw-cancel'),
        nwConfirm: required(newWorldCard, '#mm-nw-confirm'),
        lwList: required(loadWorldCard, '#mm-lw-list'),
        lwBack: required(loadWorldCard, '#mm-lw-back'),
    };
    return { overlay, rootCard, newWorldCard, loadWorldCard, buttons };
};
// --- World list row renderers ---
export const rowBaseStyle = [
    'display:flex', 'align-items:center', 'gap:8px',
    'padding:8px 12px',
    'background:rgba(255,255,255,0.05)', 'border-radius:4px',
].join(';');
export const renderValidRow = (dom, lwList, worldId, metadata, onLoad, onDelete) => {
    const row = dom.createElement('div');
    row.style.cssText = rowBaseStyle;
    const info = dom.createElement('div');
    info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0';
    const name = dom.createElement('div');
    name.style.cssText = 'font-size:15px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    name.textContent = String(worldId);
    const meta = dom.createElement('div');
    meta.style.cssText = 'font-size:12px;opacity:0.8';
    meta.textContent = `Last played: ${formatLastPlayed(metadata.lastPlayed)}`;
    info.appendChild(name);
    info.appendChild(meta);
    const badge = dom.createElement('span');
    badge.style.cssText = [
        'padding:2px 8px', 'border-radius:12px', 'font-size:11px',
        metadata.gameMode === 'creative' ? 'background:#3a5a8a' : 'background:#3a6a3a',
    ].join(';');
    badge.textContent = metadata.gameMode === 'creative' ? 'Creative' : 'Survival';
    const loadBtn = dom.createElement('button');
    loadBtn.type = 'button';
    loadBtn.textContent = 'Load';
    loadBtn.style.cssText = buttonStyle;
    loadBtn.addEventListener('click', onLoad);
    const deleteBtn = dom.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.cssText = dangerButtonStyle;
    deleteBtn.addEventListener('click', onDelete);
    row.appendChild(info);
    row.appendChild(badge);
    row.appendChild(loadBtn);
    row.appendChild(deleteBtn);
    dom.appendChildTo(lwList, row);
};
export const renderCorruptRow = (dom, lwList, worldId, onDelete) => {
    const row = dom.createElement('div');
    row.style.cssText = `${rowBaseStyle};background:rgba(140,40,40,0.25)`;
    const info = dom.createElement('div');
    info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0';
    const name = dom.createElement('div');
    name.style.cssText = 'font-size:15px;font-weight:bold;color:#f99';
    name.textContent = `Corrupt: ${String(worldId)}`;
    const meta = dom.createElement('div');
    meta.style.cssText = 'font-size:12px;opacity:0.8';
    meta.textContent = 'This world failed to decode. Delete to recover.';
    info.appendChild(name);
    info.appendChild(meta);
    const deleteBtn = dom.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.cssText = dangerButtonStyle;
    deleteBtn.addEventListener('click', onDelete);
    row.appendChild(info);
    row.appendChild(deleteBtn);
    dom.appendChildTo(lwList, row);
};
// Re-export Arr for consumers that only need sort utilities
export { Arr };
//# sourceMappingURL=../../../../dist/packages/app/presentation/menu/main-menu-dom.js.map