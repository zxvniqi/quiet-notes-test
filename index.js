/* Quiet Notes — no network requests; presentation preferences only. */
(() => {
  'use strict';
  const document = window.document;
  const ID = 'qn-controls';
  const KEY = 'quiet-notes.test.v1';
  if (document.getElementById(ID)) return;
  const defaults = { enabled: false, top: false, compose: false, avatars: false, media: false, embeds: true, names: false, actions: true, reader: false, readerTop: false, readerCompose: false, readerTools: false };
  // Look customisation. Stored per device with the mode flags.
  const looks = {
    titleNote: { value: '메모', max: 20 }, titleReader: { value: '서재', max: 20 },
    nameBot: { value: '메모', max: 12 }, nameUser: { value: '작성', max: 12 },
    toast: { value: 'top', options: ['top', 'bottom'] },
    noteColor: { value: 'white', options: ['white', 'gray', 'dark'] },
    noteSize: { value: 16, min: 12, max: 22, step: 1 }, noteLine: { value: 1.75, min: 1.3, max: 2.2, step: 0.05 },
    noteDivider: { value: 'line', options: ['line', 'short', 'stars', 'none'] },
    paper: { value: 'paper', options: ['paper', 'white', 'sepia', 'gray', 'night'] },
    readerSize: { value: 15, min: 12, max: 22, step: 1 }, readerLine: { value: 1.7, min: 1.3, max: 2.2, step: 0.05 },
    readerPara: { value: 0.8, min: 0, max: 2, step: 0.1 }, readerMargin: { value: 22, min: 8, max: 56, step: 2 },
    readerAlign: { value: 'left', options: ['left', 'justify'] },
    readerDivider: { value: 'stars', options: ['line', 'short', 'stars', 'none'] },
  };
  let state = { ...defaults };
  for (const [key, spec] of Object.entries(looks)) state[key] = spec.value;
  function valid(key, value) {
    const spec = looks[key];
    if (spec.options) return spec.options.includes(value);
    if (typeof spec.value === 'number') return typeof value === 'number' && value >= spec.min && value <= spec.max;
    return typeof value === 'string' && value.length <= spec.max;
  }
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    for (const key of Object.keys(defaults)) if (typeof saved[key] === 'boolean') state[key] = saved[key];
    for (const key of Object.keys(looks)) if (valid(key, saved[key])) state[key] = saved[key];
  } catch { /* Storage may be unavailable in private browsing. */ }
  // Apply the saved mode as soon as this module loads, before constructing controls.
  document.documentElement.classList.toggle('qn-active', state.enabled);

  function boot() {
    if (document.getElementById(ID)) return;
    const root = document.documentElement;
    const abort = new AbortController();
    const bar = document.createElement('nav');
    bar.id = ID;
    bar.setAttribute('aria-label', '화면 표시');
    const brand = document.createElement('span');
    brand.className = 'qn-brand';
    brand.textContent = 'Note';
    bar.append(brand);
    function button(text, description, handler) {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = text;
      item.title = description;
      item.setAttribute('aria-label', description);
      item.addEventListener('click', handler);
      return item;
    }
    const toggleMode = () => { state.enabled = !state.enabled; apply(); };
    const topButton = button('도구', '상단 도구 열기/접기', () => { const key = state.reader ? 'readerTop' : 'top'; state[key] = !state[key]; apply(); });
    // Deliberately do not focus the textarea: avoid opening the phone keyboard.
    const composeButton = button('입력', '입력 바 열기/접기', () => { const key = state.reader ? 'readerCompose' : 'compose'; state[key] = !state[key]; apply(); });
    composeButton.id = 'qn-input-toggle';
    composeButton.setAttribute('aria-controls', 'form_sheld');
    const modeButton = button('일코 모드 끄기', '일코 모드 끄기', toggleMode);
    modeButton.id = 'qn-mode-toggle';
    // Header tools stay behind a small ··· in both modes; outside click or Escape folds them.
    const moreButton = button('···', '메뉴 펼치기/접기', () => setMenu(!bar.classList.contains('qn-menu-open')));
    moreButton.className = 'qn-more';

    const wandToggle = document.createElement('div');
    wandToggle.setAttribute('role', 'button');
    wandToggle.tabIndex = 0;
    wandToggle.title = '일코 모드 켜기/끄기';
    wandToggle.addEventListener('click', toggleMode);
    wandToggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wandToggle.click(); }
    });
    wandToggle.id = 'qn-wand-toggle';
    wandToggle.className = 'list-group-item flex-container flexGap5';
    const wandIcon = document.createElement('div');
    wandIcon.className = 'extensionsMenuExtensionButton fa-fw fa-solid fa-file-lines';
    wandIcon.setAttribute('aria-hidden', 'true');
    const wandLabel = document.createElement('span');
    wandToggle.replaceChildren(wandIcon, wandLabel);
    const wandContainer = document.createElement('div');
    wandContainer.id = 'qn-wand-container';
    wandContainer.className = 'extension_container';
    wandContainer.append(wandToggle);
    function mountWand() {
      const menu = document.getElementById('extensionsMenu');
      if (!menu) return false;
      if (wandContainer.parentElement !== menu) menu.append(wandContainer);
      return true;
    }
    const wandObserver = new MutationObserver(() => { if (mountWand()) wandObserver.disconnect(); });
    if (!mountWand()) wandObserver.observe(document.body, {childList: true, subtree: true});

    const details = document.createElement('details');
    details.id = 'qn-options';
    const summary = document.createElement('summary');
    summary.textContent = '보기';
    summary.title = '이미지와 화면 표시 설정';
    const panel = document.createElement('div');
    panel.className = 'qn-panel';
    const toggles = {};
    for (const [key, text] of [
      ['avatars', '프로필 사진 표시'], ['media', '본문 이미지·에셋 표시'],
      ['embeds', '임베드 패널 표시'], ['names', '대화 이름 표시'],
      ['actions', '메시지 작업 버튼 접기'], ['reader', '전자책 모드'],
      ['readerTools', '전자책 편집 도구 표시'],
    ]) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => { state[key] = input.checked; apply(); });
      label.append(input, document.createTextNode(text));
      panel.append(label);
      toggles[key] = input;
    }
    panel.append(modeButton);
    details.append(summary, panel);
    bar.append(topButton, composeButton, details, moreButton);
    document.body.append(bar);
    function setMenu(open) {
      bar.classList.toggle('qn-menu-open', open);
      moreButton.setAttribute('aria-expanded', String(open));
      if (!open) details.open = false;
    }

    // Extension settings drawer: on/off plus look customisation (this device only).
    const settingsPanel = document.createElement('div');
    settingsPanel.id = 'qn-settings';
    settingsPanel.className = 'inline-drawer';
    settingsPanel.innerHTML = '<div class="inline-drawer-toggle inline-drawer-header"><b>Quiet Notes Test</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"></div>';
    const settingsBody = settingsPanel.querySelector('.inline-drawer-content');
    const settingsToggle = button('일코 모드 켜기', '일코 모드 켜기/끄기', toggleMode);
    settingsToggle.className = 'menu_button qn-settings-mode';
    const note = document.createElement('small');
    note.className = 'qn-settings-note';
    note.textContent = '꾸미기 설정은 이 기기에만 저장됩니다.';
    settingsBody.append(settingsToggle, note);
    const fields = {};
    const labels = {
      top: '위', bottom: '아래', white: '흰색', gray: '회색', dark: '어둡게', line: '선', short: '짧은 선', stars: '별표', none: '없음',
      paper: '종이', sepia: '세피아', night: '야간', left: '왼쪽', justify: '양쪽',
    };
    function group(title, rows) {
      const box = document.createElement('fieldset');
      box.className = 'qn-settings-group';
      const legend = document.createElement('legend');
      legend.textContent = title;
      box.append(legend);
      for (const [key, text, unit = ''] of rows) {
        const spec = looks[key];
        const row = document.createElement('label');
        row.className = 'qn-settings-row';
        const name = document.createElement('span');
        name.textContent = text;
        let input;
        if (spec.options) {
          input = document.createElement('select');
          input.className = 'text_pole';
          for (const value of spec.options) input.add(new Option(labels[value], value));
          input.addEventListener('change', () => { state[key] = input.value; apply(); });
        } else if (typeof spec.value === 'number') {
          input = document.createElement('input');
          Object.assign(input, { type: 'range', min: spec.min, max: spec.max, step: spec.step });
          const out = document.createElement('output');
          input.addEventListener('input', () => { state[key] = Number(input.value); apply(); });
          input.qnOutput = out;
          input.qnUnit = unit;
          row.append(name, input, out);
          box.append(row);
          fields[key] = input;
          continue;
        } else {
          input = document.createElement('input');
          Object.assign(input, { type: 'text', className: 'text_pole', maxLength: spec.max, placeholder: spec.value });
          input.addEventListener('input', () => { state[key] = input.value.trim().slice(0, spec.max); apply(); });
        }
        row.append(name, input);
        box.append(row);
        fields[key] = input;
      }
      settingsBody.append(box);
    }
    group('공통', [['titleNote', '탭 제목'], ['titleReader', '전자책 탭 제목'], ['nameBot', '캐릭터 이름'], ['nameUser', '유저 이름'], ['toast', '알림 위치']]);
    group('일반 일코', [['noteColor', '색'], ['noteSize', '글자 크기', 'px'], ['noteLine', '줄 간격'], ['noteDivider', '구분선']]);
    group('전자책', [['paper', '종이'], ['readerSize', '글자 크기', 'px'], ['readerLine', '줄 간격'], ['readerPara', '문단 간격', 'em'], ['readerMargin', '좌우 여백', 'px'], ['readerAlign', '정렬'], ['readerDivider', '구분선']]);
    const resetButton = button('꾸미기 기본값', '꾸미기 설정을 기본값으로', () => {
      for (const [key, spec] of Object.entries(looks)) state[key] = spec.value;
      apply();
    });
    resetButton.className = 'menu_button qn-settings-reset';
    settingsBody.append(resetButton);
    function mountSettings() {
      const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
      if (!host) return false;
      if (settingsPanel.parentElement !== host) host.append(settingsPanel);
      return true;
    }
    const settingsObserver = new MutationObserver(() => { if (mountSettings()) settingsObserver.disconnect(); });
    if (!mountSettings()) settingsObserver.observe(document.body, {childList: true, subtree: true});

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
    const chat = document.getElementById('chat');
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
      if (!details.contains(e.target)) details.open = false;
      if (!bar.contains(e.target)) setMenu(false);
    }, {signal: abort.signal});
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeActions();
      if (e.key === 'Escape' && details.open) { details.open = false; summary.focus(); }
      else if (e.key === 'Escape' && bar.classList.contains('qn-menu-open')) { setMenu(false); moreButton.focus(); }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyM' && !e.repeat) { e.preventDefault(); toggleMode(); }
    }, {signal: abort.signal});
    // E-book header shows only the reading position, like a reader app's page indicator.
    let progressFrame = 0;
    function updateProgress() {
      progressFrame = 0;
      if (!state.enabled || !state.reader || !chat) return;
      const range = chat.scrollHeight - chat.clientHeight;
      brand.textContent = (range > 0 ? Math.round(chat.scrollTop / range * 100) : 100) + '%';
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

    // Look variables live on <html> only while incognito mode is on.
    const lookVars = {
      '--qn-n-size': () => state.noteSize + 'px', '--qn-n-line': () => String(state.noteLine),
      '--qn-r-size': () => state.readerSize + 'px', '--qn-r-line': () => String(state.readerLine),
      '--qn-r-para': () => state.readerPara + 'em', '--qn-r-margin': () => state.readerMargin + 'px',
    };
    const lookAttrs = {
      'data-qn-note': () => state.noteColor, 'data-qn-paper': () => state.paper, 'data-qn-toast': () => state.toast,
      'data-qn-divider': () => state.reader ? state.readerDivider : state.noteDivider, 'data-qn-align': () => state.readerAlign,
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
      for (const [key, input] of Object.entries(fields)) {
        if (input === document.activeElement && input.type === 'text') continue;
        input.value = String(state[key]);
        if (input.qnOutput) input.qnOutput.textContent = state[key] + input.qnUnit;
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
      bar.remove();
      wandContainer.remove();
      settingsPanel.remove();
      state.enabled = false;
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
      syncBlue();
      const names = [state.enabled && !state.names, state.nameBot, state.nameUser].join('\n');
      if (lastNames !== names) { chat?.querySelectorAll('.name_text').forEach(updateName); lastNames = names; }
      if (!state.enabled || !(state.actions || state.reader) || (reader && !state.readerTools)) closeActions();
      for (const [key, visible] of Object.entries({top, compose, avatars: !reader && state.avatars, media: !reader && state.media, embeds: !reader && state.embeds})) {
        root.classList.toggle('qn-' + key + '-visible', visible);
      }
      const media = [state.enabled, reader, state.media, state.embeds].join(':');
      if (lastMedia !== media) { refreshShells(); lastMedia = media; }
      brand.textContent = 'Note';
      if (reader) updateProgress();
      if (!state.enabled) setMenu(false);
      topButton.textContent = reader ? '목차' : '도구';
      composeButton.textContent = reader ? '메모' : '입력';
      summary.textContent = reader ? 'Aa' : '보기';
      summary.setAttribute('aria-label', reader ? '읽기 설정' : '보기');
      topButton.setAttribute('aria-expanded', String(!state.enabled || top));
      composeButton.setAttribute('aria-expanded', String(!state.enabled || compose));
      topButton.disabled = composeButton.disabled = !state.enabled;
      modeButton.setAttribute('aria-pressed', String(state.enabled));
      wandLabel.textContent = state.enabled ? '일코 모드 끄기' : '일코 모드 켜기';
      wandToggle.setAttribute('aria-pressed', String(state.enabled));
      settingsToggle.textContent = state.enabled ? '일코 모드 끄기' : '일코 모드 켜기';
      settingsToggle.setAttribute('aria-pressed', String(state.enabled));
      for (const [key, input] of Object.entries(toggles)) {
        const forced = reader && ['avatars', 'media', 'embeds', 'names'].includes(key);
        input.checked = !forced && state[key];
        input.disabled = forced;
        input.parentElement.hidden = key === 'readerTools' && !reader;
      }
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
