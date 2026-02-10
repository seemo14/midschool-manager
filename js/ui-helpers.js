/**
 * MSM UI Helpers Module
 * Shared UI components for the MidSchool Management App.
 * Attaches to window.MSM.UI
 */
(function () {
  "use strict";

  // Ensure namespace exists
  window.MSM = window.MSM || {};

  var _stylesInjected = false;
  var _currentModal = null;
  var _toastContainer = null;

  // ---------------------------------------------------------------------------
  // Internal: inject component CSS into <head> once
  // ---------------------------------------------------------------------------
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;

    var css = [
      /* ---- Modal ---- */
      "@keyframes msm-fade-in{from{opacity:0}to{opacity:1}}",
      "@keyframes msm-scale-in{from{opacity:0;transform:translate(-50%,-50%) scale(.92)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}",

      ".modal-backdrop{" +
        "position:fixed;top:0;left:0;width:100%;height:100%;" +
        "background:rgba(0,0,0,0.5);z-index:1000;" +
        "animation:msm-fade-in .2s ease;" +
      "}",

      ".modal{" +
        "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);" +
        "background:#fff;border-radius:12px;" +
        "box-shadow:0 20px 60px rgba(0,0,0,0.3);" +
        "display:flex;flex-direction:column;" +
        "max-height:80vh;z-index:1001;" +
        "animation:msm-scale-in .25s ease;" +
      "}",

      ".modal-header{" +
        "display:flex;align-items:center;justify-content:space-between;" +
        "padding:16px 24px;border-bottom:1px solid #e5e7eb;" +
      "}",

      ".modal-header h2{margin:0;font-size:18px;font-weight:600;color:#1f2937;}",

      ".modal-close-btn{" +
        "background:none;border:none;font-size:22px;cursor:pointer;" +
        "color:#6b7280;padding:4px 8px;border-radius:4px;line-height:1;" +
      "}",
      ".modal-close-btn:hover{background:#f3f4f6;color:#1f2937;}",

      ".modal-body{padding:24px;overflow-y:auto;flex:1;}",

      ".modal-footer{" +
        "padding:16px 24px;border-top:1px solid #e5e7eb;" +
        "display:flex;justify-content:flex-end;gap:8px;" +
      "}",

      /* ---- Toast ---- */
      "@keyframes msm-slide-in-right{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}",
      "@keyframes msm-fade-out{from{opacity:1}to{opacity:0}}",

      ".msm-toast-container{" +
        "position:fixed;bottom:24px;right:24px;z-index:2000;" +
        "display:flex;flex-direction:column-reverse;gap:8px;pointer-events:none;" +
      "}",

      ".msm-toast{" +
        "pointer-events:auto;background:#fff;border-radius:8px;" +
        "box-shadow:0 4px 16px rgba(0,0,0,0.12);" +
        "display:flex;align-items:flex-start;gap:10px;" +
        "padding:12px 16px;min-width:280px;max-width:400px;" +
        "border-left:4px solid #3b82f6;" +
        "animation:msm-slide-in-right .3s ease;" +
      "}",

      ".msm-toast.toast-success{border-left-color:#22c55e;}",
      ".msm-toast.toast-error{border-left-color:#ef4444;}",
      ".msm-toast.toast-warning{border-left-color:#f59e0b;}",
      ".msm-toast.toast-info{border-left-color:#3b82f6;}",

      ".msm-toast.msm-toast-hiding{animation:msm-fade-out .3s ease forwards;}",

      ".msm-toast-icon{flex-shrink:0;font-size:18px;line-height:1.4;}",
      ".msm-toast-message{flex:1;font-size:14px;color:#374151;line-height:1.4;}",

      ".msm-toast-close{" +
        "background:none;border:none;font-size:16px;cursor:pointer;" +
        "color:#9ca3af;padding:0 0 0 8px;line-height:1;flex-shrink:0;" +
      "}",
      ".msm-toast-close:hover{color:#4b5563;}",

      /* ---- Confirm buttons ---- */
      ".msm-btn{" +
        "padding:8px 20px;border-radius:6px;font-size:14px;font-weight:500;" +
        "cursor:pointer;border:1px solid transparent;transition:background .15s ease;" +
      "}",
      ".msm-btn-secondary{background:#f3f4f6;color:#374151;border-color:#d1d5db;}",
      ".msm-btn-secondary:hover{background:#e5e7eb;}",
      ".msm-btn-danger{background:#ef4444;color:#fff;}",
      ".msm-btn-danger:hover{background:#dc2626;}",

      /* ---- Filter bar ---- */
      ".msm-filter-bar{" +
        "display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;" +
        "padding:16px 0;" +
      "}",
      ".msm-filter-item label{display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px;}",
      ".msm-filter-item select," +
      ".msm-filter-item input{" +
        "padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;" +
        "font-size:14px;color:#1f2937;background:#fff;min-width:160px;" +
      "}",
      ".msm-filter-item select:focus," +
      ".msm-filter-item input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.15);}",

      /* ---- Table ---- */
      ".msm-table-wrapper{overflow-x:auto;}",
      ".msm-table{width:100%;border-collapse:collapse;font-size:14px;}",
      ".msm-table th{" +
        "text-align:left;padding:10px 14px;background:#f9fafb;" +
        "border-bottom:2px solid #e5e7eb;font-weight:600;color:#374151;" +
        "white-space:nowrap;user-select:none;" +
      "}",
      ".msm-table th.sortable{cursor:pointer;}",
      ".msm-table th.sortable:hover{background:#f3f4f6;}",
      ".msm-table th .sort-arrow{margin-left:4px;font-size:12px;color:#9ca3af;}",
      ".msm-table td{padding:10px 14px;border-bottom:1px solid #f3f4f6;color:#4b5563;}",
      ".msm-table tr.striped{background:#f9fafb;}",
      ".msm-table tr.clickable{cursor:pointer;}",
      ".msm-table tr.clickable:hover{background:#eff6ff;}",

      ".msm-pagination{" +
        "display:flex;align-items:center;justify-content:center;gap:6px;" +
        "padding:16px 0;font-size:14px;" +
      "}",
      ".msm-pagination button{" +
        "padding:6px 12px;border:1px solid #d1d5db;border-radius:6px;" +
        "background:#fff;cursor:pointer;font-size:13px;color:#374151;" +
      "}",
      ".msm-pagination button:hover:not(:disabled){background:#f3f4f6;}",
      ".msm-pagination button:disabled{opacity:0.4;cursor:default;}",
      ".msm-pagination button.active{background:#3b82f6;color:#fff;border-color:#3b82f6;}",
      ".msm-pagination .page-info{color:#6b7280;}",

      /* ---- Empty state ---- */
      ".msm-empty-state{" +
        "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "padding:60px 24px;text-align:center;color:#9ca3af;" +
      "}",
      ".msm-empty-state .empty-icon{font-size:48px;margin-bottom:16px;}",
      ".msm-empty-state .empty-message{font-size:16px;margin-bottom:20px;color:#6b7280;max-width:360px;}",
      ".msm-empty-state .msm-btn{margin-top:4px;}"
    ].join("\n");

    var style = document.createElement("style");
    style.setAttribute("data-msm-ui", "true");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Toast icon map
  // ---------------------------------------------------------------------------
  var _toastIcons = {
    success: "&#10003;",   // checkmark
    error: "&#10007;",     // X
    warning: "&#9888;",    // warning triangle
    info: "&#8505;"        // info circle
  };

  var _toastIconColors = {
    success: "#22c55e",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6"
  };

  // ---------------------------------------------------------------------------
  // 1. showModal
  // ---------------------------------------------------------------------------
  function showModal(title, contentHTML, options) {
    _injectStyles();

    // Close any existing modal first
    closeModal();

    options = options || {};
    var width = options.width || "500px";
    var showClose = options.showClose !== false;
    var footerHTML = options.footerHTML || "";
    var onClose = options.onClose || null;

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    // Backdrop
    var backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";

    // Modal
    var modal = document.createElement("div");
    modal.className = "modal";
    modal.style.width = width;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", title);

    // Header
    var header = document.createElement("div");
    header.className = "modal-header";

    var titleEl = document.createElement("h2");
    titleEl.textContent = title;
    header.appendChild(titleEl);

    if (showClose) {
      var closeBtn = document.createElement("button");
      closeBtn.className = "modal-close-btn";
      closeBtn.innerHTML = "&times;";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.addEventListener("click", function () {
        closeModal();
        if (onClose) onClose();
      });
      header.appendChild(closeBtn);
    }

    // Body
    var body = document.createElement("div");
    body.className = "modal-body";
    body.innerHTML = contentHTML;

    // Footer
    var footer = null;
    if (footerHTML) {
      footer = document.createElement("div");
      footer.className = "modal-footer";
      footer.innerHTML = footerHTML;
    }

    modal.appendChild(header);
    modal.appendChild(body);
    if (footer) modal.appendChild(footer);

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    _currentModal = { backdrop: backdrop, modal: modal, onClose: onClose };

    // Close on backdrop click
    backdrop.addEventListener("click", function () {
      closeModal();
      if (onClose) onClose();
    });

    // ESC key closes modal
    function handleEsc(e) {
      if (e.key === "Escape") {
        closeModal();
        if (onClose) onClose();
      }
    }
    document.addEventListener("keydown", handleEsc);
    _currentModal._escHandler = handleEsc;

    // Focus trap
    _setupFocusTrap(modal);

    // Focus the modal (or its first focusable element)
    var firstFocusable = modal.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      modal.setAttribute("tabindex", "-1");
      modal.focus();
    }

    return modal;
  }

  // ---------------------------------------------------------------------------
  // Focus trap helper
  // ---------------------------------------------------------------------------
  function _setupFocusTrap(modal) {
    function trapHandler(e) {
      if (e.key !== "Tab") return;

      var focusableEls = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableEls.length === 0) return;

      var firstEl = focusableEls[0];
      var lastEl = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
    modal.addEventListener("keydown", trapHandler);
  }

  // ---------------------------------------------------------------------------
  // 2. closeModal
  // ---------------------------------------------------------------------------
  function closeModal() {
    if (!_currentModal) return;

    if (_currentModal._escHandler) {
      document.removeEventListener("keydown", _currentModal._escHandler);
    }
    if (_currentModal.backdrop && _currentModal.backdrop.parentNode) {
      _currentModal.backdrop.parentNode.removeChild(_currentModal.backdrop);
    }
    if (_currentModal.modal && _currentModal.modal.parentNode) {
      _currentModal.modal.parentNode.removeChild(_currentModal.modal);
    }

    // Restore body scroll
    document.body.style.overflow = "";
    _currentModal = null;
  }

  // ---------------------------------------------------------------------------
  // 3. showToast
  // ---------------------------------------------------------------------------
  function showToast(message, type) {
    _injectStyles();

    type = type || "info";

    // Ensure toast container
    if (!_toastContainer || !_toastContainer.parentNode) {
      _toastContainer = document.createElement("div");
      _toastContainer.className = "msm-toast-container";
      document.body.appendChild(_toastContainer);
    }

    var toast = document.createElement("div");
    toast.className = "msm-toast toast-" + type;

    var icon = document.createElement("span");
    icon.className = "msm-toast-icon";
    icon.innerHTML = _toastIcons[type] || _toastIcons.info;
    icon.style.color = _toastIconColors[type] || _toastIconColors.info;

    var msg = document.createElement("span");
    msg.className = "msm-toast-message";
    msg.textContent = message;

    var closeBtn = document.createElement("button");
    closeBtn.className = "msm-toast-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.setAttribute("aria-label", "Dismiss");

    function dismissToast() {
      toast.classList.add("msm-toast-hiding");
      setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }

    closeBtn.addEventListener("click", dismissToast);

    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(closeBtn);

    _toastContainer.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(dismissToast, 3000);
  }

  // ---------------------------------------------------------------------------
  // 4. showConfirm
  // ---------------------------------------------------------------------------
  function showConfirm(message, onConfirm, onCancel) {
    var footerHTML =
      '<button class="msm-btn msm-btn-secondary" data-action="cancel">Cancel</button>' +
      '<button class="msm-btn msm-btn-danger" data-action="confirm">Confirm</button>';

    var modal = showModal("Confirm", "<p>" + escapeHTML(message) + "</p>", {
      width: "420px",
      footerHTML: footerHTML,
      onClose: function () {
        if (onCancel) onCancel();
      }
    });

    var cancelBtn = modal.querySelector('[data-action="cancel"]');
    var confirmBtn = modal.querySelector('[data-action="confirm"]');

    cancelBtn.addEventListener("click", function () {
      closeModal();
      if (onCancel) onCancel();
    });

    confirmBtn.addEventListener("click", function () {
      closeModal();
      if (onConfirm) onConfirm();
    });
  }

  // ---------------------------------------------------------------------------
  // 5. buildDropdown
  // ---------------------------------------------------------------------------
  function buildDropdown(elementId, options, selectedValue, placeholder) {
    var select = document.getElementById(elementId);
    if (!select) return;

    // Clear existing options
    select.innerHTML = "";

    // Placeholder
    if (placeholder) {
      var placeholderOpt = document.createElement("option");
      placeholderOpt.value = "";
      placeholderOpt.textContent = placeholder;
      placeholderOpt.disabled = true;
      if (!selectedValue && selectedValue !== 0) {
        placeholderOpt.selected = true;
      }
      select.appendChild(placeholderOpt);
    }

    // Populate options
    for (var i = 0; i < options.length; i++) {
      var opt = document.createElement("option");
      opt.value = options[i].value;
      opt.textContent = options[i].label;
      if (selectedValue !== undefined && selectedValue !== null &&
          String(options[i].value) === String(selectedValue)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. buildClassDropdown
  // ---------------------------------------------------------------------------
  function buildClassDropdown(elementId, selectedClassId, includeAll) {
    var select = document.getElementById(elementId);
    if (!select) return;

    select.innerHTML = "";

    // "All Classes" option
    if (includeAll) {
      var allOpt = document.createElement("option");
      allOpt.value = "";
      allOpt.textContent = "All Classes";
      if (!selectedClassId) {
        allOpt.selected = true;
      }
      select.appendChild(allOpt);
    }

    // Get classes from storage
    var classes = [];
    if (window.MSM && window.MSM.Storage && window.MSM.Storage.getData) {
      classes = window.MSM.Storage.getData("msm_classes") || [];
    }

    // Group by year level
    var yearGroups = {
      "1AC": [],
      "2AC": [],
      "3AC": []
    };

    for (var i = 0; i < classes.length; i++) {
      var cls = classes[i];
      var yearLabel = cls.label || '';
      if (yearGroups[yearLabel]) {
        yearGroups[yearLabel].push(cls);
      }
    }

    var yearLabels = ["1AC", "2AC", "3AC"];
    for (var y = 0; y < yearLabels.length; y++) {
      var year = yearLabels[y];
      var group = yearGroups[year];
      if (group.length === 0) continue;

      var optgroup = document.createElement("optgroup");
      optgroup.label = year;

      for (var j = 0; j < group.length; j++) {
        var opt = document.createElement("option");
        opt.value = group[j].id;
        opt.textContent = group[j].name || group[j].id;
        if (selectedClassId && String(group[j].id) === String(selectedClassId)) {
          opt.selected = true;
        }
        optgroup.appendChild(opt);
      }

      select.appendChild(optgroup);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. buildTable
  // ---------------------------------------------------------------------------
  function buildTable(containerId, columns, data, options) {
    _injectStyles();

    var container = document.getElementById(containerId);
    if (!container) return null;

    options = options || {};
    var pageSize = options.pageSize || 20;
    var currentPage = options.currentPage || 1;
    var emptyMessage = options.emptyMessage || "No data found";
    var onRowClick = options.onRowClick || null;
    var striped = options.striped !== false;

    var sortKey = null;
    var sortDir = "asc"; // 'asc' or 'desc'
    var currentData = data ? data.slice() : [];

    function _sortData() {
      if (!sortKey) return currentData;
      var sorted = currentData.slice();
      sorted.sort(function (a, b) {
        var valA = a[sortKey];
        var valB = b[sortKey];
        if (valA == null) valA = "";
        if (valB == null) valB = "";
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return sortDir === "asc" ? -1 : 1;
        if (valA > valB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    }

    function _render() {
      container.innerHTML = "";

      if (currentData.length === 0) {
        container.innerHTML =
          '<div class="msm-empty-state">' +
            '<div class="empty-icon">&#128203;</div>' +
            '<div class="empty-message">' + escapeHTML(emptyMessage) + '</div>' +
          '</div>';
        return;
      }

      var sorted = _sortData();
      var totalPages = Math.ceil(sorted.length / pageSize);
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      var start = (currentPage - 1) * pageSize;
      var end = Math.min(start + pageSize, sorted.length);
      var pageData = sorted.slice(start, end);

      // Table wrapper
      var wrapper = document.createElement("div");
      wrapper.className = "msm-table-wrapper";

      var table = document.createElement("table");
      table.className = "msm-table";

      // Thead
      var thead = document.createElement("thead");
      var headerRow = document.createElement("tr");

      for (var c = 0; c < columns.length; c++) {
        var col = columns[c];
        var th = document.createElement("th");
        th.textContent = col.label || col.key;
        if (col.width) th.style.width = col.width;

        if (col.className) th.className = col.className;

        if (col.sortable) {
          th.classList.add("sortable");
          if (sortKey === col.key) {
            var arrow = document.createElement("span");
            arrow.className = "sort-arrow";
            arrow.textContent = sortDir === "asc" ? " \u25B2" : " \u25BC";
            th.appendChild(arrow);
          }
          (function (colKey) {
            th.addEventListener("click", function () {
              if (sortKey === colKey) {
                sortDir = sortDir === "asc" ? "desc" : "asc";
              } else {
                sortKey = colKey;
                sortDir = "asc";
              }
              _render();
            });
          })(col.key);
        }

        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Tbody
      var tbody = document.createElement("tbody");
      for (var r = 0; r < pageData.length; r++) {
        var row = pageData[r];
        var tr = document.createElement("tr");
        if (striped && r % 2 === 1) tr.classList.add("striped");
        if (onRowClick) tr.classList.add("clickable");

        for (var cc = 0; cc < columns.length; cc++) {
          var td = document.createElement("td");
          var colDef = columns[cc];
          var value = row[colDef.key];
          if (colDef.className) td.className = colDef.className;

          if (colDef.render) {
            td.innerHTML = colDef.render(value, row);
          } else {
            td.textContent = value != null ? String(value) : "";
          }
          tr.appendChild(td);
        }

        if (onRowClick) {
          (function (rowData) {
            tr.addEventListener("click", function () {
              onRowClick(rowData);
            });
          })(row);
        }

        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrapper.appendChild(table);
      container.appendChild(wrapper);

      // Pagination
      if (totalPages > 1) {
        var paginationDiv = document.createElement("div");
        paginationDiv.className = "msm-pagination";

        // Previous button
        var prevBtn = document.createElement("button");
        prevBtn.textContent = "\u2190 Prev";
        prevBtn.disabled = currentPage <= 1;
        prevBtn.addEventListener("click", function () {
          if (currentPage > 1) {
            currentPage--;
            _render();
          }
        });
        paginationDiv.appendChild(prevBtn);

        // Page buttons
        var maxButtons = 5;
        var startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        var endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if (endPage - startPage + 1 < maxButtons) {
          startPage = Math.max(1, endPage - maxButtons + 1);
        }

        for (var p = startPage; p <= endPage; p++) {
          var pageBtn = document.createElement("button");
          pageBtn.textContent = String(p);
          if (p === currentPage) pageBtn.classList.add("active");
          (function (pageNum) {
            pageBtn.addEventListener("click", function () {
              currentPage = pageNum;
              _render();
            });
          })(p);
          paginationDiv.appendChild(pageBtn);
        }

        // Next button
        var nextBtn = document.createElement("button");
        nextBtn.textContent = "Next \u2192";
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.addEventListener("click", function () {
          if (currentPage < totalPages) {
            currentPage++;
            _render();
          }
        });
        paginationDiv.appendChild(nextBtn);

        // Page info
        var pageInfo = document.createElement("span");
        pageInfo.className = "page-info";
        pageInfo.textContent = " (" + sorted.length + " total)";
        paginationDiv.appendChild(pageInfo);

        container.appendChild(paginationDiv);
      }
    }

    _render();

    // Return controller object
    return {
      refresh: function (newData) {
        currentData = newData ? newData.slice() : [];
        currentPage = 1;
        sortKey = null;
        sortDir = "asc";
        _render();
      },
      getPage: function () {
        return currentPage;
      },
      setPage: function (n) {
        currentPage = n;
        _render();
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 8. formatDate
  // ---------------------------------------------------------------------------
  function formatDate(dateString) {
    if (!dateString) return "";
    var d = new Date(dateString);
    if (isNaN(d.getTime())) return "";

    var months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  // ---------------------------------------------------------------------------
  // 9. formatDateShort
  // ---------------------------------------------------------------------------
  function formatDateShort(dateString) {
    if (!dateString) return "";
    var d = new Date(dateString);
    if (isNaN(d.getTime())) return "";

    var day = String(d.getDate()).padStart(2, "0");
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var year = d.getFullYear();
    return day + "/" + month + "/" + year;
  }

  // ---------------------------------------------------------------------------
  // 10. getRelativeTime
  // ---------------------------------------------------------------------------
  function getRelativeTime(dateString) {
    if (!dateString) return "";
    var d = new Date(dateString);
    if (isNaN(d.getTime())) return "";

    var now = new Date();
    // Reset both to start of day for day-level comparison
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    var diffMs = today.getTime() - target.getTime();
    var diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return diffDays + " days ago";
    if (diffDays < 14) return "1 week ago";
    if (diffDays < 30) return Math.floor(diffDays / 7) + " weeks ago";
    if (diffDays < 60) return "1 month ago";
    if (diffDays < 365) return Math.floor(diffDays / 30) + " months ago";
    if (diffDays < 730) return "1 year ago";
    return Math.floor(diffDays / 365) + " years ago";
  }

  // ---------------------------------------------------------------------------
  // 11. debounce
  // ---------------------------------------------------------------------------
  function debounce(fn, delay) {
    delay = delay || 300;
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  // ---------------------------------------------------------------------------
  // 12. escapeHTML
  // ---------------------------------------------------------------------------
  function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------------------------------------------------------------------------
  // 13. createFilterBar
  // ---------------------------------------------------------------------------
  function createFilterBar(containerId, filters) {
    _injectStyles();

    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    var bar = document.createElement("div");
    bar.className = "msm-filter-bar";

    for (var i = 0; i < filters.length; i++) {
      var filter = filters[i];
      var item = document.createElement("div");
      item.className = "msm-filter-item";

      if (filter.label) {
        var label = document.createElement("label");
        label.setAttribute("for", filter.id);
        label.textContent = filter.label;
        item.appendChild(label);
      }

      var control;

      if (filter.type === "select") {
        control = document.createElement("select");
        control.id = filter.id;

        if (filter.placeholder) {
          var placeholderOpt = document.createElement("option");
          placeholderOpt.value = "";
          placeholderOpt.textContent = filter.placeholder;
          control.appendChild(placeholderOpt);
        }

        if (filter.options) {
          for (var j = 0; j < filter.options.length; j++) {
            var opt = document.createElement("option");
            opt.value = filter.options[j].value;
            opt.textContent = filter.options[j].label;
            control.appendChild(opt);
          }
        }

        if (filter.onChange) {
          (function (cb) {
            control.addEventListener("change", function () {
              cb(this.value);
            });
          })(filter.onChange);
        }

      } else if (filter.type === "date") {
        control = document.createElement("input");
        control.type = "date";
        control.id = filter.id;

        if (filter.onChange) {
          (function (cb) {
            control.addEventListener("change", function () {
              cb(this.value);
            });
          })(filter.onChange);
        }

      } else {
        // Default to text input
        control = document.createElement("input");
        control.type = "text";
        control.id = filter.id;
        if (filter.placeholder) control.placeholder = filter.placeholder;

        if (filter.onChange) {
          (function (cb) {
            var debouncedCb = debounce(function (val) {
              cb(val);
            }, 300);
            control.addEventListener("input", function () {
              debouncedCb(this.value);
            });
          })(filter.onChange);
        }
      }

      item.appendChild(control);
      bar.appendChild(item);
    }

    container.appendChild(bar);
  }

  // ---------------------------------------------------------------------------
  // 14. showEmptyState
  // ---------------------------------------------------------------------------
  function showEmptyState(containerId, message, actionLabel, onAction) {
    _injectStyles();

    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    var wrapper = document.createElement("div");
    wrapper.className = "msm-empty-state";

    var iconEl = document.createElement("div");
    iconEl.className = "empty-icon";
    iconEl.innerHTML = "&#128203;"; // clipboard emoji

    var msgEl = document.createElement("div");
    msgEl.className = "empty-message";
    msgEl.textContent = message;

    wrapper.appendChild(iconEl);
    wrapper.appendChild(msgEl);

    if (actionLabel && onAction) {
      var btn = document.createElement("button");
      btn.className = "msm-btn msm-btn-danger";
      btn.textContent = actionLabel;
      btn.addEventListener("click", onAction);
      wrapper.appendChild(btn);
    }

    container.appendChild(wrapper);
  }

  // ---------------------------------------------------------------------------
  // Expose public API
  // ---------------------------------------------------------------------------
  window.MSM.UI = {
    showModal: showModal,
    closeModal: closeModal,
    showToast: showToast,
    showConfirm: showConfirm,
    buildDropdown: buildDropdown,
    buildClassDropdown: buildClassDropdown,
    buildTable: buildTable,
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    getRelativeTime: getRelativeTime,
    debounce: debounce,
    escapeHTML: escapeHTML,
    createFilterBar: createFilterBar,
    showEmptyState: showEmptyState
  };
})();
