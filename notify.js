/* HIPCO notifications (OneSignal web push). Everyone who has the app gets every new-list alert — no names to pick.
   A phone only needs to say "Allow" once; after that it is subscribed automatically every time the app opens. */
(function(){
  var APP_ID='9722a093-2b4b-4002-a1d8-bc4910456d78', SNOOZE='hipco_notif_snooze';
  var sdkFailed=false, ready=false;
  var ios=/iphone|ipad|ipod/i.test(navigator.userAgent), standalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  function isOn(){ try{ return window.Notification&&Notification.permission==='granted'; }catch(e){ return false; } }
  function isBlocked(){ try{ return window.Notification&&Notification.permission==='denied'; }catch(e){ return false; } }
  // record this phone in the shared database too (so every phone is counted even if OneSignal is slow)
  async function register(OneSignal){
    try{
      var C=window.HIPCO_CFG||{}; if(!C.supabaseUrl) return false;
      var sid=(OneSignal.User.PushSubscription&&OneSignal.User.PushSubscription.id)||'', oid=OneSignal.User.onesignalId||'';
      if(!sid&&!oid) return false;
      var h={apikey:C.anonKey,'x-hipco':C.dbCode,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'};
      var r=await fetch(C.supabaseUrl.replace(/\/$/,'')+'/rest/v1/kv',{method:'POST',headers:h,body:JSON.stringify({col:'push',id:sid||('u_'+oid),data:{names:['ALL'],sid:sid,oid:oid,ua:navigator.userAgent.slice(0,80),at:Date.now()}})});
      return r.ok;
    }catch(e){ return false; }
  }
  async function enroll(OneSignal){   // make sure this phone is subscribed, then record it
    try{ if(OneSignal.User.PushSubscription&&!OneSignal.User.PushSubscription.optedIn) await OneSignal.User.PushSubscription.optIn(); }catch(e){}
    var ok=false; for(var t=0;t<6&&!ok;t++){ ok=await register(OneSignal); if(!ok) await new Promise(function(r){ setTimeout(r,1000); }); }
    return ok;
  }
  window.OneSignalDeferred=window.OneSignalDeferred||[];
  OneSignalDeferred.push(async function(OneSignal){
    try{
      await OneSignal.init({appId:APP_ID,serviceWorkerPath:'Hipco-Lists/sw.js',serviceWorkerParam:{scope:'/Hipco-Lists/'},notifyButton:{enable:false}});
      ready=true;
      if(isOn()) await enroll(OneSignal);          // already allowed → fully automatic, nothing to tap
      paint(); autoAsk();
    }catch(e){ sdkFailed=true; paint(); }
  });
  var s=document.createElement('script'); s.src='https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer=true; s.onerror=function(){ sdkFailed=true; paint(); }; document.head.appendChild(s);

  var css=document.createElement('style'); css.textContent=
   '.nt-btn{display:flex;align-items:center;justify-content:center;gap:8px;margin:18px auto 0;padding:11px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:#fff;font:600 14px/1 -apple-system,system-ui,sans-serif;max-width:340px;width:calc(100% - 40px)}'+
   '.nt-btn.on{background:rgba(90,200,140,.22);border-color:rgba(120,220,160,.6)}'+
   '.nt-back{position:fixed;inset:0;background:rgba(10,20,50,.6);z-index:99999;display:flex;align-items:flex-end;justify-content:center}'+
   '.nt-box{background:#fff;color:#12275C;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:22px 20px calc(24px + env(safe-area-inset-bottom,0px));font-family:-apple-system,system-ui,sans-serif;text-align:center}'+
   '.nt-box h3{margin:0 0 6px;font-size:20px}.nt-box p{margin:0 0 16px;color:#5A6687;font-size:14.5px;line-height:1.45}'+
   '.nt-go{width:100%;padding:15px;border-radius:12px;border:0;background:#1F4283;color:#fff;font:700 17px system-ui}.nt-go[disabled]{opacity:.45}'+
   '.nt-x{width:100%;margin-top:8px;padding:12px;border:0;background:none;color:#5A6687;font:600 14px system-ui}'+
   '.nt-msg{margin:10px 0 0;font-size:13.5px;color:#1F4283;font-weight:600;min-height:18px}';
  document.head.appendChild(css);

  function btn(){ return document.getElementById('ntBtn'); }
  function paint(){ var b=btn(); if(!b) return; var on=isOn(); b.className='nt-btn'+(on?' on':''); b.textContent=on?'🔔 Notifications are on ✓':'🔔 Turn on notifications'; }
  function open(auto){
    if(document.querySelector('.nt-back')) return;
    var back=document.createElement('div'); back.className='nt-back';
    var needHome=ios&&!standalone, blocked=isBlocked();
    var txt=needHome?'On iPhone: tap <b>Share</b> → <b>Add to Home Screen</b>, then open HIPCO from the <b>home screen icon</b> and allow notifications there.'
      :blocked?'Notifications are blocked for this app. Open your phone <b>Settings → Notifications → HIPCO</b> (or Chrome → Site settings), allow them, then come back.'
      :'You will get an alert on this phone every time a new list is added. Tap the button, then <b>Allow</b>.<br><span dir="rtl">ستصلك رسالة عند كل لائحة جديدة — اضغط ثم «السماح»</span>';
    back.innerHTML='<div class="nt-box"><h3>🔔 Get new-list alerts</h3><p>'+txt+'</p><button class="nt-go" '+((needHome||blocked)?'disabled':'')+'>Allow notifications</button><div class="nt-msg"></div><button class="nt-x">'+(auto?'Not now':'Close')+'</button></div>';
    var go=back.querySelector('.nt-go'), msg=back.querySelector('.nt-msg');
    back.querySelector('.nt-x').onclick=function(){ if(auto){ try{ localStorage.setItem(SNOOZE,String(Date.now())); }catch(e){} } back.remove(); };
    go.onclick=function(){
      if(sdkFailed){ msg.textContent='Could not reach the notification service. Check your internet and try again.'; return; }
      msg.textContent='Waiting for your permission…';
      OneSignalDeferred.push(async function(OneSignal){
        try{
          await OneSignal.Notifications.requestPermission();
          if(!isOn()){ msg.textContent='Notifications were not allowed. You can allow them later in your phone Settings.'; return; }
          var reg=await enroll(OneSignal); paint();
          msg.textContent=reg?'Done ✓ This phone will get every new-list alert.':'Allowed ✓ — reopen the app once to finish.';
          setTimeout(function(){ back.remove(); },3500);
        }catch(e){ msg.textContent='Something went wrong. Close and try again.'; }
      });
    };
    document.body.appendChild(back);
  }
  // the first time (and once a day if he said "Not now") the app asks by itself — one tap on Allow is all a phone needs
  function autoAsk(){
    if(isOn()||isBlocked()||sdkFailed) return;
    var last=0; try{ last=+localStorage.getItem(SNOOZE)||0; }catch(e){}
    if(Date.now()-last<20*3600*1000) return;
    setTimeout(function(){ if(!isOn()) open(true); },2500);
  }
  function mount(){
    var h=document.getElementById('homeScreen'); if(!h||btn()) return;
    var b=document.createElement('button'); b.type='button'; b.id='ntBtn'; b.onclick=function(){ open(false); }; h.appendChild(b); paint();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
