const INSTAGRAM_RESERVED_ROUTES = ['p', 'reel', 'reels', 'stories', 'explore', 'tv'];

function normalizeHandle(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function instagramHandleFromPathPart(value) {
  const handle = normalizeHandle(value);
  if (!handle || INSTAGRAM_RESERVED_ROUTES.includes(handle)) return '';
  return handle;
}

function sourceFromInstagramHandle(handle, sourceUrl) {
  const normalized = instagramHandleFromPathPart(handle);
  if (!normalized) {
    return { ok: false, reason: 'Could not find an Instagram profile handle on this page.' };
  }
  return { ok: true, source_type: 'instagram', handle: normalized, source_url: sourceUrl || '' };
}

function instagramHandleFromTitle(title) {
  const text = String(title || '').trim();
  const patterns = [
    /@([a-z0-9._]+)/i,
    /(?:photo|video|post|reel)\s+by\s+([a-z0-9._]+)/i,
    /^([a-z0-9._]+)\s+on\s+Instagram\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const handle = instagramHandleFromPathPart(match?.[1] || '');
    if (handle) return handle;
  }

  return '';
}

function sourceNeedsInstagramPageLookup(urlText) {
  try {
    const url = new URL(urlText);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const firstPart = normalizeHandle(url.pathname.split('/').filter(Boolean)[0] || '');
    return host === 'instagram.com' && INSTAGRAM_RESERVED_ROUTES.includes(firstPart);
  } catch {
    return false;
  }
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
    const handle = instagramHandleFromPathPart(parts[0] || '');
    if (!handle) {
      return { ok: false, reason: 'Open an Instagram profile page, or click the extension after the Instagram post page has loaded.' };
    }
    return sourceFromInstagramHandle(handle, url.toString());
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
  if (Array.isArray(mapping)) {
    return mapping
      .map((value) => {
        const key = normalizeHandle(
          value?.instagram_user_name
          || value?.instagram_username
          || value?.source_username
          || value?.handle
          || value?.username
          || ''
        );
        return key ? [key, value || {}] : null;
      })
      .filter(Boolean);
  }

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

function splitTagList(value) {
  return String(value || '')
    .split(/[,;|\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function slugifyTagLabel(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTagOptionForDraft(tag) {
  const rawName = String(tag?.name || tag?.label || tag?.option || '').trim();
  const match = rawName.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  const name = (match ? match[1] : rawName).trim();
  const slug = String(tag?.slug || match?.[2] || '').trim();
  if (!name || !slug) return null;
  return {
    name,
    slug,
    option: name + ' [' + slug + ']',
  };
}

function tagOptionIndex(tags) {
  const index = new Map();
  for (const tag of (Array.isArray(tags) ? tags : []).map(normalizeTagOptionForDraft).filter(Boolean)) {
    index.set(tag.name.toLowerCase(), tag);
    index.set(tag.slug.toLowerCase(), tag);
  }
  return index;
}

function classifyDraftTags(value, tagOptions, prefix) {
  const index = tagOptionIndex(tagOptions);
  const existing = [];
  const newlyCreated = [];
  const seenExisting = new Set();
  const seenNew = new Set();

  for (const rawTag of splitTagList(value)) {
    const match = rawTag.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
    const label = (match ? match[1] : rawTag).trim();
    const explicitSlug = (match?.[2] || '').trim();
    const expectedSlug = explicitSlug || prefix + slugifyTagLabel(label);
    const option = index.get(expectedSlug.toLowerCase()) || index.get(label.toLowerCase());

    if (option) {
      if (!seenExisting.has(option.slug)) {
        existing.push(option.option);
        seenExisting.add(option.slug);
      }
      continue;
    }

    const newKey = label.toLowerCase();
    if (label && !seenNew.has(newKey)) {
      newlyCreated.push(label);
      seenNew.add(newKey);
    }
  }

  return { existing, newlyCreated };
}

function queryParamsForDraft(source, mappingValue, tagOptions = {}) {
  const params = new URLSearchParams();
  const typeTags = classifyDraftTags(mappingValue.new_type_tags || mappingValue.default_type_tags || '', tagOptions.type_tags, 'type-');
  const areaTags = classifyDraftTags(mappingValue.new_area_tags || mappingValue.default_area_tags || '', tagOptions.area_tags, 'area-');

  params.set('source_url', source.source_url || '');
  params.set('event_venue', mappingValue.event_venue || mappingValue.default_venue || mappingValue.label || '');
  params.set('manual_type_tags', typeTags.existing.join(', '));
  params.set('manual_area_tags', areaTags.existing.join(', '));
  params.set('new_type_tags', typeTags.newlyCreated.join(', '));
  params.set('new_area_tags', areaTags.newlyCreated.join(', '));
  params.set('private_bucket_tag', mappingValue.private_bucket_tag || mappingValue.default_bucket_tag || '#Stuff to Do [hash-stuff-to-do]');
  if (mappingValue.parser_type) params.set('parser_type', mappingValue.parser_type);

  for (const [key, value] of Object.entries(mappingValue.extra_params || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  }

  return params;
}

function manualDraftUrl(formUrl, source, mappingValue, tagOptions = {}) {
  const base = String(formUrl || DEFAULT_FORM_URL).trim() || DEFAULT_FORM_URL;
  const separator = base.includes('?') ? '&' : '?';
  return base + separator + queryParamsForDraft(source, mappingValue, tagOptions).toString();
}
