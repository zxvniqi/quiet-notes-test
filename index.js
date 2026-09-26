/* Quiet Notes — no network requests; presentation preferences only. */
(() => {
  'use strict';
  const document = window.document;
  const ID = 'qn-controls';
  const KEY = 'quiet-notes.test.v1';
  if (document.getElementById(ID)) return;
  const defaults = { enabled: false, top: false, compose: false, avatars: false, media: false, embeds: true, names: false, actions: true, reader: false, readerTop: false, readerCompose: false, readerTools: false };
  let state = { ...defaults };
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    for (const key of Object.keys(defaults)) if (typeof saved[key] === 'boolean') state[key] = saved[key];
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
    const buttons = {};
    function button(key, text, description, handler) {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = text;
      item.title = description;
      item.setAttribute('aria-label', description);
      item.addEventListener('click', handler);
      buttons[key] = item;
      return item;
    }
    const topButton = button('top', '도구', '상단 도구 열기/접기', () => { const key = state.reader ? 'readerTop' : 'top'; state[key] = !state[key]; apply(); });
    const composeButton = button('compose', '입력', '입력 바 열기/접기', () => {
      const key = state.reader ? 'readerCompose' : 'compose';
      state[key] = !state[key];
      apply();
      // Deliberately do not focus the textarea: avoid opening the phone keyboard.
    });
    const modeButton = button('mode', '일코 OFF', '일코 모드 켜기/끄기', () => { state.enabled = !state.enabled; apply(); });
    modeButton.id = 'qn-mode-toggle';
    const wandToggle = document.createElement('div');
    wandToggle.setAttribute('role', 'button');
    wandToggle.tabIndex = 0;
    wandToggle.title = '일코 모드 켜기/끄기';
    wandToggle.addEventListener('click', () => { state.enabled = !state.enabled; apply(); });
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
    const settingsHost = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    const settingsPanel = document.createElement('details');
    settingsPanel.id = 'qn-settings';
    const settingsSummary = document.createElement('summary');
    settingsSummary.textContent = 'Quiet Notes Test · 테스트';
    const settingsToggle = button('settingsMode', '일코 모드 켜기', '설정에서 일코 모드 켜기/끄기', () => { state.enabled = !state.enabled; apply(); });
    settingsPanel.append(settingsSummary, settingsToggle);
    settingsHost?.append(settingsPanel);
    composeButton.id = 'qn-input-toggle';
    composeButton.setAttribute('aria-controls', 'form_sheld');
    bar.append(topButton, composeButton);
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
    const readerHint = document.createElement('p');
    readerHint.className = 'qn-reader-hint';
    readerHint.textContent = '전자책 모드에서는 이미지·임베드·이름을 모두 숨깁니다. 끄면 이전 보기 설정으로 돌아갑니다.';
    panel.append(readerHint, modeButton);
    details.append(summary, panel);
    bar.append(details);
    document.body.append(bar);
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
          text = labelled ? '' : name.closest('.mes')?.getAttribute('is_user') === 'true' ? '작성' : '메모';
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
    }, {signal: abort.signal});
    document.addEventListener('pointerdown', e => { if (!details.contains(e.target)) details.open = false; }, { signal: abort.signal });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeActions();
      if (e.key === 'Escape' && details.open) { details.open = false; summary.focus(); }
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyM' && !e.repeat) {
        e.preventDefault(); state.enabled = !state.enabled; apply();
      }
    }, { signal: abort.signal });
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
    let currentTitle = '메모';
    function titleUpdate() {
      if (state.enabled) {
        const next = state.reader ? '서재' : '메모';
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
    if (title) titleObserver.observe(title, { childList: true, subtree: true, characterData: true });
    function cleanup() {
      abort.abort();
      titleObserver.disconnect();
      wandObserver.disconnect();
      actionsObserver.disconnect();
      blueObserver.disconnect();
      closeActions();
      bar.remove();
      wandContainer.remove();
      composeButton.remove();
      settingsPanel.remove();
      state.enabled = false;
      refreshShells();
      syncBlue();
      chat?.querySelectorAll('.name_text').forEach(updateName);
      updateFavicons();
      for (const cls of [...root.classList]) if (cls.startsWith('qn-')) root.classList.remove(cls);
      document.getElementById('qn-helper-style')?.remove();
      if (renamedTitle && document.title === currentTitle) document.title = previousTitle;
    }
    window.addEventListener('pagehide', cleanup, { once: true });
    window.addEventListener('unload', cleanup, { once: true });
    let lastNames = null;
    let lastMedia = null;
    function apply() {
      const reader = state.enabled && state.reader;
      const top = state.reader ? state.readerTop : state.top;
      const compose = state.reader ? state.readerCompose : state.compose;
      root.classList.add('qn-installed');
      root.classList.toggle('qn-active', state.enabled);
      root.classList.toggle('qn-actions-fold', state.enabled && (state.actions || state.reader));
      root.classList.toggle('qn-reader', reader);
      root.classList.toggle('qn-reader-tools-visible', reader && state.readerTools);
      syncBlue();
      const names = state.enabled && !state.names;
      if (lastNames !== names) { chat?.querySelectorAll('.name_text').forEach(updateName); lastNames = names; }
      if (!state.enabled || !(state.actions || state.reader) || (reader && !state.readerTools)) closeActions();
      for (const [key, visible] of Object.entries({top, compose, avatars: !reader && state.avatars, media: !reader && state.media, embeds: !reader && state.embeds})) {
        root.classList.toggle('qn-' + key + '-visible', visible);
      }
      const media = [state.enabled, reader, state.media, state.embeds].join(':');
      if (lastMedia !== media) { refreshShells(); lastMedia = media; }
      brand.textContent = reader ? '서재' : 'Note';
      topButton.textContent = reader ? '목차' : '도구';
      composeButton.textContent = reader ? '메모' : '입력';
      summary.textContent = reader ? 'Aa' : '보기';
      summary.setAttribute('aria-label', reader ? '읽기 설정' : '보기');
      readerHint.hidden = !reader;
      topButton.setAttribute('aria-expanded', String(!state.enabled || top));
      composeButton.setAttribute('aria-expanded', String(!state.enabled || compose));
      topButton.disabled = composeButton.disabled = !state.enabled;
      modeButton.textContent = '일코 모드 끄기';
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
      titleUpdate();
      updateFavicons();
      try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* Session still works. */ }
      // All original form nodes, drafts, event handlers and generation controls remain intact.
    }
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
