/**
 * MidSchool Manager - Dashboard Page Logic (v2 - Command Center)
 */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var S = window.MSM.Storage;
    var UI = window.MSM.UI;
    var KEYS = S.STORAGE_KEYS;

    // Load data
    var settings = S.getData(KEYS.SETTINGS) || {};
    var classes = S.getData(KEYS.CLASSES) || [];
    var students = S.getData(KEYS.STUDENTS) || [];
    var lessons = S.getData(KEYS.LESSON_RECORDS) || [];
    var events = S.getData(KEYS.CALENDAR_EVENTS) || [];
    var assessments = S.getData(KEYS.ASSESSMENTS) || [];
    var remedials = S.getData(KEYS.REMEDIAL) || [];

    // Grade color families
    var gradeColors = { 1: '#2563EB', 2: '#059669', 3: '#7C3AED' };

    // ======================================================================
    //  Welcome Banner + Motivation Stats
    // ======================================================================
    var welcomeName = document.getElementById('welcomeName');
    if (welcomeName) {
      var name = settings.teacherName || '';
      var hour = new Date().getHours();
      var greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      welcomeName.textContent = name ? greeting + ', ' + name + '!' : greeting + '!';
    }

    // Motivation stats in banner
    var motivEl = document.getElementById('motivationStats');
    if (motivEl) {
      var thisWeekLessons = lessons.filter(function (l) {
        if (!l.date) return false;
        var d = new Date(l.date);
        var now = new Date();
        var weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo && d <= now;
      }).length;

      motivEl.innerHTML =
        '<div class="motivation-stat"><span class="motivation-stat__value">' + lessons.length + '</span> lessons taught</div>' +
        '<div class="motivation-stat"><span class="motivation-stat__value">' + thisWeekLessons + '</span> this week</div>' +
        '<div class="motivation-stat"><span class="motivation-stat__value">' + students.length + '</span> students</div>' +
        '<div class="motivation-stat"><span class="motivation-stat__value">' + classes.length + '</span> classes</div>';
    }

    // ======================================================================
    //  Stats Cards
    // ======================================================================
    var statStudents = document.getElementById('statStudents');
    var statLessons = document.getElementById('statLessons');
    var statRemedial = document.getElementById('statRemedial');
    var statAssessments = document.getElementById('statAssessments');

    if (statStudents) statStudents.textContent = students.length;
    if (statLessons) statLessons.textContent = lessons.length;
    if (statAssessments) statAssessments.textContent = assessments.length;

    var pendingRemedials = remedials.filter(function (r) {
      return r.status !== 'resolved';
    });
    if (statRemedial) statRemedial.textContent = pendingRemedials.length;

    // ======================================================================
    //  Today's Schedule (from timetable)
    // ======================================================================
    var todayEl = document.getElementById('todaySchedule');
    if (todayEl && settings.timetable) {
      var timetable = settings.timetable;
      var schedule = settings.schedule || {};
      var periods = schedule.periods || [];
      var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var todayName = dayNames[new Date().getDay()];
      var now = new Date();
      var currentTime = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();

      var hasAnyClass = false;
      for (var t = 0; t < periods.length; t++) {
        var key = todayName + '_' + periods[t].id;
        if (timetable[key]) { hasAnyClass = true; break; }
      }

      if (hasAnyClass) {
        var shtml = '<div class="today-schedule">';
        for (var p = 0; p < periods.length; p++) {
          var period = periods[p];
          var ttKey = todayName + '_' + period.id;
          var classId = timetable[ttKey];
          var cls = classId ? S.getById(KEYS.CLASSES, classId) : null;

          // Check if this is the current period
          var isActive = false;
          if (period.start && period.end && currentTime >= period.start && currentTime <= period.end) {
            isActive = true;
          }

          shtml += '<div class="today-schedule__period">' + UI.escapeHTML(period.label || period.id) + '</div>';
          if (cls) {
            shtml += '<div class="today-schedule__class' + (isActive ? ' today-schedule__class--active' : '') + '" ' +
              'onclick="location.href=\'lessons.html?quick=1&classId=' + UI.escapeHTML(cls.id) + '&period=' + (p + 1) + '\'" style="cursor:pointer" title="Click to log lesson">' +
              '<div class="today-schedule__dot" style="background:' + UI.escapeHTML(cls.color) + '"></div>' +
              '<strong>' + UI.escapeHTML(cls.name) + '</strong>' +
              (period.start ? ' <span style="color:var(--text-tertiary);font-size:var(--text-xs)">' + period.start + '-' + period.end + '</span>' : '') +
              ' <span style="color:var(--text-tertiary);font-size:var(--text-xs);margin-left:auto">+ Log</span>' +
              '</div>';
          } else {
            shtml += '<div class="today-schedule__class today-schedule__class--empty">Free period</div>';
          }
        }
        shtml += '</div>';
        todayEl.innerHTML = shtml;
      }
    }

    // ======================================================================
    //  Behind Schedule Alerts
    // ======================================================================
    if (window.MSM.Curriculum) {
      var behindClasses = MSM.Curriculum.getBehindClasses();
      var behindCard = document.getElementById('behindAlertsCard');
      var behindEl = document.getElementById('behindAlerts');

      if (behindCard && behindEl && behindClasses.length > 0) {
        behindCard.style.display = '';
        var bhtml = '';
        for (var b = 0; b < behindClasses.length; b++) {
          var bc = behindClasses[b];
          var bcls = S.getById(KEYS.CLASSES, bc.classId);
          var bName = bcls ? bcls.name : bc.classId;
          var bColor = bcls ? bcls.color : '#888';
          bhtml += '<div class="alert-card" style="border-left-color:' + bColor + ';background:var(--warning-light)">' +
            '<div class="alert-card__icon" style="color:' + bColor + '">&#9208;</div>' +
            '<div class="alert-card__text">' +
              '<strong>' + UI.escapeHTML(bName) + '</strong> is behind schedule' +
              (bc.behindReason ? ' &mdash; ' + UI.escapeHTML(bc.behindReason) : '') +
              ' <span class="badge badge-warning">' + bc.percentComplete + '% done</span>' +
            '</div>' +
          '</div>';
        }
        behindEl.innerHTML = bhtml;
      }
    }

    // ======================================================================
    //  Classes Overview with Progress
    // ======================================================================
    var classesOverview = document.getElementById('classesOverview');
    if (classesOverview) {
      var chtml = '';
      for (var i = 0; i < classes.length; i++) {
        var cls2 = classes[i];
        var count = students.filter(function (s) { return s.classId === cls2.id; }).length;
        var progressPct = 0;
        var isBehind = false;
        var currentUnit = '';

        if (window.MSM.Curriculum) {
          var summary = MSM.Curriculum.getClassSummary(cls2.id);
          if (summary) {
            progressPct = summary.percentComplete;
            isBehind = summary.behindSchedule;
            currentUnit = summary.currentUnit || '';
          }
        }

        chtml += '<div class="progress-card' + (isBehind ? ' progress-card--behind' : '') + '" onclick="location.href=\'students.html?class=' + UI.escapeHTML(cls2.id) + '\'">' +
          (isBehind ? '<div class="progress-card__behind">&#9208;</div>' : '') +
          '<div class="progress-card__name" style="color:' + UI.escapeHTML(cls2.color) + '">' + UI.escapeHTML(cls2.name) + '</div>' +
          '<div class="progress-card__bar"><div class="progress-card__fill" style="width:' + progressPct + '%;background:' + UI.escapeHTML(cls2.color) + '"></div></div>' +
          '<div class="progress-card__meta">' + count + ' ss' +
          (currentUnit ? ' &bull; ' + UI.escapeHTML(currentUnit) : '') +
          (progressPct > 0 ? ' &bull; ' + progressPct + '%' : '') +
          '</div>' +
        '</div>';
      }
      classesOverview.innerHTML = chtml;
    }

    var classCount = document.getElementById('classCount');
    if (classCount) classCount.textContent = classes.length + ' classes';

    // ======================================================================
    //  Recent Lessons
    // ======================================================================
    var recentLessonsEl = document.getElementById('recentLessons');
    if (recentLessonsEl && lessons.length > 0) {
      var sortedLessons = lessons.slice().sort(function (a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });
      var recent = sortedLessons.slice(0, 5);
      var lhtml = '';
      for (var j = 0; j < recent.length; j++) {
        var lesson = recent[j];
        var lcls = S.getById(KEYS.CLASSES, lesson.classId);
        var clsName = lcls ? lcls.name : 'Unknown';
        var clsColor = lcls ? lcls.color : '#888';
        var statusBadge = '';
        if (lesson.completionStatus === 'completed') statusBadge = '<span class="badge badge-success">Done</span>';
        else if (lesson.completionStatus === 'partial') statusBadge = '<span class="badge badge-warning">Partial</span>';
        else if (lesson.completionStatus === 'skipped') statusBadge = '<span class="badge badge-neutral">Skipped</span>';
        else statusBadge = '<span class="badge badge-danger">Not Started</span>';

        lhtml += '<div class="recent-item">' +
          '<div class="recent-item__dot" style="background:' + clsColor + '"></div>' +
          '<div class="recent-item__content">' +
            '<div class="recent-item__title">' + UI.escapeHTML(lesson.topic || lesson.unit || 'Untitled') + '</div>' +
            '<div class="recent-item__meta">' + UI.escapeHTML(clsName) + ' &bull; ' + UI.formatDate(lesson.date) + ' ' + statusBadge + '</div>' +
          '</div>' +
        '</div>';
      }
      recentLessonsEl.innerHTML = lhtml;
    }

    // ======================================================================
    //  Upcoming Events
    // ======================================================================
    var upcomingEl = document.getElementById('upcomingEvents');
    if (upcomingEl && events.length > 0) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      var upcoming = events.filter(function (e) {
        var d = new Date(e.date);
        return d >= today && d <= nextWeek;
      }).sort(function (a, b) {
        return (a.date || '').localeCompare(b.date || '');
      }).slice(0, 5);

      if (upcoming.length > 0) {
        var ehtml = '';
        for (var k = 0; k < upcoming.length; k++) {
          var evt = upcoming[k];
          var evtColor = evt.color || 'var(--primary)';
          ehtml += '<div class="event-item" style="border-left-color:' + evtColor + '">' +
            '<div class="event-item__title">' + UI.escapeHTML(evt.title) + '</div>' +
            '<div class="event-item__date">' + UI.formatDate(evt.date) + (evt.startTime ? ' at ' + evt.startTime : '') + '</div>' +
          '</div>';
        }
        upcomingEl.innerHTML = ehtml;
      }
    }

    // ======================================================================
    //  Remedial Alerts
    // ======================================================================
    var alertsCard = document.getElementById('remedialAlertsCard');
    var alertsEl = document.getElementById('remedialAlerts');
    if (alertsCard && alertsEl && pendingRemedials.length > 0) {
      alertsCard.style.display = '';
      var ahtml = '';
      var showAlerts = pendingRemedials.slice(0, 5);
      for (var m = 0; m < showAlerts.length; m++) {
        var rem = showAlerts[m];
        var stu = S.getById(KEYS.STUDENTS, rem.studentId);
        var stuName = stu ? (stu.firstName + ' ' + stu.lastName) : 'Unknown Student';
        var rcls = S.getById(KEYS.CLASSES, rem.classId);
        var rclsName = rcls ? rcls.name : '';
        ahtml += '<div class="alert-card">' +
          '<div class="alert-card__icon">&#9888;&#65039;</div>' +
          '<div class="alert-card__text"><strong>' + UI.escapeHTML(stuName) + '</strong> (' + UI.escapeHTML(rclsName) + ') &mdash; ' +
          UI.escapeHTML(rem.area) + ': ' + UI.escapeHTML(rem.specificIssue || 'Needs attention') +
          ' <span class="badge badge-' + (rem.status === 'identified' ? 'danger' : rem.status === 'improving' ? 'info' : 'warning') + '">' + UI.escapeHTML(rem.status) + '</span></div>' +
        '</div>';
      }
      alertsEl.innerHTML = ahtml;
    }
  });
})();
