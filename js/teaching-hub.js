/**
 * MidSchool Manager - Teaching Hub
 * Bulk plan-paste, class selection, and log generation
 * Weekly quick-log view and class overview
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage, UI = MSM.UI, M = MSM.Models, KEYS = S.STORAGE_KEYS;

    // =====================================================================
    // TAB SWITCHING
    // =====================================================================
    var tabs = document.querySelectorAll('.hub-tab');
    var panels = document.querySelectorAll('.hub-panel');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.dataset.tab;
        tabs.forEach(function (t) { t.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        this.classList.add('active');
        document.getElementById('panel-' + target).classList.add('active');
        if (target === 'weekly') initWeeklyView();
        if (target === 'overview') renderOverview();
      });
    });

    // =====================================================================
    // SET DEFAULT DATE
    // =====================================================================
    var genDateEl = document.getElementById('genDate');
    if (genDateEl) genDateEl.value = M.getToday();

    // =====================================================================
    // HELPER: FOCUS DETECTION
    // =====================================================================
    var FOCUS_KEYWORDS = {
      grammar:    ['grammar','grammaire','rule','tense','verb','conjugat','structure','form','negat','question','sentence'],
      vocabulary: ['vocab','word','lexis','lexical','term','glossary','meaning','define','expression'],
      reading:    ['reading','read','text','comprehension','passage','article','story','book'],
      writing:    ['writing','write','essay','paragraph','composition','letter','report','produce','draft'],
      speaking:   ['speaking','speak','oral','dialogue','conversation','talk','discuss','present'],
      listening:  ['listening','listen','audio','recording','dictation','hear'],
      project:    ['project','poster','display','create','make','produce','design'],
      assessment: ['test','exam','quiz','assessment','evaluation','check','control'],
      remedial:   ['remedial','revision','review','catch-up','support','reinforce'],
      culture:    ['culture','clil','civilisation','civilization','discovery','geography','history']
    };

    function detectFocus(text) {
      var lower = (text || '').toLowerCase();
      var scores = {};
      Object.keys(FOCUS_KEYWORDS).forEach(function (f) {
        scores[f] = 0;
        FOCUS_KEYWORDS[f].forEach(function (kw) {
          if (lower.indexOf(kw) >= 0) scores[f]++;
        });
      });
      var best = '', bestScore = 0;
      Object.keys(scores).forEach(function (f) {
        if (scores[f] > bestScore) { bestScore = scores[f]; best = f; }
      });
      return bestScore > 0 ? best : '';
    }

    // =====================================================================
    // HELPER: PARSE PAGE REFERENCE
    // =====================================================================
    function extractPage(text) {
      var m = text.match(/pp?\.?\s*(\d+[\s\-–]+\d+|\d+)/i);
      return m ? m[0].replace(/\s+/g, '') : '';
    }

    function extractUnit(text) {
      var m = text.match(/unit\s*\d+[^,\.\n]*/i);
      return m ? m[0].trim() : '';
    }

    // =====================================================================
    // PARSE PLAN
    // =====================================================================
    var parsedLessons = []; // Array of {topic, focus, unit, page, activities, homework}

    function parsePlan(raw) {
      var lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 3; });
      var lessons = [];
      lines.forEach(function (line) {
        // Strip leading numbers/bullets: "1.", "•", "-", "*", "Lesson 1:", etc.
        var clean = line.replace(/^(\d+[\.\)]\s*|[•\-\*]\s*|lesson\s*\d+\s*[:\.]\s*)/i, '').trim();
        if (!clean) return;
        // Split on " - " or ": " for topic vs detail
        var parts = clean.split(/\s*[-–:]\s+/);
        var topic = parts[0].trim();
        var detail = parts.slice(1).join(' - ').trim();
        var combined = clean;
        lessons.push({
          topic: topic || clean,
          unit: extractUnit(combined),
          page: extractPage(combined),
          focus: detectFocus(combined),
          activities: detail && detail !== topic ? detail : '',
          homework: ''
        });
      });
      return lessons;
    }

    // =====================================================================
    // FOCUS SELECT OPTIONS
    // =====================================================================
    function focusOptions(selected) {
      var opts = '<option value="">— Focus —</option>';
      M.LESSON_FOCUS_TYPES.forEach(function (f) {
        opts += '<option value="' + f.value + '"' + (f.value === selected ? ' selected' : '') + '>' + f.label + '</option>';
      });
      return opts;
    }

    // =====================================================================
    // RENDER PARSED TABLE
    // =====================================================================
    function renderParsedTable() {
      var tbody = document.getElementById('parsedTableBody');
      var rowCount = document.getElementById('rowCount');
      if (!tbody) return;
      if (parsedLessons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-tertiary)">No lessons yet. Paste a plan above and click Parse.</td></tr>';
        if (rowCount) rowCount.textContent = '';
        return;
      }
      var html = '';
      parsedLessons.forEach(function (l, i) {
        html += '<tr data-idx="' + i + '">' +
          '<td style="text-align:center;color:var(--text-secondary);font-size:12px">' + (i + 1) + '</td>' +
          '<td><input type="text" class="pr-topic" data-idx="' + i + '" value="' + UI.escapeHTML(l.topic || '') + '" placeholder="Topic / Lesson title"></td>' +
          '<td><select class="pr-focus" data-idx="' + i + '">' + focusOptions(l.focus) + '</select></td>' +
          '<td><input type="text" class="pr-unit" data-idx="' + i + '" value="' + UI.escapeHTML(l.unit || '') + '" placeholder="Unit"></td>' +
          '<td><input type="text" class="pr-page" data-idx="' + i + '" value="' + UI.escapeHTML(l.page || '') + '" placeholder="p.xx"></td>' +
          '<td><textarea class="pr-activities" data-idx="' + i + '" placeholder="Activities / notes">' + UI.escapeHTML(l.activities || '') + '</textarea></td>' +
          '<td><input type="text" class="pr-homework" data-idx="' + i + '" value="' + UI.escapeHTML(l.homework || '') + '" placeholder="Homework"></td>' +
          '<td><button class="parsed-row__remove" data-idx="' + i + '" title="Remove row">✕</button></td>' +
          '</tr>';
      });
      tbody.innerHTML = html;
      if (rowCount) rowCount.textContent = parsedLessons.length + ' lesson' + (parsedLessons.length !== 1 ? 's' : '');

      // Attach change handlers to sync back to parsedLessons
      tbody.querySelectorAll('.pr-topic').forEach(function (el) {
        el.addEventListener('input', function () { parsedLessons[+this.dataset.idx].topic = this.value; });
      });
      tbody.querySelectorAll('.pr-focus').forEach(function (el) {
        el.addEventListener('change', function () { parsedLessons[+this.dataset.idx].focus = this.value; });
      });
      tbody.querySelectorAll('.pr-unit').forEach(function (el) {
        el.addEventListener('input', function () { parsedLessons[+this.dataset.idx].unit = this.value; });
      });
      tbody.querySelectorAll('.pr-page').forEach(function (el) {
        el.addEventListener('input', function () { parsedLessons[+this.dataset.idx].page = this.value; });
      });
      tbody.querySelectorAll('.pr-activities').forEach(function (el) {
        el.addEventListener('input', function () { parsedLessons[+this.dataset.idx].activities = this.value; });
      });
      tbody.querySelectorAll('.pr-homework').forEach(function (el) {
        el.addEventListener('input', function () { parsedLessons[+this.dataset.idx].homework = this.value; });
      });
      tbody.querySelectorAll('.parsed-row__remove').forEach(function (btn) {
        btn.addEventListener('click', function () {
          parsedLessons.splice(+this.dataset.idx, 1);
          renderParsedTable();
        });
      });
    }

    // Parse button
    document.getElementById('btnParsePlan').addEventListener('click', function () {
      var raw = document.getElementById('pasteInput').value.trim();
      if (!raw) { UI.showToast('Please paste something first', 'warning'); return; }
      parsedLessons = parsePlan(raw);
      if (parsedLessons.length === 0) {
        UI.showToast('Could not detect any lessons. Try one lesson per line.', 'warning');
        return;
      }
      document.getElementById('parsedSection').style.display = '';
      renderParsedTable();
      renderClassSelector();
      document.getElementById('parseStatus').textContent = '✓ ' + parsedLessons.length + ' lessons parsed';
      UI.showToast(parsedLessons.length + ' lessons parsed! Review and adjust below.', 'success');
    });

    document.getElementById('btnClearPaste').addEventListener('click', function () {
      document.getElementById('pasteInput').value = '';
      parsedLessons = [];
      document.getElementById('parsedSection').style.display = 'none';
      document.getElementById('parseStatus').textContent = '';
    });

    document.getElementById('btnAddRow').addEventListener('click', function () {
      parsedLessons.push({ topic: '', unit: '', page: '', focus: '', activities: '', homework: '' });
      renderParsedTable();
      // Focus the last row's topic field
      setTimeout(function () {
        var rows = document.querySelectorAll('.pr-topic');
        if (rows.length) rows[rows.length - 1].focus();
      }, 50);
    });

    document.getElementById('btnRemoveAll').addEventListener('click', function () {
      if (!parsedLessons.length) return;
      UI.showConfirm('Remove all ' + parsedLessons.length + ' parsed lessons?', function () {
        parsedLessons = [];
        renderParsedTable();
      });
    });

    // =====================================================================
    // CLASS SELECTOR
    // =====================================================================
    var selectedClassIds = [];
    var yearFilter = '';

    function renderClassSelector() {
      var classes = S.getData(KEYS.CLASSES) || [];
      var grid = document.getElementById('classSelectorGrid');
      if (!grid) return;

      var filtered = yearFilter ? classes.filter(function (c) { return String(c.year) === yearFilter; }) : classes;

      if (filtered.length === 0) {
        grid.innerHTML = '<span style="color:var(--text-tertiary);font-size:13px">No classes found. Configure classes in Settings.</span>';
        return;
      }

      var html = '';
      filtered.forEach(function (c) {
        var isChecked = selectedClassIds.indexOf(c.id) >= 0;
        html += '<label class="class-pill' + (isChecked ? ' checked' : '') + '" style="color:' + (c.color || '#4F46E5') + '" data-id="' + c.id + '">' +
          '<input type="checkbox" value="' + c.id + '"' + (isChecked ? ' checked' : '') + '>' +
          '<span class="pill-dot"></span>' +
          '<span>' + UI.escapeHTML(c.name) + '</span>' +
          '</label>';
      });
      grid.innerHTML = html;

      grid.querySelectorAll('.class-pill').forEach(function (pill) {
        pill.addEventListener('click', function () {
          var cid = this.dataset.id;
          var cb = this.querySelector('input');
          cb.checked = !cb.checked;
          this.classList.toggle('checked', cb.checked);
          if (cb.checked) {
            if (selectedClassIds.indexOf(cid) < 0) selectedClassIds.push(cid);
          } else {
            selectedClassIds = selectedClassIds.filter(function (id) { return id !== cid; });
          }
        });
      });
    }

    document.getElementById('btnSelectAllClasses').addEventListener('click', function () {
      var classes = S.getData(KEYS.CLASSES) || [];
      var filtered = yearFilter ? classes.filter(function (c) { return String(c.year) === yearFilter; }) : classes;
      selectedClassIds = filtered.map(function (c) { return c.id; });
      renderClassSelector();
    });

    document.getElementById('btnSelectNoneClasses').addEventListener('click', function () {
      selectedClassIds = [];
      renderClassSelector();
    });

    document.querySelectorAll('.class-year-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.class-year-filter').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        yearFilter = this.dataset.year;
        renderClassSelector();
      });
    });

    // =====================================================================
    // GENERATE LOGS
    // =====================================================================
    function collectParsedRows() {
      // Sync any edits from the table back
      var rows = document.querySelectorAll('#parsedTableBody tr[data-idx]');
      rows.forEach(function (row) {
        var i = +row.dataset.idx;
        if (!parsedLessons[i]) return;
        var topic = row.querySelector('.pr-topic');
        var focus = row.querySelector('.pr-focus');
        var unit = row.querySelector('.pr-unit');
        var page = row.querySelector('.pr-page');
        var act = row.querySelector('.pr-activities');
        var hw = row.querySelector('.pr-homework');
        if (topic) parsedLessons[i].topic = topic.value;
        if (focus) parsedLessons[i].focus = focus.value;
        if (unit) parsedLessons[i].unit = unit.value;
        if (page) parsedLessons[i].page = page.value;
        if (act) parsedLessons[i].activities = act.value;
        if (hw) parsedLessons[i].homework = hw.value;
      });
    }

    function buildRecords(preview) {
      collectParsedRows();
      if (parsedLessons.length === 0) { UI.showToast('No lessons to generate', 'warning'); return null; }
      if (selectedClassIds.length === 0) { UI.showToast('Select at least one class', 'warning'); return null; }

      var date = document.getElementById('genDate').value || M.getToday();
      var time = document.getElementById('genTime').value || '';
      var period = document.getElementById('genPeriod').value || '';
      var status = document.getElementById('genStatus').value || 'completed';

      var classes = S.getData(KEYS.CLASSES) || [];
      var selectedClasses = classes.filter(function (c) { return selectedClassIds.indexOf(c.id) >= 0; });
      var records = [];

      selectedClasses.forEach(function (cls) {
        parsedLessons.forEach(function (lesson) {
          if (!lesson.topic && !lesson.unit) return;
          records.push({
            classId: cls.id,
            className: cls.name,
            classColor: cls.color || '#4F46E5',
            date: date,
            time: time,
            period: period ? parseInt(period) : null,
            unit: lesson.unit || '',
            topic: lesson.topic || '',
            textbookPage: lesson.page || '',
            lessonFocus: lesson.focus || '',
            lessonStages: [],
            studentActivities: '',
            activities: lesson.activities || '',
            homework: lesson.homework || '',
            completionStatus: status,
            notes: ''
          });
        });
      });

      return records;
    }

    document.getElementById('btnPreviewGenerate').addEventListener('click', function () {
      var records = buildRecords(true);
      if (!records) return;
      var preview = document.getElementById('generatePreview');
      preview.style.display = '';
      var byClass = {};
      records.forEach(function (r) {
        if (!byClass[r.className]) byClass[r.className] = [];
        byClass[r.className].push(r);
      });
      var html = '<div class="card" style="padding:16px">';
      html += '<div style="font-weight:700;margin-bottom:12px">Preview: ' + records.length + ' lesson records will be created</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">';
      Object.keys(byClass).forEach(function (cn) {
        var color = byClass[cn][0].classColor;
        html += '<div style="border:2px solid ' + color + ';border-radius:8px;padding:10px">' +
          '<div style="font-weight:700;color:' + color + ';margin-bottom:6px">' + UI.escapeHTML(cn) + ' <span style="font-size:12px;font-weight:400;color:var(--text-secondary)">(' + byClass[cn].length + ' lessons)</span></div>';
        byClass[cn].forEach(function (r) {
          html += '<div style="font-size:12px;padding:2px 0;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">' +
            (r.lessonFocus ? '<span class="badge" style="font-size:10px;padding:1px 5px;margin-right:4px">' + r.lessonFocus + '</span>' : '') +
            UI.escapeHTML(r.topic || r.unit || '—') + '</div>';
        });
        html += '</div>';
      });
      html += '</div>';
      html += '<div style="margin-top:16px;display:flex;gap:8px">' +
        '<button class="btn btn-primary" id="btnConfirmGenerate">✓ Confirm &amp; Save All</button>' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'generatePreview\').style.display=\'none\'">Cancel</button>' +
        '</div></div>';
      preview.innerHTML = html;
      document.getElementById('btnConfirmGenerate').addEventListener('click', function () {
        saveRecords(records);
      });
    });

    document.getElementById('btnGenerate').addEventListener('click', function () {
      var records = buildRecords(false);
      if (!records) return;
      saveRecords(records);
    });

    function saveRecords(records) {
      var saved = 0;
      records.forEach(function (r) {
        var rec = M.createLessonRecord({
          classId: r.classId,
          date: r.date,
          period: r.period,
          unit: r.unit,
          topic: r.topic,
          textbookPage: r.textbookPage,
          lessonFocus: r.lessonFocus,
          lessonStages: r.lessonStages || [],
          studentActivities: r.studentActivities || '',
          activities: r.activities || '',
          homework: r.homework || '',
          completionStatus: r.completionStatus,
          notes: r.notes || ''
        });
        // Attach time if provided
        if (r.time) rec.startTime = r.time;
        S.addItem(KEYS.LESSON_RECORDS, rec);
        saved++;
      });
      document.getElementById('generatePreview').style.display = 'none';
      UI.showToast(saved + ' lesson records created! View them in Lesson Records.', 'success');
    }

    // =====================================================================
    // WEEKLY QUICK LOG
    // =====================================================================
    var currentWeekStart = getMonday(new Date());

    function getMonday(d) {
      var dt = new Date(d);
      var day = dt.getDay();
      var diff = dt.getDate() - day + (day === 0 ? -6 : 1);
      dt.setDate(diff);
      dt.setHours(0, 0, 0, 0);
      return dt;
    }

    function formatWeekLabel(monday) {
      var friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      var opts = { day: 'numeric', month: 'short' };
      return monday.toLocaleDateString('en-GB', opts) + ' – ' + friday.toLocaleDateString('en-GB', opts) + ' ' + friday.getFullYear();
    }

    function dateStr(d) {
      return d.toISOString().slice(0, 10);
    }

    function getDayName(offset) {
      var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days[offset];
    }

    function initWeeklyView() {
      renderWeekGrid();
      // Populate class filter
      var classes = S.getData(KEYS.CLASSES) || [];
      var sel = document.getElementById('weekClassFilter');
      sel.innerHTML = '<option value="">All Classes</option>';
      classes.forEach(function (c) {
        sel.innerHTML += '<option value="' + c.id + '">' + UI.escapeHTML(c.name) + '</option>';
      });
    }

    function renderWeekGrid() {
      var label = document.getElementById('weekLabel');
      if (label) label.textContent = formatWeekLabel(currentWeekStart);

      var weekDates = [];
      for (var i = 0; i < 7; i++) {
        var d = new Date(currentWeekStart);
        d.setDate(currentWeekStart.getDate() + i);
        weekDates.push(dateStr(d));
      }

      var classFilter = document.getElementById('weekClassFilter') ? document.getElementById('weekClassFilter').value : '';
      var classes = S.getData(KEYS.CLASSES) || [];
      if (classFilter) classes = classes.filter(function (c) { return c.id === classFilter; });

      var allLessons = S.getData(KEYS.LESSON_RECORDS) || [];
      // Filter to this week
      var weekLessons = allLessons.filter(function (l) { return weekDates.indexOf(l.date) >= 0; });

      var settings = S.getData('msm_settings') || {};
      var timetable = settings.timetable || {};
      var periods = (settings.schedule && settings.schedule.periods) || [];

      var grid = document.getElementById('weekGrid');
      if (!grid) return;

      if (classes.length === 0) {
        grid.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📅</div><h3 class="empty-state__title">No classes found</h3><p class="empty-state__text">Configure your classes in Settings first.</p></div>';
        return;
      }

      var html = '';
      classes.forEach(function (cls) {
        var classLessons = weekLessons.filter(function (l) { return l.classId === cls.id; });

        // Build week lesson slots from timetable + existing records
        var slotsByDay = {};
        // From timetable: find which days/periods this class is scheduled
        var classTimetable = timetable[cls.id] || {};
        var dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        weekDates.forEach(function (dt, idx) {
          var dayName = dayNames[idx];
          var dayPeriods = classTimetable[dayName] || [];
          if (Array.isArray(dayPeriods)) {
            dayPeriods.forEach(function (pid) {
              if (!pid) return;
              var pObj = periods.find(function (p) { return p.id === pid; });
              var timeLabel = pObj ? pObj.start : '';
              if (!slotsByDay[dt]) slotsByDay[dt] = [];
              slotsByDay[dt].push({ period: pid, time: timeLabel, source: 'timetable' });
            });
          }
        });

        // Merge in existing records
        classLessons.forEach(function (l) {
          if (!slotsByDay[l.date]) slotsByDay[l.date] = [];
          var existing = slotsByDay[l.date].find(function (s) { return s.lessonId === l.id; });
          if (!existing) slotsByDay[l.date].push({ lessonId: l.id, topic: l.topic, status: l.completionStatus, time: l.startTime || '', period: l.period, source: 'record' });
        });

        // Flatten all slots
        var allSlots = [];
        weekDates.forEach(function (dt, idx) {
          var daySlots = slotsByDay[dt] || [];
          daySlots.forEach(function (s) {
            allSlots.push(Object.assign({}, s, { date: dt, dayLabel: getDayName(idx) }));
          });
        });

        html += '<div class="week-class-card">';
        html += '<div class="week-class-card__header" style="border-left:4px solid ' + (cls.color || '#4F46E5') + '">' +
          '<span style="width:12px;height:12px;border-radius:50%;background:' + (cls.color || '#4F46E5') + ';display:inline-block"></span>' +
          '<span class="week-class-card__name">' + UI.escapeHTML(cls.name) + '</span>' +
          '<span class="week-class-card__count">' + classLessons.length + ' logged</span>' +
          '</div>';
        html += '<div class="week-class-card__lessons">';

        if (allSlots.length === 0) {
          html += '<div style="padding:10px 14px;font-size:12px;color:var(--text-tertiary)">No scheduled slots this week</div>';
        } else {
          allSlots.forEach(function (slot) {
            var statusCls = slot.status || 'not_started';
            html += '<div class="week-lesson-row">' +
              '<div class="day-time"><div style="font-weight:600">' + slot.dayLabel + '</div><div>' + (slot.time || (slot.period ? 'P' + slot.period : '')) + '</div></div>' +
              '<input type="text" class="topic-inp" data-classid="' + cls.id + '" data-date="' + slot.date + '" data-period="' + (slot.period || '') + '" data-lessonid="' + (slot.lessonId || '') + '" value="' + UI.escapeHTML(slot.topic || '') + '" placeholder="Topic..." style="flex:1;padding:4px 6px;border:1px solid transparent;border-radius:4px;font-size:12px">' +
              '<span class="status-dot" data-status="' + statusCls + '" data-classid="' + cls.id + '" data-date="' + slot.date + '" data-period="' + (slot.period || '') + '" data-lessonid="' + (slot.lessonId || '') + '" title="Click to cycle status"></span>' +
              '</div>';
          });
        }

        html += '<button class="week-add-btn" data-classid="' + cls.id + '">+ Log lesson for this class</button>';
        html += '</div></div>';
      });

      grid.innerHTML = html;

      // Quick-save on topic blur
      grid.querySelectorAll('.topic-inp').forEach(function (inp) {
        inp.addEventListener('blur', function () {
          quickSaveSlot(this);
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
        });
      });

      // Cycle status on dot click
      grid.querySelectorAll('.status-dot').forEach(function (dot) {
        dot.addEventListener('click', function () {
          var statuses = ['completed','partial','not_started','skipped'];
          var current = this.dataset.status || 'not_started';
          var idx = statuses.indexOf(current);
          var next = statuses[(idx + 1) % statuses.length];
          this.dataset.status = next;
          quickSaveStatus(this, next);
        });
      });

      // Add lesson button
      grid.querySelectorAll('.week-add-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          quickOpenLessonModal(this.dataset.classid);
        });
      });
    }

    function quickSaveSlot(inp) {
      var topic = inp.value.trim();
      var lessonId = inp.dataset.lessonid;
      var classId = inp.dataset.classid;
      var date = inp.dataset.date;
      var period = inp.dataset.period ? parseInt(inp.dataset.period) : null;

      if (lessonId) {
        S.updateItem(KEYS.LESSON_RECORDS, lessonId, { topic: topic, updatedAt: new Date().toISOString() });
        UI.showToast('Saved', 'success');
      } else if (topic && classId && date) {
        var rec = M.createLessonRecord({ classId: classId, date: date, period: period, topic: topic, completionStatus: 'completed' });
        S.addItem(KEYS.LESSON_RECORDS, rec);
        inp.dataset.lessonid = rec.id;
        UI.showToast('Lesson logged', 'success');
      }
    }

    function quickSaveStatus(dot, status) {
      var lessonId = dot.dataset.lessonid;
      if (lessonId) {
        S.updateItem(KEYS.LESSON_RECORDS, lessonId, { completionStatus: status, updatedAt: new Date().toISOString() });
        UI.showToast('Status updated', 'success');
      }
    }

    function quickOpenLessonModal(classId) {
      var classes = S.getData(KEYS.CLASSES) || [];
      var cls = classes.find(function (c) { return c.id === classId; });
      var clsName = cls ? cls.name : '';
      var monday = currentWeekStart;
      var weekDates = [];
      for (var i = 0; i < 7; i++) {
        var d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(dateStr(d));
      }
      var dateOpts = weekDates.map(function (dt, i) {
        var days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        return '<option value="' + dt + '">' + days[i] + ' ' + dt + '</option>';
      }).join('');
      var focusOpts = '<option value="">— Focus —</option>' + M.LESSON_FOCUS_TYPES.map(function (f) {
        return '<option value="' + f.value + '">' + f.label + '</option>';
      }).join('');

      var body = '<div class="form-group"><label>Class</label><input type="text" value="' + UI.escapeHTML(clsName) + '" readonly style="background:var(--bg-secondary)"></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Date <span class="required">*</span></label><select id="qlDate">' + dateOpts + '</select></div>' +
        '<div class="form-group"><label>Time</label><input type="time" id="qlTime" value="08:30"></div>' +
        '</div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Period</label><select id="qlPeriod"><option value="">—</option>' +
        [1,2,3,4,5,6,7].map(function(n){return '<option value="'+n+'">P'+n+'</option>';}).join('') + '</select></div>' +
        '<div class="form-group"><label>Status</label><select id="qlStatus"><option value="completed">✅ Completed</option><option value="partial">🟡 Partial</option><option value="not_started">🔴 Not Started</option><option value="skipped">⏭ Skipped</option></select></div>' +
        '</div>' +
        '<div class="form-group"><label>Unit</label><input type="text" id="qlUnit" placeholder="e.g. Unit 3"></div>' +
        '<div class="form-group"><label>Topic <span class="required">*</span></label><input type="text" id="qlTopic" placeholder="e.g. Present Continuous - Introduction"></div>' +
        '<div class="form-row">' +
        '<div class="form-group"><label>Lesson Focus</label><select id="qlFocus">' + focusOpts + '</select></div>' +
        '<div class="form-group"><label>Textbook Page</label><input type="text" id="qlPage" placeholder="p.xx"></div>' +
        '</div>' +
        '<div class="form-group"><label>Activities</label><textarea id="qlActivities" rows="2" placeholder="What happened in class?"></textarea></div>' +
        '<div class="form-group"><label>Homework</label><input type="text" id="qlHomework" placeholder="e.g. Workbook p.24"></div>';

      var footer = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" id="qlSaveBtn">Save Lesson</button>';

      UI.showModal('Log Lesson — ' + UI.escapeHTML(clsName), body, { width: '540px', footerHTML: footer });

      document.getElementById('qlSaveBtn').addEventListener('click', function () {
        var topic = document.getElementById('qlTopic').value.trim();
        var date = document.getElementById('qlDate').value;
        if (!topic || !date) { UI.showToast('Topic and date are required', 'error'); return; }
        var rec = M.createLessonRecord({
          classId: classId,
          date: date,
          period: parseInt(document.getElementById('qlPeriod').value) || null,
          unit: document.getElementById('qlUnit').value.trim(),
          topic: topic,
          textbookPage: document.getElementById('qlPage').value.trim(),
          lessonFocus: document.getElementById('qlFocus').value,
          lessonStages: [],
          studentActivities: '',
          activities: document.getElementById('qlActivities').value.trim(),
          homework: document.getElementById('qlHomework').value.trim(),
          completionStatus: document.getElementById('qlStatus').value,
          notes: ''
        });
        rec.startTime = document.getElementById('qlTime').value || '';
        S.addItem(KEYS.LESSON_RECORDS, rec);
        UI.closeModal();
        UI.showToast('Lesson logged!', 'success');
        renderWeekGrid();
      });
    }

    document.getElementById('btnPrevWeek').addEventListener('click', function () {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      renderWeekGrid();
    });
    document.getElementById('btnNextWeek').addEventListener('click', function () {
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      renderWeekGrid();
    });
    document.getElementById('btnThisWeek').addEventListener('click', function () {
      currentWeekStart = getMonday(new Date());
      renderWeekGrid();
    });
    document.getElementById('weekClassFilter').addEventListener('change', function () {
      renderWeekGrid();
    });

    // =====================================================================
    // CLASS OVERVIEW
    // =====================================================================
    function renderOverview() {
      var yearFilter = document.getElementById('overviewYearFilter').value;
      var searchQ = (document.getElementById('overviewSearch').value || '').toLowerCase();
      var classes = S.getData(KEYS.CLASSES) || [];
      var allLessons = S.getData(KEYS.LESSON_RECORDS) || [];

      if (yearFilter) classes = classes.filter(function (c) { return String(c.year) === yearFilter; });
      if (searchQ) classes = classes.filter(function (c) { return c.name.toLowerCase().indexOf(searchQ) >= 0; });

      var container = document.getElementById('overviewContainer');
      if (classes.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📊</div><h3 class="empty-state__title">No classes found</h3></div>';
        return;
      }

      var html = '';

      classes.forEach(function (cls) {
        var lessons = allLessons.filter(function (l) { return l.classId === cls.id; });
        var completed = lessons.filter(function (l) { return l.completionStatus === 'completed'; }).length;
        var partial = lessons.filter(function (l) { return l.completionStatus === 'partial'; }).length;
        var skipped = lessons.filter(function (l) { return l.completionStatus === 'skipped' || l.completionStatus === 'not_started'; }).length;

        // Recent lessons (last 5)
        var recent = lessons.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 5);
        var lastDate = recent.length ? recent[0].date : null;

        // Units covered
        var units = {};
        lessons.forEach(function (l) { if (l.unit) units[l.unit] = (units[l.unit] || 0) + 1; });
        var unitList = Object.keys(units).slice(0, 5);

        html += '<div class="card" style="padding:0;margin-bottom:16px;overflow:hidden;border-top:4px solid ' + (cls.color || '#4F46E5') + '">';

        // Header
        html += '<div style="padding:14px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--border-light)">' +
          '<span style="font-weight:700;font-size:16px;color:' + (cls.color || '#4F46E5') + '">' + UI.escapeHTML(cls.name) + '</span>' +
          '<span class="badge">' + lessons.length + ' lessons</span>' +
          (lastDate ? '<span style="font-size:12px;color:var(--text-secondary)">Last: ' + UI.formatDate(lastDate) + '</span>' : '') +
          '<div style="margin-left:auto;display:flex;gap:6px">' +
          '<span style="font-size:12px;color:var(--success)">✅ ' + completed + '</span>' +
          '<span style="font-size:12px;color:var(--warning)">🟡 ' + partial + '</span>' +
          '<span style="font-size:12px;color:var(--text-tertiary)">⏭ ' + skipped + '</span>' +
          '</div></div>';

        // Recent lessons table
        html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
        html += '<thead><tr style="background:var(--bg-secondary)">' +
          '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em">Date</th>' +
          '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em">Topic</th>' +
          '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em">Focus</th>' +
          '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em">Status</th>' +
          '<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em">Time</th>' +
          '<th style="padding:8px 12px;width:80px"></th>' +
          '</tr></thead><tbody>';

        if (recent.length === 0) {
          html += '<tr><td colspan="6" style="padding:12px;text-align:center;color:var(--text-tertiary)">No lessons logged yet</td></tr>';
        } else {
          var focusLabels = {};
          M.LESSON_FOCUS_TYPES.forEach(function (f) { focusLabels[f.value] = f.label; });
          var statusMap = { completed:'success', partial:'warning', not_started:'danger', skipped:'neutral' };
          var statusLbl = { completed:'Done', partial:'Partial', not_started:'Not Started', skipped:'Skipped' };
          recent.forEach(function (l) {
            html += '<tr style="border-top:1px solid var(--border-light)">' +
              '<td style="padding:8px 12px">' + UI.formatDate(l.date) + '</td>' +
              '<td style="padding:8px 12px;max-width:200px">' + UI.escapeHTML(l.topic || l.unit || '—') + '</td>' +
              '<td style="padding:8px 12px">' + (l.lessonFocus ? '<span class="badge badge-info" style="font-size:11px">' + (focusLabels[l.lessonFocus] || l.lessonFocus) + '</span>' : '<span style="color:var(--text-tertiary)">—</span>') + '</td>' +
              '<td style="padding:8px 12px"><span class="badge badge-' + (statusMap[l.completionStatus] || 'neutral') + '">' + (statusLbl[l.completionStatus] || '—') + '</span></td>' +
              '<td style="padding:8px 12px;font-size:12px;color:var(--text-secondary)">' + (l.startTime || (l.period ? 'P' + l.period : '—')) + '</td>' +
              '<td style="padding:8px 12px"><a href="lessons.html" class="btn btn-ghost btn-sm" style="font-size:11px">Edit</a></td>' +
              '</tr>';
          });
          if (lessons.length > 5) {
            html += '<tr><td colspan="6" style="padding:8px 12px;text-align:center;font-size:12px;color:var(--text-secondary)">' +
              '<a href="lessons.html" style="color:var(--primary)">View all ' + lessons.length + ' lessons →</a>' +
              '</td></tr>';
          }
        }

        html += '</tbody></table></div>';

        // Units covered
        if (unitList.length > 0) {
          html += '<div style="padding:10px 16px;border-top:1px solid var(--border-light);display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
            '<span style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Units:</span>';
          unitList.forEach(function (u) {
            html += '<span class="badge">' + UI.escapeHTML(u) + ' <span style="color:var(--text-tertiary)">(' + units[u] + ')</span></span>';
          });
          html += '</div>';
        }

        html += '</div>';
      });

      container.innerHTML = html;
    }

    document.getElementById('overviewYearFilter').addEventListener('change', renderOverview);
    document.getElementById('overviewSearch').addEventListener('input', UI.debounce(renderOverview, 300));
    document.getElementById('btnRefreshOverview').addEventListener('click', renderOverview);

    // =====================================================================
    // INIT
    // =====================================================================
    // If coming from URL with ?tab=weekly or ?tab=overview
    var urlParams = new URLSearchParams(window.location.search);
    var tabParam = urlParams.get('tab');
    if (tabParam) {
      var targetTab = document.querySelector('.hub-tab[data-tab="' + tabParam + '"]');
      if (targetTab) targetTab.click();
    }

  });
})();
