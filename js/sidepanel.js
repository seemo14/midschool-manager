/**
 * MSM Sidepanel Module
 * Contextual slide-out panel for detail views.
 * Desktop: 420px from right. Mobile: full screen.
 * Attaches to window.MSM.Sidepanel
 */
(function () {
  'use strict';
  window.MSM = window.MSM || {};

  var _panel = null;
  var _backdrop = null;

  function open(options) {
    options = options || {};
    close(); // close any existing panel

    // Backdrop
    _backdrop = document.createElement('div');
    _backdrop.className = 'sidepanel-backdrop';

    // Panel
    _panel = document.createElement('div');
    _panel.className = 'sidepanel';
    _panel.setAttribute('role', 'complementary');
    _panel.setAttribute('aria-label', options.title || 'Detail panel');

    // Header
    var header = document.createElement('div');
    header.className = 'sidepanel__header';

    var titleEl = document.createElement('h3');
    titleEl.textContent = options.title || '';
    header.appendChild(titleEl);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'sidepanel__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', close);
    header.appendChild(closeBtn);

    // Body
    var body = document.createElement('div');
    body.className = 'sidepanel__body';
    if (typeof options.content === 'string') {
      body.innerHTML = options.content;
    } else if (options.content instanceof HTMLElement) {
      body.appendChild(options.content);
    }

    _panel.appendChild(header);
    _panel.appendChild(body);

    // Optional actions footer
    if (options.actions && options.actions.length > 0) {
      var actionsEl = document.createElement('div');
      actionsEl.className = 'sidepanel__actions';
      for (var i = 0; i < options.actions.length; i++) {
        var action = options.actions[i];
        var btn = document.createElement('button');
        btn.className = 'btn ' + (action.className || 'btn-secondary');
        btn.textContent = action.label || '';
        if (action.onClick) {
          (function (cb) {
            btn.addEventListener('click', cb);
          })(action.onClick);
        }
        actionsEl.appendChild(btn);
      }
      _panel.appendChild(actionsEl);
    }

    document.body.appendChild(_backdrop);
    document.body.appendChild(_panel);

    // Trigger animation
    requestAnimationFrame(function () {
      _panel.classList.add('sidepanel--open');
      _backdrop.classList.add('sidepanel-backdrop--visible');
    });

    // Close on backdrop click
    _backdrop.addEventListener('click', close);

    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!_panel) return;

    _panel.classList.remove('sidepanel--open');
    _backdrop.classList.remove('sidepanel-backdrop--visible');

    var panel = _panel;
    var backdrop = _backdrop;

    setTimeout(function () {
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
      if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }, 300);

    _panel = null;
    _backdrop = null;
    document.body.style.overflow = '';
  }

  function getBody() {
    return _panel ? _panel.querySelector('.sidepanel__body') : null;
  }

  function isOpen() {
    return !!_panel;
  }

  MSM.Sidepanel = {
    open: open,
    close: close,
    getBody: getBody,
    isOpen: isOpen
  };
})();
