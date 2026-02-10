/**
 * attendance.js - Attendance Tracking Module
 *
 * Tracks per-class daily attendance for a Moroccan middle school (college).
 * Each record stores student statuses (present, absent, late) for a given
 * class on a given date.
 *
 * Persists to localStorage under key 'msm_attendance'.
 * Exposes window.MSM.Attendance.
 *
 * Depends on: MSM.Storage, MSM.UI
 */
(function () {
  'use strict';

  window.MSM = window.MSM || {};

  // Register attendance storage key if not already defined
  if (window.MSM.Storage && window.MSM.Storage.STORAGE_KEYS) {
    // Note: We use a direct localStorage key since STORAGE_KEYS is frozen
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  var STORAGE_KEY = 'msm_attendance';

  var VALID_STATUSES = ['present', 'absent', 'late'];

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Load the full attendance array from localStorage.
   * Returns an array of attendance records.
   */
  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error('[Attendance] Failed to parse localStorage data:', e);
      return [];
    }
  }

  /**
   * Persist the full attendance array to localStorage.
   */
  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('[Attendance] Failed to save to localStorage:', e);
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        if (window.MSM.UI && typeof window.MSM.UI.showToast === 'function') {
          window.MSM.UI.showToast('Storage quota exceeded. Please free up space.', 'error');
        }
      }
    }
  }

  /**
   * Generate a unique ID for an attendance record.
   */
  function _generateId() {
    return 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Return an ISO timestamp string for "now".
   */
  function _now() {
    return new Date().toISOString();
  }

  /**
   * Validate that a status string is one of the allowed values.
   */
  function _isValidStatus(status) {
    return VALID_STATUSES.indexOf(status) !== -1;
  }

  /**
   * Normalize a date to YYYY-MM-DD string format.
   * Accepts Date objects, ISO strings, or YYYY-MM-DD strings.
   */
  function _normalizeDate(date) {
    if (!date) return null;
    if (typeof date === 'string') {
      // Already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
      // Try to parse ISO string or other format
      var parsed = new Date(date);
      if (isNaN(parsed.getTime())) return null;
      return parsed.toISOString().slice(0, 10);
    }
    if (date instanceof Date) {
      if (isNaN(date.getTime())) return null;
      return date.toISOString().slice(0, 10);
    }
    return null;
  }

  /**
   * Find the index of a record matching classId and date.
   * Returns -1 if not found.
   */
  function _findIndex(data, classId, dateStr) {
    for (var i = 0; i < data.length; i++) {
      if (data[i].classId === classId && data[i].date === dateStr) {
        return i;
      }
    }
    return -1;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get attendance record for a specific class and date.
   *
   * @param {string} classId - The class identifier.
   * @param {string|Date} date - The date (YYYY-MM-DD string or Date object).
   * @returns {object|null} The attendance record, or null if not found.
   */
  function getAttendance(classId, date) {
    if (!classId || !date) return null;

    var dateStr = _normalizeDate(date);
    if (!dateStr) return null;

    var data = _load();
    var index = _findIndex(data, classId, dateStr);

    if (index === -1) return null;
    return data[index];
  }

  /**
   * Save or update attendance for a class on a given date.
   *
   * If a record already exists for that class+date, it will be updated.
   * Otherwise a new record is created.
   *
   * @param {string} classId - The class identifier.
   * @param {string|Date} date - The date (YYYY-MM-DD string or Date object).
   * @param {Array} studentStatuses - Array of { studentId, status } objects.
   *   Status must be 'present', 'absent', or 'late'.
   * @returns {object|null} The saved attendance record, or null on failure.
   */
  function saveAttendance(classId, date, studentStatuses) {
    if (!classId || !date) {
      console.warn('[Attendance] saveAttendance: classId and date are required.');
      return null;
    }

    var dateStr = _normalizeDate(date);
    if (!dateStr) {
      console.warn('[Attendance] saveAttendance: invalid date provided.');
      return null;
    }

    if (!Array.isArray(studentStatuses) || studentStatuses.length === 0) {
      console.warn('[Attendance] saveAttendance: studentStatuses must be a non-empty array.');
      return null;
    }

    // Validate and normalize student statuses
    var normalizedRecords = [];
    for (var i = 0; i < studentStatuses.length; i++) {
      var entry = studentStatuses[i];
      if (!entry || !entry.studentId) {
        console.warn('[Attendance] Skipping invalid entry at index ' + i + ': missing studentId.');
        continue;
      }
      if (!_isValidStatus(entry.status)) {
        console.warn('[Attendance] Skipping entry for student "' + entry.studentId + '": invalid status "' + entry.status + '". Must be one of: ' + VALID_STATUSES.join(', '));
        continue;
      }
      normalizedRecords.push({
        studentId: String(entry.studentId),
        status: entry.status
      });
    }

    if (normalizedRecords.length === 0) {
      console.warn('[Attendance] saveAttendance: no valid student statuses after validation.');
      return null;
    }

    var data = _load();
    var index = _findIndex(data, classId, dateStr);

    var record;
    if (index !== -1) {
      // Update existing record
      record = data[index];
      record.records = normalizedRecords;
      record.updatedAt = _now();
      data[index] = record;
    } else {
      // Create new record
      record = {
        id: _generateId(),
        classId: classId,
        date: dateStr,
        records: normalizedRecords,
        createdAt: _now()
      };
      data.push(record);
    }

    _save(data);
    return record;
  }

  /**
   * Get an attendance summary for a class across all recorded dates.
   *
   * @param {string} classId - The class identifier.
   * @returns {object} Summary object with:
   *   - totalSessions {number}: total number of attendance sessions recorded
   *   - absentCounts {object}: map of studentId -> number of absences
   *   - lateCounts {object}: map of studentId -> number of late arrivals
   */
  function getClassAttendanceSummary(classId) {
    var result = {
      totalSessions: 0,
      absentCounts: {},
      lateCounts: {}
    };

    if (!classId) return result;

    var data = _load();

    for (var i = 0; i < data.length; i++) {
      var record = data[i];
      if (record.classId !== classId) continue;

      result.totalSessions++;

      if (!Array.isArray(record.records)) continue;

      for (var j = 0; j < record.records.length; j++) {
        var entry = record.records[j];
        var sid = entry.studentId;

        if (entry.status === 'absent') {
          if (!result.absentCounts.hasOwnProperty(sid)) {
            result.absentCounts[sid] = 0;
          }
          result.absentCounts[sid]++;
        } else if (entry.status === 'late') {
          if (!result.lateCounts.hasOwnProperty(sid)) {
            result.lateCounts[sid] = 0;
          }
          result.lateCounts[sid]++;
        }
      }
    }

    return result;
  }

  /**
   * Get attendance statistics for a specific student across all classes.
   *
   * @param {string} studentId - The student identifier.
   * @returns {object} Statistics object with:
   *   - present {number}: number of times marked present
   *   - absent {number}: number of times marked absent
   *   - late {number}: number of times marked late
   *   - total {number}: total attendance entries for this student
   *   - rate {number}: attendance rate as a percentage (0-100), counting
   *     'present' and 'late' as attended. 0 if no records.
   */
  function getStudentAttendance(studentId) {
    var result = {
      present: 0,
      absent: 0,
      late: 0,
      total: 0,
      rate: 0
    };

    if (!studentId) return result;

    var sid = String(studentId);
    var data = _load();

    for (var i = 0; i < data.length; i++) {
      var record = data[i];
      if (!Array.isArray(record.records)) continue;

      for (var j = 0; j < record.records.length; j++) {
        var entry = record.records[j];
        if (entry.studentId !== sid) continue;

        result.total++;

        if (entry.status === 'present') {
          result.present++;
        } else if (entry.status === 'absent') {
          result.absent++;
        } else if (entry.status === 'late') {
          result.late++;
        }
      }
    }

    // Calculate attendance rate: present + late count as "attended"
    if (result.total > 0) {
      result.rate = Math.round(((result.present + result.late) / result.total) * 100);
    }

    return result;
  }

  /**
   * Get all attendance records for a class within a date range (inclusive).
   *
   * @param {string} classId - The class identifier.
   * @param {string|Date} startDate - Start of range (YYYY-MM-DD or Date).
   * @param {string|Date} endDate - End of range (YYYY-MM-DD or Date).
   * @returns {Array} Array of attendance records within the range, sorted by date ascending.
   */
  function getDateRange(classId, startDate, endDate) {
    if (!classId || !startDate || !endDate) return [];

    var start = _normalizeDate(startDate);
    var end = _normalizeDate(endDate);
    if (!start || !end) return [];

    var data = _load();
    var results = [];

    for (var i = 0; i < data.length; i++) {
      var record = data[i];
      if (record.classId !== classId) continue;
      if (!record.date) continue;

      // String comparison works for YYYY-MM-DD format
      if (record.date >= start && record.date <= end) {
        results.push(record);
      }
    }

    // Sort by date ascending
    results.sort(function (a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });

    return results;
  }

  /**
   * Delete an attendance record for a specific class and date.
   *
   * @param {string} classId - The class identifier.
   * @param {string|Date} date - The date (YYYY-MM-DD string or Date object).
   * @returns {boolean} true if a record was removed, false otherwise.
   */
  function deleteAttendance(classId, date) {
    if (!classId || !date) return false;

    var dateStr = _normalizeDate(date);
    if (!dateStr) return false;

    var data = _load();
    var index = _findIndex(data, classId, dateStr);

    if (index === -1) return false;

    data.splice(index, 1);
    _save(data);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Expose public API
  // ---------------------------------------------------------------------------
  window.MSM.Attendance = {
    getAttendance: getAttendance,
    saveAttendance: saveAttendance,
    getClassAttendanceSummary: getClassAttendanceSummary,
    getStudentAttendance: getStudentAttendance,
    getDateRange: getDateRange,
    deleteAttendance: deleteAttendance
  };

})();
