/* 大肥鱼桌宠 · Service Worker
   只为了让页面可以被「安装到主屏幕」并进入 standalone 全屏，
   不做任何缓存（素材 107MB，缓存反而拖累）。 */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(){
  /* 空处理器：请求直连网络，仅满足可安装性检查 */
});