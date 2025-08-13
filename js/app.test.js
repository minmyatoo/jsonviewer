import JSONEditor from './app.js';

// Mocking localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('JSONEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="app-container">
        <header class="header">
          <div class="header-content">
            <button class="btn btn-secondary" id="toggleThemeBtn"></button>
            <button class="btn btn-secondary" id="settingsBtn"></button>
            <input type="file" id="fileInput" class="file-input">
            <button class="btn btn-primary" id="importFileBtn"></button>
          </div>
        </header>
        <nav class="nav-tabs">
            <button class="nav-tab active" data-tab="editor"></button>
            <button class="nav-tab" data-tab="validator"></button>
        </nav>
        <main class="main-content">
            <div id="editor-tab" class="tab-content">
                <div class="content-grid">
                    <div class="panel">
                        <div class="panel-header">
                            <div class="panel-actions">
                                <button id="clearInputBtn"></button>
                                <button id="loadSampleBtn"></button>
                                <button id="formatInputBtn"></button>
                            </div>
                        </div>
                        <div class="panel-content">
                            <div class="search-box">
                                <input id="searchInput">
                            </div>
                            <div class="toolbar">
                                <button id="minifyJsonBtn"></button>
                                <button id="beautifyJsonBtn"></button>
                                <button id="validateJsonBtn"></button>
                                <button id="downloadJsonBtn"></button>
                            </div>
                            <div class="editor-container">
                                <div class="editor-toolbar">
                                    <span id="editorInfo"></span>
                                    <span id="cursorInfo"></span>
                                </div>
                                <textarea id="jsonInput"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="panel">
                        <div class="panel-header">
                            <div class="panel-actions">
                                <button id="expandAllBtn"></button>
                                <button id="collapseAllBtn"></button>
                                <button id="copyOutputBtn"></button>
                            </div>
                        </div>
                        <div class="panel-content">
                            <div id="statsBar" style="display: none;">
                                <span id="sizeInfo"></span>
                                <span id="linesInfo"></span>
                                <span id="keysInfo"></span>
                                <span id="depthInfo"></span>
                            </div>
                            <div id="breadcrumb" style="display: none;"></div>
                            <div class="tab-container">
                                <div class="tab-list">
                                    <button class="tab-button active" data-view="tree"></button>
                                    <button class="tab-button" data-view="raw"></button>
                                    <button class="tab-button" data-view="table"></button>
                                </div>
                            </div>
                            <div id="jsonViewer"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="validator-tab" class="tab-content hidden"></div>
        </main>
      </div>
      <div id="settingsModal" class="modal-overlay hidden">
        <div class="modal">
          <div class="modal-header">
            <h2>Settings</h2>
            <button id="closeSettingsBtn"></button>
          </div>
          <div class="modal-content">
            <div class="setting">
              <label for="themeSetting">Theme</label>
              <select id="themeSetting">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div class="setting">
              <label for="autoFormatSetting">
                <input type="checkbox" id="autoFormatSetting">
              </label>
            </div>
            <div class="setting">
              <label for="lineNumbersSetting">
                <input type="checkbox" id="lineNumbersSetting">
              </label>
            </div>
            <div class="setting">
              <label for="autoSaveSetting">
                <input type="checkbox" id="autoSaveSetting">
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  test('should open and close settings modal', () => {
    const jsonEditor = new JSONEditor();
    const settingsModal = document.getElementById('settingsModal');

    // Check that the modal is hidden initially
    expect(settingsModal.classList.contains('hidden')).toBe(true);

    // Open the modal
    jsonEditor.openSettings();
    expect(settingsModal.style.display).toBe('flex');

    // Close the modal
    jsonEditor.closeSettings();
    expect(settingsModal.style.display).toBe('none');
  });
});
