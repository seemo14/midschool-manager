/**
 * MidSchool Manager - Application Bootstrap Module
 * Runs on every page. Handles initialization, navigation, welcome flow, and layout.
 * Depends on: MSM.Storage, MSM.UI
 */
(function () {
    'use strict';

    window.MSM = window.MSM || {};

    /* ------------------------------------------------------------------ */
    /*  Constants                                                          */
    /* ------------------------------------------------------------------ */

    var PAGE_NAV_MAP = {
        'index.html':       'Dashboard',
        'lessons.html':     'Lessons',
        'materials.html':   'Materials',
        'plans.html':       'Plans',
        'calendar.html':    'Calendar',
        'students.html':    'Students',
        'assessments.html': 'Assessments',
        'remedial.html':    'Remedial',
        'settings.html':    'Settings'
    };

    var DEFAULT_CLASSES = [
        '1AC-1', '1AC-2', '1AC-3', '1AC-4', '1AC-5',
        '2AC-1', '2AC-2', '2AC-3', '2AC-4',
        '3AC-1', '3AC-2', '3AC-3', '3AC-4'
    ];

    var CLASS_COLORS = [
        '#4F46E5', '#0891B2', '#7C3AED', '#DB2777', '#EA580C',
        '#059669', '#0D9488', '#CA8A04', '#6366F1',
        '#DC2626', '#65A30D', '#9333EA', '#E11D48'
    ];

    var SIDEBAR_COLLAPSED_KEY = 'msm_sidebar_collapsed';
    var DARK_MODE_KEY = 'msm_dark_mode';
    var LAST_BACKUP_KEY = 'msm_last_backup';
    var BACKUP_REMINDER_DAYS = 14; // Remind every 2 weeks

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * Return the current page filename, falling back to 'index.html'.
     */
    function getCurrentPageFilename() {
        var path = window.location.pathname;
        var filename = path.substring(path.lastIndexOf('/') + 1);
        return filename || 'index.html';
    }

    /* ------------------------------------------------------------------ */
    /*  Public API                                                         */
    /* ------------------------------------------------------------------ */

    var App = {

        /* ----- init -------------------------------------------------- */

        /**
         * Called on DOMContentLoaded. Bootstraps the entire application.
         */
        init: function () {
            // a. First-run check
            var settings = localStorage.getItem('msm_settings');
            if (!settings) {
                if (MSM.Storage && typeof MSM.Storage.initDefaults === 'function') {
                    MSM.Storage.initDefaults();
                }
                App.showWelcomeModal();
            }

            // b. Load settings and populate header
            App.updateHeader();

            // c. Highlight active sidebar nav item
            App.highlightActiveNav();

            // d. Set up hamburger menu toggle for mobile
            App.setupHamburger();

            // e. Global keyboard shortcuts
            App.setupKeyboardShortcuts();

            // f. Sidebar collapse / expand behavior
            App.setupSidebarCollapse();

            // g. Dark mode
            App.initDarkMode();

            // h. Auto-backup reminder
            App.checkBackupReminder();

            // i. Register service worker for PWA
            App.registerServiceWorker();

            // j. Offline/online status indicator
            App.setupOfflineIndicator();
        },

        /* ----- showWelcomeModal -------------------------------------- */

        /**
         * Multi-step welcome flow for first-time users.
         *   Step 1 - Teacher Name + School Name
         *   Step 2 - Pre-configured classes overview
         *   Step 3 - Upload prompt (can skip)
         */
        showWelcomeModal: function () {
            var currentStep = 1;
            var totalSteps = 3;

            // ----- Build modal content --------------------------------

            var wrapper = document.createElement('div');
            wrapper.className = 'msm-welcome-wrapper';

            // ---- Step 1 ----
            var step1 = document.createElement('div');
            step1.className = 'msm-welcome-step msm-welcome-step--active';
            step1.setAttribute('data-step', '1');
            step1.innerHTML =
                '<h2 class="msm-welcome-title">Welcome to MidSchool Manager!</h2>' +
                '<p class="msm-welcome-text">Let\'s get you set up. Please enter your details below.</p>' +
                '<div class="msm-welcome-field">' +
                    '<label for="msm-welcome-teacher">Teacher Name</label>' +
                    '<input type="text" id="msm-welcome-teacher" placeholder="e.g. Mr. Smith" autocomplete="off" />' +
                '</div>' +
                '<div class="msm-welcome-field">' +
                    '<label for="msm-welcome-school">School Name</label>' +
                    '<input type="text" id="msm-welcome-school" placeholder="e.g. Al-Farabi Middle School" autocomplete="off" />' +
                '</div>';

            // ---- Step 2 ----
            var step2 = document.createElement('div');
            step2.className = 'msm-welcome-step';
            step2.setAttribute('data-step', '2');

            var chipsHtml = '';
            for (var i = 0; i < DEFAULT_CLASSES.length; i++) {
                var color = CLASS_COLORS[i] || '#888';
                chipsHtml +=
                    '<span class="msm-class-chip" style="background:' + color + ';">' +
                        DEFAULT_CLASSES[i] +
                    '</span>';
            }

            step2.innerHTML =
                '<h2 class="msm-welcome-title">Your classes are pre-configured:</h2>' +
                '<div class="msm-class-chips">' + chipsHtml + '</div>' +
                '<p class="msm-welcome-text msm-welcome-hint">You can customize these in Settings.</p>';

            // ---- Step 3 ----
            var step3 = document.createElement('div');
            step3.className = 'msm-welcome-step';
            step3.setAttribute('data-step', '3');
            step3.innerHTML =
                '<h2 class="msm-welcome-title">Upload your student lists</h2>' +
                '<p class="msm-welcome-text">' +
                    'Go to the <strong>Students</strong> page to upload CSV files for each class. ' +
                    'You can do this now or later.' +
                '</p>';

            wrapper.appendChild(step1);
            wrapper.appendChild(step2);
            wrapper.appendChild(step3);

            // ---- Footer / navigation ----
            var footer = document.createElement('div');
            footer.className = 'msm-welcome-footer';

            var stepsIndicator = document.createElement('span');
            stepsIndicator.className = 'msm-welcome-steps-indicator';
            stepsIndicator.textContent = 'Step 1 of 3';

            var btnNext = document.createElement('button');
            btnNext.className = 'msm-btn msm-btn--primary msm-welcome-btn-next';
            btnNext.textContent = 'Next';

            var btnSkip = document.createElement('button');
            btnSkip.className = 'msm-btn msm-btn--secondary msm-welcome-btn-skip';
            btnSkip.textContent = 'Skip';
            btnSkip.style.display = 'none';

            footer.appendChild(stepsIndicator);
            footer.appendChild(btnSkip);
            footer.appendChild(btnNext);
            wrapper.appendChild(footer);

            // ---- Helpers for step navigation ----

            function showStep(n) {
                var steps = wrapper.querySelectorAll('.msm-welcome-step');
                for (var j = 0; j < steps.length; j++) {
                    if (parseInt(steps[j].getAttribute('data-step'), 10) === n) {
                        steps[j].className = 'msm-welcome-step msm-welcome-step--active';
                    } else {
                        steps[j].className = 'msm-welcome-step';
                    }
                }
                stepsIndicator.textContent = 'Step ' + n + ' of ' + totalSteps;

                if (n === totalSteps) {
                    btnNext.style.display = 'none';
                    btnSkip.style.display = '';
                    btnSkip.textContent = 'Done';
                } else {
                    btnNext.style.display = '';
                    btnSkip.style.display = 'none';
                }
            }

            function saveStep1() {
                var teacherInput = document.getElementById('msm-welcome-teacher');
                var schoolInput = document.getElementById('msm-welcome-school');
                var teacherName = teacherInput ? teacherInput.value.trim() : '';
                var schoolName = schoolInput ? schoolInput.value.trim() : '';

                if (MSM.Storage && typeof MSM.Storage.getSettings === 'function') {
                    var settings = MSM.Storage.getData('msm_settings');
                    if (teacherName) { settings.teacherName = teacherName; }
                    if (schoolName) { settings.schoolName = schoolName; }
                    MSM.Storage.setData('msm_settings', settings);
                } else {
                    // Fallback: write directly to localStorage
                    var raw = localStorage.getItem('msm_settings');
                    var obj;
                    try { obj = JSON.parse(raw) || {}; } catch (e) { obj = {}; }
                    if (teacherName) { obj.teacherName = teacherName; }
                    if (schoolName) { obj.schoolName = schoolName; }
                    localStorage.setItem('msm_settings', JSON.stringify(obj));
                }

                // Refresh header to show the new name
                App.updateHeader();
            }

            function closeWelcome() {
                if (MSM.UI && typeof MSM.UI.closeModal === 'function') {
                    MSM.UI.closeModal();
                } else {
                    // Fallback: remove the modal overlay if it exists
                    var overlay = document.querySelector('.msm-modal-overlay');
                    if (overlay) { overlay.parentNode.removeChild(overlay); }
                }
            }

            // ---- Event listeners ----

            btnNext.addEventListener('click', function () {
                if (currentStep === 1) {
                    saveStep1();
                }
                if (currentStep < totalSteps) {
                    currentStep++;
                    showStep(currentStep);
                }
            });

            btnSkip.addEventListener('click', function () {
                closeWelcome();
            });

            // ---- Show modal via MSM.UI ----

            if (MSM.UI && typeof MSM.UI.showModal === 'function') {
                MSM.UI.showModal({
                    title: '',
                    content: wrapper,
                    showClose: false,
                    cssClass: 'msm-welcome-modal'
                });
            } else {
                // Minimal fallback if MSM.UI is not yet available
                var overlay = document.createElement('div');
                overlay.className = 'msm-modal-overlay msm-welcome-modal';
                overlay.style.cssText =
                    'position:fixed;top:0;left:0;width:100%;height:100%;' +
                    'background:rgba(0,0,0,0.5);display:flex;align-items:center;' +
                    'justify-content:center;z-index:9999;';

                var dialog = document.createElement('div');
                dialog.className = 'msm-modal-dialog';
                dialog.style.cssText =
                    'background:#fff;border-radius:12px;padding:32px;' +
                    'max-width:480px;width:90%;max-height:90vh;overflow-y:auto;';

                dialog.appendChild(wrapper);
                overlay.appendChild(dialog);
                document.body.appendChild(overlay);
            }
        },

        /* ----- highlightActiveNav ------------------------------------ */

        /**
         * Adds 'active' class to the sidebar link that matches the current page.
         */
        highlightActiveNav: function () {
            var filename = getCurrentPageFilename();
            var navLinks = document.querySelectorAll('.msm-sidebar a, .msm-sidebar .nav-link, [data-nav]');

            for (var i = 0; i < navLinks.length; i++) {
                var link = navLinks[i];
                var href = link.getAttribute('href') || '';
                var linkFilename = href.substring(href.lastIndexOf('/') + 1);

                // Remove any existing active class
                link.classList.remove('active');
                if (link.parentElement) {
                    link.parentElement.classList.remove('active');
                }

                // Match current page
                if (linkFilename === filename) {
                    link.classList.add('active');
                    if (link.parentElement) {
                        link.parentElement.classList.add('active');
                    }
                }
            }
        },

        /* ----- setupHamburger ---------------------------------------- */

        /**
         * Mobile hamburger menu: toggles sidebar visibility.
         */
        setupHamburger: function () {
            var hamburger = document.querySelector('.msm-hamburger, .hamburger-btn, [data-hamburger]');
            var backdrop = document.querySelector('.msm-sidebar-backdrop, .sidebar-backdrop');

            if (hamburger) {
                hamburger.addEventListener('click', function () {
                    document.body.classList.toggle('sidebar-open');
                });
            }

            if (backdrop) {
                backdrop.addEventListener('click', function () {
                    document.body.classList.remove('sidebar-open');
                });
            }

            // Also close sidebar when clicking outside on mobile
            document.addEventListener('click', function (e) {
                if (!document.body.classList.contains('sidebar-open')) { return; }

                var sidebar = document.querySelector('.msm-sidebar, .sidebar');
                var isInsideSidebar = sidebar && sidebar.contains(e.target);
                var isHamburger = hamburger && hamburger.contains(e.target);

                if (!isInsideSidebar && !isHamburger) {
                    document.body.classList.remove('sidebar-open');
                }
            });
        },

        /* ----- setupKeyboardShortcuts -------------------------------- */

        /**
         * Global keyboard shortcuts:
         *   Escape       - Close modals / sidebar
         *   Alt+1..9     - Navigate to pages
         *   Alt+Shift+?  - Show shortcuts help
         */
        setupKeyboardShortcuts: function () {
            var NAV_SHORTCUTS = {
                '1': 'index.html',
                '2': 'lessons.html',
                '3': 'materials.html',
                '4': 'plans.html',
                '5': 'calendar.html',
                '6': 'students.html',
                '7': 'assessments.html',
                '8': 'remedial.html',
                '9': 'settings.html'
            };

            document.addEventListener('keydown', function (e) {
                var tag = e.target.tagName;
                var isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable);

                if (e.key === 'Escape' || e.keyCode === 27) {
                    if (MSM.UI && typeof MSM.UI.closeModal === 'function') {
                        MSM.UI.closeModal();
                    } else {
                        var overlays = document.querySelectorAll('.msm-modal-overlay');
                        if (overlays.length > 0) {
                            var last = overlays[overlays.length - 1];
                            last.parentNode.removeChild(last);
                        }
                    }
                    document.body.classList.remove('sidebar-open');
                    return;
                }

                // Alt+number quick navigation
                if (e.altKey && !e.ctrlKey && !e.metaKey && !isInput) {
                    var page = NAV_SHORTCUTS[e.key];
                    if (page) {
                        e.preventDefault();
                        window.location.href = page;
                        return;
                    }
                }

                // Alt+Shift+/ — keyboard shortcuts help
                if (e.altKey && e.shiftKey && (e.key === '?' || e.key === '/')) {
                    e.preventDefault();
                    App.showShortcutsHelp();
                }
            });
        },

        /**
         * Display a modal listing all keyboard shortcuts.
         */
        showShortcutsHelp: function () {
            var shortcuts = [
                { key: 'Esc', desc: 'Close modal / sidebar' },
                { key: 'Alt+1', desc: 'Go to Dashboard' },
                { key: 'Alt+2', desc: 'Go to Lesson Records' },
                { key: 'Alt+3', desc: 'Go to Materials' },
                { key: 'Alt+4', desc: 'Go to Lesson Plans' },
                { key: 'Alt+5', desc: 'Go to Calendar' },
                { key: 'Alt+6', desc: 'Go to Students' },
                { key: 'Alt+7', desc: 'Go to Assessments' },
                { key: 'Alt+8', desc: 'Go to Remedial Work' },
                { key: 'Alt+9', desc: 'Go to Settings' },
                { key: 'Alt+Shift+?', desc: 'Show this help' }
            ];

            var html = '<div class="shortcuts-panel">';
            for (var i = 0; i < shortcuts.length; i++) {
                html += '<kbd>' + shortcuts[i].key + '</kbd>';
                html += '<span class="shortcuts-panel__desc">' + shortcuts[i].desc + '</span>';
            }
            html += '</div>';

            var container = document.createElement('div');
            container.innerHTML = html;

            if (MSM.UI && typeof MSM.UI.showModal === 'function') {
                MSM.UI.showModal({
                    title: 'Keyboard Shortcuts',
                    content: container,
                    showClose: true
                });
            }
        },

        /* ----- setupSidebarCollapse ---------------------------------- */

        /**
         * Sidebar collapse/expand behavior for tablet viewports.
         * Saves preference in localStorage.
         */
        setupSidebarCollapse: function () {
            var collapseBtn = document.querySelector(
                '.msm-sidebar-collapse, .sidebar-collapse-btn, [data-sidebar-collapse]'
            );

            // Restore saved preference
            var isCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
            if (isCollapsed) {
                document.body.classList.add('sidebar-collapsed');
            }

            if (collapseBtn) {
                collapseBtn.addEventListener('click', function () {
                    var nowCollapsed = document.body.classList.toggle('sidebar-collapsed');
                    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, nowCollapsed ? 'true' : 'false');
                });
            }
        },

        /* ----- initDarkMode ------------------------------------------ */

        /**
         * Initialize dark mode from saved preference and inject toggle into sidebar.
         */
        initDarkMode: function () {
            var isDark = localStorage.getItem(DARK_MODE_KEY) === 'true';
            if (isDark) {
                document.documentElement.setAttribute('data-theme', 'dark');
            }

            // Inject toggle into sidebar footer (before settings link)
            var sidebarFooter = document.querySelector('.sidebar__footer');
            if (sidebarFooter) {
                var toggle = document.createElement('div');
                toggle.className = 'dark-mode-toggle';
                toggle.innerHTML = '<span class="dark-mode-toggle__icon">' + (isDark ? '☀️' : '🌙') + '</span>' +
                    '<span class="sidebar__label">' + (isDark ? 'Light Mode' : 'Dark Mode') + '</span>';

                toggle.addEventListener('click', function () {
                    var currentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
                    if (currentlyDark) {
                        document.documentElement.removeAttribute('data-theme');
                        localStorage.setItem(DARK_MODE_KEY, 'false');
                        toggle.innerHTML = '<span class="dark-mode-toggle__icon">🌙</span>' +
                            '<span class="sidebar__label">Dark Mode</span>';
                    } else {
                        document.documentElement.setAttribute('data-theme', 'dark');
                        localStorage.setItem(DARK_MODE_KEY, 'true');
                        toggle.innerHTML = '<span class="dark-mode-toggle__icon">☀️</span>' +
                            '<span class="sidebar__label">Light Mode</span>';
                    }
                });

                sidebarFooter.insertBefore(toggle, sidebarFooter.firstChild);
            }
        },

        /* ----- checkBackupReminder ----------------------------------- */

        /**
         * Show a toast reminder if the user hasn't exported a backup recently.
         */
        checkBackupReminder: function () {
            var lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
            var now = Date.now();

            // If never backed up, set the initial timestamp and skip this time
            if (!lastBackup) {
                localStorage.setItem(LAST_BACKUP_KEY, String(now));
                return;
            }

            var daysSince = Math.floor((now - parseInt(lastBackup, 10)) / (1000 * 60 * 60 * 24));
            if (daysSince >= BACKUP_REMINDER_DAYS) {
                // Only show on dashboard
                if (getCurrentPageFilename() === 'index.html' || getCurrentPageFilename() === '') {
                    setTimeout(function () {
                        if (MSM.UI && MSM.UI.showToast) {
                            MSM.UI.showToast(
                                'It\'s been ' + daysSince + ' days since your last backup. Go to Settings to export your data.',
                                'warning'
                            );
                        }
                    }, 2000);
                }
            }
        },

        /**
         * Mark that a backup was just exported (call from settings page).
         */
        markBackupDone: function () {
            localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
        },

        /* ----- registerServiceWorker --------------------------------- */

        /**
         * Register the PWA service worker if supported.
         */
        registerServiceWorker: function () {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js').then(function () {
                    console.log('[MSM] Service Worker registered');
                }).catch(function (err) {
                    console.log('[MSM] Service Worker registration failed:', err);
                });
            }
        },

        /* ----- getPageTitle ------------------------------------------ */

        /**
         * Returns the display title for the current page.
         * @returns {string}
         */
        getPageTitle: function () {
            var filename = getCurrentPageFilename();
            return PAGE_NAV_MAP[filename] || 'MidSchool Manager';
        },

        /* ----- updateHeader ------------------------------------------ */

        /**
         * Populates the page header: app name on the left, teacher name
         * and academic year on the right.
         */
        updateHeader: function () {
            var settings;

            if (MSM.Storage && typeof MSM.Storage.getSettings === 'function') {
                settings = MSM.Storage.getData('msm_settings');
            } else {
                try {
                    settings = JSON.parse(localStorage.getItem('msm_settings')) || {};
                } catch (e) {
                    settings = {};
                }
            }

            var teacherName = settings.teacherName || '';
            var academicYear = settings.academicYear || App.getCurrentAcademicYear();

            // Left side: app name / page title
            var headerTitle = document.querySelector(
                '.msm-header-title, .header-title, [data-header-title]'
            );
            if (headerTitle) {
                headerTitle.textContent = App.getPageTitle();
            }

            // Right side: teacher name + academic year
            var headerInfo = document.querySelector(
                '.msm-header-info, .header-info, [data-header-info]'
            );
            if (headerInfo) {
                var parts = [];
                if (teacherName) { parts.push(teacherName); }
                if (academicYear) { parts.push(academicYear); }
                headerInfo.textContent = parts.join(' | ');
            }
        },

        /* ----- getCurrentAcademicYear -------------------------------- */

        /* ----- setupOfflineIndicator -------------------------------- */

        /**
         * Monitor online/offline status and show/hide the indicator bar.
         */
        setupOfflineIndicator: function () {
            var indicator = document.getElementById('offlineIndicator');
            if (!indicator) return;

            function updateStatus() {
                if (navigator.onLine) {
                    indicator.classList.remove('offline-indicator--visible');
                } else {
                    indicator.classList.add('offline-indicator--visible');
                }
            }

            window.addEventListener('online', updateStatus);
            window.addEventListener('offline', updateStatus);

            // Check initial state
            updateStatus();
        },

        /* ----- getCurrentAcademicYear -------------------------------- */

        /**
         * Derives the current academic year string, e.g. "2025/2026".
         * Academic year starts in September.
         * @returns {string}
         */
        getCurrentAcademicYear: function () {
            var now = new Date();
            var year = now.getFullYear();
            var month = now.getMonth(); // 0-indexed, 0 = January
            // If we are in Jan-Aug, the academic year started the previous calendar year
            if (month < 8) { // before September
                return (year - 1) + '/' + year;
            }
            return year + '/' + (year + 1);
        }
    };

    /* ------------------------------------------------------------------ */
    /*  Expose on namespace                                                */
    /* ------------------------------------------------------------------ */

    window.MSM.App = App;

    /* ------------------------------------------------------------------ */
    /*  Bootstrap on DOMContentLoaded                                      */
    /* ------------------------------------------------------------------ */

    document.addEventListener('DOMContentLoaded', function () {
        App.init();
    });

})();
