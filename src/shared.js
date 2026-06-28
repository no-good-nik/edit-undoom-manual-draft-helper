function normalizeHandle(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function sourceFromUrl(urlText) {
  let url;
  try {
    url = new URL(urlText);
  } catch {
    return { ok: false, reason: 'The active tab does not have a usable URL.' };
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'instagram.com') {
    const handle = normalizeHandle(parts[0] || '');
    if (!handle || ['p', 'reel', 'stories', 'explore'].includes(handle)) {
      return { ok: false, reason: 'Open an Instagram profile page or a post URL that includes the profile handle.' };
    }
    return { ok: true, source_type: 'instagram', handle, source_url: url.toString() };
  }

  if (host === 'facebook.com') {
    const handle = normalizeHandle(parts[0] || '');
    if (!handle || ['events', 'groups', 'marketplace', 'profile.php'].includes(handle)) {
      return { ok: false, reason: 'Open the Facebook page itself, not a generic Facebook route.' };
    }
    return { ok: true, source_type: 'facebook', handle, source_url: url.toString() };
  }

  if (host === 'bandsintown.com') {
    const handle = normalizeHandle(parts[1] || parts[0] || '');
    return { ok: true, source_type: 'bandsintown', handle, source_url: url.toString() };
  }

  return { ok: false, reason: 'This helper supports Instagram, Facebook, and Bandsintown source pages.' };
}

function mappingEntries(mapping) {
  return Object.entries(mapping || {}).map(([key, value]) => [normalizeHandle(key), value || {}]);
}

function findMapping(mapping, handle) {
  const normalized = normalizeHandle(handle);
  for (const [key, value] of mappingEntries(mapping)) {
    const aliases = Array.isArray(value.aliases) ? value.aliases.map(normalizeHandle) : [];
    if (key === normalized || aliases.includes(normalized)) {
      return { key, value };
    }
  }
  return null;
}

function queryParamsForDraft(source, mappingValue) {
  const params = new URLSearchParams();
  params.set('source_url', source.source_url || '');
  params.set('event_venue', mappingValue.event_venue || mappingValue.default_venue || mappingValue.label || '');
  params.set('new_type_tags', mappingValue.new_type_tags || mappingValue.default_type_tags || '');
  params.set('new_area_tags', mappingValue.new_area_tags || mappingValue.default_area_tags || '');
  params.set('private_bucket_tag', mappingValue.private_bucket_tag || mappingValue.default_bucket_tag || '#Stuff to Do [hash-stuff-to-do]');
  if (mappingValue.parser_type) params.set('parser_type', mappingValue.parser_type);

  for (const [key, value] of Object.entries(mappingValue.extra_params || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  }

  return params;
}

function manualDraftUrl(formUrl, source, mappingValue) {
  const base = String(formUrl || DEFAULT_FORM_URL).trim() || DEFAULT_FORM_URL;
  const separator = base.includes('?') ? '&' : '?';
  return base + separator + queryParamsForDraft(source, mappingValue).toString();
}
