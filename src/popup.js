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
  const source = sourceFromUrl(tab?.url || '');

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
