/**
 * MidSchool Manager - Students Page Logic
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = MSM.Storage;
    var UI = MSM.UI;
    var CSV = MSM.CSV;
    var Models = MSM.Models;
    var KEYS = S.STORAGE_KEYS;

    var currentClassId = '';
    var previewData = null;
    var tableController = null;

    // Initialize class dropdown
    UI.buildClassDropdown('classSelect', '', false);

    // URL params
    var urlParams = new URLSearchParams(window.location.search);
    var paramClass = urlParams.get('class');
    if (paramClass) {
      currentClassId = paramClass;
      document.getElementById('classSelect').value = paramClass;
    } else {
      var classes = S.getData(KEYS.CLASSES) || [];
      if (classes.length > 0) {
        currentClassId = classes[0].id;
        document.getElementById('classSelect').value = currentClassId;
      }
    }

    // Load students for selected class
    function loadStudents() {
      var students = S.query(KEYS.STUDENTS, function (s) {
        return s.classId === currentClassId;
      });

      var cls = S.getById(KEYS.CLASSES, currentClassId);
      var clsName = cls ? cls.name : '--';
      document.getElementById('currentClassName').textContent = clsName;
      document.getElementById('studentCountBadge').textContent = students.length + ' students';

      // Sort by last name
      students.sort(function (a, b) {
        return (a.lastName || '').localeCompare(b.lastName || '');
      });

      var columns = [
        { key: '_index', label: '#', width: '50px', render: function (v, row) { return row._index; } },
        { key: 'fullNameAr', label: 'الاسم بالعربية', sortable: true, className: 'col-rtl', render: function (v) { return v ? '<span dir="rtl" class="text-rtl">' + UI.escapeHTML(v) + '</span>' : '<span style="color:var(--text-tertiary)">-</span>'; } },
        { key: 'lastName', label: 'Last Name', sortable: true },
        { key: 'firstName', label: 'First Name', sortable: true },
        { key: 'studentNumber', label: 'Student #', sortable: true, render: function (v) { return v ? '<code>' + UI.escapeHTML(v) + '</code>' : '-'; } },
        { key: 'gender', label: 'Gender', width: '80px', render: function (v) { return v === 'M' ? '♂ M' : v === 'F' ? '♀ F' : v || '-'; } },
        { key: 'id', label: 'Actions', width: '120px', render: function (v, row) {
          return '<button class="btn btn-ghost btn-sm" onclick="MSM.StudentsPage.editStudent(\'' + v + '\')">Edit</button>' +
                 '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="MSM.StudentsPage.deleteStudent(\'' + v + '\')">Delete</button>';
        }}
      ];

      // Add index
      for (var i = 0; i < students.length; i++) {
        students[i]._index = i + 1;
      }

      tableController = UI.buildTable('studentTable', columns, students, {
        pageSize: 40,
        emptyMessage: 'No students in this class yet. Upload a CSV file or add students manually.',
        striped: true
      });
    }

    loadStudents();

    // Class selector change
    document.getElementById('classSelect').addEventListener('change', function () {
      currentClassId = this.value;
      loadStudents();
    });

    // File upload
    var fileInput = document.getElementById('fileInput');
    var uploadPanel = document.getElementById('uploadPanel');

    document.getElementById('btnBrowseFile').addEventListener('click', function () {
      fileInput.click();
    });

    // Drag and drop
    uploadPanel.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadPanel.classList.add('dragover');
    });
    uploadPanel.addEventListener('dragleave', function () {
      uploadPanel.classList.remove('dragover');
    });
    uploadPanel.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadPanel.classList.remove('dragover');
      var files = e.dataTransfer.files;
      if (files.length > 0) handleFile(files[0]);
    });

    fileInput.addEventListener('change', function () {
      if (this.files.length > 0) handleFile(this.files[0]);
    });

    function handleFile(file) {
      if (!currentClassId) {
        UI.showToast('Please select a class first', 'warning');
        return;
      }

      CSV.readFileAsText(file).then(function (text) {
        var parsed = CSV.parseCSV(text);
        if (parsed.errors.length > 0) {
          UI.showToast('CSV parsing errors: ' + parsed.errors.join(', '), 'error');
        }

        var mapping = CSV.mapStudentColumns(parsed.headers);
        var validated = CSV.validateStudentRows(parsed.rows, mapping);

        previewData = validated.valid;

        // Show preview
        document.getElementById('previewSection').style.display = '';
        document.getElementById('previewCount').textContent = previewData.length;

        // Build preview table
        var phtml = '<table class="msm-table"><thead><tr><th>#</th><th>Last Name</th><th>First Name</th><th>Student #</th><th>Gender</th></tr></thead><tbody>';
        for (var i = 0; i < Math.min(previewData.length, 20); i++) {
          var s = previewData[i];
          phtml += '<tr><td>' + (i + 1) + '</td><td>' + UI.escapeHTML(s.lastName) + '</td><td>' + UI.escapeHTML(s.firstName) + '</td><td>' + UI.escapeHTML(s.studentNumber || '') + '</td><td>' + UI.escapeHTML(s.gender || '') + '</td></tr>';
        }
        if (previewData.length > 20) phtml += '<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">... and ' + (previewData.length - 20) + ' more</td></tr>';
        phtml += '</tbody></table>';
        document.getElementById('previewTable').innerHTML = phtml;

        // Show errors
        var errHtml = '';
        if (validated.invalid.length > 0) {
          errHtml += validated.invalid.length + ' rows skipped (invalid data). ';
        }
        if (validated.duplicates.length > 0) {
          errHtml += validated.duplicates.length + ' duplicate student numbers found. ';
        }
        document.getElementById('previewErrors').innerHTML = errHtml;

      }).catch(function (err) {
        UI.showToast('Error reading file: ' + err.message, 'error');
      });
    }

    // Import button
    document.getElementById('btnImport').addEventListener('click', function () {
      if (!previewData || previewData.length === 0) {
        UI.showToast('No valid data to import', 'warning');
        return;
      }

      var imported = 0;
      for (var i = 0; i < previewData.length; i++) {
        var row = previewData[i];
        var student = Models.createStudent({
          firstName: row.firstName,
          lastName: row.lastName,
          studentNumber: row.studentNumber || '',
          gender: row.gender || '',
          fullNameAr: row.fullNameAr || '',
          classId: currentClassId
        });
        S.addItem(KEYS.STUDENTS, student);
        imported++;
      }

      // Update class student count
      var allStudents = S.query(KEYS.STUDENTS, function (s) { return s.classId === currentClassId; });
      S.updateItem(KEYS.CLASSES, currentClassId, { studentCount: allStudents.length });

      UI.showToast(imported + ' students imported successfully!', 'success');
      document.getElementById('previewSection').style.display = 'none';
      previewData = null;
      fileInput.value = '';
      loadStudents();
    });

    // Cancel preview
    document.getElementById('btnCancelPreview').addEventListener('click', function () {
      document.getElementById('previewSection').style.display = 'none';
      previewData = null;
      fileInput.value = '';
    });

    // Download template
    document.getElementById('btnDownloadTemplate').addEventListener('click', function () {
      var template = CSV.generateCSVTemplate();
      CSV.downloadFile(template, 'student-template.csv', 'text/csv;charset=utf-8;');
    });

    // Export CSV
    document.getElementById('btnExportCSV').addEventListener('click', function () {
      var students = S.query(KEYS.STUDENTS, function (s) { return s.classId === currentClassId; });
      if (students.length === 0) {
        UI.showToast('No students to export', 'warning');
        return;
      }
      CSV.exportStudentsToCSV(students);
    });

    // Add student manually
    document.getElementById('btnAddStudent').addEventListener('click', function () {
      if (!currentClassId) {
        UI.showToast('Please select a class first', 'warning');
        return;
      }
      var formHTML = '<div class="form-group"><label>First Name <span class="required">*</span></label><input type="text" id="addFirstName" placeholder="First name"></div>' +
        '<div class="form-group"><label>Last Name <span class="required">*</span></label><input type="text" id="addLastName" placeholder="Last name"></div>' +
        '<div class="form-row"><div class="form-group"><label>Student Number</label><input type="text" id="addStudentNum" placeholder="e.g. 2026001"></div>' +
        '<div class="form-group"><label>Gender</label><select id="addGender"><option value="">--</option><option value="M">Male</option><option value="F">Female</option></select></div></div>' +
        '<div class="form-group"><label>Arabic Name</label><input type="text" id="addArabicName" placeholder="الاسم بالعربية" dir="rtl"></div>';

      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" id="btnSaveStudent">Save Student</button>';

      UI.showModal('Add Student', formHTML, { footerHTML: footerHTML, width: '480px' });

      document.getElementById('btnSaveStudent').addEventListener('click', function () {
        var fn = document.getElementById('addFirstName').value.trim();
        var ln = document.getElementById('addLastName').value.trim();
        if (!fn || !ln) { UI.showToast('First name and last name are required', 'error'); return; }

        var student = Models.createStudent({
          firstName: fn,
          lastName: ln,
          studentNumber: document.getElementById('addStudentNum').value.trim(),
          gender: document.getElementById('addGender').value,
          fullNameAr: document.getElementById('addArabicName').value.trim(),
          classId: currentClassId
        });
        S.addItem(KEYS.STUDENTS, student);

        var allStudents = S.query(KEYS.STUDENTS, function (s) { return s.classId === currentClassId; });
        S.updateItem(KEYS.CLASSES, currentClassId, { studentCount: allStudents.length });

        UI.closeModal();
        UI.showToast('Student added!', 'success');
        loadStudents();
      });
    });

    // Edit student
    function editStudent(id) {
      var student = S.getById(KEYS.STUDENTS, id);
      if (!student) return;

      var formHTML = '<div class="form-group"><label>First Name <span class="required">*</span></label><input type="text" id="editFirstName" value="' + UI.escapeHTML(student.firstName) + '"></div>' +
        '<div class="form-group"><label>Last Name <span class="required">*</span></label><input type="text" id="editLastName" value="' + UI.escapeHTML(student.lastName) + '"></div>' +
        '<div class="form-row"><div class="form-group"><label>Student Number</label><input type="text" id="editStudentNum" value="' + UI.escapeHTML(student.studentNumber || '') + '"></div>' +
        '<div class="form-group"><label>Gender</label><select id="editGender"><option value="">--</option><option value="M"' + (student.gender === 'M' ? ' selected' : '') + '>Male</option><option value="F"' + (student.gender === 'F' ? ' selected' : '') + '>Female</option></select></div></div>' +
        '<div class="form-group"><label>Arabic Name</label><input type="text" id="editArabicName" value="' + UI.escapeHTML(student.fullNameAr || '') + '" dir="rtl"></div>' +
        '<div class="form-group"><label>Notes</label><textarea id="editNotes" rows="3">' + UI.escapeHTML(student.notes || '') + '</textarea></div>';

      var footerHTML = '<button class="btn btn-secondary" onclick="MSM.UI.closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" id="btnUpdateStudent">Update Student</button>';

      UI.showModal('Edit Student', formHTML, { footerHTML: footerHTML, width: '480px' });

      document.getElementById('btnUpdateStudent').addEventListener('click', function () {
        var fn = document.getElementById('editFirstName').value.trim();
        var ln = document.getElementById('editLastName').value.trim();
        if (!fn || !ln) { UI.showToast('First name and last name are required', 'error'); return; }

        S.updateItem(KEYS.STUDENTS, id, {
          firstName: fn,
          lastName: ln,
          studentNumber: document.getElementById('editStudentNum').value.trim(),
          gender: document.getElementById('editGender').value,
          fullNameAr: document.getElementById('editArabicName').value.trim(),
          notes: document.getElementById('editNotes').value.trim(),
          updatedAt: new Date().toISOString()
        });

        UI.closeModal();
        UI.showToast('Student updated!', 'success');
        loadStudents();
      });
    }

    // Delete student
    function deleteStudent(id) {
      UI.showConfirm('Are you sure you want to remove this student?', function () {
        S.deleteItem(KEYS.STUDENTS, id);
        var allStudents = S.query(KEYS.STUDENTS, function (s) { return s.classId === currentClassId; });
        S.updateItem(KEYS.CLASSES, currentClassId, { studentCount: allStudents.length });
        UI.showToast('Student removed', 'success');
        loadStudents();
      });
    }

    // Expose functions for inline onclick
    window.MSM.StudentsPage = {
      editStudent: editStudent,
      deleteStudent: deleteStudent
    };
  });
})();
