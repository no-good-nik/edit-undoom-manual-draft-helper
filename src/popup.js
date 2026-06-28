const statusEl = document.getElementById('status');
const detailsEl = document.getElementById('details');
const sourceValueEl = document.getElementById('sourceValue');
const venueValueEl = document.getElementById('venueValue');
const typeTagsValueEl = document.getElementById('typeTagsValue');
const areaTagsValueEl = document.getElementById('areaTagsValue');
const draftButton = document.getElementById('draftButton');
const sourceButton = document.getElementById('sourceButton');
const optionsButton = document.getElementById('optionsButton');

let activeSource = null;
let activeMapping = null;
let activeFormUrl = DEFAULT_FORM_URL;

function setStatus(message, tone = '') {
  statusEl.textContent = message;
  statusEl.className = 'status ' + tone;
}

function extractInstagramHandleFromDocument() {
  const reserved = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts', 'direct']);
  const clean = (value) => String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
  const handleFromHref = (href) => {
    try {
      const url = new URL(href, location.href);
      if (!/(^|\.)instagram\.com$/i.test(url.hostname.replace(/^www\./, ''))) return '';
      const part = clean(url.pathname.split('/').filter(Boolean)[0] || '');
      return part && !reserved.has(part) ? part : '';
    } catch {
      return '';
    }
  };

  const articleHeaderHandle = Array.from(document.querySelectorAll('article header a[href], article a[href], main a[href]'))
    .map((link) => handleFromHref(link.getAttribute('href')))
    .find(Boolean);
  if (articleHeaderHandle) return articleHeaderHandle;

  const metaUrlHandle = Array.from(document.querySelectorAll('meta[property="og:url"], link[rel="canonical"]'))
    .map((node) => handleFromHref(node.getAttribute('content') || node.getAttribute('href')))
    .find(Boolean);
  if (metaUrlHandle) return metaUrlHandle;

  const text = document.documentElement.innerHTML || '';
  const usernameMatch = text.match(/"owner"\s*:\s*\{[^}]*"username"\s*:\s*"([^"\\]+)"/)
    || text.match(/"username"\s*:\s*"([^"\\]+)"/);
  const username = clean(usernameMatch?.[1] || '');
  return username && !reserved.has(username) ? username : '';
}

async function sourceFromActiveTab(tab) {
  const source = sourceFromUrl(tab?.url || '');
  if (source.ok || !sourceNeedsInstagramPageLookup(tab?.url || '')) return source;

  const handle = await executeActiveTabFunction(tab.id, extractInstagramHandleFromDocument);
  if (!handle) {
    return { ok: false, reason: 'Could not read the Instagram username from this post. Try waiting for the post to fully load, then click the extension again.' };
  }

  return sourceFromInstagramHandle(handle, tab.url);
}

function renderMatch(source, mapping) {
  activeSource = source;
  activeMapping = mapping;

  sourceValueEl.textContent = `${source.source_type}: @${source.handle}`;
  venueValueEl.textContent = mapping.label || mapping.event_venue || mapping.default_venue || '(unnamed)';
  typeTagsValueEl.textContent = mapping.new_type_tags || mapping.default_type_tags || '-';
  areaTagsValueEl.textContent = mapping.new_area_tags || mapping.default_area_tags || '-';
  detailsEl.hidden = false;
  draftButton.disabled = false;
  sourceButton.disabled = false;
}

async function init() {
  optionsButton.addEventListener('click', openOptionsPage);
  const tab = await queryActiveTab();
  const source = await sourceFromActiveTab(tab);

  if (!source.ok) {
    setStatus(source.reason, 'warn');
    draftButton.disabled = true;
    sourceButton.disabled = !tab?.url;
    activeSource = tab?.url ? { source_url: tab.url } : null;
    return;
  }

  const config = await storageGet({
    formUrl: DEFAULT_FORM_URL,
    mapping: DEFAULT_MAPPING
  });
  activeFormUrl = config.formUrl || DEFAULT_FORM_URL;
  const match = findMapping(config.mapping, source.handle);

  if (!match) {
    setStatus(`No mapping found for @${source.handle}. Add it in Options.`, 'warn');
    sourceButton.disabled = false;
    activeSource = source;
    return;
  }

  setStatus('Ready to create a manual draft.', 'ok');
  renderMatch(source, match.value);
}

draftButton.addEventListener('click', async () => {
  if (!activeSource || !activeMapping) return;
  await createTab(manualDraftUrl(activeFormUrl, activeSource, activeMapping));
});

sourceButton.addEventListener('click', async () => {
  if (!activeSource?.source_url) return;
  await createTab(activeSource.source_url);
});

init();
