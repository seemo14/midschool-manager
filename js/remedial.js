/**
 * MidSchool Manager - Remedial Work Page Logic
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage, UI = MSM.UI, M = MSM.Models, KEYS = S.STORAGE_KEYS;
    var filterClass = '', filterArea = '';
    var statuses = M.REMEDIAL_STATUSES;
    var statusColors = { identified: 'danger', in_progress: 'warning', improving: 'info', resolved: 'success' };

    UI.buildClassDropdown('remFilterClass', '', true);

    // Check URL params for pre-filling
    var urlParams = new URLSearchParams(window.location.search);
    var paramStudent = urlParams.get('student');
    var paramClass = urlParams.get('class');
    if (paramStudent && paramClass) {
      setTimeout(function () { showFlagModal(paramStudent, paramClass); }, 500);
    }

    function loadBoard() {
      var remedials = S.getData(KEYS.REMEDIAL) || [];
      if (filterClass) remedials = remedials.filter(function (r) { return r.classId === filterClass; });
      if (filterArea) remedials = remedials.filter(function (r) { return r.area === filterArea; });

      var board = document.getElementById('kanbanBoard');
      if (remedials.length === 0 && !filterClass && !filterArea) {
        board.innerHTML = '<div class="empty-state"><div class="empty-state__icon">✅</div><h3 class="empty-state__title">No remedial cases</h3><p class="empty-state__text">Flag a student for remediation when you identify learning gaps.</p></div>';
        return;
      }

      var html = '<div class="kanban">';
      statuses.forEach(function (status) {
        var items = remedials.filter(function (r) { return r.status === status.value; });
        html += '<div class="kanban__column"><div class="kanban__column-header"><span class="kanban__column-title" style="color:var(--' + (statusColors[status.value] || 'text-secondary') + ')">' + status.label + '</span><span class="kanban__column-count">' + items.length + '</span></div>';
        items.forEach(function (r) {
          var stu = S.getById(KEYS.STUDENTS, r.studentId);
          var stuName = stu ? stu.lastName + ', ' + stu.firstName : 'Unknown';
          var cls = S.getById(KEYS.CLASSES, r.classId);
          var clsName = cls ? cls.name : '';
          var interventionCount = (r.interventions || []).length;
          html += '<div class="kanban__card" onclick="MSM.RemedialPage.view(\'' + r.id + '\')">' +
            '<div style="font-weight:600;font-size:14px;margin-bottom:4px">' + UI.escapeHTML(stuName) + '</div>' +
            '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">' + UI.escapeHTML(clsName) + ' • ' + UI.escapeHTML(r.area || '') + '</div>' +
            (r.specificIssue ? '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">' + UI.escapeHTML(r.specificIssue.substring(0, 60)) + '</div>' : '') +
            '<div style="display:flex;justify-content:space-between;align-items:center"><span class="badge badge-' + (statusColors[r.status] || 'neutral') + '">' + UI.escapeHTML(r.status) + '</span><span style="font-size:11px;color:var(--text-secondary)">' + interventionCount + ' intervention' + (interventionCount !== 1 ? 's' : '') + '</span></div></div>';
        });
        html += '</div>';
      });
      html += '</div>';
      board.innerHTML = html;
    }

    loadBoard();

    document.getElementById('remFilterClass').addEventListener('change', function () { filterClass = this.value; loadBoard(); });
    document.getElementById('remFilterArea').addEventListener('change', function () { filterArea = this.value; loadBoard(); });

    function showFlagModal(studentId, classId) {
      var classes = S.getData(KEYS.CLASSES) || [];
      var classOpts = classes.map(function (c) { return '<option value="' + c.id + '"' + (c.id === classId ? ' selected' : '') + '>' + UI.escapeHTML(c.name) + '</option>'; }).join('');
      var areaOpts = M.REMEDIAL_AREAS.map(function (a) { return '<option value="' + a.value + '">' + a.label + '</option>'; }).join('');

      var formHTML = '<div class="form-group"><label>Class <span class="required">*</span></label><select id="flagClass">' + classOpts + '</select></div>' +
        '<div class="form-group"><label>Student <span class="required">*</span></label><select id="flagStudent"></select></div>' +
        '<div class="form-group"><label>Area</label><select id="flagArea">' + areaOpts + '</select></div>' +
        '<div class="form-group"><label>Specific Issue</label><textarea id="flagIssue" rows="2" placeholder="Describe the learning gap..."></textarea></div>' +
        '<div class="form-group"><label>Intervention Plan</label><textarea id="flagPlan" rows="2" placeholder="What will you do to help?"></textarea></div>';

      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSaveFlag">Flag Student</button>';
      UI.showModal('Flag Student for Remediation', formHTML, { footerHTML: footerHTML, width: '500px' });

      function loadStudentDropdown() {
        var cid = document.getElementById('flagClass').value;
        var students = S.query(KEYS.STUDENTS, function (s) { return s.classId === cid; });
        var sel = document.getElementById('flagStudent');
        sel.innerHTML = '';
        students.sort(function (a, b) { return (a.lastName || '').localeCompare(b.lastName || ''); });
        students.forEach(function (s) {
          sel.innerHTML += '<option value="' + s.id + '"' + (s.id === studentId ? ' selected' : '') + '>' + UI.escapeHTML(s.lastName + ', ' + s.firstName) + '</option>';
        });
      }
      loadStudentDropdown();
      document.getElementById('flagClass').addEventListener('change', loadStudentDropdown);

      document.getElementById('btnSaveFlag').addEventListener('click', function () {
        var sid = document.getElementById('flagStudent').value;
        var cid = document.getElementById('flagClass').value;
        if (!sid || !cid) { UI.showToast('Select a class and student', 'error'); return; }
        S.addItem(KEYS.REMEDIAL, M.createRemedial({
          studentId: sid, classId: cid,
          area: document.getElementById('flagArea').value,
          specificIssue: document.getElementById('flagIssue').value.trim(),
          interventionPlan: document.getElementById('flagPlan').value.trim()
        }));
        UI.closeModal(); UI.showToast('Student flagged for remediation', 'success'); loadBoard();
      });
    }

    document.getElementById('btnFlagStudent').addEventListener('click', function () { showFlagModal('', ''); });

    window.MSM.RemedialPage = {
      view: function (id) {
        var r = S.getById(KEYS.REMEDIAL, id);
        if (!r) return;
        var stu = S.getById(KEYS.STUDENTS, r.studentId);
        var stuName = stu ? stu.firstName + ' ' + stu.lastName : 'Unknown';
        var cls = S.getById(KEYS.CLASSES, r.classId);

        var html = '<div style="margin-bottom:16px"><strong>Student:</strong> ' + UI.escapeHTML(stuName) + '<br><strong>Class:</strong> ' + (cls ? UI.escapeHTML(cls.name) : '') + '<br><strong>Area:</strong> ' + UI.escapeHTML(r.area || '') + '<br><strong>Identified:</strong> ' + UI.formatDate(r.identifiedDate || r.createdAt) + '<br><strong>Status:</strong> <span class="badge badge-' + (statusColors[r.status] || 'neutral') + '">' + UI.escapeHTML(r.status) + '</span></div>';
        if (r.specificIssue) html += '<h4>Issue</h4><p>' + UI.escapeHTML(r.specificIssue) + '</p>';
        if (r.interventionPlan) html += '<h4>Intervention Plan</h4><p>' + UI.escapeHTML(r.interventionPlan) + '</p>';

        html += '<h4>Intervention Log</h4>';
        var interventions = r.interventions || [];
        if (interventions.length === 0) html += '<p style="color:var(--text-secondary)">No interventions logged yet.</p>';
        interventions.forEach(function (iv) {
          html += '<div style="padding:8px;background:var(--bg);border-radius:8px;margin-bottom:6px;font-size:14px"><strong>' + UI.formatDate(iv.date) + '</strong>: ' + UI.escapeHTML(iv.action || '') + '<br><em>Outcome: ' + UI.escapeHTML(iv.outcome || 'N/A') + '</em></div>';
        });

        html += '<div style="margin-top:16px"><button class="btn btn-secondary btn-sm" id="btnAddIntervention">+ Log Intervention</button></div>';
        html += '<div class="flex gap-sm mt-3" style="border-top:1px solid var(--border);padding-top:12px">';
        statuses.forEach(function (s) {
          if (s.value !== r.status) {
            html += '<button class="btn btn-sm btn-' + (s.value === 'resolved' ? 'success' : 'secondary') + '" onclick="MSM.RemedialPage.setStatus(\'' + id + '\',\'' + s.value + '\')">' + s.label + '</button>';
          }
        });
        html += '<button class="btn btn-sm btn-danger" style="margin-left:auto" onclick="MSM.RemedialPage.del(\'' + id + '\')">Delete</button></div>';

        var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Close</button>';
        UI.showModal('Remedial Record', html, { footerHTML: footerHTML, width: '550px' });

        document.getElementById('btnAddIntervention').addEventListener('click', function () {
          UI.closeModal();
          var ivHTML = '<div class="form-group"><label>Date</label><input type="date" id="ivDate" value="' + M.getToday() + '"></div>' +
            '<div class="form-group"><label>Action Taken</label><textarea id="ivAction" rows="2" placeholder="What did you do?"></textarea></div>' +
            '<div class="form-group"><label>Outcome</label><textarea id="ivOutcome" rows="2" placeholder="What was the result?"></textarea></div>';
          var ivFooter = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSaveIV">Save</button>';
          UI.showModal('Log Intervention', ivHTML, { footerHTML: ivFooter, width: '450px' });
          document.getElementById('btnSaveIV').addEventListener('click', function () {
            var intervention = { date: document.getElementById('ivDate').value, action: document.getElementById('ivAction').value.trim(), outcome: document.getElementById('ivOutcome').value.trim() };
            var updated = S.getById(KEYS.REMEDIAL, id);
            var ivs = updated.interventions || [];
            ivs.push(intervention);
            S.updateItem(KEYS.REMEDIAL, id, { interventions: ivs, updatedAt: new Date().toISOString() });
            UI.closeModal(); UI.showToast('Intervention logged!', 'success'); loadBoard();
          });
        });
      },
      setStatus: function (id, status) {
        var updates = { status: status, updatedAt: new Date().toISOString() };
        if (status === 'resolved') updates.resolvedDate = M.getToday();
        S.updateItem(KEYS.REMEDIAL, id, updates);
        UI.closeModal(); UI.showToast('Status updated!', 'success'); loadBoard();
      },
      del: function (id) {
        UI.showConfirm('Delete this remedial record?', function () {
          S.deleteItem(KEYS.REMEDIAL, id); UI.closeModal(); UI.showToast('Deleted', 'success'); loadBoard();
        });
      }
    };
  });
})();
