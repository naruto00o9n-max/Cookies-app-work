const CACHE = __COOKIES_CACHE__;
const SHELL = __COOKIES_SHELL__;
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate', event => {event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cookies-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 // Never store OAuth, API responses, account data or third-party requests.
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/app/'))return;
 if(event.request.mode==='navigate') {
  event.respondWith(fetch(event.request).catch(()=>caches.match('/app/index.html')));return;
 }
 if(!/\.(?:js|css|ttf|woff2?|png|webmanifest)$/.test(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(event.request);if(cached)return cached;
  const response=await fetch(event.request);
  if(response.ok)await cache.put(event.request,response.clone());return response;
 }));
});
self.addEventListener('push',event=>{
 let payload;try {payload=event.data?.json();}catch{return;}
 if(!payload?.title||!payload?.body)return;
 const data=payload.data||{},url=new URL('/app/',self.location.origin);
 if(typeof data.work==='string'){url.searchParams.set('work',data.work);if(data.chapter)url.searchParams.set('chapter',data.chapter);}
 else if(data.screen==='Reports')url.searchParams.set('screen','Reports');
 const tag=data.work?`chapter:${data.work}:${data.chapter||''}`:undefined;
 event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/app/icon-192.png',badge:'/app/badge.png',tag,data:{url:url.href}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const target=new URL(event.notification.data?.url||'/app/',self.location.origin);
 if(target.origin!==self.location.origin||!target.pathname.startsWith('/app/'))return;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  const client=clients.find(c=>new URL(c.url).origin===target.origin&&new URL(c.url).pathname.startsWith('/app/'));
  if(client){await client.navigate(target.href);return client.focus();}
  return self.clients.openWindow(target.href);
 }));
});
