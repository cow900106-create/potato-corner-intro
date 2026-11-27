(function(w){
var PICKS=[
 {n:'奶油松露',t:'12/1 上市的新風味粉，搶先嘗鮮。',i:'new-creamy-truffle.webp',to:'#it-truffle'},
 {n:'熔岩起司枕',t:'酥脆外皮包著流心起司，一口咬下。',i:'new-cheese-pillow.webp',to:'#it-pillow'},
 {n:'香菜爆擊風味',t:'香菜控請尖叫，一口接一口。',i:'season-coriander.webp',to:'#it-coriander'},
 {n:'莓好氣泡醋飲',t:'清爽酸甜的氣泡感，好解膩。統一時代B2門市限定。',i:'season-berry-fizz.webp',to:'#it-berry'},
 {n:'歡樂派對三拼 $278',t:'薯條、捲捲薯、雞米花一次吃到。',i:'icons/party.webp',sq:1,to:'#it-party'},
 {n:'雙拼套餐 A $200',t:'兩份薯條加一杯飲料，選 2 種口味。',i:'icons/combo.webp',sq:1,to:'#it-combo'},
 {n:'捲捲薯 $138',t:'一圈一圈的酥脆，搖上你愛的粉。',i:'icons/loopy.webp',sq:1,to:'#it-loopy'},
 {n:'雞米花 $158',t:'外酥內嫩，一口一顆停不下來。',i:'icons/pops.webp',sq:1,to:'#it-pops'},
 {n:'微笑薯餅 $138',t:'笑臉造型的薯餅，加購價 $38。',i:'icons/smiley.webp',sq:1,to:'#it-smiley'},
 {n:'招牌薯條 中份 $128',t:'經典薯條，現炸現搖。',i:'icons/fries.webp',sq:1,to:'#it-fries'}
];
var lastPick=-1;
function asset(p){return '../assets/'+p+'?v=11'}
function pickHtml(){
  var k;do{k=Math.floor(Math.random()*PICKS.length)}while(k===lastPick&&PICKS.length>1);
  lastPick=k;var p=PICKS[k];
  return '<div class="rec"><span class="recl">今天必點</span><div class="recb"><img'+(p.sq?' class="sq"':'')+' src="'+asset(p.i)+'" alt="'+p.n+'" width="68" height="68"><div><b>'+p.n+'</b><span class="rt">'+p.t+'</span></div></div><a class="go" href="../index.html'+p.to+'">看這一項</a></div>';
}
function getBest(key){
  try{return parseInt(localStorage.getItem(key)||'0',10)||0}catch(e){return 0}
}
function setBest(key,n){
  try{localStorage.setItem(key,String(n))}catch(e){}
}
function loadImg(src){
  var im=new Image();
  im.src=asset(src);
  return im;
}
var zoomGuarded=false;
function isTapControl(el){
  return !!(el&&el.closest&&el.closest('button,a,input,select,textarea,label,.btn,.gcard,.cell,.fryer,.slot,.st,.drink-eq,.trash-eq,.cust,.mcard,.item,.qbtn,.kbtn,.kart-item,.hud-mute,.runback,.tdbtn,.tdpan,.td-spd,.td-next,.pbtn,.pinpads,.bub-next,.bbtn'));
}
function isHudControl(el){
  return !!(el&&el.closest&&el.closest('button,a,input,select,textarea,label,.btn,.gcard,.cell,.fryer,.slot,.st,.drink-eq,.trash-eq,.cust,.mcard,.item,.qbtn,.kbtn,.kart-item,.qpads,.kpads,.karthud,.overlay,.shop-tophud,.hud-mute,.quest-mute,.kart-mute,.tdbtn,.tdpan,.tdhud,.td-spd,.td-next,.pbtn,.pinpads,.pinhud,.bub-next,.bubhud,.bbtn'));
}
function guardZoom(){
  if(zoomGuarded)return;
  zoomGuarded=true;
  var opt={capture:true,passive:false};
  function stopGest(e){if(e.cancelable)e.preventDefault()}
  document.addEventListener('gesturestart',stopGest,opt);
  document.addEventListener('gesturechange',stopGest,opt);
  document.addEventListener('gestureend',stopGest,opt);
  var lastEnd=0;
  document.addEventListener('touchend',function(e){
    var now=Date.now();
    var gap=now-lastEnd;
    lastEnd=now;
    if(gap>=350)return;
    if(e.touches&&e.touches.length>0)return;
    if(!e.cancelable)return;
    e.preventDefault();
    /* replay click for shop/match controls that listen on click, not pointerdown */
    var t=e.target&&isTapControl(e.target)?e.target.closest('button,a,input,select,textarea,label,.btn,.gcard,.cell,.fryer,.slot,.st,.drink-eq,.trash-eq,.cust,.mcard,.item,.qbtn,.kbtn,.kart-item'):null;
    if(t&&typeof t.click==='function')t.click();
  },opt);
  function blockPinch(e){
    if(!e.touches||e.touches.length<2)return;
    /* allow simultaneous left+right virtual buttons; block pinch on the canvas/stage */
    if(!isHudControl(e.target)&&e.cancelable)e.preventDefault();
  }
  document.addEventListener('touchstart',blockPinch,opt);
  document.addEventListener('touchmove',blockPinch,opt);
}
guardZoom();

var audio=(function(){
  var key='pcGameMuted',muted=false,ctx=null,master=null,bgmGain=null,sfxGain=null;
  var unlocked=false,btn=null,wantedBgm=null;
  var bgm={on:false,style:'shop',step:0,next:0,timer:0,beat:0.25};
  function loadMute(){
    try{muted=localStorage.getItem(key)==='1'}catch(e){muted=false}
  }
  function saveMute(){
    try{localStorage.setItem(key,muted?'1':'0')}catch(e){}
  }
  function configure(opts){
    opts=opts||{};
    if(opts.key)key=opts.key;
    if(opts.button)btn=opts.button;
    loadMute();
    syncBtn();
    if(btn&&!btn._pcAudioBound){
      btn._pcAudioBound=true;
      btn.addEventListener('click',function(e){
        if(e&&e.stopPropagation)e.stopPropagation();
        unlock();
        setMuted(!muted);
      });
    }
    return api;
  }
  function unlock(){
    var AC=w.AudioContext||w.webkitAudioContext;
    if(!AC)return null;
    if(!ctx){
      ctx=new AC();
      master=ctx.createGain();
      master.gain.value=muted?0:0.9;
      master.connect(ctx.destination);
      sfxGain=ctx.createGain();
      sfxGain.gain.value=1;
      sfxGain.connect(master);
      bgmGain=ctx.createGain();
      bgmGain.gain.value=0.2;
      bgmGain.connect(master);
    }
    if(ctx.state==='suspended')ctx.resume();
    unlocked=true;
    return {ctx:ctx,master:master,sfx:sfxGain,bgm:bgmGain};
  }
  function applyMute(){
    if(!master||!ctx)return;
    var t=ctx.currentTime;
    var v=muted?0:0.9;
    master.gain.cancelScheduledValues(t);
    master.gain.value=v;
    master.gain.setValueAtTime(v,t);
  }
  function setMuted(on){
    muted=!!on;
    saveMute();
    applyMute();
    syncBtn();
  }
  function syncBtn(){
    if(!btn)return;
    btn.setAttribute('aria-pressed',muted?'true':'false');
    btn.setAttribute('aria-label',muted?'已靜音，點擊開啟音效':'音效開啟，點擊靜音');
    btn.title=muted?'已靜音':'音效開';
    btn.textContent=muted?'靜音':'聲音';
  }
  function env(g,t,peak,a,h,r){
    a=a==null?0.01:a;h=h==null?0.06:h;r=r==null?0.12:r;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(peak,t+a);
    g.gain.setValueAtTime(peak,t+a+h);
    g.gain.exponentialRampToValueAtTime(0.0001,t+a+h+r);
  }
  function out(node,bus){(bus||sfxGain||master).connect?node.connect(bus||sfxGain||master):null}
  function oscTone(type,freq,freq2,t,dur,peak,bus,filt){
    if(!ctx||!sfxGain)return;
    var o=ctx.createOscillator();
    o.type=type||'sine';
    o.frequency.setValueAtTime(freq,t);
    if(freq2&&freq2!==freq)o.frequency.exponentialRampToValueAtTime(Math.max(1,freq2),t+dur);
    var g=ctx.createGain();
    env(g,t,peak,Math.min(0.02,dur*0.2),Math.max(0.01,dur*0.35),Math.max(0.04,dur*0.5));
    if(filt){
      var f=ctx.createBiquadFilter();
      f.type=filt.type||'lowpass';
      f.frequency.value=filt.freq||1200;
      if(filt.q)f.Q.value=filt.q;
      o.connect(f);f.connect(g);
    }else o.connect(g);
    g.connect(bus||sfxGain);
    o.start(t);o.stop(t+dur+0.08);
  }
  function noiseBurst(t,dur,peak,bus,filt){
    if(!ctx||!sfxGain)return;
    var n=Math.max(1,Math.floor(ctx.sampleRate*Math.max(dur,0.04)));
    var b=ctx.createBuffer(1,n,ctx.sampleRate);
    var d=b.getChannelData(0);
    for(var i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,0.45);
    var src=ctx.createBufferSource();src.buffer=b;
    var g=ctx.createGain();
    env(g,t,peak,0.004,dur*0.25,dur*0.7);
    if(filt){
      var f=ctx.createBiquadFilter();
      f.type=filt.type||'highpass';
      f.frequency.value=filt.freq||800;
      if(filt.q)f.Q.value=filt.q;
      src.connect(f);f.connect(g);
    }else src.connect(g);
    g.connect(bus||sfxGain);
    src.start(t);src.stop(t+dur+0.05);
  }
  function kick(t,bus,peak){
    oscTone('sine',120,42,t,0.16,peak||0.22,bus,{type:'lowpass',freq:300});
  }
  function snare(t,bus,peak){
    noiseBurst(t,0.07,peak||0.08,bus,{type:'bandpass',freq:1800,q:0.8});
    oscTone('triangle',220,140,t,0.06,(peak||0.08)*0.35,bus,{type:'lowpass',freq:1200});
  }
  function hat(t,bus,peak){
    noiseBurst(t,0.035,peak||0.03,bus,{type:'highpass',freq:5000});
  }
  function bass(t,freq,bus,peak,dur){
    oscTone('triangle',freq,freq*0.98,t,dur||0.2,peak||0.16,bus,{type:'lowpass',freq:520});
    oscTone('sine',freq*0.5,freq*0.5,t,(dur||0.2)*1.1,(peak||0.16)*0.45,bus,{type:'lowpass',freq:220});
  }
  function lead(t,freq,bus,peak,dur){
    oscTone('triangle',freq,freq,t,dur||0.16,peak||0.07,bus,{type:'lowpass',freq:2400});
  }
  function chord(t,freqs,bus,peak){
    for(var i=0;i<freqs.length;i++)oscTone('sine',freqs[i],freqs[i],t,0.28,(peak||0.04)/(i+1),bus,{type:'lowpass',freq:1800});
  }

  var STYLES={
    shop:{bpm:108,fn:function(s,t,bus){
      var i=s%16;
      var roots=[130.81,98.00,110.00,87.31];
      var bar=(s>>4)%4;
      if(i===0||i===8)kick(t,bus,0.16);
      if(i===4||i===12)snare(t,bus,0.045);
      if(i===2||i===6||i===10||i===14)hat(t,bus,0.028);
      if(i%4===0)bass(t,roots[bar],bus,0.15,0.26);
      var hook=[[0,523.25],[4,659.25],[8,587.33],[10,783.99],[12,659.25],[14,523.25]];
      for(var k=0;k<hook.length;k++)if(hook[k][0]===i)lead(t,hook[k][1],bus,0.055,0.14);
      if(i===0)chord(t,[261.63,329.63,392.00],bus,0.03);
    }},
    run:{bpm:130,fn:function(s,t,bus){
      var i=s%16;
      var roots=[82.41,82.41,110.00,123.47];
      var bar=(s>>4)%4;
      if(i===0||i===6||i===8||i===14)kick(t,bus,0.2);
      if(i===4||i===12)snare(t,bus,0.07);
      if(i%2===1)hat(t,bus,0.025);
      if(i%2===0)bass(t,roots[bar]*(i%4===2?1.5:1),bus,0.15,0.14);
      var riff=[[0,329.63],[3,392.00],[6,493.88],[8,392.00],[11,329.63],[14,493.88]];
      for(var k=0;k<riff.length;k++)if(riff[k][0]===i)lead(t,riff[k][1],bus,0.06,0.11);
    }},
    catch:{bpm:118,fn:function(s,t,bus){
      var i=s%16;
      var roots=[146.83,110.00,130.81,98.00];
      var bar=(s>>4)%4;
      if(i===0||i===8)kick(t,bus,0.15);
      if(i===4||i===12)snare(t,bus,0.04);
      if(i===2||i===6||i===10||i===14)hat(t,bus,0.03);
      if(i%4===0)bass(t,roots[bar],bus,0.14,0.22);
      var hook=[[0,587.33],[2,659.25],[4,783.99],[8,659.25],[10,587.33],[12,880.00],[14,783.99]];
      for(var k=0;k<hook.length;k++)if(hook[k][0]===i)lead(t,hook[k][1],bus,0.05,0.12);
    }},
    match:{bpm:96,fn:function(s,t,bus){
      var i=s%16;
      var arp=[[261.63,329.63,392.00,523.25],[246.94,293.66,369.99,493.88],[220.00,277.18,329.63,440.00],[196.00,246.94,293.66,392.00]];
      var bar=(s>>4)%4;
      if(i===0)bass(t,arp[bar][0]/2,bus,0.11,0.42);
      if(i%2===0)lead(t,arp[bar][(i/2)%4],bus,0.05,0.22);
      if(i===0)chord(t,[arp[bar][0],arp[bar][1],arp[bar][2]],bus,0.028);
      if(i===8)hat(t,bus,0.018);
    }},
    merge:{bpm:88,fn:function(s,t,bus){
      var i=s%16;
      var prog=[[196.00,246.94,293.66,392.00],[174.61,220.00,261.63,349.23],[164.81,196.00,246.94,329.63],[146.83,196.00,246.94,293.66]];
      var bar=(s>>4)%4;
      if(i===0)bass(t,prog[bar][0]/2,bus,0.09,0.52);
      if(i%2===0)lead(t,prog[bar][(i/2)%4],bus,0.042,0.3);
      if(i===0)chord(t,[prog[bar][1],prog[bar][2],prog[bar][3]],bus,0.022);
      if(i===8)hat(t,bus,0.012);
      if(i===12)lead(t,prog[bar][3]*1.5,bus,0.03,0.24);
    }},
    td:{bpm:120,fn:function(s,t,bus){
      var i=s%16;
      var roots=[130.81,98.00,146.83,110.00];
      var bar=(s>>4)%4;
      if(i===0||i===8)kick(t,bus,0.2);
      if(i===4||i===12)snare(t,bus,0.065);
      if(i===2||i===6||i===10||i===14)hat(t,bus,0.028);
      if(i%4===0)bass(t,roots[bar],bus,0.15,0.2);
      if(i%4===2)bass(t,roots[bar]*1.5,bus,0.08,0.12);
      var hook=[[0,392.00],[2,523.25],[4,587.33],[6,659.25],[8,587.33],[10,523.25],[12,659.25],[14,783.99]];
      for(var k=0;k<hook.length;k++)if(hook[k][0]===i)lead(t,hook[k][1],bus,0.055,0.12);
      if(i===0)chord(t,[261.63,329.63,392.00],bus,0.03);
    }},
    pinball:{bpm:140,fn:function(s,t,bus){
      var i=s%16;
      var roots=[130.81,146.83,110.00,164.81];
      var bar=(s>>4)%4;
      if(i===0||i===4||i===8||i===12)kick(t,bus,0.2);
      if(i===4||i===12)snare(t,bus,0.07);
      if(i===2||i===6||i===10||i===14)hat(t,bus,0.03);
      if(i%2===0)bass(t,roots[bar]*(i%4===2?1.5:1),bus,0.15,0.12);
      var hook=[[0,523.25],[2,659.25],[4,783.99],[6,659.25],[8,587.33],[10,783.99],[12,880.00],[14,783.99]];
      for(var k=0;k<hook.length;k++)if(hook[k][0]===i)lead(t,hook[k][1],bus,0.06,0.11);
      if(i===0)chord(t,[261.63,329.63,392.00],bus,0.028);
    }},
    bubble:{bpm:104,fn:function(s,t,bus){
      var i=s%16;
      var prog=[[196.00,246.94,293.66,392.00],[174.61,220.00,261.63,349.23],[164.81,207.65,246.94,329.63],[146.83,196.00,246.94,293.66]];
      var bar=(s>>4)%4;
      if(i===0||i===8)kick(t,bus,0.11);
      if(i===4||i===12)hat(t,bus,0.016);
      if(i===0)bass(t,prog[bar][0]/2,bus,0.1,0.46);
      if(i%2===0)lead(t,prog[bar][(i/2)%4],bus,0.048,0.26);
      if(i===0)chord(t,[prog[bar][1],prog[bar][2],prog[bar][3]],bus,0.024);
      if(i===10)lead(t,prog[bar][3]*1.5,bus,0.032,0.2);
      if(i===14)lead(t,prog[bar][2]*2,bus,0.028,0.16);
    }}
  };

  function clearTimer(){
    if(bgm.timer){clearTimeout(bgm.timer);bgm.timer=0}
  }
  function schedule(){
    if(!bgm.on||!ctx||!bgmGain)return;
    var style=STYLES[bgm.style]||STYLES.shop;
    var now=ctx.currentTime;
    var ahead=now+0.9;
    while(bgm.next<ahead){
      style.fn(bgm.step,bgm.next,bgmGain);
      bgm.step+=1;
      bgm.next+=bgm.beat;
    }
    bgm.timer=setTimeout(schedule,180);
  }
  function startBgm(style){
    unlock();
    if(!ctx||!bgmGain)return;
    wantedBgm=style||wantedBgm||'shop';
    var st=STYLES[wantedBgm]||STYLES.shop;
    var fadeAt=ctx.currentTime;
    if(bgm.on&&bgm.style===wantedBgm){
      bgmGain.gain.cancelScheduledValues(fadeAt);
      bgmGain.gain.setValueAtTime(0.2,fadeAt);
      return;
    }
    stopBgm(true);
    bgm.on=true;bgm.style=wantedBgm;bgm.step=0;
    bgm.beat=60/(st.bpm*4);
    bgm.next=ctx.currentTime+0.06;
    bgmGain.gain.cancelScheduledValues(fadeAt);
    bgmGain.gain.setValueAtTime(0.0001,fadeAt);
    bgmGain.gain.linearRampToValueAtTime(0.2,fadeAt+0.35);
    schedule();
  }
  function stopBgm(hard){
    bgm.on=false;
    wantedBgm=hard?wantedBgm:null;
    clearTimer();
    if(bgmGain&&ctx){
      var t=ctx.currentTime;
      bgmGain.gain.cancelScheduledValues(t);
      bgmGain.gain.setValueAtTime(bgmGain.gain.value,t);
      bgmGain.gain.linearRampToValueAtTime(0.0001,t+(hard?0.04:0.22));
    }
  }
  function pauseBgm(){if(bgm.on){bgm.on=false;clearTimer();if(bgmGain&&ctx){var t=ctx.currentTime;bgmGain.gain.setTargetAtTime(0.0001,t,0.05)}}wantedBgm=wantedBgm||bgm.style}
  function resumeBgm(){if(wantedBgm||bgm.style)startBgm(wantedBgm||bgm.style)}

  function play(name,opts){
    unlock();
    if(!ctx||!sfxGain)return;
    opts=opts||{};
    var t=ctx.currentTime+0.01;
    switch(name){
      case 'start':
        oscTone('triangle',523.25,659.25,t,0.14,0.16,sfxGain);
        oscTone('triangle',659.25,783.99,t+0.11,0.16,0.16,sfxGain);
        oscTone('sine',783.99,1046.5,t+0.22,0.22,0.14,sfxGain,{type:'lowpass',freq:2600});
        break;
      case 'swipe':
        noiseBurst(t,0.09,0.08,sfxGain,{type:'bandpass',freq:1400,q:0.7});
        oscTone('sine',520,220,t,0.1,0.06,sfxGain,{type:'lowpass',freq:1800});
        break;
      case 'jump':
        oscTone('sine',380,880,t,0.18,0.16,sfxGain,{type:'lowpass',freq:2200});
        oscTone('triangle',760,1200,t+0.02,0.12,0.06,sfxGain);
        break;
      case 'roll':
        noiseBurst(t,0.14,0.1,sfxGain,{type:'lowpass',freq:900});
        oscTone('sine',240,90,t,0.16,0.1,sfxGain,{type:'lowpass',freq:500});
        break;
      case 'powder':
      case 'coin':
        oscTone('triangle',1046.5,1046.5,t,0.1,0.18,sfxGain);
        oscTone('sine',1567.98,1567.98,t+0.05,0.14,0.12,sfxGain,{type:'lowpass',freq:4000});
        oscTone('sine',2093,2093,t+0.1,0.1,0.05,sfxGain);
        break;
      case 'board':
        oscTone('triangle',196,330,t,0.12,0.14,sfxGain,{type:'lowpass',freq:900});
        oscTone('sine',392,523.25,t+0.08,0.16,0.12,sfxGain);
        noiseBurst(t,0.06,0.05,sfxGain,{type:'lowpass',freq:400});
        break;
      case 'crash':
      case 'burn':
        noiseBurst(t,0.22,0.2,sfxGain,{type:'lowpass',freq:500});
        oscTone('sine',180,70,t,0.32,0.2,sfxGain,{type:'lowpass',freq:400});
        oscTone('triangle',240,90,t+0.05,0.28,0.1,sfxGain);
        break;
      case 'over':
        oscTone('triangle',392,311,t,0.28,0.14,sfxGain);
        oscTone('triangle',311,247,t+0.2,0.32,0.14,sfxGain);
        oscTone('sine',247,185,t+0.4,0.38,0.12,sfxGain,{type:'lowpass',freq:700});
        break;
      case 'flip':
        oscTone('triangle',880,720,t,0.07,0.08,sfxGain,{type:'lowpass',freq:2000});
        noiseBurst(t,0.03,0.025,sfxGain,{type:'highpass',freq:2000});
        break;
      case 'match':
        oscTone('triangle',659.25,659.25,t,0.1,0.14,sfxGain);
        oscTone('sine',830.61,830.61,t+0.07,0.14,0.12,sfxGain);
        oscTone('sine',987.77,987.77,t+0.14,0.18,0.1,sfxGain,{type:'lowpass',freq:3000});
        break;
      case 'miss':
        oscTone('sine',330,220,t,0.14,0.08,sfxGain,{type:'lowpass',freq:1200});
        oscTone('triangle',247,180,t+0.06,0.16,0.06,sfxGain);
        break;
      case 'win':
        oscTone('triangle',523.25,523.25,t,0.12,0.12,sfxGain);
        oscTone('triangle',659.25,659.25,t+0.1,0.14,0.12,sfxGain);
        oscTone('sine',783.99,1046.5,t+0.22,0.28,0.14,sfxGain);
        break;
      case 'catch':
        oscTone('triangle',698.46,880,t,0.09,0.14,sfxGain);
        oscTone('sine',1046.5,1046.5,t+0.05,0.12,0.08,sfxGain);
        break;
      case 'drop':
        noiseBurst(t,0.06,0.055,sfxGain,{type:'lowpass',freq:900});
        oscTone('sine',240,120,t,0.09,0.08,sfxGain,{type:'lowpass',freq:700});
        break;
      case 'bump':
        oscTone('sine',170,110,t,0.05,Math.min(0.07,(opts.force||0.4)*0.06),sfxGain,{type:'lowpass',freq:520});
        break;
      case 'merge':
        (function(){
          var k=Math.max(2,opts.tier||2),c=Math.max(1,opts.combo||1);
          var f=392*Math.pow(2,((k-2)*1.5+Math.min(c-1,5)*1.2)/12);
          oscTone('triangle',f,f*1.33,t,0.11,0.16,sfxGain);
          oscTone('sine',f*1.5,f*2,t+0.05,0.15,0.1,sfxGain,{type:'lowpass',freq:3200});
          if(c>=2)oscTone('sine',f*2,f*2.2,t+0.1,0.12,0.06,sfxGain);
        })();
        break;
      case 'mergeMax':
        oscTone('triangle',523.25,523.25,t,0.12,0.16,sfxGain);
        oscTone('triangle',659.25,659.25,t+0.1,0.14,0.16,sfxGain);
        oscTone('triangle',783.99,783.99,t+0.2,0.16,0.16,sfxGain);
        oscTone('sine',1046.5,1318.5,t+0.32,0.4,0.18,sfxGain);
        noiseBurst(t+0.08,0.2,0.05,sfxGain,{type:'highpass',freq:2000});
        break;
      case 'build':
        oscTone('triangle',261.63,392.00,t,0.12,0.16,sfxGain);
        oscTone('sine',523.25,659.25,t+0.08,0.16,0.12,sfxGain);
        noiseBurst(t,0.06,0.05,sfxGain,{type:'lowpass',freq:600});
        break;
      case 'upgrade':
        oscTone('triangle',523.25,523.25,t,0.08,0.14,sfxGain);
        oscTone('triangle',659.25,659.25,t+0.08,0.1,0.14,sfxGain);
        oscTone('sine',783.99,1046.5,t+0.16,0.2,0.12,sfxGain);
        break;
      case 'shoot':
        oscTone('square',620,280,t,0.06,0.06,sfxGain,{type:'lowpass',freq:1400});
        noiseBurst(t,0.03,0.03,sfxGain,{type:'highpass',freq:1800});
        break;
      case 'splash':
        noiseBurst(t,0.14,0.12,sfxGain,{type:'bandpass',freq:900,q:0.6});
        oscTone('sawtooth',240,90,t,0.16,0.08,sfxGain,{type:'lowpass',freq:800});
        break;
      case 'slow':
        oscTone('sine',880,520,t,0.18,0.08,sfxGain,{type:'lowpass',freq:1800});
        oscTone('triangle',1320,700,t+0.04,0.16,0.05,sfxGain);
        break;
      case 'leak':
        oscTone('sine',220,110,t,0.22,0.16,sfxGain,{type:'lowpass',freq:500});
        noiseBurst(t,0.16,0.1,sfxGain,{type:'lowpass',freq:400});
        break;
      case 'wave':
        oscTone('triangle',392.00,523.25,t,0.12,0.12,sfxGain);
        oscTone('triangle',523.25,659.25,t+0.1,0.14,0.12,sfxGain);
        kick(t,sfxGain,0.16);
        break;
      case 'plunger':
        (function(){
          var p=Math.max(0,Math.min(1,opts.power||0));
          oscTone('triangle',160+p*220,90+p*40,t,0.07,0.045,sfxGain,{type:'lowpass',freq:900});
        })();
        break;
      case 'launch':
        kick(t,sfxGain,0.2);
        noiseBurst(t,0.1,0.08,sfxGain,{type:'bandpass',freq:1400,q:0.7});
        oscTone('sawtooth',180,520,t,0.16,0.08,sfxGain,{type:'lowpass',freq:1800});
        break;
      case 'flipper':
        noiseBurst(t,0.04,0.05,sfxGain,{type:'highpass',freq:1200});
        oscTone('triangle',240,140,t,0.06,0.07,sfxGain,{type:'lowpass',freq:900});
        break;
      case 'bumper':
        (function(){
          var c=Math.max(1,opts.combo||1);
          var f=659.25*Math.pow(2,Math.min(c-1,8)*1.2/12);
          oscTone('triangle',f,f*1.5,t,0.1,0.16,sfxGain);
          oscTone('sine',f*2,f*2.2,t+0.04,0.12,0.08,sfxGain,{type:'lowpass',freq:3200});
        })();
        break;
      case 'sling':
        noiseBurst(t,0.07,0.09,sfxGain,{type:'bandpass',freq:1600,q:0.7});
        oscTone('square',220,110,t,0.07,0.05,sfxGain,{type:'lowpass',freq:800});
        break;
      case 'gate':
        oscTone('sine',784,784,t,0.08,0.1,sfxGain);
        oscTone('sine',1175,1175,t+0.06,0.1,0.08,sfxGain);
        break;
      case 'mult':
        oscTone('triangle',523.25,523.25,t,0.1,0.16,sfxGain);
        oscTone('triangle',659.25,659.25,t+0.09,0.12,0.16,sfxGain);
        oscTone('sine',783.99,1174.66,t+0.18,0.28,0.16,sfxGain);
        noiseBurst(t+0.06,0.16,0.05,sfxGain,{type:'highpass',freq:2000});
        break;
      case 'wall':
        oscTone('triangle',988,740,t,0.05,0.05,sfxGain,{type:'lowpass',freq:2400});
        noiseBurst(t,0.03,0.025,sfxGain,{type:'highpass',freq:1800});
        break;
      case 'pop':
        (function(){
          var c=Math.max(1,opts.combo||1);
          var f=523.25*Math.pow(2,Math.min(c-1,6)*2/12);
          oscTone('triangle',f,f*1.5,t,0.1,0.15,sfxGain);
          oscTone('sine',f*1.5,f*2,t+0.05,0.14,0.1,sfxGain,{type:'lowpass',freq:3600});
          noiseBurst(t,0.08,0.05,sfxGain,{type:'highpass',freq:1600});
          if(c>=2)oscTone('sine',f*2,f*2.4,t+0.1,0.16,0.07,sfxGain);
        })();
        break;
      case 'fall':
        (function(){
          var n=Math.max(1,Math.min(6,opts.n||3));
          for(var i=0;i<n;i++)oscTone('triangle',880-i*90,420-i*40,t+i*0.05,0.12,0.08,sfxGain,{type:'lowpass',freq:1800});
          noiseBurst(t,0.12,0.04,sfxGain,{type:'lowpass',freq:700});
        })();
        break;
      case 'bomb':
        kick(t,sfxGain,0.2);
        noiseBurst(t,0.22,0.14,sfxGain,{type:'bandpass',freq:900,q:0.6});
        oscTone('triangle',392,784,t,0.16,0.14,sfxGain);
        oscTone('triangle',523.25,1046.5,t+0.1,0.2,0.14,sfxGain);
        oscTone('sine',659.25,1318.5,t+0.22,0.28,0.12,sfxGain);
        break;
      default:break;
    }
  }

  document.addEventListener('visibilitychange',function(){
    if(!ctx)return;
    if(document.hidden){
      pauseBgm();
      if(ctx.state==='running')ctx.suspend();
    }else if(ctx.state==='suspended'&&unlocked){
      ctx.resume();
    }
  });

  var api={
    configure:configure,
    unlock:unlock,
    setMuted:setMuted,
    toggle:function(){unlock();setMuted(!muted)},
    startBgm:startBgm,
    stopBgm:function(){stopBgm(false)},
    pauseBgm:pauseBgm,
    resumeBgm:resumeBgm,
    play:play,
    syncBtn:syncBtn,
    info:function(){
      return {
        muted:muted,unlocked:unlocked,
        ctx:ctx?ctx.state:'none',
        bgm:!!bgm.on,style:bgm.style,
        master:muted?0:0.9,
        key:key
      };
    }
  };
  Object.defineProperty(api,'muted',{get:function(){return muted}});
  Object.defineProperty(api,'ctx',{get:function(){return ctx}});
  Object.defineProperty(api,'master',{get:function(){return master}});
  return api;
})();

w.PCGames={asset:asset,pickHtml:pickHtml,getBest:getBest,setBest:setBest,loadImg:loadImg,guardZoom:guardZoom,audio:audio};
})(window);
