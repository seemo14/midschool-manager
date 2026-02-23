/**
 * MSM Command Palette Module
 * Universal search/action overlay triggered by Ctrl+K or search icon.
 * Attaches to window.MSM.CommandPalette
 */
(function () {
  'use strict';
  window.MSM = window.MSM || {};

  var _overlay = null;
  var _activeIndex = -1;
  var RECENT_KEY = 'msm_recent_searches';
  var MAX_RECENT = 5;

  /* ---- Quick Actions (always shown when input is empty) ---- */
  var QUICK_ACTIONS = [
    { id: 'new-lesson', label: 'Log New Lesson', icon: '📖', href: 'lessons.html?action=new', type: 'action' },
    { id: 'add-grade', label: 'Add Grade', icon: '📝', href: 'assessments.html?action=grade', type: 'action' },
    { id: 'batch-grade', label: 'Batch Grade Entry', icon: '📊', href: 'assessments.html?action=batch', type: 'action' },
    { id: 'new-plan', label: 'New Lesson Plan', icon: '✏️', href: 'plans.html?action=new', type: 'action' },
    { id: 'add-event', label: 'Add Calendar Event', icon: '📅', href: 'calendar.html?action=new', type: 'action' }
  ];

  var NAV_PAGES = [
    { label: 'Dashboard', href: 'index.html', icon: '🏠', type: 'nav' },
    { label: 'Lesson Records', href: 'lessons.html', icon: '📖', type: 'nav' },
    { label: 'Materials', href: 'materials.html', icon: '📄', type: 'nav' },
    { label: 'Lesson Plans', href: 'plans.html', icon: '✏️', type: 'nav' },
    { label: 'Calendar', href: 'calendar.html', icon: '📅', type: 'nav' },
    { label: 'Students', href: 'students.html', icon: '👥', type: 'nav' },
    { label: 'Assessments', href: 'assessments.html', icon: '✅', type: 'nav' },
    { label: 'Remedial Work', href: 'remedial.html', icon: '⚠️', type: 'nav' },
    { label: 'Settings', href: 'settings.html', icon: '⚙️', type: 'nav' }
  ];

  /* ---- Recent searches ---- */
  function loadRecent() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch (e) { return []; }
  }

  function saveRecent(query) {
    if (!query || query.length < 2) return;
    var recent = loadRecent();
    // Remove duplicate
    recent = recent.filter(function (r) { return r !== query; });
    recent.unshift(query);
    if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch (e) {}
  }

  /* ---- Build search index ---- */
  function buildSearchIndex() {
    var S = MSM.Storage;
    if (!S) return [];
    var KEYS = S.STORAGE_KEYS;
    var results = [];
    var classes = S.getData('msm_classes') || [];
    var classMap = {};
    for (var c = 0; c < classes.length; c++) { classMap[classes[c].id] = classes[c].name || classes[c].id; }

    // Students
    var students = S.getData(KEYS.STUDENTS) || [];
    for (var i = 0; i < students.length; i++) {
      var s = students[i];
      results.push({
        type: 'student', id: s.id,
        title: (s.firstName || '') + ' ' + (s.lastName || ''),
        subtitle: classMap[s.classId] || '',
        href: 'students.html?class=' + s.classId,
        icon: '👤',
        keywords: [s.firstName, s.lastName, s.fullNameAr, s.studentNumber].filter(Boolean).join(' ')
      });
    }

    // Lesson Records
    var lessons = S.getData(KEYS.LESSON_RECORDS) || [];
    for (var j = 0; j < lessons.length; j++) {
      var l = lessons[j];
      results.push({
        type: 'lesson', id: l.id,
        title: l.topic || 'Untitled Lesson',
        subtitle: (classMap[l.classId] || '') + (l.date ? ' - ' + l.date : ''),
        href: 'lessons.html?class=' + l.classId,
        icon: '📖',
        keywords: [l.topic, l.unit, l.lessonFocus].filter(Boolean).join(' ')
      });
    }

    // Lesson Plans
    var plans = S.getData(KEYS.LESSON_PLANS) || [];
    for (var k = 0; k < plans.length; k++) {
      var p = plans[k];
      results.push({
        type: 'plan', id: p.id,
        title: p.title || 'Untitled Plan',
        subtitle: p.yearLevel ? p.yearLevel + 'AC' : '',
        href: 'plans.html',
        icon: '✏️',
        keywords: [p.title, p.unit, p.objectives].filter(Boolean).join(' ')
      });
    }

    // Materials
    var materials = S.getData(KEYS.MATERIALS) || [];
    for (var m = 0; m < materials.length; m++) {
      var mat = materials[m];
      results.push({
        type: 'material', id: mat.id,
        title: mat.title || 'Untitled Material',
        subtitle: mat.type || '',
        href: 'materials.html',
        icon: '📄',
        keywords: [mat.title, mat.description, (mat.tags || []).join(' ')].filter(Boolean).join(' ')
      });
    }

    return results;
  }

  /* ---- Fuzzy matching ---- */
  function fuzzyMatch(query, item) {
    var q = query.toLowerCase();
    var titleMatch = (item.title || '').toLowerCase().indexOf(q) !== -1;
    var subtitleMatch = (item.subtitle || '').toLowerCase().indexOf(q) !== -1;
    var keywordMatch = (item.keywords || '').toLowerCase().indexOf(q) !== -1;

    if (titleMatch) return 3;
    if (subtitleMatch) return 2;
    if (keywordMatch) return 1;
    return 0;
  }

  /* ---- Render results ---- */
  function renderResults(container, results, activeIdx) {
    container.innerHTML = '';
    if (results.length === 0) {
      container.innerHTML = '<div class="cmd-palette__empty">No results found</div>';
      return;
    }

    var currentType = '';
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      // Section header
      if (r.type !== currentType) {
        currentType = r.type;
        var sectionLabel = { action: 'Quick Actions', nav: 'Pages', student: 'Students', lesson: 'Lessons', plan: 'Plans', material: 'Materials', recent: 'Recent' };
        var section = document.createElement('div');
        section.className = 'cmd-palette__section';
        section.textContent = sectionLabel[currentType] || currentType;
        container.appendChild(section);
      }

      var el = document.createElement('a');
      el.className = 'cmd-palette__result' + (i === activeIdx ? ' cmd-palette__result--active' : '');
      el.href = r.href || '#';
      el.setAttribute('data-index', String(i));
      el.innerHTML =
        '<span class="cmd-palette__result-icon">' + (r.icon || '') + '</span>' +
        '<div class="cmd-palette__result-text">' +
          '<div class="cmd-palette__result-title">' + escapeHTML(r.title || r.label || '') + '</div>' +
          (r.subtitle ? '<div class="cmd-palette__result-sub">' + escapeHTML(r.subtitle) + '</div>' : '') +
        '</div>' +
        (r.type ? '<span class="cmd-palette__result-badge">' + r.type + '</span>' : '');

      container.appendChild(el);
    }
  }

  function escapeHTML(str) {
    if (MSM.UI && MSM.UI.escapeHTML) return MSM.UI.escapeHTML(str);
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- Open ---- */
  function open() {
    if (_overlay) return;

    _activeIndex = -1;
    var allResults = [];

    // Create overlay
    _overlay = document.createElement('div');
    _overlay.className = 'cmd-palette-overlay';

    var palette = document.createElement('div');
    palette.className = 'cmd-palette';

    // Input area
    var inputWrap = document.createElement('div');
    inputWrap.className = 'cmd-palette__input-wrap';
    inputWrap.innerHTML = '<svg class="cmd-palette__search-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

    var input = document.createElement('input');
    input.className = 'cmd-palette__input';
    input.type = 'text';
    input.placeholder = 'Search students, lessons, plans...';
    input.setAttribute('autocomplete', 'off');

    var kbdHint = document.createElement('span');
    kbdHint.className = 'cmd-palette__kbd';
    kbdHint.textContent = 'ESC';

    inputWrap.appendChild(input);
    if (window.innerWidth > 767) inputWrap.appendChild(kbdHint);

    // Results area
    var resultsContainer = document.createElement('div');
    resultsContainer.className = 'cmd-palette__results';

    palette.appendChild(inputWrap);
    palette.appendChild(resultsContainer);
    _overlay.appendChild(palette);

    // Show default: quick actions + recent + nav pages
    function showDefault() {
      allResults = [];
      allResults = allResults.concat(QUICK_ACTIONS);
      var recent = loadRecent();
      if (recent.length > 0) {
        for (var r = 0; r < recent.length; r++) {
          allResults.push({ type: 'recent', label: recent[r], icon: '🕐', href: '#', title: recent[r] });
        }
      }
      allResults = allResults.concat(NAV_PAGES);
      _activeIndex = 0;
      renderResults(resultsContainer, allResults, _activeIndex);
    }

    // Search handler
    function handleInput() {
      var query = input.value.trim();
      if (!query) {
        showDefault();
        return;
      }

      // Navigation shortcut
      if (query.charAt(0) === '>') {
        var navQuery = query.substring(1).trim().toLowerCase();
        allResults = NAV_PAGES.filter(function (p) {
          return p.label.toLowerCase().indexOf(navQuery) !== -1;
        });
        _activeIndex = allResults.length > 0 ? 0 : -1;
        renderResults(resultsContainer, allResults, _activeIndex);
        return;
      }

      // Search across all entities
      var index = buildSearchIndex();
      var scored = [];
      for (var i = 0; i < index.length; i++) {
        var score = fuzzyMatch(query, index[i]);
        if (score > 0) {
          scored.push({ item: index[i], score: score });
        }
      }
      // Also search quick actions
      for (var j = 0; j < QUICK_ACTIONS.length; j++) {
        var a = QUICK_ACTIONS[j];
        if (a.label.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
          scored.push({ item: a, score: 4 });
        }
      }
      // Sort by score desc
      scored.sort(function (a, b) { return b.score - a.score; });

      allResults = scored.map(function (s) { return s.item; }).slice(0, 20);
      _activeIndex = allResults.length > 0 ? 0 : -1;
      renderResults(resultsContainer, allResults, _activeIndex);
    }

    input.addEventListener('input', handleInput);

    // Keyboard navigation
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (_activeIndex < allResults.length - 1) _activeIndex++;
        renderResults(resultsContainer, allResults, _activeIndex);
        scrollToActive(resultsContainer);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (_activeIndex > 0) _activeIndex--;
        renderResults(resultsContainer, allResults, _activeIndex);
        scrollToActive(resultsContainer);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_activeIndex >= 0 && _activeIndex < allResults.length) {
          var selected = allResults[_activeIndex];
          if (selected.type === 'recent') {
            input.value = selected.title;
            handleInput();
          } else {
            saveRecent(input.value.trim());
            if (selected.href && selected.href !== '#') {
              window.location.href = selected.href;
            }
          }
        }
      } else if (e.key === 'Escape') {
        close();
      }
    });

    // Click on result
    resultsContainer.addEventListener('click', function (e) {
      var resultEl = e.target.closest('.cmd-palette__result');
      if (!resultEl) return;
      var idx = parseInt(resultEl.getAttribute('data-index'), 10);
      if (idx >= 0 && idx < allResults.length) {
        var selected = allResults[idx];
        if (selected.type === 'recent') {
          e.preventDefault();
          input.value = selected.title;
          handleInput();
        } else {
          saveRecent(input.value.trim());
          // Let the <a> href navigate naturally
        }
      }
    });

    // Close on overlay click
    _overlay.addEventListener('click', function (e) {
      if (e.target === _overlay) close();
    });

    document.body.appendChild(_overlay);
    document.body.style.overflow = 'hidden';

    // Focus input
    setTimeout(function () { input.focus(); }, 50);

    showDefault();
  }

  function scrollToActive(container) {
    var active = container.querySelector('.cmd-palette__result--active');
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ---- Close ---- */
  function close() {
    if (!_overlay) return;
    if (_overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = null;
    _activeIndex = -1;
    document.body.style.overflow = '';
  }

  function isOpen() {
    return !!_overlay;
  }

  /* ---- Expose API ---- */
  MSM.CommandPalette = {
    open: open,
    close: close,
    isOpen: isOpen
  };
})();
