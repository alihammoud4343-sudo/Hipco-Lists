/* HIPCO notifications (OneSignal web push). Each salesman picks his name once; the sender targets that name. */
(function(){
  var APP_ID='9722a093-2b4b-4002-a1d8-bc4910456d78', KEY='hipco_notif_name', NAMES=['Ahmad','Nadine','Ouseili','Wissam','Ali','Bob','Mohamad'];
  var ready=false, sdkFailed=false;
  function get(){ try{ return localStorage.getItem(KEY)||''; }catch(e){ return ''; } }
  function set(v){ try{ localStorage.setItem(KEY,v); }catch(e){} }
  var ios=/iphone|ipad|ipod/i.test(navigator.userAgent), standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  OneSignalDeferred.push(async function(OneSignal){
    try{
      await OneSignal.init({appId:APP_ID,serviceWorkerPath:'Hipco-Lists/sw.js',serviceWorkerParam:{scope:'/Hipco-Lists/'},notifyButton:{enable:false}});
      ready=true; var n=get(); if(n){ try{ OneSignal.User.addTag('salesman',n); }catch(e){} } paint();
    }catch(e){ sdkFailed=true; paint(); }
  });
  var s=document.createElement('script'); s.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer=true; s.onerror=function(){ sdkFailed=true; paint(); }; document.head.appendChild(s);

  var css=document.createElement('style'); css.textContent=
   '.nt-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:18px auto 0;padding:11px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;font:600 14px/1 -apple-system,system-ui,sans-serif;max-width:340px;width:calc(100% - 40px)}'+
   '.nt-btn.on{background:rgba(90,200,140,.22);border-color:rgba(120,220,160,.6)}'+
   '.nt-back{position:fixed;inset:0;background:rgba(10,20,50,.6);z-index:99999;display:flex;align-items:flex-end;justify-content:center}'+
   '.nt-box{background:#fff;color:#12275C;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:20px 20px calc(24px + env(safe-area-inset-bottom,0px));font-family:-apple-system,system-ui,sans-serif}'+
   '.nt-box h3{margin:0 0 4px;font-size:19px}.nt-box p{margin:0 0 14px;color:#5A6687;font-size:14px;line-height:1.4}'+
   '.nt-names{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}'+
   '.nt-names button{padding:12px;border-radius:12px;border:1.5px solid #D6DFF0;background:#fff;font:600 15px system-ui;color:#12275C}'+
   '.nt-names button.sel{background:#1F4283;color:#fff;border-color:#1F4283}'+
   '.nt-go{width:100%;padding:14px;border-radius:12px;border:0;background:#1F4283;color:#fff;font:700 16px system-ui}.nt-go[disabled]{opacity:.45}'+
   '.nt-x{width:100%;margin-top:8px;padding:12px;border:0;background:none;color:#5A6687;font:600 14px system-ui}'+
   '.nt-msg{margin:10px 0 0;font-size:13px;color:#1F4283;font-weight:600;min-height:18px}';
  document.head.appendChild(css);

  function btn(){ return document.getElementById('ntBtn'); }
  function paint(){ var b=btn(); if(!b) return; var n=get(); b.className='nt-btn'+(n?' on':''); b.textContent=(n?'🔔 Notifications on — '+n:'🔔 Turn on notifications'); }
  function open(){
    var back=document.createElement('div'); back.className='nt-back'; var sel=get();
    var needHome=ios&&!standalone;
    back.innerHTML='<div class="nt-box"><h3>Notifications</h3><p>'+(needHome?'On iPhone, open the app from the <b>home screen icon</b> first (not Safari), then come back here.':'Choose your name, then allow notifications when your phone asks.')+'</p><div class="nt-names"></div><button class="nt-go" '+(needHome?'disabled':'')+'>Turn on notifications</button><div class="nt-msg"></div><button class="nt-x">Close</button></div>';
    var wrap=back.querySelector('.nt-names'), go=back.querySelector('.nt-go'), msg=back.querySelector('.nt-msg');
    NAMES.forEach(function(n){ var b=document.createElement('button'); b.type='button'; b.textContent=n; if(n===sel) b.className='sel'; b.onclick=function(){ sel=n; [].forEach.call(wrap.children,function(x){ x.className=x===b?'sel':''; }); }; wrap.appendChild(b); });
    back.querySelector('.nt-x').onclick=function(){ back.remove(); };
    back.addEventListener('click',function(e){ if(e.target===back) back.remove(); });
    go.onclick=function(){
      if(!sel){ msg.textContent='Choose your name first.'; return; }
      if(sdkFailed){ msg.textContent='Could not reach the notification service. Check your internet and try again.'; return; }
      msg.textContent='Waiting for your permission…';
      OneSignalDeferred.push(async function(OneSignal){
        try{
          await OneSignal.Notifications.requestPermission();
          var ok=OneSignal.Notifications.permission;
          if(!ok){ msg.textContent='Notifications are blocked. Allow them in your phone Settings → Notifications → HIPCO, then try again.'; return; }
          try{ await OneSignal.login(sel); }catch(e){}
          await OneSignal.User.addTag('salesman',sel);
          set(sel); paint(); msg.textContent='Done ✓ You will get your new-list alerts, '+sel+'.';
          setTimeout(function(){ back.remove(); },1400);
        }catch(e){ msg.textContent='Something went wrong. Close and try again.'; }
      });
    };
    document.body.appendChild(back);
  }
  function mount(){
    var h=document.getElementById('homeScreen'); if(!h||btn()) return;
    var b=document.createElement('button'); b.type='button'; b.id='ntBtn'; b.onclick=open; h.appendChild(b); paint();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
