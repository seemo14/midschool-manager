/**
 * MidSchool Manager – Timetable Page
 *
 * Lets the teacher upload a timetable image (PNG/JPG/WebP/GIF) or an HTML
 * file and displays it full-width. Content is stored in IndexedDB via
 * MSM.FileStore; metadata is kept in localStorage under 'msm_timetable'.
 *
 * Attaches to: nothing global (self-contained DOMContentLoaded).
 */
(function () {
    'use strict';

    var META_KEY   = 'msm_timetable';   // localStorage key for metadata
    var STORE_ID   = 'tt_timetable';    // fixed IndexedDB ID (single timetable)

    document.addEventListener('DOMContentLoaded', function () {
        var FS = MSM.FileStore;
        var UI = MSM.UI;

        // ── DOM refs ─────────────────────────────────────────────────────────
        var uploadArea    = document.getElementById('ttUploadArea');
        var viewerArea    = document.getElementById('ttViewer');
        var ttActions     = document.getElementById('ttActions');
        var viewerBox     = document.getElementById('ttViewerBox');
        var ttFileName    = document.getElementById('ttFileName');
        var ttFileMeta    = document.getElementById('ttFileMeta');
        var fileInput     = document.getElementById('fileInput');
        var fileInputRepl = document.getElementById('fileInputReplace');
        var dropZone      = document.getElementById('dropZone');
        var lightbox      = document.getElementById('ttLightbox');
        var lightboxImg   = document.getElementById('ttLightboxImg');
        var lightboxClose = document.getElementById('ttLightboxClose');

        // ── Load saved timetable on init ─────────────────────────────────────
        loadTimetable();

        // ── File pickers ──────────────────────────────────────────────────────
        fileInput.addEventListener('change', function () {
            if (this.files[0]) handleFile(this.files[0]);
            this.value = '';
        });
        fileInputRepl.addEventListener('change', function () {
            if (this.files[0]) handleFile(this.files[0]);
            this.value = '';
        });

        // ── Drag & drop ───────────────────────────────────────────────────────
        dropZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropZone.classList.add('tt-drop-zone--over');
        });
        dropZone.addEventListener('dragleave', function () {
            dropZone.classList.remove('tt-drop-zone--over');
        });
        dropZone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropZone.classList.remove('tt-drop-zone--over');
            var f = e.dataTransfer.files[0];
            if (f) handleFile(f);
        });

        // ── Toolbar actions ───────────────────────────────────────────────────
        document.getElementById('btnTtFullscreen').addEventListener('click', openFullscreen);
        document.getElementById('btnTtPrint').addEventListener('click', printTimetable);
        document.getElementById('btnTtDelete').addEventListener('click', deleteTimetable);

        // ── Lightbox ──────────────────────────────────────────────────────────
        lightboxClose.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', function (e) {
            if ((e.key === 'Escape' || e.keyCode === 27) && lightbox.classList.contains('tt-lightbox--open')) {
                closeLightbox();
            }
        });

        // =====================================================================
        // CORE FUNCTIONS
        // =====================================================================

        function handleFile(file) {
            var isImage = file.type.startsWith('image/');
            var isHtml  = /\.(html|htm)$/i.test(file.name) || file.type === 'text/html';

            if (!isImage && !isHtml) {
                UI.showToast('Unsupported file type. Use an image (PNG, JPG, WebP, GIF) or an HTML file.', 'error');
                return;
            }

            var reader = new FileReader();

            if (isImage) {
                reader.onload = function (e) {
                    var dataUrl = e.target.result;
                    saveTimetable(dataUrl, file.name, 'image', file.size);
                };
                reader.readAsDataURL(file);
            } else {
                reader.onload = function (e) {
                    saveTimetable(e.target.result, file.name, 'html', file.size);
                };
                reader.readAsText(file, 'UTF-8');
            }
        }

        function saveTimetable(content, name, type, size) {
            FS.save(STORE_ID, content).then(function () {
                var meta = { id: STORE_ID, name: name, type: type, size: size, savedAt: new Date().toISOString() };
                localStorage.setItem(META_KEY, JSON.stringify(meta));
                UI.showToast('Timetable saved!', 'success');
                showTimetable(meta, content);
            }).catch(function (err) {
                console.error('[Timetable] save error:', err);
                UI.showToast('Could not save: ' + (err.message || 'unknown error'), 'error');
            });
        }

        function loadTimetable() {
            var raw = localStorage.getItem(META_KEY);
            if (!raw) { showEmpty(); return; }
            var meta;
            try { meta = JSON.parse(raw); } catch (e) { showEmpty(); return; }

            FS.get(STORE_ID).then(function (content) {
                if (!content) { showEmpty(); return; }
                showTimetable(meta, content);
            }).catch(function () { showEmpty(); });
        }

        function showEmpty() {
            uploadArea.style.display = '';
            viewerArea.style.display  = 'none';
            ttActions.style.display   = 'none';
        }

        function showTimetable(meta, content) {
            uploadArea.style.display = 'none';
            viewerArea.style.display  = '';
            ttActions.style.display   = '';

            // Populate info
            ttFileName.textContent = meta.name || 'Timetable';
            var kb = meta.size ? Math.round(meta.size / 1024) + ' KB · ' : '';
            var dt = meta.savedAt ? 'Saved ' + meta.savedAt.slice(0, 10) : '';
            ttFileMeta.textContent = kb + dt;

            // Render content
            viewerBox.innerHTML = '';
            if (meta.type === 'image') {
                var img = document.createElement('img');
                img.className = 'tt-viewer__img';
                img.src = content;
                img.alt = meta.name || 'Timetable';
                img.addEventListener('click', function () { openLightbox(content); });
                viewerBox.appendChild(img);
            } else {
                var iframe = document.createElement('iframe');
                iframe.className = 'tt-viewer__iframe';
                iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
                iframe.title = 'Timetable';
                viewerBox.appendChild(iframe);
                iframe.srcdoc = content;
            }
        }

        function openFullscreen() {
            var raw = localStorage.getItem(META_KEY);
            if (!raw) return;
            var meta;
            try { meta = JSON.parse(raw); } catch (e) { return; }

            FS.get(STORE_ID).then(function (content) {
                if (!content) return;
                if (meta.type === 'image') {
                    openLightbox(content);
                } else {
                    var blob = new Blob([content], { type: 'text/html; charset=utf-8' });
                    var url  = URL.createObjectURL(blob);
                    var win  = window.open(url, '_blank');
                    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
                    if (!win) UI.showToast('Pop-up blocked — please allow pop-ups', 'warning');
                }
            });
        }

        function printTimetable() {
            var raw = localStorage.getItem(META_KEY);
            if (!raw) return;
            var meta;
            try { meta = JSON.parse(raw); } catch (e) { return; }

            if (meta.type === 'image') {
                // Print the image via a temporary hidden iframe
                FS.get(STORE_ID).then(function (dataUrl) {
                    var html = '<!DOCTYPE html><html><head><style>body{margin:0;padding:0}'
                        + 'img{max-width:100%;height:auto;display:block}'
                        + '@media print{body{margin:0}}</style></head>'
                        + '<body><img src="' + dataUrl + '"></body></html>';
                    var blob = new Blob([html], { type: 'text/html; charset=utf-8' });
                    var url  = URL.createObjectURL(blob);
                    var win  = window.open(url, '_blank');
                    if (!win) { UI.showToast('Pop-up blocked — please allow pop-ups to print', 'warning'); return; }
                    win.addEventListener('load', function () { win.focus(); win.print(); setTimeout(function () { URL.revokeObjectURL(url); }, 15000); });
                });
            } else {
                FS.get(STORE_ID).then(function (content) {
                    var blob = new Blob([content], { type: 'text/html; charset=utf-8' });
                    var url  = URL.createObjectURL(blob);
                    var win  = window.open(url, '_blank');
                    if (!win) { UI.showToast('Pop-up blocked — please allow pop-ups to print', 'warning'); return; }
                    win.addEventListener('load', function () { win.focus(); win.print(); setTimeout(function () { URL.revokeObjectURL(url); }, 15000); });
                });
            }
        }

        function deleteTimetable() {
            if (!confirm('Remove the saved timetable? This cannot be undone.')) return;
            FS.delete(STORE_ID).catch(function () {});
            localStorage.removeItem(META_KEY);
            showEmpty();
            UI.showToast('Timetable removed', 'success');
        }

        // ── Lightbox helpers ──────────────────────────────────────────────────
        function openLightbox(src) {
            lightboxImg.src = src;
            lightbox.classList.add('tt-lightbox--open');
            document.body.style.overflow = 'hidden';
        }
        function closeLightbox() {
            lightbox.classList.remove('tt-lightbox--open');
            lightboxImg.src = '';
            document.body.style.overflow = '';
        }

    }); // DOMContentLoaded
})();
