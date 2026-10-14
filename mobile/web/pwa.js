if(window.location.pathname==='/app')window.location.replace('/app/'+window.location.search+window.location.hash);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();window.cookiesInstallPrompt=event;window.dispatchEvent(new Event('cookies-install-ready'));});
window.addEventListener('appinstalled',()=>{window.cookiesInstallPrompt=null;window.dispatchEvent(new Event('cookies-installed'));});
if('serviceWorker' in navigator&&window.isSecureContext)window.addEventListener('load',()=>{navigator.serviceWorker.register('/app/sw.js',{scope:'/app/'}).catch(()=>{});});
