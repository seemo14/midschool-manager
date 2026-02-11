var CACHE_NAME = 'msm-cache-v3';

// Use relative paths so it works on any subdirectory (e.g. GitHub Pages /repo-name/)
var CORE_ASSETS = [
  './',
  './index.html',
  './lessons.html',
  './materials.html',
  './plans.html',
  './calendar.html',
  './students.html',
  './assessments.html',
  './remedial.html',
  './settings.html',
  './css/main.css',
  './js/storage.js',
  './js/data-models.js',
  './js/csv-parser.js',
  './js/ui-helpers.js',
  './js/ai-service.js',
  './js/curriculum.js',
  './js/ics-parser.js',
  './js/app.js',
  './js/dashboard.js',
  './js/lessons.js',
  './js/materials.js',
  './js/plans.js',
  './js/calendar-view.js',
  './js/students.js',
  './js/assessments.js',
  './js/remedial.js',
  './js/settings.js',
  './js/attendance.js',
  './js/reports.js',
  './js/validation.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// Install: pre-cache the core app shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Pre-caching core assets');
      return cache.addAll(CORE_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) {
          return name !== CACHE_NAME;
        }).map(function(name) {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: cache-first for static assets, network-first for navigation/API
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (e.g. Gemini API calls)
  if (request.url.indexOf(self.location.origin) === -1) {
    return;
  }

  // Cache-first strategy for static assets (html, css, js, images, manifest)
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then(function(cachedResponse) {
        if (cachedResponse) {
          // Return cached version, but also update cache in background
          fetchAndCache(request);
          return cachedResponse;
        }
        // Not in cache, fetch from network and cache it
        return fetchAndCache(request);
      }).catch(function() {
        // Offline fallback for HTML pages
        if (request.headers.get('Accept') && request.headers.get('Accept').indexOf('text/html') !== -1) {
          return caches.match('./index.html');
        }
      })
    );
  } else {
    // Network-first for everything else
    event.respondWith(
      fetch(request).then(function(networkResponse) {
        // Cache a copy of the successful response
        if (networkResponse && networkResponse.status === 200) {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(function() {
        return caches.match(request);
      })
    );
  }
});

// Helper: determine if a URL points to a static asset
function isStaticAsset(url) {
  var staticExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.ico', '.woff', '.woff2', '.ttf'];
  var lowerUrl = url.toLowerCase();

  // manifest.json is a static asset
  if (lowerUrl.indexOf('manifest.json') !== -1) {
    return true;
  }

  for (var i = 0; i < staticExtensions.length; i++) {
    if (lowerUrl.indexOf(staticExtensions[i]) !== -1) {
      return true;
    }
  }
  return false;
}

// Helper: fetch from network and store in cache
function fetchAndCache(request) {
  return fetch(request).then(function(networkResponse) {
    if (networkResponse && networkResponse.status === 200) {
      var responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(request, responseClone);
      });
    }
    return networkResponse;
  });
}
