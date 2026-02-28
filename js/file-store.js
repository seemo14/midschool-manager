/**
 * MidSchool Manager - File Store
 *
 * IndexedDB wrapper for storing HTML lesson file content.
 * Metadata (title, classIds, etc.) lives in localStorage via MSM.Storage.
 * Actual HTML content lives here (avoids 5 MB localStorage limit).
 *
 * Attaches to window.MSM.FileStore via IIFE pattern.
 */
(function () {
    'use strict';

    window.MSM = window.MSM || {};

    var DB_NAME    = 'msm_files_db';
    var DB_VERSION = 1;
    var STORE_NAME = 'html_files';

    // ---------------------------------------------------------------------------
    // Internal helper: open (or create) the database
    // ---------------------------------------------------------------------------
    function openDB() {
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };

            req.onsuccess  = function (e) { resolve(e.target.result); };
            req.onerror    = function (e) { reject(e.target.error); };
            req.onblocked  = function ()  { reject(new Error('IndexedDB blocked')); };
        });
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    /**
     * Save (or overwrite) the HTML content for a file entry.
     * @param {string} id      - The lesson-file ID (e.g. "lf_abc123")
     * @param {string} content - Raw HTML string
     * @returns {Promise<void>}
     */
    function saveFile(id, content) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx  = db.transaction(STORE_NAME, 'readwrite');
                var str = tx.objectStore(STORE_NAME);
                var req = str.put({ id: id, content: content, savedAt: new Date().toISOString() });
                req.onsuccess = function () { resolve(); };
                req.onerror   = function (e) { reject(e.target.error); };
            });
        });
    }

    /**
     * Retrieve the HTML content for a file entry.
     * @param {string} id
     * @returns {Promise<string|null>} HTML string, or null if not found
     */
    function getFile(id) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx  = db.transaction(STORE_NAME, 'readonly');
                var str = tx.objectStore(STORE_NAME);
                var req = str.get(id);
                req.onsuccess = function (e) {
                    var rec = e.target.result;
                    resolve(rec ? rec.content : null);
                };
                req.onerror = function (e) { reject(e.target.error); };
            });
        });
    }

    /**
     * Delete the HTML content for a file entry.
     * @param {string} id
     * @returns {Promise<void>}
     */
    function deleteFile(id) {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx  = db.transaction(STORE_NAME, 'readwrite');
                var str = tx.objectStore(STORE_NAME);
                var req = str.delete(id);
                req.onsuccess = function () { resolve(); };
                req.onerror   = function (e) { reject(e.target.error); };
            });
        });
    }

    /**
     * Return all stored file IDs (for housekeeping / orphan detection).
     * @returns {Promise<string[]>}
     */
    function getAllIds() {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx  = db.transaction(STORE_NAME, 'readonly');
                var str = tx.objectStore(STORE_NAME);
                var req = str.getAllKeys();
                req.onsuccess = function (e) { resolve(e.target.result || []); };
                req.onerror   = function (e) { reject(e.target.error); };
            });
        });
    }

    /**
     * Wipe all stored HTML content (used during full data clear).
     * @returns {Promise<void>}
     */
    function clearAll() {
        return openDB().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx  = db.transaction(STORE_NAME, 'readwrite');
                var str = tx.objectStore(STORE_NAME);
                var req = str.clear();
                req.onsuccess = function () { resolve(); };
                req.onerror   = function (e) { reject(e.target.error); };
            });
        });
    }

    // ---------------------------------------------------------------------------
    // Expose
    // ---------------------------------------------------------------------------
    window.MSM.FileStore = {
        save:      saveFile,
        get:       getFile,
        delete:    deleteFile,
        getAllIds:  getAllIds,
        clearAll:  clearAll
    };

})();
