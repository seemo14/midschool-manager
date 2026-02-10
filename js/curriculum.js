/**
 * curriculum.js - Curriculum Progress Tracker
 *
 * Tracks per-class curriculum unit progress for a Moroccan middle school (college).
 * 13 classes: 1AC-1..1AC-5, 2AC-1..2AC-4, 3AC-1..3AC-4.
 *
 * Persists to localStorage under key 'msm_curriculum_progress'.
 * Exposes window.MSM.Curriculum.
 */
(function () {
  'use strict';

  window.MSM = window.MSM || {};

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var STORAGE_KEY = 'msm_curriculum_progress';

  var VALID_STATUSES = ['not_started', 'in_progress', 'completed'];

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Load the full progress map from localStorage.
   * Returns an object keyed by classId.
   */
  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      // Guard against corrupt data
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      return parsed;
    } catch (e) {
      console.error('[Curriculum] Failed to parse localStorage data:', e);
      return {};
    }
  }

  /**
   * Persist the full progress map to localStorage.
   */
  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[Curriculum] Failed to save to localStorage:', e);
    }
  }

  /**
   * Return an ISO timestamp string for "now".
   */
  function _now() {
    return new Date().toISOString();
  }

  /**
   * Return a date string in YYYY-MM-DD format for "today".
   */
  function _today() {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Determine the current unit from the units array.
   * Priority: first unit with status 'in_progress'. If none, first 'not_started'.
   * If all completed, returns the last unit id (or null if empty).
   */
  function _deriveCurrentUnit(units) {
    if (!Array.isArray(units) || units.length === 0) return null;

    for (var i = 0; i < units.length; i++) {
      if (units[i].status === 'in_progress') return units[i].id;
    }
    for (var j = 0; j < units.length; j++) {
      if (units[j].status === 'not_started') return units[j].id;
    }
    // All completed - return last unit
    return units[units.length - 1].id;
  }

  /**
   * Detect year level from a classId string.
   * Looks up the class in MSM storage if available, otherwise infers from the
   * progress record or returns null.
   */
  function _inferYearLevel(classId, record) {
    if (record && record.yearLevel) return record.yearLevel;
    // Try to look up from existing progress data
    var data = _load();
    if (data[classId] && data[classId].yearLevel) return data[classId].yearLevel;
    return null;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get curriculum progress for a specific class.
   * @param {string} classId
   * @returns {object|null} The progress record, or null if not found.
   */
  function getProgress(classId) {
    if (!classId) return null;
    var data = _load();
    return data[classId] || null;
  }

  /**
   * Get all curriculum progress data.
   * @returns {object} Map of classId -> progress record. Empty object if none.
   */
  function getAllProgress() {
    return _load();
  }

  /**
   * Update a unit's status for a given class.
   * Automatically updates currentUnit, completedDate, and lastUpdated.
   *
   * @param {string} classId
   * @param {string} unitId
   * @param {string} status - 'not_started' | 'in_progress' | 'completed'
   * @returns {boolean} true if successful, false otherwise.
   */
  function setUnitStatus(classId, unitId, status) {
    if (!classId || !unitId || !status) return false;
    if (VALID_STATUSES.indexOf(status) === -1) {
      console.warn('[Curriculum] Invalid status "' + status + '". Must be one of:', VALID_STATUSES.join(', '));
      return false;
    }

    var data = _load();
    var record = data[classId];
    if (!record) {
      console.warn('[Curriculum] No curriculum data found for class "' + classId + '". Call initCurriculum first.');
      return false;
    }

    if (!Array.isArray(record.units)) {
      console.warn('[Curriculum] Corrupted units array for class "' + classId + '".');
      return false;
    }

    var unitFound = false;
    for (var i = 0; i < record.units.length; i++) {
      if (record.units[i].id === unitId) {
        record.units[i].status = status;
        // Set or clear completedDate
        if (status === 'completed') {
          record.units[i].completedDate = record.units[i].completedDate || _today();
        } else {
          record.units[i].completedDate = null;
        }
        unitFound = true;
        break;
      }
    }

    if (!unitFound) {
      console.warn('[Curriculum] Unit "' + unitId + '" not found in class "' + classId + '".');
      return false;
    }

    // Recompute currentUnit
    record.currentUnit = _deriveCurrentUnit(record.units);
    record.lastUpdated = _now();

    data[classId] = record;
    _save(data);
    return true;
  }

  /**
   * Flag a class as behind schedule.
   * @param {string} classId
   * @param {string} reason - human-readable explanation
   * @returns {boolean} true if successful.
   */
  function markBehind(classId, reason) {
    if (!classId) return false;

    var data = _load();
    var record = data[classId];
    if (!record) {
      console.warn('[Curriculum] No curriculum data found for class "' + classId + '".');
      return false;
    }

    record.behindSchedule = true;
    record.behindReason = typeof reason === 'string' ? reason : '';
    record.lastUpdated = _now();

    data[classId] = record;
    _save(data);
    return true;
  }

  /**
   * Clear the behind-schedule flag for a class.
   * @param {string} classId
   * @returns {boolean} true if successful.
   */
  function clearBehind(classId) {
    if (!classId) return false;

    var data = _load();
    var record = data[classId];
    if (!record) {
      console.warn('[Curriculum] No curriculum data found for class "' + classId + '".');
      return false;
    }

    record.behindSchedule = false;
    record.behindReason = '';
    record.lastUpdated = _now();

    data[classId] = record;
    _save(data);
    return true;
  }

  /**
   * Initialize curriculum units for a class.
   * If the class already has progress data, it will be replaced.
   *
   * @param {string} classId
   * @param {Array} units - Array of { id, name } objects describing curriculum units.
   *                        Status defaults to 'not_started', completedDate to null.
   * @param {number} [yearLevel] - Optional year level (1, 2, or 3).
   * @returns {object|null} The created progress record, or null on failure.
   */
  function initCurriculum(classId, units, yearLevel) {
    if (!classId) return null;
    if (!Array.isArray(units) || units.length === 0) {
      console.warn('[Curriculum] units must be a non-empty array.');
      return null;
    }

    var normalizedUnits = [];
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (!u || !u.id || !u.name) {
        console.warn('[Curriculum] Skipping invalid unit at index ' + i + ':', u);
        continue;
      }
      var validStatus = (u.status && VALID_STATUSES.indexOf(u.status) !== -1) ? u.status : 'not_started';
      normalizedUnits.push({
        id: String(u.id),
        name: String(u.name),
        status: validStatus,
        completedDate: validStatus === 'completed' ? (u.completedDate || _today()) : null
      });
    }

    if (normalizedUnits.length === 0) {
      console.warn('[Curriculum] No valid units provided.');
      return null;
    }

    var record = {
      classId: classId,
      yearLevel: typeof yearLevel === 'number' ? yearLevel : null,
      units: normalizedUnits,
      currentUnit: _deriveCurrentUnit(normalizedUnits),
      behindSchedule: false,
      behindReason: '',
      lastUpdated: _now()
    };

    var data = _load();
    data[classId] = record;
    _save(data);

    return record;
  }

  /**
   * Get a summary object for a class's curriculum progress.
   *
   * @param {string} classId
   * @returns {object|null} Summary object or null if no data.
   *   { total, completed, inProgress, notStarted, percentComplete,
   *     behindSchedule, behindReason, currentUnit }
   */
  function getClassSummary(classId) {
    if (!classId) return null;

    var data = _load();
    var record = data[classId];
    if (!record) return null;

    var units = Array.isArray(record.units) ? record.units : [];
    var total = units.length;
    var completed = 0;
    var inProgress = 0;
    var notStarted = 0;

    for (var i = 0; i < units.length; i++) {
      switch (units[i].status) {
        case 'completed':
          completed++;
          break;
        case 'in_progress':
          inProgress++;
          break;
        default:
          notStarted++;
          break;
      }
    }

    return {
      total: total,
      completed: completed,
      inProgress: inProgress,
      notStarted: notStarted,
      percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
      behindSchedule: !!record.behindSchedule,
      behindReason: record.behindReason || '',
      currentUnit: record.currentUnit || null
    };
  }

  /**
   * Get summaries for all classes that have curriculum data.
   * @returns {Array} Array of { classId, yearLevel, ...summary } objects.
   */
  function getAllSummaries() {
    var data = _load();
    var summaries = [];

    var classIds = Object.keys(data);
    for (var i = 0; i < classIds.length; i++) {
      var classId = classIds[i];
      var summary = getClassSummary(classId);
      if (summary) {
        summary.classId = classId;
        summary.yearLevel = data[classId].yearLevel || null;
        summaries.push(summary);
      }
    }

    return summaries;
  }

  /**
   * Get list of classes flagged as behind schedule.
   * @returns {Array} Array of { classId, yearLevel, behindReason, currentUnit, percentComplete }.
   */
  function getBehindClasses() {
    var data = _load();
    var behind = [];

    var classIds = Object.keys(data);
    for (var i = 0; i < classIds.length; i++) {
      var classId = classIds[i];
      var record = data[classId];

      if (record && record.behindSchedule) {
        var summary = getClassSummary(classId);
        behind.push({
          classId: classId,
          yearLevel: record.yearLevel || null,
          behindReason: record.behindReason || '',
          currentUnit: record.currentUnit || null,
          percentComplete: summary ? summary.percentComplete : 0
        });
      }
    }

    return behind;
  }

  // ---------------------------------------------------------------------------
  // Expose public API
  // ---------------------------------------------------------------------------
  window.MSM.Curriculum = {
    getProgress: getProgress,
    getAllProgress: getAllProgress,
    setUnitStatus: setUnitStatus,
    markBehind: markBehind,
    clearBehind: clearBehind,
    initCurriculum: initCurriculum,
    getClassSummary: getClassSummary,
    getAllSummaries: getAllSummaries,
    getBehindClasses: getBehindClasses
  };

})();
