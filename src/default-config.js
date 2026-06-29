const DEFAULT_FORM_URL = 'https://n8n.editundoom.ca/form/manual-event-draft';
const DEFAULT_SYNC_WEBHOOK_URL = 'https://n8n.editundoom.ca/webhook/extension-venue-instagram-sync-production';
const DEFAULT_MAPPING_FEED_URL = 'https://n8n.editundoom.ca/webhook/extension-venue-mapping-production';
const DEFAULT_TAG_OPTIONS_URL = 'https://n8n.editundoom.ca/webhook/extension-ghost-tag-options-production';

const DEFAULT_MAPPING = {
  osbornetaphouse: {
    label: 'The Osborne Taphouse',
    aliases: ['theosbornetaphouse'],
    parser_type: 'osborne_taphouse_manitoba_music',
    event_venue: 'The Osborne Taphouse',
    new_type_tags: 'Music',
    new_area_tags: 'Osborne Village',
    private_bucket_tag: '#Stuff to Do [hash-stuff-to-do]'
  },
  royalalbertarms: {
    label: 'Royal Albert Arms',
    parser_type: 'royal_albert_showpass',
    event_venue: 'Royal Albert Arms',
    new_type_tags: 'Music',
    new_area_tags: 'Exchange District',
    private_bucket_tag: '#Stuff to Do [hash-stuff-to-do]'
  },
  bulldogeventcenter: {
    label: 'Bulldog Event Centre',
    aliases: ['bulldogeventcentre'],
    parser_type: '',
    event_venue: 'Bulldog Event Centre',
    new_type_tags: 'Music',
    new_area_tags: '',
    private_bucket_tag: '#Stuff to Do [hash-stuff-to-do]'
  }
};
