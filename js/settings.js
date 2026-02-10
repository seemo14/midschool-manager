/**
 * MidSchool Manager - Settings Page Module
 * Handles teacher info, schedule config, semester dates, backup/restore,
 * storage usage display, and data reset.
 * Depends on: MSM.Storage, MSM.UI, MSM.App
 */
(function () {
    'use strict';

    window.MSM = window.MSM || {};

    var KEYS = MSM.Storage.STORAGE_KEYS;

    var ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    /* ------------------------------------------------------------------ */
    /*  State                                                              */
    /* ------------------------------------------------------------------ */

    var currentSettings = {};
    var currentPeriods = [];

    /* ------------------------------------------------------------------ */
    /*  Initialize                                                         */
    /* ------------------------------------------------------------------ */

    function init() {
        loadSettings();
        renderClassList();
        updateStorageUsage();
    }

    /* ------------------------------------------------------------------ */
    /*  Load Settings into Form                                            */
    /* ------------------------------------------------------------------ */

    function loadSettings() {
        currentSettings = MSM.Storage.getData('msm_settings') || {};

        // Teacher & School Info
        setVal('settTeacherName', currentSettings.teacherName || '');
        setVal('settSchoolName', currentSettings.schoolName || '');
        setVal('settAcademicYear', currentSettings.academicYear || '2025-2026');
        setVal('settGradingScale', currentSettings.gradingScale || 20);

        // AI API Key
        setVal('settApiKey', currentSettings.aiApiKey || '');
        setVal('settAiModel', currentSettings.aiModel || 'gemini-2.5-flash');

        // Semester dates
        var semesters = currentSettings.semesters || {};
        var sem1 = semesters.semester1 || {};
        var sem2 = semesters.semester2 || {};
        setVal('settSem1Start', sem1.start || '2025-09-01');
        setVal('settSem1End', sem1.end || '2026-01-31');
        setVal('settSem2Start', sem2.start || '2026-02-01');
        setVal('settSem2End', sem2.end || '2026-06-30');

        // Schedule
        var schedule = currentSettings.schedule || {};
        var activeDays = schedule.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        renderDaysGrid(activeDays);

        currentPeriods = schedule.periods || getDefaultPeriods();
        renderPeriodTable();
    }

    function getDefaultPeriods() {
        return [
            { id: 'p1', label: 'Period 1', start: '08:30', end: '09:30' },
            { id: 'p2', label: 'Period 2', start: '09:30', end: '10:30' },
            { id: 'p3', label: 'Period 3', start: '10:30', end: '11:30' },
            { id: 'p4', label: 'Period 4', start: '11:30', end: '12:30' },
            { id: 'p5', label: 'Period 5', start: '14:30', end: '15:30' },
            { id: 'p6', label: 'Period 6', start: '15:30', end: '16:30' },
            { id: 'p7', label: 'Period 7', start: '16:30', end: '17:30' }
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Render Days Grid                                                    */
    /* ------------------------------------------------------------------ */

    function renderDaysGrid(activeDays) {
        var container = document.getElementById('daysGrid');
        if (!container) return;

        container.innerHTML = '';

        for (var i = 0; i < ALL_DAYS.length; i++) {
            var day = ALL_DAYS[i];
            var isActive = activeDays.indexOf(day) !== -1;

            var toggle = document.createElement('label');
            toggle.className = 'day-toggle' + (isActive ? ' checked' : '');
            toggle.setAttribute('data-day', day);

            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isActive;
            checkbox.value = day;

            checkbox.addEventListener('change', (function (lbl) {
                return function () {
                    if (this.checked) {
                        lbl.classList.add('checked');
                    } else {
                        lbl.classList.remove('checked');
                    }
                };
            })(toggle));

            toggle.appendChild(checkbox);
            toggle.appendChild(document.createTextNode(day.substring(0, 3)));
            container.appendChild(toggle);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Render Period Table                                                  */
    /* ------------------------------------------------------------------ */

    function renderPeriodTable() {
        var tbody = document.getElementById('periodTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        for (var i = 0; i < currentPeriods.length; i++) {
            var p = currentPeriods[i];
            var tr = document.createElement('tr');
            tr.setAttribute('data-period-index', i);

            tr.innerHTML =
                '<td class="period-label-col">' +
                    '<input type="text" value="' + escapeAttr(p.label) + '" data-field="label" />' +
                '</td>' +
                '<td class="time-col">' +
                    '<input type="time" value="' + escapeAttr(p.start) + '" data-field="start" />' +
                '</td>' +
                '<td class="time-col">' +
                    '<input type="time" value="' + escapeAttr(p.end) + '" data-field="end" />' +
                '</td>' +
                '<td class="action-col">' +
                    '<button class="btn-remove" title="Remove period" onclick="MSM.SettingsPage.removePeriod(' + i + ')">×</button>' +
                '</td>';

            tbody.appendChild(tr);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Period Actions                                                      */
    /* ------------------------------------------------------------------ */

    function addPeriod() {
        var num = currentPeriods.length + 1;
        currentPeriods.push({
            id: 'p' + num,
            label: 'Period ' + num,
            start: '',
            end: ''
        });
        renderPeriodTable();
    }

    function removePeriod(index) {
        if (currentPeriods.length <= 1) {
            if (MSM.UI) MSM.UI.showToast('Must have at least one period', 'warning');
            return;
        }
        currentPeriods.splice(index, 1);
        renderPeriodTable();
    }

    /* ------------------------------------------------------------------ */
    /*  Save Settings                                                       */
    /* ------------------------------------------------------------------ */

    function saveSettings() {
        // Gather teacher info
        currentSettings.teacherName = getVal('settTeacherName');
        currentSettings.schoolName = getVal('settSchoolName');
        currentSettings.academicYear = getVal('settAcademicYear');
        currentSettings.gradingScale = parseInt(getVal('settGradingScale'), 10) || 20;

        // AI settings
        currentSettings.aiApiKey = getVal('settApiKey');
        currentSettings.aiModel = getVal('settAiModel');

        // Gather semester dates
        currentSettings.semesters = {
            semester1: {
                label: 'Semester 1',
                start: getVal('settSem1Start'),
                end: getVal('settSem1End')
            },
            semester2: {
                label: 'Semester 2',
                start: getVal('settSem2Start'),
                end: getVal('settSem2End')
            }
        };

        // Gather active days
        var daysGrid = document.getElementById('daysGrid');
        var checkedDays = [];
        if (daysGrid) {
            var checkboxes = daysGrid.querySelectorAll('input[type="checkbox"]');
            for (var i = 0; i < checkboxes.length; i++) {
                if (checkboxes[i].checked) {
                    checkedDays.push(checkboxes[i].value);
                }
            }
        }

        // Gather periods from table
        var tbody = document.getElementById('periodTableBody');
        var updatedPeriods = [];
        if (tbody) {
            var rows = tbody.querySelectorAll('tr');
            for (var j = 0; j < rows.length; j++) {
                var inputs = rows[j].querySelectorAll('input');
                var label = inputs[0] ? inputs[0].value.trim() : 'Period ' + (j + 1);
                var start = inputs[1] ? inputs[1].value : '';
                var end = inputs[2] ? inputs[2].value : '';
                updatedPeriods.push({
                    id: 'p' + (j + 1),
                    label: label,
                    start: start,
                    end: end
                });
            }
        }
        currentPeriods = updatedPeriods;

        currentSettings.schedule = {
            periods: currentPeriods,
            days: checkedDays
        };

        // Save to storage
        MSM.Storage.setData('msm_settings', currentSettings);

        // Update header with new name
        if (MSM.App && MSM.App.updateHeader) {
            MSM.App.updateHeader();
        }

        if (MSM.UI) {
            MSM.UI.showToast('Settings saved successfully!', 'success');
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Render Class List                                                    */
    /* ------------------------------------------------------------------ */

    function renderClassList() {
        var container = document.getElementById('classList');
        if (!container) return;

        var classes = MSM.Storage.getData('msm_classes') || [];
        container.innerHTML = '';

        if (classes.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-size: var(--text-sm);">No classes configured.</p>';
            return;
        }

        // Group by year
        var grades = { 1: [], 2: [], 3: [] };
        for (var i = 0; i < classes.length; i++) {
            var yr = classes[i].year || 1;
            if (!grades[yr]) grades[yr] = [];
            grades[yr].push(classes[i]);
        }

        var gradeLabels = { 1: '1AC (Year 1)', 2: '2AC (Year 2)', 3: '3AC (Year 3)' };
        var gradeColors = { 1: '#2563EB', 2: '#059669', 3: '#7C3AED' };

        for (var g = 1; g <= 3; g++) {
            if (!grades[g] || grades[g].length === 0) continue;
            var gradeHeader = document.createElement('div');
            gradeHeader.style.cssText = 'grid-column: 1 / -1; font-weight: 700; font-size: var(--text-sm); color: ' + gradeColors[g] + '; margin-top: var(--space-sm); padding: 4px 0; border-bottom: 2px solid ' + gradeColors[g] + '20;';
            gradeHeader.textContent = gradeLabels[g] + ' (' + grades[g].length + ' classes)';
            container.appendChild(gradeHeader);

            for (var j = 0; j < grades[g].length; j++) {
                var cls = grades[g][j];
                var div = document.createElement('div');
                div.className = 'class-item';
                div.innerHTML =
                    '<div class="class-item__color" style="background:' + escapeAttr(cls.color || '#888') + '"></div>' +
                    '<div class="class-item__name">' + escapeHTML(cls.name) + '</div>' +
                    '<div class="class-item__count">' + (cls.studentCount || 0) + ' students</div>';
                container.appendChild(div);
            }
        }
    }

    /**
     * Update existing class colors to the new grade-based color scheme
     */
    function refreshClassColors() {
        var gradeColors = {
            1: ['#2563EB', '#3B82F6', '#0EA5E9', '#6366F1', '#0284C7'],
            2: ['#059669', '#10B981', '#0D9488', '#16A34A'],
            3: ['#7C3AED', '#A855F7', '#9333EA', '#8B5CF6']
        };
        var classes = MSM.Storage.getData('msm_classes') || [];
        for (var i = 0; i < classes.length; i++) {
            var cls = classes[i];
            var yr = cls.year || 1;
            var sec = (cls.section || 1) - 1;
            var palette = gradeColors[yr] || gradeColors[1];
            cls.color = palette[sec % palette.length];
        }
        MSM.Storage.setData('msm_classes', classes);
        renderClassList();
        if (MSM.UI) MSM.UI.showToast('Class colors updated to grade-based scheme!', 'success');
    }

    /* ------------------------------------------------------------------ */
    /*  Storage Usage                                                       */
    /* ------------------------------------------------------------------ */

    function updateStorageUsage() {
        var usage = MSM.Storage.getStorageUsage();

        // Update bar
        var fill = document.getElementById('storageBarFill');
        var usedLabel = document.getElementById('storageUsedLabel');
        var totalLabel = document.getElementById('storageTotalLabel');

        if (fill) {
            fill.style.width = Math.min(usage.percentage, 100) + '%';
            if (usage.percentage > 80) {
                fill.classList.add('storage-bar__fill--warning');
            } else {
                fill.classList.remove('storage-bar__fill--warning');
            }
        }

        if (usedLabel) {
            usedLabel.textContent = formatBytes(usage.used) + ' (' + usage.percentage + '%)';
        }
        if (totalLabel) {
            totalLabel.textContent = formatBytes(usage.total) + ' limit';
        }

        // Data breakdown
        var breakdownEl = document.getElementById('dataBreakdown');
        if (breakdownEl) {
            var categories = [
                { key: 'msm_students', label: 'Students', icon: '👥' },
                { key: 'msm_lesson_records', label: 'Lessons', icon: '📖' },
                { key: 'msm_materials', label: 'Materials', icon: '📄' },
                { key: 'msm_lesson_plans', label: 'Plans', icon: '✏️' },
                { key: 'msm_calendar_events', label: 'Events', icon: '📅' },
                { key: 'msm_assessments', label: 'Assessments', icon: '📝' },
                { key: 'msm_remedial', label: 'Remedial', icon: '⚠️' },
                { key: 'msm_classes', label: 'Classes', icon: '🏫' }
            ];

            var html = '';
            for (var i = 0; i < categories.length; i++) {
                var cat = categories[i];
                var data = MSM.Storage.getData(cat.key);
                var count = Array.isArray(data) ? data.length : 0;
                html +=
                    '<div class="data-item">' +
                        '<div class="data-item__count">' + count + '</div>' +
                        '<div class="data-item__label">' + cat.icon + ' ' + cat.label + '</div>' +
                    '</div>';
            }
            breakdownEl.innerHTML = html;
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Backup & Restore                                                    */
    /* ------------------------------------------------------------------ */

    function exportBackup() {
        var result = MSM.Storage.exportAll();
        if (result.success) {
            // Mark backup timestamp for reminder system
            if (MSM.App && MSM.App.markBackupDone) {
                MSM.App.markBackupDone();
            }
            if (MSM.UI) MSM.UI.showToast('Backup exported! Check your downloads folder.', 'success');
        } else {
            if (MSM.UI) MSM.UI.showToast('Export failed: ' + result.message, 'error');
        }
    }

    function handleImport(event) {
        var file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            if (MSM.UI) MSM.UI.showToast('Please select a .json backup file', 'warning');
            return;
        }

        // Confirm before overwriting
        var doImport = function () {
            var reader = new FileReader();
            reader.onload = function (e) {
                var result = MSM.Storage.importAll(e.target.result);
                if (result.success) {
                    if (MSM.UI) MSM.UI.showToast('Data restored successfully! Reloading...', 'success');
                    setTimeout(function () {
                        window.location.reload();
                    }, 1500);
                } else {
                    if (MSM.UI) MSM.UI.showToast('Import failed: ' + result.message, 'error');
                }
            };
            reader.onerror = function () {
                if (MSM.UI) MSM.UI.showToast('Error reading file', 'error');
            };
            reader.readAsText(file);
        };

        if (MSM.UI && MSM.UI.showConfirm) {
            MSM.UI.showConfirm(
                'This will replace ALL existing data with the backup. Are you sure?',
                doImport
            );
        } else if (confirm('This will replace ALL existing data with the backup. Are you sure?')) {
            doImport();
        }

        // Reset file input so same file can be re-selected
        event.target.value = '';
    }

    /* ------------------------------------------------------------------ */
    /*  Danger Zone                                                         */
    /* ------------------------------------------------------------------ */

    function clearAllData() {
        var doClear = function () {
            MSM.Storage.clearAll();
            if (MSM.UI) MSM.UI.showToast('All data cleared. Reloading...', 'success');
            setTimeout(function () {
                window.location.reload();
            }, 1500);
        };

        if (MSM.UI && MSM.UI.showConfirm) {
            MSM.UI.showConfirm(
                '⚠️ This will permanently delete ALL your data (students, lessons, assessments, etc.). This cannot be undone. Are you absolutely sure?',
                doClear
            );
        } else if (confirm('This will permanently delete ALL data. Are you sure?')) {
            doClear();
        }
    }

    function resetToDefaults() {
        var doReset = function () {
            MSM.Storage.clearAll();
            MSM.Storage.initDefaults();
            if (MSM.UI) MSM.UI.showToast('Reset to defaults. Reloading...', 'success');
            setTimeout(function () {
                window.location.reload();
            }, 1500);
        };

        if (MSM.UI && MSM.UI.showConfirm) {
            MSM.UI.showConfirm(
                'This will reset all settings and data to defaults. Your students, lessons, assessments, and other data will be deleted. Continue?',
                doReset
            );
        } else if (confirm('Reset all data to defaults? This cannot be undone.')) {
            doReset();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                             */
    /* ------------------------------------------------------------------ */

    function getVal(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function setVal(id, value) {
        var el = document.getElementById(id);
        if (el) el.value = value;
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        var sizes = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        if (i >= sizes.length) i = sizes.length - 1;
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    /* ------------------------------------------------------------------ */
    /*  Public API                                                          */
    /* ------------------------------------------------------------------ */

    function toggleKeyVisibility() {
        var input = document.getElementById('settApiKey');
        var btn = document.getElementById('btnToggleKey');
        if (input && btn) {
            if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Hide'; }
            else { input.type = 'password'; btn.textContent = 'Show'; }
        }
    }

    function testApiKey() {
        var key = getVal('settApiKey');
        var model = getVal('settAiModel') || 'gemini-2.5-flash';
        if (!key) { if (MSM.UI) MSM.UI.showToast('Enter an API key first', 'warning'); return; }

        if (MSM.UI) MSM.UI.showToast('Testing API key...', 'info');

        var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Say "connected" in one word.' }] }] })
        }).then(function (res) {
            if (res.ok) { if (MSM.UI) MSM.UI.showToast('API key is valid! Connection successful.', 'success'); }
            else {
                res.json().then(function (data) {
                    var msg = (data.error && data.error.message) ? data.error.message : 'HTTP ' + res.status;
                    if (MSM.UI) MSM.UI.showToast('API error: ' + msg, 'error');
                }).catch(function () {
                    if (MSM.UI) MSM.UI.showToast('API error: HTTP ' + res.status, 'error');
                });
            }
        }).catch(function (err) { if (MSM.UI) MSM.UI.showToast('Connection failed: ' + err.message, 'error'); });
    }

    window.MSM.SettingsPage = {
        init: init,
        loadSettings: loadSettings,
        saveSettings: saveSettings,
        addPeriod: addPeriod,
        removePeriod: removePeriod,
        exportBackup: exportBackup,
        handleImport: handleImport,
        clearAllData: clearAllData,
        resetToDefaults: resetToDefaults,
        toggleKeyVisibility: toggleKeyVisibility,
        testApiKey: testApiKey,
        refreshClassColors: refreshClassColors
    };

    /* ------------------------------------------------------------------ */
    /*  Bootstrap                                                           */
    /* ------------------------------------------------------------------ */

    document.addEventListener('DOMContentLoaded', function () {
        init();
    });

})();
