/**
 * CSV Parser Module for Midschool Management App
 * Handles CSV import/export of student lists.
 * Supports UTF-8 (Arabic names), French/English headers, BOM stripping,
 * and messy Excel exports.
 */
(function () {
  'use strict';

  // Ensure namespace exists
  window.MSM = window.MSM || {};

  // -------------------------------------------------------------------------
  // 1. parseCSV(fileContent)
  // -------------------------------------------------------------------------
  /**
   * Parse raw CSV text into headers and rows.
   *
   * Handles:
   *  - BOM character at start of file
   *  - Windows (\r\n) and Unix (\n) line endings
   *  - Quoted fields containing commas, newlines, and escaped quotes ("")
   *  - Empty rows (skipped)
   *  - Trailing commas / extra empty columns (trimmed)
   *
   * @param  {string} fileContent  Raw text content of the CSV file.
   * @return {{headers: string[], rows: string[][], errors: string[]}}
   */
  function parseCSV(fileContent) {
    var errors = [];

    if (typeof fileContent !== 'string' || fileContent.trim() === '') {
      return { headers: [], rows: [], errors: ['File is empty or not a string.'] };
    }

    // Strip BOM (U+FEFF) if present
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }

    // Normalise line endings to \n
    fileContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    var allRows = _parseRows(fileContent, errors);

    if (allRows.length === 0) {
      return { headers: [], rows: [], errors: errors.concat(['No data found in file.']) };
    }

    // First non-empty row is the header
    var headers = allRows[0].map(function (h) { return h.trim(); });

    // Determine the "real" column count from the header row (ignore trailing empties)
    var colCount = _trimmedLength(headers);
    headers = headers.slice(0, colCount);

    var dataRows = [];
    for (var i = 1; i < allRows.length; i++) {
      var row = allRows[i];

      // Skip entirely empty rows
      if (_isEmptyRow(row)) {
        continue;
      }

      // Normalise row length to header count
      var normalised = [];
      for (var c = 0; c < colCount; c++) {
        normalised.push(c < row.length ? row[c].trim() : '');
      }
      dataRows.push(normalised);
    }

    return { headers: headers, rows: dataRows, errors: errors };
  }

  /**
   * Low-level row parser that respects quoted fields spanning multiple lines.
   * Returns an array of arrays of field strings.
   */
  function _parseRows(text, errors) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var len = text.length;
    var rowStartLine = 1;
    var currentLine = 1;

    while (i < len) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          // Look ahead: escaped quote ("") or end of quoted field
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            // End of quoted field
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          if (ch === '\n') {
            currentLine++;
          }
          field += ch;
          i++;
          continue;
        }
      }

      // Not inside quotes
      if (ch === '"') {
        // Start of quoted field (may appear at start of field or after trimming)
        if (field.trim() === '') {
          inQuotes = true;
          field = ''; // discard any leading whitespace before the quote
          i++;
          continue;
        } else {
          // Quote in the middle of an unquoted field -- just include it
          field += ch;
          i++;
          continue;
        }
      }

      if (ch === ',') {
        row.push(field);
        field = '';
        i++;
        continue;
      }

      if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        currentLine++;
        rowStartLine = currentLine;
        i++;
        continue;
      }

      field += ch;
      i++;
    }

    // Handle last field / row
    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    if (inQuotes) {
      errors.push('Warning: unterminated quoted field detected (starting around line ' + rowStartLine + '). Data may be incomplete.');
    }

    return rows;
  }

  /** Return the length of the array ignoring trailing empty strings. */
  function _trimmedLength(arr) {
    var len = arr.length;
    while (len > 0 && arr[len - 1] === '') {
      len--;
    }
    return Math.max(len, 1); // at least 1 column
  }

  /** Check if every cell in the row is empty or whitespace-only. */
  function _isEmptyRow(row) {
    for (var i = 0; i < row.length; i++) {
      if (row[i].trim() !== '') {
        return false;
      }
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // 2. mapStudentColumns(headers)
  // -------------------------------------------------------------------------

  var COLUMN_ALIASES = {
    firstName: [
      'firstname', 'first_name', 'first name', 'prenom', 'prénom',
      'name', 'given name'
    ],
    lastName: [
      'lastname', 'last_name', 'last name', 'nom', 'family name', 'surname'
    ],
    studentNumber: [
      'number', 'student_number', 'studentnumber', 'numero', 'numéro',
      'id', 'student id', 'matricule', 'cne'
    ],
    gender: [
      'gender', 'sexe', 'sex'
    ],
    fullNameAr: [
      'arabic_name', 'nom_arabe', 'arabic',
      '\u0627\u0644\u0627\u0633\u0645',                   // الاسم
      '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644'  // الاسم الكامل
    ],
    fullName: [
      'full_name', 'fullname', 'full name', 'nom complet',
      '\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644 \u0628\u0627\u0644\u0641\u0631\u0646\u0633\u064a\u0629' // الاسم الكامل بالفرنسية
    ]
  };

  /**
   * Map CSV headers to standard student fields.
   *
   * @param  {string[]} headers  Array of header strings (already trimmed).
   * @return {object}  Mapping of field names to column indices, plus optional
   *                   `needsSplit` flag when fullName is present but
   *                   firstName/lastName are not.
   */
  function mapStudentColumns(headers) {
    var mapping = {};
    var normHeaders = headers.map(function (h) {
      return h.toLowerCase().trim();
    });

    var fields = Object.keys(COLUMN_ALIASES);

    for (var f = 0; f < fields.length; f++) {
      var fieldName = fields[f];
      var aliases = COLUMN_ALIASES[fieldName];

      for (var h = 0; h < normHeaders.length; h++) {
        if (aliases.indexOf(normHeaders[h]) !== -1) {
          // Only map the first match for each field
          if (!(fieldName in mapping)) {
            mapping[fieldName] = h;
          }
          break;
        }
      }
    }

    // If we have fullName but not firstName/lastName, flag needsSplit
    if (('fullName' in mapping) &&
        !('firstName' in mapping) &&
        !('lastName' in mapping)) {
      mapping.needsSplit = true;
    }

    return mapping;
  }

  // -------------------------------------------------------------------------
  // 3. validateStudentRows(rows, columnMapping)
  // -------------------------------------------------------------------------
  /**
   * Validate parsed data rows against a column mapping.
   *
   * @param  {string[][]} rows           Parsed data rows (no header).
   * @param  {object}     columnMapping  Output from mapStudentColumns.
   * @return {{valid: object[], invalid: {row: number, data: string[], reason: string}[], duplicates: object[]}}
   */
  function validateStudentRows(rows, columnMapping) {
    var valid = [];
    var invalid = [];
    var duplicates = [];
    var seenNumbers = {};

    var needsSplit = columnMapping.needsSplit === true;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowNumber = i + 2; // +2 because row 1 is header, data starts at row 2
      var student = _extractStudent(row, columnMapping, needsSplit);

      // --- Validation checks ---
      var reason = _validateStudent(student);

      if (reason) {
        invalid.push({ row: rowNumber, data: row, reason: reason });
        continue;
      }

      // Duplicate detection by studentNumber
      if (student.studentNumber) {
        if (seenNumbers[student.studentNumber]) {
          duplicates.push(student);
          continue;
        }
        seenNumbers[student.studentNumber] = true;
      }

      valid.push(student);
    }

    return { valid: valid, invalid: invalid, duplicates: duplicates };
  }

  /**
   * Extract a student object from a data row using the column mapping.
   */
  function _extractStudent(row, mapping, needsSplit) {
    var firstName = _cellValue(row, mapping.firstName);
    var lastName = _cellValue(row, mapping.lastName);
    var studentNumber = _cellValue(row, mapping.studentNumber);
    var gender = _cellValue(row, mapping.gender);
    var fullNameAr = _cellValue(row, mapping.fullNameAr);

    // If needsSplit, derive firstName/lastName from fullName
    if (needsSplit) {
      var fullName = _cellValue(row, mapping.fullName);
      if (fullName) {
        var parts = _splitFullName(fullName);
        firstName = parts.firstName;
        lastName = parts.lastName;
      }
    }

    return {
      firstName: firstName,
      lastName: lastName,
      studentNumber: studentNumber,
      gender: gender,
      fullNameAr: fullNameAr
    };
  }

  /**
   * Split a full name into firstName and lastName by the last space.
   * e.g. "Youssef El Amrani" -> {firstName: "Youssef", lastName: "El Amrani"}
   */
  function _splitFullName(name) {
    name = name.trim();
    var lastSpace = name.lastIndexOf(' ');
    if (lastSpace === -1) {
      return { firstName: name, lastName: '' };
    }
    return {
      firstName: name.substring(0, lastSpace).trim(),
      lastName: name.substring(lastSpace + 1).trim()
    };
  }

  /**
   * Safely get a trimmed cell value from a row.
   */
  function _cellValue(row, index) {
    if (index === undefined || index === null || index < 0 || index >= row.length) {
      return '';
    }
    return (row[index] || '').trim();
  }

  /**
   * Validate a student object. Returns a reason string if invalid, or '' if ok.
   */
  function _validateStudent(student) {
    // Must have at least some kind of name
    var hasFirst = student.firstName !== '';
    var hasLast = student.lastName !== '';

    if (!hasFirst && !hasLast) {
      return 'Missing name: both first name and last name are empty.';
    }

    return '';
  }

  // -------------------------------------------------------------------------
  // 4. readFileAsText(file)
  // -------------------------------------------------------------------------
  /**
   * Read a File object as UTF-8 text using FileReader.
   *
   * @param  {File} file  A File (or Blob) object.
   * @return {Promise<string>}  Resolves with the text content.
   */
  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('No file provided.'));
        return;
      }

      var reader = new FileReader();

      reader.onload = function (e) {
        resolve(e.target.result);
      };

      reader.onerror = function () {
        reject(new Error('Failed to read file: ' + (reader.error ? reader.error.message : 'unknown error')));
      };

      reader.readAsText(file, 'UTF-8');
    });
  }

  // -------------------------------------------------------------------------
  // 5. generateCSVTemplate()
  // -------------------------------------------------------------------------
  /**
   * Generate a sample CSV template string that teachers can fill in.
   *
   * @return {string}
   */
  function generateCSVTemplate() {
    return [
      'FirstName,LastName,StudentNumber,Gender',
      'Youssef,El Amrani,2026001,M',
      'Fatima,Benali,2026002,F',
      'Ahmed,Chakir,2026003,M'
    ].join('\r\n');
  }

  // -------------------------------------------------------------------------
  // 6. exportStudentsToCSV(students)
  // -------------------------------------------------------------------------
  /**
   * Export an array of student objects to CSV and trigger a browser download.
   *
   * @param {object[]} students  Array of student objects with keys:
   *   firstName, lastName, studentNumber, gender, fullNameAr
   */
  function exportStudentsToCSV(students) {
    var headers = ['FirstName', 'LastName', 'StudentNumber', 'Gender', 'ArabicName'];
    var lines = [headers.join(',')];

    for (var i = 0; i < students.length; i++) {
      var s = students[i];
      var row = [
        _escapeCSVField(s.firstName || ''),
        _escapeCSVField(s.lastName || ''),
        _escapeCSVField(s.studentNumber || ''),
        _escapeCSVField(s.gender || ''),
        _escapeCSVField(s.fullNameAr || '')
      ];
      lines.push(row.join(','));
    }

    var csvContent = lines.join('\r\n');
    var today = _formatDate(new Date());
    var filename = 'students-export-' + today + '.csv';

    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Escape a single CSV field: if it contains a comma, quote, or newline,
   * wrap it in double quotes and escape internal quotes by doubling them.
   */
  function _escapeCSVField(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    if (value.indexOf(',') !== -1 ||
        value.indexOf('"') !== -1 ||
        value.indexOf('\n') !== -1 ||
        value.indexOf('\r') !== -1) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * Format a Date as YYYY-MM-DD.
   */
  function _formatDate(date) {
    var y = date.getFullYear();
    var m = ('0' + (date.getMonth() + 1)).slice(-2);
    var d = ('0' + date.getDate()).slice(-2);
    return y + '-' + m + '-' + d;
  }

  // -------------------------------------------------------------------------
  // 7. downloadFile(content, filename, mimeType)
  // -------------------------------------------------------------------------
  /**
   * Trigger a file download in the browser.
   *
   * @param {string} content   The file content.
   * @param {string} filename  The suggested filename.
   * @param {string} [mimeType='text/csv;charset=utf-8;']  MIME type for the Blob.
   */
  function downloadFile(content, filename, mimeType) {
    mimeType = mimeType || 'text/csv;charset=utf-8;';

    // Prepend BOM for CSV files so Excel opens them with correct UTF-8 encoding
    var blobContent = content;
    if (mimeType.indexOf('csv') !== -1) {
      blobContent = '\uFEFF' + content;
    }

    var blob = new Blob([blobContent], { type: mimeType });
    var url = URL.createObjectURL(blob);

    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();

    // Clean up after a short delay to allow the download to start
    setTimeout(function () {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  window.MSM.CSV = {
    parseCSV: parseCSV,
    mapStudentColumns: mapStudentColumns,
    validateStudentRows: validateStudentRows,
    readFileAsText: readFileAsText,
    generateCSVTemplate: generateCSVTemplate,
    exportStudentsToCSV: exportStudentsToCSV,
    downloadFile: downloadFile
  };

})();
