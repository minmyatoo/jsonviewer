class JSONEditor {
    constructor() {
        this.state = {
            currentTab: 'editor',
            currentView: 'tree',
            parsedJson: null,
            collapsedPaths: new Set(),
            searchResults: [],
            history: [],
            settings: {
                theme: 'light',
                autoFormat: true,
                lineNumbers: true,
                autoSave: false
            }
        };

        this.displayJson = this.displayJson.bind(this);
        this.parseAndDisplay = this.parseAndDisplay.bind(this);
        this.attachEventListeners = this.attachEventListeners.bind(this);

        this.initApp();
    }

    initApp() {
        this.loadSettings();
        this.loadSample();
        this.setupEventListeners();
    }

    loadSettings() {
        const saved = localStorage.getItem('jsonStudioSettings');
        if (saved) {
            this.state.settings = { ...this.state.settings, ...JSON.parse(saved) };
        }

        if (this.state.settings.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    saveSettings() {
        localStorage.setItem('jsonStudioSettings', JSON.stringify(this.state.settings));
    }

    toggleTheme() {
        this.state.settings.theme = this.state.settings.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.state.settings.theme);
        this.saveSettings();
        this.showNotification(`Theme switched to ${this.state.settings.theme}`, 'success');
    }

    switchTab(tabName) {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('hidden', !content.id.startsWith(tabName));
        });

        this.state.currentTab = tabName;
    }

    setViewMode(mode) {
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });

        this.state.currentView = mode;
        if (this.state.parsedJson) {
            this.displayJson();
        }
    }

    handleInput() {
        const input = document.getElementById('jsonInput').value;
        this.updateEditorInfo(input);

        if (this.state.settings.autoFormat) {
            this.debounce(this.parseAndDisplay.bind(this), 500)();
        }
    }

    updateEditorInfo(input) {
        const lines = input.split('\n').length;
        const size = new Blob([input]).size;
        document.getElementById('editorInfo').textContent = `${lines} lines, ${this.formatBytes(size)}`;
    }

    updateCursorInfo() {
        const textarea = document.getElementById('jsonInput');
        const text = textarea.value.substring(0, textarea.selectionStart);
        const lines = text.split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        document.getElementById('cursorInfo').textContent = `Ln ${line}, Col ${col}`;
    }

    parseAndDisplay() {
        const input = document.getElementById('jsonInput').value.trim();

        if (!input) {
            this.resetViewer();
            return;
        }

        try {
            this.state.parsedJson = JSON.parse(input);
            this.updateStats();
            this.displayJson();
            this.showStats();
            this.addToHistory(input);
        } catch (error) {
            this.showError(`Invalid JSON: ${error.message}`);
            this.hideStats();
        }
    }

    displayJson() {
        const viewer = document.getElementById('jsonViewer');

        switch (this.state.currentView) {
            case 'tree':
                viewer.innerHTML = this.renderTreeView(this.state.parsedJson);
                this.attachEventListeners();
                break;
            case 'raw':
                viewer.innerHTML = `<pre>${this.escapeHtml(JSON.stringify(this.state.parsedJson, null, 2))}</pre>`;
                break;
            case 'table':
                viewer.innerHTML = this.renderTableView(this.state.parsedJson);
                break;
        }
    }

    renderTreeView(obj, path = '', depth = 0) {
        if (obj === null) return '<span class="json-null">null</span>';
        if (typeof obj !== 'object') return this.renderValue(obj);

        const isArray = Array.isArray(obj);
        const items = isArray ? obj : Object.entries(obj);
        const isEmpty = items.length === 0;
        const isCollapsed = this.state.collapsedPaths.has(path);

        if (isEmpty) {
            return `<span class="json-bracket">${isArray ? '[]' : '{}'}</span>`;
        }

        let html = `
            <div class="json-line">
                <span class="line-number">${depth + 1}</span>
                <div class="json-content">
                    <span class="expandable" data-path="${path}">
                        <i class="material-icons expand-icon ${isCollapsed ? 'collapsed' : ''}">
                            ${isCollapsed ? 'chevron_right' : 'expand_more'}
                        </i>
                        <span class="json-bracket">${isArray ? '[' : '{'}</span>
                        ${isCollapsed ? ` <span style="color: var(--text-tertiary);">... ${items.length} items</span>` : ''}
                    </span>
                </div>
            </div>
        `;

        if (!isCollapsed) {
            items.forEach((item, index) => {
                const [key, value] = isArray ? [index, item] : item;
                const itemPath = path ? `${path}.${key}` : String(key);
                const isLast = index === items.length - 1;

                html += `
                    <div class="json-line" style="margin-left: ${(depth + 1) * 1.5}rem;">
                        <span class="line-number">${depth + index + 2}</span>
                        <div class="json-content">
                            ${!isArray ? `<span class="json-key">"${this.escapeHtml(key)}"</span>: ` : ''}
                            ${this.renderTreeView(value, itemPath, depth + 1)}
                            ${!isLast ? ',' : ''}
                        </div>
                    </div>
                `;
            });

            html += `
                <div class="json-line" style="margin-left: ${depth * 1.5}rem;">
                    <span class="line-number">${depth + items.length + 2}</span>
                    <div class="json-content">
                        <span class="json-bracket">${isArray ? ']' : '}'}</span>
                    </div>
                </div>
            `;
        }

        return html;
    }

    renderTableView(obj) {
        if (!Array.isArray(obj)) {
            return '<p>Table view is only available for arrays of objects.</p>';
        }

        if (obj.length === 0) {
            return '<p>Empty array</p>';
        }

        const keys = new Set();
        obj.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                Object.keys(item).forEach(key => keys.add(key));
            }
        });

        const keyArray = Array.from(keys);

        let html = '<table style="width: 100%; border-collapse: collapse;">';
        html += '<thead><tr>';
        keyArray.forEach(key => {
            html += `<th style="border: 1px solid var(--border); padding: 0.5rem; background: var(--surface-2);">${this.escapeHtml(key)}</th>`;
        });
        html += '</tr></thead><tbody>';

        obj.forEach(item => {
            html += '<tr>';
            keyArray.forEach(key => {
                const value = (item && typeof item === 'object') ? item[key] : (typeof item !== 'object' ? item : '');
                html += `<td style="border: 1px solid var(--border); padding: 0.5rem;">${this.renderValue(value)}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    renderValue(value) {
        if (value === null) return '<span class="json-null">null</span>';
        const type = typeof value;
        if (type === 'string') return `<span class="json-string">"${this.escapeHtml(value)}"</span>`;
        if (type === 'number') return `<span class="json-number">${value}</span>`;
        if (type === 'boolean') return `<span class="json-boolean">${value}</span>`;
        if (type === 'undefined') return '<span class="json-null">undefined</span>';
        return this.escapeHtml(String(value));
    }

    togglePath(path) {
        if (this.state.collapsedPaths.has(path)) {
            this.state.collapsedPaths.delete(path);
        } else {
            this.state.collapsedPaths.add(path);
        }
        this.displayJson();
    }

    expandAll() {
        this.state.collapsedPaths.clear();
        this.displayJson();
    }

    collapseAll() {
        this.collectAllPaths(this.state.parsedJson, '');
        this.displayJson();
    }

    collectAllPaths(obj, path) {
        if (typeof obj === 'object' && obj !== null) {
            if (path) this.state.collapsedPaths.add(path);

            if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    this.collectAllPaths(item, `${path}[${index}]`);
                });
            } else {
                Object.keys(obj).forEach(key => {
                    const keyPath = path ? `${path}.${key}` : key;
                    this.collectAllPaths(obj[key], keyPath);
                });
            }
        }
    }

    updateStats() {
        if (!this.state.parsedJson) return;

        const jsonString = JSON.stringify(this.state.parsedJson);
        const size = new Blob([jsonString]).size;
        const lines = jsonString.split('\n').length;
        const keys = this.countKeys(this.state.parsedJson);
        const depth = this.getMaxDepth(this.state.parsedJson);

        document.getElementById('sizeInfo').textContent = this.formatBytes(size);
        document.getElementById('linesInfo').textContent = lines;
        document.getElementById('keysInfo').textContent = keys;
        document.getElementById('depthInfo').textContent = depth;
    }

    showStats() {
        document.getElementById('statsBar').style.display = 'flex';
    }

    hideStats() {
        document.getElementById('statsBar').style.display = 'none';
    }

    countKeys(obj) {
        let count = 0;
        if (typeof obj === 'object' && obj !== null) {
            if (Array.isArray(obj)) {
                obj.forEach(item => count += this.countKeys(item));
            } else {
                count += Object.keys(obj).length;
                Object.values(obj).forEach(value => count += this.countKeys(value));
            }
        }
        return count;
    }

    getMaxDepth(obj, depth = 0) {
        if (typeof obj !== 'object' || obj === null) return depth;

        const values = Array.isArray(obj) ? obj : Object.values(obj);
        return Math.max(depth, ...values.map(value => this.getMaxDepth(value, depth + 1)));
    }

    loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('jsonInput').value = e.target.result;
            this.parseAndDisplay();
            this.showNotification(`Loaded: ${file.name}`, 'success');
        };
        reader.readAsText(file);
    }

    downloadJson() {
        if (!this.state.parsedJson) return;

        const formatted = JSON.stringify(this.state.parsedJson, null, 2);
        const blob = new Blob([formatted], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'formatted.json';
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('JSON downloaded', 'success');
    }

    minifyJson() {
        const input = document.getElementById('jsonInput').value.trim();
        if (!input) return;

        try {
            const parsed = JSON.parse(input);
            document.getElementById('jsonInput').value = JSON.stringify(parsed);
            this.parseAndDisplay();
            this.showNotification('JSON minified', 'success');
        } catch (error) {
            this.showError(`Invalid JSON: ${error.message}`);
        }
    }

    beautifyJson() {
        const input = document.getElementById('jsonInput').value.trim();
        if (!input) return;

        try {
            const parsed = JSON.parse(input);
            document.getElementById('jsonInput').value = JSON.stringify(parsed, null, 2);
            this.parseAndDisplay();
            this.showNotification('JSON formatted', 'success');
        } catch (error) {
            this.showError(`Invalid JSON: ${error.message}`);
        }
    }

    validateJson() {
        const input = document.getElementById('jsonInput').value.trim();
        if (!input) {
            this.showError('No JSON to validate');
            return;
        }

        try {
            JSON.parse(input);
            this.showNotification('JSON is valid!', 'success');
        } catch (error) {
            this.showError(`Invalid JSON: ${error.message}`);
        }
    }

    formatInput() {
        this.beautifyJson();
    }

    clearInput() {
        document.getElementById('jsonInput').value = '';
        this.resetViewer();
        this.hideStats();
    }

    resetViewer() {
        document.getElementById('jsonViewer').innerHTML = `
            <div class="loading">
                <i class="material-icons" style="font-size: 3rem; color: var(--text-tertiary);">data_object</i>
                <p>Your formatted JSON will appear here</p>
            </div>
        `;
    }

    loadSample() {
        const sample = {
            "user": { "id": 12345, "name": "Alex Johnson", "email": "alex.johnson@example.com", "isActive": true, "profile": { "avatar": "https://example.com/avatar.jpg", "bio": "Full-stack developer passionate about clean code and user experience", "location": { "city": "San Francisco", "country": "USA", "coordinates": { "lat": 37.7749, "lng": -122.4194 } }, "preferences": { "theme": "dark", "language": "en-US", "notifications": { "email": true, "push": false, "sms": true } } } },
            "projects": [ { "id": 1, "name": "JSON Studio Pro", "description": "Advanced JSON editor and validator", "status": "active", "technologies": ["JavaScript", "HTML", "CSS"], "metrics": { "linesOfCode": 2500, "testCoverage": 98.5, "performance": "excellent" }, "team": [ { "name": "Alex Johnson", "role": "Lead Developer", "skills": ["JavaScript", "React", "Node.js"] }, { "name": "Sarah Chen", "role": "UI/UX Designer", "skills": ["Figma", "Design Systems", "User Research"] } ] }, { "id": 2, "name": "Data Visualization Dashboard", "description": "Interactive charts and analytics platform", "status": "planning", "technologies": ["React", "D3.js", "Python"], "estimatedCompletion": "2024-12-31" } ],
            "analytics": { "pageViews": 15420, "uniqueVisitors": 3847, "conversions": 234, "revenue": 12450.75, "topPages": [ "/dashboard", "/editor", "/validator" ], "userAgent": { "browsers": { "Chrome": 65.2, "Firefox": 18.9, "Safari": 12.4, "Edge": 3.5 }, "devices": { "desktop": 72.8, "mobile": 21.6, "tablet": 5.6 } } },
            "metadata": { "version": "2.1.0", "created": "2024-01-15T10:30:00Z", "lastUpdated": "2024-06-26T14:45:00Z", "tags": ["json", "editor", "developer-tools", "web-app"], "changelog": [ { "version": "2.1.0", "date": "2024-06-26", "changes": ["Added table view", "Improved performance", "Bug fixes"] }, { "version": "2.0.0", "date": "2024-05-15", "changes": ["Complete UI redesign", "New features", "Enhanced validation"] } ] }
        };
        document.getElementById('jsonInput').value = JSON.stringify(sample, null, 2);
        this.parseAndDisplay();
    }

    searchJson() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        if (!query || !this.state.parsedJson) {
            this.clearSearchHighlights();
            return;
        }

        this.state.searchResults = [];
        this.searchInObject(this.state.parsedJson, '', query);
        this.highlightSearchResults();

        if (this.state.searchResults.length > 0) {
            this.showNotification(`Found ${this.state.searchResults.length} matches`, 'success');
        } else {
            this.showNotification('No matches found', 'error');
        }
    }

    searchInObject(obj, path, query) {
        if (obj === null || typeof obj !== 'object') {
            if (String(obj).toLowerCase().includes(query)) {
                this.state.searchResults.push({ path, type: 'value', value: obj });
            }
            return;
        }

        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                this.searchInObject(item, `${path}[${index}]`, query);
            });
        } else {
            Object.entries(obj).forEach(([key, value]) => {
                const newPath = path ? `${path}.${key}` : key;
                if (key.toLowerCase().includes(query)) {
                    this.state.searchResults.push({ path: newPath, type: 'key', value: key });
                }
                this.searchInObject(value, newPath, query);
            });
        }
    }

    highlightSearchResults() {
        this.clearSearchHighlights();
        // This is a simplified approach. A full implementation would require
        // more complex DOM manipulation of the rendered tree view.
        console.log('Search results:', this.state.searchResults);
    }

    clearSearchHighlights() {
        document.querySelectorAll('.search-highlight').forEach(el => {
            el.classList.remove('search-highlight');
        });
    }

    addToHistory(json) {
        const entry = {
            timestamp: new Date().toISOString(),
            preview: json.substring(0, 100) + (json.length > 100 ? '...' : ''),
            data: json
        };

        this.state.history.unshift(entry);
        if (this.state.history.length > 10) {
            this.state.history = this.state.history.slice(0, 10);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    copyOutput(btn) {
        if (!this.state.parsedJson) return;

        const formatted = JSON.stringify(this.state.parsedJson, null, 2);
        navigator.clipboard.writeText(formatted).then(() => {
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="material-icons">check</i>';
            setTimeout(() => {
                btn.innerHTML = originalContent;
            }, 2000);
            this.showNotification('JSON copied to clipboard', 'success');
        });
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="material-icons">${type === 'success' ? 'check_circle' : 'error'}</i>
            ${message}
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    setupEventListeners() {
        document.querySelector('[onclick="toggleTheme()"]').addEventListener('click', () => this.toggleTheme());
        document.querySelector('[onclick="openSettings()"]').addEventListener('click', () => this.openSettings());
        document.querySelector('[onclick="document.getElementById(\'fileInput\').click()"]').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('fileInput').addEventListener('change', (e) => this.loadFile(e));

        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        document.getElementById('jsonInput').addEventListener('input', () => this.handleInput());
        document.getElementById('jsonInput').addEventListener('keyup', () => this.updateCursorInfo());
        document.getElementById('jsonInput').addEventListener('click', () => this.updateCursorInfo());

        document.querySelector('[onclick="clearInput()"]').addEventListener('click', () => this.clearInput());
        document.querySelector('[onclick="loadSample()"]').addEventListener('click', () => this.loadSample());
        document.querySelector('[onclick="formatInput()"]').addEventListener('click', () => this.formatInput());

        document.querySelector('[onclick="minifyJson()"]').addEventListener('click', () => this.minifyJson());
        document.querySelector('[onclick="beautifyJson()"]').addEventListener('click', () => this.beautifyJson());
        document.querySelector('[onclick="validateJson()"]').addEventListener('click', () => this.validateJson());
        document.querySelector('[onclick="downloadJson()"]').addEventListener('click', () => this.downloadJson());

        document.getElementById('searchInput').addEventListener('input', () => this.searchJson());

        document.querySelector('[onclick="expandAll()"]').addEventListener('click', () => this.expandAll());
        document.querySelector('[onclick="collapseAll()"]').addEventListener('click', () => this.collapseAll());
        document.querySelector('[onclick="copyOutput(this)"]').addEventListener('click', (e) => this.copyOutput(e.currentTarget));

        document.querySelectorAll('.tab-button[data-view]').forEach(btn => {
            btn.addEventListener('click', () => this.setViewMode(btn.dataset.view));
        });

        // This is a simplified way to handle dynamic listeners.
        // A more robust solution might use event delegation on the viewer.
        document.getElementById('jsonViewer').addEventListener('click', (e) => {
            const expandable = e.target.closest('.expandable');
            if (expandable) {
                this.togglePath(expandable.dataset.path);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's': e.preventDefault(); this.downloadJson(); break;
                    case 'f': e.preventDefault(); document.getElementById('searchInput').focus(); break;
                    case 'Enter': if (e.target.id === 'jsonInput') { this.parseAndDisplay(); } break;
                }
            }
        });
    }

    openSettings() {
        this.showNotification('Settings panel coming soon!', 'success');
    }

    // ===========================================
    // VALIDATOR FUNCTIONS
    // ===========================================

    validateJsonAdvanced() {
        const input = document.getElementById('validatorInput').value.trim();
        const resultsContainer = document.getElementById('validationResults');

        if (!input) {
            resultsContainer.innerHTML = '<p style="color: var(--error);">No JSON provided for validation</p>';
            return;
        }

        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            info: []
        };

        try {
            const parsed = JSON.parse(input);

            this.validateJsonStructure(parsed, '', validation);

            this.displayValidationResults(validation, parsed);

        } catch (error) {
            validation.isValid = false;
            validation.errors.push({
                type: 'Syntax Error',
                message: error.message,
                line: this.getErrorLine(error.message)
            });
            this.displayValidationResults(validation);
        }
    }

    validateJsonStructure(obj, path, validation) {
        if (typeof obj === 'object' && obj !== null) {
            try {
                JSON.stringify(obj);
            } catch (e) {
                validation.errors.push({
                    type: 'Circular Reference',
                    message: 'Circular reference detected',
                    path: path
                });
            }

            if (Array.isArray(obj)) {
                if (obj.length > 0) {
                    const types = new Set(obj.map(item => typeof item));
                    if (types.size > 2) {
                        validation.warnings.push({
                            type: 'Mixed Types',
                            message: 'Array contains multiple data types',
                            path: path
                        });
                    }
                }

                obj.forEach((item, index) => {
                    this.validateJsonStructure(item, `${path}[${index}]`, validation);
                });
            } else {
                const keys = Object.keys(obj);

                const depth = path.split('.').length;
                if (depth > 15) {
                    validation.warnings.push({
                        type: 'Deep Nesting',
                        message: 'Very deep object nesting detected',
                        path: path
                    });
                }

                if (keys.length === 0) {
                    validation.info.push({
                        type: 'Empty Object',
                        message: 'Empty object found',
                        path: path
                    });
                }

                keys.forEach(key => {
                    if (key.includes(' ')) {
                        validation.warnings.push({
                            type: 'Key Format',
                            message: 'Key contains spaces',
                            path: `${path}.${key}`
                        });
                    }

                    this.validateJsonStructure(obj[key], path ? `${path}.${key}` : key, validation);
                });
            }
        }
    }

    displayValidationResults(validation, parsed = null) {
        const container = document.getElementById('validationResults');
        let html = '';

        if (validation.isValid && validation.errors.length === 0) {
            html = `
                <div style="color: var(--success); padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: var(--radius); margin-bottom: 1rem;">
                    <h3 style="margin: 0 0 0.5rem 0;"><i class="material-icons" style="vertical-align: middle;">check_circle</i> Valid JSON</h3>
                    <p style="margin: 0;">The JSON is syntactically correct and well-formed.</p>
                </div>
            `;

            if (parsed) {
                const stats = {
                    size: new Blob([JSON.stringify(parsed)]).size,
                    keys: this.countKeys(parsed),
                    depth: this.getMaxDepth(parsed),
                    arrays: this.countArrays(parsed),
                    objects: this.countObjects(parsed)
                };

                html += `
                    <div style="background: var(--surface-2); padding: 1rem; border-radius: var(--radius); margin-bottom: 1rem;">
                        <h4>JSON Statistics</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem;">
                            <div>Size: ${this.formatBytes(stats.size)}</div>
                            <div>Keys: ${stats.keys}</div>
                            <div>Max Depth: ${stats.depth}</div>
                            <div>Arrays: ${stats.arrays}</div>
                            <div>Objects: ${stats.objects}</div>
                        </div>
                    </div>
                `;
            }
        }

        if (validation.errors.length > 0) {
            html += '<div style="color: var(--error); margin-bottom: 1rem;"><h3><i class="material-icons" style="vertical-align: middle;">error</i> Errors</h3>';
            validation.errors.forEach(error => {
                html += `<div style="padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius); margin-bottom: 0.5rem;">
                    <strong>${error.type}:</strong> ${error.message}
                    ${error.path ? `<br><small>Path: ${error.path}</small>` : ''}
                    ${error.line ? `<br><small>Line: ${error.line}</small>` : ''}
                </div>`;
            });
            html += '</div>';
        }

        if (validation.warnings.length > 0) {
            html += '<div style="color: var(--warning); margin-bottom: 1rem;"><h3><i class="material-icons" style="vertical-align: middle;">warning</i> Warnings</h3>';
            validation.warnings.forEach(warning => {
                html += `<div style="padding: 0.5rem; background: rgba(245, 158, 11, 0.1); border-radius: var(--radius); margin-bottom: 0.5rem;">
                    <strong>${warning.type}:</strong> ${warning.message}
                    ${warning.path ? `<br><small>Path: ${warning.path}</small>` : ''}
                </div>`;
            });
            html += '</div>';
        }

        if (validation.info.length > 0) {
            html += '<div style="color: var(--text-secondary); margin-bottom: 1rem;"><h3><i class="material-icons" style="vertical-align: middle;">info</i> Information</h3>';
            validation.info.forEach(info => {
                html += `<div style="padding: 0.5rem; background: var(--surface-2); border-radius: var(--radius); margin-bottom: 0.5rem;">
                    <strong>${info.type}:</strong> ${info.message}
                    ${info.path ? `<br><small>Path: ${info.path}</small>` : ''}
                </div>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;
    }

    getErrorLine(errorMessage) {
        const match = errorMessage.match(/position (\d+)/);
        return match ? match[1] : null;
    }

    loadFromEditor(target) {
        const editorValue = document.getElementById('jsonInput').value;
        if (!editorValue) {
            this.showNotification('No data in editor to load', 'error');
            return;
        }

        switch (target) {
            case 'validator':
                document.getElementById('validatorInput').value = editorValue;
                break;
            case 'formatter':
                document.getElementById('formatterInput').value = editorValue;
                break;
            case 'converter':
                document.getElementById('converterInput').value = editorValue;
                break;
            case 'schema':
                document.getElementById('schemaInput').value = editorValue;
                break;
            case 'compareA':
                document.getElementById('compareInputA').value = editorValue;
                break;
            case 'compareB':
                document.getElementById('compareInputB').value = editorValue;
                break;
        }
        this.showNotification('Data loaded from editor', 'success');
    }

    clearValidatorInput() {
        document.getElementById('validatorInput').value = '';
        document.getElementById('validationResults').innerHTML = `
            <div class="loading">
                <i class="material-icons" style="font-size: 3rem; color: var(--text-tertiary);">verified</i>
                <p>Validation results will appear here</p>
            </div>
        `;
    }

    // ===========================================
    // FORMATTER FUNCTIONS
    // ===========================================

    applyCustomFormat() {
        const input = document.getElementById('formatterInput').value.trim();
        const outputContainer = document.getElementById('formattedOutput');

        if (!input) {
            outputContainer.innerHTML = '<p style="color: var(--error);">No JSON provided for formatting</p>';
            return;
        }

        try {
            let parsed = JSON.parse(input);

            const indent = document.getElementById('indentOption').value;
            const sortKeys = document.getElementById('sortKeysOption').value;
            const removeEmpty = document.getElementById('removeEmptyOption').checked;
            const compactArrays = document.getElementById('compactArraysOption').checked;

            if (removeEmpty) {
                parsed = this.removeEmptyValues(parsed);
            }

            if (sortKeys !== 'false') {
                parsed = this.sortObjectKeys(parsed, sortKeys === 'reverse');
            }

            let indentValue = indent === 'tab' ? '\t' : parseInt(indent);
            let formatted = JSON.stringify(parsed, null, indentValue);

            if (compactArrays) {
                formatted = this.compactSimpleArrays(formatted);
            }

            outputContainer.innerHTML = `<pre style="margin: 0; white-space: pre-wrap;">${this.escapeHtml(formatted)}</pre>`;

        } catch (error) {
            outputContainer.innerHTML = `<p style="color: var(--error);">Invalid JSON: ${error.message}</p>`;
        }
    }

    removeEmptyValues(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.removeEmptyValues(item)).filter(item =>
                item !== null && item !== undefined && item !== '' &&
                !(Array.isArray(item) && item.length === 0) &&
                !(typeof item === 'object' && Object.keys(item).length === 0)
            );
        } else if (typeof obj === 'object' && obj !== null) {
            const cleaned = {};
            Object.keys(obj).forEach(key => {
                const value = this.removeEmptyValues(obj[key]);
                if (value !== null && value !== undefined && value !== '' &&
                    !(Array.isArray(value) && value.length === 0) &&
                    !(typeof value === 'object' && Object.keys(value).length === 0)) {
                    cleaned[key] = value;
                }
            });
            return cleaned;
        }
        return obj;
    }

    sortObjectKeys(obj, reverse = false) {
        if (Array.isArray(obj)) {
            return obj.map(item => this.sortObjectKeys(item, reverse));
        } else if (typeof obj === 'object' && obj !== null) {
            const sorted = {};
            const keys = Object.keys(obj).sort();
            if (reverse) keys.reverse();

            keys.forEach(key => {
                sorted[key] = this.sortObjectKeys(obj[key], reverse);
            });
            return sorted;
        }
        return obj;
    }

    compactSimpleArrays(jsonString) {
        return jsonString.replace(/\[\s*([^[\]{}]*?)\s*\]/g, (match, content) => {
            if (!content.includes('{') && !content.includes('[')) {
                return '[' + content.replace(/\s+/g, ' ').trim() + ']';
            }
            return match;
        });
    }

    copyFormattedOutput(btn) {
        const output = document.getElementById('formattedOutput').textContent;
        if (output) {
            navigator.clipboard.writeText(output).then(() => {
                const originalContent = btn.innerHTML;
                btn.innerHTML = '<i class="material-icons">check</i>';
                setTimeout(() => btn.innerHTML = originalContent, 2000);
                this.showNotification('Formatted JSON copied', 'success');
            });
        }
    }

    // ===========================================
    // CONVERTER FUNCTIONS
    // ===========================================

    convertFormat() {
        const input = document.getElementById('converterInput').value.trim();
        const fromFormat = document.getElementById('fromFormat').value;
        const toFormat = document.getElementById('toFormat').value;
        const outputContainer = document.getElementById('convertedOutput');

        if (!input) {
            outputContainer.innerHTML = '<p style="color: var(--error);">No data provided for conversion</p>';
            return;
        }

        try {
            let data;

            switch (fromFormat) {
                case 'json':
                    data = JSON.parse(input);
                    break;
                case 'csv':
                    data = this.parseCSV(input);
                    break;
                case 'xml':
                    data = this.parseXML(input);
                    break;
                case 'yaml':
                    data = this.parseYAML(input);
                    break;
                default:
                    throw new Error('Unsupported input format');
            }

            let output;
            switch (toFormat) {
                case 'json':
                    output = JSON.stringify(data, null, 2);
                    break;
                case 'csv':
                    output = this.convertToCSV(data);
                    break;
                case 'xml':
                    output = this.convertToXML(data);
                    break;
                case 'yaml':
                    output = this.convertToYAML(data);
                    break;
                default:
                    throw new Error('Unsupported output format');
            }

            outputContainer.innerHTML = `<pre style="margin: 0; white-space: pre-wrap;">${this.escapeHtml(output)}</pre>`;

        } catch (error) {
            outputContainer.innerHTML = `<p style="color: var(--error);">Conversion error: ${error.message}</p>`;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }

        return data;
    }

    convertToCSV(data) {
        if (!Array.isArray(data)) {
            throw new Error('CSV conversion requires an array of objects');
        }

        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvLines = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
            });
            csvLines.push(values.join(','));
        });

        return csvLines.join('\n');
    }

    parseXML(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('Invalid XML format');
        }

        return this.xmlToObject(xmlDoc.documentElement);
    }

    xmlToObject(xmlNode) {
        const obj = {};

        if (xmlNode.attributes && xmlNode.attributes.length > 0) {
            obj['@attributes'] = {};
            for (let i = 0; i < xmlNode.attributes.length; i++) {
                const attr = xmlNode.attributes[i];
                obj['@attributes'][attr.name] = attr.value;
            }
        }

        if (xmlNode.childNodes && xmlNode.childNodes.length > 0) {
            for (let i = 0; i < xmlNode.childNodes.length; i++) {
                const child = xmlNode.childNodes[i];

                if (child.nodeType === 3) {
                    const text = child.textContent.trim();
                    if (text) {
                        obj['#text'] = text;
                    }
                } else if (child.nodeType === 1) {
                    if (!obj[child.nodeName]) {
                        obj[child.nodeName] = this.xmlToObject(child);
                    } else {
                        if (!Array.isArray(obj[child.nodeName])) {
                            obj[child.nodeName] = [obj[child.nodeName]];
                        }
                        obj[child.nodeName].push(this.xmlToObject(child));
                    }
                }
            }
        }

        return obj;
    }

    convertToXML(data, rootName = 'root') {
        const objectToXml = (obj, nodeName) => {
            if (Array.isArray(obj)) {
                return obj.map(item => objectToXml(item, nodeName)).join('');
            } else if (typeof obj === 'object' && obj !== null) {
                let xml = `<${nodeName}>`;
                Object.keys(obj).forEach(key => {
                    xml += objectToXml(obj[key], key);
                });
                xml += `</${nodeName}>`;
                return xml;
            } else {
                return `<${nodeName}>${this.escapeXml(String(obj))}</${nodeName}>`;
            }
        }

        return `<?xml version="1.0" encoding="UTF-8"?>\n${objectToXml(data, rootName)}`;
    }

    escapeXml(text) {
        return text.replace(/[<>&'"]/g, (match) => {
            switch (match) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return match;
            }
        });
    }

    parseYAML(yamlText) {
        const lines = yamlText.trim().split('\n');
        const obj = {};
        let currentPath = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const indent = line.length - line.trimStart().length;
            const colonIndex = trimmed.indexOf(':');

            if (colonIndex > -1) {
                const key = trimmed.substring(0, colonIndex).trim();
                const value = trimmed.substring(colonIndex + 1).trim();

                currentPath = currentPath.slice(0, Math.floor(indent / 2));

                if (value) {
                    this.setNestedValue(obj, [...currentPath, key], this.parseYamlValue(value));
                } else {
                    currentPath.push(key);
                }
            }
        });

        return obj;
    }

    parseYamlValue(value) {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null' || value === '~') return null;
        if (!isNaN(value)) return Number(value);
        if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
        return value;
    }

    setNestedValue(obj, path, value) {
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
            if (!current[path[i]]) current[path[i]] = {};
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
    }

    convertToYAML(data) {
        const objectToYaml = (obj, indent = 0) => {
            const spaces = '  '.repeat(indent);
            let yaml = '';

            if (Array.isArray(obj)) {
                obj.forEach(item => {
                    yaml += `${spaces}- `;
                    if (typeof item === 'object' && item !== null) {
                        yaml += '\n' + objectToYaml(item, indent + 1);
                    } else {
                        yaml += this.formatYamlValue(item) + '\n';
                    }
                });
            } else if (typeof obj === 'object' && obj !== null) {
                Object.keys(obj).forEach(key => {
                    yaml += `${spaces}${key}: `;
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        yaml += '\n' + objectToYaml(obj[key], indent + 1);
                    } else {
                        yaml += this.formatYamlValue(obj[key]) + '\n';
                    }
                });
            }

            return yaml;
        }

        return objectToYaml(data);
    }

    formatYamlValue(value) {
        if (typeof value === 'string' && (value.includes(':') || value.includes('\n'))) {
            return `"${value}"`;
        }
        return String(value);
    }

    copyConvertedOutput(btn) {
        const output = document.getElementById('convertedOutput').textContent;
        if (output) {
            navigator.clipboard.writeText(output).then(() => {
                const originalContent = btn.innerHTML;
                btn.innerHTML = '<i class="material-icons">check</i>';
                setTimeout(() => btn.innerHTML = originalContent, 2000);
                this.showNotification('Converted data copied', 'success');
            });
        }
    }

    downloadConverted() {
        const output = document.getElementById('convertedOutput').textContent;
        const toFormat = document.getElementById('toFormat').value;

        if (output) {
            const blob = new Blob([output], { type: this.getContentType(toFormat) });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `converted.${toFormat}`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('File downloaded', 'success');
        }
    }

    getContentType(format) {
        switch (format) {
            case 'json': return 'application/json';
            case 'xml': return 'application/xml';
            case 'csv': return 'text/csv';
            case 'yaml': return 'text/yaml';
            default: return 'text/plain';
        }
    }

    loadConverterSample() {
        const sample = `name,age,city
John Doe,30,New York
Jane Smith,25,Los Angeles
Bob Johnson,35,Chicago`;

        document.getElementById('converterInput').value = sample;
        document.getElementById('fromFormat').value = 'csv';
        document.getElementById('toFormat').value = 'json';
    }

    // ===========================================
    // SCHEMA FUNCTIONS
    // ===========================================

    setSchemaMode(mode) {
        document.querySelectorAll('[data-schema]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.schema === mode);
        });

        document.getElementById('generateSchemaPanel').classList.toggle('hidden', mode !== 'generate');
        document.getElementById('validateSchemaPanel').classList.toggle('hidden', mode !== 'validate');
    }

    generateSchema() {
        const input = document.getElementById('schemaInput').value.trim();
        const outputContainer = document.getElementById('schemaOutput');

        if (!input) {
            outputContainer.innerHTML = '<p style="color: var(--error);">No JSON provided for schema generation</p>';
            return;
        }

        try {
            const parsed = JSON.parse(input);
            const schema = this.generateJsonSchema(parsed);

            outputContainer.innerHTML = `<pre style="margin: 0; white-space: pre-wrap;">${this.escapeHtml(JSON.stringify(schema, null, 2))}</pre>`;

        } catch (error) {
            outputContainer.innerHTML = `<p style="color: var(--error);">Invalid JSON: ${error.message}</p>`;
        }
    }

    generateJsonSchema(obj, title = 'Generated Schema') {
        const schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": title,
            "type": this.getJsonType(obj)
        };

        if (Array.isArray(obj)) {
            if (obj.length > 0) {
                schema.items = this.generateJsonSchema(obj[0]);
            }
        } else if (typeof obj === 'object' && obj !== null) {
            schema.properties = {};
            schema.required = [];

            Object.keys(obj).forEach(key => {
                schema.properties[key] = this.generateJsonSchema(obj[key]);
                schema.required.push(key);
            });

            schema.additionalProperties = false;
        }

        return schema;
    }

    getJsonType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        if (typeof value === 'number') {
            return Number.isInteger(value) ? 'integer' : 'number';
        }
        return typeof value;
    }

    validateAgainstSchema() {
        const schema = document.getElementById('schemaDefinition').value.trim();
        const data = document.getElementById('dataToValidate').value.trim();
        const outputContainer = document.getElementById('schemaOutput');

        if (!schema || !data) {
            outputContainer.innerHTML = '<p style="color: var(--error);">Both schema and data are required for validation</p>';
            return;
        }

        try {
            const parsedSchema = JSON.parse(schema);
            const parsedData = JSON.parse(data);

            const validation = this.validateDataAgainstSchema(parsedData, parsedSchema);
            this.displaySchemaValidationResults(validation);

        } catch (error) {
            outputContainer.innerHTML = `<p style="color: var(--error);">Parse error: ${error.message}</p>`;
        }
    }

    validateDataAgainstSchema(data, schema, path = '') {
        const errors = [];

        const dataType = this.getJsonType(data);
        if (schema.type && schema.type !== dataType) {
            errors.push({
                path: path || 'root',
                message: `Expected type '${schema.type}' but got '${dataType}'`
            });
        }

        if (schema.type === 'object' && schema.properties) {
            if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                if (schema.required) {
                    schema.required.forEach(prop => {
                        if (!(prop in data)) {
                            errors.push({
                                path: path ? `${path}.${prop}` : prop,
                                message: `Required property '${prop}' is missing`
                            });
                        }
                    });
                }

                Object.keys(data).forEach(key => {
                    if (schema.properties[key]) {
                        const propPath = path ? `${path}.${key}` : key;
                        const propErrors = this.validateDataAgainstSchema(data[key], schema.properties[key], propPath);
                        errors.push(...propErrors);
                    } else if (schema.additionalProperties === false) {
                        errors.push({
                            path: path ? `${path}.${key}` : key,
                            message: `Additional property '${key}' is not allowed`
                        });
                    }
                });
            }
        }

        if (schema.type === 'array' && schema.items) {
            if (Array.isArray(data)) {
                data.forEach((item, index) => {
                    const itemPath = path ? `${path}[${index}]` : `[${index}]`;
                    const itemErrors = this.validateDataAgainstSchema(item, schema.items, itemPath);
                    errors.push(...itemErrors);
                });
            }
        }

        return errors;
    }

    displaySchemaValidationResults(errors) {
        const container = document.getElementById('schemaOutput');

        if (errors.length === 0) {
            container.innerHTML = `
                <div style="color: var(--success); padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: var(--radius);">
                    <h3 style="margin: 0 0 0.5rem 0;"><i class="material-icons" style="vertical-align: middle;">check_circle</i> Valid</h3>
                    <p style="margin: 0;">The data conforms to the provided schema.</p>
                </div>
            `;
        } else {
            let html = `
                <div style="color: var(--error); margin-bottom: 1rem;">
                    <h3><i class="material-icons" style="vertical-align: middle;">error</i> Schema Validation Errors (${errors.length})</h3>
                </div>
            `;

            errors.forEach(error => {
                html += `
                    <div style="padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius); margin-bottom: 0.5rem;">
                        <strong>Path:</strong> ${error.path}<br>
                        <strong>Error:</strong> ${error.message}
                    </div>
                `;
            });

            container.innerHTML = html;
        }
    }

    copySchemaOutput(btn) {
        const output = document.getElementById('schemaOutput').textContent;
        if (output) {
            navigator.clipboard.writeText(output).then(() => {
                const originalContent = btn.innerHTML;
                btn.innerHTML = '<i class="material-icons">check</i>';
                setTimeout(() => btn.innerHTML = originalContent, 2000);
                this.showNotification('Schema copied', 'success');
            });
        }
    }

    // ===========================================
    // COMPARE FUNCTIONS
    // ===========================================

    compareJsons() {
        const jsonA = document.getElementById('compareInputA').value.trim();
        const jsonB = document.getElementById('compareInputB').value.trim();

        if (!jsonA || !jsonB) {
            this.showNotification('Both JSON inputs are required for comparison', 'error');
            return;
        }

        try {
            const parsedA = JSON.parse(jsonA);
            const parsedB = JSON.parse(jsonB);

            const options = {
                ignoreOrder: document.getElementById('ignoreOrderOption').checked,
                ignoreType: document.getElementById('ignoreTypeOption').checked
            };

            const diff = this.createDiff(parsedA, parsedB, '', options);
            this.displayComparisonResults(diff);

        } catch (error) {
            this.showNotification(`Parse error: ${error.message}`, 'error');
        }
    }

    createDiff(objA, objB, path = '', options = {}) {
        const diff = {
            added: [],
            removed: [],
            modified: [],
            unchanged: []
        };

        if (objA === objB) {
            diff.unchanged.push({ path, value: objA });
            return diff;
        }

        const typeA = this.getJsonType(objA);
        const typeB = this.getJsonType(objB);

        if (!options.ignoreType && typeA !== typeB) {
            diff.modified.push({
                path,
                oldValue: objA,
                newValue: objB,
                reason: 'Type change'
            });
            return diff;
        }

        if (typeA === 'object' && typeB === 'object') {
            const keysA = new Set(Object.keys(objA || {}));
            const keysB = new Set(Object.keys(objB || {}));
            const allKeys = new Set([...keysA, ...keysB]);

            allKeys.forEach(key => {
                const keyPath = path ? `${path}.${key}` : key;

                if (!keysA.has(key)) {
                    diff.added.push({ path: keyPath, value: objB[key] });
                } else if (!keysB.has(key)) {
                    diff.removed.push({ path: keyPath, value: objA[key] });
                } else {
                    const subDiff = this.createDiff(objA[key], objB[key], keyPath, options);
                    diff.added.push(...subDiff.added);
                    diff.removed.push(...subDiff.removed);
                    diff.modified.push(...subDiff.modified);
                    diff.unchanged.push(...subDiff.unchanged);
                }
            });
        } else if (typeA === 'array' && typeB === 'array') {
            const arrayA = objA || [];
            const arrayB = objB || [];
            const maxLength = Math.max(arrayA.length, arrayB.length);

            for (let i = 0; i < maxLength; i++) {
                const itemPath = `${path}[${i}]`;

                if (i >= arrayA.length) {
                    diff.added.push({ path: itemPath, value: arrayB[i] });
                } else if (i >= arrayB.length) {
                    diff.removed.push({ path: itemPath, value: arrayA[i] });
                } else {
                    const subDiff = this.createDiff(arrayA[i], arrayB[i], itemPath, options);
                    diff.added.push(...subDiff.added);
                    diff.removed.push(...subDiff.removed);
                    diff.modified.push(...subDiff.modified);
                    diff.unchanged.push(...subDiff.unchanged);
                }
            }
        } else if (objA !== objB) {
            diff.modified.push({
                path,
                oldValue: objA,
                newValue: objB,
                reason: 'Value change'
            });
        }

        return diff;
    }

    displayComparisonResults(diff) {
        const resultsContainer = document.getElementById('comparisonResults');
        const summaryContainer = document.getElementById('diffSummary');
        const outputContainer = document.getElementById('diffOutput');

        resultsContainer.style.display = 'block';

        const totalChanges = diff.added.length + diff.removed.length + diff.modified.length;
        summaryContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;">
                <div class="stat">
                    <span class="stat-label">Total Changes:</span> ${totalChanges}
                </div>
                <div class="stat" style="color: var(--success);">
                    <span class="stat-label">Added:</span> ${diff.added.length}
                </div>
                <div class="stat" style="color: var(--error);">
                    <span class="stat-label">Removed:</span> ${diff.removed.length}
                </div>
                <div class="stat" style="color: var(--warning);">
                    <span class="stat-label">Modified:</span> ${diff.modified.length}
                </div>
                <div class="stat">
                    <span class="stat-label">Unchanged:</span> ${diff.unchanged.length}
                </div>
            </div>
        `;

        let html = '';

        if (diff.added.length > 0) {
            html += '<h4 style="color: var(--success);"><i class="material-icons" style="vertical-align: middle;">add</i> Added</h4>';
            diff.added.forEach(item => {
                html += `
                    <div style="padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border-radius: var(--radius); margin-bottom: 0.5rem; border-left: 4px solid var(--success);">
                        <strong>${item.path}</strong><br>
                        <code>${this.escapeHtml(JSON.stringify(item.value, null, 2))}</code>
                    </div>
                `;
            });
        }

        if (diff.removed.length > 0) {
            html += '<h4 style="color: var(--error);"><i class="material-icons" style="vertical-align: middle;">remove</i> Removed</h4>';
            diff.removed.forEach(item => {
                html += `
                    <div style="padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius); margin-bottom: 0.5rem; border-left: 4px solid var(--error);">
                        <strong>${item.path}</strong><br>
                        <code>${this.escapeHtml(JSON.stringify(item.value, null, 2))}</code>
                    </div>
                `;
            });
        }

        if (diff.modified.length > 0) {
            html += '<h4 style="color: var(--warning);"><i class="material-icons" style="vertical-align: middle;">edit</i> Modified</h4>';
            diff.modified.forEach(item => {
                html += `
                    <div style="padding: 0.5rem; background: rgba(245, 158, 11, 0.1); border-radius: var(--radius); margin-bottom: 0.5rem; border-left: 4px solid var(--warning);">
                        <strong>${item.path}</strong> ${item.reason ? `(${item.reason})` : ''}<br>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
                            <div>
                                <small style="color: var(--error);">Before:</small><br>
                                <code>${this.escapeHtml(JSON.stringify(item.oldValue, null, 2))}</code>
                            </div>
                            <div>
                                <small style="color: var(--success);">After:</small><br>
                                <code>${this.escapeHtml(JSON.stringify(item.newValue, null, 2))}</code>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        if (totalChanges === 0) {
            html = `
                <div style="text-align: center; padding: 2rem; color: var(--success);">
                    <i class="material-icons" style="font-size: 3rem;">check_circle</i>
                    <h3>No Differences Found</h3>
                    <p>The JSON objects are identical.</p>
                </div>
            `;
        }

        outputContainer.innerHTML = html;
    }

    clearComparison() {
        document.getElementById('compareInputA').value = '';
        document.getElementById('compareInputB').value = '';
        document.getElementById('comparisonResults').style.display = 'none';
    }

    swapComparison() {
        const inputA = document.getElementById('compareInputA');
        const inputB = document.getElementById('compareInputB');
        const temp = inputA.value;
        inputA.value = inputB.value;
        inputB.value = temp;
        this.showNotification('JSON inputs swapped', 'success');
    }

    loadComparisonSample(side) {
        const sampleA = { name: "John Doe", age: 30, skills: ["JavaScript", "Python"], address: { city: "New York", country: "USA" } };
        const sampleB = { name: "John Doe", age: 31, skills: ["JavaScript", "Python", "React"], address: { city: "San Francisco", country: "USA" }, phone: "+1-555-0123" };

        const targetId = side === 'A' ? 'compareInputA' : 'compareInputB';
        const sample = side === 'A' ? sampleA : sampleB;

        document.getElementById(targetId).value = JSON.stringify(sample, null, 2);
    }

    exportDiff() {
        const diffOutput = document.getElementById('diffOutput').textContent;
        if (diffOutput) {
            const blob = new Blob([diffOutput], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'json-diff.txt';
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('Diff exported', 'success');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new JSONEditor();
});
