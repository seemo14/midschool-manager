/**
 * MidSchool Manager - Assessments Page Logic
 * Enhanced with: CSV export/import, inline editing, progress sparklines, keyboard shortcuts
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage, UI = MSM.UI, M = MSM.Models, KEYS = S.STORAGE_KEYS;
    var currentClassId = '', currentSemester = '', currentView = 'student', selectedStudentId = '';

    UI.buildClassDropdown('assessClassSelect', '', false);
    var classes = S.getData(KEYS.CLASSES) || [];
    if (classes.length > 0) {
      currentClassId = classes[0].id;
      document.getElementById('assessClassSelect').value = currentClassId;
    }

    // View tabs
    document.querySelectorAll('.view-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.view-tab').forEach(function (t) { t.classList.remove('view-tab--active'); });
        this.classList.add('view-tab--active');
        currentView = this.dataset.view;
        render();
      });
    });

    document.getElementById('assessClassSelect').addEventListener('change', function () { currentClassId = this.value; selectedStudentId = ''; render(); });
    document.getElementById('assessSemester').addEventListener('change', function () { currentSemester = this.value; render(); });

    function getStudents() {
      return S.query(KEYS.STUDENTS, function (s) { return s.classId === currentClassId; }).sort(function (a, b) { return (a.lastName || '').localeCompare(b.lastName || ''); });
    }

    function getAssessments(studentId) {
      return S.query(KEYS.ASSESSMENTS, function (a) {
        var match = a.classId === currentClassId;
        if (studentId) match = match && a.studentId === studentId;
        if (currentSemester) match = match && String(a.semester) === currentSemester;
        return match;
      });
    }

    function calcAvg(assessments) {
      var graded = assessments.filter(function (a) { return a.score != null && a.maxScore; });
      if (graded.length === 0) return null;
      var sum = 0;
      for (var i = 0; i < graded.length; i++) sum += (graded[i].score / graded[i].maxScore) * 20;
      return (sum / graded.length).toFixed(1);
    }

    // =====================================================================
    // Sparkline SVG Generator
    // =====================================================================
    function buildSparkline(assessments, width, height) {
      width = width || 80;
      height = height || 24;
      var grades = assessments.filter(function (a) { return a.type === 'grade' && a.score != null && a.maxScore; })
        .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
      if (grades.length < 2) return '';

      var points = grades.map(function (g) { return (g.score / g.maxScore) * 20; });
      var max = 20, min = 0;
      var step = width / (points.length - 1);
      var coords = points.map(function (val, i) {
        var x = i * step;
        var y = height - ((val - min) / (max - min)) * height;
        return x.toFixed(1) + ',' + y.toFixed(1);
      });

      var lastVal = points[points.length - 1];
      var color = lastVal >= 10 ? 'var(--success)' : 'var(--danger)';
      var trend = points[points.length - 1] - points[0];
      var trendColor = trend >= 0 ? 'var(--success)' : 'var(--danger)';

      return '<span class="sparkline"><svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
        '<polyline fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="' + coords.join(' ') + '"/>' +
        '<circle cx="' + coords[coords.length - 1].split(',')[0] + '" cy="' + coords[coords.length - 1].split(',')[1] + '" r="2" fill="' + color + '"/>' +
        '</svg></span>';
    }

    // =====================================================================
    // Render
    // =====================================================================
    function render() {
      if (currentView === 'student') renderStudentView();
      else renderGradeSheet();
    }

    function renderStudentView() {
      var students = getStudents();
      var container = document.getElementById('viewContent');
      if (students.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">👥</div><h3 class="empty-state__title">No students in this class</h3><p class="empty-state__text">Upload students first on the Students page.</p></div>';
        return;
      }

      if (!selectedStudentId) selectedStudentId = students[0].id;

      var listHtml = '<div class="student-list"><div class="student-list__header"><input type="text" id="studentSearch" placeholder="Search..." style="width:100%;padding:6px 8px;font-size:13px;border:1px solid var(--border);border-radius:6px"></div><div class="student-list__items">';
      for (var i = 0; i < students.length; i++) {
        var s = students[i];
        var sAssessments = getAssessments(s.id);
        var avg = calcAvg(sAssessments);
        var spark = buildSparkline(sAssessments, 50, 18);
        listHtml += '<div class="student-list__item' + (s.id === selectedStudentId ? ' student-list__item--active' : '') + '" data-sid="' + s.id + '">' +
          '<span>' + UI.escapeHTML(s.lastName + ', ' + s.firstName) + '</span>' +
          '<div style="display:flex;align-items:center;gap:6px">' + spark +
          (avg !== null ? '<span class="badge ' + (avg >= 10 ? 'badge-success' : 'badge-danger') + '">' + avg + '</span>' : '') + '</div></div>';
      }
      listHtml += '</div></div>';

      // Student detail
      var stu = S.getById(KEYS.STUDENTS, selectedStudentId);
      var stuAssessments = getAssessments(selectedStudentId).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      var avg = calcAvg(stuAssessments);
      var grades = stuAssessments.filter(function (a) { return a.type === 'grade'; });
      var observations = stuAssessments.filter(function (a) { return a.type !== 'grade'; });

      var detailHtml = '<div class="student-detail">';
      if (stu) {
        detailHtml += '<div class="student-detail__name">' + UI.escapeHTML(stu.firstName + ' ' + stu.lastName) + '</div>';
        var cls = S.getById(KEYS.CLASSES, currentClassId);
        detailHtml += '<div class="student-detail__meta">' + (cls ? cls.name : '') + (stu.studentNumber ? ' #' + stu.studentNumber : '') + '</div>';
        detailHtml += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">';
        detailHtml += '<div class="avg-display">' + (avg !== null ? '<span style="color:' + (avg >= 10 ? 'var(--success)' : 'var(--danger)') + '">' + avg + '/20</span>' : '<span style="color:var(--text-secondary)">No grades</span>') + '</div>';
        detailHtml += buildSparkline(stuAssessments, 120, 36);
        detailHtml += '</div>';

        if (grades.length > 0) {
          detailHtml += '<h4 style="margin-bottom:8px">Grades (' + grades.length + ')</h4><div class="table-wrap" style="margin-bottom:16px"><table><thead><tr><th>Date</th><th>Assessment</th><th>Category</th><th>Score</th><th>Notes</th><th></th></tr></thead><tbody>';
          for (var g = 0; g < grades.length; g++) {
            var gr = grades[g];
            var scoreColor = (gr.score != null && gr.maxScore) ? ((gr.score / gr.maxScore * 20) >= 10 ? 'var(--success)' : 'var(--danger)') : 'var(--text)';
            detailHtml += '<tr><td>' + UI.formatDate(gr.date) + '</td><td>' + UI.escapeHTML(gr.title || '-') + '</td><td>' + UI.escapeHTML(gr.category || '-') + '</td><td><strong style="color:' + scoreColor + '">' + (gr.score != null ? gr.score + '/' + (gr.maxScore || 20) : '-') + '</strong></td><td class="text-sm">' + UI.escapeHTML(gr.notes || '') + '</td><td><button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="MSM.AssessmentsPage.del(\'' + gr.id + '\')">x</button></td></tr>';
          }
          detailHtml += '</tbody></table></div>';
        }

        if (observations.length > 0) {
          detailHtml += '<h4 style="margin-bottom:8px">Observations (' + observations.length + ')</h4>';
          for (var o = 0; o < observations.length; o++) {
            var ob = observations[o];
            var obsTypeColors = { observation: 'var(--primary)', behavior: 'var(--warning)', participation: 'var(--success)' };
            var obsColor = obsTypeColors[ob.type] || 'var(--primary)';
            detailHtml += '<div class="obs-card" style="border-left-color:' + obsColor + '"><div class="obs-card__content"><span class="obs-card__date">' + UI.formatDate(ob.date) + '</span><span class="badge badge-info">' + UI.escapeHTML(ob.type) + '</span><div style="margin-top:4px">' + UI.escapeHTML(ob.notes || ob.title || '') + '</div></div><button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="MSM.AssessmentsPage.del(\'' + ob.id + '\')">x</button></div>';
          }
        }

        detailHtml += '<div class="detail-actions"><button class="btn btn-primary btn-sm" onclick="MSM.AssessmentsPage.addGrade(\'' + selectedStudentId + '\')">+ Grade</button><button class="btn btn-secondary btn-sm" onclick="MSM.AssessmentsPage.addObs(\'' + selectedStudentId + '\')">+ Observation</button><button class="btn btn-secondary btn-sm" onclick="MSM.AssessmentsPage.flagRemedial(\'' + selectedStudentId + '\')">Flag Remedial</button></div>';
      }
      detailHtml += '</div>';

      container.innerHTML = '<div class="student-panel">' + listHtml + detailHtml + '</div>';

      // Click handlers
      document.querySelectorAll('.student-list__item').forEach(function (item) {
        item.addEventListener('click', function () { selectedStudentId = this.dataset.sid; render(); });
      });

      var searchEl = document.getElementById('studentSearch');
      if (searchEl) {
        searchEl.addEventListener('input', UI.debounce(function () {
          var q = searchEl.value.toLowerCase();
          document.querySelectorAll('.student-list__item').forEach(function (item) {
            item.style.display = item.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
          });
        }, 200));
      }
    }

    // =====================================================================
    // Grade Sheet with Inline Editing
    // =====================================================================
    function renderGradeSheet() {
      var students = getStudents();
      var container = document.getElementById('viewContent');
      if (students.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📊</div><h3 class="empty-state__title">No students in this class</h3></div>';
        return;
      }

      var allAssess = getAssessments();
      var gradeAssess = allAssess.filter(function (a) { return a.type === 'grade' && a.title; });
      var titles = [];
      var titleMap = {};
      gradeAssess.forEach(function (a) { if (!titleMap[a.title]) { titleMap[a.title] = true; titles.push(a.title); } });

      var html = '<div class="card"><div class="card__header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><h3 class="card__title">Grade Sheet</h3><div style="display:flex;gap:8px;align-items:center"><span class="badge">' + students.length + ' students</span><span class="badge">' + titles.length + ' assessments</span><span style="font-size:11px;color:var(--text-tertiary)">Click a cell to edit</span></div></div><div class="grade-sheet"><table><thead><tr><th>Student</th>';
      titles.forEach(function (t) { html += '<th>' + UI.escapeHTML(t) + '</th>'; });
      html += '<th class="avg-col">Avg</th><th>Trend</th></tr></thead><tbody>';

      var classSum = 0, classCount = 0;
      students.forEach(function (s) {
        html += '<tr><td class="name-cell">' + UI.escapeHTML(s.lastName + ', ' + s.firstName) + '</td>';
        var stuAssess = gradeAssess.filter(function (a) { return a.studentId === s.id; });
        titles.forEach(function (t) {
          var match = stuAssess.find(function (a) { return a.title === t; });
          if (match && match.score != null) {
            var cellColor = (match.score / (match.maxScore || 20) * 20) >= 10 ? 'var(--success)' : 'var(--danger)';
            html += '<td class="editable" data-aid="' + match.id + '" data-score="' + match.score + '" onclick="MSM.AssessmentsPage.inlineEdit(this)"><span style="color:' + cellColor + ';font-weight:600">' + match.score + '</span></td>';
          } else {
            html += '<td class="editable" data-sid="' + s.id + '" data-title="' + UI.escapeHTML(t) + '" onclick="MSM.AssessmentsPage.inlineAdd(this)">-</td>';
          }
        });
        var avg = calcAvg(stuAssess);
        if (avg !== null) { classSum += parseFloat(avg); classCount++; }
        html += '<td class="avg-col" style="color:' + (avg !== null && avg >= 10 ? 'var(--success)' : 'var(--danger)') + ';font-weight:700">' + (avg !== null ? avg : '-') + '</td>';
        html += '<td>' + buildSparkline(stuAssess.map(function (a) { return { type: 'grade', score: a.score, maxScore: a.maxScore, date: a.date }; }), 60, 20) + '</td></tr>';
      });

      var classAvg = classCount > 0 ? (classSum / classCount).toFixed(1) : '-';
      html += '</tbody><tfoot><tr><th>Class Average</th>';
      for (var i = 0; i < titles.length; i++) html += '<th></th>';
      html += '<th class="avg-col">' + classAvg + '/20</th><th></th></tr></tfoot></table></div></div>';
      container.innerHTML = html;
    }

    render();

    // =====================================================================
    // Batch Grade
    // =====================================================================
    document.getElementById('btnBatchGrade').addEventListener('click', function () {
      var students = getStudents();
      if (students.length === 0) { UI.showToast('No students in this class', 'warning'); return; }
      var catOpts = M.ASSESSMENT_CATEGORIES.map(function (c) { return '<option value="' + c.value + '">' + c.label + '</option>'; }).join('');
      var rowsHtml = '<div class="batch-row" style="font-weight:600;color:var(--text-secondary);font-size:12px;text-transform:uppercase;letter-spacing:0.03em;border-bottom:2px solid var(--border)"><div>Student</div><div>Score</div><div>Notes</div></div>';
      students.forEach(function (s, idx) {
        var bgStyle = idx % 2 === 0 ? '' : ' background:var(--bg-secondary);border-radius:6px;';
        rowsHtml += '<div class="batch-row" style="' + bgStyle + '"><div class="batch-row__name">' + UI.escapeHTML(s.lastName + ', ' + s.firstName) + '</div><input type="number" class="batch-score" data-sid="' + s.id + '" min="0" max="20" step="0.5" placeholder="/20"><input type="text" class="batch-note" data-sid="' + s.id + '" placeholder="Optional notes"></div>';
      });

      var formHTML = '<div class="form-row"><div class="form-group"><label>Assessment Title <span class="required">*</span></label><input type="text" id="batchTitle" placeholder="e.g. Unit 3 Written Test"></div><div class="form-group"><label>Category</label><select id="batchCat">' + catOpts + '</select></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Date</label><input type="date" id="batchDate" value="' + M.getToday() + '"></div><div class="form-group"><label>Max Score</label><input type="number" id="batchMax" value="20" min="1"></div></div>' +
        '<div class="form-group"><label>Semester</label><select id="batchSemester"><option value="1">Semester 1</option><option value="2">Semester 2</option></select></div>' +
        '<div style="margin:16px 0 8px;display:flex;justify-content:space-between;align-items:center"><h4 style="margin:0">Enter Scores</h4><span style="font-size:12px;color:var(--text-secondary)">' + students.length + ' students</span></div><div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:8px 12px">' + rowsHtml + '</div>';

      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSaveBatch">Save All Grades</button>';
      UI.showModal('Batch Grade Entry', formHTML, { footerHTML: footerHTML, width: '650px' });

      document.getElementById('btnSaveBatch').addEventListener('click', function () {
        var title = document.getElementById('batchTitle').value.trim();
        if (!title) { UI.showToast('Title is required', 'error'); return; }
        var cat = document.getElementById('batchCat').value;
        var date = document.getElementById('batchDate').value;
        var maxScore = parseInt(document.getElementById('batchMax').value) || 20;
        var semester = parseInt(document.getElementById('batchSemester').value) || 1;
        var scores = document.querySelectorAll('.batch-score');
        var notes = document.querySelectorAll('.batch-note');
        var saved = 0;
        scores.forEach(function (input, idx) {
          var score = parseFloat(input.value);
          if (!isNaN(score)) {
            var noteEl = notes[idx];
            S.addItem(KEYS.ASSESSMENTS, M.createAssessment({
              studentId: input.dataset.sid, classId: currentClassId, type: 'grade', category: cat,
              title: title, date: date, score: score, maxScore: maxScore, notes: noteEl ? noteEl.value.trim() : '', semester: semester
            }));
            saved++;
          }
        });
        UI.closeModal();
        UI.showToast(saved + ' grades saved!', 'success');
        render();
      });
    });

    // =====================================================================
    // CSV Export
    // =====================================================================
    document.getElementById('btnExportGrades').addEventListener('click', function () {
      var students = getStudents();
      if (students.length === 0) { UI.showToast('No students in this class', 'warning'); return; }
      var allAssess = getAssessments();
      var gradeAssess = allAssess.filter(function (a) { return a.type === 'grade' && a.title; });
      var titles = [];
      var titleMap = {};
      gradeAssess.forEach(function (a) { if (!titleMap[a.title]) { titleMap[a.title] = true; titles.push(a.title); } });

      var cls = S.getById(KEYS.CLASSES, currentClassId);
      var className = cls ? cls.name : 'class';

      // Build CSV
      var headers = ['Student Number', 'Last Name', 'First Name'].concat(titles).concat(['Average /20']);
      var lines = [headers.map(escapeCSV).join(',')];

      students.forEach(function (s) {
        var stuGrades = gradeAssess.filter(function (a) { return a.studentId === s.id; });
        var row = [s.studentNumber || '', s.lastName || '', s.firstName || ''];
        titles.forEach(function (t) {
          var match = stuGrades.find(function (a) { return a.title === t; });
          row.push(match && match.score != null ? match.score : '');
        });
        var avg = calcAvg(stuGrades);
        row.push(avg !== null ? avg : '');
        lines.push(row.map(escapeCSV).join(','));
      });

      var csv = '\uFEFF' + lines.join('\r\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'grades-' + className + '-' + M.getToday() + '.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      UI.showToast('Grades exported for ' + className, 'success');
    });

    function escapeCSV(val) {
      val = String(val == null ? '' : val);
      if (val.indexOf(',') >= 0 || val.indexOf('"') >= 0 || val.indexOf('\n') >= 0) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }

    // =====================================================================
    // CSV Import
    // =====================================================================
    document.getElementById('btnImportGrades').addEventListener('click', function () {
      var students = getStudents();
      if (students.length === 0) { UI.showToast('No students in this class. Upload students first.', 'warning'); return; }

      var html = '<div style="padding:8px">' +
        '<p style="margin-bottom:12px;color:var(--text-secondary);font-size:13px">Upload a CSV file with columns: <strong>StudentNumber</strong> (or LastName+FirstName), then one column per assessment title. Values should be scores (e.g. 14.5).</p>' +
        '<input type="file" id="importGradeFile" accept=".csv" style="display:none">' +
        '<label for="importGradeFile" class="btn btn-primary" style="cursor:pointer">Choose CSV File</label>' +
        '<div class="form-row" style="margin-top:12px"><div class="form-group"><label>Category</label><select id="importCat">' + M.ASSESSMENT_CATEGORIES.map(function (c) { return '<option value="' + c.value + '">' + c.label + '</option>'; }).join('') + '</select></div><div class="form-group"><label>Semester</label><select id="importSem"><option value="1">Semester 1</option><option value="2">Semester 2</option></select></div><div class="form-group"><label>Max Score</label><input type="number" id="importMax" value="20" min="1"></div></div>' +
        '<div id="importGradePreview" style="margin-top:12px"></div></div>';
      UI.showModal('Import Grades from CSV', html, { width: '600px' });

      document.getElementById('importGradeFile').addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var parsed = MSM.CSV.parseCSV(ev.target.result);
          if (parsed.errors.length > 0 && parsed.rows.length === 0) {
            UI.showToast('CSV parse error: ' + parsed.errors[0], 'error');
            return;
          }

          var headers = parsed.headers;
          var rows = parsed.rows;

          // Find student number or name columns
          var snCol = -1, lnCol = -1, fnCol = -1;
          for (var h = 0; h < headers.length; h++) {
            var hLow = headers[h].toLowerCase().trim();
            if (['studentnumber', 'student_number', 'numero', 'numéro', 'number', 'id', 'cne'].indexOf(hLow) >= 0) snCol = h;
            if (['lastname', 'last_name', 'nom', 'last name', 'surname'].indexOf(hLow) >= 0) lnCol = h;
            if (['firstname', 'first_name', 'prénom', 'prenom', 'first name'].indexOf(hLow) >= 0) fnCol = h;
          }

          // Assessment title columns are everything else
          var assessCols = [];
          for (var c = 0; c < headers.length; c++) {
            if (c !== snCol && c !== lnCol && c !== fnCol) {
              var hdr = headers[c].toLowerCase().trim();
              if (hdr !== 'average' && hdr !== 'average /20' && hdr !== 'avg') {
                assessCols.push({ idx: c, title: headers[c] });
              }
            }
          }

          var preview = document.getElementById('importGradePreview');
          preview.innerHTML = '<div class="card" style="padding:12px"><p style="font-weight:600;margin-bottom:4px">' + rows.length + ' rows, ' + assessCols.length + ' assessment column(s)</p>' +
            '<p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">Assessments: ' + assessCols.map(function (c) { return UI.escapeHTML(c.title); }).join(', ') + '</p>' +
            '<button class="btn btn-primary btn-sm" id="btnConfirmGradeImport">Import Grades</button></div>';

          document.getElementById('btnConfirmGradeImport').addEventListener('click', function () {
            var cat = document.getElementById('importCat').value;
            var sem = parseInt(document.getElementById('importSem').value) || 1;
            var maxScore = parseInt(document.getElementById('importMax').value) || 20;
            var imported = 0, unmatched = 0;

            rows.forEach(function (row) {
              // Match student
              var student = null;
              if (snCol >= 0 && row[snCol]) {
                var sn = row[snCol].trim();
                student = students.find(function (s) { return s.studentNumber === sn; });
              }
              if (!student && lnCol >= 0 && fnCol >= 0) {
                var ln = (row[lnCol] || '').trim().toLowerCase();
                var fn = (row[fnCol] || '').trim().toLowerCase();
                student = students.find(function (s) {
                  return (s.lastName || '').toLowerCase() === ln && (s.firstName || '').toLowerCase() === fn;
                });
              }
              if (!student) { unmatched++; return; }

              assessCols.forEach(function (col) {
                var val = parseFloat(row[col.idx]);
                if (!isNaN(val)) {
                  S.addItem(KEYS.ASSESSMENTS, M.createAssessment({
                    studentId: student.id, classId: currentClassId, type: 'grade',
                    category: cat, title: col.title, date: M.getToday(),
                    score: val, maxScore: maxScore, semester: sem
                  }));
                  imported++;
                }
              });
            });

            UI.closeModal();
            var msg = imported + ' grade(s) imported!';
            if (unmatched > 0) msg += ' (' + unmatched + ' row(s) could not be matched to students)';
            UI.showToast(msg, imported > 0 ? 'success' : 'warning');
            render();
          });
        };
        reader.readAsText(file);
      });
    });

    // =====================================================================
    // Add single grade / observation
    // =====================================================================
    document.getElementById('btnAddGrade').addEventListener('click', function () {
      var students = getStudents();
      if (students.length === 0) { UI.showToast('No students', 'warning'); return; }
      showGradeModal(students[0].id);
    });

    function showGradeModal(studentId) {
      var students = getStudents();
      var stuOpts = students.map(function (s) { return '<option value="' + s.id + '"' + (s.id === studentId ? ' selected' : '') + '>' + UI.escapeHTML(s.lastName + ', ' + s.firstName) + '</option>'; }).join('');
      var catOpts = M.ASSESSMENT_CATEGORIES.map(function (c) { return '<option value="' + c.value + '">' + c.label + '</option>'; }).join('');
      var formHTML = '<div class="form-group"><label>Student</label><select id="gradeStudent">' + stuOpts + '</select></div>' +
        '<div class="form-group"><label>Title</label><input type="text" id="gradeTitle" placeholder="e.g. Unit 3 Test"></div>' +
        '<div class="form-row"><div class="form-group"><label>Category</label><select id="gradeCat">' + catOpts + '</select></div><div class="form-group"><label>Date</label><input type="date" id="gradeDate" value="' + M.getToday() + '"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>Score</label><input type="number" id="gradeScore" min="0" max="20" step="0.5"></div><div class="form-group"><label>Max Score</label><input type="number" id="gradeMax" value="20"></div></div>' +
        '<div class="form-group"><label>Semester</label><select id="gradeSem"><option value="1">Semester 1</option><option value="2">Semester 2</option></select></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="gradeNotes" rows="2"></textarea></div>';
      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSaveGrade">Save</button>';
      UI.showModal('Add Grade', formHTML, { footerHTML: footerHTML, width: '500px' });
      document.getElementById('btnSaveGrade').addEventListener('click', function () {
        var score = parseFloat(document.getElementById('gradeScore').value);
        if (isNaN(score)) { UI.showToast('Enter a valid score', 'error'); return; }
        S.addItem(KEYS.ASSESSMENTS, M.createAssessment({
          studentId: document.getElementById('gradeStudent').value, classId: currentClassId, type: 'grade',
          category: document.getElementById('gradeCat').value, title: document.getElementById('gradeTitle').value.trim(),
          date: document.getElementById('gradeDate').value, score: score, maxScore: parseInt(document.getElementById('gradeMax').value) || 20,
          notes: document.getElementById('gradeNotes').value.trim(), semester: parseInt(document.getElementById('gradeSem').value) || 1
        }));
        UI.closeModal(); UI.showToast('Grade saved!', 'success'); render();
      });
    }

    document.getElementById('btnAddObservation').addEventListener('click', function () { showObsModal(''); });

    function showObsModal(studentId) {
      var students = getStudents();
      if (students.length === 0) { UI.showToast('No students', 'warning'); return; }
      var stuOpts = students.map(function (s) { return '<option value="' + s.id + '"' + (s.id === studentId ? ' selected' : '') + '>' + UI.escapeHTML(s.lastName + ', ' + s.firstName) + '</option>'; }).join('');
      var formHTML = '<div class="form-group"><label>Student</label><select id="obsStudent">' + stuOpts + '</select></div>' +
        '<div class="form-row"><div class="form-group"><label>Type</label><select id="obsType"><option value="observation">Observation</option><option value="behavior">Behavior</option><option value="participation">Participation</option></select></div><div class="form-group"><label>Date</label><input type="date" id="obsDate" value="' + M.getToday() + '"></div></div>' +
        '<div class="form-group"><label>Notes <span class="required">*</span></label><textarea id="obsNotes" rows="3" placeholder="Your observation..."></textarea></div>';
      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button><button class="btn btn-primary" id="btnSaveObs">Save</button>';
      UI.showModal('Add Observation', formHTML, { footerHTML: footerHTML, width: '500px' });
      document.getElementById('btnSaveObs').addEventListener('click', function () {
        var notes = document.getElementById('obsNotes').value.trim();
        if (!notes) { UI.showToast('Notes are required', 'error'); return; }
        S.addItem(KEYS.ASSESSMENTS, M.createAssessment({
          studentId: document.getElementById('obsStudent').value, classId: currentClassId,
          type: document.getElementById('obsType').value, category: document.getElementById('obsType').value,
          date: document.getElementById('obsDate').value, notes: notes, semester: parseInt(currentSemester) || 1
        }));
        UI.closeModal(); UI.showToast('Observation saved!', 'success'); render();
      });
    }

    // =====================================================================
    // Public API
    // =====================================================================
    window.MSM.AssessmentsPage = {
      addGrade: showGradeModal,
      addObs: showObsModal,
      del: function (id) {
        UI.showConfirm('Delete this assessment?', function () { S.deleteItem(KEYS.ASSESSMENTS, id); UI.showToast('Deleted', 'success'); render(); });
      },
      flagRemedial: function (studentId) {
        window.location.href = 'remedial.html?student=' + studentId + '&class=' + currentClassId;
      },
      // Inline edit existing grade
      inlineEdit: function (cell) {
        var aid = cell.dataset.aid;
        var currentScore = cell.dataset.score;
        cell.innerHTML = '<input type="number" value="' + currentScore + '" min="0" max="20" step="0.5" class="inline-score" autofocus><span class="saved-indicator">Saved</span>';
        var input = cell.querySelector('input');
        input.focus();
        input.select();

        function save() {
          var newScore = parseFloat(input.value);
          if (isNaN(newScore) || newScore < 0) {
            render(); return;
          }
          S.updateItem(KEYS.ASSESSMENTS, aid, { score: newScore, updatedAt: new Date().toISOString() });
          var indicator = cell.querySelector('.saved-indicator');
          if (indicator) { indicator.classList.add('show'); }
          setTimeout(function () { render(); }, 600);
        }

        input.addEventListener('blur', save);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { render(); }
          // Tab navigation between cells
          if (e.key === 'Tab') {
            e.preventDefault();
            save();
            setTimeout(function () {
              var nextCell = cell.parentElement.querySelector('td.editable:not([data-aid="' + aid + '"])') ||
                (cell.parentElement.nextElementSibling ? cell.parentElement.nextElementSibling.querySelector('td.editable') : null);
              if (nextCell) nextCell.click();
            }, 50);
          }
        });
      },
      // Inline add new grade to empty cell
      inlineAdd: function (cell) {
        var sid = cell.dataset.sid;
        var title = cell.dataset.title;
        cell.innerHTML = '<input type="number" min="0" max="20" step="0.5" class="inline-score" placeholder="score" autofocus><span class="saved-indicator">Saved</span>';
        var input = cell.querySelector('input');
        input.focus();

        function save() {
          var score = parseFloat(input.value);
          if (isNaN(score)) { render(); return; }
          S.addItem(KEYS.ASSESSMENTS, M.createAssessment({
            studentId: sid, classId: currentClassId, type: 'grade',
            title: title, date: M.getToday(), score: score, maxScore: 20,
            category: 'written_test', semester: parseInt(currentSemester) || 1
          }));
          var indicator = cell.querySelector('.saved-indicator');
          if (indicator) { indicator.classList.add('show'); }
          setTimeout(function () { render(); }, 600);
        }

        input.addEventListener('blur', save);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { render(); }
        });
      }
    };

    // =====================================================================
    // Keyboard Shortcuts
    // =====================================================================
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        document.getElementById('btnBatchGrade').click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        document.getElementById('btnExportGrades').click();
      }
    });

    // Handle ?action= query params from command palette
    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'grade') {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      setTimeout(function () { document.getElementById('btnAddGrade').click(); }, 300);
    } else if (urlParams.get('action') === 'batch') {
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      setTimeout(function () { document.getElementById('btnBatchGrade').click(); }, 300);
    }
  });
})();
