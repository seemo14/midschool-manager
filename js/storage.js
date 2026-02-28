/**
 * MidSchool Manager - Storage Abstraction Layer
 *
 * All data is persisted in localStorage as JSON strings under namespaced keys.
 * Attached to window.MSM.Storage via IIFE pattern.
 */
(function () {
    'use strict';

    // Ensure global namespace exists
    window.MSM = window.MSM || {};

    // ---------------------------------------------------------------------------
    // Storage key constants
    // ---------------------------------------------------------------------------
    var STORAGE_KEYS = Object.freeze({
        CLASSES:          'msm_classes',
        STUDENTS:         'msm_students',
        LESSON_RECORDS:   'msm_lesson_records',
        MATERIALS:        'msm_materials',
        LESSON_PLANS:     'msm_lesson_plans',
        LESSON_FILES:     'msm_lesson_files',
        CALENDAR_EVENTS:  'msm_calendar_events',
        ASSESSMENTS:      'msm_assessments',
        REMEDIAL:         'msm_remedial',
        SETTINGS:         'msm_settings'
    });

    // Keys that hold arrays (everything except SETTINGS)
    var ARRAY_KEYS = [
        STORAGE_KEYS.CLASSES,
        STORAGE_KEYS.STUDENTS,
        STORAGE_KEYS.LESSON_RECORDS,
        STORAGE_KEYS.MATERIALS,
        STORAGE_KEYS.LESSON_PLANS,
        STORAGE_KEYS.LESSON_FILES,
        STORAGE_KEYS.CALENDAR_EVENTS,
        STORAGE_KEYS.ASSESSMENTS,
        STORAGE_KEYS.REMEDIAL
    ];

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    /**
     * Determine whether a given key is expected to hold an array.
     */
    function isArrayKey(key) {
        return ARRAY_KEYS.indexOf(key) !== -1;
    }

    /**
     * Zero-pad a number to the requested width.
     */
    function zeroPad(num, width) {
        var s = String(num);
        while (s.length < width) {
            s = '0' + s;
        }
        return s;
    }

    /**
     * Return an ISO-8601 date string (YYYY-MM-DD) for today.
     */
    function todayISO() {
        var d = new Date();
        return d.getFullYear() + '-' + zeroPad(d.getMonth() + 1, 2) + '-' + zeroPad(d.getDate(), 2);
    }

    // ---------------------------------------------------------------------------
    // Core CRUD
    // ---------------------------------------------------------------------------

    /**
     * Parse and return data stored under `key`.
     *  - Array keys  -> returns [] when missing or on parse error.
     *  - SETTINGS    -> returns {} when missing or on parse error.
     *  - Unknown key -> returns null when missing.
     */
    function getData(key) {
        try {
            var raw = localStorage.getItem(key);
            if (raw === null) {
                if (key === STORAGE_KEYS.SETTINGS) return {};
                if (isArrayKey(key)) return [];
                return null;
            }
            return JSON.parse(raw);
        } catch (e) {
            console.error('[MSM.Storage] getData parse error for "' + key + '":', e);
            if (key === STORAGE_KEYS.SETTINGS) return {};
            if (isArrayKey(key)) return [];
            return null;
        }
    }

    /**
     * Stringify `data` and persist under `key`.
     * Returns true on success, false on quota / write errors.
     */
    function setData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('[MSM.Storage] setData error for "' + key + '":', e);
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                alert('Storage quota exceeded. Please free up space by exporting and clearing old data.');
            }
            return false;
        }
    }

    /**
     * Append `item` to the array stored at `key`.
     * Returns the item on success, null on failure.
     */
    function addItem(key, item) {
        try {
            var arr = getData(key);
            if (!Array.isArray(arr)) {
                console.error('[MSM.Storage] addItem: "' + key + '" does not hold an array.');
                return null;
            }
            arr.push(item);
            setData(key, arr);
            return item;
        } catch (e) {
            console.error('[MSM.Storage] addItem error:', e);
            return null;
        }
    }

    /**
     * Find the item whose `id` matches inside the array at `key`,
     * merge `updates` into it, save, and return the updated item.
     * Returns null if not found or on error.
     */
    function updateItem(key, id, updates) {
        try {
            var arr = getData(key);
            if (!Array.isArray(arr)) return null;

            var index = -1;
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].id === id) {
                    index = i;
                    break;
                }
            }
            if (index === -1) return null;

            // Merge updates
            var item = arr[index];
            for (var prop in updates) {
                if (updates.hasOwnProperty(prop)) {
                    item[prop] = updates[prop];
                }
            }
            arr[index] = item;
            setData(key, arr);
            return item;
        } catch (e) {
            console.error('[MSM.Storage] updateItem error:', e);
            return null;
        }
    }

    /**
     * Remove the item with the given `id` from the array at `key`.
     * Returns true if an item was removed, false otherwise.
     */
    function deleteItem(key, id) {
        try {
            var arr = getData(key);
            if (!Array.isArray(arr)) return false;

            var initialLength = arr.length;
            var filtered = [];
            for (var i = 0; i < arr.length; i++) {
                if (!arr[i] || arr[i].id !== id) {
                    filtered.push(arr[i]);
                }
            }

            if (filtered.length === initialLength) return false;

            setData(key, filtered);
            return true;
        } catch (e) {
            console.error('[MSM.Storage] deleteItem error:', e);
            return false;
        }
    }

    /**
     * Return a single item by `id` from the array at `key`, or null.
     */
    function getById(key, id) {
        try {
            var arr = getData(key);
            if (!Array.isArray(arr)) return null;

            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].id === id) {
                    return arr[i];
                }
            }
            return null;
        } catch (e) {
            console.error('[MSM.Storage] getById error:', e);
            return null;
        }
    }

    /**
     * Return items from the array at `key` that pass `filterFn`.
     */
    function query(key, filterFn) {
        try {
            var arr = getData(key);
            if (!Array.isArray(arr)) return [];
            if (typeof filterFn !== 'function') return arr;

            var results = [];
            for (var i = 0; i < arr.length; i++) {
                if (filterFn(arr[i])) {
                    results.push(arr[i]);
                }
            }
            return results;
        } catch (e) {
            console.error('[MSM.Storage] query error:', e);
            return [];
        }
    }

    // ---------------------------------------------------------------------------
    // Import / Export
    // ---------------------------------------------------------------------------

    /**
     * Gather every msm_* key into a JSON envelope and trigger a browser
     * file download named "midschool-backup-YYYY-MM-DD.json".
     */
    function exportAll() {
        try {
            var data = {};
            var keys = Object.keys(STORAGE_KEYS);
            for (var i = 0; i < keys.length; i++) {
                var storageKey = STORAGE_KEYS[keys[i]];
                data[storageKey] = getData(storageKey);
            }

            var envelope = {
                appName:    'MidSchool Manager',
                version:    '1.0.0',
                exportDate: new Date().toISOString(),
                data:       data
            };

            var json = JSON.stringify(envelope, null, 2);
            var blob = new Blob([json], { type: 'application/json' });
            var url  = URL.createObjectURL(blob);

            var a = document.createElement('a');
            a.href     = url;
            a.download = 'midschool-backup-' + todayISO() + '.json';
            document.body.appendChild(a);
            a.click();

            // Cleanup
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            return { success: true, message: 'Backup exported successfully.' };
        } catch (e) {
            console.error('[MSM.Storage] exportAll error:', e);
            return { success: false, message: 'Export failed: ' + e.message };
        }
    }

    /**
     * Parse `jsonString`, validate it carries the expected structure,
     * and replace all msm_* keys in localStorage.
     *
     * @param  {string} jsonString  Raw JSON text from a backup file.
     * @return {{success: boolean, message: string}}
     */
    function importAll(jsonString) {
        try {
            var envelope = JSON.parse(jsonString);

            // Validate structure
            if (!envelope || !envelope.appName || !envelope.data) {
                return { success: false, message: 'Invalid backup file: missing appName or data.' };
            }
            if (envelope.appName !== 'MidSchool Manager') {
                return { success: false, message: 'Invalid backup file: unrecognised appName "' + envelope.appName + '".' };
            }
            if (typeof envelope.data !== 'object' || envelope.data === null) {
                return { success: false, message: 'Invalid backup file: data must be an object.' };
            }

            // Clear existing data first
            clearAll();

            // Write each key from the backup
            var dataKeys = Object.keys(envelope.data);
            for (var i = 0; i < dataKeys.length; i++) {
                var k = dataKeys[i];
                // Only restore keys within our namespace
                if (k.indexOf('msm_') === 0) {
                    setData(k, envelope.data[k]);
                }
            }

            return { success: true, message: 'Backup imported successfully (' + dataKeys.length + ' keys restored).' };
        } catch (e) {
            console.error('[MSM.Storage] importAll error:', e);
            return { success: false, message: 'Import failed: ' + e.message };
        }
    }

    // ---------------------------------------------------------------------------
    // Housekeeping
    // ---------------------------------------------------------------------------

    /**
     * Calculate the total bytes consumed by all msm_* keys.
     *
     * @return {{used: number, total: number, percentage: number}}
     */
    function getStorageUsage() {
        var totalBytes = 0;
        try {
            var keys = Object.keys(STORAGE_KEYS);
            for (var i = 0; i < keys.length; i++) {
                var storageKey = STORAGE_KEYS[keys[i]];
                var raw = localStorage.getItem(storageKey);
                if (raw !== null) {
                    // Each JS char is 2 bytes in UTF-16, but localStorage
                    // implementations typically count chars. We count the
                    // key length + value length (as chars) for a reasonable
                    // approximation.
                    totalBytes += (storageKey.length + raw.length) * 2;
                }
            }
        } catch (e) {
            console.error('[MSM.Storage] getStorageUsage error:', e);
        }

        var total = 5242880; // 5 MB
        return {
            used:       totalBytes,
            total:      total,
            percentage: total > 0 ? parseFloat(((totalBytes / total) * 100).toFixed(2)) : 0
        };
    }

    /**
     * Remove every msm_* key from localStorage.
     */
    function clearAll() {
        try {
            var keys = Object.keys(STORAGE_KEYS);
            for (var i = 0; i < keys.length; i++) {
                localStorage.removeItem(STORAGE_KEYS[keys[i]]);
            }
        } catch (e) {
            console.error('[MSM.Storage] clearAll error:', e);
        }
    }

    // ---------------------------------------------------------------------------
    // Default seed data
    // ---------------------------------------------------------------------------

    /**
     * If msm_settings does not yet exist, seed the application with default
     * classes, settings, and empty collections.
     */
    function initDefaults() {
        // Only seed when settings are absent (first launch)
        if (localStorage.getItem(STORAGE_KEYS.SETTINGS) !== null) {
            return;
        }

        var now = new Date().toISOString();

        // ----- Default classes -----
        var classDefinitions = [
            // 1AC = Blue family (5 distinct blues)
            { name: '1AC-1', year: 1, label: '1AC', section: 1, color: '#2563EB' },
            { name: '1AC-2', year: 1, label: '1AC', section: 2, color: '#3B82F6' },
            { name: '1AC-3', year: 1, label: '1AC', section: 3, color: '#0EA5E9' },
            { name: '1AC-4', year: 1, label: '1AC', section: 4, color: '#6366F1' },
            { name: '1AC-5', year: 1, label: '1AC', section: 5, color: '#0284C7' },
            // 2AC = Green/Teal family (4 distinct greens)
            { name: '2AC-1', year: 2, label: '2AC', section: 1, color: '#059669' },
            { name: '2AC-2', year: 2, label: '2AC', section: 2, color: '#10B981' },
            { name: '2AC-3', year: 2, label: '2AC', section: 3, color: '#0D9488' },
            { name: '2AC-4', year: 2, label: '2AC', section: 4, color: '#16A34A' },
            // 3AC = Purple/Rose family (4 distinct purples)
            { name: '3AC-1', year: 3, label: '3AC', section: 1, color: '#7C3AED' },
            { name: '3AC-2', year: 3, label: '3AC', section: 2, color: '#A855F7' },
            { name: '3AC-3', year: 3, label: '3AC', section: 3, color: '#9333EA' },
            { name: '3AC-4', year: 3, label: '3AC', section: 4, color: '#8B5CF6' }
        ];

        var classes = [];
        for (var i = 0; i < classDefinitions.length; i++) {
            var def = classDefinitions[i];
            classes.push({
                id:           'cls_' + zeroPad(i + 1, 3),
                name:         def.name,
                year:         def.year,
                label:        def.label,
                section:      def.section,
                studentCount: 0,
                color:        def.color,
                createdAt:    now
            });
        }

        // ----- Default settings -----
        var settings = {
            teacherName:   '',
            schoolName:    '',
            academicYear:  '2025-2026',
            gradingScale:  20,
            schedule: {
                periods: [
                    { id: 'p1', label: 'Period 1', start: '08:30', end: '09:30' },
                    { id: 'p2', label: 'Period 2', start: '09:30', end: '10:30' },
                    { id: 'p3', label: 'Period 3', start: '10:30', end: '11:30' },
                    { id: 'p4', label: 'Period 4', start: '11:30', end: '12:30' },
                    { id: 'p5', label: 'Period 5', start: '14:30', end: '15:30' },
                    { id: 'p6', label: 'Period 6', start: '15:30', end: '16:30' },
                    { id: 'p7', label: 'Period 7', start: '16:30', end: '17:30' }
                ],
                days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            },
            semesters: {
                semester1: {
                    label: 'Semester 1',
                    start: '2025-09-01',
                    end:   '2026-01-31'
                },
                semester2: {
                    label: 'Semester 2',
                    start: '2026-02-01',
                    end:   '2026-06-30'
                }
            }
        };

        // ----- Persist everything -----
        setData(STORAGE_KEYS.CLASSES,          classes);
        setData(STORAGE_KEYS.STUDENTS,         []);
        setData(STORAGE_KEYS.LESSON_RECORDS,   []);
        setData(STORAGE_KEYS.MATERIALS,        []);
        setData(STORAGE_KEYS.LESSON_PLANS,     []);
        setData(STORAGE_KEYS.LESSON_FILES,     []);
        setData(STORAGE_KEYS.CALENDAR_EVENTS,  []);
        setData(STORAGE_KEYS.ASSESSMENTS,      []);
        setData(STORAGE_KEYS.REMEDIAL,         []);
        setData(STORAGE_KEYS.SETTINGS,         settings);

        console.log('[MSM.Storage] Default data seeded successfully.');
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    window.MSM.Storage = {
        // Constants
        STORAGE_KEYS: STORAGE_KEYS,

        // Core CRUD
        getData:    getData,
        setData:    setData,
        addItem:    addItem,
        updateItem: updateItem,
        deleteItem: deleteItem,
        getById:    getById,
        query:      query,

        // Import / Export
        exportAll:  exportAll,
        importAll:  importAll,

        // Housekeeping
        getStorageUsage: getStorageUsage,
        clearAll:        clearAll,
        initDefaults:    initDefaults
    };

})();
