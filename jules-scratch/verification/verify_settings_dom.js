const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.resolve(__dirname, '../../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const projectRoot = path.resolve(__dirname, '../../');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: `file://${projectRoot}/`
});

const { window } = dom;
const { document } = window;

// Since we are not in a browser, we need to manually trigger the DOMContentLoaded event
// for the script in index.html to run.
const DOMContentLoaded_event = new window.Event('DOMContentLoaded', { bubbles: true, cancelable: true });
document.dispatchEvent(DOMContentLoaded_event);

// The script in index.html should have run and created a JSONEditor instance.
// I will check for the settings modal functionality.

const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

if (!settingsBtn || !settingsModal || !closeSettingsBtn) {
    console.error('Could not find settings elements in the DOM');
    process.exit(1);
}

// 1. Check initial state
if (settingsModal.style.display !== '' && settingsModal.style.display !== 'none' && !settingsModal.classList.contains('hidden')) {
    console.error('FAIL: Settings modal is not hidden initially.');
    process.exit(1);
}
console.log('PASS: Settings modal is hidden initially.');

// 2. Test opening the modal
settingsBtn.click();

if (settingsModal.style.display !== 'flex') {
    console.error('FAIL: Settings modal did not become visible after click.');
    process.exit(1);
}
console.log('PASS: Settings modal became visible after click.');

// 3. Test closing the modal
closeSettingsBtn.click();
if (settingsModal.style.display !== 'none') {
    console.error('FAIL: Settings modal did not hide after close button click.');
    process.exit(1);
}
console.log('PASS: Settings modal hid after close button click.');

console.log('\nSettings modal verification successful!');
