# Edit Undoom Manual Draft Helper

A small browser extension for opening the Edit Undoom n8n manual event draft form from Instagram, Facebook, or Bandsintown source pages.

The extension reads the current tab URL, extracts the page handle, looks that handle up in an editable mapping table, and opens the manual draft form with useful query defaults:

- `source_url`
- `event_venue`
- `new_type_tags`
- `new_area_tags`
- `private_bucket_tag`
- optional `parser_type`

## Browser Support

This is a Manifest V3 WebExtension.

Expected to work:

- Brave desktop
- Chrome desktop
- Edge desktop
- Firefox desktop

Extra packaging needed:

- Safari desktop: convert with Apple's Safari Web Extension tooling in Xcode.
- iPhone/iPad Safari: requires a Safari Web Extension app package through Xcode/App Store style distribution.

Not realistically supported:

- Chrome on iOS/iPadOS does not support general Chrome extensions.
- Chrome on Android does not support general Chrome extensions.

Firefox Android supports some extensions, but side-loading custom extensions is more constrained than desktop Firefox.

## Install Locally in Brave or Chrome

1. Open `brave://extensions` or `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select this folder.
5. Open the extension Options page and update the mapping JSON.

## Install Locally in Firefox Desktop

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Select `manifest.json`.

Firefox temporary add-ons disappear when Firefox restarts.

## Add Or Sync Instagram Accounts

The Options page loads its mapping from the production Google Sheet through n8n before rendering. It falls back to the saved browser mapping if the feed is unavailable. The **Add or sync Instagram account** form updates the extension mapping stored in the browser and posts the same row to the configured n8n webhook so the production `venues` sheet gets the `instagram_user_name` value too.

The Type tags and Area tags controls also load from the production Ghost site through n8n, so new venue defaults can be selected from existing public `type-` and `area-` tags instead of typed by hand.

Default mapping feed:

```text
https://n8n.editundoom.ca/webhook/extension-venue-mapping-production
```

Default sync webhook:

```text
https://n8n.editundoom.ca/webhook/extension-venue-instagram-sync-production
```

Default Ghost tag options feed:

```text
https://n8n.editundoom.ca/webhook/extension-ghost-tag-options-production
```

For existing venues, the n8n workflow updates only `instagram_user_name` so structured parser URLs are not replaced by Instagram URLs. Brand-new venues are appended with `parser_type=instagram_manual_review` unless you enter another parser type.

## Mapping

Open the extension Options page to edit the mapping JSON. The easiest format is an array copied from `config/venues-template.json`; fill in `instagram_user_name` for each venue/org you want the extension to recognize. Use `aliases` for alternate spellings.

```json
[
  {
    "instagram_user_name": "osbornetaphouse",
    "aliases": ["theosbornetaphouse"],
    "label": "The Osborne Taphouse",
    "parser_type": "osborne_taphouse_manitoba_music",
    "source_url": "https://www.manitobamusic.com/profiles/view,499/theosbornetaphouse",
    "event_venue": "The Osborne Taphouse",
    "new_type_tags": "Music",
    "new_area_tags": "Osborne Village",
    "private_bucket_tag": "#Stuff to Do [hash-stuff-to-do]",
    "extra_params": {}
  }
]
```

The older object format keyed by handle is still supported, so existing saved mappings keep working.

## Validate

```bash
npm run validate
```

No install step is required; the validation script uses only Node's built-in modules.
