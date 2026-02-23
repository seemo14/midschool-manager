/**
 * MidSchool Manager - Lesson Records Page
 * Enhanced: quick-add bar, time tracking, bulk actions, grouped view
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage, UI = MSM.UI, M = MSM.Models, KEYS = S.STORAGE_KEYS;
    var filterClass = '', filterStatus = '', filterSearch = '', filterDateFrom = '', filterDateTo = '';
    var currentView = 'table'; // 'table' | 'grouped'
    var selectedIds = [];

    // =====================================================================
    // INIT DROPDOWNS
    // =====================================================================
    UI.buildClassDropdown('filterClass', '', true);
    UI.buildClassDropdown('qaClass', '', false);

    var qaDateEl = document.getElementById('qaDate');
    if (qaDateEl) qaDateEl.value = M.getToday();

    // =====================================================================
    // VIEW TOGGLE
    // =====================================================================
    document.querySelectorAll('.lessons-view-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.lessons-view-tab').forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        currentView = this.dataset.view;
        loadLessons();
      });
    });

    // =====================================================================
    // QUICK-ADD BAR
    // =====================================================================
    document.getElementById('btnQuickSave').addEventListener('click', function () {
      var classId = document.getElementById('qaClass').value;
      var date = document.getElementById('qaDate').value;
      var topic = document.getElementById('qaTopic').value.trim();
      if (!classId || !date || !topic) {
        UI.showToast('Class, date, and topic are required', 'error');
        return;
      }
      var rec = M.createLessonRecord({
        classId: classId,
        date: date,
        period: parseInt(document.getElementById('qaPeriod').value) || null,
        topic: topic,
        completionStatus: document.getElementById('qaStatus').value
      });
      rec.startTime = document.getElementById('qaTime').value || '';
      S.addItem(KEYS.LESSON_RECORDS, rec);
      // Clear topic and time for rapid entry
      document.getElementById('qaTopic').value = '';
      document.getElementById('qaTime').value = '';
      UI.showToast('Lesson logged!', 'success');
      loadLessons();
      document.getElementById('qaTopic').focus();
    });

    // Allow Enter in topic field to trigger quick-save
    document.getElementById('qaTopic').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('btnQuickSave').click();
    });

    // =====================================================================
    // BULK ACTIONS
    // =====================================================================
    function updateBulkToolbar() {
      var toolbar = document.getElementById('bulkToolbar');
      var count = document.getElementById('bulkCount');
      if (selectedIds.length > 0) {
        toolbar.classList.add('visible');
        count.textContent = selectedIds.length + ' selected';
      } else {
        toolbar.classList.remove('visible');
      }
    }

    document.getElementById('btnBulkStatus').addEventListener('click', function () {
      var status = document.getElementById('bulkStatusSel').value;
      if (!status) { UI.showToast('Choose a status first', 'warning'); return; }
      selectedIds.forEach(function (id) {
        S.updateItem(KEYS.LESSON_RECORDS, id, { completionStatus: status, updatedAt: new Date().toISOString() });
      });
      UI.showToast(selectedIds.length + ' records updated', 'success');
      selectedIds = [];
      loadLessons();
    });

    document.getElementById('btnBulkDelete').addEventListener('click', function () {
      UI.showConfirm('Delete ' + selectedIds.length + ' lesson records? This cannot be undone.', function () {
        selectedIds.forEach(function (id) { S.deleteItem(KEYS.LESSON_RECORDS, id); });
        UI.showToast(selectedIds.length + ' records deleted', 'success');
        selectedIds = [];
        loadLessons();
      });
    });

    document.getElementById('btnBulkClear').addEventListener('click', function () {
      selectedIds = [];
      updateBulkToolbar();
      loadLessons();
    });

    // =====================================================================
    // FILTERS
    // =====================================================================
    document.getElementById('filterClass').addEventListener('change', function () { filterClass = this.value; loadLessons(); });
    document.getElementById('filterStatus').addEventListener('change', function () { filterStatus = this.value; loadLessons(); });
    document.getElementById('filterSearch').addEventListener('input', UI.debounce(function () { filterSearch = this.value; loadLessons(); }.bind(document.getElementById('filterSearch')), 300));
    document.getElementById('filterDateFrom').addEventListener('change', function () { filterDateFrom = this.value; loadLessons(); });
    document.getElementById('filterDateTo').addEventListener('change', function () { filterDateTo = this.value; loadLessons(); });

    // =====================================================================
    // LOAD & RENDER LESSONS
    // =====================================================================
    function getFilteredLessons() {
      var lessons = S.getData(KEYS.LESSON_RECORDS) || [];
      if (filterClass) lessons = lessons.filter(function (l) { return l.classId === filterClass; });
      if (filterStatus) lessons = lessons.filter(function (l) { return l.completionStatus === filterStatus; });
      if (filterDateFrom) lessons = lessons.filter(function (l) { return (l.date || '') >= filterDateFrom; });
      if (filterDateTo) lessons = lessons.filter(function (l) { return (l.date || '') <= filterDateTo; });
      if (filterSearch) {
        var q = filterSearch.toLowerCase();
        lessons = lessons.filter(function (l) {
          return (l.topic || '').toLowerCase().indexOf(q) >= 0 ||
            (l.unit || '').toLowerCase().indexOf(q) >= 0 ||
            (l.activities || '').toLowerCase().indexOf(q) >= 0;
        });
      }
      lessons.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      return lessons;
    }

    function loadLessons() {
      var lessons = getFilteredLessons();
      if (currentView === 'grouped') {
        renderGroupedView(lessons);
      } else {
        renderTableView(lessons);
      }
    }

    // =====================================================================
    // TABLE VIEW (with time, checkbox, inline editing)
    // =====================================================================
    var focusLabels = {};
    M.LESSON_FOCUS_TYPES.forEach(function (f) { focusLabels[f.value] = f.label; });

    function statusBadge(v) {
      var map = { completed: 'success', partial: 'warning', not_started: 'danger', skipped: 'neutral' };
      var labels = { completed: 'Done', partial: 'Partial', not_started: 'Not Started', skipped: 'Skipped' };
      return '<span class="badge badge-' + (map[v] || 'neutral') + '" style="font-size:11px">' + (labels[v] || v || '—') + '</span>';
    }

    function renderTableView(lessons) {
      var container = document.getElementById('lessonsTable');
      if (lessons.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📖</div><h3 class="empty-state__title">No lesson records yet</h3><p class="empty-state__text">Use the quick-add bar above, click "+ New Record", or go to <a href="teaching-hub.html">Teaching Hub</a> to bulk-generate from a pasted plan.</p></div>';
        return;
      }

      var html = '<div style="overflow-x:auto"><table class="lessons-tbl">' +
        '<thead><tr>' +
        '<th style="width:28px"><input type="checkbox" id="chkAll" title="Select all" class="row-check"></th>' +
        '<th>Date</th>' +
        '<th style="width:80px">Time</th>' +
        '<th>Class</th>' +
        '<th style="width:60px">P</th>' +
        '<th>Unit</th>' +
        '<th>Topic</th>' +
        '<th style="width:110px">Focus</th>' +
        '<th style="width:100px">Status</th>' +
        '<th style="width:140px">Actions</th>' +
        '</tr></thead><tbody>';

      lessons.forEach(function (l) {
        var cls = S.getById(KEYS.CLASSES, l.classId);
        var clsName = cls ? cls.name : '?';
        var clsColor = cls ? cls.color : '#888';
        var isChecked = selectedIds.indexOf(l.id) >= 0;
        var timeDisplay = l.startTime || (l.period ? 'P' + l.period : '—');

        html += '<tr data-id="' + l.id + '">' +
          '<td><input type="checkbox" class="row-check lesson-check" data-id="' + l.id + '"' + (isChecked ? ' checked' : '') + '></td>' +
          '<td style="white-space:nowrap;font-size:12px">' + UI.formatDate(l.date) + '</td>' +
          '<td class="time-col">' + UI.escapeHTML(timeDisplay) + '</td>' +
          '<td><span style="color:' + clsColor + ';font-weight:700;font-size:13px">' + UI.escapeHTML(clsName) + '</span></td>' +
          '<td style="text-align:center;font-size:12px;color:var(--text-secondary)">' + (l.period || '—') + '</td>' +
          '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-secondary)">' + UI.escapeHTML(l.unit || '—') + '</td>' +
          '<td style="max-width:220px"><span style="font-weight:500">' + UI.escapeHTML(l.topic || '—') + '</span></td>' +
          '<td>' + (l.lessonFocus ? '<span class="badge badge-info" style="font-size:11px">' + (focusLabels[l.lessonFocus] || l.lessonFocus) + '</span>' : '<span style="color:var(--text-tertiary);font-size:12px">—</span>') + '</td>' +
          '<td>' + statusBadge(l.completionStatus) + '</td>' +
          '<td style="white-space:nowrap">' +
          '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px" onclick="MSM.LessonsPage.view(\'' + l.id + '\')">View</button>' +
          '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px" onclick="MSM.LessonsPage.edit(\'' + l.id + '\')">Edit</button>' +
          '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;color:var(--danger)" onclick="MSM.LessonsPage.del(\'' + l.id + '\')">Del</button>' +
          '</td></tr>';
      });

      html += '</tbody></table></div>';
      html += '<div style="padding:8px 0;font-size:12px;color:var(--text-secondary)">' + lessons.length + ' record' + (lessons.length !== 1 ? 's' : '') + '</div>';
      container.innerHTML = html;

      // Select all checkbox
      var chkAll = document.getElementById('chkAll');
      if (chkAll) {
        chkAll.addEventListener('change', function () {
          var checks = document.querySelectorAll('.lesson-check');
          checks.forEach(function (cb) {
            cb.checked = chkAll.checked;
            var id = cb.dataset.id;
            if (chkAll.checked) {
              if (selectedIds.indexOf(id) < 0) selectedIds.push(id);
            } else {
              selectedIds = selectedIds.filter(function (sid) { return sid !== id; });
            }
          });
          updateBulkToolbar();
        });
      }

      // Row checkboxes
      document.querySelectorAll('.lesson-check').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var id = this.dataset.id;
          if (this.checked) {
            if (selectedIds.indexOf(id) < 0) selectedIds.push(id);
          } else {
            selectedIds = selectedIds.filter(function (sid) { return sid !== id; });
          }
          updateBulkToolbar();
        });
      });
    }

    // =====================================================================
    // GROUPED VIEW (by class)
    // =====================================================================
    function renderGroupedView(lessons) {
      var container = document.getElementById('lessonsTable');
      if (lessons.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📖</div><h3 class="empty-state__title">No lesson records yet</h3><p class="empty-state__text">Use the quick-add bar or go to <a href="teaching-hub.html">Teaching Hub</a> to bulk-generate.</p></div>';
        return;
      }

      // Group by class
      var groups = {};
      var classes = S.getData(KEYS.CLASSES) || [];
      lessons.forEach(function (l) {
        if (!groups[l.classId]) groups[l.classId] = [];
        groups[l.classId].push(l);
      });

      var html = '';
      classes.forEach(function (cls) {
        var group = groups[cls.id];
        if (!group || group.length === 0) return;
        var completed = group.filter(function (l) { return l.completionStatus === 'completed'; }).length;

        html += '<div class="class-group">';
        html += '<div class="class-group__header" style="background:' + hexToRgba(cls.color || '#4F46E5', .08) + ';border-left:4px solid ' + (cls.color || '#4F46E5') + '">' +
          '<span class="class-group__name" style="color:' + (cls.color || '#4F46E5') + '">' + UI.escapeHTML(cls.name) + '</span>' +
          '<span class="badge badge-success">' + completed + ' done</span>' +
          '<span class="class-group__count">' + group.length + ' lesson' + (group.length !== 1 ? 's' : '') + '</span>' +
          '</div>';
        html += '<div class="class-group__body"><table class="lessons-tbl"><thead><tr>' +
          '<th>Date</th><th style="width:80px">Time</th><th style="width:50px">P</th>' +
          '<th>Unit</th><th>Topic</th><th>Focus</th><th>Status</th><th>Actions</th>' +
          '</tr></thead><tbody>';

        group.forEach(function (l) {
          var timeDisplay = l.startTime || (l.period ? 'P' + l.period : '—');
          html += '<tr>' +
            '<td style="white-space:nowrap;font-size:12px">' + UI.formatDate(l.date) + '</td>' +
            '<td class="time-col">' + UI.escapeHTML(timeDisplay) + '</td>' +
            '<td style="text-align:center;font-size:12px;color:var(--text-secondary)">' + (l.period || '—') + '</td>' +
            '<td style="font-size:12px;color:var(--text-secondary);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + UI.escapeHTML(l.unit || '—') + '</td>' +
            '<td style="max-width:200px;font-weight:500">' + UI.escapeHTML(l.topic || '—') + '</td>' +
            '<td>' + (l.lessonFocus ? '<span class="badge badge-info" style="font-size:11px">' + (focusLabels[l.lessonFocus] || l.lessonFocus) + '</span>' : '—') + '</td>' +
            '<td>' + statusBadge(l.completionStatus) + '</td>' +
            '<td style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 7px" onclick="MSM.LessonsPage.edit(\'' + l.id + '\')">Edit</button>' +
            '<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 7px;color:var(--danger)" onclick="MSM.LessonsPage.del(\'' + l.id + '\')">Del</button>' +
            '</td></tr>';
        });

        html += '</tbody></table></div></div>';
      });

      container.innerHTML = html || '<div class="empty-state"><div class="empty-state__icon">📖</div><h3>No records match your filters</h3></div>';
    }

    function hexToRgba(hex, alpha) {
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    loadLessons();

    // =====================================================================
    // FORM BUILDERS (full form for New/Edit)
    // =====================================================================
    function buildFocusOptions(selected) {
      return '<option value="">— Select focus —</option>' +
        M.LESSON_FOCUS_TYPES.map(function (f) {
          return '<option value="' + f.value + '"' + (f.value === selected ? ' selected' : '') + '>' + f.label + '</option>';
        }).join('');
    }

    function buildStagesCheckboxes(selectedStages) {
      selectedStages = selectedStages || [];
      return '<div id="frmStagesGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:4px 12px">' +
        M.LESSON_STAGES.map(function (s) {
          var checked = selectedStages.indexOf(s.value) >= 0 ? ' checked' : '';
          return '<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;padding:3px 0">' +
            '<input type="checkbox" class="frmStage" value="' + s.value + '"' + checked + '>' + s.label + '</label>';
        }).join('') + '</div>';
    }

    function buildCancellationOptions(selected) {
      return '<option value="">— Select reason —</option>' +
        M.CANCELLATION_REASONS.map(function (r) {
          return '<option value="' + r.value + '"' + (r.value === selected ? ' selected' : '') + '>' + r.label + '</option>';
        }).join('');
    }

    function getFormHTML(lesson) {
      lesson = lesson || {};
      var today = M.getToday();
      var classes = S.getData(KEYS.CLASSES) || [];
      var classOpts = classes.map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === lesson.classId ? ' selected' : '') + '>' + UI.escapeHTML(c.name) + '</option>';
      }).join('');

      var isCancelled = lesson.completionStatus === 'skipped' || lesson.completionStatus === 'not_started';
      var cancelDisplay = isCancelled ? '' : 'display:none;';
      var aiConfig = (MSM.AI && MSM.AI.getConfig) ? MSM.AI.getConfig() : {};
      var hasAI = !!aiConfig.apiKey;

      return (
        '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;margin-bottom:16px">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);font-weight:600;margin-bottom:8px">📅 When &amp; Where</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Class <span class="required">*</span></label><select id="frmClass">' + classOpts + '</select></div>' +
            '<div class="form-group"><label>Date <span class="required">*</span></label><input type="date" id="frmDate" value="' + (lesson.date || today) + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Time taught</label><input type="time" id="frmTime" value="' + (lesson.startTime || '') + '" placeholder="e.g. 08:30"></div>' +
            '<div class="form-group"><label>Period</label><select id="frmPeriod"><option value="">Select period</option>' +
              [1,2,3,4,5,6,7].map(function(n){ return '<option value="'+n+'"'+(lesson.period==n?' selected':'')+'>Period '+n+'</option>'; }).join('') +
            '</select></div>' +
            '<div class="form-group"><label>Completion</label><select id="frmStatus">' +
              '<option value="completed"' + (lesson.completionStatus === 'completed' || !lesson.completionStatus ? ' selected' : '') + '>✅ Completed</option>' +
              '<option value="partial"' + (lesson.completionStatus === 'partial' ? ' selected' : '') + '>🟡 Partial</option>' +
              '<option value="not_started"' + (lesson.completionStatus === 'not_started' ? ' selected' : '') + '>🔴 Not Started</option>' +
              '<option value="skipped"' + (lesson.completionStatus === 'skipped' ? ' selected' : '') + '>⏭ Skipped</option>' +
            '</select></div>' +
          '</div>' +
        '</div>' +

        '<div id="cancellationSection" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:16px;' + cancelDisplay + '">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--danger);font-weight:600;margin-bottom:8px">⚠ Interruption / Cancellation</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Reason</label><select id="frmCancelReason">' + buildCancellationOptions(lesson.cancellationReason) + '</select></div>' +
            '<div class="form-group"><label>Details</label><input type="text" id="frmCancelNote" value="' + UI.escapeHTML(lesson.cancellationNote || '') + '" placeholder="e.g. National holiday - Throne Day"></div>' +
          '</div>' +
        '</div>' +

        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);font-weight:600">📖 Lesson Content</div>' +
          (hasAI ? '<button type="button" class="btn btn-ghost btn-sm" id="btnAiAssist" style="font-size:12px;color:var(--primary)">✨ AI Assist</button>' : '') +
        '</div>' +

        '<div class="form-row">' +
          '<div class="form-group"><label>Unit</label><input type="text" id="frmUnit" value="' + UI.escapeHTML(lesson.unit || '') + '" placeholder="e.g. Unit 3 - Daily Life"></div>' +
          '<div class="form-group"><label>Textbook Page</label><input type="text" id="frmPage" value="' + UI.escapeHTML(lesson.textbookPage || '') + '" placeholder="e.g. pp. 45-47"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Topic / Lesson Title</label><input type="text" id="frmTopic" value="' + UI.escapeHTML(lesson.topic || '') + '" placeholder="e.g. Present Continuous - Describing actions"></div>' +
          '<div class="form-group"><label>Lesson Focus / Skill</label><select id="frmFocus">' + buildFocusOptions(lesson.lessonFocus) + '</select></div>' +
        '</div>' +

        '<div class="form-group"><label style="margin-bottom:6px">Lesson Stages <span style="font-weight:400;color:var(--text-tertiary)">(select in order)</span></label>' +
          buildStagesCheckboxes(lesson.lessonStages) +
        '</div>' +

        '<div class="form-group"><label>Student Activities <span style="font-weight:400;color:var(--text-tertiary)">(Bloom\'s verbs)</span></label>' +
          '<textarea id="frmStudentActivities" rows="2" placeholder="e.g. Ss identify vocabulary, Ss match words, Ss produce oral sentences">' + UI.escapeHTML(lesson.studentActivities || '') + '</textarea></div>' +

        '<div class="form-group"><label>Lesson Description / Activities</label><textarea id="frmActivities" rows="2" placeholder="e.g. Listening exercise, pair work dialogue">' + UI.escapeHTML(lesson.activities || '') + '</textarea></div>' +
        '<div class="form-group"><label>Homework Assigned</label><textarea id="frmHomework" rows="2" placeholder="e.g. Workbook p.24">' + UI.escapeHTML(lesson.homework || '') + '</textarea></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="frmNotes" rows="2" placeholder="Any observations...">' + UI.escapeHTML(lesson.notes || '') + '</textarea></div>'
      );
    }

    function getFormData() {
      var stageEls = document.querySelectorAll('.frmStage:checked');
      var stages = [];
      for (var i = 0; i < stageEls.length; i++) { stages.push(stageEls[i].value); }
      return {
        classId: document.getElementById('frmClass').value,
        date: document.getElementById('frmDate').value,
        startTime: document.getElementById('frmTime').value || '',
        period: parseInt(document.getElementById('frmPeriod').value) || null,
        unit: document.getElementById('frmUnit').value.trim(),
        topic: document.getElementById('frmTopic').value.trim(),
        textbookPage: document.getElementById('frmPage').value.trim(),
        lessonFocus: document.getElementById('frmFocus').value,
        lessonStages: stages,
        studentActivities: document.getElementById('frmStudentActivities').value.trim(),
        activities: document.getElementById('frmActivities').value.trim(),
        homework: document.getElementById('frmHomework').value.trim(),
        completionStatus: document.getElementById('frmStatus').value,
        cancellationReason: document.getElementById('frmCancelReason').value,
        cancellationNote: document.getElementById('frmCancelNote').value.trim(),
        notes: document.getElementById('frmNotes').value.trim()
      };
    }

    function setupLessonFormHandlers() {
      var statusEl = document.getElementById('frmStatus');
      var cancelSection = document.getElementById('cancellationSection');
      if (statusEl && cancelSection) {
        statusEl.addEventListener('change', function () {
          var showCancel = (this.value === 'skipped' || this.value === 'not_started');
          cancelSection.style.display = showCancel ? '' : 'none';
        });
      }

      var aiBtn = document.getElementById('btnAiAssist');
      if (aiBtn) {
        aiBtn.addEventListener('click', function () {
          var classId = document.getElementById('frmClass').value;
          var unit = document.getElementById('frmUnit').value.trim();
          var topic = document.getElementById('frmTopic').value.trim();
          var focus = document.getElementById('frmFocus').value;
          var page = document.getElementById('frmPage').value.trim();
          if (!topic && !unit) { UI.showToast('Fill in at least Unit or Topic first', 'warning'); return; }
          var allLessons = S.getData(KEYS.LESSON_RECORDS) || [];
          var recentLessons = allLessons.filter(function (l) { return l.classId === classId; })
            .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 3);
          aiBtn.disabled = true;
          aiBtn.textContent = '⏳ Generating...';
          MSM.AI.suggestLessonContent({ classId: classId, unit: unit, topic: topic, lessonFocus: focus, textbookPage: page }, recentLessons)
            .then(function (s) {
              if (s.activities) { var el = document.getElementById('frmActivities'); if (el && !el.value.trim()) el.value = s.activities; }
              if (s.homework) { var el = document.getElementById('frmHomework'); if (el && !el.value.trim()) el.value = s.homework; }
              if (s.studentActivities) { var el = document.getElementById('frmStudentActivities'); if (el && !el.value.trim()) el.value = s.studentActivities; }
              if (s.lessonStages && Array.isArray(s.lessonStages)) {
                s.lessonStages.forEach(function (v) { var cb = document.querySelector('.frmStage[value="' + v + '"]'); if (cb) cb.checked = true; });
              }
              if (s.notes) { var el = document.getElementById('frmNotes'); if (el && !el.value.trim()) el.value = s.notes; }
              UI.showToast('AI suggestions applied!', 'success');
            })
            .catch(function (err) { UI.showToast('AI error: ' + err.message, 'error'); })
            .then(function () { aiBtn.disabled = false; aiBtn.textContent = '✨ AI Assist'; });
        });
      }
    }

    // =====================================================================
    // NEW LESSON (full modal)
    // =====================================================================
    document.getElementById('btnNewLesson').addEventListener('click', function () {
      openNewLessonModal();
    });

    // Quick log from dashboard (URL param)
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('quick') === '1') {
      var prefillData = {};
      if (urlParams.get('classId')) prefillData.classId = urlParams.get('classId');
      if (urlParams.get('period')) prefillData.period = parseInt(urlParams.get('period'), 10);
      if (window.history && window.history.replaceState) window.history.replaceState({}, '', window.location.pathname);
      setTimeout(function () { openNewLessonModal(prefillData); }, 300);
    }
    if (urlParams.get('action') === 'new') {
      if (window.history && window.history.replaceState) window.history.replaceState({}, '', window.location.pathname);
      setTimeout(function () { openNewLessonModal(); }, 300);
    }

    function openNewLessonModal(prefill) {
      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button>' +
        '<button class="btn btn-secondary" id="btnSaveAnother">Save &amp; Add Another</button>' +
        '<button class="btn btn-primary" id="btnSaveLesson">Save</button>';
      UI.showModal('New Lesson Record', getFormHTML(prefill || {}), { footerHTML: footerHTML, width: '650px' });
      setupLessonFormHandlers();

      document.getElementById('btnSaveLesson').addEventListener('click', function () {
        var data = getFormData();
        if (!data.classId || !data.date) { UI.showToast('Class and date are required', 'error'); return; }
        var rec = M.createLessonRecord(data);
        rec.startTime = data.startTime || '';
        S.addItem(KEYS.LESSON_RECORDS, rec);
        UI.closeModal();
        UI.showToast('Lesson record saved!', 'success');
        loadLessons();
      });

      document.getElementById('btnSaveAnother').addEventListener('click', function () {
        var data = getFormData();
        if (!data.classId || !data.date) { UI.showToast('Class and date are required', 'error'); return; }
        var rec = M.createLessonRecord(data);
        rec.startTime = data.startTime || '';
        S.addItem(KEYS.LESSON_RECORDS, rec);
        UI.showToast('Saved! Add another.', 'success');
        UI.closeModal();
        loadLessons();
        openNewLessonModal({ date: data.date, period: (data.period || 0) + 1, classId: data.classId, unit: data.unit });
      });
    }

    // =====================================================================
    // PUBLIC API
    // =====================================================================
    window.MSM.LessonsPage = {
      view: function (id) {
        var lesson = S.getById(KEYS.LESSON_RECORDS, id);
        if (!lesson) return;
        var cls = S.getById(KEYS.CLASSES, lesson.classId);
        var clsName = cls ? cls.name : 'Unknown';
        var clsColor = cls ? cls.color : '#888';
        var statusLabels = { completed: 'Completed', partial: 'Partial', not_started: 'Not Started', skipped: 'Skipped' };
        var statusBadgeMap = { completed: 'success', partial: 'warning', not_started: 'danger', skipped: 'neutral' };

        var html = '<div style="margin-bottom:16px;display:flex;gap:6px;flex-wrap:wrap">' +
          '<span class="badge" style="background:' + UI.escapeHTML(clsColor) + ';color:#fff">' + UI.escapeHTML(clsName) + '</span>' +
          '<span class="badge badge-' + (statusBadgeMap[lesson.completionStatus] || 'neutral') + '">' + (statusLabels[lesson.completionStatus] || lesson.completionStatus || '-') + '</span>' +
          (lesson.lessonFocus ? '<span class="badge badge-info">' + (focusLabels[lesson.lessonFocus] || lesson.lessonFocus) + '</span>' : '') +
          '</div>';

        if (lesson.date) html += '<div style="margin-bottom:8px"><strong>Date:</strong> ' + UI.formatDate(lesson.date) +
          (lesson.startTime ? ' at <strong>' + lesson.startTime + '</strong>' : '') +
          (lesson.period ? ' &bull; Period ' + lesson.period : '') + '</div>';
        if (lesson.unit) html += '<div style="margin-bottom:8px"><strong>Unit:</strong> ' + UI.escapeHTML(lesson.unit) + '</div>';
        if (lesson.topic) html += '<div style="margin-bottom:8px"><strong>Topic:</strong> ' + UI.escapeHTML(lesson.topic) + '</div>';
        if (lesson.textbookPage) html += '<div style="margin-bottom:8px"><strong>Page:</strong> ' + UI.escapeHTML(lesson.textbookPage) + '</div>';
        if (lesson.studentActivities) html += '<div style="margin-bottom:12px"><strong>Student Activities:</strong><p style="margin:4px 0;color:var(--text-secondary)">' + UI.escapeHTML(lesson.studentActivities) + '</p></div>';
        if (lesson.activities) html += '<div style="margin-bottom:12px"><strong>Activities:</strong><p style="margin:4px 0;color:var(--text-secondary)">' + UI.escapeHTML(lesson.activities) + '</p></div>';
        if (lesson.homework) html += '<div style="margin-bottom:12px"><strong>Homework:</strong><p style="margin:4px 0;color:var(--text-secondary)">' + UI.escapeHTML(lesson.homework) + '</p></div>';
        if (lesson.notes) html += '<div style="margin-bottom:12px"><strong>Notes:</strong><p style="margin:4px 0;color:var(--text-secondary)">' + UI.escapeHTML(lesson.notes) + '</p></div>';

        if (MSM.Sidepanel) {
          MSM.Sidepanel.open({
            title: lesson.topic || lesson.unit || 'Lesson Record',
            content: html,
            actions: [
              { label: 'Edit', className: 'btn-primary', onClick: function () { MSM.Sidepanel.close(); MSM.LessonsPage.edit(id); } },
              { label: 'Delete', className: 'btn-secondary', onClick: function () { MSM.Sidepanel.close(); MSM.LessonsPage.del(id); } }
            ]
          });
        } else {
          var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Close</button>' +
            '<button class="btn btn-primary" onclick="MSM.UI.closeModal();MSM.LessonsPage.edit(\'' + id + '\')">Edit</button>';
          UI.showModal(lesson.topic || 'Lesson Record', html, { width: '550px', footerHTML: footerHTML });
        }
      },

      edit: function (id) {
        var lesson = S.getById(KEYS.LESSON_RECORDS, id);
        if (!lesson) return;
        var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button>' +
          '<button class="btn btn-primary" id="btnUpdateLesson">Update</button>';
        UI.showModal('Edit Lesson Record', getFormHTML(lesson), { footerHTML: footerHTML, width: '650px' });
        setupLessonFormHandlers();
        document.getElementById('btnUpdateLesson').addEventListener('click', function () {
          var data = getFormData();
          if (!data.classId || !data.date) { UI.showToast('Class and date are required', 'error'); return; }
          S.updateItem(KEYS.LESSON_RECORDS, id, data);
          UI.closeModal();
          UI.showToast('Lesson record updated!', 'success');
          loadLessons();
        });
      },

      del: function (id) {
        UI.showConfirm('Delete this lesson record?', function () {
          S.deleteItem(KEYS.LESSON_RECORDS, id);
          selectedIds = selectedIds.filter(function (sid) { return sid !== id; });
          updateBulkToolbar();
          UI.showToast('Deleted', 'success');
          loadLessons();
        });
      }
    };

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('btnNewLesson').click();
      }
    });
  });
})();
