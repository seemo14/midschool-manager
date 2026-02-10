/**
 * MidSchool Manager - Lesson Records Page Logic
 * Enhanced with official Moroccan logbook fields + AI Assist
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage, UI = MSM.UI, M = MSM.Models, KEYS = S.STORAGE_KEYS;
    var filterClass = '', filterStatus = '', filterSearch = '';

    UI.buildClassDropdown('filterClass', '', true);

    // Build lesson focus dropdown options
    function buildFocusOptions(selected) {
      return '<option value="">— Select focus —</option>' +
        M.LESSON_FOCUS_TYPES.map(function (f) {
          return '<option value="' + f.value + '"' + (f.value === selected ? ' selected' : '') + '>' + f.label + '</option>';
        }).join('');
    }

    // Build lesson stages checkboxes
    function buildStagesCheckboxes(selectedStages) {
      selectedStages = selectedStages || [];
      return '<div id="frmStagesGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:4px 12px">' +
        M.LESSON_STAGES.map(function (s) {
          var checked = selectedStages.indexOf(s.value) >= 0 ? ' checked' : '';
          return '<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;padding:3px 0">' +
            '<input type="checkbox" class="frmStage" value="' + s.value + '"' + checked + '>' + s.label + '</label>';
        }).join('') + '</div>';
    }

    // Build cancellation reason dropdown
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

      // Check if AI is configured
      var aiConfig = (MSM.AI && MSM.AI.getConfig) ? MSM.AI.getConfig() : {};
      var hasAI = !!aiConfig.apiKey;

      return (
        // --- Section 1: When & Where ---
        '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;margin-bottom:16px">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);font-weight:600;margin-bottom:8px">📅 When & Where</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Class <span class="required">*</span></label><select id="frmClass">' + classOpts + '</select></div>' +
            '<div class="form-group"><label>Date <span class="required">*</span></label><input type="date" id="frmDate" value="' + (lesson.date || today) + '"></div>' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group" style="margin-bottom:0"><label>Period</label><select id="frmPeriod"><option value="">Select period</option>' +
              '<option value="1"' + (lesson.period == 1 ? ' selected' : '') + '>Period 1</option>' +
              '<option value="2"' + (lesson.period == 2 ? ' selected' : '') + '>Period 2</option>' +
              '<option value="3"' + (lesson.period == 3 ? ' selected' : '') + '>Period 3</option>' +
              '<option value="4"' + (lesson.period == 4 ? ' selected' : '') + '>Period 4</option>' +
              '<option value="5"' + (lesson.period == 5 ? ' selected' : '') + '>Period 5</option>' +
              '<option value="6"' + (lesson.period == 6 ? ' selected' : '') + '>Period 6</option>' +
              '<option value="7"' + (lesson.period == 7 ? ' selected' : '') + '>Period 7</option></select></div>' +
            '<div class="form-group" style="margin-bottom:0"><label>Completion</label><select id="frmStatus">' +
              '<option value="completed"' + (lesson.completionStatus === 'completed' || !lesson.completionStatus ? ' selected' : '') + '>✅ Completed</option>' +
              '<option value="partial"' + (lesson.completionStatus === 'partial' ? ' selected' : '') + '>🟡 Partial</option>' +
              '<option value="not_started"' + (lesson.completionStatus === 'not_started' ? ' selected' : '') + '>🔴 Not Started</option>' +
              '<option value="skipped"' + (lesson.completionStatus === 'skipped' ? ' selected' : '') + '>⏭ Skipped</option></select></div>' +
          '</div>' +
        '</div>' +

        // --- Cancellation section (conditional) ---
        '<div id="cancellationSection" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:16px;' + cancelDisplay + '">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:var(--danger);font-weight:600;margin-bottom:8px">⚠ Interruption / Cancellation</div>' +
          '<div class="form-row">' +
            '<div class="form-group"><label>Reason</label><select id="frmCancelReason">' + buildCancellationOptions(lesson.cancellationReason) + '</select></div>' +
            '<div class="form-group"><label>Details</label><input type="text" id="frmCancelNote" value="' + UI.escapeHTML(lesson.cancellationNote || '') + '" placeholder="e.g. National holiday - Throne Day"></div>' +
          '</div>' +
        '</div>' +

        // --- Section 2: Lesson Content ---
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);font-weight:600">📖 Lesson Content</div>' +
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

        // --- Lesson Stages ---
        '<div class="form-group"><label style="margin-bottom:6px">Lesson Stages <span style="font-weight:400;color:var(--text-tertiary)">(select in order)</span></label>' +
          buildStagesCheckboxes(lesson.lessonStages) +
        '</div>' +

        // --- Student Activities ---
        '<div class="form-group"><label>Student Activities <span style="font-weight:400;color:var(--text-tertiary)">(Bloom\'s taxonomy verbs)</span></label>' +
          '<textarea id="frmStudentActivities" rows="2" placeholder="e.g. Ss identify new vocabulary, Ss match words to definitions, Ss produce oral sentences">' + UI.escapeHTML(lesson.studentActivities || '') + '</textarea></div>' +

        // --- Activities / Homework ---
        '<div class="form-group"><label>Lesson Description / Activities</label><textarea id="frmActivities" rows="2" placeholder="e.g. Listening exercise, pair work dialogue practice, workbook p.23 ex.2">' + UI.escapeHTML(lesson.activities || '') + '</textarea></div>' +
        '<div class="form-group"><label>Homework Assigned</label><textarea id="frmHomework" rows="2" placeholder="e.g. Workbook p.24, write 5 sentences using present continuous">' + UI.escapeHTML(lesson.homework || '') + '</textarea></div>' +

        // --- Notes ---
        '<div class="form-group"><label>Notes</label><textarea id="frmNotes" rows="2" placeholder="Any observations about the class session...">' + UI.escapeHTML(lesson.notes || '') + '</textarea></div>'
      );
    }

    function getFormData() {
      // Collect checked stages in order
      var stageEls = document.querySelectorAll('.frmStage:checked');
      var stages = [];
      for (var i = 0; i < stageEls.length; i++) {
        stages.push(stageEls[i].value);
      }

      return {
        classId: document.getElementById('frmClass').value,
        date: document.getElementById('frmDate').value,
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

    /**
     * Set up event handlers inside the lesson form modal:
     * - Toggle cancellation section based on status
     * - AI Assist button
     */
    function setupLessonFormHandlers() {
      // Toggle cancellation section
      var statusEl = document.getElementById('frmStatus');
      var cancelSection = document.getElementById('cancellationSection');
      if (statusEl && cancelSection) {
        statusEl.addEventListener('change', function () {
          var showCancel = (this.value === 'skipped' || this.value === 'not_started');
          cancelSection.style.display = showCancel ? '' : 'none';
        });
      }

      // AI Assist button
      var aiBtn = document.getElementById('btnAiAssist');
      if (aiBtn) {
        aiBtn.addEventListener('click', function () {
          var classId = document.getElementById('frmClass').value;
          var unit = document.getElementById('frmUnit').value.trim();
          var topic = document.getElementById('frmTopic').value.trim();
          var focus = document.getElementById('frmFocus').value;
          var page = document.getElementById('frmPage').value.trim();

          if (!topic && !unit) {
            UI.showToast('Please fill in at least Unit or Topic before using AI Assist', 'warning');
            return;
          }

          // Get recent lessons for this class (for continuity)
          var allLessons = S.getData(KEYS.LESSON_RECORDS) || [];
          var recentLessons = allLessons
            .filter(function (l) { return l.classId === classId; })
            .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
            .slice(0, 3);

          aiBtn.disabled = true;
          aiBtn.textContent = '⏳ Generating...';

          MSM.AI.suggestLessonContent(
            { classId: classId, unit: unit, topic: topic, lessonFocus: focus, textbookPage: page },
            recentLessons
          )
          .then(function (suggestions) {
            // Fill activities
            if (suggestions.activities) {
              var actEl = document.getElementById('frmActivities');
              if (actEl && !actEl.value.trim()) actEl.value = suggestions.activities;
            }
            // Fill homework
            if (suggestions.homework) {
              var hwEl = document.getElementById('frmHomework');
              if (hwEl && !hwEl.value.trim()) hwEl.value = suggestions.homework;
            }
            // Fill student activities
            if (suggestions.studentActivities) {
              var saEl = document.getElementById('frmStudentActivities');
              if (saEl && !saEl.value.trim()) saEl.value = suggestions.studentActivities;
            }
            // Check suggested stages
            if (suggestions.lessonStages && Array.isArray(suggestions.lessonStages)) {
              suggestions.lessonStages.forEach(function (stageVal) {
                var cb = document.querySelector('.frmStage[value="' + stageVal + '"]');
                if (cb) cb.checked = true;
              });
            }
            // Fill notes
            if (suggestions.notes) {
              var notesEl = document.getElementById('frmNotes');
              if (notesEl && !notesEl.value.trim()) notesEl.value = suggestions.notes;
            }
            UI.showToast('AI suggestions applied! Review and adjust as needed.', 'success');
          })
          .catch(function (err) {
            UI.showToast('AI error: ' + err.message, 'error');
          })
          .then(function () {
            aiBtn.disabled = false;
            aiBtn.textContent = '✨ AI Assist';
          });
        });
      }
    }

    function loadLessons() {
      var lessons = S.getData(KEYS.LESSON_RECORDS) || [];

      // Apply filters
      if (filterClass) lessons = lessons.filter(function (l) { return l.classId === filterClass; });
      if (filterStatus) lessons = lessons.filter(function (l) { return l.completionStatus === filterStatus; });
      if (filterSearch) {
        var q = filterSearch.toLowerCase();
        lessons = lessons.filter(function (l) {
          return (l.topic || '').toLowerCase().indexOf(q) >= 0 || (l.unit || '').toLowerCase().indexOf(q) >= 0 || (l.notes || '').toLowerCase().indexOf(q) >= 0;
        });
      }

      // Sort by date desc
      lessons.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

      // Build focus label map
      var focusLabels = {};
      M.LESSON_FOCUS_TYPES.forEach(function (f) { focusLabels[f.value] = f.label; });

      var columns = [
        { key: 'date', label: 'Date', sortable: true, render: function (v) { return UI.formatDate(v); } },
        { key: 'classId', label: 'Class', sortable: true, render: function (v) { var c = S.getById(KEYS.CLASSES, v); return c ? '<span style="color:' + c.color + ';font-weight:600">' + UI.escapeHTML(c.name) + '</span>' : v; } },
        { key: 'period', label: 'Period', width: '70px', render: function (v) { return v ? 'P' + v : '-'; } },
        { key: 'unit', label: 'Unit', sortable: true },
        { key: 'topic', label: 'Topic', sortable: true },
        { key: 'lessonFocus', label: 'Focus', width: '110px', render: function (v) {
          if (!v) return '<span style="color:var(--text-tertiary)">—</span>';
          return '<span class="badge badge-info" style="font-size:11px">' + (focusLabels[v] || v) + '</span>';
        }},
        { key: 'completionStatus', label: 'Status', render: function (v) {
          var map = { completed: 'success', partial: 'warning', not_started: 'danger', skipped: 'neutral' };
          var labels = { completed: 'Done', partial: 'Partial', not_started: 'Not Started', skipped: 'Skipped' };
          return '<span class="badge badge-' + (map[v] || 'neutral') + '">' + (labels[v] || v || '-') + '</span>';
        }},
        { key: 'id', label: 'Actions', width: '120px', render: function (v) {
          return '<button class="btn btn-ghost btn-sm" onclick="MSM.LessonsPage.edit(\'' + v + '\')">Edit</button>' +
                 '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="MSM.LessonsPage.del(\'' + v + '\')">Del</button>';
        }}
      ];

      UI.buildTable('lessonsTable', columns, lessons, {
        pageSize: 20,
        emptyMessage: 'No lesson records yet. Click "+ New Lesson Record" to log your first class.',
        striped: true
      });
    }

    loadLessons();

    // Filters
    document.getElementById('filterClass').addEventListener('change', function () { filterClass = this.value; loadLessons(); });
    document.getElementById('filterStatus').addEventListener('change', function () { filterStatus = this.value; loadLessons(); });
    document.getElementById('filterSearch').addEventListener('input', UI.debounce(function () { filterSearch = this.value; loadLessons(); }.bind(document.getElementById('filterSearch')), 300));

    // New lesson
    document.getElementById('btnNewLesson').addEventListener('click', function () {
      openNewLessonModal();
    });

    // Quick log from dashboard timetable (URL params: ?quick=1&classId=xxx&period=n)
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('quick') === '1') {
      var prefillData = {};
      if (urlParams.get('classId')) prefillData.classId = urlParams.get('classId');
      if (urlParams.get('period')) prefillData.period = parseInt(urlParams.get('period'), 10);
      // Clean URL without reloading
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      setTimeout(function () { openNewLessonModal(prefillData); }, 300);
    }

    function openNewLessonModal(prefill) {
      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button>' +
        '<button class="btn btn-secondary" id="btnSaveAnother">Save & Add Another</button>' +
        '<button class="btn btn-primary" id="btnSaveLesson">Save</button>';
      UI.showModal('New Lesson Record', getFormHTML(prefill || {}), { footerHTML: footerHTML, width: '650px' });
      setupLessonFormHandlers();

      document.getElementById('btnSaveLesson').addEventListener('click', function () {
        var data = getFormData();
        if (!data.classId || !data.date) { UI.showToast('Class and date are required', 'error'); return; }
        var record = M.createLessonRecord(data);
        S.addItem(KEYS.LESSON_RECORDS, record);
        UI.closeModal();
        UI.showToast('Lesson record saved!', 'success');
        loadLessons();
      });

      document.getElementById('btnSaveAnother').addEventListener('click', function () {
        var data = getFormData();
        if (!data.classId || !data.date) { UI.showToast('Class and date are required', 'error'); return; }
        var record = M.createLessonRecord(data);
        S.addItem(KEYS.LESSON_RECORDS, record);
        UI.showToast('Saved! Add another.', 'success');
        var nextPeriod = (data.period || 0) + 1;
        UI.closeModal();
        loadLessons();
        openNewLessonModal({ date: data.date, period: nextPeriod, classId: data.classId });
      });
    }

    // Edit/delete
    window.MSM.LessonsPage = {
      edit: function (id) {
        var lesson = S.getById(KEYS.LESSON_RECORDS, id);
        if (!lesson) return;
        var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnUpdateLesson">Update</button>';
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
          UI.showToast('Deleted', 'success');
          loadLessons();
        });
      }
    };
  });
})();
