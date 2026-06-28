const browserApi = globalThis.browser || globalThis.chrome;

function storageGet(defaults) {
  return new Promise((resolve) => {
    browserApi.storage.sync.get(defaults, resolve);
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    browserApi.storage.sync.set(values, resolve);
  });
}

function queryActiveTab() {
  return new Promise((resolve) => {
    browserApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0] || null);
    });
  });
}

function createTab(url) {
  return new Promise((resolve) => {
    browserApi.tabs.create({ url }, resolve);
  });
}

function openOptionsPage() {
  if (browserApi.runtime.openOptionsPage) {
    browserApi.runtime.openOptionsPage();
    return;
  }
  createTab(browserApi.runtime.getURL('src/options.html'));
}
