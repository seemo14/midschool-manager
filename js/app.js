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

            // j. Bottom navigation (mobile)
            App.setupBottomNav();

            // k. Breadcrumbs
            App.setupBreadcrumbs();

            // l. Mobile back button
            App.setupMobileBackButton();

            // m. Header search button
            App.setupHeaderSearch();
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
         * Highlights the topnav and mobile-menu links matching the current page.
         */
        highlightActiveNav: function () {
            var filename = getCurrentPageFilename();

            // Top nav links
            var topnavLinks = document.querySelectorAll('.topnav__link[data-nav]');
            for (var i = 0; i < topnavLinks.length; i++) {
                var link = topnavLinks[i];
                var nav = link.getAttribute('data-nav') || '';
                link.classList.remove('topnav__link--active');
                if (nav === filename) {
                    link.classList.add('topnav__link--active');
                }
            }

            // Settings action button
            var settingsBtn = document.querySelector('.topnav__action-btn[data-nav="settings.html"]');
            if (settingsBtn) {
                if (filename === 'settings.html') {
                    settingsBtn.classList.add('topnav__action-btn--active');
                } else {
                    settingsBtn.classList.remove('topnav__action-btn--active');
                }
            }

            // Mobile menu links
            var mobileLinks = document.querySelectorAll('.mobile-menu__link[data-nav]');
            for (var j = 0; j < mobileLinks.length; j++) {
                var mLink = mobileLinks[j];
                var mNav = mLink.getAttribute('data-nav') || '';
                mLink.classList.remove('mobile-menu__link--active');
                if (mNav === filename) {
                    mLink.classList.add('mobile-menu__link--active');
                }
            }
        },

        /* ----- setupHamburger ---------------------------------------- */

        /**
         * Mobile hamburger: toggles the top-nav dropdown menu.
         */
        setupHamburger: function () {
            var hamburger = document.getElementById('hamburgerBtn');
            var mobileMenu = document.getElementById('mobileMenu');
            var backdrop = document.getElementById('mobileMenuBackdrop');

            function openMenu() {
                document.body.classList.add('topnav-open');
                if (mobileMenu) {
                    mobileMenu.classList.add('mobile-menu--open');
                    mobileMenu.setAttribute('aria-hidden', 'false');
                }
                if (backdrop) { backdrop.classList.add('mobile-menu-backdrop--visible'); }
                if (hamburger) { hamburger.setAttribute('aria-expanded', 'true'); }
            }

            function closeMenu() {
                document.body.classList.remove('topnav-open');
                if (mobileMenu) {
                    mobileMenu.classList.remove('mobile-menu--open');
                    mobileMenu.setAttribute('aria-hidden', 'true');
                }
                if (backdrop) { backdrop.classList.remove('mobile-menu-backdrop--visible'); }
                if (hamburger) { hamburger.setAttribute('aria-expanded', 'false'); }
            }

            if (hamburger) {
                hamburger.addEventListener('click', function () {
                    var isOpen = document.body.classList.contains('topnav-open');
                    if (isOpen) { closeMenu(); } else { openMenu(); }
                });
            }

            if (backdrop) {
                backdrop.addEventListener('click', closeMenu);
            }

            // Close menu on Escape key (handled in setupKeyboardShortcuts too)
            document.addEventListener('keydown', function (e) {
                if ((e.key === 'Escape' || e.keyCode === 27) && document.body.classList.contains('topnav-open')) {
                    closeMenu();
                }
            });
        },

        /* ----- setupKeyboardShortcuts -------------------------------- */

        /**
         * Global keyboard shortcuts: Escape closes modals.
         */
        setupKeyboardShortcuts: function () {
            document.addEventListener('keydown', function (e) {
                // Ctrl+K / Cmd+K opens command palette
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    if (MSM.CommandPalette) { MSM.CommandPalette.open(); }
                    return;
                }

                if (e.key === 'Escape' || e.keyCode === 27) {
                    // Close command palette first if open
                    if (MSM.CommandPalette && MSM.CommandPalette.isOpen && MSM.CommandPalette.isOpen()) {
                        MSM.CommandPalette.close();
                        return;
                    }
                    // Close sidepanel if open
                    if (MSM.Sidepanel && MSM.Sidepanel.isOpen && MSM.Sidepanel.isOpen()) {
                        MSM.Sidepanel.close();
                        return;
                    }
                    if (MSM.UI && typeof MSM.UI.closeModal === 'function') {
                        MSM.UI.closeModal();
                    } else {
                        var overlays = document.querySelectorAll('.msm-modal-overlay');
                        if (overlays.length > 0) {
                            var last = overlays[overlays.length - 1];
                            last.parentNode.removeChild(last);
                        }
                    }
                    // Close mobile menu if open
                    document.body.classList.remove('topnav-open');
                    var mMenu = document.getElementById('mobileMenu');
                    if (mMenu) { mMenu.classList.remove('mobile-menu--open'); mMenu.setAttribute('aria-hidden', 'true'); }
                    var mBackdrop = document.getElementById('mobileMenuBackdrop');
                    if (mBackdrop) { mBackdrop.classList.remove('mobile-menu-backdrop--visible'); }
                    var hBtn = document.getElementById('hamburgerBtn');
                    if (hBtn) { hBtn.setAttribute('aria-expanded', 'false'); }
                }
            });
        },

        /* ----- setupSidebarCollapse ---------------------------------- */

        /**
         * No-op: sidebar has been replaced by the top navigation bar.
         */
        setupSidebarCollapse: function () {
            // Sidebar removed – no-op retained for API compatibility.
        },

        /* ----- initDarkMode ------------------------------------------ */

        /**
         * Initialize dark mode from saved preference and inject toggle into topnav actions.
         */
        initDarkMode: function () {
            var isDark = localStorage.getItem(DARK_MODE_KEY) === 'true';
            if (isDark) {
                document.documentElement.setAttribute('data-theme', 'dark');
            }

            // Inject toggle button into .topnav__actions (before the search button)
            var topnavActions = document.querySelector('.topnav__actions');
            if (topnavActions) {
                var toggle = document.createElement('button');
                toggle.className = 'dark-mode-toggle topnav__action-btn';
                toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
                toggle.innerHTML = '<span class="dark-mode-toggle__icon">' + (isDark ? '☀️' : '🌙') + '</span>';

                toggle.addEventListener('click', function () {
                    var currentlyDark = document.documentElement.getAttribute('data-theme') === 'dark';
                    if (currentlyDark) {
                        document.documentElement.removeAttribute('data-theme');
                        localStorage.setItem(DARK_MODE_KEY, 'false');
                        toggle.innerHTML = '<span class="dark-mode-toggle__icon">🌙</span>';
                        toggle.setAttribute('aria-label', 'Switch to dark mode');
                    } else {
                        document.documentElement.setAttribute('data-theme', 'dark');
                        localStorage.setItem(DARK_MODE_KEY, 'true');
                        toggle.innerHTML = '<span class="dark-mode-toggle__icon">☀️</span>';
                        toggle.setAttribute('aria-label', 'Switch to light mode');
                    }
                });

                // Insert before the search button (first child of actions)
                topnavActions.insertBefore(toggle, topnavActions.firstChild);
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

        /* ----- setupBottomNav ---------------------------------------- */

        setupBottomNav: function () {
            var bottomNav = document.getElementById('bottomNav');
            if (!bottomNav) return;

            // Highlight active item
            var filename = getCurrentPageFilename();
            var items = bottomNav.querySelectorAll('.bottom-nav__item[data-nav]');
            for (var i = 0; i < items.length; i++) {
                if (items[i].getAttribute('data-nav') === filename) {
                    items[i].classList.add('bottom-nav__item--active');
                }
            }

            // "More" button opens bottom sheet
            var moreBtn = document.getElementById('bottomNavMore');
            if (moreBtn) {
                moreBtn.addEventListener('click', function () {
                    App.showBottomSheet();
                });
            }
        },

        showBottomSheet: function () {
            // Remove existing sheet
            var existing = document.querySelector('.bottom-sheet-backdrop');
            if (existing) { existing.parentNode.removeChild(existing); var s = document.querySelector('.bottom-sheet'); if (s) s.parentNode.removeChild(s); return; }

            var moreLinks = [
                { href: 'plans.html', icon: '✏️', label: 'Lesson Plans' },
                { href: 'materials.html', icon: '📄', label: 'Materials' },
                { href: 'calendar.html', icon: '📅', label: 'Calendar' },
                { href: 'remedial.html', icon: '⚠️', label: 'Remedial Work' },
                { href: 'settings.html', icon: '⚙️', label: 'Settings' }
            ];

            var backdrop = document.createElement('div');
            backdrop.className = 'bottom-sheet-backdrop';

            var sheet = document.createElement('div');
            sheet.className = 'bottom-sheet';

            var handle = document.createElement('div');
            handle.className = 'bottom-sheet__handle';
            sheet.appendChild(handle);

            for (var i = 0; i < moreLinks.length; i++) {
                var link = moreLinks[i];
                var a = document.createElement('a');
                a.className = 'bottom-sheet__item';
                a.href = link.href;
                a.innerHTML = '<span class="bottom-sheet__icon">' + link.icon + '</span>' + link.label;
                sheet.appendChild(a);
            }

            function closeSheet() {
                if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
                if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
            }

            backdrop.addEventListener('click', closeSheet);
            document.body.appendChild(backdrop);
            document.body.appendChild(sheet);
        },

        /* ----- setupBreadcrumbs -------------------------------------- */

        setupBreadcrumbs: function () {
            var breadcrumbEl = document.getElementById('breadcrumbs');
            if (!breadcrumbEl) return;

            var filename = getCurrentPageFilename();
            var crumbs = [{ label: 'Home', href: 'index.html' }];

            if (filename !== 'index.html' && filename !== '') {
                var pageTitle = PAGE_NAV_MAP[filename] || filename;
                crumbs.push({ label: pageTitle, href: filename });
            }

            // Check for sub-context (e.g. ?class=cls_001)
            var params = new URLSearchParams(window.location.search);
            var classId = params.get('class') || params.get('classId');
            if (classId && MSM.Storage) {
                var classes = MSM.Storage.getData('msm_classes') || [];
                for (var i = 0; i < classes.length; i++) {
                    if (classes[i].id === classId) {
                        crumbs.push({ label: classes[i].name || classId });
                        break;
                    }
                }
            }

            var html = '';
            for (var j = 0; j < crumbs.length; j++) {
                if (j > 0) html += '<span class="breadcrumb__sep">/</span>';
                if (j === crumbs.length - 1) {
                    html += '<span class="breadcrumb__current">' + (MSM.UI ? MSM.UI.escapeHTML(crumbs[j].label) : crumbs[j].label) + '</span>';
                } else {
                    html += '<a href="' + crumbs[j].href + '" class="breadcrumb__link">' + (MSM.UI ? MSM.UI.escapeHTML(crumbs[j].label) : crumbs[j].label) + '</a>';
                }
            }
            breadcrumbEl.innerHTML = html;
        },

        /* ----- setupMobileBackButton --------------------------------- */

        setupMobileBackButton: function () {
            if (window.innerWidth > 767) return;
            var headerTitle = document.querySelector('[data-header-title]');
            if (!headerTitle) return;

            var filename = getCurrentPageFilename();
            if (filename === 'index.html' || filename === '') return;

            var backBtn = document.createElement('button');
            backBtn.className = 'header__back-btn';
            backBtn.setAttribute('aria-label', 'Go back');
            backBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
            backBtn.addEventListener('click', function () {
                if (document.referrer && document.referrer.indexOf(window.location.host) !== -1) {
                    window.history.back();
                } else {
                    window.location.href = 'index.html';
                }
            });

            headerTitle.parentNode.insertBefore(backBtn, headerTitle);
        },

        /* ----- setupHeaderSearch ------------------------------------- */

        setupHeaderSearch: function () {
            var searchBtn = document.getElementById('headerSearchBtn');
            if (searchBtn) {
                searchBtn.addEventListener('click', function () {
                    if (MSM.CommandPalette) { MSM.CommandPalette.open(); }
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

            // Teacher info pill in topnav (data-header-info attribute)
            var headerInfo = document.querySelector(
                '.topnav__teacher-info, [data-header-info]'
            );
            if (headerInfo) {
                var parts = [];
                if (teacherName) { parts.push(teacherName); }
                if (academicYear) { parts.push(academicYear); }
                headerInfo.textContent = parts.join(' | ');
            }
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
