/* Quiet Notes — no network requests; presentation preferences only. */
(() => {
  'use strict';
  const document = window.document;
  const ID = 'qn-settings';
  const KEY = 'quiet-notes.test.v1';
  const VERSION = '2.9.9-beta.1';
  if (document.getElementById(ID)) return;
  const flags = {
    enabled: false, top: false, compose: false, avatars: false, media: false, embeds: true, names: false, meta: true, actions: true,
    reader: false, readerTop: false, readerCompose: false, readerTools: false,
    // Typography is the theme's (and Font Manager's) unless these are switched on.
    noteType: false, readerType: false, readerIndent: true,
  };
  // Look customisation. Stored per device with the mode flags.
  const looks = {
    titleNote: { value: '메모', max: 20 }, titleReader: { value: '서재', max: 20 },
    nameBot: { value: '메모', max: 12 }, nameUser: { value: '작성', max: 12 },
    toast: { value: 'top', options: ['top', 'bottom'] },
    noteColor: { value: 'white', options: ['white', 'gray', 'dark'] },
    noteFont: { value: '', font: true },
    uiSize: { value: 100, min: 80, max: 130, step: 5 },
    noteSize: { value: 16, min: 12, max: 22, step: 1 }, noteLine: { value: 1.7, min: 1.3, max: 2.2, step: 0.05 },
    notePara: { value: 1, min: 0, max: 2, step: 0.1 },
    noteDivider: { value: 'line', options: ['line', 'short', 'stars', 'none'] },
    paper: { value: 'paper', options: ['paper', 'white', 'sepia', 'gray', 'night'] },
    readerFont: { value: '', font: true },
    readerSize: { value: 15, min: 12, max: 22, step: 1 }, readerLine: { value: 1.7, min: 1.3, max: 2.2, step: 0.05 },
    readerPara: { value: 0.6, min: 0, max: 2, step: 0.1 }, readerMargin: { value: 22, min: 8, max: 56, step: 2 },
    readerAlign: { value: 'justify', options: ['justify', 'left'] },
    readerDivider: { value: 'stars', options: ['line', 'short', 'stars', 'none'] },
  };
  const fontName = /^[^;{}<>\\]{0,80}$/;
  let state = { ...flags };
  for (const [key, spec] of Object.entries(looks)) state[key] = spec.value;
  // Message menu choices per mode: button key → 'in' (inside ···) or 'out' (in the row). Only changes are kept.
  const menus = ['menuNote', 'menuReader'];
  for (const key of menus) state[key] = {};
  function validMenu(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([k, v]) => /^[\w-]{1,80}$/.test(k) && (v === 'in' || v === 'out')).slice(0, 200));
  }
  function valid(key, value) {
    const spec = looks[key];
    if (spec.font) return typeof value === 'string' && fontName.test(value);
    if (spec.options) return spec.options.includes(value);
    if (typeof spec.value === 'number') return typeof value === 'number' && value >= spec.min && value <= spec.max;
    return typeof value === 'string' && value.length <= spec.max;
  }
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    for (const key of Object.keys(flags)) if (typeof saved[key] === 'boolean') state[key] = saved[key];
    for (const key of Object.keys(looks)) if (valid(key, saved[key])) state[key] = saved[key];
    for (const key of menus) state[key] = validMenu(saved[key]);
    // Before 2.9.3 'left' was the default (not a choice); books now start justified.
    if (!saved.v) state.readerAlign = looks.readerAlign.value;
  } catch { /* Storage may be unavailable in private browsing. */ }
  // Apply the saved mode as soon as this module loads, before constructing controls.
  document.documentElement.classList.toggle('qn-active', state.enabled);

  function boot() {
    if (document.getElementById(ID)) return;
    const root = document.documentElement;
    const abort = new AbortController();
    const chat = document.getElementById('chat');
    function el(tag, props = {}, ...children) {
      const node = Object.assign(document.createElement(tag), props);
      node.append(...children);
      return node;
    }
    function button(text, handler, className = '') {
      const item = el('button', { type: 'button', textContent: text, className });
      item.addEventListener('click', handler);
      return item;
    }
    const toggleMode = () => { state.enabled = !state.enabled; apply(); };
    // A browser may keep an older stylesheet after an update; reload it once when its version tag differs.
    const styleLink = [...document.querySelectorAll('link[rel="stylesheet"]')].find(link => /\/quiet-notes[^/]*\/style\.css$/.test(link.getAttribute('href') || ''));
    function refreshStyle() {
      if (getComputedStyle(root).getPropertyValue('--qn-css').replace(/["'\s]/g, '') === VERSION) return;
      const fresh = styleLink.cloneNode();
      fresh.href = styleLink.getAttribute('href') + '?v=' + VERSION;
      fresh.addEventListener('load', () => styleLink.remove(), {once: true});
      styleLink.after(fresh);
    }
    if (styleLink?.sheet) refreshStyle(); else styleLink?.addEventListener('load', refreshStyle, {once: true});
    // ST sends no cache headers, so a phone can keep running old files for hours after an update.
    // When manifest.json names a new version, the extension's own files are fetched again into the
    // browser cache (same origin, in the background); the next page load then runs them.
    if (styleLink) (async () => {
      try {
        const base = new URL('./', styleLink.href);
        const manifest = await (await fetch(new URL('manifest.json', base), { cache: 'no-cache' })).json();
        if (window.localStorage.getItem(KEY + '.files') === manifest.version) return;
        await Promise.all(['index.js', 'style.css', 'icons.css'].map(file => fetch(new URL(file, base), { cache: 'reload' })));
        window.localStorage.setItem(KEY + '.files', manifest.version);
      } catch { /* The cache refreshes on its own later. */ }
    })();

    // ── Settings: one body, shown in the Extensions tab drawer or moved into the dialog. ──
    // A switch for the mode, then tabs; every control writes state and calls apply().
    const settingsBody = el('div', { className: 'qn-settings-body' });
    const syncers = [];
    const labels = {
      top: '위', bottom: '아래', white: '흰색', gray: '회색', dark: '어둡게', line: '선', short: '짧은 선', stars: '* * *', none: '없음',
      paper: '미색', sepia: '베이지', night: '야간', left: '왼쪽', justify: '양쪽',
    };
    const swatches = {
      white: '#ffffff', gray: '#eaecef', dark: '#22262b',
      paper: '#f8f6f1', sepia: '#f2ede4', night: '#1c1c1e',
    };
    const darkSwatches = new Set(['dark', 'night']);
    // A switch made of plain spans: themes restyle checkboxes, never these.
    function makeSwitch(onChange) {
      const node = el('span', { className: 'qn-switch', tabIndex: 0 }, el('i'));
      node.setAttribute('role', 'switch');
      const flip = () => { if (node.getAttribute('aria-disabled') !== 'true') onChange(node.getAttribute('aria-checked') !== 'true'); };
      node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
      return {
        node, flip,
        set(checked, disabled = false) { node.setAttribute('aria-checked', String(checked)); node.setAttribute('aria-disabled', String(disabled)); },
      };
    }
    function switchRow(text, sw, className = '') {
      const line = el('div', { className: 'qn-row qn-row-switch ' + className }, el('span', { className: 'qn-row-label', textContent: text }), sw.node);
      line.addEventListener('click', sw.flip);
      return line;
    }
    const fontLabels = { '': '기존 그대로', serif: '명조 계열', 'sans-serif': '고딕 계열' };
    function fillFonts(select, current) {
      const names = new Set(['', 'serif', 'sans-serif']);
      try {
        for (const face of document.fonts) {
          const name = face.family.replace(/^["']|["']$/g, '');
          if (fontName.test(name) && !/awesome|icon|symbol|emoji/i.test(name)) names.add(name);
        }
      } catch { /* FontFaceSet iteration is optional. */ }
      names.add(current);
      select.replaceChildren(...[...names].map(name => new Option(fontLabels[name] ?? name, name)));
      select.value = current;
    }
    const set = (key, value) => { state[key] = value; apply(); };
    const row = (text, control, hint) => el('div', { className: 'qn-row' }, el('span', { className: 'qn-row-label', textContent: text }, ...(hint ? [el('small', { textContent: hint })] : [])), control);
    // hide: the switch reads "○○ 가리기", so on means the item is hidden (state stores "shown").
    function toggle(key, text, { forcedInReader = false, onlyReader = false, hide = false } = {}) {
      const sw = makeSwitch(checked => set(key, hide ? !checked : checked));
      const line = switchRow(text, sw);
      syncers.push(() => {
        // The e-book always hides these: shown as switched on and locked.
        const forced = forcedInReader && state.enabled && state.reader;
        sw.set(forced ? hide : (hide ? !state[key] : state[key]), forced);
        line.hidden = onlyReader && !state.reader;
      });
      return line;
    }
    function choice(key, { swatch = false } = {}) {
      const box = el('div', { className: swatch ? 'qn-swatches' : 'qn-segments', role: 'radiogroup' });
      const items = looks[key].options.map(value => {
        const item = button(swatch ? '' : labels[value], () => set(key, value));
        item.setAttribute('role', 'radio');
        if (swatch) { item.style.setProperty('--qn-swatch', swatches[value]); item.style.setProperty('--qn-check', darkSwatches.has(value) ? '#fff' : '#333'); item.title = labels[value]; item.setAttribute('aria-label', labels[value]); }
        return [value, item];
      });
      box.append(...items.map(([, item]) => item));
      syncers.push(() => { for (const [value, item] of items) item.setAttribute('aria-checked', String(state[key] === value)); });
      return box;
    }
    function stepper(key, unit = '', typedBy = null) {
      const spec = looks[key];
      const decimals = String(spec.step).split('.')[1]?.length || 0;
      const out = el('output');
      const nudge = dir => set(key, Math.min(spec.max, Math.max(spec.min, Number((state[key] + dir * spec.step).toFixed(decimals)))));
      const minus = button('−', () => nudge(-1));
      const plus = button('+', () => nudge(1));
      for (const [b, label] of [[minus, '줄이기'], [plus, '늘리기']]) b.setAttribute('aria-label', label);
      const box = el('div', { className: 'qn-stepper' }, minus, out, plus);
      syncers.push(() => {
        out.textContent = state[key].toFixed(decimals) + unit;
        minus.disabled = state[key] <= spec.min;
        plus.disabled = state[key] >= spec.max;
        if (typedBy) box.parentElement.hidden = !state[typedBy];
      });
      return box;
    }
    function fontPicker(key) {
      const select = el('select', { className: 'text_pole' });
      select.addEventListener('change', () => set(key, select.value));
      syncers.push(() => { if (select !== document.activeElement) fillFonts(select, state[key]); });
      return select;
    }
    function text(key) {
      const input = el('input', { type: 'text', className: 'text_pole', maxLength: looks[key].max, placeholder: looks[key].value });
      input.addEventListener('input', () => set(key, input.value.trim().slice(0, looks[key].max)));
      syncers.push(() => { if (input !== document.activeElement) input.value = state[key]; });
      return input;
    }

    const modeSwitch = makeSwitch(checked => { if (checked !== state.enabled) toggleMode(); });
    const modeRow = switchRow('', modeSwitch, 'qn-mode-row');
    const modeLabel = modeRow.firstElementChild;
    settingsBody.append(modeRow);
    syncers.push(() => { modeSwitch.set(state.enabled); modeLabel.textContent = state.enabled ? '일코 모드 켜짐' : '일코 모드 꺼짐'; });

    // ── Message menu: which buttons stay in the row and which go inside "···", for each mode.
    //    Buttons are moved between the row and ST's own box inside the same message, so every
    //    handler keeps working; turning the mode off puts each one back where it was found. ──
    const plainClass = /^(mes_button|interactable|menu_button|fa|fa-fw|fa-solid|fa-regular|fa-brands|fa-[\w-]+)$/;
    const buttonKey = node => [...node.classList].find(name => !plainClass.test(name)) || node.id || '';
    const origin = new WeakMap(); // button → 'in' | 'out', where it was first seen
    const keyDefault = new Map(); // key → where ST or its extension puts it
    const keyLook = new Map(); // key → { label, icon } for the settings list
    function rowParts(row) {
      return { hint: row.querySelector(':scope > .extraMesButtonsHint'), box: row.querySelector(':scope > .extraMesButtons') };
    }
    function noteButtons(row) {
      const { hint, box } = rowParts(row);
      if (!hint || !box) return [];
      const nodes = [...row.children, ...box.children].filter(node => node !== hint && node !== box && buttonKey(node));
      for (const node of nodes) {
        const key = buttonKey(node);
        if (!origin.has(node)) origin.set(node, node.parentElement === box ? 'in' : 'out');
        if (!keyDefault.has(key)) keyDefault.set(key, origin.get(node));
        if (!keyLook.has(key)) {
          const icon = [...node.classList].filter(name => /^fa-/.test(name) && !/^fa-(fw|solid|regular|brands)$/.test(name)).join(' ')
            || [...(node.querySelector('[class*="fa-"]')?.classList || [])].filter(name => /^fa-/.test(name)).join(' ');
          keyLook.set(key, { label: (node.title || node.getAttribute('aria-label') || node.textContent || key).trim().slice(0, 40) || key, icon });
        }
      }
      return nodes;
    }
    const menuMode = () => state.reader ? 'menuReader' : 'menuNote';
    const menuActive = () => state.enabled && (state.actions || state.reader);
    function arrangeRow(row) {
      const { hint, box } = rowParts(row);
      if (!hint || !box) return;
      const choices = state[menuMode()];
      for (const node of noteButtons(row)) {
        const key = buttonKey(node);
        const inside = menuActive() ? (choices[key] ? choices[key] === 'in' : keyDefault.get(key) === 'in') : origin.get(node) === 'in';
        if (inside && node.parentElement !== box) box.append(node);
        else if (!inside && node.parentElement === box) row.insertBefore(node, hint);
      }
    }
    const arrangeAll = () => chat?.querySelectorAll('.mes .mes_buttons').forEach(arrangeRow);
    // Two zones of icon chips, like the message's own row and its ··· menu; a tap moves a button across.
    function menuPicker(modeKey, shownBy) {
      const outZone = el('div', { className: 'qn-chips' });
      const inZone = el('div', { className: 'qn-chips qn-chips-in' });
      const caption = el('div', { className: 'qn-menu-caption' });
      const box = el('div', { className: 'qn-menu-picker' },
        el('div', { className: 'qn-zone-label', textContent: '밖에 보이는 버튼' }), outZone,
        el('div', { className: 'qn-zone-label', textContent: '··· 메뉴 안' }), inZone, caption);
      function build() {
        const template = document.querySelector('#message_template .mes_buttons');
        for (const row of [template, ...(chat?.querySelectorAll('.mes .mes_buttons') || [])]) if (row) noteButtons(row);
        const choices = state[modeKey];
        const inside = key => choices[key] ? choices[key] === 'in' : keyDefault.get(key) === 'in';
        const chip = key => {
          const look = keyLook.get(key);
          const node = el('button', { type: 'button', className: 'qn-chip', title: look.label });
          node.setAttribute('aria-label', look.label);
          node.append(look.icon ? el('i', { className: 'fa-solid ' + look.icon }) : el('span', { className: 'qn-chip-abbr', textContent: look.label.slice(0, 2) }));
          node.addEventListener('click', () => {
            const next = inside(key) ? 'out' : 'in';
            if (next === keyDefault.get(key)) delete choices[key]; else choices[key] = next;
            caption.textContent = look.label + (next === 'in' ? '  →  ··· 안' : '  →  밖');
            apply();
          });
          return node;
        };
        const keys = [...keyLook.keys()];
        outZone.replaceChildren(...keys.filter(key => !inside(key)).map(chip));
        inZone.replaceChildren(...keys.filter(inside).map(chip));
      }
      syncers.push(() => { box.hidden = !state[shownBy]; if (!box.hidden) build(); });
      return box;
    }

    const section = title => el('div', { className: 'qn-section', textContent: title });
    // Tabs: 공통 (both modes) · 일반 · 전자책 (each mode's own look) · 기타 (names and reset).
    // One name throughout for the per-message buttons: "메시지 버튼", folded into "··· 메뉴".
    const pages = {
      공통: [
        toggle('reader', '전자책 모드'),
        toggle('avatars', '프로필 사진 가리기', { forcedInReader: true, hide: true }), toggle('media', '본문 이미지·에셋 가리기', { forcedInReader: true, hide: true }),
        toggle('embeds', '임베드 패널 가리기', { forcedInReader: true, hide: true }), toggle('names', '대화 이름 가리기', { forcedInReader: true, hide: true }),
        toggle('meta', '메시지 정보 가리기', { forcedInReader: true, hide: true }),
        section('화면'),
        row('UI 글자 크기', stepper('uiSize', '%')), row('알림 위치', choice('toast')),
      ],
      일반: [
        row('색', choice('noteColor', { swatch: true })),
        section('본문'),
        row('글꼴', fontPicker('noteFont')), toggle('noteType', '크기·간격 직접 지정'),
        row('글자 크기', stepper('noteSize', 'px', 'noteType')), row('줄 간격', stepper('noteLine', '', 'noteType')), row('문단 간격', stepper('notePara', 'em', 'noteType')),
        row('구분선', choice('noteDivider')),
        section('메시지 버튼'),
        toggle('actions', '··· 메뉴로 접기'), menuPicker('menuNote', 'actions'),
      ],
      전자책: [
        row('종이', choice('paper', { swatch: true })),
        section('본문'),
        row('글꼴', fontPicker('readerFont')), toggle('readerType', '크기·줄 간격 직접 지정'),
        row('글자 크기', stepper('readerSize', 'px', 'readerType')), row('줄 간격', stepper('readerLine', '', 'readerType')),
        row('문단 간격', stepper('readerPara', 'em')), toggle('readerIndent', '첫 줄 들여쓰기'), row('좌우 여백', stepper('readerMargin', 'px')),
        row('정렬', choice('readerAlign')), row('구분선', choice('readerDivider')),
        section('메시지 버튼'),
        toggle('readerTools', '전자책에서도 보이기'), menuPicker('menuReader', 'readerTools'),
      ],
      기타: [
        row('탭 제목', text('titleNote')), row('전자책 탭 제목', text('titleReader')),
        row('캐릭터 이름', text('nameBot')), row('유저 이름', text('nameUser')),
        button('꾸미기 기본값으로', () => {
          for (const [key, spec] of Object.entries(looks)) state[key] = spec.value;
          for (const key of ['noteType', 'readerType', 'readerIndent']) state[key] = flags[key];
          for (const key of menus) state[key] = {};
          apply();
        }, 'menu_button qn-settings-reset'),
        el('small', { className: 'qn-settings-note', textContent: '이 기기에만 저장됩니다.' }),
      ],
    };
    const tabBar = el('div', { className: 'qn-tabs', role: 'tablist' });
    const pageBox = el('div', { className: 'qn-page' });
    let currentPage = '공통';
    const tabs = Object.keys(pages).map(name => {
      const tab = button(name, () => { currentPage = name; syncSettings(); });
      tab.setAttribute('role', 'tab');
      return [name, tab];
    });
    tabBar.append(...tabs.map(([, tab]) => tab));
    settingsBody.append(tabBar, pageBox);
    syncers.push(() => {
      for (const [name, tab] of tabs) tab.setAttribute('aria-selected', String(name === currentPage));
      if (pageBox.dataset.page !== currentPage) { pageBox.replaceChildren(...pages[currentPage]); pageBox.dataset.page = currentPage; }
    });
    const drawerContent = el('div', { className: 'inline-drawer-content' }, settingsBody);
    const settingsPanel = el('div', { id: ID, className: 'inline-drawer' },
      el('div', { className: 'inline-drawer-toggle inline-drawer-header' }, el('b', { textContent: 'Quiet Notes Test' }), el('div', { className: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' })),
      drawerContent);
    function mountOnce(mount) {
      const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
      if (!mount()) observer.observe(document.body, {childList: true, subtree: true});
      return observer;
    }
    const settingsObserver = mountOnce(() => {
      const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
      if (host && settingsPanel.parentElement !== host) host.append(settingsPanel);
      return !!host;
    });

    // ── Settings dialog (opened from the wand menu and the e-book bar) ──
    // Modal <dialog>s live in the top layer: themes put a transform on <html>, which would
    // otherwise pin fixed boxes to a 0px-tall page and push them off screen.
    const dialogBody = el('div', { className: 'qn-dialog-body' });
    const dialog = el('dialog', { id: 'qn-dialog', ariaLabel: 'Quiet Notes 설정' },
      el('div', { className: 'qn-dialog-card' },
        el('div', { className: 'qn-dialog-head' }, el('b', { textContent: 'Quiet Notes' }), button('✕', () => openDialog(false), 'qn-dialog-close')),
        dialogBody));
    function openDialog(open) {
      if (open === dialog.open) return;
      if (open) { dialogBody.append(settingsBody); syncSettings(); dialog.showModal(); } else dialog.close();
    }
    dialog.addEventListener('close', () => drawerContent.append(settingsBody));
    // A press on the backdrop lands on the <dialog> itself.
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    document.body.append(dialog);

    const wandLabel = el('span', { textContent: 'Quiet Notes' });
    const wandToggle = el('div', { id: 'qn-wand-toggle', className: 'list-group-item flex-container flexGap5', tabIndex: 0, title: '일코 모드 설정' },
      el('div', { className: 'extensionsMenuExtensionButton fa-fw fa-solid fa-file-lines', ariaHidden: 'true' }), wandLabel);
    wandToggle.setAttribute('role', 'button');
    wandToggle.addEventListener('click', () => openDialog(true));
    wandToggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wandToggle.click(); }
    });
    const wandContainer = el('div', { id: 'qn-wand-container', className: 'extension_container' }, wandToggle);
    const wandObserver = mountOnce(() => {
      const menu = document.getElementById('extensionsMenu');
      if (menu && wandContainer.parentElement !== menu) menu.append(wandContainer);
      return !!menu;
    });

    // ── Edge grips: thin lines above and below the chat. Drag towards the page to reveal a bar, away to fold it. ──
    // A bar that opens under the finger must not take the rest of that tap (the phone's
    // follow-up mouse/click events): presses elsewhere are dropped for a moment after a toggle.
    let guardUntil = 0;
    const guard = e => {
      if (performance.now() < guardUntil && !e.target.closest?.('.qn-edge-grip')) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    };
    for (const type of ['click', 'mousedown', 'mouseup', 'touchend', 'pointerup', 'contextmenu']) document.addEventListener(type, guard, { capture: true, signal: abort.signal });
    function edge(kind) {
      const grip = el('div', { className: 'qn-edge-grip', tabIndex: 0, title: kind === 'top' ? '상단 도구 열기·닫기' : '입력 바 열기·닫기' });
      grip.setAttribute('role', 'button');
      const key = () => kind === 'top' ? (state.reader ? 'readerTop' : 'top') : (state.reader ? 'readerCompose' : 'compose');
      const set = open => { if (state[key()] !== open) { state[key()] = open; guardUntil = performance.now() + 700; apply(); } };
      // A tap flips the bar; a drag of 16px or more opens or folds it by direction.
      let startY = null;
      let moved = false;
      grip.addEventListener('pointerdown', e => { startY = e.clientY; moved = false; try { grip.setPointerCapture(e.pointerId); } catch { /* Synthetic events. */ } });
      grip.addEventListener('pointermove', e => {
        if (startY === null) return;
        if (Math.abs(e.clientY - startY) > 8) moved = true;
        if (Math.abs(e.clientY - startY) < 16) return;
        set(kind === 'top' ? e.clientY > startY : e.clientY < startY);
        startY = null; // One toggle per drag.
      });
      grip.addEventListener('pointerup', e => { if (startY !== null && !moved) { e.preventDefault(); set(!state[key()]); } startY = null; });
      grip.addEventListener('pointercancel', () => { startY = null; });
      // A touch always ends on the element it started on: cancelling it here stops the phone from
      // sending its own click afterwards to whatever now lies under the finger (a chat, a button).
      grip.addEventListener('touchend', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
      grip.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(!state[key()]); }
      });
      return el('div', { className: 'qn-edge qn-edge-' + kind }, grip);
    }
    const topEdge = edge('top');
    const bottomEdge = edge('bottom');
    function mountEdges() {
      if (!chat) return;
      if (!state.enabled) { topEdge.remove(); bottomEdge.remove(); return; }
      if (topEdge.nextElementSibling !== chat) chat.before(topEdge);
      if (bottomEdge.previousElementSibling !== chat) chat.after(bottomEdge);
    }

    // ── E-book chrome: its own app bar and contents list. The native top bar stays hidden;
    //    each row presses the matching native control, so every handler is the original one. ──
    const icon = body => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    function barButton(label, body, handler) {
      const item = button('', handler);
      item.innerHTML = icon(body);
      item.title = label;
      item.setAttribute('aria-label', label);
      return item;
    }
    const drawerNames = [
      ['#leftNavDrawerIcon', '작성 도구'], ['#API-status-top', '연결'], ['.fa-font', '서식'], ['#WIDrawerIcon', '사전'],
      ['.fa-user-cog', '환경 설정'], ['.fa-panorama', '배경'], ['.fa-cubes', '확장'], ['.fa-face-smile', '프로필'], ['#rightNavDrawerIcon', '책장'],
    ];
    const chatActions = [
      ['#extensionTopBarChatManager, #option_select_chat', '기록'], ['#extensionTopBarNewChat, #option_start_new_chat', '새 노트'],
      ['#extensionTopBarRenameChat', '제목 바꾸기'], ['#extensionTopBarCloseChat, #option_close_chat', '덮기'], ['#extensionTopBarDeleteChat', '삭제'],
    ];
    const press = node => (node.closest('.drawer-toggle') || node).click();
    const toc = el('div', { id: 'qn-toc', hidden: true });
    function showToc(show) {
      if (show) {
        const section = (title, rows) => rows.length ? [el('h4', { textContent: title }), el('div', { className: 'qn-toc-list' }, ...rows.map(([node, text]) => button(text, () => { showToc(false); press(node); })))] : [];
        const actions = chatActions.map(([selector, text]) => [document.querySelector(selector), text]).filter(([node]) => node);
        const drawers = [...document.querySelectorAll('#top-settings-holder .drawer-icon')].map(node => [node, drawerNames.find(([selector]) => node.matches(selector))?.[1] || node.title || '기타']);
        toc.replaceChildren(...section('이 문서', actions), ...section('서재', drawers));
      }
      toc.hidden = !show;
    }
    const readerTitle = el('span', { className: 'qn-reader-title' });
    // ‹ opens the shelf and closes it again. ST closes an open drawer on any press outside it
    // before this click runs, so the state at press time decides.
    const shelfPanel = () => document.getElementById('right-nav-panel');
    let shelfWasOpen = false;
    const shelfButton = barButton('책장', '<path d="M15 5l-7 7 7 7"/>', () => {
      showToc(false);
      const shelf = document.getElementById('rightNavDrawerIcon');
      const openNow = !!shelfPanel()?.classList.contains('openDrawer');
      if (shelf && openNow === shelfWasOpen) press(shelf);
    });
    shelfButton.addEventListener('pointerdown', () => { shelfWasOpen = !!shelfPanel()?.classList.contains('openDrawer'); }, true);
    const readerBar = el('nav', { id: 'qn-reader-bar' },
      shelfButton, readerTitle,
      barButton('목차', '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".7"/><circle cx="4.5" cy="12" r=".7"/><circle cx="4.5" cy="18" r=".7"/>', () => showToc(toc.hidden)),
      barButton('보기 설정', '<path d="M3 18l4.5-11L12 18M4.6 14.5h5.8"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M20 12.5V18"/>', () => { showToc(false); openDialog(true); }));
    readerBar.setAttribute('aria-label', '읽기 도구');
    document.body.append(readerBar, toc);

    // The native top bar keeps the theme's own height; the chat starts right under it.
    const nativeBar = document.getElementById('top-settings-holder');
    const barObserver = new ResizeObserver(() => {
      const height = nativeBar.offsetHeight;
      if (state.enabled && height) root.style.setProperty('--qn-bar-h', height + 'px');
    });
    if (nativeBar) barObserver.observe(nativeBar);

    let openActions = null;
    // Change text nodes only: keep the theme's typography, decoration and DOM intact.
    const nameText = new WeakMap();
    function updateName(name) {
      const hidden = state.enabled && !state.names;
      let labelled = false;
      for (const node of name.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        let saved = nameText.get(node);
        if (!saved) saved = { original: node.data, last: node.data };
        if (node.data !== saved.last) saved.original = node.data;
        let text = saved.original;
        if (hidden && text.trim()) {
          const user = name.closest('.mes')?.getAttribute('is_user') === 'true';
          text = labelled ? '' : (user ? state.nameUser || looks.nameUser.value : state.nameBot || looks.nameBot.value);
          labelled = true;
        }
        saved.last = text;
        nameText.set(node, saved);
        if (node.data !== text) node.data = text;
      }
    }
    function closeActions() {
      if (!openActions) return;
      openActions.classList.remove('qn-actions-open');
      openActions.querySelector('.extraMesButtonsHint')?.setAttribute('aria-expanded', 'false');
      openActions = null;
    }
    // Hide only media-only wrappers. Never remove iframe nodes or reset their sessions.
    const mediaSelector = 'img,video,audio,canvas,svg,picture,iframe,object,embed';
    const shells = new Set();
    function refreshShells(scope = chat) {
      if (!scope) return;
      for (const node of shells) {
        if (!node.isConnected || scope.contains(node)) {
          node.classList.remove('qn-hidden-shell');
          shells.delete(node);
        }
      }
      if (!state.enabled) return;
      const hideMedia = state.reader || !state.media;
      const hideEmbeds = state.reader || !state.embeds;
      const hiddenLeaf = node => node.matches('iframe,object,embed') ? hideEmbeds : node.matches('img,video,audio,canvas,svg,picture') && hideMedia;
      const empty = node => node.nodeType === Node.TEXT_NODE ? !node.textContent.trim() : node instanceof Element && (node.matches('br,source') || shells.has(node) || hiddenLeaf(node));
      for (const leaf of scope.querySelectorAll(mediaSelector)) {
        if (!leaf.closest('.mes_text') || !hiddenLeaf(leaf)) continue;
        let parent = leaf.parentElement;
        while (parent && !parent.matches('.mes_text')) {
          if (![...parent.childNodes].every(empty)) break;
          parent.classList.add('qn-hidden-shell');
          shells.add(parent);
          parent = parent.parentElement;
        }
      }
    }
    let blueWasOn = document.body.classList.contains('salty');
    let adjustingBlue = false;
    function syncBlue() {
      const blueEnabled = window.Salty?.getSettings?.()?.enabled;
      if (typeof blueEnabled === 'boolean') blueWasOn = blueEnabled;
      else if (!state.enabled && document.body.classList.contains('salty')) blueWasOn = true;
      const showBlue = blueWasOn && !state.enabled;
      if (document.body.classList.contains('salty') === showBlue) return;
      adjustingBlue = true;
      document.body.classList.toggle('salty', showBlue);
      adjustingBlue = false;
    }
    const blueObserver = new MutationObserver(() => { if (!adjustingBlue) syncBlue(); });
    blueObserver.observe(document.body, {attributes: true, attributeFilter: ['class']});
    const menuRows = new Set();
    const actionsObserver = new MutationObserver(records => {
      if (!state.enabled) return;
      const mediaRoots = new Set();
      if (records.some(record => record.removedNodes.length)) {
        for (const node of shells) if (!node.isConnected) shells.delete(node);
      }
      for (const record of records) {
        const target = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
        const name = target?.closest?.('.name_text');
        if (name && !state.names) updateName(name);
        if (target?.closest?.('.qn-hidden-shell') || record.removedNodes.length) {
          const text = target?.closest?.('.mes_text');
          if (text && (text.querySelector('.qn-hidden-shell') || target.closest('.qn-hidden-shell'))) mediaRoots.add(text);
        }
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (!state.names) {
            if (node.matches('.name_text')) updateName(node);
            else node.querySelectorAll('.name_text').forEach(updateName);
          }
          if (node.matches(mediaSelector) || node.querySelector(mediaSelector)) mediaRoots.add(node.closest('.mes_text') || node);
          // New messages, and buttons extensions add to a message later, take the chosen menu layout.
          const row = node.closest('.mes_buttons');
          if (row) menuRows.add(row);
          else node.querySelectorAll('.mes_buttons').forEach(found => menuRows.add(found));
        }
      }
      for (const scope of mediaRoots) refreshShells(scope);
      for (const row of menuRows) arrangeRow(row);
      menuRows.clear();
    });
    if (chat) actionsObserver.observe(chat, {childList: true, subtree: true, characterData: true});
    document.addEventListener('click', e => {
      const toggle = e.target.closest?.('.extraMesButtonsHint');
      if (!toggle || !state.enabled || !(state.actions || state.reader)) return;
      e.stopPropagation(); // Use the native trigger without also running its expand handler.
      const actions = toggle.closest('.mes_buttons');
      if (!actions) return;
      const wasOpen = actions === openActions;
      closeActions();
      if (!wasOpen) {
        openActions = actions;
        actions.classList.add('qn-actions-open');
        toggle.setAttribute('aria-expanded', 'true');
      }
    }, {capture: true, signal: abort.signal});
    document.addEventListener('pointerdown', e => {
      if (openActions && !openActions.contains(e.target)) closeActions();
      if (!toc.hidden && !toc.contains(e.target) && !readerBar.contains(e.target)) showToc(false);
    }, {signal: abort.signal});
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeActions(); showToc(false); openDialog(false); }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyM' && !e.repeat) { e.preventDefault(); toggleMode(); }
    }, {signal: abort.signal});
    // E-book footer shows only the reading position, like a reader app's page indicator.
    let progressFrame = 0;
    function updateProgress() {
      progressFrame = 0;
      if (!state.enabled || !state.reader || !chat) return;
      const range = chat.scrollHeight - chat.clientHeight;
      bottomEdge.style.setProperty('--qn-read', (range > 0 ? Math.round(chat.scrollTop / range * 100) : 100) + '%');
    }
    chat?.addEventListener('scroll', () => { if (!progressFrame && state.enabled && state.reader) progressFrame = requestAnimationFrame(updateProgress); }, {passive: true, signal: abort.signal});

    let previousTitle = document.title;
    let renamedTitle = false;
    const noteIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#f7f8fa"/><g fill="none" stroke="#506b87" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h10l5 5v17H9zM19 5v6h5M13 16h7M13 21h7"/></g></svg>');
    const favicons = [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]')].map(node => ({node, href: node.getAttribute('href'), type: node.getAttribute('type')}));
    let iconsChanged = false;
    function updateFavicons() {
      if (iconsChanged === state.enabled) return;
      for (const {node, href, type} of favicons) {
        if (state.enabled) { node.setAttribute('href', noteIcon); node.setAttribute('type', 'image/svg+xml'); }
        else {
          if (href === null) node.removeAttribute('href'); else node.setAttribute('href', href);
          if (type === null) node.removeAttribute('type'); else node.setAttribute('type', type);
        }
      }
      iconsChanged = state.enabled;
    }
    let currentTitle = '';
    function titleUpdate() {
      if (state.enabled) {
        const next = (state.reader ? state.titleReader || looks.titleReader.value : state.titleNote || looks.titleNote.value);
        if (document.title !== next) {
          if (!renamedTitle || document.title !== currentTitle) previousTitle = document.title;
          document.title = next;
        }
        currentTitle = next;
        renamedTitle = true;
      } else if (renamedTitle) {
        document.title = previousTitle;
        renamedTitle = false;
      }
    }
    const title = document.querySelector('title');
    const titleObserver = new MutationObserver(titleUpdate);
    if (title) titleObserver.observe(title, {childList: true, subtree: true, characterData: true});

    // Look variables and attributes live on <html> only while incognito mode is on.
    const pick = (note, reader) => state.reader ? state[reader] : state[note];
    const fontValue = () => {
      const name = pick('noteFont', 'readerFont');
      return /^(serif|sans-serif|monospace)$/.test(name) ? name : '"' + name.replace(/"/g, '') + '"';
    };
    const lookVars = {
      '--qn-size': () => pick('noteSize', 'readerSize') + 'px', '--qn-lh': () => String(pick('noteLine', 'readerLine')),
      '--qn-font': fontValue, '--qn-r-para': () => state.readerPara + 'em', '--qn-r-margin': () => state.readerMargin + 'px',
      '--qn-n-para': () => state.notePara + 'em',
    };
    // UI text size: ST sizes its interface from --mainFontSize; the chat keeps the original value
    // (see the stylesheet), so the message text follows only its own settings.
    let uiScaled = false;
    function applyUiSize() {
      const scaled = state.enabled && state.uiSize !== 100;
      if (scaled) root.style.setProperty('--mainFontSize', 'calc(var(--fontScale, 1) * ' + (15 * state.uiSize / 100).toFixed(2) + 'px)');
      else if (uiScaled) root.style.removeProperty('--mainFontSize');
      root.toggleAttribute('data-qn-ui', scaled);
      uiScaled = scaled;
    }
    const lookAttrs = {
      'data-qn-note': () => state.noteColor, 'data-qn-paper': () => state.paper, 'data-qn-toast': () => state.toast,
      'data-qn-divider': () => pick('noteDivider', 'readerDivider'), 'data-qn-align': () => state.readerAlign,
      'data-qn-type': () => pick('noteType', 'readerType') ? 'on' : 'off',
      'data-qn-font': () => pick('noteFont', 'readerFont') ? 'on' : 'off',
      'data-qn-indent': () => state.readerIndent ? 'on' : 'off',
    };
    function applyLooks() {
      for (const [name, value] of Object.entries(lookVars)) {
        if (state.enabled) root.style.setProperty(name, value()); else root.style.removeProperty(name);
      }
      for (const [name, value] of Object.entries(lookAttrs)) {
        if (state.enabled) root.setAttribute(name, value()); else root.removeAttribute(name);
      }
      if (!state.enabled) root.style.removeProperty('--qn-bar-h');
      applyUiSize();
    }
    function syncSettings() {
      // Page swap first, so rows on the new page sync in the same pass.
      syncers[syncers.length - 1]();
      for (const sync of syncers) sync();
    }

    function cleanup() {
      abort.abort();
      titleObserver.disconnect();
      wandObserver.disconnect();
      settingsObserver.disconnect();
      actionsObserver.disconnect();
      blueObserver.disconnect();
      barObserver.disconnect();
      closeActions();
      state.enabled = false;
      mountEdges();
      arrangeAll();
      const form = document.getElementById('form_sheld');
      if (form) form.inert = false;
      for (const node of [dialog, readerBar, toc, wandContainer, settingsPanel]) node.remove();
      refreshShells();
      syncBlue();
      applyLooks();
      chat?.querySelectorAll('.name_text').forEach(updateName);
      updateFavicons();
      for (const cls of [...root.classList]) if (cls.startsWith('qn-')) root.classList.remove(cls);
      if (renamedTitle && document.title === currentTitle) document.title = previousTitle;
    }
    window.addEventListener('pagehide', cleanup, {once: true});
    window.addEventListener('unload', cleanup, {once: true});
    // Mode and look changes reflow every message; keep the message being read (or the bottom) in place.
    function captureAnchor() {
      if (!chat || !chat.isConnected || !chat.getClientRects().length) return null;
      if (chat.scrollHeight - chat.clientHeight - chat.scrollTop < 40) return {bottom: true};
      const box = chat.getBoundingClientRect();
      // The paragraph being read, not its whole message: a message grows a lot between modes
      // (pictures, avatars, panels), its paragraphs barely. elementsFromPoint: bars may lie over the chat.
      const top = Math.max(box.top, 0);
      const y = top + Math.min(Math.max(box.bottom - top, 0) * 0.3, 160);
      const hit = document.elementsFromPoint(box.left + box.width / 2, y).find(node => node.closest?.('#chat .mes'));
      if (!hit) return null;
      const mes = hit.closest('#chat .mes');
      const text = hit.closest('#chat .mes_text :is(p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, div)') || hit.closest('#chat .mes_text');
      const at = node => node.getBoundingClientRect().top - box.top;
      return {mes, offset: at(mes), text, textOffset: text ? at(text) : 0};
    }
    function restoreAnchor(anchor) {
      if (!anchor) return;
      if (anchor.bottom) { chat.scrollTop = chat.scrollHeight; return; }
      const chatTop = chat.getBoundingClientRect().top;
      if (anchor.text?.isConnected && anchor.text.getClientRects().length) chat.scrollTop += anchor.text.getBoundingClientRect().top - chatTop - anchor.textOffset;
      else if (anchor.mes.isConnected) chat.scrollTop += anchor.mes.getBoundingClientRect().top - chatTop - anchor.offset;
    }
    // Late layout changes (stylesheets, theme rules, bar heights, fonts) keep moving the text for a
    // moment after a mode change: hold the reading position for a short while unless the reader scrolls.
    let holdFrame = 0;
    let holdCancel = null;
    function holdAnchor(anchor) {
      cancelAnimationFrame(holdFrame);
      holdCancel?.();
      restoreAnchor(anchor);
      if (!anchor) return;
      const until = performance.now() + 900;
      const stop = () => { cancelAnimationFrame(holdFrame); holdCancel?.(); };
      const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
      for (const type of inputs) chat.addEventListener(type, stop, { passive: true });
      holdCancel = () => { for (const type of inputs) chat.removeEventListener(type, stop); holdCancel = null; };
      const tick = now => {
        restoreAnchor(anchor);
        if (now < until) holdFrame = requestAnimationFrame(tick); else holdCancel?.();
      };
      holdFrame = requestAnimationFrame(tick);
    }
    let lastNames = null;
    let lastMedia = null;
    function apply() {
      const anchor = captureAnchor();
      const reader = state.enabled && state.reader;
      const top = state.reader ? state.readerTop : state.top;
      const compose = state.reader ? state.readerCompose : state.compose;
      root.classList.add('qn-installed');
      root.classList.toggle('qn-active', state.enabled);
      root.classList.toggle('qn-actions-fold', state.enabled && (state.actions || state.reader));
      root.classList.toggle('qn-reader', reader);
      root.classList.toggle('qn-reader-tools-visible', reader && state.readerTools);
      applyLooks();
      mountEdges();
      syncBlue();
      const names = [state.enabled && !state.names, state.nameBot, state.nameUser].join('\n');
      if (lastNames !== names) { chat?.querySelectorAll('.name_text').forEach(updateName); lastNames = names; }
      if (!state.enabled || !(state.actions || state.reader) || (reader && !state.readerTools)) closeActions();
      for (const [key, visible] of Object.entries({top, compose, avatars: !reader && state.avatars, media: !reader && state.media, embeds: !reader && state.embeds, meta: !reader && state.meta})) {
        root.classList.toggle('qn-' + key + '-visible', visible);
      }
      const media = [state.enabled, reader, state.media, state.embeds].join(':');
      if (lastMedia !== media) { refreshShells(); lastMedia = media; }
      if (reader) updateProgress();
      readerTitle.textContent = state.titleReader || looks.titleReader.value;
      if (!reader || !top) showToc(false);
      for (const [node, open] of [[topEdge, top], [bottomEdge, compose]]) node.firstElementChild.setAttribute('aria-expanded', String(open));
      // The folded composer stays laid out below the screen: keep it out of reach of taps and focus.
      const form = document.getElementById('form_sheld');
      if (form) form.inert = state.enabled && !compose;
      arrangeAll();
      syncSettings();
      holdAnchor(anchor);
      titleUpdate();
      updateFavicons();
      try { window.localStorage.setItem(KEY, JSON.stringify({ ...state, v: 3 })); } catch { /* Session still works. */ }
      // All original form nodes, drafts, event handlers and generation controls remain intact.
    }
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
