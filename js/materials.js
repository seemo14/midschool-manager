/**
 * MidSchool Manager - Materials Tracker Page Logic
 * Enhanced with AI Suggest for descriptions and tags
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage, UI = MSM.UI, M = MSM.Models, KEYS = S.STORAGE_KEYS;
    var filterYear = '', filterType = '', filterAvail = '', filterSearch = '';
    var typeIcons = { textbook: '📕', worksheet: '📄', digital: '💻', audio: '🎧', video: '🎬', flashcards: '🃏', other: '📦' };

    function getFormHTML(mat) {
      mat = mat || {};
      var typeOpts = M.MATERIAL_TYPES.map(function (t) {
        return '<option value="' + t.value + '"' + (t.value === mat.type ? ' selected' : '') + '>' + t.label + '</option>';
      }).join('');

      // Check if AI is configured
      var aiConfig = (MSM.AI && MSM.AI.getConfig) ? MSM.AI.getConfig() : {};
      var hasAI = !!aiConfig.apiKey;

      return '<div class="form-group"><label>Title <span class="required">*</span></label><input type="text" id="frmTitle" value="' + UI.escapeHTML(mat.title || '') + '" placeholder="e.g. Unit 3 Vocabulary Worksheet"></div>' +
        '<div class="form-row"><div class="form-group"><label>Type <span class="required">*</span></label><select id="frmType">' + typeOpts + '</select></div>' +
        '<div class="form-group"><label>Year Level</label><select id="frmYear"><option value="0">All Levels</option><option value="1"' + (mat.yearLevel == 1 ? ' selected' : '') + '>1AC</option><option value="2"' + (mat.yearLevel == 2 ? ' selected' : '') + '>2AC</option><option value="3"' + (mat.yearLevel == 3 ? ' selected' : '') + '>3AC</option></select></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Unit</label><input type="text" id="frmUnit" value="' + UI.escapeHTML(mat.unit || '') + '" placeholder="e.g. Unit 3"></div>' +
        '<div class="form-group"><label>Lesson</label><input type="text" id="frmLesson" value="' + UI.escapeHTML(mat.lesson || '') + '" placeholder="e.g. Lesson 2"></div></div>' +
        '<div class="form-group">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
            '<label style="margin-bottom:0">Description</label>' +
            (hasAI ? '<button type="button" class="btn btn-ghost btn-sm" id="btnAiSuggestMat" style="font-size:12px;color:var(--primary)">✨ AI Suggest</button>' : '') +
          '</div>' +
          '<textarea id="frmDesc" rows="2">' + UI.escapeHTML(mat.description || '') + '</textarea>' +
        '</div>' +
        '<div class="form-row"><div class="form-group"><label>Source</label><input type="text" id="frmSource" value="' + UI.escapeHTML(mat.source || '') + '" placeholder="e.g. Teacher-made, Textbook"></div>' +
        '<div class="form-group"><label>File/URL Reference</label><input type="text" id="frmRef" value="' + UI.escapeHTML(mat.fileReference || '') + '"></div></div>' +
        '<div class="form-group"><label>Tags (comma separated)</label><input type="text" id="frmTags" value="' + UI.escapeHTML((mat.tags || []).join(', ')) + '" placeholder="e.g. vocabulary, grammar"></div>' +
        '<div class="form-group"><label><input type="checkbox" id="frmAvail"' + (mat.isAvailable !== false ? ' checked' : '') + '> Available / Ready to use</label></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="frmNotes" rows="2">' + UI.escapeHTML(mat.notes || '') + '</textarea></div>';
    }

    function getFormData() {
      var tags = document.getElementById('frmTags').value.split(',').map(function (t) { return t.trim(); }).filter(function (t) { return t; });
      return {
        title: document.getElementById('frmTitle').value.trim(),
        type: document.getElementById('frmType').value,
        yearLevel: parseInt(document.getElementById('frmYear').value) || 0,
        unit: document.getElementById('frmUnit').value.trim(),
        lesson: document.getElementById('frmLesson').value.trim(),
        description: document.getElementById('frmDesc').value.trim(),
        source: document.getElementById('frmSource').value.trim(),
        fileReference: document.getElementById('frmRef').value.trim(),
        tags: tags,
        isAvailable: document.getElementById('frmAvail').checked,
        notes: document.getElementById('frmNotes').value.trim()
      };
    }

    /**
     * Set up the AI Suggest button handler inside the material form modal
     */
    function setupMaterialAiHandler() {
      var aiBtn = document.getElementById('btnAiSuggestMat');
      if (!aiBtn) return;

      aiBtn.addEventListener('click', function () {
        var title = document.getElementById('frmTitle').value.trim();
        var type = document.getElementById('frmType').value;
        var yearLevel = parseInt(document.getElementById('frmYear').value) || 0;
        var unit = document.getElementById('frmUnit').value.trim();
        var lesson = document.getElementById('frmLesson').value.trim();

        if (!title) {
          UI.showToast('Please enter a title before using AI Suggest', 'warning');
          return;
        }

        aiBtn.disabled = true;
        aiBtn.textContent = '⏳ Generating...';

        MSM.AI.suggestMaterialContent({
          title: title, type: type, yearLevel: yearLevel, unit: unit, lesson: lesson
        })
        .then(function (suggestions) {
          // Fill description
          if (suggestions.description) {
            var descEl = document.getElementById('frmDesc');
            if (descEl && !descEl.value.trim()) descEl.value = suggestions.description;
          }
          // Fill tags
          if (suggestions.tags && Array.isArray(suggestions.tags)) {
            var tagsEl = document.getElementById('frmTags');
            if (tagsEl && !tagsEl.value.trim()) tagsEl.value = suggestions.tags.join(', ');
          }
          // Fill notes
          if (suggestions.notes) {
            var notesEl = document.getElementById('frmNotes');
            if (notesEl && !notesEl.value.trim()) notesEl.value = suggestions.notes;
          }
          // Fill lesson if empty
          if (suggestions.lesson) {
            var lessonEl = document.getElementById('frmLesson');
            if (lessonEl && !lessonEl.value.trim()) lessonEl.value = suggestions.lesson;
          }
          UI.showToast('AI suggestions applied! Review and adjust as needed.', 'success');
        })
        .catch(function (err) {
          UI.showToast('AI error: ' + err.message, 'error');
        })
        .then(function () {
          aiBtn.disabled = false;
          aiBtn.textContent = '✨ AI Suggest';
        });
      });
    }

    function loadMaterials() {
      var materials = S.getData(KEYS.MATERIALS) || [];
      if (filterYear) materials = materials.filter(function (m) { return m.yearLevel == filterYear || m.yearLevel == 0; });
      if (filterType) materials = materials.filter(function (m) { return m.type === filterType; });
      if (filterAvail) materials = materials.filter(function (m) { return String(m.isAvailable) === filterAvail; });
      if (filterSearch) {
        var q = filterSearch.toLowerCase();
        materials = materials.filter(function (m) { return (m.title || '').toLowerCase().indexOf(q) >= 0 || (m.description || '').toLowerCase().indexOf(q) >= 0; });
      }

      var container = document.getElementById('materialsContainer');
      if (materials.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📦</div><h3 class="empty-state__title">No materials yet</h3><p class="empty-state__text">Add your teaching materials to track what you have available.</p></div>';
        return;
      }

      var html = '<div class="materials-grid">';
      for (var i = 0; i < materials.length; i++) {
        var m = materials[i];
        var icon = typeIcons[m.type] || '📦';
        var yearLabel = m.yearLevel > 0 ? ['', '1AC', '2AC', '3AC'][m.yearLevel] : 'All';
        var tags = '';
        if (m.tags && m.tags.length) {
          tags = '<div class="material-card__tags">' + m.tags.map(function (t) { return '<span class="material-card__tag">' + UI.escapeHTML(t) + '</span>'; }).join('') + '</div>';
        }
        html += '<div class="material-card">' +
          '<div class="material-card__header"><span class="material-card__type">' + icon + '</span>' +
          '<span class="badge ' + (m.isAvailable ? 'badge-success' : 'badge-danger') + '">' + (m.isAvailable ? 'Available' : 'Missing') + '</span></div>' +
          '<div class="material-card__title">' + UI.escapeHTML(m.title) + '</div>' +
          '<div class="material-card__meta">' + UI.escapeHTML(yearLabel) + (m.unit ? ' • ' + UI.escapeHTML(m.unit) : '') + (m.lesson ? ' • ' + UI.escapeHTML(m.lesson) : '') + '</div>' +
          (m.description ? '<p class="text-sm" style="margin:0;color:var(--text-secondary)">' + UI.escapeHTML(m.description) + '</p>' : '') +
          tags +
          '<div class="material-card__actions">' +
          '<button class="btn btn-ghost btn-sm" onclick="MSM.MaterialsPage.view(\'' + m.id + '\')">View</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="MSM.MaterialsPage.edit(\'' + m.id + '\')">Edit</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="MSM.MaterialsPage.toggle(\'' + m.id + '\')">' + (m.isAvailable ? 'Mark Missing' : 'Mark Available') + '</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="MSM.MaterialsPage.del(\'' + m.id + '\')">Delete</button></div></div>';
      }
      html += '</div>';
      container.innerHTML = html;
    }

    loadMaterials();

    document.getElementById('filterYear').addEventListener('change', function () { filterYear = this.value; loadMaterials(); });
    document.getElementById('filterType').addEventListener('change', function () { filterType = this.value; loadMaterials(); });
    document.getElementById('filterAvail').addEventListener('change', function () { filterAvail = this.value; loadMaterials(); });
    document.getElementById('filterMatSearch').addEventListener('input', UI.debounce(function () { filterSearch = document.getElementById('filterMatSearch').value; loadMaterials(); }, 300));

    document.getElementById('btnAddMaterial').addEventListener('click', function () {
      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSaveMat">Save</button>';
      UI.showModal('Add Material', getFormHTML(), { footerHTML: footerHTML, width: '600px' });
      setupMaterialAiHandler();
      document.getElementById('btnSaveMat').addEventListener('click', function () {
        var data = getFormData();
        if (!data.title || !data.type) { UI.showToast('Title and type are required', 'error'); return; }
        S.addItem(KEYS.MATERIALS, M.createMaterial(data));
        UI.closeModal(); UI.showToast('Material added!', 'success'); loadMaterials();
      });
    });

    window.MSM.MaterialsPage = {
      view: function (id) {
        var mat = S.getById(KEYS.MATERIALS, id);
        if (!mat) return;
        var typeIcons = { textbook: '📕', worksheet: '📄', digital: '💻', audio: '🎧', video: '🎬', flashcards: '🃏', other: '📦' };
        var icon = typeIcons[mat.type] || '📦';
        var yearLabel = mat.yearLevel > 0 ? ['', '1AC', '2AC', '3AC'][mat.yearLevel] : 'All Levels';
        var html = '<div style="margin-bottom:16px">' +
          '<span style="font-size:32px">' + icon + '</span>' +
          '<span class="badge ' + (mat.isAvailable ? 'badge-success' : 'badge-danger') + '" style="margin-left:8px">' + (mat.isAvailable ? 'Available' : 'Missing') + '</span></div>';
        html += '<div style="margin-bottom:8px"><strong>Type:</strong> ' + UI.escapeHTML(mat.type || '-') + '</div>';
        html += '<div style="margin-bottom:8px"><strong>Year Level:</strong> ' + UI.escapeHTML(yearLabel) + '</div>';
        if (mat.unit) html += '<div style="margin-bottom:8px"><strong>Unit:</strong> ' + UI.escapeHTML(mat.unit) + '</div>';
        if (mat.lesson) html += '<div style="margin-bottom:8px"><strong>Lesson:</strong> ' + UI.escapeHTML(mat.lesson) + '</div>';
        if (mat.description) html += '<div style="margin-bottom:12px"><strong>Description:</strong><p style="margin:4px 0;color:var(--text-secondary)">' + UI.escapeHTML(mat.description) + '</p></div>';
        if (mat.source) html += '<div style="margin-bottom:8px"><strong>Source:</strong> ' + UI.escapeHTML(mat.source) + '</div>';
        if (mat.fileReference) html += '<div style="margin-bottom:8px"><strong>File/URL:</strong> ' + UI.escapeHTML(mat.fileReference) + '</div>';
        if (mat.tags && mat.tags.length) html += '<div style="margin-bottom:12px"><strong>Tags:</strong> ' + mat.tags.map(function (t) { return '<span class="badge" style="margin:2px">' + UI.escapeHTML(t) + '</span>'; }).join(' ') + '</div>';
        if (mat.notes) html += '<div style="margin-bottom:12px"><strong>Notes:</strong><p style="margin:4px 0;color:var(--text-secondary)">' + UI.escapeHTML(mat.notes) + '</p></div>';

        if (MSM.Sidepanel) {
          MSM.Sidepanel.open({
            title: mat.title || 'Material',
            content: html,
            actions: [
              { label: 'Edit', className: 'btn-primary', onClick: function () { MSM.Sidepanel.close(); MSM.MaterialsPage.edit(id); } },
              { label: mat.isAvailable ? 'Mark Missing' : 'Mark Available', className: 'btn-secondary', onClick: function () { MSM.Sidepanel.close(); MSM.MaterialsPage.toggle(id); } },
              { label: 'Delete', className: 'btn-secondary', onClick: function () { MSM.Sidepanel.close(); MSM.MaterialsPage.del(id); } }
            ]
          });
        }
      },
      edit: function (id) {
        var mat = S.getById(KEYS.MATERIALS, id);
        if (!mat) return;
        var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnUpdateMat">Update</button>';
        UI.showModal('Edit Material', getFormHTML(mat), { footerHTML: footerHTML, width: '600px' });
        setupMaterialAiHandler();
        document.getElementById('btnUpdateMat').addEventListener('click', function () {
          var data = getFormData();
          if (!data.title) { UI.showToast('Title is required', 'error'); return; }
          S.updateItem(KEYS.MATERIALS, id, data);
          UI.closeModal(); UI.showToast('Material updated!', 'success'); loadMaterials();
        });
      },
      toggle: function (id) {
        var mat = S.getById(KEYS.MATERIALS, id);
        if (mat) { S.updateItem(KEYS.MATERIALS, id, { isAvailable: !mat.isAvailable }); loadMaterials(); }
      },
      del: function (id) {
        UI.showConfirm('Delete this material?', function () { S.deleteItem(KEYS.MATERIALS, id); UI.showToast('Deleted', 'success'); loadMaterials(); });
      }
    };
  });
})();
