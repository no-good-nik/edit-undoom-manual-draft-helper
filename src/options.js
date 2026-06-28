const formUrlEl = document.getElementById('formUrl');
const mappingEl = document.getElementById('mapping');
const statusEl = document.getElementById('status');
const saveButton = document.getElementById('saveButton');
const resetButton = document.getElementById('resetButton');

function setStatus(message, tone = '') {
  statusEl.textContent = message;
  statusEl.className = 'status ' + tone;
}

function render(mapping, formUrl) {
  formUrlEl.value = formUrl || DEFAULT_FORM_URL;
  mappingEl.value = JSON.stringify(mapping || DEFAULT_MAPPING, null, 2);
}

async function loadOptions() {
  const config = await storageGet({
    formUrl: DEFAULT_FORM_URL,
    mapping: DEFAULT_MAPPING
  });
  render(config.mapping, config.formUrl);
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
    mapping
  });
  setStatus('Saved.', 'ok');
});

resetButton.addEventListener('click', () => {
  render(DEFAULT_MAPPING, formUrlEl.value.trim() || DEFAULT_FORM_URL);
  setStatus('Sample mapping restored. Click Save to keep it.', 'warn');
});

loadOptions();
