/* Quiet Notes — no network requests; presentation preferences only. */
(() => {
  'use strict';
  const document = window.document;
  const ID = 'qn-settings';
  const KEY = 'quiet-notes.test.v1';
  const VERSION = '2.8.0-beta.1';
  if (document.getElementById(ID)) return;
  const flags = {
    enabled: false, top: false, compose: false, avatars: false, media: false, embeds: true, names: false, actions: true,
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
    noteSize: { value: 16, min: 12, max: 22, step: 1 }, noteLine: { value: 1.7, min: 1.3, max: 2.2, step: 0.05 },
    noteDivider: { value: 'line', options: ['line', 'short', 'stars', 'none'] },
    paper: { value: 'paper', options: ['paper', 'white', 'sepia', 'gray', 'night'] },
    readerFont: { value: '', font: true },
    readerSize: { value: 15, min: 12, max: 22, step: 1 }, readerLine: { value: 1.7, min: 1.3, max: 2.2, step: 0.05 },
    readerPara: { value: 0.6, min: 0, max: 2, step: 0.1 }, readerMargin: { value: 22, min: 8, max: 56, step: 2 },
    readerAlign: { value: 'left', options: ['left', 'justify'] },
    readerDivider: { value: 'stars', options: ['line', 'short', 'stars', 'none'] },
  };
  const fontName = /^[^;{}<>\\]{0,80}$/;
  let state = { ...flags };
  for (const [key, spec] of Object.entries(looks)) state[key] = spec.value;
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

    // ── Settings: one body, shown in the Extensions tab drawer or moved into the dialog. ──
    const settingsBody = el('div', { className: 'qn-settings-body' });
    const settingsToggle = button('', toggleMode, 'menu_button qn-settings-mode');
    settingsBody.append(settingsToggle);
    const fields = {};
    const labels = {
      top: '위', bottom: '아래', white: '흰색', gray: '회색', dark: '어둡게', line: '선', short: '짧은 선', stars: '별표', none: '없음',
      paper: '종이', sepia: '세피아', night: '야간', left: '왼쪽', justify: '양쪽',
    };
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
    function group(title, rows) {
      const box = el('fieldset', { className: 'qn-settings-group' }, el('legend', { textContent: title }));
      for (const [key, text, unit = ''] of rows) {
        const spec = looks[key];
        const row = el('label', { className: 'qn-settings-row' });
        const name = el('span', { textContent: text });
        let input;
        if (!spec) {
          input = el('input', { type: 'checkbox' });
          input.addEventListener('change', () => { state[key] = input.checked; apply(); });
          row.classList.add('qn-settings-check');
          row.append(input, name);
        } else if (spec.font || spec.options) {
          input = el('select', { className: 'text_pole' });
          if (spec.options) for (const value of spec.options) input.add(new Option(labels[value], value));
          input.addEventListener('change', () => { state[key] = input.value; apply(); });
          row.append(name, input);
        } else if (typeof spec.value === 'number') {
          input = el('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step });
          input.qnOutput = el('output');
          input.qnUnit = unit;
          input.addEventListener('input', () => { state[key] = Number(input.value); apply(); });
          row.append(name, input, input.qnOutput);
        } else {
          input = el('input', { type: 'text', className: 'text_pole', maxLength: spec.max, placeholder: spec.value });
          input.addEventListener('input', () => { state[key] = input.value.trim().slice(0, spec.max); apply(); });
          row.append(name, input);
        }
        box.append(row);
        fields[key] = input;
      }
      settingsBody.append(box);
    }
    group('보기', [['reader', '전자책 모드'], ['avatars', '프로필 사진 표시'], ['media', '본문 이미지·에셋 표시'], ['embeds', '임베드 패널 표시'], ['names', '대화 이름 표시'], ['actions', '메시지 작업 버튼 접기'], ['readerTools', '전자책 편집 도구 표시']]);
    group('공통', [['titleNote', '탭 제목'], ['titleReader', '전자책 탭 제목'], ['nameBot', '캐릭터 이름'], ['nameUser', '유저 이름'], ['toast', '알림 위치']]);
    group('일반 일코', [['noteColor', '색'], ['noteFont', '글꼴'], ['noteType', '글자 크기·줄 간격 직접 지정'], ['noteSize', '글자 크기', 'px'], ['noteLine', '줄 간격'], ['noteDivider', '구분선']]);
    group('전자책', [['paper', '종이'], ['readerFont', '글꼴'], ['readerType', '글자 크기·줄 간격 직접 지정'], ['readerSize', '글자 크기', 'px'], ['readerLine', '줄 간격'], ['readerPara', '문단 간격', 'em'], ['readerIndent', '문단 첫 줄 들여쓰기'], ['readerMargin', '좌우 여백', 'px'], ['readerAlign', '정렬'], ['readerDivider', '구분선']]);
    settingsBody.append(
      button('꾸미기 기본값', () => {
        for (const [key, spec] of Object.entries(looks)) state[key] = spec.value;
        for (const key of ['noteType', 'readerType', 'readerIndent']) state[key] = flags[key];
        apply();
      }, 'menu_button qn-settings-reset'),
      el('small', { className: 'qn-settings-note', textContent: '이 기기에만 저장됩니다.' }),
    );
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

    // ── Dialog (settings) and chooser (wand menu → turn on/off or settings) ──
    const dialogBody = el('div', { className: 'qn-dialog-body' });
    const dialog = el('div', { id: 'qn-dialog', hidden: true },
      el('div', { className: 'qn-dialog-card', role: 'dialog', ariaLabel: 'Quiet Notes 설정' },
        el('div', { className: 'qn-dialog-head' }, el('b', { textContent: 'Quiet Notes' }), button('✕', () => openDialog(false), 'qn-dialog-close')),
        dialogBody));
    function openDialog(open) {
      if (open === !dialog.hidden) return;
      dialog.hidden = !open;
      (open ? dialogBody : drawerContent).append(settingsBody);
      if (open) syncSettings();
    }
    dialog.addEventListener('pointerdown', e => { if (e.target === dialog) openDialog(false); });
    const chooserMode = button('', () => { showChooser(false); toggleMode(); });
    const chooser = el('div', { id: 'qn-chooser', hidden: true }, chooserMode, button('설정', () => { showChooser(false); openDialog(true); }));
    function showChooser(show) { chooser.hidden = !show; }
    document.body.append(dialog, chooser);

    const wandLabel = el('span', { textContent: 'Quiet Notes' });
    const wandToggle = el('div', { id: 'qn-wand-toggle', className: 'list-group-item flex-container flexGap5', tabIndex: 0, title: '일코 모드 · 설정' },
      el('div', { className: 'extensionsMenuExtensionButton fa-fw fa-solid fa-file-lines', ariaHidden: 'true' }), wandLabel);
    wandToggle.setAttribute('role', 'button');
    wandToggle.addEventListener('click', () => showChooser(true));
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
    const progress = el('span', { className: 'qn-progress' });
    function edge(kind) {
      const grip = el('div', { className: 'qn-edge-grip', tabIndex: 0, title: kind === 'top' ? '상단 도구: 아래로 끌어 열기, 위로 끌어 닫기' : '입력 바: 위로 끌어 열기, 아래로 끌어 닫기' });
      grip.setAttribute('role', 'button');
      const key = () => kind === 'top' ? (state.reader ? 'readerTop' : 'top') : (state.reader ? 'readerCompose' : 'compose');
      const set = open => { if (state[key()] !== open) { state[key()] = open; apply(); } };
      let startY = null;
      grip.addEventListener('pointerdown', e => { startY = e.clientY; try { grip.setPointerCapture(e.pointerId); } catch { /* Synthetic events. */ } });
      grip.addEventListener('pointermove', e => {
        if (startY === null || Math.abs(e.clientY - startY) < 16) return;
        set(kind === 'top' ? e.clientY > startY : e.clientY < startY);
        startY = null; // One toggle per drag.
      });
      for (const type of ['pointerup', 'pointercancel']) grip.addEventListener(type, () => { startY = null; });
      grip.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(!state[key()]); }
      });
      return el('div', { className: 'qn-edge qn-edge-' + kind }, grip);
    }
    const topEdge = edge('top');
    const bottomEdge = edge('bottom');
    bottomEdge.append(progress);
    function mountEdges() {
      if (!chat) return;
      if (!state.enabled) { topEdge.remove(); bottomEdge.remove(); return; }
      if (topEdge.nextElementSibling !== chat) chat.before(topEdge);
      if (bottomEdge.previousElementSibling !== chat) chat.after(bottomEdge);
    }

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
        }
      }
      for (const scope of mediaRoots) refreshShells(scope);
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
      if (!chooser.hidden && !chooser.contains(e.target) && !wandContainer.contains(e.target)) showChooser(false);
    }, {signal: abort.signal});
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeActions(); showChooser(false); openDialog(false); }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyM' && !e.repeat) { e.preventDefault(); toggleMode(); }
    }, {signal: abort.signal});
    // E-book footer shows only the reading position, like a reader app's page indicator.
    let progressFrame = 0;
    function updateProgress() {
      progressFrame = 0;
      if (!state.enabled || !state.reader || !chat) return;
      const range = chat.scrollHeight - chat.clientHeight;
      progress.textContent = (range > 0 ? Math.round(chat.scrollTop / range * 100) : 100) + '%';
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
      '--qn-size': () => pick('noteSize', 'readerSize') + 'px', '--qn-line': () => String(pick('noteLine', 'readerLine')),
      '--qn-font': fontValue, '--qn-r-para': () => state.readerPara + 'em', '--qn-r-margin': () => state.readerMargin + 'px',
    };
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
    }
    function syncSettings() {
      const reader = state.enabled && state.reader;
      for (const [key, input] of Object.entries(fields)) {
        if (input.type === 'checkbox') {
          const forced = reader && ['avatars', 'media', 'embeds', 'names'].includes(key);
          input.checked = !forced && state[key];
          input.disabled = forced;
          input.parentElement.hidden = key === 'readerTools' && !state.reader;
          continue;
        }
        if (looks[key].font) { if (input !== document.activeElement) fillFonts(input, state[key]); continue; }
        if (input === document.activeElement && input.type === 'text') continue;
        input.value = String(state[key]);
        if (input.qnOutput) {
          input.qnOutput.textContent = state[key] + input.qnUnit;
          const typed = { noteSize: 'noteType', noteLine: 'noteType', readerSize: 'readerType', readerLine: 'readerType' }[key];
          if (typed) input.disabled = !state[typed];
        }
      }
    }

    function cleanup() {
      abort.abort();
      titleObserver.disconnect();
      wandObserver.disconnect();
      settingsObserver.disconnect();
      actionsObserver.disconnect();
      blueObserver.disconnect();
      closeActions();
      state.enabled = false;
      mountEdges();
      for (const node of [dialog, chooser, wandContainer, settingsPanel]) node.remove();
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
      // elementsFromPoint: the native top bar may lie over the chat while incognito mode is off.
      const y = Math.max(box.top, 0) + 24;
      const mes = document.elementsFromPoint(box.left + box.width / 2, y).find(node => node.closest?.('#chat .mes'))?.closest('#chat .mes');
      return mes ? {mes, offset: mes.getBoundingClientRect().top - box.top} : null;
    }
    function restoreAnchor(anchor) {
      if (!anchor) return;
      if (anchor.bottom) { chat.scrollTop = chat.scrollHeight; return; }
      if (!anchor.mes.isConnected) return;
      chat.scrollTop += anchor.mes.getBoundingClientRect().top - chat.getBoundingClientRect().top - anchor.offset;
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
      for (const [key, visible] of Object.entries({top, compose, avatars: !reader && state.avatars, media: !reader && state.media, embeds: !reader && state.embeds})) {
        root.classList.toggle('qn-' + key + '-visible', visible);
      }
      const media = [state.enabled, reader, state.media, state.embeds].join(':');
      if (lastMedia !== media) { refreshShells(); lastMedia = media; }
      progress.textContent = '';
      if (reader) updateProgress();
      for (const [node, open] of [[topEdge, top], [bottomEdge, compose]]) node.firstElementChild.setAttribute('aria-expanded', String(open));
      const modeText = state.enabled ? '일코 모드 끄기' : '일코 모드 켜기';
      settingsToggle.textContent = chooserMode.textContent = modeText;
      settingsToggle.setAttribute('aria-pressed', String(state.enabled));
      syncSettings();
      restoreAnchor(anchor);
      titleUpdate();
      updateFavicons();
      try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Session still works. */ }
      // All original form nodes, drafts, event handlers and generation controls remain intact.
    }
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
