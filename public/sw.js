// Service Worker Version Management
const SW_VERSION = '2.1.0';
const CACHE_NAME = `roombook-v${SW_VERSION}`;
const STATIC_CACHE = `static-${SW_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${SW_VERSION}`;
const API_CACHE = `api-${SW_VERSION}`;

// Deployment Integration
let lastDeploymentCheck = 0;
const DEPLOYMENT_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Cache Configuration
const CACHE_CONFIG = {
  static: {
    name: STATIC_CACHE,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    urls: [
    //  '/',
    //  '/dashboard',
    //  '/login',
    //  '/reservations/new',
    //  '/reservations/my',
      '/manifest.json',
      '/icons/icon-192x192.png',
      '/icons/icon-512x512.png'
    ]
  },
  dynamic: {
    name: DYNAMIC_CACHE,
    maxAge: 60 * 60 * 1000, // 1 hour
    maxEntries: 50
  },
  api: {
    name: API_CACHE,
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 100
  }
};

// 🔧 Service Worker 설치 이벤트
self.addEventListener('install', (event) => {
  console.log(`Service Worker v${SW_VERSION} 설치 중...`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('정적 캐시 생성 완료');
        return cache.addAll(CACHE_CONFIG.static.urls);
      })
      .then(() => {
        console.log('Service Worker 설치 완료, 즉시 활성화');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker 설치 실패:', error);
      })
  );
});

// 🔧 Service Worker 활성화 이벤트
self.addEventListener('activate', (event) => {
  console.log(`Service Worker v${SW_VERSION} 활성화 중...`);
  event.waitUntil(
    Promise.all([
      // 오래된 캐시 정리
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.includes(SW_VERSION) && cacheName !== 'deployment-info') {
              console.log('오래된 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 모든 클라이언트에게 새 버전 알림
      self.clients.claim().then(() => {
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SW_UPDATED',
              version: SW_VERSION,
              message: '새로운 버전이 활성화되었습니다.'
            });
          });
        });
      }),
      // Initial deployment check
      handleDeploymentCheck()
    ])
  );
});

// 🔧 네트워크 요청 처리 (Stale-While-Revalidate 전략)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

    // ==================================================================
  // ✅ 여기에 예외 처리 코드를 추가합니다.
  // ==================================================================
  // Supabase 인증 콜백 경로는 서비스 워커가 절대로 가로채면 안 됩니다.
  // 서버에서 세션을 교환해야 하므로, 네트워크로 직접 요청을 보내야 합니다.
  if (url.pathname === '/auth/callback') {
    console.log('인증 콜백 요청(/auth/callback)은 서비스 워커를 통과합니다.');
    // event.respondWith()를 호출하지 않고 return하여 브라우저가 기본 동작을 하도록 합니다.
    return;
  }
  // ==================================================================

  // POST, PUT, DELETE 등의 요청은 네트워크만 사용
  if (event.request.method !== 'GET') {
    // POST 요청은 네트워크로 바로 보냅니다.
    // 만약 온라인 상태가 아니면 브라우저가 기본적으로 실패 처리합니다.
    return; 
  }

  // POST, PUT, DELETE 등의 요청은 네트워크만 사용
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // API 요청 처리
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // 정적 자원 처리
  if (isStaticResource(event.request)) {
    event.respondWith(handleStaticResource(event.request));
    return;
  }

  // 동적 페이지 처리 (Stale-While-Revalidate)
  event.respondWith(handleDynamicRequest(event.request));
});

// API 요청 처리 (짧은 캐시 + 백그라운드 업데이트)
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);
  
  // 캐시된 응답이 있고 아직 유효한 경우
  if (cachedResponse && !isExpired(cachedResponse, CACHE_CONFIG.api.maxAge)) {
    // 백그라운드에서 업데이트
    updateCache(request, API_CACHE);
    return cachedResponse;
  }

  try {
    // 네트워크에서 새 데이터 가져오기
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // 성공적인 응답을 캐시에 저장
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
      return networkResponse;
    }
    
    // 네트워크 오류 시 오래된 캐시라도 반환
    return cachedResponse || networkResponse;
  } catch (error) {
    console.warn('API 요청 실패, 캐시된 응답 사용:', error);
    return cachedResponse || new Response('Network Error', { status: 503 });
  }
}

// 정적 자원 처리 (Cache First with Background Update)
async function handleStaticResource(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // 백그라운드에서 업데이트 확인
    if (isExpired(cachedResponse, CACHE_CONFIG.static.maxAge)) {
      updateCache(request, STATIC_CACHE);
    }
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
    }
    return networkResponse;
  } catch (error) {
    console.warn('정적 자원 로드 실패:', error);
    return new Response('Resource not available', { status: 503 });
  }
}

// 동적 페이지 처리 (Stale-While-Revalidate)
async function handleDynamicRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Stale-While-Revalidate: 캐시된 응답을 즉시 반환하고 백그라운드에서 업데이트
  if (cachedResponse) {
    // 백그라운드에서 업데이트
    updateCache(request, DYNAMIC_CACHE);
    return cachedResponse;
  }

  try {
    // 캐시에 없으면 네트워크에서 가져오기
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      await cache.put(request, responseToCache);
      
      // 캐시 크기 제한
      await limitCacheSize(DYNAMIC_CACHE, CACHE_CONFIG.dynamic.maxEntries);
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('동적 페이지 로드 실패:', error);
    return cachedResponse || new Response('Page not available offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// 백그라운드 캐시 업데이트
async function updateCache(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      console.log('백그라운드 캐시 업데이트 완료:', request.url);
      
      // 클라이언트에게 업데이트 알림
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'CACHE_UPDATED',
          url: request.url,
          timestamp: Date.now()
        });
      });
    }
  } catch (error) {
    console.warn('백그라운드 캐시 업데이트 실패:', error);
  }
}

// 캐시 만료 확인
function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  
  const responseTime = new Date(dateHeader).getTime();
  const now = Date.now();
  
  return (now - responseTime) > maxAge;
}

// 정적 자원 확인
function isStaticResource(request) {
  const url = new URL(request.url);
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  const staticPaths = ['/icons/', '/manifest.json'];
  
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
         staticPaths.some(path => url.pathname.includes(path));
}

// 캐시 크기 제한
async function limitCacheSize(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxEntries) {
    // 오래된 항목부터 삭제
    const keysToDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
    console.log(`캐시 크기 제한: ${keysToDelete.length}개 항목 삭제`);
  }
}

// 🔧 푸시 알림 처리
self.addEventListener('push', (event) => {
  console.log('푸시 알림 수신:', event);

  const data = event.data ? event.data.json() : {};
  const title = data.title || '회의실 예약 시스템';
  const options = {
    body: data.body || '새로운 알림이 있습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'general',
    renotify: true,
    actions: [
      {
        action: 'open',
        title: '열기',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: '닫기'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 🔧 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('알림 클릭:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // 알림 클릭 시 앱 열기
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // 이미 열린 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }

      // 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// 🔧 Deployment Integration - Message Handler
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'CHECK_DEPLOYMENT':
      handleDeploymentCheck();
      break;
    case 'INVALIDATE_CACHES':
      handleCacheInvalidation(data);
      break;
    case 'FORCE_UPDATE':
      handleForceUpdate();
      break;
    default:
      console.log('Unknown message type:', type);
  }
});

// 🔧 Deployment Detection
async function handleDeploymentCheck() {
  const now = Date.now();
  
  // Throttle deployment checks
  if (now - lastDeploymentCheck < DEPLOYMENT_CHECK_INTERVAL) {
    return;
  }
  
  lastDeploymentCheck = now;
  
  try {
    console.log('Checking for deployment updates...');
    
    // Fetch deployment info from server
    const response = await fetch('/api/deployment-info', {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch deployment info:', response.status);
      return;
    }
    
    const deploymentInfo = await response.json();
    const storedVersion = await getStoredVersion();
    
    // Check if this is a new deployment
    if (isNewDeployment(deploymentInfo, storedVersion)) {
      console.log('New deployment detected:', deploymentInfo);
      
      // Store new version info
      await storeVersion(deploymentInfo);
      
      // Notify clients about deployment
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'DEPLOYMENT_DETECTED',
          data: deploymentInfo
        });
      });
      
      // Optionally invalidate caches for new deployment
      await invalidateOldCaches(deploymentInfo);
    }
    
  } catch (error) {
    console.error('Deployment check failed:', error);
  }
}

// 🔧 Cache Invalidation Handler
async function handleCacheInvalidation(data) {
  console.log('Invalidating caches:', data);
  
  try {
    // Get all cache names
    const cacheNames = await caches.keys();
    
    // Delete all caches or specific ones based on data
    if (data && data.selective) {
      // Selective cache invalidation
      const cachesToDelete = cacheNames.filter(name => {
        return data.patterns?.some(pattern => name.includes(pattern));
      });
      
      await Promise.all(cachesToDelete.map(name => caches.delete(name)));
      console.log('Selectively invalidated caches:', cachesToDelete);
    } else {
      // Full cache invalidation
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('All caches invalidated');
    }
    
    // Notify clients about cache invalidation
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_INVALIDATED',
        data: {
          timestamp: Date.now(),
          cacheNames: cacheNames
        }
      });
    });
    
  } catch (error) {
    console.error('Cache invalidation failed:', error);
  }
}

// 🔧 Force Update Handler
async function handleForceUpdate() {
  console.log('Force update requested');
  
  try {
    // Skip waiting and claim clients immediately
    await self.skipWaiting();
    await self.clients.claim();
    
    // Invalidate all caches
    await handleCacheInvalidation();
    
    // Notify clients to reload
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'FORCE_RELOAD',
        data: {
          reason: 'force_update',
          timestamp: Date.now()
        }
      });
    });
    
  } catch (error) {
    console.error('Force update failed:', error);
  }
}

// 🔧 Version Storage Utilities
async function getStoredVersion() {
  try {
    const cache = await caches.open('deployment-info');
    const response = await cache.match('deployment-version');
    
    if (response) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Failed to get stored version:', error);
  }
  
  return null;
}

async function storeVersion(deploymentInfo) {
  try {
    const cache = await caches.open('deployment-info');
    const response = new Response(JSON.stringify(deploymentInfo), {
      headers: {
        'Content-Type': 'application/json',
        'Date': new Date().toUTCString()
      }
    });
    
    await cache.put('deployment-version', response);
    console.log('Stored deployment version:', deploymentInfo.version);
  } catch (error) {
    console.error('Failed to store version:', error);
  }
}

// 🔧 Deployment Comparison
function isNewDeployment(current, stored) {
  if (!stored) return true;
  
  // Compare version strings
  if (current.version !== stored.version) return true;
  
  // Compare build IDs
  if (current.buildId !== stored.buildId) return true;
  
  // Compare timestamps (allow some tolerance for clock differences)
  const timeDiff = Math.abs(current.timestamp - stored.timestamp);
  if (timeDiff > 60000) return true; // 1 minute tolerance
  
  return false;
}

// 🔧 Invalidate Old Caches
async function invalidateOldCaches(deploymentInfo) {
  try {
    const cacheNames = await caches.keys();
    
    // Keep deployment-info cache but delete others
    const cachesToDelete = cacheNames.filter(name => 
      name !== 'deployment-info' && !name.includes(SW_VERSION)
    );
    
    await Promise.all(cachesToDelete.map(name => caches.delete(name)));
    console.log('Invalidated old caches for new deployment:', cachesToDelete);
    
  } catch (error) {
    console.error('Failed to invalidate old caches:', error);
  }
}

// 🔧 Periodic Deployment Check
setInterval(() => {
  handleDeploymentCheck();
}, DEPLOYMENT_CHECK_INTERVAL);
