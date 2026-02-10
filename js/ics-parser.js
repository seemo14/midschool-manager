/**
 * ICS (iCalendar) Parser Module for MidSchool Management App
 * Parses .ics file content into structured event objects for the calendar.
 *
 * Handles:
 *  - VEVENT component extraction
 *  - ICS date formats: YYYYMMDD, YYYYMMDDTHHMMSS, YYYYMMDDTHHMMSSZ
 *  - Multi-day events (split into individual day entries)
 *  - Folded lines (RFC 5545 line unfolding)
 *  - CRLF and LF line endings
 *  - Basic RRULE recurrence (DAILY, WEEKLY, MONTHLY, YEARLY with COUNT/UNTIL)
 *  - Event type detection from keywords (French and English)
 *  - Missing or malformed fields (graceful fallbacks)
 *
 * Attaches to window.MSM.ICS via IIFE pattern.
 */
(function () {
    'use strict';

    // Ensure namespace exists
    window.MSM = window.MSM || {};

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /**
     * Unfold ICS content: lines that start with a space or tab are
     * continuations of the previous line (RFC 5545 Section 3.1).
     *
     * @param {string} text - Raw ICS text
     * @returns {string} Text with folded lines joined
     */
    function unfoldLines(text) {
        // Normalise line endings to \n
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Join continuation lines (line starting with space or tab)
        text = text.replace(/\n[ \t]/g, '');
        return text;
    }

    /**
     * Parse a single ICS property line into key and value.
     * Handles parameters (e.g. DTSTART;VALUE=DATE:20240101).
     *
     * @param {string} line - A single unfolded ICS line
     * @returns {{key: string, params: string, value: string}|null}
     */
    function parseLine(line) {
        var colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
            return null;
        }

        var left = line.substring(0, colonIdx);
        var value = line.substring(colonIdx + 1);

        // Separate property name from parameters (semicolon-delimited)
        var semiIdx = left.indexOf(';');
        var key, params;
        if (semiIdx !== -1) {
            key = left.substring(0, semiIdx).toUpperCase();
            params = left.substring(semiIdx + 1);
        } else {
            key = left.toUpperCase();
            params = '';
        }

        return { key: key, params: params, value: value };
    }

    /**
     * Parse an ICS date/datetime string into { date: 'YYYY-MM-DD', time: 'HH:MM' | '' }.
     *
     * Supported formats:
     *  - YYYYMMDD           (date only)
     *  - YYYYMMDDTHHMMSS    (local datetime)
     *  - YYYYMMDDTHHMMSSZ   (UTC datetime)
     *
     * @param {string} raw - The raw ICS date string
     * @returns {{date: string, time: string}} Parsed date and time, or empty strings on failure
     */
    function parseICSDate(raw) {
        var result = { date: '', time: '' };

        if (!raw || typeof raw !== 'string') {
            return result;
        }

        // Strip any trailing whitespace
        raw = raw.replace(/\s+/g, '');

        // Remove trailing Z (UTC indicator) - we treat all times as local for display
        if (raw.charAt(raw.length - 1) === 'Z') {
            raw = raw.substring(0, raw.length - 1);
        }

        // Date only: YYYYMMDD (8 chars)
        if (/^\d{8}$/.test(raw)) {
            result.date = raw.substring(0, 4) + '-' + raw.substring(4, 6) + '-' + raw.substring(6, 8);
            return result;
        }

        // Datetime: YYYYMMDDTHHMMSS (15 chars)
        if (/^\d{8}T\d{6}$/.test(raw)) {
            result.date = raw.substring(0, 4) + '-' + raw.substring(4, 6) + '-' + raw.substring(6, 8);
            result.time = raw.substring(9, 11) + ':' + raw.substring(11, 13);
            return result;
        }

        // Fallback: try to extract at least a date from the first 8 digits
        var digits = raw.replace(/[^0-9]/g, '');
        if (digits.length >= 8) {
            result.date = digits.substring(0, 4) + '-' + digits.substring(4, 6) + '-' + digits.substring(6, 8);
        }

        return result;
    }

    /**
     * Validate that a date string is a real date (basic check).
     *
     * @param {string} dateStr - 'YYYY-MM-DD' format
     * @returns {boolean}
     */
    function isValidDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') {
            return false;
        }
        var parts = dateStr.split('-');
        if (parts.length !== 3) {
            return false;
        }
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        var d = parseInt(parts[2], 10);
        if (isNaN(y) || isNaN(m) || isNaN(d)) {
            return false;
        }
        if (m < 1 || m > 12 || d < 1 || d > 31) {
            return false;
        }
        // Check actual day count for the month
        var daysInMonth = new Date(y, m, 0).getDate();
        return d <= daysInMonth;
    }

    /**
     * Add a number of days to a YYYY-MM-DD date string.
     *
     * @param {string} dateStr - 'YYYY-MM-DD'
     * @param {number} days - Number of days to add (can be negative)
     * @returns {string} New date string in 'YYYY-MM-DD' format
     */
    function addDays(dateStr, days) {
        var parts = dateStr.split('-');
        var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        d.setDate(d.getDate() + days);
        var yy = d.getFullYear();
        var mm = d.getMonth() + 1;
        var dd = d.getDate();
        return yy + '-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd);
    }

    /**
     * Calculate the number of days between two YYYY-MM-DD dates (inclusive).
     *
     * @param {string} startStr - Start date 'YYYY-MM-DD'
     * @param {string} endStr - End date 'YYYY-MM-DD'
     * @returns {number} Number of days (minimum 1)
     */
    function daysBetween(startStr, endStr) {
        var sParts = startStr.split('-');
        var eParts = endStr.split('-');
        var s = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
        var e = new Date(parseInt(eParts[0], 10), parseInt(eParts[1], 10) - 1, parseInt(eParts[2], 10));
        var diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 1;
    }

    /**
     * Compare two YYYY-MM-DD date strings.
     *
     * @param {string} a - Date string
     * @param {string} b - Date string
     * @returns {number} Negative if a < b, 0 if equal, positive if a > b
     */
    function compareDates(a, b) {
        // String comparison works for YYYY-MM-DD format
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }

    /**
     * Unescape ICS text values: replace escaped commas, semicolons,
     * backslashes, and literal \n / \N with newlines.
     *
     * @param {string} value - Raw ICS property value
     * @returns {string} Unescaped text
     */
    function unescapeICSValue(value) {
        if (!value) {
            return '';
        }
        value = value.replace(/\\n/gi, '\n');
        value = value.replace(/\\,/g, ',');
        value = value.replace(/\\;/g, ';');
        value = value.replace(/\\\\/g, '\\');
        return value;
    }

    /**
     * Parse a basic RRULE string into a usable object.
     * Only supports FREQ, COUNT, UNTIL, INTERVAL, BYDAY.
     *
     * @param {string} rruleStr - e.g. "FREQ=WEEKLY;COUNT=10;BYDAY=MO,WE"
     * @returns {object|null} Parsed recurrence rule or null if invalid
     */
    function parseRRule(rruleStr) {
        if (!rruleStr || typeof rruleStr !== 'string') {
            return null;
        }

        var result = {
            freq: '',
            count: 0,
            until: '',
            interval: 1,
            byday: []
        };

        var parts = rruleStr.split(';');
        for (var i = 0; i < parts.length; i++) {
            var kv = parts[i].split('=');
            if (kv.length !== 2) {
                continue;
            }
            var key = kv[0].toUpperCase();
            var val = kv[1];

            switch (key) {
                case 'FREQ':
                    result.freq = val.toUpperCase();
                    break;
                case 'COUNT':
                    result.count = parseInt(val, 10) || 0;
                    break;
                case 'UNTIL':
                    var parsed = parseICSDate(val);
                    result.until = parsed.date;
                    break;
                case 'INTERVAL':
                    result.interval = parseInt(val, 10) || 1;
                    break;
                case 'BYDAY':
                    result.byday = val.split(',');
                    break;
            }
        }

        if (!result.freq) {
            return null;
        }

        return result;
    }

    /**
     * Expand a single event with an RRULE into multiple event occurrences.
     * Limits expansion to a maximum of 365 occurrences for safety.
     *
     * @param {object} event - Base event object with date, rrule, etc.
     * @param {object} rrule - Parsed RRULE object
     * @returns {Array} Array of event objects (one per occurrence)
     */
    function expandRecurrence(event, rrule) {
        var MAX_OCCURRENCES = 365;
        var occurrences = [];
        var currentDate = event.date;
        var count = 0;
        var maxCount = rrule.count > 0 ? Math.min(rrule.count, MAX_OCCURRENCES) : MAX_OCCURRENCES;
        var interval = rrule.interval || 1;

        // If UNTIL is set, use it as an upper bound
        var untilDate = rrule.until || '';

        while (count < maxCount) {
            // Check UNTIL boundary
            if (untilDate && compareDates(currentDate, untilDate) > 0) {
                break;
            }

            // Validate the date before adding
            if (isValidDate(currentDate)) {
                var occurrence = {};
                // Copy all properties from the base event
                for (var prop in event) {
                    if (event.hasOwnProperty(prop)) {
                        occurrence[prop] = event[prop];
                    }
                }
                occurrence.date = currentDate;
                // For recurring events, endDate matches the occurrence date
                // (multi-day recurrence is not expanded here)
                occurrence.endDate = currentDate;
                occurrences.push(occurrence);
            }

            count++;

            // Advance to next occurrence based on frequency
            var parts, d;
            switch (rrule.freq) {
                case 'DAILY':
                    currentDate = addDays(currentDate, interval);
                    break;
                case 'WEEKLY':
                    currentDate = addDays(currentDate, 7 * interval);
                    break;
                case 'MONTHLY':
                    parts = currentDate.split('-');
                    d = new Date(
                        parseInt(parts[0], 10),
                        parseInt(parts[1], 10) - 1 + interval,
                        parseInt(parts[2], 10)
                    );
                    currentDate = d.getFullYear() + '-' +
                        (d.getMonth() + 1 < 10 ? '0' + (d.getMonth() + 1) : (d.getMonth() + 1)) + '-' +
                        (d.getDate() < 10 ? '0' + d.getDate() : d.getDate());
                    break;
                case 'YEARLY':
                    parts = currentDate.split('-');
                    d = new Date(
                        parseInt(parts[0], 10) + interval,
                        parseInt(parts[1], 10) - 1,
                        parseInt(parts[2], 10)
                    );
                    currentDate = d.getFullYear() + '-' +
                        (d.getMonth() + 1 < 10 ? '0' + (d.getMonth() + 1) : (d.getMonth() + 1)) + '-' +
                        (d.getDate() < 10 ? '0' + d.getDate() : d.getDate());
                    break;
                default:
                    // Unknown frequency, stop expanding
                    count = maxCount;
                    break;
            }
        }

        return occurrences;
    }

    /**
     * Expand a multi-day event into individual day entries.
     *
     * @param {object} event - Event object with date and endDate
     * @returns {Array} Array of event objects (one per day)
     */
    function expandMultiDayEvent(event) {
        var entries = [];

        if (!event.date || !event.endDate || compareDates(event.date, event.endDate) >= 0) {
            // Single-day event or invalid range, return as-is
            entries.push(event);
            return entries;
        }

        var totalDays = daysBetween(event.date, event.endDate);

        // Safety cap: do not expand more than 365 days
        if (totalDays > 365) {
            totalDays = 365;
        }

        for (var i = 0; i < totalDays; i++) {
            var dayDate = addDays(event.date, i);
            var entry = {};
            for (var prop in event) {
                if (event.hasOwnProperty(prop)) {
                    entry[prop] = event[prop];
                }
            }
            entry.date = dayDate;
            // Keep the original range for reference
            entry.originalStartDate = event.date;
            entry.originalEndDate = event.endDate;
            // Mark as part of a multi-day event
            entry.isMultiDay = true;
            entry.dayIndex = i + 1;
            entry.totalDays = totalDays;
            entries.push(entry);
        }

        return entries;
    }

    // =========================================================================
    // Keyword Dictionaries for Event Type Detection
    // =========================================================================

    var TYPE_KEYWORDS = {
        holiday: [
            'holiday', 'vacation', 'break', 'day off', 'bank holiday',
            'public holiday', 'school holiday',
            // French terms
            'cong\u00e9', 'vacances', 'f\u00e9ri\u00e9', 'jour f\u00e9ri\u00e9',
            'repos', 'cong\u00e9s scolaires'
        ],
        exam: [
            'exam', 'examination', 'test', 'quiz', 'assessment', 'midterm', 'final',
            // French terms
            'contr\u00f4le', 'devoir', '\u00e9valuation', 'examen',
            'devoir surveill\u00e9', 'contr\u00f4le continu'
        ],
        meeting: [
            'meeting', 'conference', 'staff meeting', 'parent meeting',
            'pta', 'board meeting',
            // French terms
            'r\u00e9union', 'conseil', 'conseil de classe',
            'r\u00e9union des parents', 'assembl\u00e9e'
        ]
    };

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Parse ICS file text content into an array of event objects.
     *
     * Each event object has the shape:
     *  {
     *    title:       {string}  Event summary / title
     *    date:        {string}  Start date in 'YYYY-MM-DD' format
     *    endDate:     {string}  End date in 'YYYY-MM-DD' format
     *    startTime:   {string}  Start time in 'HH:MM' format, or '' if all-day
     *    endTime:     {string}  End time in 'HH:MM' format, or '' if all-day
     *    description: {string}  Event description text
     *    location:    {string}  Event location
     *    type:        {string}  Detected type: 'holiday', 'exam', 'meeting', or 'event'
     *  }
     *
     * Multi-day events are expanded into individual day entries.
     * Recurring events (RRULE) are expanded into individual occurrences.
     *
     * @param {string} icsText - Raw content of an .ics file
     * @returns {Array} Array of event objects
     */
    function parse(icsText) {
        if (!icsText || typeof icsText !== 'string') {
            return [];
        }

        // Step 1: Unfold continuation lines and normalise line endings
        var unfolded = unfoldLines(icsText);

        // Step 2: Split into lines
        var lines = unfolded.split('\n');

        // Step 3: Extract VEVENT blocks
        var events = [];
        var inEvent = false;
        var currentEvent = null;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            // Skip empty lines
            if (!line || line.replace(/\s/g, '') === '') {
                continue;
            }

            // Detect VEVENT boundaries
            if (line.toUpperCase() === 'BEGIN:VEVENT') {
                inEvent = true;
                currentEvent = {
                    summary: '',
                    dtstart: '',
                    dtend: '',
                    description: '',
                    location: '',
                    rrule: ''
                };
                continue;
            }

            if (line.toUpperCase() === 'END:VEVENT') {
                if (inEvent && currentEvent) {
                    events.push(currentEvent);
                }
                inEvent = false;
                currentEvent = null;
                continue;
            }

            // Parse properties within a VEVENT
            if (inEvent && currentEvent) {
                var parsed = parseLine(line);
                if (!parsed) {
                    continue;
                }

                switch (parsed.key) {
                    case 'SUMMARY':
                        currentEvent.summary = unescapeICSValue(parsed.value);
                        break;
                    case 'DTSTART':
                        currentEvent.dtstart = parsed.value;
                        break;
                    case 'DTEND':
                        currentEvent.dtend = parsed.value;
                        break;
                    case 'DESCRIPTION':
                        currentEvent.description = unescapeICSValue(parsed.value);
                        break;
                    case 'LOCATION':
                        currentEvent.location = unescapeICSValue(parsed.value);
                        break;
                    case 'RRULE':
                        currentEvent.rrule = parsed.value;
                        break;
                }
            }
        }

        // Step 4: Convert raw VEVENT data into structured event objects
        var result = [];

        for (var j = 0; j < events.length; j++) {
            var raw = events[j];

            var start = parseICSDate(raw.dtstart);
            var end = parseICSDate(raw.dtend);

            // Skip events with no valid start date
            if (!start.date || !isValidDate(start.date)) {
                continue;
            }

            // If no end date, default to start date
            if (!end.date || !isValidDate(end.date)) {
                end.date = start.date;
                end.time = start.time;
            }

            var eventObj = {
                title: raw.summary || '(No Title)',
                date: start.date,
                endDate: end.date,
                startTime: start.time,
                endTime: end.time,
                description: raw.description,
                location: raw.location,
                type: ''  // Will be set by detectEventType
            };

            // Detect event type from title and description
            eventObj.type = detectEventType(eventObj);

            // Step 5: Handle recurrence rules
            var rrule = parseRRule(raw.rrule);
            if (rrule) {
                var occurrences = expandRecurrence(eventObj, rrule);
                for (var k = 0; k < occurrences.length; k++) {
                    result.push(occurrences[k]);
                }
            } else {
                // Step 6: Expand multi-day events into individual day entries
                var expanded = expandMultiDayEvent(eventObj);
                for (var m = 0; m < expanded.length; m++) {
                    result.push(expanded[m]);
                }
            }
        }

        // Step 7: Sort by date, then by start time
        result.sort(function (a, b) {
            var dateComp = compareDates(a.date, b.date);
            if (dateComp !== 0) {
                return dateComp;
            }
            // Sort by time within the same date
            if (a.startTime && b.startTime) {
                if (a.startTime < b.startTime) return -1;
                if (a.startTime > b.startTime) return 1;
            }
            // Events with times come after all-day events
            if (a.startTime && !b.startTime) return 1;
            if (!a.startTime && b.startTime) return -1;
            return 0;
        });

        return result;
    }

    /**
     * Filter an array of events to only include those within a date range.
     *
     * @param {Array} events - Array of event objects (from parse())
     * @param {string} startDate - Range start in 'YYYY-MM-DD' format (inclusive)
     * @param {string} endDate - Range end in 'YYYY-MM-DD' format (inclusive)
     * @returns {Array} Filtered array of events within the date range
     */
    function filterByDateRange(events, startDate, endDate) {
        if (!events || !Array.isArray(events)) {
            return [];
        }
        if (!startDate || !endDate) {
            return events;
        }

        var filtered = [];
        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (!ev.date) {
                continue;
            }
            // Event date must be >= startDate and <= endDate
            if (compareDates(ev.date, startDate) >= 0 && compareDates(ev.date, endDate) <= 0) {
                filtered.push(ev);
            }
        }

        return filtered;
    }

    /**
     * Detect the type of an event based on keywords in its title and description.
     * Checks against French and English keyword lists.
     *
     * @param {object} event - Event object with title and description properties
     * @returns {string} Event type: 'holiday', 'exam', 'meeting', or 'event'
     */
    function detectEventType(event) {
        if (!event) {
            return 'event';
        }

        // Build a searchable string from title and description (lowercase)
        var searchText = (
            (event.title || '') + ' ' + (event.description || '')
        ).toLowerCase();

        // Check each type's keyword list
        var types = ['holiday', 'exam', 'meeting'];
        for (var t = 0; t < types.length; t++) {
            var typeName = types[t];
            var keywords = TYPE_KEYWORDS[typeName];
            for (var k = 0; k < keywords.length; k++) {
                if (searchText.indexOf(keywords[k]) !== -1) {
                    return typeName;
                }
            }
        }

        return 'event';
    }

    // =========================================================================
    // Attach to namespace
    // =========================================================================

    window.MSM.ICS = {
        parse: parse,
        filterByDateRange: filterByDateRange,
        detectEventType: detectEventType
    };

})();
