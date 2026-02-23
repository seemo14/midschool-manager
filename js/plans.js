/**
 * MidSchool Manager - Lesson Plans Page Logic
 * Enhanced with: templates, import/export, keyboard shortcuts
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage, UI = MSM.UI, M = MSM.Models, KEYS = S.STORAGE_KEYS;
    var filterYear = '', filterStatus = '', filterSearch = '';
    var statusColors = { draft: 'neutral', ready: 'info', used: 'success', archived: 'neutral' };
    var activityColors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    var TEMPLATE_KEY = 'msm_plan_templates';

    // =====================================================================
    // Template Storage Helpers
    // =====================================================================
    function getTemplates() {
      try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || []; }
      catch (e) { return []; }
    }
    function saveTemplates(templates) {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
    }

    // =====================================================================
    // Form HTML Builder
    // =====================================================================
    function getFormHTML(plan) {
      plan = plan || {};
      var objectives = (plan.objectives || ['']).join('\n');
      var actHtml = '';
      var activities = plan.activities || [];
      for (var i = 0; i < activities.length; i++) {
        actHtml += buildActivityRow(i, activities[i]);
      }

      return '<div style="background:var(--bg-secondary);border-radius:10px;padding:14px;margin-bottom:16px">' +
        '<div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-secondary);font-weight:600;margin-bottom:8px">Plan Info</div>' +
        '<div class="form-group"><label>Title <span class="required">*</span></label><input type="text" id="frmTitle" value="' + UI.escapeHTML(plan.title || '') + '" placeholder="e.g. Present Continuous - Introduction"></div>' +
        '<div class="form-row"><div class="form-group"><label>Year Level <span class="required">*</span></label><select id="frmYear"><option value="1"' + (plan.yearLevel == 1 ? ' selected' : '') + '>1AC</option><option value="2"' + (plan.yearLevel == 2 ? ' selected' : '') + '>2AC</option><option value="3"' + (plan.yearLevel == 3 ? ' selected' : '') + '>3AC</option></select></div>' +
        '<div class="form-group"><label>Duration (min)</label><input type="number" id="frmDuration" value="' + (plan.duration || 55) + '" min="1"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Unit</label><input type="text" id="frmUnit" value="' + UI.escapeHTML(plan.unit || '') + '" placeholder="e.g. Unit 3 - Daily Life"></div>' +
        '<div class="form-group"><label>Lesson</label><input type="text" id="frmLesson" value="' + UI.escapeHTML(plan.lesson || '') + '" placeholder="e.g. Lesson 2"></div></div>' +
        '<div class="form-group"><label>Status</label><select id="frmStatus"><option value="draft"' + (plan.status === 'draft' || !plan.status ? ' selected' : '') + '>Draft</option><option value="ready"' + (plan.status === 'ready' ? ' selected' : '') + '>Ready</option><option value="used"' + (plan.status === 'used' ? ' selected' : '') + '>Used</option><option value="archived"' + (plan.status === 'archived' ? ' selected' : '') + '>Archived</option></select></div>' +
        '</div>' +
        '<div style="text-align:right;margin-bottom:8px"><button type="button" class="btn btn-sm" style="background:var(--teal,#0D9488);color:#fff;border-color:var(--teal,#0D9488)" onclick="MSM.PlansPage.aiSuggest()">🤖 AI Suggest</button></div>' +
        '<div class="form-group"><label>Objectives (one per line)</label><textarea id="frmObjectives" rows="3" placeholder="Students will be able to...\nStudents will practice...">' + UI.escapeHTML(objectives) + '</textarea></div>' +
        '<div class="form-group"><label>Warm-Up Activity</label><div class="form-row"><div style="flex:3"><input type="text" id="frmWarmup" value="' + UI.escapeHTML((plan.warmUp || {}).activity || '') + '" placeholder="e.g. Quick vocabulary review game"></div><div style="flex:1"><input type="number" id="frmWarmupTime" value="' + ((plan.warmUp || {}).duration || 5) + '" min="0" placeholder="min"></div></div></div>' +
        '<div class="form-group"><label>Activities</label><div id="activitiesList">' + actHtml + '</div><button type="button" class="btn btn-secondary btn-sm mt-1" id="btnAddActivity">+ Add Activity</button><div id="timeTotal" class="text-sm mt-1" style="color:var(--text-secondary)"></div></div>' +
        '<div class="form-group"><label>Assessment</label><textarea id="frmAssessment" rows="2" placeholder="e.g. Exit ticket, quick quiz...">' + UI.escapeHTML(plan.assessment || '') + '</textarea></div>' +
        '<div class="form-group"><label>Homework</label><textarea id="frmHomework" rows="2" placeholder="e.g. Workbook p.24 exercises 1-3">' + UI.escapeHTML(plan.homework || '') + '</textarea></div>' +
        '<div class="form-group"><label>Differentiation</label><textarea id="frmDiff" rows="2" placeholder="How will you support weaker/stronger students?">' + UI.escapeHTML(plan.differentiation || '') + '</textarea></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="frmNotes" rows="2">' + UI.escapeHTML(plan.notes || '') + '</textarea></div>';
    }

    function buildActivityRow(idx, act) {
      act = act || {};
      var typeOpts = M.ACTIVITY_TYPES.map(function (t) {
        return '<option value="' + t.value + '"' + (act.type === t.value ? ' selected' : '') + '>' + t.label + '</option>';
      }).join('');
      return '<div class="activity-item" data-idx="' + idx + '">' +
        '<span class="activity-item__num">' + (idx + 1) + '</span>' +
        '<div class="activity-item__info" style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:6px;width:100%">' +
        '<input type="text" class="act-title" value="' + UI.escapeHTML(act.title || '') + '" placeholder="Activity title" style="font-size:13px;padding:4px 8px">' +
        '<select class="act-type" style="font-size:13px;padding:4px">' + typeOpts + '</select>' +
        '<input type="number" class="act-duration" value="' + (act.duration || 10) + '" min="1" placeholder="min" style="font-size:13px;padding:4px 8px;width:60px">' +
        '<button type="button" class="btn btn-ghost btn-sm act-remove" style="color:var(--danger);padding:2px 6px">x</button>' +
        '</div></div>';
    }

    function getFormData() {
      var objectives = document.getElementById('frmObjectives').value.split('\n').map(function (o) { return o.trim(); }).filter(function (o) { return o; });
      var actRows = document.querySelectorAll('#activitiesList .activity-item');
      var activities = [];
      for (var i = 0; i < actRows.length; i++) {
        activities.push({
          title: actRows[i].querySelector('.act-title').value.trim(),
          type: actRows[i].querySelector('.act-type').value,
          duration: parseInt(actRows[i].querySelector('.act-duration').value) || 10,
          interaction: 'whole-class'
        });
      }
      return {
        title: document.getElementById('frmTitle').value.trim(),
        yearLevel: parseInt(document.getElementById('frmYear').value) || 1,
        duration: parseInt(document.getElementById('frmDuration').value) || 55,
        unit: document.getElementById('frmUnit').value.trim(),
        lesson: document.getElementById('frmLesson').value.trim(),
        status: document.getElementById('frmStatus').value,
        objectives: objectives,
        warmUp: { activity: document.getElementById('frmWarmup').value.trim(), duration: parseInt(document.getElementById('frmWarmupTime').value) || 5 },
        activities: activities,
        assessment: document.getElementById('frmAssessment').value.trim(),
        homework: document.getElementById('frmHomework').value.trim(),
        differentiation: document.getElementById('frmDiff').value.trim(),
        notes: document.getElementById('frmNotes').value.trim(),
        updatedAt: new Date().toISOString()
      };
    }

    function setupActivityHandlers() {
      document.getElementById('btnAddActivity').addEventListener('click', function () {
        var list = document.getElementById('activitiesList');
        var idx = list.children.length;
        list.insertAdjacentHTML('beforeend', buildActivityRow(idx, {}));
        attachRemoveHandlers();
        updateTimeTotal();
      });
      attachRemoveHandlers();

      // Live time total update
      document.getElementById('activitiesList').addEventListener('input', function (e) {
        if (e.target.classList.contains('act-duration')) updateTimeTotal();
      });
      var warmupTime = document.getElementById('frmWarmupTime');
      if (warmupTime) warmupTime.addEventListener('input', updateTimeTotal);
      updateTimeTotal();
    }

    function attachRemoveHandlers() {
      var btns = document.querySelectorAll('.act-remove');
      for (var i = 0; i < btns.length; i++) {
        btns[i].onclick = function () { this.closest('.activity-item').remove(); updateTimeTotal(); };
      }
    }

    function updateTimeTotal() {
      var total = parseInt(document.getElementById('frmWarmupTime').value) || 0;
      var durations = document.querySelectorAll('.act-duration');
      for (var i = 0; i < durations.length; i++) total += parseInt(durations[i].value) || 0;
      var max = parseInt(document.getElementById('frmDuration').value) || 55;
      var el = document.getElementById('timeTotal');
      if (el) {
        var over = total > max;
        el.innerHTML = '<span style="' + (over ? 'color:var(--danger);font-weight:600' : '') + '">' + total + '/' + max + ' min used</span>' + (over ? ' (over by ' + (total - max) + ' min)' : ' (' + (max - total) + ' min remaining)');
      }
    }

    // =====================================================================
    // Load & Render Plans
    // =====================================================================
    function loadPlans() {
      var plans = S.getData(KEYS.LESSON_PLANS) || [];
      if (filterYear) plans = plans.filter(function (p) { return p.yearLevel == filterYear; });
      if (filterStatus) plans = plans.filter(function (p) { return p.status === filterStatus; });
      if (filterSearch) { var q = filterSearch.toLowerCase(); plans = plans.filter(function (p) { return (p.title || '').toLowerCase().indexOf(q) >= 0 || (p.unit || '').toLowerCase().indexOf(q) >= 0; }); }
      plans.sort(function (a, b) { return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''); });

      var container = document.getElementById('plansContainer');
      if (plans.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📝</div><h3 class="empty-state__title">No lesson plans yet</h3><p class="empty-state__text">Create your first lesson plan, import from JSON, or start from a template.</p></div>';
        return;
      }

      var html = '<div class="plans-grid">';
      for (var i = 0; i < plans.length; i++) {
        var p = plans[i];
        var yearLabels = ['', '1AC', '2AC', '3AC'];
        var totalTime = (p.warmUp ? p.warmUp.duration || 0 : 0);
        var acts = p.activities || [];
        for (var j = 0; j < acts.length; j++) totalTime += acts[j].duration || 0;

        var timeBar = '';
        if (acts.length > 0 && p.duration) {
          timeBar = '<div class="time-bar">';
          for (var k = 0; k < acts.length; k++) {
            var pct = ((acts[k].duration || 0) / p.duration * 100).toFixed(1);
            timeBar += '<div class="time-bar__segment" style="width:' + pct + '%;background:' + activityColors[k % activityColors.length] + '"></div>';
          }
          timeBar += '</div>';
        }

        var statusLabel = { draft: 'Draft', ready: 'Ready', used: 'Used', archived: 'Archived' };
        var timeOver = totalTime > (p.duration || 55) ? ' style="color:var(--danger);font-weight:600"' : '';

        html += '<div class="plan-card plan-card--' + (p.status || 'draft') + '">' +
          '<div class="plan-card__top"><span class="badge badge-' + (statusColors[p.status] || 'neutral') + '">' + (statusLabel[p.status] || 'Draft') + '</span><span class="text-xs" style="color:var(--text-secondary)">' + UI.formatDate(p.updatedAt || p.createdAt) + '</span></div>' +
          '<div class="plan-card__title">' + UI.escapeHTML(p.title) + '</div>' +
          '<div class="plan-card__meta">' + yearLabels[p.yearLevel || 1] + (p.unit ? ' &bull; ' + UI.escapeHTML(p.unit) : '') + (p.lesson ? ' &bull; ' + UI.escapeHTML(p.lesson) : '') + ' &bull; ' + (p.duration || 55) + ' min</div>' +
          '<div class="plan-card__stats"><span>📋 ' + (p.objectives || []).length + ' obj</span><span>📊 ' + acts.length + ' act</span><span' + timeOver + '>⏱ ' + totalTime + '/' + (p.duration || 55) + '</span></div>' +
          timeBar +
          '<div class="plan-card__actions">' +
          '<button class="btn btn-ghost btn-sm" onclick="MSM.PlansPage.view(\'' + p.id + '\')">View</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="MSM.PlansPage.edit(\'' + p.id + '\')">Edit</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="MSM.PlansPage.dup(\'' + p.id + '\')">Copy</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="MSM.PlansPage.saveAsTemplate(\'' + p.id + '\')">Tpl</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--teal,#0D9488)" onclick="MSM.PlansPage.generateLogbook(\'' + p.id + '\')">AI Log</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="MSM.PlansPage.del(\'' + p.id + '\')">Del</button></div></div>';
      }
      html += '</div>';
      container.innerHTML = html;
    }

    loadPlans();

    // Handle ?action=new from command palette
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      setTimeout(function () { document.getElementById('btnNewPlan').click(); }, 300);
    }

    // =====================================================================
    // Filters
    // =====================================================================
    document.getElementById('filterPlanYear').addEventListener('change', function () { filterYear = this.value; loadPlans(); });
    document.getElementById('filterPlanStatus').addEventListener('change', function () { filterStatus = this.value; loadPlans(); });
    document.getElementById('filterPlanSearch').addEventListener('input', UI.debounce(function () { filterSearch = document.getElementById('filterPlanSearch').value; loadPlans(); }, 300));

    // =====================================================================
    // New Plan
    // =====================================================================
    document.getElementById('btnNewPlan').addEventListener('click', function () {
      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSavePlan">Save Plan</button>';
      UI.showModal('New Lesson Plan', getFormHTML(), { footerHTML: footerHTML, width: '700px' });
      setupActivityHandlers();
      document.getElementById('btnSavePlan').addEventListener('click', function () {
        var data = getFormData();
        if (!data.title) { UI.showToast('Title is required', 'error'); return; }
        S.addItem(KEYS.LESSON_PLANS, M.createLessonPlan(data));
        UI.closeModal(); UI.showToast('Lesson plan created!', 'success'); loadPlans();
      });
    });

    // =====================================================================
    // Template: From Template button
    // =====================================================================
    var btnFromTemplate = document.getElementById('btnFromTemplate');
    if (btnFromTemplate) {
      btnFromTemplate.addEventListener('click', function () {
        var templates = getTemplates();
        if (templates.length === 0) {
          UI.showToast('No templates saved yet. Create a plan and click "Template" to save one.', 'warning');
          return;
        }
        var html = '<div style="display:grid;gap:12px">';
        for (var i = 0; i < templates.length; i++) {
          var t = templates[i];
          var yearLabels = ['', '1AC', '2AC', '3AC'];
          html += '<div class="plan-card" style="cursor:pointer" data-tidx="' + i + '" onclick="MSM.PlansPage.useTemplate(' + i + ')">' +
            '<div class="plan-card__title">' + UI.escapeHTML(t.title) + '</div>' +
            '<div class="plan-card__meta">' + yearLabels[t.yearLevel || 1] + ' &bull; ' + (t.duration || 55) + ' min &bull; ' + (t.activities || []).length + ' activities</div>' +
            '<div style="display:flex;gap:6px;margin-top:8px"><button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="event.stopPropagation();MSM.PlansPage.deleteTemplate(' + i + ')">Delete</button></div>' +
            '</div>';
        }
        html += '</div>';
        UI.showModal('Choose a Template', html, { width: '550px' });
      });
    }

    // =====================================================================
    // Import Plans (JSON file)
    // =====================================================================
    var btnImport = document.getElementById('btnImportPlans');
    if (btnImport) {
      btnImport.addEventListener('click', function () {
        var html = '<div style="text-align:center;padding:20px">' +
          '<p style="margin-bottom:16px;color:var(--text-secondary)">Import lesson plans from a JSON file. This will add plans to your existing collection.</p>' +
          '<input type="file" id="importPlanFile" accept=".json" style="display:none">' +
          '<label for="importPlanFile" class="btn btn-primary" style="cursor:pointer">Choose JSON File</label>' +
          '<div id="importPreview" style="margin-top:16px;text-align:left"></div></div>';
        UI.showModal('Import Lesson Plans', html, { width: '500px' });

        document.getElementById('importPlanFile').addEventListener('change', function (e) {
          var file = e.target.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function (ev) {
            try {
              var data = JSON.parse(ev.target.result);
              var plans = Array.isArray(data) ? data : (data.plans || data.lessonPlans || [data]);
              var preview = document.getElementById('importPreview');
              preview.innerHTML = '<div class="card" style="padding:16px"><p style="font-weight:600;margin-bottom:8px">' + plans.length + ' plan(s) found</p>';
              for (var p = 0; p < Math.min(plans.length, 5); p++) {
                preview.innerHTML += '<div style="padding:4px 0;font-size:13px;border-bottom:1px solid var(--border-light)">' + UI.escapeHTML(plans[p].title || 'Untitled') + '</div>';
              }
              if (plans.length > 5) preview.innerHTML += '<div style="padding:4px 0;font-size:12px;color:var(--text-secondary)">...and ' + (plans.length - 5) + ' more</div>';
              preview.innerHTML += '<button class="btn btn-primary btn-sm" id="btnConfirmImport" style="margin-top:12px">Import All</button></div>';
              document.getElementById('btnConfirmImport').addEventListener('click', function () {
                var imported = 0;
                for (var j = 0; j < plans.length; j++) {
                  var p = plans[j];
                  delete p.id; // Force new IDs
                  p.status = p.status || 'draft';
                  S.addItem(KEYS.LESSON_PLANS, M.createLessonPlan(p));
                  imported++;
                }
                UI.closeModal();
                UI.showToast(imported + ' plan(s) imported!', 'success');
                loadPlans();
              });
            } catch (err) {
              UI.showToast('Invalid JSON file: ' + err.message, 'error');
            }
          };
          reader.readAsText(file);
        });
      });
    }

    // =====================================================================
    // Export Plans (JSON file)
    // =====================================================================
    var btnExport = document.getElementById('btnExportPlans');
    if (btnExport) {
      btnExport.addEventListener('click', function () {
        var plans = S.getData(KEYS.LESSON_PLANS) || [];
        if (plans.length === 0) { UI.showToast('No plans to export', 'warning'); return; }
        var json = JSON.stringify({ appName: 'MidSchool Manager', type: 'lesson_plans', exportDate: new Date().toISOString(), plans: plans }, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'lesson-plans-' + M.getToday() + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        UI.showToast(plans.length + ' plan(s) exported!', 'success');
      });
    }

    // =====================================================================
    // Public API
    // =====================================================================
    window.MSM.PlansPage = {
      view: function (id) {
        var p = S.getById(KEYS.LESSON_PLANS, id);
        if (!p) return;
        var yearLabels = ['', '1AC', '2AC', '3AC'];
        var statusLabel = { draft: 'Draft', ready: 'Ready', used: 'Used', archived: 'Archived' };
        var html = '<div style="display:flex;gap:8px;align-items:center;margin-bottom:20px;flex-wrap:wrap"><span class="badge badge-' + (statusColors[p.status] || 'neutral') + '">' + (statusLabel[p.status] || p.status) + '</span><span class="badge">' + yearLabels[p.yearLevel || 1] + '</span>' + (p.unit ? '<span class="badge">' + UI.escapeHTML(p.unit) + '</span>' : '') + '<span class="badge">⏱ ' + (p.duration || 55) + ' min</span></div>';
        if (p.objectives && p.objectives.length) {
          html += '<div class="plan-view-section"><h4>Objectives</h4><ul>';
          p.objectives.forEach(function (o) { html += '<li>' + UI.escapeHTML(o) + '</li>'; });
          html += '</ul></div>';
        }
        if (p.warmUp && p.warmUp.activity) html += '<div class="plan-view-section"><h4>Warm-Up (' + (p.warmUp.duration || 5) + ' min)</h4><p>' + UI.escapeHTML(p.warmUp.activity) + '</p></div>';
        if (p.activities && p.activities.length) {
          html += '<div class="plan-view-section"><h4>Activities</h4>';
          p.activities.forEach(function (a, i) { html += '<div class="activity-item"><span class="activity-item__num">' + (i + 1) + '</span><div class="activity-item__info"><strong>' + UI.escapeHTML(a.title) + '</strong> <span class="activity-item__time">' + (a.duration || 0) + ' min &bull; ' + UI.escapeHTML(a.type || '') + '</span></div></div>'; });
          html += '</div>';
        }
        if (p.assessment) html += '<div class="plan-view-section"><h4>Assessment</h4><p>' + UI.escapeHTML(p.assessment) + '</p></div>';
        if (p.homework) html += '<div class="plan-view-section"><h4>Homework</h4><p>' + UI.escapeHTML(p.homework) + '</p></div>';
        if (p.differentiation) html += '<div class="plan-view-section"><h4>Differentiation</h4><p>' + UI.escapeHTML(p.differentiation) + '</p></div>';
        if (p.notes) html += '<div class="plan-view-section"><h4>Notes</h4><p>' + UI.escapeHTML(p.notes) + '</p></div>';

        if (MSM.Sidepanel) {
          MSM.Sidepanel.open({
            title: UI.escapeHTML(p.title),
            content: html,
            actions: [
              { label: 'Edit', className: 'btn-primary', onClick: function () { MSM.Sidepanel.close(); MSM.PlansPage.edit(id); } },
              { label: 'Export', className: 'btn-secondary', onClick: function () { MSM.PlansPage.exportSingle(id); } },
              { label: 'AI Logbook', className: 'btn-secondary', onClick: function () { MSM.Sidepanel.close(); MSM.PlansPage.generateLogbook(id); } }
            ]
          });
        } else {
          var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Close</button>' +
            '<button class="btn btn-secondary" onclick="MSM.PlansPage.exportSingle(\'' + p.id + '\')">Export</button>' +
            '<button class="btn btn-secondary" style="background:var(--teal,#0D9488);color:#fff;border-color:var(--teal,#0D9488)" onclick="MSM.UI.closeModal();MSM.PlansPage.generateLogbook(\'' + p.id + '\')">Generate Logbook</button>' +
            '<button class="btn btn-primary" onclick="MSM.UI.closeModal();MSM.PlansPage.edit(\'' + p.id + '\')">Edit</button>';
          UI.showModal(UI.escapeHTML(p.title), html, { width: '650px', footerHTML: footerHTML });
        }
      },

      edit: function (id) {
        var plan = S.getById(KEYS.LESSON_PLANS, id);
        if (!plan) return;
        var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnUpdatePlan">Update</button>';
        UI.showModal('Edit Lesson Plan', getFormHTML(plan), { footerHTML: footerHTML, width: '700px' });
        setupActivityHandlers();
        document.getElementById('btnUpdatePlan').addEventListener('click', function () {
          var data = getFormData();
          if (!data.title) { UI.showToast('Title is required', 'error'); return; }
          S.updateItem(KEYS.LESSON_PLANS, id, data);
          UI.closeModal(); UI.showToast('Plan updated!', 'success'); loadPlans();
        });
      },

      dup: function (id) {
        var plan = S.getById(KEYS.LESSON_PLANS, id);
        if (!plan) return;
        var copy = JSON.parse(JSON.stringify(plan));
        delete copy.id;
        copy.title = plan.title + ' (Copy)';
        copy.status = 'draft';
        S.addItem(KEYS.LESSON_PLANS, M.createLessonPlan(copy));
        UI.showToast('Plan duplicated!', 'success');
        loadPlans();
      },

      del: function (id) {
        UI.showConfirm('Delete this lesson plan?', function () { S.deleteItem(KEYS.LESSON_PLANS, id); UI.showToast('Deleted', 'success'); loadPlans(); });
      },

      saveAsTemplate: function (id) {
        var plan = S.getById(KEYS.LESSON_PLANS, id);
        if (!plan) return;
        var template = JSON.parse(JSON.stringify(plan));
        delete template.id;
        delete template.createdAt;
        delete template.updatedAt;
        template.status = 'draft';
        var templates = getTemplates();
        templates.push(template);
        saveTemplates(templates);
        UI.showToast('Saved as template! Use "From Template" to reuse it.', 'success');
      },

      useTemplate: function (idx) {
        var templates = getTemplates();
        if (!templates[idx]) return;
        var t = JSON.parse(JSON.stringify(templates[idx]));
        UI.closeModal();
        var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSavePlan">Save Plan</button>';
        UI.showModal('New Plan from Template', getFormHTML(t), { footerHTML: footerHTML, width: '700px' });
        setupActivityHandlers();
        document.getElementById('btnSavePlan').addEventListener('click', function () {
          var data = getFormData();
          if (!data.title) { UI.showToast('Title is required', 'error'); return; }
          S.addItem(KEYS.LESSON_PLANS, M.createLessonPlan(data));
          UI.closeModal(); UI.showToast('Plan created from template!', 'success'); loadPlans();
        });
      },

      deleteTemplate: function (idx) {
        var templates = getTemplates();
        templates.splice(idx, 1);
        saveTemplates(templates);
        UI.closeModal();
        UI.showToast('Template deleted', 'success');
      },

      exportSingle: function (id) {
        var plan = S.getById(KEYS.LESSON_PLANS, id);
        if (!plan) return;
        var json = JSON.stringify(plan, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (plan.title || 'plan').replace(/[^a-zA-Z0-9]/g, '-') + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      },

      // =================================================================
      // AI: Generate Logbook Entries from Plan
      // =================================================================
      generateLogbook: function (id) {
        var plan = S.getById(KEYS.LESSON_PLANS, id);
        if (!plan) return;

        // Check API key
        var config = MSM.AI.getConfig();
        if (!config.apiKey) {
          UI.showToast('No API key configured. Go to Settings → AI Integration to add your Gemini API key.', 'warning');
          return;
        }

        // Get classes for this year level
        var allClasses = S.getData(KEYS.CLASSES) || [];
        var yearClasses = allClasses.filter(function (c) { return c.year === plan.yearLevel; });

        if (yearClasses.length === 0) {
          UI.showToast('No classes found for year level ' + plan.yearLevel, 'warning');
          return;
        }

        // Show loading modal
        var loadingHtml = '<div style="text-align:center;padding:40px 20px">' +
          '<div style="font-size:48px;margin-bottom:16px;animation:pulse 1.5s ease-in-out infinite">🤖</div>' +
          '<h3 style="margin-bottom:8px">Generating Logbook Entries...</h3>' +
          '<p style="color:var(--text-secondary);font-size:13px">AI is analyzing your lesson plan for ' + yearClasses.length + ' classes</p>' +
          '<div style="margin-top:16px;height:4px;background:var(--bg-secondary);border-radius:2px;overflow:hidden"><div style="height:100%;background:var(--primary);width:0%;animation:loading 2s ease-in-out infinite;border-radius:2px"></div></div>' +
          '<style>@keyframes loading{0%{width:0%}50%{width:80%}100%{width:100%}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}</style></div>';
        UI.showModal('Generating Logbook', loadingHtml, { width: '450px' });

        MSM.AI.extractLogbook(plan, yearClasses)
          .then(function (entries) {
            UI.closeModal();
            showLogbookReview(plan, entries, yearClasses);
          })
          .catch(function (err) {
            UI.closeModal();
            UI.showToast('AI error: ' + err.message, 'error');
          });
      },

      // =================================================================
      // AI: Suggest Plan Content
      // =================================================================
      aiSuggest: function () {
        var title = document.getElementById('frmTitle').value.trim();
        var unit = document.getElementById('frmUnit').value.trim();
        var yearLevel = parseInt(document.getElementById('frmYear').value) || 1;

        if (!title && !unit) {
          UI.showToast('Enter at least a title or unit first so AI can suggest content', 'warning');
          return;
        }

        var config = MSM.AI.getConfig();
        if (!config.apiKey) {
          UI.showToast('No API key configured. Go to Settings → AI Integration.', 'warning');
          return;
        }

        UI.showToast('AI is thinking...', 'info');

        var existingPlans = S.getData(KEYS.LESSON_PLANS) || [];
        var sameLevelPlans = existingPlans.filter(function (p) { return p.yearLevel === yearLevel; }).slice(0, 3);

        MSM.AI.suggestPlanContent({ title: title, unit: unit, yearLevel: yearLevel }, sameLevelPlans)
          .then(function (suggestions) {
            // Fill in empty fields with suggestions
            if (suggestions.objectives && suggestions.objectives.length > 0) {
              var objField = document.getElementById('frmObjectives');
              if (objField && !objField.value.trim()) {
                objField.value = suggestions.objectives.join('\n');
              }
            }
            if (suggestions.warmUp) {
              var warmField = document.getElementById('frmWarmup');
              if (warmField && !warmField.value.trim()) warmField.value = suggestions.warmUp;
            }
            if (suggestions.assessment) {
              var assField = document.getElementById('frmAssessment');
              if (assField && !assField.value.trim()) assField.value = suggestions.assessment;
            }
            if (suggestions.homework) {
              var hwField = document.getElementById('frmHomework');
              if (hwField && !hwField.value.trim()) hwField.value = suggestions.homework;
            }
            if (suggestions.activities && suggestions.activities.length > 0) {
              var list = document.getElementById('activitiesList');
              if (list && list.children.length === 0) {
                suggestions.activities.forEach(function (a, i) {
                  list.insertAdjacentHTML('beforeend', buildActivityRow(i, a));
                });
                attachRemoveHandlers();
                updateTimeTotal();
              }
            }
            UI.showToast('AI suggestions applied! Review and adjust as needed.', 'success');
          })
          .catch(function (err) {
            UI.showToast('AI error: ' + err.message, 'error');
          });
      }
    };

    // =====================================================================
    // Logbook Review Modal
    // =====================================================================
    function showLogbookReview(plan, entries, yearClasses) {
      var yearLabels = ['', '1AC', '2AC', '3AC'];

      // Build focus options for dropdowns
      var focusOptions = '<option value="">—</option>' +
        M.LESSON_FOCUS_TYPES.map(function (f) { return '<option value="' + f.value + '">' + f.label + '</option>'; }).join('');

      var html = '<div style="margin-bottom:12px">' +
        '<p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">Review and adjust these logbook entries before saving them as lesson records. Each entry becomes one row in your official logbook.</p>' +
        '<div class="form-row"><div class="form-group"><label>Date</label><input type="date" id="logbookDate" value="' + M.getToday() + '"></div><div class="form-group"><label>Period</label><select id="logbookPeriod"><option value="">Select</option><option value="1">P1</option><option value="2">P2</option><option value="3">P3</option><option value="4">P4</option><option value="5">P5</option><option value="6">P6</option><option value="7">P7</option></select></div></div></div>';

      html += '<div id="logbookEntries" style="max-height:500px;overflow-y:auto">';
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        // Try to find matching class
        var matchedClass = yearClasses.find(function (c) { return c.name === e.className; });
        var classId = matchedClass ? matchedClass.id : (yearClasses[i] ? yearClasses[i].id : '');
        var className = matchedClass ? matchedClass.name : (e.className || yearClasses[i] ? yearClasses[i].name : 'Unknown');

        // Build per-entry focus dropdown with AI-suggested value pre-selected
        var entryFocusOpts = '<option value="">—</option>' +
          M.LESSON_FOCUS_TYPES.map(function (f) {
            return '<option value="' + f.value + '"' + (f.value === (e.lessonFocus || '') ? ' selected' : '') + '>' + f.label + '</option>';
          }).join('');

        // Build per-entry stages as small tag checkboxes
        var entryStages = (e.lessonStages && Array.isArray(e.lessonStages)) ? e.lessonStages : [];
        var stagesHtml = '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">';
        M.LESSON_STAGES.forEach(function (s) {
          var checked = entryStages.indexOf(s.value) >= 0 ? ' checked' : '';
          stagesHtml += '<label style="font-size:11px;display:inline-flex;align-items:center;gap:2px;padding:2px 6px;background:var(--bg-secondary);border-radius:12px;cursor:pointer">' +
            '<input type="checkbox" class="logbook-stage" data-idx="' + i + '" value="' + s.value + '"' + checked + ' style="width:12px;height:12px">' + s.label + '</label>';
        });
        stagesHtml += '</div>';

        html += '<div class="card" style="padding:14px;margin-bottom:10px;border-left:4px solid ' + (matchedClass ? matchedClass.color : 'var(--primary)') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
          '<label style="margin:0"><input type="checkbox" class="logbook-include" data-idx="' + i + '" checked style="margin-right:6px"> <strong style="color:' + (matchedClass ? matchedClass.color : 'var(--primary)') + '">' + UI.escapeHTML(className) + '</strong></label>' +
          '<select class="logbook-status" data-idx="' + i + '" style="font-size:12px;padding:4px 8px;border-radius:6px"><option value="completed" selected>Completed</option><option value="partial">Partial</option><option value="not_started">Not Started</option><option value="skipped">Skipped</option></select></div>' +
          '<input type="hidden" class="logbook-classId" data-idx="' + i + '" value="' + classId + '">' +
          '<div class="form-row" style="margin-bottom:8px"><div class="form-group" style="margin-bottom:0"><label style="font-size:11px">Topic</label><input type="text" class="logbook-topic" data-idx="' + i + '" value="' + UI.escapeHTML(e.topic || plan.title || '') + '" style="font-size:13px;padding:6px 8px"></div>' +
          '<div class="form-group" style="margin-bottom:0"><label style="font-size:11px">Focus / Skill</label><select class="logbook-focus" data-idx="' + i + '" style="font-size:13px;padding:6px 8px">' + entryFocusOpts + '</select></div></div>' +
          '<div class="form-group" style="margin-bottom:8px"><label style="font-size:11px">Lesson Stages</label>' + stagesHtml + '</div>' +
          '<div class="form-group" style="margin-bottom:8px"><label style="font-size:11px">Student Activities <span style="font-weight:400;color:var(--text-tertiary)">(Bloom\'s verbs)</span></label><textarea class="logbook-studentActivities" data-idx="' + i + '" rows="1" style="font-size:12px;padding:6px 8px" placeholder="e.g. Ss identify, Ss match, Ss produce...">' + UI.escapeHTML(e.studentActivities || '') + '</textarea></div>' +
          '<div class="form-group" style="margin-bottom:8px"><label style="font-size:11px">Activities</label><textarea class="logbook-activities" data-idx="' + i + '" rows="2" style="font-size:13px;padding:6px 8px">' + UI.escapeHTML(e.activities || '') + '</textarea></div>' +
          '<div class="form-row" style="margin-bottom:0"><div class="form-group" style="margin-bottom:0"><label style="font-size:11px">Homework</label><input type="text" class="logbook-homework" data-idx="' + i + '" value="' + UI.escapeHTML(e.homework || plan.homework || '') + '" style="font-size:13px;padding:6px 8px"></div>' +
          '<div class="form-group" style="margin-bottom:0"><label style="font-size:11px">Notes</label><input type="text" class="logbook-notes" data-idx="' + i + '" value="' + UI.escapeHTML(e.notes || '') + '" style="font-size:13px;padding:6px 8px"></div></div></div>';
      }
      html += '</div>';

      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" id="btnSaveLogbook">Save ' + entries.length + ' Logbook Entries</button>';

      UI.showModal('Review Logbook Entries — ' + UI.escapeHTML(plan.title), html, { footerHTML: footerHTML, width: '750px' });

      document.getElementById('btnSaveLogbook').addEventListener('click', function () {
        var date = document.getElementById('logbookDate').value;
        var period = parseInt(document.getElementById('logbookPeriod').value) || null;
        var saved = 0;

        for (var j = 0; j < entries.length; j++) {
          var include = document.querySelector('.logbook-include[data-idx="' + j + '"]');
          if (!include || !include.checked) continue;

          var classIdVal = document.querySelector('.logbook-classId[data-idx="' + j + '"]').value;
          if (!classIdVal) continue;

          // Collect checked stages for this entry
          var stageEls = document.querySelectorAll('.logbook-stage[data-idx="' + j + '"]:checked');
          var stages = [];
          for (var k = 0; k < stageEls.length; k++) { stages.push(stageEls[k].value); }

          var record = M.createLessonRecord({
            classId: classIdVal,
            date: date,
            period: period,
            unit: plan.unit || '',
            topic: document.querySelector('.logbook-topic[data-idx="' + j + '"]').value.trim(),
            textbookPage: '',
            lessonFocus: document.querySelector('.logbook-focus[data-idx="' + j + '"]').value,
            lessonStages: stages,
            studentActivities: document.querySelector('.logbook-studentActivities[data-idx="' + j + '"]').value.trim(),
            activities: document.querySelector('.logbook-activities[data-idx="' + j + '"]').value.trim(),
            homework: document.querySelector('.logbook-homework[data-idx="' + j + '"]').value.trim(),
            completionStatus: document.querySelector('.logbook-status[data-idx="' + j + '"]').value,
            notes: document.querySelector('.logbook-notes[data-idx="' + j + '"]').value.trim()
          });

          S.addItem(KEYS.LESSON_RECORDS, record);
          saved++;
        }

        // Mark plan as used
        S.updateItem(KEYS.LESSON_PLANS, plan.id, { status: 'used', updatedAt: new Date().toISOString() });

        UI.closeModal();
        UI.showToast(saved + ' logbook entries saved! Plan marked as "Used".', 'success');
        loadPlans();
      });
    }

    // =====================================================================
    // Keyboard Shortcuts
    // =====================================================================
    document.addEventListener('keydown', function (e) {
      // Ctrl+N or Cmd+N = New Plan
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('btnNewPlan').click();
      }
      // Ctrl+F = Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
        var search = document.getElementById('filterPlanSearch');
        if (search && document.activeElement !== search) {
          e.preventDefault();
          search.focus();
        }
      }
    });
  });
})();
