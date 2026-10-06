/* 打地鼠大作战 · 田园守护战 —— 离线缓存 Service Worker
   策略：预缓存「首屏真正用得到」的那一组；静态同源资源 stale-while-revalidate；导航请求 network-first 回退缓存。
   预缓存清单刻意只留默认（经典田园）一套：另外三套场地贴图与背景要等到玩家真的切到该画风时
   再由运行时 stale-while-revalidate 顺手缓存，省掉手机首装时几百 KB 的白下载（验收报告 P2-3）。 */
const CACHE = 'whack-v1.15';
const ASSETS = ['./', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './art/bg/bg1.webp',
  './art/hole_v2/grass.png', './art/hole_v2/hole-back.png', './art/hole_v2/hole-front.png'];
/* 按需缓存（不预下载）：另外三套场地贴图 art/hole_v2/{steam,pixel,ink}/、其余三张页面背景、
   像素主题字体 art/font/pixel-subset.woff2 —— 玩家切到对应画风时由 stale-while-revalidate 顺手缓存。
   og.png 只给社交爬虫抓，玩家设备永远不展示，已从清单移除。 */

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
