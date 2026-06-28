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
