/**
 * MidSchool Manager - Calendar View Page Logic
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage, UI = MSM.UI, M = MSM.Models, KEYS = S.STORAGE_KEYS;
    var currentDate = new Date();
    var currentView = 'month';
    var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var eventTypeColors = { lesson: '#3B82F6', exam: '#F97316', holiday: '#EF4444', meeting: '#8B5CF6', event: '#10B981', deadline: '#64748B' };

    // Moroccan holidays
    var holidays = [
      { name: 'Rentrée Scolaire', start: '2025-09-08', end: '2025-09-08', type: 'academic' },
      { name: 'Al Mawlid Annabawi', start: '2025-09-15', end: '2025-09-16', type: 'religious' },
      { name: 'Vacances Scolaires 1', start: '2025-10-19', end: '2025-10-26', type: 'vacation' },
      { name: "Fête de l'Indépendance", start: '2025-11-18', end: '2025-11-18', type: 'national' },
      { name: 'Vacances Scolaires 2', start: '2025-12-07', end: '2025-12-14', type: 'vacation' },
      { name: "Manifeste de l'Indépendance", start: '2026-01-11', end: '2026-01-11', type: 'national' },
      { name: 'Nouvel An Amazigh', start: '2026-01-14', end: '2026-01-14', type: 'national' },
      { name: 'Vacances Scolaires 3', start: '2026-01-25', end: '2026-02-01', type: 'vacation' },
      { name: 'Fête du Trône', start: '2026-07-30', end: '2026-07-30', type: 'national' },
      { name: 'Fête du Travail', start: '2026-05-01', end: '2026-05-01', type: 'national' }
    ];

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function dateStr(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
    function isToday(y, m, d) { var t = new Date(); return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d; }

    function isHoliday(dateString) {
      for (var i = 0; i < holidays.length; i++) {
        if (dateString >= holidays[i].start && dateString <= holidays[i].end) return holidays[i];
      }
      return null;
    }

    function getEventsForDate(dateString) {
      var events = S.getData(KEYS.CALENDAR_EVENTS) || [];
      return events.filter(function (e) { return e.date === dateString; });
    }

    function updateTitle() {
      document.getElementById('calMonth').textContent = monthNames[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
    }

    function render() {
      updateTitle();
      if (currentView === 'month') renderMonth();
      else renderWeek();
    }

    function renderMonth() {
      var year = currentDate.getFullYear();
      var month = currentDate.getMonth();
      var firstDay = new Date(year, month, 1);
      var lastDay = new Date(year, month + 1, 0);
      var startDow = (firstDay.getDay() + 6) % 7; // Mon=0
      var daysInMonth = lastDay.getDate();

      var html = '<div class="cal-grid">';
      for (var h = 0; h < 7; h++) html += '<div class="cal-grid__head">' + dayNames[h] + '</div>';

      // Previous month days
      var prevLast = new Date(year, month, 0).getDate();
      for (var p = startDow - 1; p >= 0; p--) {
        var pd = prevLast - p;
        var pm = month - 1 < 0 ? 11 : month - 1;
        var py = month - 1 < 0 ? year - 1 : year;
        html += '<div class="cal-grid__day cal-grid__day--other"><div class="cal-day__num">' + pd + '</div></div>';
      }

      // Current month days
      for (var d = 1; d <= daysInMonth; d++) {
        var ds = dateStr(year, month, d);
        var hol = isHoliday(ds);
        var events = getEventsForDate(ds);
        var today = isToday(year, month, d);
        var classes = 'cal-grid__day';
        if (today) classes += ' cal-grid__day--today';
        if (hol) classes += ' cal-grid__day--holiday';

        html += '<div class="' + classes + '" data-date="' + ds + '">';
        html += '<div class="cal-day__num">' + (today ? '<span class="cal-day__num--today">' + d + '</span>' : d) + '</div>';

        if (hol) {
          html += '<div class="cal-event cal-event--holiday" title="' + UI.escapeHTML(hol.name) + '">' + UI.escapeHTML(hol.name) + '</div>';
        }

        var maxShow = hol ? 2 : 3;
        for (var e = 0; e < Math.min(events.length, maxShow); e++) {
          var evt = events[e];
          var cls = evt.classId ? S.getById(KEYS.CLASSES, evt.classId) : null;
          var color = evt.color || (cls ? cls.color : eventTypeColors[evt.type] || '#3B82F6');
          html += '<div class="cal-event" style="background:' + color + '" title="' + UI.escapeHTML(evt.title) + '">' + UI.escapeHTML(evt.title) + '</div>';
        }
        if (events.length > maxShow) {
          html += '<div class="cal-more">+' + (events.length - maxShow) + ' more</div>';
        }
        html += '</div>';
      }

      // Next month padding
      var totalCells = startDow + daysInMonth;
      var remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (var n = 1; n <= remaining; n++) {
        html += '<div class="cal-grid__day cal-grid__day--other"><div class="cal-day__num">' + n + '</div></div>';
      }

      html += '</div>';
      document.getElementById('calendarContainer').innerHTML = html;

      // Click handlers
      document.querySelectorAll('.cal-grid__day[data-date]').forEach(function (cell) {
        cell.addEventListener('click', function (e) {
          if (e.target.classList.contains('cal-event')) return;
          showAddEventModal(this.dataset.date);
        });
      });
    }

    function renderWeek() {
      var settings = S.getData(KEYS.SETTINGS) || {};
      var periods = (settings.schedule || {}).periods || [
        { label: 'P1' }, { label: 'P2' }, { label: 'P3' }, { label: 'P4' }, { label: 'P5' }, { label: 'P6' }
      ];

      // Find Monday of current week
      var d = new Date(currentDate);
      var dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);

      var weekDays = [];
      for (var i = 0; i < 6; i++) { // Mon-Sat
        var wd = new Date(d);
        wd.setDate(d.getDate() + i);
        weekDays.push(wd);
      }

      document.getElementById('calMonth').textContent = 'Week of ' + UI.formatDate(weekDays[0]) + ' - ' + UI.formatDate(weekDays[5]);

      var html = '<div class="week-grid" style="grid-template-columns: 80px repeat(' + weekDays.length + ', 1fr)">';
      html += '<div class="week-grid__head"></div>';
      weekDays.forEach(function (wd) {
        var ds = dateStr(wd.getFullYear(), wd.getMonth(), wd.getDate());
        var today = isToday(wd.getFullYear(), wd.getMonth(), wd.getDate());
        html += '<div class="week-grid__head" style="' + (today ? 'background:var(--primary)' : '') + '">' + dayNames[(wd.getDay() + 6) % 7] + ' ' + wd.getDate() + '</div>';
      });

      periods.forEach(function (period) {
        html += '<div class="week-grid__period">' + (period.label || period.id || '') + '</div>';
        weekDays.forEach(function (wd) {
          var ds = dateStr(wd.getFullYear(), wd.getMonth(), wd.getDate());
          var events = getEventsForDate(ds);
          html += '<div class="week-grid__cell" data-date="' + ds + '">';
          events.forEach(function (evt) {
            var cls = evt.classId ? S.getById(KEYS.CLASSES, evt.classId) : null;
            var color = evt.color || (cls ? cls.color : '#3B82F6');
            html += '<div class="cal-event" style="background:' + color + '">' + UI.escapeHTML(evt.title) + '</div>';
          });
          html += '</div>';
        });
      });

      html += '</div>';
      document.getElementById('calendarContainer').innerHTML = html;

      document.querySelectorAll('.week-grid__cell').forEach(function (cell) {
        cell.addEventListener('click', function () { showAddEventModal(this.dataset.date); });
      });
    }

    function showAddEventModal(date) {
      var classes = S.getData(KEYS.CLASSES) || [];
      var classOpts = '<option value="">-- None --</option>' + classes.map(function (c) { return '<option value="' + c.id + '">' + UI.escapeHTML(c.name) + '</option>'; }).join('');
      var typeOpts = M.EVENT_TYPES.map(function (t) { return '<option value="' + t.value + '">' + t.label + '</option>'; }).join('');

      var formHTML = '<div class="form-group"><label>Title <span class="required">*</span></label><input type="text" id="evtTitle" placeholder="Event title"></div>' +
        '<div class="form-row"><div class="form-group"><label>Type</label><select id="evtType">' + typeOpts + '</select></div>' +
        '<div class="form-group"><label>Class</label><select id="evtClass">' + classOpts + '</select></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Date</label><input type="date" id="evtDate" value="' + (date || M.getToday()) + '"></div>' +
        '<div class="form-group"><label>Start Time</label><input type="time" id="evtStart"></div></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="evtNotes" rows="2"></textarea></div>';

      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSaveEvent">Save Event</button>';
      UI.showModal('Add Event', formHTML, { footerHTML: footerHTML, width: '500px' });

      document.getElementById('evtClass').addEventListener('change', function () {
        var cls = S.getById(KEYS.CLASSES, this.value);
        if (cls) document.getElementById('evtTitle').value = cls.name;
      });

      document.getElementById('btnSaveEvent').addEventListener('click', function () {
        var title = document.getElementById('evtTitle').value.trim();
        if (!title) { UI.showToast('Title is required', 'error'); return; }
        var classId = document.getElementById('evtClass').value;
        var cls = classId ? S.getById(KEYS.CLASSES, classId) : null;
        S.addItem(KEYS.CALENDAR_EVENTS, M.createCalendarEvent({
          title: title,
          type: document.getElementById('evtType').value,
          classId: classId || null,
          date: document.getElementById('evtDate').value,
          startTime: document.getElementById('evtStart').value,
          color: cls ? cls.color : eventTypeColors[document.getElementById('evtType').value] || '#3B82F6',
          notes: document.getElementById('evtNotes').value.trim()
        }));
        UI.closeModal(); UI.showToast('Event added!', 'success'); render();
      });
    }

    render();

    // Navigation
    document.getElementById('btnPrev').addEventListener('click', function () {
      if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() - 1);
      else currentDate.setDate(currentDate.getDate() - 7);
      render();
    });
    document.getElementById('btnNext').addEventListener('click', function () {
      if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
      else currentDate.setDate(currentDate.getDate() + 7);
      render();
    });
    document.getElementById('btnToday').addEventListener('click', function () { currentDate = new Date(); render(); });
    document.getElementById('btnAddEvent').addEventListener('click', function () { showAddEventModal(); });

    // View toggle
    document.querySelectorAll('.view-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.view-tab').forEach(function (t) { t.classList.remove('view-tab--active'); });
        this.classList.add('view-tab--active');
        currentView = this.dataset.view;
        render();
      });
    });

    // ======================================================================
    //  ICS Import
    // ======================================================================
    var icsFileInput = document.getElementById('icsFileInput');
    var icsImportPanel = document.getElementById('icsImportPanel');
    var icsPreviewData = [];

    document.getElementById('btnImportICS').addEventListener('click', function () {
      icsFileInput.click();
    });

    icsFileInput.addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        if (!MSM.ICS) { UI.showToast('ICS parser not loaded', 'error'); return; }
        var events = MSM.ICS.parse(e.target.result);
        // Filter to academic year
        var settings = S.getData(KEYS.SETTINGS) || {};
        var sem = settings.semesters || {};
        var startDate = (sem.semester1 && sem.semester1.start) || '2025-09-01';
        var endDate = (sem.semester2 && sem.semester2.end) || '2026-06-30';
        icsPreviewData = MSM.ICS.filterByDateRange(events, startDate, endDate);

        if (icsPreviewData.length === 0) {
          UI.showToast('No events found in the date range ' + startDate + ' to ' + endDate, 'warning');
          return;
        }

        // Show preview panel
        icsImportPanel.classList.add('visible');
        document.getElementById('icsEventCount').textContent = icsPreviewData.length + ' events';

        var html = '<table><thead><tr><th style="width:30px"><input type="checkbox" id="icsCheckAll" checked></th><th>Date</th><th>Title</th><th>Type</th></tr></thead><tbody>';
        for (var i = 0; i < icsPreviewData.length; i++) {
          var evt = icsPreviewData[i];
          var typeBadge = evt.type === 'holiday' ? 'badge-danger' : evt.type === 'exam' ? 'badge-warning' : evt.type === 'meeting' ? 'badge-purple' : 'badge-info';
          html += '<tr><td><input type="checkbox" class="ics-check" data-idx="' + i + '" checked></td>' +
            '<td>' + UI.escapeHTML(evt.date) + '</td>' +
            '<td>' + UI.escapeHTML(evt.title) + '</td>' +
            '<td><span class="badge ' + typeBadge + '">' + UI.escapeHTML(evt.type) + '</span></td></tr>';
        }
        html += '</tbody></table>';
        document.getElementById('icsPreviewTable').innerHTML = html;
      };
      reader.readAsText(file);
      this.value = '';
    });

    document.getElementById('btnSelectAllICS').addEventListener('click', function () {
      var checks = document.querySelectorAll('.ics-check');
      for (var i = 0; i < checks.length; i++) checks[i].checked = true;
    });
    document.getElementById('btnDeselectAllICS').addEventListener('click', function () {
      var checks = document.querySelectorAll('.ics-check');
      for (var i = 0; i < checks.length; i++) checks[i].checked = false;
    });
    document.getElementById('btnCloseImport').addEventListener('click', function () {
      icsImportPanel.classList.remove('visible');
    });
    document.getElementById('btnCancelImport').addEventListener('click', function () {
      icsImportPanel.classList.remove('visible');
    });

    document.getElementById('btnConfirmImport').addEventListener('click', function () {
      var checks = document.querySelectorAll('.ics-check:checked');
      var count = 0;
      for (var i = 0; i < checks.length; i++) {
        var idx = parseInt(checks[i].dataset.idx, 10);
        var evt = icsPreviewData[idx];
        if (!evt) continue;
        S.addItem(KEYS.CALENDAR_EVENTS, M.createCalendarEvent({
          title: evt.title,
          type: evt.type || 'event',
          date: evt.date,
          startTime: evt.startTime || '',
          color: eventTypeColors[evt.type] || '#3B82F6',
          notes: evt.description || ''
        }));
        count++;
      }
      icsImportPanel.classList.remove('visible');
      UI.showToast(count + ' events imported from .ics file!', 'success');
      render();
    });

    // ======================================================================
    //  Timetable Editor
    // ======================================================================
    document.getElementById('btnEditTimetable').addEventListener('click', function () {
      var settings = S.getData(KEYS.SETTINGS) || {};
      var schedule = settings.schedule || {};
      var periods = schedule.periods || [
        { id: 'p1', label: 'P1' }, { id: 'p2', label: 'P2' }, { id: 'p3', label: 'P3' },
        { id: 'p4', label: 'P4' }, { id: 'p5', label: 'P5' }, { id: 'p6', label: 'P6' }, { id: 'p7', label: 'P7' }
      ];
      var activeDays = schedule.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var dayAbbr = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
      var classes = S.getData(KEYS.CLASSES) || [];

      // Load existing timetable
      var timetable = settings.timetable || {};

      var classOpts = '<option value="">--</option>';
      for (var c = 0; c < classes.length; c++) {
        classOpts += '<option value="' + classes[c].id + '">' + UI.escapeHTML(classes[c].name) + '</option>';
      }

      var html = '<p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">Assign classes to your weekly periods. This helps track your teaching schedule.</p>';
      html += '<div class="timetable-grid" style="grid-template-columns: 80px repeat(' + activeDays.length + ', 1fr)">';
      html += '<div class="timetable-grid__head"></div>';
      for (var d = 0; d < activeDays.length; d++) {
        html += '<div class="timetable-grid__head">' + (dayAbbr[activeDays[d]] || activeDays[d].substring(0, 3)) + '</div>';
      }

      for (var p = 0; p < periods.length; p++) {
        html += '<div class="timetable-grid__period">' + UI.escapeHTML(periods[p].label || periods[p].id) + '</div>';
        for (var dd = 0; dd < activeDays.length; dd++) {
          var key = activeDays[dd] + '_' + periods[p].id;
          var selected = timetable[key] || '';
          var opts = classOpts.replace('value="' + selected + '"', 'value="' + selected + '" selected');
          html += '<div class="timetable-grid__cell"><select data-tt-key="' + key + '">' + opts + '</select></div>';
        }
      }
      html += '</div>';

      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" id="btnSaveTimetable">Save Timetable</button>';

      UI.showModal('Weekly Timetable', html, { footerHTML: footerHTML, width: '800px' });

      document.getElementById('btnSaveTimetable').addEventListener('click', function () {
        var selects = document.querySelectorAll('[data-tt-key]');
        var newTimetable = {};
        for (var i = 0; i < selects.length; i++) {
          var k = selects[i].dataset.ttKey;
          if (selects[i].value) newTimetable[k] = selects[i].value;
        }
        var s = S.getData(KEYS.SETTINGS) || {};
        s.timetable = newTimetable;
        S.setData(KEYS.SETTINGS, s);
        UI.closeModal();
        UI.showToast('Timetable saved!', 'success');
      });
    });
  });
})();
