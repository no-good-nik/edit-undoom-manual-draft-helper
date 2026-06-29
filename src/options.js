const formUrlEl = document.getElementById('formUrl');
const mappingFeedUrlEl = document.getElementById('mappingFeedUrl');
const tagOptionsUrlEl = document.getElementById('tagOptionsUrl');
const syncWebhookUrlEl = document.getElementById('syncWebhookUrl');
const mappingEl = document.getElementById('mapping');
const statusEl = document.getElementById('status');
const saveButton = document.getElementById('saveButton');
const resetButton = document.getElementById('resetButton');
const addVenueButton = document.getElementById('addVenueButton');
const venueSyncModeEls = Array.from(document.querySelectorAll('input[name="venueSyncMode"]'));
const newInstagramUserNameEl = document.getElementById('newInstagramUserName');
const existingVenueLabelEl = document.getElementById('existingVenueLabel');
const existingVenueKeyEl = document.getElementById('existingVenueKey');
const newVenueNameEl = document.getElementById('newVenueName');
const newParserTypeEl = document.getElementById('newParserType');
const newSourceUrlEl = document.getElementById('newSourceUrl');
const newTypeTagsEl = document.getElementById('newTypeTags');
const newTypeTagsCustomEl = document.getElementById('newTypeTagsCustom');
const newAreaTagsEl = document.getElementById('newAreaTags');
const newAreaTagsCustomEl = document.getElementById('newAreaTagsCustom');
const newPrivateBucketTagEl = document.getElementById('newPrivateBucketTag');
let currentMapping = DEFAULT_MAPPING;

function setStatus(message, tone = '') {
  statusEl.textContent = message;
  statusEl.className = 'status ' + tone;
}

function render(mapping, formUrl, mappingFeedUrl, tagOptionsUrl, syncWebhookUrl) {
  currentMapping = mapping || DEFAULT_MAPPING;
  formUrlEl.value = formUrl || DEFAULT_FORM_URL;
  mappingFeedUrlEl.value = mappingFeedUrl || DEFAULT_MAPPING_FEED_URL;
  tagOptionsUrlEl.value = tagOptionsUrl || DEFAULT_TAG_OPTIONS_URL;
  syncWebhookUrlEl.value = syncWebhookUrl || DEFAULT_SYNC_WEBHOOK_URL;
  mappingEl.value = JSON.stringify(mapping || DEFAULT_MAPPING, null, 2);
  populateExistingVenueSelect(currentMapping);
  updateVenueSyncMode();
}

function instagramProfileUrl(handle) {
  const normalized = normalizeHandle(handle);
  return normalized ? 'https://www.instagram.com/' + normalized + '/' : '';
}

function parseMappingText() {
  try {
    return JSON.parse(mappingEl.value);
  } catch (error) {
    throw new Error('Mapping JSON is not valid: ' + error.message);
  }
}

function selectedMultiSelectValues(selectEl) {
  return Array.from(selectEl.selectedOptions)
    .map((option) => option.value.trim())
    .filter(Boolean)
    .join(', ');
}

function splitList(value) {
  return String(value || '')
    .split(/[,;|\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinUniqueValues(...values) {
  const seen = new Set();
  const joined = [];
  for (const value of values) {
    for (const part of splitList(value)) {
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      joined.push(part);
    }
  }
  return joined.join(', ');
}

function currentVenueSyncMode() {
  return venueSyncModeEls.find((input) => input.checked)?.value || 'new';
}

function mappingEntryKey(entry, index) {
  return normalizeHandle(entry?.instagram_user_name || entry?.handle || entry?.username || '') || 'row-' + index;
}

function mappingArray(mapping) {
  if (Array.isArray(mapping)) return mapping;
  return Object.entries(mapping || {}).map(([key, value]) => ({
    instagram_user_name: key,
    ...(value || {})
  }));
}

function existingVenueOptions(mapping) {
  return mappingArray(mapping)
    .map((entry, index) => ({
      key: mappingEntryKey(entry, index),
      label: entry.label || entry.event_venue || entry.default_venue || entry.venue_name || entry.instagram_user_name || entry.handle || '',
      entry
    }))
    .filter((option) => option.label)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function populateExistingVenueSelect(mapping) {
  const current = existingVenueKeyEl.value;
  existingVenueKeyEl.textContent = '';
  for (const option of existingVenueOptions(mapping)) {
    const optionEl = document.createElement('option');
    optionEl.value = option.key;
    optionEl.textContent = option.label;
    existingVenueKeyEl.append(optionEl);
  }
  if (current && Array.from(existingVenueKeyEl.options).some((option) => option.value === current)) {
    existingVenueKeyEl.value = current;
  }
}

function selectedExistingVenue() {
  const key = existingVenueKeyEl.value;
  return existingVenueOptions(currentMapping).find((option) => option.key === key) || null;
}

function updateVenueSyncMode() {
  const existingMode = currentVenueSyncMode() === 'existing';
  existingVenueLabelEl.hidden = !existingMode;
  newVenueNameEl.closest('label').hidden = existingMode;
  newParserTypeEl.closest('label').hidden = existingMode;
  newTypeTagsEl.closest('label').hidden = existingMode;
  newTypeTagsCustomEl.closest('label').hidden = existingMode;
  newAreaTagsEl.closest('label').hidden = existingMode;
  newAreaTagsCustomEl.closest('label').hidden = existingMode;
  newPrivateBucketTagEl.closest('label').hidden = existingMode;
  addVenueButton.textContent = existingMode ? 'Add Instagram to existing venue + sync sheet' : 'Add locally + sync sheet';
}

function normalizeTagOption(tag) {
  const name = String(tag?.name || tag?.label || tag?.option || '').replace(/\s*\[[^\]]+\]\s*$/, '').trim();
  const slug = String(tag?.slug || '').trim();
  if (!name) return null;
  return {
    name,
    slug,
    option: slug ? name + ' [' + slug + ']' : name
  };
}

function populateMultiSelect(selectEl, tags) {
  const selected = new Set(
    Array.from(selectEl.selectedOptions)
      .flatMap((option) => [option.value, option.dataset.slug])
      .filter(Boolean)
  );
  selectEl.textContent = '';
  for (const tag of tags.map(normalizeTagOption).filter(Boolean)) {
    const option = document.createElement('option');
    option.value = tag.name;
    option.textContent = tag.name;
    if (tag.slug) option.dataset.slug = tag.slug;
    if (selected.has(tag.name) || selected.has(tag.slug)) option.selected = true;
    selectEl.append(option);
  }
}

function populateBucketSelect(selectEl, tags) {
  const currentValue = selectEl.value || '#Stuff to Do [hash-stuff-to-do]';
  const normalizedTags = tags.map(normalizeTagOption).filter(Boolean);
  if (!normalizedTags.length) return;
  selectEl.textContent = '';
  for (const tag of normalizedTags) {
    const option = document.createElement('option');
    option.value = tag.option;
    option.textContent = tag.name;
    if (tag.option === currentValue) option.selected = true;
    selectEl.append(option);
  }
}

async function fetchTagOptions(tagOptionsUrl) {
  const url = String(tagOptionsUrl || '').trim();
  if (!url) return { skipped: true, type_tags: [], area_tags: [], bucket_tags: [] };

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
    bucket_tags: Array.isArray(parsed?.bucket_tags) ? parsed.bucket_tags : []
  };
}

function venuePayloadFromForm() {
  const handle = normalizeHandle(newInstagramUserNameEl.value);
  if (!handle) throw new Error('Instagram username is required.');

  if (currentVenueSyncMode() === 'existing') {
    const existingVenue = selectedExistingVenue();
    if (!existingVenue) throw new Error('Choose an existing venue/org.');
    const entry = existingVenue.entry || {};
    const venueName = existingVenue.label;
    return {
      sync_mode: 'add_instagram_alias',
      instagram_user_name: handle,
      aliases: [handle],
      target_venue_name: venueName,
      label: venueName,
      parser_type: entry.parser_type || '',
      source_url: newSourceUrlEl.value.trim() || instagramProfileUrl(handle),
      event_venue: entry.event_venue || entry.default_venue || venueName,
      new_type_tags: entry.new_type_tags || entry.default_type_tags || '',
      new_area_tags: entry.new_area_tags || entry.default_area_tags || '',
      private_bucket_tag: entry.private_bucket_tag || entry.default_bucket_tag || '#Stuff to Do [hash-stuff-to-do]',
      default_type_tags: entry.default_type_tags || entry.new_type_tags || '',
      default_area_tags: entry.default_area_tags || entry.new_area_tags || '',
      default_bucket_tag: entry.default_bucket_tag || entry.private_bucket_tag || '#Stuff to Do [hash-stuff-to-do]',
      extra_params: entry.extra_params || {}
    };
  }

  const venueName = newVenueNameEl.value.trim();
  if (!venueName) throw new Error('Venue/org display name is required.');
  const typeTags = joinUniqueValues(selectedMultiSelectValues(newTypeTagsEl), newTypeTagsCustomEl.value);
  const areaTags = joinUniqueValues(selectedMultiSelectValues(newAreaTagsEl), newAreaTagsCustomEl.value);

  return {
    instagram_user_name: handle,
    aliases: [],
    label: venueName,
    parser_type: newParserTypeEl.value.trim() || 'instagram_manual_review',
    source_url: newSourceUrlEl.value.trim() || instagramProfileUrl(handle),
    event_venue: venueName,
    new_type_tags: typeTags,
    new_area_tags: areaTags,
    private_bucket_tag: newPrivateBucketTagEl.value || '#Stuff to Do [hash-stuff-to-do]',
    default_type_tags: typeTags,
    default_area_tags: areaTags,
    default_bucket_tag: newPrivateBucketTagEl.value || '#Stuff to Do [hash-stuff-to-do]',
    extra_params: {}
  };
}

function upsertMappingEntry(mapping, entry) {
  const key = normalizeHandle(entry.instagram_user_name);
  if (entry.sync_mode === 'add_instagram_alias') {
    const targetVenue = String(entry.target_venue_name || entry.label || '').toLowerCase();
    const addAlias = (value) => {
      const aliases = Array.isArray(value.aliases) ? value.aliases.map(normalizeHandle).filter(Boolean) : [];
      if (!aliases.includes(key) && normalizeHandle(value.instagram_user_name || value.handle || value.username || '') !== key) aliases.push(key);
      return { ...value, aliases };
    };
    if (Array.isArray(mapping)) {
      return mapping.map((value) => {
        const label = String(value?.label || value?.event_venue || value?.default_venue || value?.venue_name || '').toLowerCase();
        return label === targetVenue ? addAlias(value || {}) : value;
      });
    }
    return Object.fromEntries(Object.entries(mapping || {}).map(([mapKey, value]) => {
      const label = String(value?.label || value?.event_venue || value?.default_venue || value?.venue_name || '').toLowerCase();
      return [mapKey, label === targetVenue ? addAlias(value || {}) : value];
    }));
  }

  if (Array.isArray(mapping)) {
    const next = mapping.slice();
    const index = next.findIndex((item) => normalizeHandle(item?.instagram_user_name || item?.handle || item?.username || '') === key);
    if (index >= 0) next[index] = { ...next[index], ...entry };
    else next.push(entry);
    return next;
  }

  return {
    ...(mapping || {}),
    [key]: {
      ...(mapping?.[key] || {}),
      ...entry
    }
  };
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

async function syncVenueToSheet(entry, webhookUrl) {
  const url = String(webhookUrl || '').trim();
  if (!url) return { skipped: true };
  const body = JSON.stringify(entry);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body
    });
    const text = await response.text();
    if (!response.ok) throw new Error('Sheet sync failed ' + response.status + ': ' + text.slice(0, 300));
    return { skipped: false, verified: true, text };
  } catch (error) {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body
    });
    return { skipped: false, verified: false, warning: error.message };
  }
}

function prefillFromQueryParams() {
  const params = new URLSearchParams(location.search || '');
  const handle = normalizeHandle(params.get('instagram_user_name') || params.get('instagram_username') || params.get('handle') || '');
  if (!handle) return;

  newInstagramUserNameEl.value = handle;
  const sourceUrl = params.get('source_url') || instagramProfileUrl(handle);
  if (sourceUrl && !newSourceUrlEl.value.trim()) newSourceUrlEl.value = sourceUrl;
  setStatus('Prefilled @' + handle + ' from the active Instagram page.', 'ok');
}

function clearAddVenueForm() {
  newInstagramUserNameEl.value = '';
  newVenueNameEl.value = '';
  newParserTypeEl.value = '';
  newSourceUrlEl.value = '';
  for (const option of newTypeTagsEl.options) option.selected = false;
  for (const option of newAreaTagsEl.options) option.selected = false;
  newTypeTagsCustomEl.value = '';
  newAreaTagsCustomEl.value = '';
  newPrivateBucketTagEl.value = '#Stuff to Do [hash-stuff-to-do]';
}

async function loadOptions() {
  const config = await storageGet({
    formUrl: DEFAULT_FORM_URL,
    mappingFeedUrl: DEFAULT_MAPPING_FEED_URL,
    tagOptionsUrl: DEFAULT_TAG_OPTIONS_URL,
    syncWebhookUrl: DEFAULT_SYNC_WEBHOOK_URL,
    mapping: DEFAULT_MAPPING
  });

  let mapping = config.mapping || DEFAULT_MAPPING;
  let loadedFromSheet = false;
  let tagOptionsLoaded = false;
  const warnings = [];
  try {
    const feed = await fetchSheetMapping(config.mappingFeedUrl || DEFAULT_MAPPING_FEED_URL);
    if (!feed.skipped && feed.mapping) {
      mapping = feed.mapping;
      loadedFromSheet = true;
      await storageSet({ mapping });
    }
  } catch (error) {
    warnings.push('Could not load mapping from Google Sheets. Using saved local mapping: ' + error.message);
  }

  render(mapping, config.formUrl, config.mappingFeedUrl, config.tagOptionsUrl, config.syncWebhookUrl);

  try {
    const tagOptions = await fetchTagOptions(config.tagOptionsUrl || DEFAULT_TAG_OPTIONS_URL);
    populateMultiSelect(newTypeTagsEl, tagOptions.type_tags);
    populateMultiSelect(newAreaTagsEl, tagOptions.area_tags);
    populateBucketSelect(newPrivateBucketTagEl, tagOptions.bucket_tags);
    tagOptionsLoaded = !tagOptions.skipped;
  } catch (error) {
    warnings.push('Could not load tag options from Ghost. Tag pickers may be empty: ' + error.message);
  }

  if (warnings.length) setStatus(warnings.join(' '), 'warn');
  else if (loadedFromSheet && tagOptionsLoaded) setStatus('Loaded mapping and tag options.', 'ok');
  else if (loadedFromSheet) setStatus('Loaded mapping from Google Sheets.', 'ok');
  prefillFromQueryParams();
}

saveButton.addEventListener('click', async () => {
  let mapping;
  try {
    mapping = JSON.parse(mappingEl.value);
  } catch (error) {
    setStatus('Mapping JSON is not valid: ' + error.message, 'warn');
    return;
  }

  await storageSet({
    formUrl: formUrlEl.value.trim() || DEFAULT_FORM_URL,
    mappingFeedUrl: mappingFeedUrlEl.value.trim() || DEFAULT_MAPPING_FEED_URL,
    tagOptionsUrl: tagOptionsUrlEl.value.trim() || DEFAULT_TAG_OPTIONS_URL,
    syncWebhookUrl: syncWebhookUrlEl.value.trim() || DEFAULT_SYNC_WEBHOOK_URL,
    mapping
  });
  setStatus('Saved.', 'ok');
});

resetButton.addEventListener('click', () => {
  render(
    DEFAULT_MAPPING,
    formUrlEl.value.trim() || DEFAULT_FORM_URL,
    mappingFeedUrlEl.value.trim() || DEFAULT_MAPPING_FEED_URL,
    tagOptionsUrlEl.value.trim() || DEFAULT_TAG_OPTIONS_URL,
    syncWebhookUrlEl.value.trim() || DEFAULT_SYNC_WEBHOOK_URL
  );
  setStatus('Sample mapping restored. Click Save to keep it.', 'warn');
});

addVenueButton.addEventListener('click', async () => {
  let entry;
  let mapping;
  try {
    entry = venuePayloadFromForm();
    mapping = upsertMappingEntry(parseMappingText(), entry);
  } catch (error) {
    setStatus(error.message, 'warn');
    return;
  }

  mappingEl.value = JSON.stringify(mapping, null, 2);
  await storageSet({
    formUrl: formUrlEl.value.trim() || DEFAULT_FORM_URL,
    mappingFeedUrl: mappingFeedUrlEl.value.trim() || DEFAULT_MAPPING_FEED_URL,
    tagOptionsUrl: tagOptionsUrlEl.value.trim() || DEFAULT_TAG_OPTIONS_URL,
    syncWebhookUrl: syncWebhookUrlEl.value.trim() || DEFAULT_SYNC_WEBHOOK_URL,
    mapping
  });

  try {
    const result = await syncVenueToSheet(entry, syncWebhookUrlEl.value.trim() || DEFAULT_SYNC_WEBHOOK_URL);
    clearAddVenueForm();
    setStatus(result.skipped
      ? 'Added locally. Sheet sync URL is blank, so Google Sheets was not updated.'
      : result.verified
        ? 'Added locally and synced to Google Sheets.'
        : 'Added locally and sent to the Google Sheets webhook. Browser CORS blocked confirmation, so check the sheet if you need to verify it landed.',
      result.skipped || !result.verified ? 'warn' : 'ok');
  } catch (error) {
    setStatus('Added locally, but Google Sheets did not sync: ' + error.message, 'warn');
  }
});

newInstagramUserNameEl.addEventListener('input', () => {
  if (!newSourceUrlEl.value.trim()) newSourceUrlEl.placeholder = instagramProfileUrl(newInstagramUserNameEl.value) || 'https://www.instagram.com/examplewpg/';
});

for (const input of venueSyncModeEls) {
  input.addEventListener('change', updateVenueSyncMode);
}

loadOptions();
