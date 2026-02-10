/**
 * reports.js - Semester Report Generator
 *
 * Generates comprehensive semester reports for classes and individual students.
 * Provides CSV export with BOM for Excel compatibility.
 *
 * Depends on: MSM.Storage, MSM.UI
 * Attaches to window.MSM.Reports
 */
(function () {
    'use strict';

    window.MSM = window.MSM || {};

    // ---------------------------------------------------------------------------
    // Shorthand references (resolved at call time, not load time)
    // ---------------------------------------------------------------------------

    function S() { return window.MSM.Storage; }
    function UI() { return window.MSM.UI; }
    function KEYS() { return S().STORAGE_KEYS; }

    // ---------------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------------

    /**
     * Zero-pad a number to the requested width.
     */
    function _zeroPad(num, width) {
        var s = String(num);
        while (s.length < width) {
            s = '0' + s;
        }
        return s;
    }

    /**
     * Return today as YYYY-MM-DD.
     */
    function _todayISO() {
        var d = new Date();
        return d.getFullYear() + '-' + _zeroPad(d.getMonth() + 1, 2) + '-' + _zeroPad(d.getDate(), 2);
    }

    /**
     * Round a number to a given number of decimal places.
     */
    function _round(value, decimals) {
        if (typeof decimals !== 'number') decimals = 2;
        var factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    /**
     * Escape a value for CSV: wrap in quotes if it contains comma, quote, or newline.
     */
    function _csvEscape(value) {
        if (value === null || value === undefined) return '';
        var str = String(value);
        if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    /**
     * Trigger a file download from a string content.
     */
    function _downloadFile(filename, content, mimeType) {
        var blob = new Blob([content], { type: mimeType || 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);

        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Get the grading scale from settings (default 20).
     */
    function _getGradingScale() {
        var settings = S().getData(KEYS().SETTINGS);
        return (settings && typeof settings.gradingScale === 'number') ? settings.gradingScale : 20;
    }

    /**
     * Get the class name from a classId by looking up msm_classes.
     */
    function _getClassName(classId) {
        var cls = S().getById(KEYS().CLASSES, classId);
        return cls ? (cls.name || classId) : classId;
    }

    /**
     * Determine the letter grade from a score on the /20 scale.
     * Thresholds: >=16 Excellent, >=14 Good, >=12 Satisfactory,
     *             >=10 Needs Improvement, <10 Failing
     * If gradingScale differs from 20, normalize the score to /20 first.
     */
    function _getGrade(score, gradingScale) {
        if (score === null || score === undefined || isNaN(score)) return 'N/A';
        var scale = (typeof gradingScale === 'number' && gradingScale > 0) ? gradingScale : 20;
        var normalized = (score / scale) * 20;

        if (normalized >= 16) return 'Excellent';
        if (normalized >= 14) return 'Good';
        if (normalized >= 12) return 'Satisfactory';
        if (normalized >= 10) return 'Needs Improvement';
        return 'Failing';
    }

    // ---------------------------------------------------------------------------
    // getSemesterDates
    // ---------------------------------------------------------------------------

    /**
     * Read semester date range from msm_settings.semesters.
     *
     * @param {string} semesterKey - 'semester1' or 'semester2'
     * @returns {{ start: string, end: string, label: string } | null}
     */
    function getSemesterDates(semesterKey) {
        var settings = S().getData(KEYS().SETTINGS);
        if (!settings || !settings.semesters || !settings.semesters[semesterKey]) {
            return null;
        }
        var sem = settings.semesters[semesterKey];
        return {
            start: sem.start || '',
            end: sem.end || '',
            label: sem.label || semesterKey
        };
    }

    // ---------------------------------------------------------------------------
    // getClassReport
    // ---------------------------------------------------------------------------

    /**
     * Generate a comprehensive class report for a given semester.
     *
     * @param {string} classId
     * @param {string} semesterKey - 'semester1' or 'semester2'
     * @returns {object|null} Report object or null on error.
     */
    function getClassReport(classId, semesterKey) {
        if (!classId || !semesterKey) return null;

        var semDates = getSemesterDates(semesterKey);
        if (!semDates) {
            console.warn('[Reports] Could not resolve semester dates for "' + semesterKey + '".');
            return null;
        }

        var className = _getClassName(classId);
        var gradingScale = _getGradingScale();
        var startDate = semDates.start;
        var endDate = semDates.end;

        // ---- Lesson records ----
        var allLessons = S().query(KEYS().LESSON_RECORDS, function (rec) {
            return rec.classId === classId && rec.date >= startDate && rec.date <= endDate;
        });

        var totalLessons = allLessons.length;
        var completedLessons = 0;
        var partialLessons = 0;
        var skippedLessons = 0;

        for (var li = 0; li < allLessons.length; li++) {
            var status = allLessons[li].completionStatus;
            if (status === 'completed') {
                completedLessons++;
            } else if (status === 'partial') {
                partialLessons++;
            } else if (status === 'skipped') {
                skippedLessons++;
            }
        }

        // ---- Students ----
        var students = S().query(KEYS().STUDENTS, function (stu) {
            return stu.classId === classId;
        });

        // ---- Assessments ----
        var allAssessments = S().query(KEYS().ASSESSMENTS, function (asr) {
            return asr.classId === classId && asr.date >= startDate && asr.date <= endDate;
        });

        // Group assessments by title (unique assessment events)
        var assessmentTitleMap = {};
        var assessmentTitleOrder = [];

        for (var ai = 0; ai < allAssessments.length; ai++) {
            var asr = allAssessments[ai];
            var key = asr.title || asr.id;
            if (!assessmentTitleMap[key]) {
                assessmentTitleMap[key] = {
                    title: asr.title || 'Untitled',
                    date: asr.date,
                    scores: []
                };
                assessmentTitleOrder.push(key);
            }
            if (typeof asr.score === 'number' && asr.score !== null) {
                assessmentTitleMap[key].scores.push({
                    score: asr.score,
                    maxScore: (typeof asr.maxScore === 'number') ? asr.maxScore : gradingScale
                });
            }
        }

        var passingThreshold = gradingScale * (10 / 20); // 10/20 normalized to current scale
        var assessments = [];

        for (var ti = 0; ti < assessmentTitleOrder.length; ti++) {
            var titleKey = assessmentTitleOrder[ti];
            var group = assessmentTitleMap[titleKey];
            var scores = group.scores;
            var classAverage = 0;
            var highestScore = 0;
            var lowestScore = gradingScale;
            var passCount = 0;

            if (scores.length > 0) {
                var total = 0;
                for (var si = 0; si < scores.length; si++) {
                    var normalizedScore = (scores[si].score / scores[si].maxScore) * gradingScale;
                    total += normalizedScore;
                    if (normalizedScore > highestScore) highestScore = normalizedScore;
                    if (normalizedScore < lowestScore) lowestScore = normalizedScore;
                    if (normalizedScore >= passingThreshold) passCount++;
                }
                classAverage = total / scores.length;
            } else {
                lowestScore = 0;
            }

            assessments.push({
                title: group.title,
                date: group.date,
                classAverage: _round(classAverage, 2),
                highestScore: _round(highestScore, 2),
                lowestScore: _round(lowestScore, 2),
                passRate: scores.length > 0 ? _round((passCount / scores.length) * 100, 1) : 0
            });
        }

        // ---- Student summaries ----
        var studentSummaries = [];

        for (var sti = 0; sti < students.length; sti++) {
            var student = students[sti];

            // Get this student's assessments within the semester
            var stuAssessments = [];
            for (var sa = 0; sa < allAssessments.length; sa++) {
                if (allAssessments[sa].studentId === student.id &&
                    typeof allAssessments[sa].score === 'number') {
                    stuAssessments.push(allAssessments[sa]);
                }
            }

            // Calculate average assessment score (normalized to gradingScale)
            var assessmentAvg = 0;
            if (stuAssessments.length > 0) {
                var stuTotal = 0;
                for (var sai = 0; sai < stuAssessments.length; sai++) {
                    var maxSc = (typeof stuAssessments[sai].maxScore === 'number') ? stuAssessments[sai].maxScore : gradingScale;
                    stuTotal += (stuAssessments[sai].score / maxSc) * gradingScale;
                }
                assessmentAvg = stuTotal / stuAssessments.length;
            }

            // Attendance: count lessons where this student was present
            // Since lesson records are class-level, attendance rate is based on
            // completed + partial lessons vs total lessons for the class.
            // Individual student attendance would require a separate attendance system;
            // we approximate using the class lesson completion data.
            var lessonsAttended = completedLessons + partialLessons;
            var attendanceRate = totalLessons > 0 ? _round((lessonsAttended / totalLessons) * 100, 1) : 0;

            studentSummaries.push({
                studentId: student.id,
                firstName: student.firstName || '',
                lastName: student.lastName || '',
                assessmentAvg: _round(assessmentAvg, 2),
                attendanceRate: attendanceRate,
                lessonsAttended: lessonsAttended
            });
        }

        // ---- Curriculum progress ----
        var unitsCompleted = 0;
        var unitsCurrent = 0;

        if (window.MSM.Curriculum && typeof window.MSM.Curriculum.getClassSummary === 'function') {
            var currSummary = window.MSM.Curriculum.getClassSummary(classId);
            if (currSummary) {
                unitsCompleted = currSummary.completed || 0;
                unitsCurrent = currSummary.inProgress || 0;
            }
        }

        return {
            className: className,
            semester: semDates.label,
            totalLessons: totalLessons,
            completedLessons: completedLessons,
            partialLessons: partialLessons,
            skippedLessons: skippedLessons,
            assessments: assessments,
            studentSummaries: studentSummaries,
            unitsCompleted: unitsCompleted,
            unitsCurrent: unitsCurrent
        };
    }

    // ---------------------------------------------------------------------------
    // getStudentReport
    // ---------------------------------------------------------------------------

    /**
     * Generate an individual student report for a given semester.
     *
     * @param {string} studentId
     * @param {string} semesterKey - 'semester1' or 'semester2'
     * @returns {object|null} Report object or null on error.
     */
    function getStudentReport(studentId, semesterKey) {
        if (!studentId || !semesterKey) return null;

        var semDates = getSemesterDates(semesterKey);
        if (!semDates) {
            console.warn('[Reports] Could not resolve semester dates for "' + semesterKey + '".');
            return null;
        }

        var student = S().getById(KEYS().STUDENTS, studentId);
        if (!student) {
            console.warn('[Reports] Student not found: "' + studentId + '".');
            return null;
        }

        var gradingScale = _getGradingScale();
        var startDate = semDates.start;
        var endDate = semDates.end;
        var className = _getClassName(student.classId);

        // ---- Student assessments ----
        var stuAssessments = S().query(KEYS().ASSESSMENTS, function (asr) {
            return asr.studentId === studentId &&
                   asr.date >= startDate &&
                   asr.date <= endDate;
        });

        var assessments = [];
        var validScoreTotal = 0;
        var validScoreCount = 0;

        for (var i = 0; i < stuAssessments.length; i++) {
            var asr = stuAssessments[i];
            var maxScore = (typeof asr.maxScore === 'number') ? asr.maxScore : gradingScale;
            var score = (typeof asr.score === 'number') ? asr.score : null;
            var percentage = (score !== null && maxScore > 0) ? _round((score / maxScore) * 100, 1) : null;

            assessments.push({
                title: asr.title || 'Untitled',
                date: asr.date || '',
                score: score,
                maxScore: maxScore,
                percentage: percentage
            });

            if (score !== null && maxScore > 0) {
                validScoreTotal += (score / maxScore) * gradingScale;
                validScoreCount++;
            }
        }

        // Average score on the grading scale
        var averageScore = validScoreCount > 0 ? _round(validScoreTotal / validScoreCount, 2) : 0;
        var grade = _getGrade(averageScore, gradingScale);

        // ---- Remedial items ----
        var allRemedial = S().query(KEYS().REMEDIAL, function (rem) {
            return rem.studentId === studentId;
        });

        var remedialItems = [];
        for (var ri = 0; ri < allRemedial.length; ri++) {
            var rem = allRemedial[ri];
            remedialItems.push({
                area: rem.area || '',
                specificIssue: rem.specificIssue || '',
                status: rem.status || 'identified'
            });
        }

        return {
            studentName: (student.firstName || '') + ' ' + (student.lastName || ''),
            className: className,
            semester: semDates.label,
            assessments: assessments,
            averageScore: averageScore,
            grade: grade,
            remedialItems: remedialItems
        };
    }

    // ---------------------------------------------------------------------------
    // exportClassReportCSV
    // ---------------------------------------------------------------------------

    /**
     * Generate and download a CSV file for a class semester report.
     *
     * @param {string} classId
     * @param {string} semesterKey - 'semester1' or 'semester2'
     */
    function exportClassReportCSV(classId, semesterKey) {
        var report = getClassReport(classId, semesterKey);
        if (!report) {
            UI().showToast('Could not generate class report.', 'error');
            return;
        }

        var gradingScale = _getGradingScale();
        var semDates = getSemesterDates(semesterKey);
        var rows = [];

        // BOM for Excel UTF-8 compatibility
        var bom = '\uFEFF';

        // ---- Header rows ----
        rows.push('Class Report');
        rows.push('Class,' + _csvEscape(report.className));
        rows.push('Semester,' + _csvEscape(report.semester));
        rows.push('Date Range,' + _csvEscape((semDates ? semDates.start : '') + ' to ' + (semDates ? semDates.end : '')));
        rows.push('Generated,' + _csvEscape(_todayISO()));
        rows.push('');

        // ---- Lesson summary ----
        rows.push('Lesson Summary');
        rows.push('Total Lessons,' + report.totalLessons);
        rows.push('Completed,' + report.completedLessons);
        rows.push('Partial,' + report.partialLessons);
        rows.push('Skipped,' + report.skippedLessons);
        rows.push('Units Completed,' + report.unitsCompleted);
        rows.push('Units In Progress,' + report.unitsCurrent);
        rows.push('');

        // ---- Assessment summary ----
        if (report.assessments.length > 0) {
            rows.push('Assessment Summary');
            rows.push('Title,Date,Class Average,Highest,Lowest,Pass Rate (%)');
            for (var ai = 0; ai < report.assessments.length; ai++) {
                var asr = report.assessments[ai];
                rows.push(
                    _csvEscape(asr.title) + ',' +
                    _csvEscape(asr.date) + ',' +
                    asr.classAverage + ',' +
                    asr.highestScore + ',' +
                    asr.lowestScore + ',' +
                    asr.passRate
                );
            }
            rows.push('');
        }

        // ---- Student rows ----
        rows.push('Student Results');

        // Build header: Number, Name, [assessment titles...], Average, Grade
        var studentHeader = 'Number,Name';
        var assessmentTitles = [];
        for (var ati = 0; ati < report.assessments.length; ati++) {
            assessmentTitles.push(report.assessments[ati].title);
            studentHeader += ',' + _csvEscape(report.assessments[ati].title);
        }
        studentHeader += ',Average,Grade';
        rows.push(studentHeader);

        // Get all assessments for score lookup
        var allAssessments = S().query(KEYS().ASSESSMENTS, function (asr) {
            return asr.classId === classId &&
                   asr.date >= semDates.start &&
                   asr.date <= semDates.end;
        });

        // Sort students by last name then first name
        var sortedStudents = report.studentSummaries.slice();
        sortedStudents.sort(function (a, b) {
            var nameA = (a.lastName + ' ' + a.firstName).toLowerCase();
            var nameB = (b.lastName + ' ' + b.firstName).toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });

        // Build a lookup: studentId -> { assessmentTitle -> score }
        var studentScoreMap = {};
        for (var asri = 0; asri < allAssessments.length; asri++) {
            var rec = allAssessments[asri];
            if (!studentScoreMap[rec.studentId]) {
                studentScoreMap[rec.studentId] = {};
            }
            var titleKey = rec.title || rec.id;
            if (typeof rec.score === 'number') {
                var maxSc = (typeof rec.maxScore === 'number') ? rec.maxScore : gradingScale;
                studentScoreMap[rec.studentId][titleKey] = _round((rec.score / maxSc) * gradingScale, 2);
            }
        }

        // Track column totals for class averages summary row
        var columnTotals = [];
        var columnCounts = [];
        for (var ct = 0; ct < assessmentTitles.length; ct++) {
            columnTotals.push(0);
            columnCounts.push(0);
        }
        var avgTotal = 0;
        var avgCount = 0;

        for (var si = 0; si < sortedStudents.length; si++) {
            var stu = sortedStudents[si];
            var stuNumber = si + 1;
            var stuName = (stu.lastName || '') + ' ' + (stu.firstName || '');
            var row = _csvEscape(stuNumber) + ',' + _csvEscape(stuName.trim());

            var scores = studentScoreMap[stu.studentId] || {};

            for (var tti = 0; tti < assessmentTitles.length; tti++) {
                var title = assessmentTitles[tti];
                var scoreVal = scores[title];
                if (scoreVal !== undefined && scoreVal !== null) {
                    row += ',' + scoreVal;
                    columnTotals[tti] += scoreVal;
                    columnCounts[tti]++;
                } else {
                    row += ',';
                }
            }

            row += ',' + stu.assessmentAvg;
            row += ',' + _csvEscape(_getGrade(stu.assessmentAvg, gradingScale));

            if (stu.assessmentAvg > 0) {
                avgTotal += stu.assessmentAvg;
                avgCount++;
            }

            rows.push(row);
        }

        // ---- Summary row ----
        var summaryRow = ',Class Average';
        for (var cci = 0; cci < assessmentTitles.length; cci++) {
            if (columnCounts[cci] > 0) {
                summaryRow += ',' + _round(columnTotals[cci] / columnCounts[cci], 2);
            } else {
                summaryRow += ',';
            }
        }
        summaryRow += ',' + (avgCount > 0 ? _round(avgTotal / avgCount, 2) : '');
        summaryRow += ',';
        rows.push(summaryRow);

        // ---- Download ----
        var csvContent = bom + rows.join('\n');
        var filename = report.className.replace(/\s+/g, '_') + '_' + semesterKey + '_report.csv';
        _downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');

        UI().showToast('Class report exported: ' + filename, 'success');
    }

    // ---------------------------------------------------------------------------
    // exportStudentReportCSV
    // ---------------------------------------------------------------------------

    /**
     * Generate and download a CSV file for an individual student semester report.
     *
     * @param {string} studentId
     * @param {string} semesterKey - 'semester1' or 'semester2'
     */
    function exportStudentReportCSV(studentId, semesterKey) {
        var report = getStudentReport(studentId, semesterKey);
        if (!report) {
            UI().showToast('Could not generate student report.', 'error');
            return;
        }

        var gradingScale = _getGradingScale();
        var semDates = getSemesterDates(semesterKey);
        var rows = [];

        // BOM for Excel UTF-8 compatibility
        var bom = '\uFEFF';

        // ---- Header rows ----
        rows.push('Student Report');
        rows.push('Student,' + _csvEscape(report.studentName));
        rows.push('Class,' + _csvEscape(report.className));
        rows.push('Semester,' + _csvEscape(report.semester));
        rows.push('Date Range,' + _csvEscape((semDates ? semDates.start : '') + ' to ' + (semDates ? semDates.end : '')));
        rows.push('Generated,' + _csvEscape(_todayISO()));
        rows.push('');

        // ---- Overall summary ----
        rows.push('Overall Summary');
        rows.push('Average Score,' + report.averageScore + '/' + gradingScale);
        rows.push('Grade,' + _csvEscape(report.grade));
        rows.push('Total Assessments,' + report.assessments.length);
        rows.push('');

        // ---- Assessment details ----
        if (report.assessments.length > 0) {
            rows.push('Assessment Details');
            rows.push('Title,Date,Score,Max Score,Percentage (%)');
            for (var ai = 0; ai < report.assessments.length; ai++) {
                var asr = report.assessments[ai];
                rows.push(
                    _csvEscape(asr.title) + ',' +
                    _csvEscape(asr.date) + ',' +
                    (asr.score !== null ? asr.score : '') + ',' +
                    asr.maxScore + ',' +
                    (asr.percentage !== null ? asr.percentage : '')
                );
            }
            rows.push('');
        }

        // ---- Remedial items ----
        if (report.remedialItems.length > 0) {
            rows.push('Remedial Tracking');
            rows.push('Area,Specific Issue,Status');
            for (var ri = 0; ri < report.remedialItems.length; ri++) {
                var rem = report.remedialItems[ri];
                rows.push(
                    _csvEscape(rem.area) + ',' +
                    _csvEscape(rem.specificIssue) + ',' +
                    _csvEscape(rem.status)
                );
            }
        }

        // ---- Download ----
        var csvContent = bom + rows.join('\n');
        var safeName = report.studentName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        var filename = safeName + '_' + semesterKey + '_report.csv';
        _downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');

        UI().showToast('Student report exported: ' + filename, 'success');
    }

    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------

    window.MSM.Reports = {
        getSemesterDates: getSemesterDates,
        getClassReport: getClassReport,
        getStudentReport: getStudentReport,
        exportClassReportCSV: exportClassReportCSV,
        exportStudentReportCSV: exportStudentReportCSV
    };

})();
