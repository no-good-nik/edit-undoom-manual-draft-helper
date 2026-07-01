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

function joinTagLabels(tags) {
  const seen = new Set();
  const labels = [];
  for (const tag of tags) {
    const name = String(tag?.name || tag || '').trim();
    const key = String(tag?.slug || name).toLowerCase();
    if (!name || seen.has(key)) continue;
    labels.push(name);
    seen.add(key);
  }
  return labels.join(', ');
}

function inferTagsFromText(value) {
  const text = String(value || '');
  const tags = [];
  const add = (pattern, tag) => {
    if (pattern.test(text)) tags.push(tag);
  };

  add(/\bimprov\b/i, { name: 'Improv', slug: 'type-improv' });
  add(/\bcomedy\b/i, { name: 'Comedy', slug: 'type-comedy' });
  add(/\b(?:board games?|game|chess)\b/i, { name: 'Board Games', slug: 'type-board-games' });
  add(/\bonline\s+games?\b/i, { name: 'Online Games', slug: 'type-online-games' });
  add(/\btaskmaster\b/i, { name: 'Taskmaster', slug: 'type-taskmaster' });
  add(/\bworld cup watch part(?:y|ies)\b/i, { name: 'Sports Screenings', slug: 'type-sports-screenings' });
  add(/\bworld cup watch part(?:y|ies)\b/i, { name: 'Fundraisers', slug: 'type-fundraisers' });
  add(/\bgay\b/i, { name: 'Queer Events', slug: 'type-queer-event' });
  add(/\bsing(?:a|-a-|\s+a\s+)long\b/i, { name: 'Singalong', slug: 'type-singalong' });
  add(/\bbeach\s+day\b/i, { name: 'Beach Day', slug: 'type-beach-day' });
  add(/\bcribbage\b/i, { name: 'Board Games', slug: 'type-board-games' });
  add(/\bbilliards\b/i, { name: 'Billiards', slug: 'type-billiards' });
  add(/\bbowling\b/i, { name: 'Bowling', slug: 'type-bowling' });
  add(/\bmarkets?\b/i, { name: 'Markets', slug: 'type-market' });
  add(/\bfood\s+tour\b/i, { name: 'Food Tour', slug: 'type-food-tour' });
  add(/\brun\b/i, { name: 'Sports and Recreation', slug: 'type-sports-and-recreation' });
  add(/\bkaraoke\b/i, { name: 'Karaoke', slug: 'type-karaoke' });
  add(/\bburlesque\b/i, { name: 'Burlesque', slug: 'type-burlesque' });
  add(/\bopen\s+mic\b/i, { name: 'Open Mic', slug: 'type-open-mic' });
  add(/\bsmut\s+slam\b/i, { name: 'Open Mic', slug: 'type-open-mic' });
  add(/\bdrag\b/i, { name: 'Drag Events', slug: 'type-drag-events' });
  add(/\bdrag\b/i, { name: 'Queer Events', slug: 'type-queer-event' });
  add(/\btrivia\b/i, { name: 'Trivia', slug: 'type-trivia' });
  add(/\bbingo\b/i, { name: 'Bingo', slug: 'type-bingo' });
  add(/\bday\s+camps?\b/i, { name: 'Day Camps', slug: 'type-day-camp' });
  add(/\bskateboard(?:ing)?\b/i, { name: 'Skateboarding', slug: 'type-skateboarding' });
  add(/\bceremon(?:y|ies)\b/i, { name: 'Ceremonies', slug: 'type-ceremony' });
  add(/\bgaller(?:y|ies)\b/i, { name: 'Art', slug: 'type-art' });

  if (/\blessons?\b/i.test(text) || /\bday\s+camps?\b/i.test(text)) {
    tags.push({ name: '#Stuff to Learn', slug: 'hash-stuff-to-learn' });
  }

  return tags;
}

function mergedTypeTagText(defaultTags, inferredTags, sourceText) {
  const inferredTypeTags = inferredTags.filter((tag) => String(tag.slug || '').startsWith('type-'));
  const removeMusic = inferredTypeTags.length > 0 && (
    /\b(improv|comedy|board games?|game|chess|online\s+games?|taskmaster|world cup watch part(?:y|ies)|cribbage|billiards|bowling|markets?|food\s+tour|run|karaoke|burlesque|open\s+mic|smut\s+slam|drag|trivia|bingo|day\s+camps?|lessons?|skateboard(?:ing)?|ceremon(?:y|ies)|galler(?:y|ies))\b/i.test(sourceText)
  );
  const baseTags = splitTagList(defaultTags)
    .filter((tag) => !(removeMusic && /^music$/i.test(tag)));
  return joinTagLabels([...baseTags, ...inferredTypeTags]);
}

function bucketTagForDraft(mappingValue, inferredTags) {
  if (inferredTags.some((tag) => tag.slug === 'hash-stuff-to-learn')) {
    return '#Stuff to Learn [hash-stuff-to-learn]';
  }
  return mappingValue.private_bucket_tag || mappingValue.default_bucket_tag || '#Stuff to Do [hash-stuff-to-do]';
}

function queryParamsForDraft(source, mappingValue, tagOptions = {}) {
  const params = new URLSearchParams();
  const inferredTags = inferTagsFromText(source.description || '');
  const typeTagText = mergedTypeTagText(mappingValue.new_type_tags || mappingValue.default_type_tags || '', inferredTags, source.description || '');
  const typeTags = classifyDraftTags(typeTagText, tagOptions.type_tags, 'type-');
  const areaTags = classifyDraftTags(mappingValue.new_area_tags || mappingValue.area || mappingValue.default_area_tags || '', tagOptions.area_tags, 'area-');
  const venueOverride = mappingValue.event_venue || mappingValue.default_venue || mappingValue.label || '';

  params.set('source_url', source.source_url || '');
  params.set('image_url', source.image_url || mappingValue.image_url || mappingValue.default_image_url || '');
  params.set('description', source.description || '');
  params.set('venue_name', venueOverride ? 'Other / manual entry' : '');
  params.set('event_venue', venueOverride);
  params.set('manual_type_tags', typeTags.existing.join(', '));
  params.set('manual_area_tags', areaTags.existing.join(', '));
  params.set('new_type_tags', typeTags.newlyCreated.join(', '));
  params.set('new_area_tags', areaTags.newlyCreated.join(', '));
  params.set('private_bucket_tag', bucketTagForDraft(mappingValue, inferredTags));
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
