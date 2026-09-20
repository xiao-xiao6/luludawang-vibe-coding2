/* 打地鼠大作战 · 田园守护战 —— 离线缓存 Service Worker
   策略：预缓存入口；静态同源资源 stale-while-revalidate；导航请求 network-first 回退缓存。
   单文件游戏本体已内联，这里只兜底 index.html 与图标。 */
const CACHE = 'whack-v1.4';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './og.png'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(ASSETS.map(function(u){
        return c.add(new Request(u, {cache:'reload'})).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(function(res){
        const cp = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', cp); });
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(hit){
      const net = fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === 'basic'){
          const cp = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, cp); });
        }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
