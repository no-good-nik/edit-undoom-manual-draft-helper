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
let activeTagOptions = { type_tags: [], area_tags: [] };

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
  const isVisible = (element) => {
    if (!element || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0;
  };
  const visibleDialogs = Array.from(document.querySelectorAll('[role="dialog"], div[aria-modal="true"]'))
    .filter(isVisible);
  const scopedRoots = [
    ...visibleDialogs,
    ...visibleDialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll('article')).filter(isVisible)),
    ...Array.from(document.querySelectorAll('main article')).filter(isVisible),
    document
  ];

  const authorSelectors = [
    'article header a[href]',
    'header a[href]',
    'a[role="link"][href]',
    'article a[href]'
  ];

  const candidates = [];
  scopedRoots.forEach((root, rootIndex) => {
    Array.from(root.querySelectorAll(authorSelectors.join(','))).forEach((link, linkIndex) => {
      if (!isVisible(link)) return;
      const handle = handleFromHref(link.getAttribute('href'));
      if (!handle) return;
      const text = clean(link.textContent);
      const aria = clean(link.getAttribute('aria-label'));
      const inDialog = visibleDialogs.some((dialog) => dialog.contains(link));
      const inArticleHeader = Boolean(link.closest('article header'));
      const exactText = text === handle || aria === handle;
      candidates.push({
        handle,
        score:
          (inDialog ? 1000 : 0)
          + (inArticleHeader ? 200 : 0)
          + (exactText ? 100 : 0)
          - rootIndex
          - (linkIndex / 1000)
      });
    });
  });

  const linkedHandles = candidates
    .sort((a, b) => b.score - a.score)
    .filter((entry) => entry.handle);

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

function extractInstagramPostImageFromDocument() {
  const imageUrlFromValue = (value) => {
    const text = String(value || '').trim();
    if (!text || text.startsWith('data:') || text.startsWith('blob:')) return '';
    try {
      return new URL(text, location.href).toString();
    } catch {
      return '';
    }
  };
  const isVisible = (element) => {
    if (!element || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0;
  };
  const visibleDialogs = Array.from(document.querySelectorAll('[role="dialog"], div[aria-modal="true"]'))
    .filter(isVisible);
  const scopedRoots = [
    ...visibleDialogs,
    ...visibleDialogs.flatMap((dialog) => Array.from(dialog.querySelectorAll('article')).filter(isVisible)),
    ...Array.from(document.querySelectorAll('main article')).filter(isVisible),
    document
  ];
  const candidates = [];

  scopedRoots.forEach((root, rootIndex) => {
    Array.from(root.querySelectorAll('img[src], img[srcset]')).forEach((image, imageIndex) => {
      if (!isVisible(image)) return;
      const rect = image.getBoundingClientRect();
      const src = imageUrlFromValue(image.currentSrc || image.src);
      if (!src) return;
      const alt = String(image.alt || '').toLowerCase();
      const role = String(image.getAttribute('role') || '').toLowerCase();
      const insideHeader = Boolean(image.closest('header'));
      const likelyAvatar = insideHeader || /profile picture|avatar/.test(alt) || rect.width < 180 || rect.height < 180;
      if (likelyAvatar) return;
      const inDialog = visibleDialogs.some((dialog) => dialog.contains(image));
      candidates.push({
        src,
        score:
          (rect.width * rect.height)
          + (inDialog ? 1000000 : 0)
          + (role === 'presentation' ? 5000 : 0)
          - (rootIndex * 100)
          - imageIndex
      });
    });
  });

  const visibleImage = candidates.sort((a, b) => b.score - a.score)[0]?.src;
  if (visibleImage) return visibleImage;

  return Array.from(document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]'))
    .map((node) => imageUrlFromValue(node.getAttribute('content')))
    .find(Boolean) || '';
}

async function sourceFromActiveTab(tab) {
  const url = tab?.url || '';
  const source = sourceFromUrl(url);
  const attachInstagramImage = async (value) => {
    if (!value.ok || value.source_type !== 'instagram' || !sourceNeedsInstagramPageLookup(url)) return value;
    const imageUrl = await executeActiveTabFunction(tab.id, extractInstagramPostImageFromDocument);
    return imageUrl ? { ...value, image_url: imageUrl } : value;
  };
  if (source.ok || !sourceNeedsInstagramPageLookup(url)) return await attachInstagramImage(source);

  const titleHandle = instagramHandleFromTitle(tab?.title || '');
  if (titleHandle) return await attachInstagramImage(sourceFromInstagramHandle(titleHandle, tab.url));

  const handle = await executeActiveTabFunction(tab.id, extractInstagramHandleFromDocument);
  if (!handle) {
    return { ok: false, reason: 'Could not read the Instagram username from this post. Try waiting for the post to fully load, then click the extension again.' };
  }

  return await attachInstagramImage(sourceFromInstagramHandle(handle, tab.url));
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

async function fetchTagOptions(tagOptionsUrl) {
  const url = String(tagOptionsUrl || '').trim();
  if (!url) return { skipped: true, type_tags: [], area_tags: [] };

  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error('Ghost tag options fetch failed ' + response.status + ': ' + text.slice(0, 300));

  let parsed;
  try { parsed = text ? JSON.parse(text) : null; }
  catch (error) { throw new Error('Ghost tag options response was not JSON: ' + error.message); }

  return {
    skipped: false,
    type_tags: Array.isArray(parsed?.type_tags) ? parsed.type_tags : [],
    area_tags: Array.isArray(parsed?.area_tags) ? parsed.area_tags : [],
  };
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
    tagOptionsUrl: DEFAULT_TAG_OPTIONS_URL,
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

  try {
    const tagOptions = await fetchTagOptions(config.tagOptionsUrl || DEFAULT_TAG_OPTIONS_URL);
    activeTagOptions = tagOptions.skipped ? { type_tags: [], area_tags: [] } : tagOptions;
  } catch (error) {
    mappingWarning += ' Could not refresh Ghost tag options: ' + error.message;
    activeTagOptions = { type_tags: [], area_tags: [] };
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
  await createTab(manualDraftUrl(activeFormUrl, activeSource, activeMapping, activeTagOptions));
});

sourceButton.addEventListener('click', async () => {
  if (!activeSource?.source_url) return;
  await createTab(activeSource.source_url);
});

init();
