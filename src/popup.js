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

  const authorSelectors = [
    'article header a[href]',
    'article a[href]',
    'main a[href]',
    'header a[href]',
    'a[role="link"][href]',
    'a[href^="/"]'
  ];
  const linkedHandles = Array.from(document.querySelectorAll(authorSelectors.join(',')))
    .map((link) => ({
      handle: handleFromHref(link.getAttribute('href')),
      text: clean(link.textContent),
      aria: clean(link.getAttribute('aria-label'))
    }))
    .filter((entry) => entry.handle);

  const exactTextHandle = linkedHandles
    .find((entry) => entry.text === entry.handle || entry.aria === entry.handle)?.handle;
  if (exactTextHandle) return exactTextHandle;

  if (linkedHandles[0]?.handle) return linkedHandles[0].handle;

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

  const titleHandle = instagramHandleFromTitle(tab?.title || '');
  if (titleHandle) return sourceFromInstagramHandle(titleHandle, tab.url);

  const handle = await executeActiveTabFunction(tab.id, extractInstagramHandleFromDocument);
  if (!handle) {
    return { ok: false, reason: 'Could not read the Instagram username from this post. Try waiting for the post to fully load, then click the extension again.' };
  }

  return sourceFromInstagramHandle(handle, tab.url);
}

function openOptionsForActiveSource() {
  if (activeSource?.source_type !== 'instagram' || !activeSource.handle) {
    openOptionsPage();
    return;
  }

  const params = new URLSearchParams();
  params.set('instagram_user_name', activeSource.handle);
  if (activeSource.source_url) params.set('source_url', activeSource.source_url);
  openOptionsPage(params.toString());
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

async function fetchSheetMapping(feedUrl) {
  const url = String(feedUrl || '').trim();
  if (!url) return { skipped: true, mapping: null };

  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error('Sheet mapping fetch failed ' + response.status + ': ' + text.slice(0, 300));

  let parsed;
  try { parsed = text ? JSON.parse(text) : null; }
  catch (error) { throw new Error('Sheet mapping response was not JSON: ' + error.message); }

  const mapping = Array.isArray(parsed) ? parsed : parsed?.mapping;
  if (!Array.isArray(mapping)) throw new Error('Sheet mapping response did not include a mapping array.');
  return { skipped: false, mapping, count: parsed?.count ?? mapping.length };
}

async function init() {
  optionsButton.addEventListener('click', openOptionsForActiveSource);
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
    mappingFeedUrl: DEFAULT_MAPPING_FEED_URL,
    mapping: DEFAULT_MAPPING
  });
  activeFormUrl = config.formUrl || DEFAULT_FORM_URL;
  let mapping = config.mapping || DEFAULT_MAPPING;
  let mappingWarning = '';

  try {
    const feed = await fetchSheetMapping(config.mappingFeedUrl || DEFAULT_MAPPING_FEED_URL);
    if (!feed.skipped && feed.mapping) {
      mapping = feed.mapping;
      await storageSet({ mapping });
    }
  } catch (error) {
    mappingWarning = ' Could not refresh Google Sheets mapping: ' + error.message;
  }

  const match = findMapping(mapping, source.handle);

  if (!match) {
    setStatus(`No mapping found for @${source.handle}. Add it in Options.` + mappingWarning, 'warn');
    sourceButton.disabled = false;
    activeSource = source;
    return;
  }

  setStatus(mappingWarning ? 'Ready to create a manual draft.' + mappingWarning : 'Ready to create a manual draft.', mappingWarning ? 'warn' : 'ok');
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
