/**
 * MidSchool Manager - Lesson Files Page
 *
 * Handles upload, preview, presentation, printing, editing, and deletion
 * of HTML lesson files (presentations, worksheets, activities).
 *
 * Metadata  → localStorage via MSM.Storage (key: msm_lesson_files)
 * Content   → IndexedDB via MSM.FileStore
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var S    = MSM.Storage;
        var FS   = MSM.FileStore;
        var UI   = MSM.UI;
        var M    = MSM.Models;
        var KEYS = S.STORAGE_KEYS;

        // Active filters
        var filterClass  = '';
        var filterType   = '';
        var filterSearch = '';

        // Pending upload state
        var pendingContent  = null;  // HTML string of uploaded file
        var pendingFilename = '';
        var pendingSize     = 0;

        // ID of the file currently open in the preview/edit modal
        var currentPreviewId = null;
        var editorVisible    = false;

        // ID being edited (metadata modal)
        var editingMetaId = null;

        // =====================================================================
        // INIT
        // =====================================================================

        buildClassTabs();
        buildClassDropdown();
        buildClassCheckboxes('ufClasses');
        buildClassCheckboxes('emClasses');
        loadFiles();

        // =====================================================================
        // CLASS TABS
        // =====================================================================

        function buildClassTabs() {
            var classes = S.getData(KEYS.CLASSES);
            var tabsEl  = document.getElementById('classTabs');
            if (!tabsEl) return;

            // Group by year label
            var groups = {};
            classes.forEach(function (cls) {
                if (!groups[cls.label]) groups[cls.label] = [];
                groups[cls.label].push(cls);
            });

            var html = '<button class="lf-tab lf-tab--active" data-class="">All Classes</button>';
            Object.keys(groups).sort().forEach(function (label) {
                var groupClasses = groups[label];
                // Year-group tab
                var yearId = groupClasses.map(function (c) { return c.id; }).join(',');
                html += '<button class="lf-tab lf-tab--group" data-class-group="' + label + '" data-class-ids="' + yearId + '">' + label + '</button>';
                groupClasses.forEach(function (cls) {
                    html += '<button class="lf-tab" data-class="' + cls.id + '" style="--cls-color:' + cls.color + '">' + cls.name + '</button>';
                });
            });

            tabsEl.innerHTML = html;

            tabsEl.addEventListener('click', function (e) {
                var btn = e.target.closest('[data-class], [data-class-group]');
                if (!btn) return;

                tabsEl.querySelectorAll('.lf-tab').forEach(function (t) { t.classList.remove('lf-tab--active'); });
                btn.classList.add('lf-tab--active');

                if (btn.dataset.classGroup) {
                    // Toggle group: select all in group
                    filterClass = btn.dataset.classIds;
                } else {
                    filterClass = btn.dataset.class;
                }
                loadFiles();
            });
        }

        function buildClassDropdown() {
            var sel = document.getElementById('filterClass');
            if (!sel) return;
            var classes = S.getData(KEYS.CLASSES);
            classes.forEach(function (cls) {
                var opt = document.createElement('option');
                opt.value = cls.id;
                opt.textContent = cls.name;
                sel.appendChild(opt);
            });
            sel.addEventListener('change', function () {
                filterClass = this.value;
                // sync tabs
                document.querySelectorAll('.lf-tab').forEach(function (t) {
                    t.classList.toggle('lf-tab--active', t.dataset.class === filterClass);
                });
                if (!filterClass) {
                    var allTab = document.querySelector('.lf-tab[data-class=""]');
                    if (allTab) allTab.classList.add('lf-tab--active');
                }
                loadFiles();
            });
        }

        function buildClassCheckboxes(containerId) {
            var container = document.getElementById(containerId);
            if (!container) return;
            var classes = S.getData(KEYS.CLASSES);
            var html = '';
            classes.forEach(function (cls) {
                html += '<label class="lf-checkbox-label">'
                      + '<input type="checkbox" name="cls" value="' + cls.id + '">'
                      + '<span class="lf-class-dot" style="background:' + cls.color + '"></span>'
                      + cls.name + '</label>';
            });
            container.innerHTML = html;
        }

        // =====================================================================
        // FILTER LISTENERS
        // =====================================================================

        document.getElementById('filterType').addEventListener('change', function () {
            filterType = this.value;
            loadFiles();
        });

        document.getElementById('filterSearch').addEventListener('input', function () {
            filterSearch = this.value.toLowerCase().trim();
            loadFiles();
        });

        // =====================================================================
        // LOAD & RENDER
        // =====================================================================

        function loadFiles() {
            var all = S.getData(KEYS.LESSON_FILES);
            var filtered = all.filter(function (f) {
                // Class filter (may be comma-separated IDs for a year group)
                if (filterClass) {
                    var ids = filterClass.split(',');
                    var hasClass = ids.some(function (id) {
                        return f.classIds && f.classIds.indexOf(id) !== -1;
                    });
                    if (!hasClass) return false;
                }
                if (filterType && f.type !== filterType) return false;
                if (filterSearch) {
                    var haystack = ((f.title || '') + ' ' + (f.name || '') + ' ' + (f.description || '')).toLowerCase();
                    if (haystack.indexOf(filterSearch) === -1) return false;
                }
                return true;
            });

            renderCards(filtered);
        }

        function renderCards(files) {
            var grid = document.getElementById('filesGrid');
            if (!grid) return;

            if (!files.length) {
                grid.innerHTML = '<div class="empty-state">'
                    + '<div class="empty-state__icon">📂</div>'
                    + '<h3 class="empty-state__title">No files yet</h3>'
                    + '<p class="empty-state__text">Upload an HTML presentation or worksheet to get started.</p>'
                    + '</div>';
                return;
            }

            var classes = S.getData(KEYS.CLASSES);
            var classMap = {};
            classes.forEach(function (c) { classMap[c.id] = c; });

            var typeIcons = { presentation: '📊', worksheet: '📝', activity: '🎯', other: '📄' };

            var html = '';
            files.slice().reverse().forEach(function (f) {
                var icon = typeIcons[f.type] || '📄';
                var classBadges = (f.classIds || []).map(function (cid) {
                    var cls = classMap[cid];
                    if (!cls) return '';
                    return '<span class="lf-class-badge" style="background:' + cls.color + '">' + cls.name + '</span>';
                }).join('');

                var kb = f.fileSize ? Math.round(f.fileSize / 1024) + ' KB' : '';
                var date = f.uploadedAt ? f.uploadedAt.slice(0, 10) : '';

                html += '<div class="lf-card" data-id="' + f.id + '">'
                    + '<div class="lf-card__icon">' + icon + '</div>'
                    + '<div class="lf-card__body">'
                    + '<div class="lf-card__title">' + escHtml(f.title || f.name) + '</div>'
                    + '<div class="lf-card__meta">'
                    + (f.name ? '<span class="lf-card__filename">' + escHtml(f.name) + '</span>' : '')
                    + (kb ? '<span class="lf-card__size">' + kb + '</span>' : '')
                    + (date ? '<span class="lf-card__date">' + date + '</span>' : '')
                    + '</div>'
                    + (classBadges ? '<div class="lf-card__classes">' + classBadges + '</div>' : '')
                    + (f.description ? '<div class="lf-card__desc">' + escHtml(f.description) + '</div>' : '')
                    + '</div>'
                    + '<div class="lf-card__actions">'
                    + '<button class="btn btn-sm btn-primary lf-btn-present" data-id="' + f.id + '" title="Open full screen">⛶ Present</button>'
                    + '<button class="btn btn-sm btn-secondary lf-btn-preview" data-id="' + f.id + '" title="Preview inside app">👁 Preview</button>'
                    + '<button class="btn btn-sm btn-secondary lf-btn-print" data-id="' + f.id + '" title="Print / Save as PDF">🖨 Print</button>'
                    + '<button class="btn btn-sm btn-secondary lf-btn-edit-meta" data-id="' + f.id + '" title="Edit details">✏️</button>'
                    + '<button class="btn btn-sm btn-danger lf-btn-delete" data-id="' + f.id + '" title="Delete">🗑</button>'
                    + '</div>'
                    + '</div>';
            });
            grid.innerHTML = html;
        }

        // =====================================================================
        // EVENT DELEGATION on grid
        // =====================================================================

        document.getElementById('filesGrid').addEventListener('click', function (e) {
            var btn = e.target.closest('[data-id]');
            if (!btn) return;
            var id = btn.dataset.id;

            if (btn.classList.contains('lf-btn-present'))   { presentFile(id); return; }
            if (btn.classList.contains('lf-btn-preview'))   { openPreview(id); return; }
            if (btn.classList.contains('lf-btn-print'))     { printFile(id); return; }
            if (btn.classList.contains('lf-btn-edit-meta')) { openEditMeta(id); return; }
            if (btn.classList.contains('lf-btn-delete'))    { deleteFile(id); return; }
        });

        // =====================================================================
        // UPLOAD MODAL
        // =====================================================================

        document.getElementById('btnUpload').addEventListener('click', openUploadModal);

        function openUploadModal() {
            pendingContent  = null;
            pendingFilename = '';
            pendingSize     = 0;
            document.getElementById('fileSelectedName').style.display = 'none';
            document.getElementById('uploadForm').style.display = 'none';
            document.getElementById('btnUploadSave').disabled = true;
            document.getElementById('ufTitle').value = '';
            document.getElementById('ufDescription').value = '';
            document.getElementById('ufType').value = 'presentation';
            document.querySelectorAll('#ufClasses input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
            document.getElementById('uploadModal').style.display = 'flex';
        }

        function closeUploadModal() {
            document.getElementById('uploadModal').style.display = 'none';
        }

        document.getElementById('uploadModalClose').addEventListener('click', closeUploadModal);
        document.getElementById('btnUploadCancel').addEventListener('click', closeUploadModal);
        document.getElementById('uploadModal').addEventListener('click', function (e) {
            if (e.target === this) closeUploadModal();
        });

        // File input
        document.getElementById('fileInput').addEventListener('change', function () {
            handleFileSelected(this.files[0]);
        });

        // Drag & drop
        var dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            dropZone.classList.add('lf-drop-zone--over');
        });
        dropZone.addEventListener('dragleave', function () {
            dropZone.classList.remove('lf-drop-zone--over');
        });
        dropZone.addEventListener('drop', function (e) {
            e.preventDefault();
            dropZone.classList.remove('lf-drop-zone--over');
            var file = e.dataTransfer.files[0];
            if (file) handleFileSelected(file);
        });

        function handleFileSelected(file) {
            if (!file) return;
            var ext = file.name.split('.').pop().toLowerCase();
            if (ext !== 'html' && ext !== 'htm') {
                UI.showToast('Only .html files are supported', 'error');
                return;
            }

            var reader = new FileReader();
            reader.onload = function (e) {
                pendingContent  = e.target.result;
                pendingFilename = file.name;
                pendingSize     = file.size;

                var nameEl = document.getElementById('fileSelectedName');
                nameEl.textContent = '✅ ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
                nameEl.style.display = 'block';

                // Pre-fill title from filename (strip extension)
                var suggested = file.name.replace(/\.(html|htm)$/i, '').replace(/[-_]/g, ' ');
                document.getElementById('ufTitle').value = suggested;

                document.getElementById('uploadForm').style.display = 'block';
                document.getElementById('btnUploadSave').disabled = false;
                document.getElementById('ufTitle').focus();
            };
            reader.readAsText(file, 'UTF-8');
        }

        document.getElementById('btnUploadSave').addEventListener('click', function () {
            var title = document.getElementById('ufTitle').value.trim();
            if (!title) { UI.showToast('Please enter a title', 'error'); return; }
            if (!pendingContent) { UI.showToast('No file selected', 'error'); return; }

            var classIds = [];
            document.querySelectorAll('#ufClasses input[type=checkbox]:checked').forEach(function (cb) {
                classIds.push(cb.value);
            });

            var meta = M.createLessonFile({
                name:        pendingFilename,
                title:       title,
                type:        document.getElementById('ufType').value,
                classIds:    classIds,
                description: document.getElementById('ufDescription').value.trim(),
                fileSize:    pendingSize
            });

            FS.save(meta.id, pendingContent).then(function () {
                S.addItem(KEYS.LESSON_FILES, meta);
                UI.showToast('File saved!', 'success');
                closeUploadModal();
                loadFiles();
            }).catch(function (err) {
                console.error(err);
                UI.showToast('Failed to save file content: ' + err.message, 'error');
            });
        });

        // =====================================================================
        // PRESENT (open in new tab)
        // =====================================================================

        function presentFile(id) {
            FS.get(id).then(function (content) {
                if (!content) { UI.showToast('File content not found', 'error'); return; }
                var blob = new Blob([content], { type: 'text/html; charset=utf-8' });
                var url  = URL.createObjectURL(blob);
                var win  = window.open(url, '_blank');
                // Revoke after a delay so the tab has time to load
                setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
                if (!win) UI.showToast('Pop-up blocked — please allow pop-ups for this site', 'warning');
            }).catch(function () { UI.showToast('Could not load file', 'error'); });
        }

        // =====================================================================
        // PRINT (open in hidden window, trigger print dialog)
        // =====================================================================

        function printFile(id) {
            FS.get(id).then(function (content) {
                if (!content) { UI.showToast('File content not found', 'error'); return; }
                var blob = new Blob([content], { type: 'text/html; charset=utf-8' });
                var url  = URL.createObjectURL(blob);
                var win  = window.open(url, '_blank');
                if (!win) {
                    UI.showToast('Pop-up blocked — please allow pop-ups to print', 'warning');
                    return;
                }
                win.addEventListener('load', function () {
                    win.focus();
                    win.print();
                    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
                });
            }).catch(function () { UI.showToast('Could not load file', 'error'); });
        }

        // =====================================================================
        // PREVIEW + EDIT MODAL
        // =====================================================================

        function openPreview(id) {
            var meta = S.getById(KEYS.LESSON_FILES, id);
            if (!meta) { UI.showToast('File not found', 'error'); return; }

            currentPreviewId = id;
            editorVisible    = false;

            document.getElementById('previewModalTitle').textContent = meta.title || meta.name;
            document.getElementById('previewIframe').src = '';
            document.getElementById('htmlEditor').value  = '';
            document.getElementById('editorPanel').style.display = 'none';
            document.getElementById('previewIframe').style.display = 'block';
            document.getElementById('previewModal').style.display  = 'flex';

            FS.get(id).then(function (content) {
                if (!content) { UI.showToast('File content not found', 'error'); return; }

                // Render in iframe using srcdoc
                var iframe = document.getElementById('previewIframe');
                iframe.srcdoc = content;

                // Also populate editor
                document.getElementById('htmlEditor').value = content;
            }).catch(function () { UI.showToast('Could not load file', 'error'); });
        }

        document.getElementById('previewModalClose').addEventListener('click', function () {
            document.getElementById('previewModal').style.display = 'none';
            currentPreviewId = null;
        });
        document.getElementById('previewModal').addEventListener('click', function (e) {
            if (e.target === this) {
                this.style.display = 'none';
                currentPreviewId = null;
            }
        });

        document.getElementById('btnPreviewPresent').addEventListener('click', function () {
            if (currentPreviewId) presentFile(currentPreviewId);
        });

        document.getElementById('btnPreviewPrint').addEventListener('click', function () {
            if (currentPreviewId) printFile(currentPreviewId);
        });

        // Toggle HTML editor
        document.getElementById('btnToggleEditor').addEventListener('click', function () {
            editorVisible = !editorVisible;
            document.getElementById('editorPanel').style.display = editorVisible ? 'flex' : 'none';
            document.getElementById('previewIframe').style.display = editorVisible ? 'none' : 'block';
            this.textContent = editorVisible ? '👁 Preview' : '</> Edit';
        });

        // Refresh preview from editor content
        document.getElementById('btnEditorRefresh').addEventListener('click', function () {
            var content = document.getElementById('htmlEditor').value;
            document.getElementById('previewIframe').srcdoc = content;
        });

        // Save edited HTML
        document.getElementById('btnEditorSave').addEventListener('click', function () {
            if (!currentPreviewId) return;
            var content = document.getElementById('htmlEditor').value;
            var meta    = S.getById(KEYS.LESSON_FILES, currentPreviewId);
            if (!meta) return;

            FS.save(currentPreviewId, content).then(function () {
                // Update file size
                var size = new Blob([content]).size;
                S.updateItem(KEYS.LESSON_FILES, currentPreviewId, {
                    fileSize:  size,
                    updatedAt: new Date().toISOString()
                });
                UI.showToast('File saved!', 'success');
                // Refresh iframe
                document.getElementById('previewIframe').srcdoc = content;
                loadFiles();
            }).catch(function (err) {
                UI.showToast('Save failed: ' + err.message, 'error');
            });
        });

        // =====================================================================
        // EDIT METADATA MODAL
        // =====================================================================

        function openEditMeta(id) {
            var meta = S.getById(KEYS.LESSON_FILES, id);
            if (!meta) return;
            editingMetaId = id;

            document.getElementById('emTitle').value       = meta.title || '';
            document.getElementById('emType').value        = meta.type || 'presentation';
            document.getElementById('emDescription').value = meta.description || '';

            // Check the right class checkboxes
            document.querySelectorAll('#emClasses input[type=checkbox]').forEach(function (cb) {
                cb.checked = meta.classIds && meta.classIds.indexOf(cb.value) !== -1;
            });

            document.getElementById('editMetaModal').style.display = 'flex';
        }

        document.getElementById('editMetaModalClose').addEventListener('click', function () {
            document.getElementById('editMetaModal').style.display = 'none';
        });
        document.getElementById('btnEditMetaCancel').addEventListener('click', function () {
            document.getElementById('editMetaModal').style.display = 'none';
        });
        document.getElementById('editMetaModal').addEventListener('click', function (e) {
            if (e.target === this) this.style.display = 'none';
        });

        document.getElementById('btnEditMetaSave').addEventListener('click', function () {
            if (!editingMetaId) return;
            var title = document.getElementById('emTitle').value.trim();
            if (!title) { UI.showToast('Title is required', 'error'); return; }

            var classIds = [];
            document.querySelectorAll('#emClasses input[type=checkbox]:checked').forEach(function (cb) {
                classIds.push(cb.value);
            });

            S.updateItem(KEYS.LESSON_FILES, editingMetaId, {
                title:       title,
                type:        document.getElementById('emType').value,
                classIds:    classIds,
                description: document.getElementById('emDescription').value.trim(),
                updatedAt:   new Date().toISOString()
            });

            UI.showToast('Details updated', 'success');
            document.getElementById('editMetaModal').style.display = 'none';
            loadFiles();
        });

        // =====================================================================
        // DELETE
        // =====================================================================

        function deleteFile(id) {
            var meta = S.getById(KEYS.LESSON_FILES, id);
            if (!meta) return;
            if (!confirm('Delete "' + (meta.title || meta.name) + '"?\nThis cannot be undone.')) return;

            FS.delete(id).then(function () {
                S.deleteItem(KEYS.LESSON_FILES, id);
                UI.showToast('File deleted', 'success');
                loadFiles();
            }).catch(function (err) {
                // Delete metadata anyway even if IndexedDB fails
                S.deleteItem(KEYS.LESSON_FILES, id);
                console.warn('FileStore delete error:', err);
                UI.showToast('File removed', 'success');
                loadFiles();
            });
        }

        // =====================================================================
        // EXPOSE for lessons page attachment picker
        // =====================================================================

        window.MSM.FilesPage = {
            presentFile: presentFile,
            printFile:   printFile,
            openPreview: openPreview,
            loadFiles:   loadFiles
        };

        // =====================================================================
        // UTILITY
        // =====================================================================

        function escHtml(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

    }); // DOMContentLoaded
})();
