const formUrlEl = document.getElementById('formUrl');
const syncWebhookUrlEl = document.getElementById('syncWebhookUrl');
const mappingEl = document.getElementById('mapping');
const statusEl = document.getElementById('status');
const saveButton = document.getElementById('saveButton');
const resetButton = document.getElementById('resetButton');
const addVenueButton = document.getElementById('addVenueButton');
const newInstagramUserNameEl = document.getElementById('newInstagramUserName');
const newVenueNameEl = document.getElementById('newVenueName');
const newParserTypeEl = document.getElementById('newParserType');
const newSourceUrlEl = document.getElementById('newSourceUrl');
const newTypeTagsEl = document.getElementById('newTypeTags');
const newAreaTagsEl = document.getElementById('newAreaTags');
const newPrivateBucketTagEl = document.getElementById('newPrivateBucketTag');

function setStatus(message, tone = '') {
  statusEl.textContent = message;
  statusEl.className = 'status ' + tone;
}

function render(mapping, formUrl, syncWebhookUrl) {
  formUrlEl.value = formUrl || DEFAULT_FORM_URL;
  syncWebhookUrlEl.value = syncWebhookUrl || DEFAULT_SYNC_WEBHOOK_URL;
  mappingEl.value = JSON.stringify(mapping || DEFAULT_MAPPING, null, 2);
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

function venuePayloadFromForm() {
  const handle = normalizeHandle(newInstagramUserNameEl.value);
  const venueName = newVenueNameEl.value.trim();
  if (!handle) throw new Error('Instagram username is required.');
  if (!venueName) throw new Error('Venue/org display name is required.');

  return {
    instagram_user_name: handle,
    aliases: [],
    label: venueName,
    parser_type: newParserTypeEl.value.trim() || 'instagram_manual_review',
    source_url: newSourceUrlEl.value.trim() || instagramProfileUrl(handle),
    event_venue: venueName,
    new_type_tags: newTypeTagsEl.value.trim(),
    new_area_tags: newAreaTagsEl.value.trim(),
    private_bucket_tag: newPrivateBucketTagEl.value || '#Stuff to Do [hash-stuff-to-do]',
    extra_params: {}
  };
}

function upsertMappingEntry(mapping, entry) {
  const key = normalizeHandle(entry.instagram_user_name);
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

async function syncVenueToSheet(entry, webhookUrl) {
  const url = String(webhookUrl || '').trim();
  if (!url) return { skipped: true };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  });
  const text = await response.text();
  if (!response.ok) throw new Error('Sheet sync failed ' + response.status + ': ' + text.slice(0, 300));
  return { skipped: false, text };
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
  newTypeTagsEl.value = '';
  newAreaTagsEl.value = '';
  newPrivateBucketTagEl.value = '#Stuff to Do [hash-stuff-to-do]';
}

async function loadOptions() {
  const config = await storageGet({
    formUrl: DEFAULT_FORM_URL,
    syncWebhookUrl: DEFAULT_SYNC_WEBHOOK_URL,
    mapping: DEFAULT_MAPPING
  });
  render(config.mapping, config.formUrl, config.syncWebhookUrl);
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
    syncWebhookUrl: syncWebhookUrlEl.value.trim() || DEFAULT_SYNC_WEBHOOK_URL,
    mapping
  });
  setStatus('Saved.', 'ok');
});

resetButton.addEventListener('click', () => {
  render(DEFAULT_MAPPING, formUrlEl.value.trim() || DEFAULT_FORM_URL, syncWebhookUrlEl.value.trim() || DEFAULT_SYNC_WEBHOOK_URL);
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
    syncWebhookUrl: syncWebhookUrlEl.value.trim() || DEFAULT_SYNC_WEBHOOK_URL,
    mapping
  });

  try {
    const result = await syncVenueToSheet(entry, syncWebhookUrlEl.value.trim() || DEFAULT_SYNC_WEBHOOK_URL);
    clearAddVenueForm();
    setStatus(result.skipped ? 'Added locally. Sheet sync URL is blank, so Google Sheets was not updated.' : 'Added locally and synced to Google Sheets.', result.skipped ? 'warn' : 'ok');
  } catch (error) {
    setStatus('Added locally, but Google Sheets did not sync: ' + error.message, 'warn');
  }
});

newInstagramUserNameEl.addEventListener('input', () => {
  if (!newSourceUrlEl.value.trim()) newSourceUrlEl.placeholder = instagramProfileUrl(newInstagramUserNameEl.value) || 'https://www.instagram.com/examplewpg/';
});

loadOptions();
