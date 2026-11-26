(function(){
'use strict';
var d=document, canvas=d.getElementById('stage'), ctx=canvas.getContext('2d',{alpha:false});
var ov=d.getElementById('ov'), ovT=d.getElementById('ovT'), ovS=d.getElementById('ovS');
var ovLogo=d.getElementById('ovlogo'), how=d.getElementById('how'), fine=d.getElementById('fine');
var elHearts=d.getElementById('kartHearts'), hurtTip=d.getElementById('hurtTip');
var go=d.getElementById('go'), hud=d.getElementById('hud');
var elRank=d.getElementById('rank'), elLap=d.getElementById('lap'), elSpd=d.getElementById('spd');
var itemBtn=d.getElementById('itemBtn'), itemIcon=d.getElementById('itemIcon'), itemIdle=d.getElementById('itemIdle');
var btnL=d.getElementById('btnL'), btnR=d.getElementById('btnR'), controls=d.getElementById('controls');
var muteBtn=d.getElementById('muteBtn'), bestLine=d.getElementById('bestLine');
var dots={you:d.getElementById('dot-you'),cheese:d.getElementById('dot-cheese'),bbq:d.getElementById('dot-bbq'),chili:d.getElementById('dot-chili')};

function img(src){var i=new Image();i.src=src;return i}
function ready(im){return im&&im.complete&&im.naturalWidth>0}
var IM={
  player:img('img/kart/player.webp'),
  playerL:img('img/kart/player-left.webp'),
  playerR:img('img/kart/player-right.webp'),
  cheese:img('img/kart/rival-cheese.webp'),
  bbq:img('img/kart/rival-bbq.webp'),
  chili:img('img/kart/rival-chili.webp'),
  box:img('img/kart/itembox.webp'),
  oil:img('img/kart/oil.webp'),
  boost:img('img/kart/boost.webp'),
  arch:img('img/kart/arch.webp'),
  turbo:img('img/kart/icon-turbo.webp'),
  shield:img('img/kart/icon-shield.webp'),
  missile:img('img/kart/icon-chili.webp'),
  tree:img('img/kart/tree.webp'),
  cone:img('img/kart/cone.webp'),
  sky:img('img/kart/sky.webp'),
  cloud:img('img/kart/cloud.webp'),
  barrel:img('img/kart/barrel.webp'),
  crate:img('img/kart/crate.webp'),
  spud:img('img/kart/spud.webp')
};
var ITEM_ICON={turbo:IM.turbo,shield:IM.shield,oil:IM.oil,chili:IM.missile};
var ITEM_NAME={turbo:'香辣渦輪',shield:'起司護盾',oil:'薯條油漬',chili:'追蹤辣椒彈'};
var ITEM_POOL=['turbo','shield','oil','chili'];
var PLACE=['1st','2nd','3rd','4th'];
var PLACE_ZH=['第 1 名','第 2 名','第 3 名','第 4 名'];

var MUTE_KEY='pc-kart-mute', BEST_KEY='pc-kart-best';
var SEG=200, CAM_D=0.84, CAM_H=2200, CAM_OFF=1800, ROAD_W=2000, DRAW=180, LAPS=3;
var MAX_SPD=3600, BOOST_SPD=5000, OFF_LIMIT=1400;
var W=390,H=844,DPR=1,CX=195,CY=400;

var segs=[], N=0, trackLen=0, SHOT_Z=0;
var state='menu'; /* menu, count, racing, done */
var racers=[], player=null, hazards=[], missiles=[], particles=[];
var steer=0, padL=0, padR=0, keys={};
var raceT=0, countT=0, skyOff=0, bounce=0, lastTs=0, raf=0;
var camY=0, flash=0, goFlash=0, frozen=0, hurtShake=0, hurtTimer=0;

/* ---------- audio ---------- */
var actx=null, master=null, unlocked=false, muted=false;
var eng={src:null,gain:null,filt:null,noise:null,ng:null,lfo:null};
try{muted=localStorage.getItem(MUTE_KEY)==='1'}catch(e){}

function unlockAudio(){
  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return false;
  if(!actx){
    actx=new AC();
    master=actx.createGain();
    master.gain.value=muted?0:0.9;
    master.connect(actx.destination);
  }
  if(actx.state==='suspended')actx.resume();
  unlocked=true;
  return true;
}
function setMuteUI(){
  if(!muteBtn)return;
  muteBtn.setAttribute('aria-pressed',muted?'true':'false');
  muteBtn.setAttribute('aria-label',muted?'已靜音，點擊開啟音效':'音效開啟，點擊靜音');
  muteBtn.title=muted?'已靜音':'音效開';
  muteBtn.textContent=muted?'靜音':'聲音';
}
function setMuted(on){
  muted=!!on;
  try{localStorage.setItem(MUTE_KEY,muted?'1':'0')}catch(e){}
  setMuteUI();
  if(master&&actx){
    var t=actx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(muted?0:0.9,t);
  }
}
function beep(type,freq,dur,gain,slide,q){
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime, o=actx.createOscillator(), g=actx.createGain();
  o.type=type||'sine';
  o.frequency.setValueAtTime(freq,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,slide),t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(gain||0.2,t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  if(q){
    var f=actx.createBiquadFilter();
    f.type='bandpass';f.frequency.value=q;f.Q.value=4;
    o.connect(f);f.connect(g);
  }else o.connect(g);
  g.connect(master);
  o.start(t);o.stop(t+dur+0.05);
}
function noiseBurst(dur,gain,freq,q){
  if(!unlockAudio()||!master||!actx)return;
  var n=actx.createBuffer(1,actx.sampleRate*dur,actx.sampleRate);
  var data=n.getChannelData(0);
  for(var i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,0.6);
  var src=actx.createBufferSource();src.buffer=n;
  var f=actx.createBiquadFilter();f.type='bandpass';f.frequency.value=freq||800;f.Q.value=q||1.2;
  var g=actx.createGain();
  var t=actx.currentTime;
  g.gain.setValueAtTime(gain||0.2,t);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  src.connect(f);f.connect(g);g.connect(master);
  src.start(t);
}
function sfxBox(){beep('square',880,0.08,0.16,1320);setTimeout(function(){beep('square',1320,0.1,0.14,1760)},70)}
function sfxBoost(){beep('sawtooth',220,0.35,0.12,640);noiseBurst(0.28,0.18,1200,0.8)}
function sfxUse(){beep('triangle',520,0.14,0.16,300)}
function sfxHit(){noiseBurst(0.22,0.28,180,0.7);beep('square',140,0.16,0.2,60)}
function sfxHurt(){noiseBurst(0.34,0.4,140,0.9);beep('square',180,0.22,0.22,70);setTimeout(function(){beep('sawtooth',110,0.18,0.16,40)},80)}
function sfxLap(){beep('sine',660,0.12,0.18);setTimeout(function(){beep('sine',880,0.16,0.18)},110)}
function sfxCount(){beep('sine',440,0.18,0.16)}
function sfxGo(){beep('sine',660,0.12,0.18,880);setTimeout(function(){beep('triangle',880,0.22,0.16)},80)}
function sfxFinish(){
  var notes=[523,659,784,1046];
  notes.forEach(function(f,i){setTimeout(function(){beep('triangle',f,0.28,0.18)},i*140)});
  setTimeout(function(){beep('sine',1318,0.5,0.14,880)},560);
}
function startEngine(){
  if(!unlockAudio()||!master||eng.src)return;
  var t=actx.currentTime;
  var o=actx.createOscillator();o.type='sawtooth';o.frequency.value=70;
  var o2=actx.createOscillator();o2.type='square';o2.frequency.value=35;
  var f=actx.createBiquadFilter();f.type='lowpass';f.frequency.value=400;f.Q.value=0.8;
  var g=actx.createGain();g.gain.value=0.0001;
  o.connect(f);o2.connect(f);f.connect(g);g.connect(master);
  o.start(t);o2.start(t);
  var nb=actx.createBuffer(1,actx.sampleRate,actx.sampleRate);
  var dat=nb.getChannelData(0);
  for(var i=0;i<dat.length;i++)dat[i]=Math.random()*2-1;
  var ns=actx.createBufferSource();ns.buffer=nb;ns.loop=true;
  var nf=actx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=900;nf.Q.value=0.6;
  var ng=actx.createGain();ng.gain.value=0.0001;
  ns.connect(nf);nf.connect(ng);ng.connect(master);
  ns.start(t);
  eng={src:o,src2:o2,gain:g,filt:f,noise:ns,ng:ng,nf:nf};
}
function stopEngine(){
  if(!eng.src||!actx){eng={};return}
  var t=actx.currentTime;
  try{
    if(eng.gain){eng.gain.gain.cancelScheduledValues(t);eng.gain.gain.setValueAtTime(eng.gain.gain.value,t);eng.gain.gain.exponentialRampToValueAtTime(0.0001,t+0.15)}
    if(eng.ng)eng.ng.gain.exponentialRampToValueAtTime(0.0001,t+0.15);
    eng.src.stop(t+0.2);if(eng.src2)eng.src2.stop(t+0.2);if(eng.noise)eng.noise.stop(t+0.2);
  }catch(e){}
  eng={};
}
function tickEngine(){
  if(!eng.src||!actx||!player)return;
  var t=actx.currentTime;
  var p=Math.max(0,player.speed/MAX_SPD);
  var f=62+p*140+(player.boostT>0?40:0)+(Math.sin(raceT*40)*4*p);
  try{
    eng.src.frequency.setTargetAtTime(f,t,0.05);
    if(eng.src2)eng.src2.frequency.setTargetAtTime(f*0.5,t,0.05);
    if(eng.filt)eng.filt.frequency.setTargetAtTime(280+p*900,t,0.08);
    var vol=(state==='racing'||state==='count')?(0.04+p*0.10):0.0001;
    if(player.boostT>0)vol+=0.04;
    eng.gain.gain.setTargetAtTime(vol,t,0.08);
    if(eng.ng)eng.ng.gain.setTargetAtTime(0.02+p*0.05,t,0.1);
  }catch(e){}
}

/* ---------- track ---------- */
function lastY(){return segs.length?segs[segs.length-1].y:0}
function addSeg(curve,y){
  var i=segs.length;
  segs.push({i:i,z:i*SEG,curve:curve||0,y:y==null?lastY():y,pal:(Math.floor(i/3)%2),sprites:[],p1:{},p2:{},clip:0});
}
function addRoad(n,curve,yEnd){
  var y0=lastY(), y1=(yEnd==null)?y0:yEnd;
  for(var i=0;i<n;i++){
    var p=(i+1)/n, e=p*p*(3-2*p);
    addSeg(curve,y0+(y1-y0)*e);
  }
}
function spr(i,kind,x,scale){
  var s=segs[(i+N)%N];
  if(!s)return;
  s.sprites.push({kind:kind,x:x,scale:scale||1,hide:0,w:kindW(kind),hazard:0,cool:0});
}
function kindW(k){
  if(k==='tree')return 2.4;
  if(k==='cone')return 0.7;
  if(k==='box')return 1.0;
  if(k==='boost')return 2.2;
  if(k==='arch')return 6.4;
  if(k==='oil')return 1.6;
  if(k==='barrel'||k==='crate')return 1.15;
  if(k==='spud')return 1.25;
  return 1;
}
function buildTrack(){
  segs=[];
  /* v6: a straight, wide track — no lateral curves, gentle hills only */
  addRoad(28,0,0);
  addRoad(24,0,0);
  addRoad(12,0,0);
  addRoad(18,0,700);
  addRoad(22,0,1100);
  addRoad(10,0,1100);
  addRoad(20,0,200);
  addRoad(16,0,-100);
  addRoad(14,0,0);
  addRoad(12,0,0);
  addRoad(28,0,400);
  addRoad(16,0,200);
  addRoad(10,0,200);
  addRoad(18,0,500);
  addRoad(14,0,0);
  addRoad(12,0,0);
  addRoad(20,0,-200);
  addRoad(24,0,300);
  addRoad(16,0,0);
  addRoad(18,0,0);
  addRoad(20,0,0);
  N=segs.length;
  trackLen=N*SEG;
  /* scenery + items after N is known */
  var i,k;
  for(i=6;i<N-4;i+=2){
    if(i%5===0)spr(i,'tree',-(1.72+((i*3)%7)*0.10),1.05+((i*5)%5)*0.06);
    if(i%5===2)spr(i,'tree',(1.72+((i*7)%7)*0.10),1.05+((i*3)%5)*0.06);
    if(i%11===0)spr(i,'tree',-(2.05+((i)%5)*0.12),1.2);
    if(i%11===5)spr(i,'tree',(2.05+((i)%5)*0.12),1.2);
  }
  for(i=20;i<N-8;i+=14){
    spr(i,'cone',-1.18,1);
    spr(i+1,'cone',1.18,1);
  }
  var boxRows=[36,70,118,160,210,258,310,350];
  for(k=0;k<boxRows.length;k++){
    i=boxRows[k]%N;
    spr(i,'box',-0.55,1);
    spr(i,'box',0.55,1);
    if(k%2===0)spr(i,'box',0,1);
  }
  var boosts=[48,49,132,133,134,188,189,280,281,282,328,329];
  for(k=0;k<boosts.length;k++)spr(boosts[k]%N,'boost',((k%3)-1)*0.22,1);
  spr(1,'arch',0,1.15);
  placeObstacles();
  /* a straight stretch with room to show dodging for screenshots */
  SHOT_Z=segs[Math.min(138,N-16)].z;
}
function isHazardKind(k){return k==='barrel'||k==='crate'||k==='spud'||k==='cone'}
function hasSolidNear(i,range){
  var k,j,sp,kind;
  for(k=-range;k<=range;k++){
    sp=segs[(i+k+N)%N].sprites;
    for(j=0;j<sp.length;j++){
      kind=sp[j].kind;
      if(kind==='box'||kind==='boost'||kind==='arch'||sp[j].hazard)return true;
    }
  }
  return false;
}
function sprHazard(i,kind,x,scale){
  var s=segs[(i+N)%N];
  if(!s)return;
  s.sprites.push({kind:kind,x:x,scale:scale||1,hide:0,w:kindW(kind),hazard:1,cool:0});
}
function placeObstacles(){
  /* always leave at least one clear lane; never overlap item boxes or boosts */
  var lanes=[-0.52,0,0.52], types=['barrel','crate','spud','cone'];
  var i,t,lane,step=17,idx=0;
  for(i=44;i<N-16;i+=step){
    if(hasSolidNear(i,3)){i+=2;continue}
    t=types[idx%types.length];
    lane=lanes[(idx*2+1)%3]; /* rotate so a path always stays open */
    if(t==='cone'){
      sprHazard(i,'cone',lane-0.09,1);
      sprHazard(i,'cone',lane+0.10,1);
      if(idx%2===0)sprHazard(i+1,'cone',lane,1);
    }else{
      sprHazard(i,t,lane,1.05);
    }
    idx++;
  }
}

function mod(a,n){return ((a%n)+n)%n}
function segIndex(z){var i=Math.floor(mod(z,trackLen)/SEG)%N;if(i<0)i+=N;return i}
function segAt(z){return segs[segIndex(z)]}

/* ---------- racers ---------- */
function makeRacer(id,name,im,skill,hex){
  return {id:id,name:name,im:im,skill:skill,color:hex,x:0,z:0,y:0,speed:0,laps:0,item:null,itemDelay:0,
    boostT:0,shieldT:0,slipT:0,stunT:0,finished:0,finishT:0,place:4,steer:0,lives:3,invulnT:0};
}
function resetRace(){
  hazards=[];missiles=[];particles=[];
  raceT=0;countT=3.15;flash=0;goFlash=0;steer=0;skyOff=0;bounce=0;hurtShake=0;padL=0;padR=0;keys={};
  var cheese=makeRacer('cheese','起司車手',IM.cheese,0.96,'#f5a623');
  var bbq=makeRacer('bbq','BBQ車手',IM.bbq,0.90,'#6b3b1f');
  var chili=makeRacer('chili','香辣車手',IM.chili,0.93,'#e04a1f');
  player=makeRacer('you','你',IM.player,1,'#fce404');
  player.lives=3;player.invulnT=0;
  /* grid: front cheese & chili, mid bbq, player at the back */
  cheese.z=780;cheese.x=-0.38;
  chili.z=780;chili.x=0.38;
  bbq.z=420;bbq.x=-0.18;
  player.z=180;player.x=0.32;
  racers=[player,cheese,bbq,chili];
  /* restore hidden boxes */
  for(var i=0;i<N;i++){
    var sp=segs[i].sprites,j;
    for(j=0;j<sp.length;j++){if(sp[j].kind==='box')sp[j].hide=0;sp[j].cool=0}
  }
}

/* ---------- input ---------- */
function bindLock(el,type,fn){el.addEventListener(type,fn,{passive:false})}
function onKey(e,down){
  var k=e.key;
  if(k==='ArrowLeft'||k==='a'||k==='A')keys.l=down;
  if(k==='ArrowRight'||k==='d'||k==='D')keys.r=down;
  if(down&&(k===' '||k==='Spacebar'||k==='k'||k==='K')){useItem(player);if(k===' ')e.preventDefault()}
  if(down&&(k==='ArrowLeft'||k==='ArrowRight'||k===' '))e.preventDefault();
}
function isUI(el){
  if(!el)return false;
  return !!(el.closest&&(el.closest('.kartback')||el.closest('.kart-mute')||el.closest('.kart-item')||el.closest('.kart-pad')||el.closest('.kbtn')||el.closest('.kart-controls')||el.closest('.overlay')));
}
function onDown(e){
  unlockAudio();
  if(isUI(e.target))return;
  /* canvas touch never steers; only unlock audio and stop page scroll */
  if(e.cancelable)e.preventDefault();
}
function onMove(e){
  if(isUI(e.target))return;
  if(e.cancelable)e.preventDefault();
}
function onUp(){
  syncSteerBtns();
}
function syncSteerBtns(){
  if(btnL)btnL.classList.toggle('on', !!(padL||keys.l));
  if(btnR)btnR.classList.toggle('on', !!(padR||keys.r));
}
function bindPad(btn,side){
  if(!btn)return;
  function down(e){
    unlockAudio();
    if(side==='l')padL=1;else padR=1;
    syncSteerBtns();
    try{btn.setPointerCapture(e.pointerId)}catch(err){}
    if(e.cancelable)e.preventDefault();
    e.stopPropagation();
  }
  function up(e){
    if(side==='l')padL=0;else padR=0;
    syncSteerBtns();
    if(e.cancelable)e.preventDefault();
    e.stopPropagation();
  }
  bindLock(btn,'pointerdown',down);
  btn.addEventListener('pointerup',up);
  btn.addEventListener('pointercancel',up);
}
function preventPage(e){if(e.cancelable)e.preventDefault()}

/* ---------- sim ---------- */
function wrapDiff(a,b){
  var t=trackLen, d=a-b;
  if(d>t/2)d-=t;
  if(d<-t/2)d+=t;
  return d;
}
function progressOf(r){return r.laps*trackLen+mod(r.z,trackLen)}
function roadYAt(z){
  var i=segIndex(z), s=segs[i], n=segs[(i+1)%N];
  var p=(mod(z,trackLen)-s.z)/SEG;
  return s.y+(n.y-s.y)*p;
}
function curveAhead(z,nSeg){
  var c=0,i,s;
  for(i=0;i<nSeg;i++){s=segs[(segIndex(z)+i)%N];c+=s.curve}
  return c/nSeg;
}
function curveNow(z){
  var i=segIndex(z);
  return segs[i].curve*0.6+segs[(i+1)%N].curve*0.3+segs[(i+2)%N].curve*0.1;
}
function bump(a,b){
  var dz=Math.abs(wrapDiff(a.z,b.z));
  if(dz>200)return;
  var dx=a.x-b.x;
  if(Math.abs(dx)>0.30)return;
  var push=0.22-Math.abs(dx);
  if(dx>=0){a.x+=push*0.5;b.x-=push*0.5}else{a.x-=push*0.5;b.x+=push*0.5}
  if(a.shieldT<=0){a.speed*=0.86;if(a===player){sfxHit();flash=0.12}}
  if(b.shieldT<=0)b.speed*=0.86;
}
function giveItem(r){
  if(r.item)return;
  r.item=ITEM_POOL[Math.floor(Math.random()*ITEM_POOL.length)];
  r.itemDelay=0.6+Math.random()*1.4;
  if(r===player){sfxBox();syncItemBtn()}
}
function useItem(r){
  if(!r||!r.item||r.finished)return;
  var it=r.item;r.item=null;
  if(r===player){sfxUse();syncItemBtn()}
  if(it==='turbo'){r.boostT=Math.max(r.boostT,2.15);r.speed=Math.max(r.speed,MAX_SPD*0.92);if(r===player)sfxBoost()}
  else if(it==='shield'){r.shieldT=4.2}
  else if(it==='oil'){
    hazards.push({kind:'oil',z:mod(r.z-260,trackLen),x:r.x,life:8,from:r.id});
  }
  else if(it==='chili'){
    var tgt=racerAhead(r);
    missiles.push({z:r.z+80,x:r.x,from:r.id,tgt:tgt?tgt.id:null,life:4.5,spd:MAX_SPD*1.7});
  }
}
function racerAhead(r){
  var best=null,bp=1e15,i,o,d;
  for(i=0;i<racers.length;i++){
    o=racers[i];if(o===r||o.finished)continue;
    d=progressOf(o)-progressOf(r);
    if(d<0)d+=LAPS*trackLen+trackLen;
    if(d>0&&d<bp){bp=d;best=o}
  }
  return best;
}
function syncItemBtn(){
  if(!itemBtn)return;
  if(player&&player.item){
    itemBtn.classList.add('has');
    itemIcon.src=ITEM_ICON[player.item].src;
    itemIcon.alt=ITEM_NAME[player.item]||'';
    itemBtn.setAttribute('aria-label','使用'+ (ITEM_NAME[player.item]||'道具'));
  }else{
    itemBtn.classList.remove('has');
    itemIcon.removeAttribute('src');
    itemIcon.alt='';
    itemBtn.setAttribute('aria-label','使用道具');
  }
}
function hitOil(r,h){
  if(!h||h.life<=0)return;
  if(r===player&&r.invulnT>0)return;
  if(r===player){
    var res=hurtPlayer('oil');
    if(res)h.life=0;
    return;
  }
  if(r.shieldT>0){r.shieldT=0.01;h.life=0;return}
  r.slipT=1.25;r.speed*=0.62;r.stunT=0.15;
  h.life=0;
}
function hitMissile(r,m){
  if(!m||m.life<=0)return;
  if(r===player&&r.invulnT>0)return;
  if(r===player){
    var res=hurtPlayer('missile');
    if(res){m.life=0;spark(r.z,r.x,12)}
    return;
  }
  if(r.shieldT>0){r.shieldT=0;m.life=0;return}
  r.stunT=0.85;r.speed*=0.45;r.slipT=0.8;m.life=0;
  spark(r.z,r.x,12);
}
function showHurtTip(){
  if(!hurtTip)return;
  hurtTip.hidden=false;
  hurtTip.classList.remove('on');
  void hurtTip.offsetWidth;
  hurtTip.classList.add('on');
  if(elHearts){elHearts.classList.remove('hit');void elHearts.offsetWidth;elHearts.classList.add('hit')}
  clearTimeout(hurtTimer);
  hurtTimer=setTimeout(function(){if(hurtTip){hurtTip.hidden=true;hurtTip.classList.remove('on')}},850);
}
function hurtPlayer(kind){
  if(!player||state!=='racing')return '';
  if(player.invulnT>0)return '';
  if(player.shieldT>0){
    player.shieldT=0;
    player.invulnT=0.85;
    sfxHit();
    flash=0.14;
    spark(player.z,player.x,10);
    return 'shield';
  }
  player.lives=Math.max(0,player.lives-1);
  player.invulnT=1.5;
  player.speed*=0.62;
  if(kind==='oil'){player.slipT=1.25;player.stunT=Math.max(player.stunT,0.15)}
  if(kind==='missile'){player.stunT=0.85;player.slipT=0.8}
  hurtShake=0.42;
  flash=0.3;
  sfxHurt();
  showHurtTip();
  spark(player.z,player.x,14);
  syncHud();
  if(player.lives<=0)finishRace('out');
  return 'hurt';
}
function hitObstacle(r,s){
  if(!s||s.cool>0||r.finished)return;
  if(r===player){
    if(r.invulnT>0)return;
    var res=hurtPlayer('obs');
    if(res)s.cool=1.8;
    return;
  }
  s.cool=1.2;
  r.speed*=0.55;
  r.stunT=Math.max(r.stunT,0.22);
  spark(r.z,s.x,6);
}
function spark(z,x,n){
  for(var i=0;i<n;i++)particles.push({z:z,x:x+(Math.random()-0.5)*0.2,life:0.4+Math.random()*0.3,vy:40+Math.random()*80,c:Math.random()<0.5?'#fce404':'#fff'});
}

function updateRacer(r,dt,isP){
  if(r.finished){r.speed=Math.max(0,r.speed-1800*dt);r.z+=r.speed*dt;return}
  r.boostT=Math.max(0,r.boostT-dt);
  r.shieldT=Math.max(0,r.shieldT-dt);
  r.slipT=Math.max(0,r.slipT-dt);
  r.stunT=Math.max(0,r.stunT-dt);
  if(isP)r.invulnT=Math.max(0,(r.invulnT||0)-dt);

  var cur=isP?curveNow(r.z):curveAhead(r.z,8);
  var off=Math.abs(r.x)>=1;
  var tgt=r.boostT>0?BOOST_SPD:MAX_SPD*(isP?1:r.skill);
  if(off)tgt=Math.min(tgt,OFF_LIMIT);
  if(r.stunT>0)tgt*=0.25;
  if(!isP){
    var dp=progressOf(r)-progressOf(player);
    if(dp<-9000)tgt*=1.16;
    else if(dp<-4000)tgt*=1.08;
    if(dp>14000)tgt*=0.86;
    else if(dp>8000)tgt*=0.92;
  }
  var acc=(r.speed<tgt)?(isP?3200:2800)* (r.boostT>0?1.4:1) : 2200;
  if(off&&r.speed>OFF_LIMIT)acc=5000;
  if(r.speed<tgt)r.speed=Math.min(tgt,r.speed+acc*dt);
  else r.speed=Math.max(tgt,r.speed-acc*dt);
  if(r.stunT>0)r.speed=Math.max(400,r.speed-3000*dt);

  var st=0;
  if(isP){
    /* lateral move listens only to pad + keyboard; no drag, tilt, or curve drift */
    if(padR||keys.r)st+=1;
    if(padL||keys.l)st-=1;
    if(st>1)st=1;if(st<-1)st=-1;
    if(r.slipT>0)st+=Math.sin(raceT*18)*1.15;
    steer=st;
    r.steer=steer;
    syncSteerBtns();
  }else{
    var look=curveAhead(r.z+SEG*18,10);
    var tx=-look*0.16 + (r.id==='cheese'?-0.12:r.id==='bbq'?0.16:-0.02);
    if(tx>0.72)tx=0.72;if(tx<-0.72)tx=-0.72;
    /* avoid oil and track obstacles ahead */
    var hi,looki,ak,asp;
    for(hi=0;hi<hazards.length;hi++){
      if(hazards[hi].kind!=='oil')continue;
      var hz=wrapDiff(hazards[hi].z,r.z);
      if(hz>0&&hz<900&&Math.abs(hazards[hi].x-tx)<0.3)tx+=(hazards[hi].x>0?-0.4:0.4);
    }
    for(looki=2;looki<18;looki++){
      asp=segs[(segIndex(r.z)+looki)%N].sprites;
      for(ak=0;ak<asp.length;ak++){
        if(!asp[ak].hazard)continue;
        if(Math.abs(asp[ak].x-tx)<0.34)tx+=(asp[ak].x>=0?-0.46:0.46);
      }
    }
    if(tx>0.72)tx=0.72;if(tx<-0.72)tx=-0.72;
    r.steer=r.steer*0.8+((tx>r.x+0.04)?1:(tx<r.x-0.04)?-1:0)*0.2;
    st=r.steer;
    r.x+=(tx-r.x)*Math.min(1,3.6*r.skill*dt);
    if(r.item&&r.itemDelay>0){r.itemDelay-=dt;if(r.itemDelay<=0&&Math.random()<0.7)useItem(r)}
  }

  var speedK=Math.min(1,r.speed/MAX_SPD);
  if(isP){
    /* no centrifugal drift: x stays put unless a direction is held (or oil slip) */
    r.x+=st*2.7*dt;
  }else{
    var cent=cur*speedK*0.25;
    r.x+=-cent*dt;
  }
  if(r.x>1.7)r.x=1.7;
  if(r.x<-1.7)r.x=-1.7;

  var prev=r.z;
  r.z+=r.speed*dt;
  r.y=roadYAt(r.z);
  /* lap line at z=0 */
  if(mod(prev,trackLen)>trackLen*0.72 && mod(r.z,trackLen)<trackLen*0.28){
    r.laps++;
    if(r.laps>=LAPS){
      r.finished=1;r.finishT=raceT;
      if(isP&&state==='racing')finishRace();
    }else if(isP&&state==='racing')sfxLap();
  }

  /* pickups on current segment */
  var si=segIndex(r.z), sp=segs[si].sprites, j,s,dx;
  for(j=0;j<sp.length;j++){
    s=sp[j];
    if(s.kind==='box'&&s.hide<=0){
      dx=r.x-s.x;
      if(Math.abs(dx)<0.28){s.hide=3.6;giveItem(r);spark(r.z,s.x,7)}
    }else if(s.kind==='boost'){
      dx=r.x-s.x;
      if(Math.abs(dx)<0.38){
        if(r.boostT<1.4){
          r.boostT=1.6;r.speed=Math.max(r.speed,MAX_SPD*1.05);
          if(isP)sfxBoost();
        }
      }
    }else if(s.hazard&&s.cool<=0){
      dx=r.x-s.x;
      var hw=s.kind==='cone'?0.16:s.kind==='spud'?0.32:0.28;
      if(Math.abs(dx)<hw)hitObstacle(r,s);
    }
  }
}

function update(dt){
  if(dt>0.05)dt=0.05;
  if(frozen){tickEngine();return}
  if(state==='count'){
    countT-=dt;
    var last=Math.ceil(countT+dt), now=Math.ceil(countT);
    if(now>=1&&now<last)sfxCount();
    if(countT<=0){state='racing';goFlash=0.55;sfxGo()}
    /* still allow small creep during countdown? no, hold still but rev */
    tickEngine();
    camY+= (player.y+CAM_H-camY)*8*dt;
    return;
  }
  if(state!=='racing'&&state!=='done')return;

  raceT+=dt;
  var i,j;
  for(i=0;i<N;i++){
    var sp=segs[i].sprites;
    for(j=0;j<sp.length;j++){if(sp[j].hide>0)sp[j].hide-=dt;if(sp[j].cool>0)sp[j].cool-=dt}
  }
  for(i=0;i<racers.length;i++)updateRacer(racers[i],dt,racers[i]===player);
  for(i=0;i<racers.length;i++)for(j=i+1;j<racers.length;j++)bump(racers[i],racers[j]);

  for(i=hazards.length-1;i>=0;i--){
    var h=hazards[i];h.life-=dt;
    if(h.life<=0){hazards.splice(i,1);continue}
    for(j=0;j<racers.length;j++){
      var r=racers[j];
      if(r.id===h.from)continue;
      if(Math.abs(wrapDiff(r.z,h.z))<140&&Math.abs(r.x-h.x)<0.32)hitOil(r,h);
    }
    if(h.life<=0)hazards.splice(i,1);
  }
  for(i=missiles.length-1;i>=0;i--){
    var m=missiles[i], tgt=null;
    for(j=0;j<racers.length;j++)if(racers[j].id===m.tgt)tgt=racers[j];
    if(!tgt||tgt.finished)tgt=racerAhead({z:m.z,laps:0,id:m.from})||null;
    if(tgt){
      var want=wrapDiff(tgt.z,m.z);
      m.z+=m.spd*dt*(want<0?0.35:1);
      m.x+=(tgt.x-m.x)*Math.min(1,6*dt);
      if(Math.abs(wrapDiff(m.z,tgt.z))<160&&Math.abs(m.x-tgt.x)<0.32)hitMissile(tgt,m);
    }else m.z+=m.spd*dt;
    m.life-=dt;
    if(m.life<=0)missiles.splice(i,1);
  }
  for(i=particles.length-1;i>=0;i--){
    particles[i].life-=dt;particles[i].z+=80*dt;
    if(particles[i].life<=0)particles.splice(i,1);
  }

  /* places */
  var order=racers.slice().sort(function(a,b){
    if(a.finished&&b.finished)return a.finishT-b.finishT;
    if(a.finished)return -1;if(b.finished)return 1;
    return progressOf(b)-progressOf(a);
  });
  for(i=0;i<order.length;i++)order[i].place=i+1;

  camY+=(player.y+CAM_H-camY)*8*dt;
  /* sky and hills stay fixed; no lateral parallax */
  bounce=Math.sin(raceT*(10+player.speed/400))*Math.min(1,player.speed/MAX_SPD)*1.4;
  if(player.boostT>0)bounce*=1.15;
  flash=Math.max(0,flash-dt);
  goFlash=Math.max(0,goFlash-dt);
  hurtShake=Math.max(0,hurtShake-dt*2.4);
  tickEngine();
  syncHud();
}

function syncHearts(){
  if(!elHearts||!player)return;
  var i,n=player.lives==null?3:player.lives, html='';
  if(n<0)n=0;if(n>3)n=3;
  for(i=0;i<3;i++)html+='<i class="heart'+(i<n?'':' off')+'" aria-hidden="true"></i>';
  elHearts.innerHTML=html;
  elHearts.setAttribute('aria-label','剩餘生命 '+n);
}
function syncHud(){
  if(!player||hud.hidden)return;
  elRank.textContent=PLACE[player.place-1]||'—';
  elLap.textContent=String(Math.min(LAPS,player.laps+1));
  elSpd.textContent=String(Math.round(player.speed*0.055));
  syncHearts();
  var total=LAPS*trackLen, k;
  for(k in dots){
    if(!dots[k])continue;
    var r=null,i;
    for(i=0;i<racers.length;i++)if(racers[i].id===(k==='you'?'you':k))r=racers[i];
    if(!r)continue;
    var p=Math.max(0,Math.min(1,progressOf(r)/total));
    dots[k].style.left=(p*100)+'%';
  }
}

/* ---------- render ---------- */
function size(){
  var r=canvas.getBoundingClientRect();
  var w=Math.max(1,Math.floor(r.width)), h=Math.max(1,Math.floor(r.height));
  DPR=Math.min(2,window.devicePixelRatio||1);
  if(canvas.width!==Math.floor(w*DPR)||canvas.height!==Math.floor(h*DPR)){
    canvas.width=Math.floor(w*DPR);canvas.height=Math.floor(h*DPR);
  }
  W=w;H=h;CX=W/2;CY=H*0.38;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
function project(p,camX,camY0,relZ){
  var scale=CAM_D/Math.max(1,relZ);
  p.scale=scale;
  p.sx=CX + scale*(p.wx-camX)*CX;
  p.sy=CY - scale*(p.wy-camY0)*CY + bounce;
  p.sw=scale*ROAD_W*CX;
}
function poly(x1,y1,w1,x2,y2,w2,col){
  if(y2<0||y1>H)return;
  ctx.fillStyle=col;
  ctx.beginPath();
  ctx.moveTo(x1-w1,y1);
  ctx.lineTo(x1+w1,y1);
  ctx.lineTo(x2+w2,y2);
  ctx.lineTo(x2-w2,y2);
  ctx.closePath();
  ctx.fill();
}
function lerpC(a,b,t){
  if(t<0)t=0;if(t>1)t=1;
  var ar=parseInt(a.slice(1,3),16),ag=parseInt(a.slice(3,5),16),ab=parseInt(a.slice(5,7),16);
  var br=parseInt(b.slice(1,3),16),bg=parseInt(b.slice(3,5),16),bb=parseInt(b.slice(5,7),16);
  var r=(ar+(br-ar)*t+0.5)|0,g=(ag+(bg-ag)*t+0.5)|0,bl=(ab+(bb-ab)*t+0.5)|0;
  return 'rgb('+r+','+g+','+bl+')';
}
function drawSky(){
  if(ready(IM.sky)){
    var im=IM.sky, hf=0.90, destH=CY/hf, destW=destH*(im.naturalWidth/Math.max(1,im.naturalHeight));
    if(destW<W*1.2)destW=W*1.2;
    var ox=-(Math.max(1,destW-W)*0.5);
    ctx.drawImage(im,ox,0,destW,destH);
  }else{
    var g=ctx.createLinearGradient(0,0,0,CY+8);
    g.addColorStop(0,'#5eb4ef');
    g.addColorStop(0.42,'#9ad4f6');
    g.addColorStop(0.78,'#f0d8b0');
    g.addColorStop(1,'#f6e4c0');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,W,H);
    hillLayer(0.7,'#b7d7a8',0.070,0.9);
    hillLayer(1.15,'#7fbe7a',0.052,0.85);
    hillLayer(1.7,'#4fa85e',0.038,0.7);
  }
  /* extra clay clouds for depth, kept in the upper sky */
  if(ready(IM.cloud)){
    var i,cw,ch,cx,cy;
    for(i=0;i<3;i++){
      cw=W*(0.22+((i*5)%4)*0.03);
      ch=cw*(IM.cloud.naturalHeight/Math.max(1,IM.cloud.naturalWidth));
      cx=mod(W*0.38*i+i*90, W+cw)-cw*0.5;
      cy=H*0.05+(i%3)*H*0.04;
      ctx.globalAlpha=0.88;
      ctx.drawImage(IM.cloud,cx,cy,cw,ch);
      ctx.globalAlpha=1;
    }
  }
}
function cloud(x,y,s,a){
  ctx.fillStyle='rgba(255,255,255,'+(a==null?0.8:a)+')';
  ctx.beginPath();
  ctx.arc(x,y,s*0.5,0,6.28);
  ctx.arc(x+s*0.5,y-s*0.18,s*0.42,0,6.28);
  ctx.arc(x+s*0.95,y,s*0.46,0,6.28);
  ctx.arc(x+s*0.42,y+s*0.1,s*0.34,0,6.28);
  ctx.fill();
}
function hillHump(x,par,height){
  var u=(x+skyOff*22*par)/W;
  var h=0;
  h+=Math.pow(Math.max(0,Math.cos((u*1.8+par*0.31)*Math.PI*2)),1.35)*0.72;
  h+=Math.pow(Math.max(0,Math.cos((u*2.7+par*1.17)*Math.PI*2)),1.5)*0.46;
  h+=Math.pow(Math.max(0,Math.sin((u*1.15+0.42)*Math.PI*2)),1.4)*0.38;
  return (0.28+h)*height*H;
}
function hillLayer(par,col,height,amp){
  ctx.fillStyle=col;
  ctx.beginPath();
  ctx.moveTo(0,CY+6);
  var x;
  for(x=0;x<=W;x+=5)ctx.lineTo(x, CY - hillHump(x,par,height)*(amp||1));
  ctx.lineTo(W,CY+8);ctx.lineTo(0,CY+8);ctx.fill();
}

function worldSX(worldX,scale){
  /* camera is locked to the road center (camX = 0) */
  return CX+scale*(worldX*ROAD_W)*CX;
}
function drawRoad(){
  var camZ=player.z-CAM_OFF;
  var base=segIndex(camZ);
  var n, seg, nxt, maxy=H, fog;
  var camX=0;
  /* project all in range */
  for(n=0;n<=DRAW;n++){
    seg=segs[(base+n)%N];
    var looped=seg.i<base && n!==0;
    var worldZ=seg.z+(looped?trackLen:0);
    var rel=worldZ-camZ;
    seg.p1.wx=0;seg.p1.wy=seg.y;
    project(seg.p1,camX,camY,rel);
    if(n>0){
      nxt=segs[(base+n-1)%N];
      seg.p2=nxt.p1;
    }
    seg.fog=Math.pow(n/DRAW,2.2);
    seg.clip=H;
  }
  /* near to far so hill clipping works */
  maxy=H;
  for(n=1;n<=DRAW;n++){
    seg=segs[(base+n)%N];
    var far=seg.p1, nearP=segs[(base+n-1)%N].p1;
    if(!(far.sw>0)||!(nearP.sw>0))continue;
    if(nearP.sy<=far.sy)continue;
    if(far.sy>=maxy)continue;
    fog=seg.fog;
    var grass=seg.pal?'#3aa656':'#4cb866';
    var rum=seg.pal?'#d94a44':'#f3eee4';
    var road=seg.pal?'#4a4745':'#575350';
    var sand=seg.pal?'#c4a15a':'#d7b86c';
    var haze='#ead7b4';
    grass=lerpC(grass,haze,fog*0.85);
    rum=lerpC(rum,haze,fog*0.7);
    road=lerpC(road,haze,fog*0.65);
    sand=lerpC(sand,haze,fog*0.75);
    var y1=nearP.sy, w1=nearP.sw, x1=nearP.sx;
    var y2=far.sy, w2=far.sw, x2=far.sx;
    poly(x1,y1,w1*3.4,x2,y2,w2*3.4,grass);
    poly(x1,y1,w1*1.28,x2,y2,w2*1.28,sand);
    poly(x1,y1,w1*1.10,x2,y2,w2*1.10,rum);
    poly(x1,y1,w1*1.035,x2,y2,w2*1.035,lerpC('#2a2826',haze,fog*0.5));
    poly(x1,y1,w1,x2,y2,w2,road);
    if(seg.pal){
      poly(x1,y1,w1*0.02,x2,y2,w2*0.02,lerpC('#efe46a',haze,fog*0.7));
    }
    poly(x1-w1*0.96,y1,w1*0.03,x2-w2*0.96,y2,w2*0.03,lerpC('#f3f3f3',haze,fog*0.7));
    poly(x1+w1*0.96,y1,w1*0.03,x2+w2*0.96,y2,w2*0.03,lerpC('#f3f3f3',haze,fog*0.7));
    if(y2<maxy)maxy=y2;
    seg.clip=maxy;
  }
}

function blit(im,sx,sy,sw,sh,clipY){
  if(!ready(im)||sw<1||sh<1)return;
  if(sy-sh>H||sy<0)return;
  if(clipY!=null&&sy-sh>clipY)return;
  ctx.save();
  if(clipY!=null&&clipY<H){ctx.beginPath();ctx.rect(0,0,W,clipY);ctx.clip()}
  ctx.drawImage(im,sx-sw/2,sy-sh,sw,sh);
  ctx.restore();
}
function spriteH(kind,sw){
  if(kind==='boost')return sw*0.36;
  if(kind==='oil')return sw*0.40;
  if(kind==='arch')return sw*0.58;
  if(kind==='box')return sw;
  if(kind==='cone')return sw*1.5;
  if(kind==='tree')return sw*1.7;
  if(kind==='chili')return sw*0.9;
  if(kind==='barrel')return sw*1.15;
  if(kind==='crate')return sw*0.92;
  if(kind==='spud')return sw*0.95;
  return sw;
}
function unitW(scale){return scale*ROAD_W*CX}
function imgOfKind(k){
  if(k==='box')return IM.box;
  if(k==='boost')return IM.boost;
  if(k==='oil')return IM.oil;
  if(k==='arch')return IM.arch;
  if(k==='tree')return IM.tree;
  if(k==='cone')return IM.cone;
  if(k==='chili')return IM.missile;
  if(k==='barrel')return IM.barrel;
  if(k==='crate')return IM.crate;
  if(k==='spud')return IM.spud;
  return null;
}
function drawWorldSprites(){
  var camZ=player.z-CAM_OFF;
  var base=segIndex(camZ);
  var n,i,seg,sp,rel,scale,sx,sy,sw,sh,clip;
  /* far to near */
  for(n=DRAW;n>=0;n--){
    seg=segs[(base+n)%N];
    clip=seg.clip||H;
    var looped=seg.i<base && n!==0;
    var worldZ=seg.z+(looped?trackLen:0);
    rel=worldZ-camZ;
    if(rel<1)continue;
    scale=CAM_D/rel;
    /* segment sprites */
    var uw=unitW(scale);
    for(i=0;i<seg.sprites.length;i++){
      sp=seg.sprites[i];
      if(sp.kind==='box'&&sp.hide>0)continue;
      sw=sp.w*sp.scale*uw*0.28;
      if(sp.kind==='arch')sw=uw*2.25;
      if(sp.kind==='boost')sw=uw*0.85;
      if(sp.kind==='tree')sw=uw*0.52*sp.scale;
      if(sp.kind==='cone')sw=uw*0.16;
      if(sp.kind==='box')sw=uw*0.30;
      if(sp.kind==='barrel')sw=uw*0.30;
      if(sp.kind==='crate')sw=uw*0.38;
      if(sp.kind==='spud')sw=uw*0.34;
      /* keep boost/oil pads from filling the control bar at the bottom */
      if((sp.kind==='boost'||sp.kind==='oil')&&rel<1200)continue;
      sh=spriteH(sp.kind,sw);
      sx=worldSX(sp.x,scale);
      sy=CY-scale*(seg.y-camY)*CY+bounce;
      /* bob item boxes */
      if(sp.kind==='box'){sy-=sh*0.15+Math.sin(raceT*5+seg.i)*sh*0.08}
      if(sy>H-96&&(sp.kind==='boost'||sp.kind==='oil'))continue;
      blit(imgOfKind(sp.kind),sx,sy,sw,sh,clip);
    }
    /* hazards on this seg */
    for(i=0;i<hazards.length;i++){
      if(segIndex(hazards[i].z)!==seg.i)continue;
      sw=uw*0.55;sh=spriteH('oil',sw);
      sx=worldSX(hazards[i].x,scale);
      sy=CY-scale*(seg.y-camY)*CY+bounce;
      blit(IM.oil,sx,sy,sw,sh,clip);
    }
    for(i=0;i<missiles.length;i++){
      if(segIndex(missiles[i].z)!==seg.i)continue;
      sw=uw*0.32;sh=spriteH('chili',sw);
      sx=worldSX(missiles[i].x,scale);
      sy=CY-scale*(seg.y-camY)*CY+bounce-sh*0.25;
      blit(IM.missile,sx,sy,sw,sh,clip);
    }
    for(i=0;i<particles.length;i++){
      if(segIndex(particles[i].z)!==seg.i)continue;
      var p=particles[i];
      sx=worldSX(p.x,scale);
      sy=CY-scale*(seg.y-camY)*CY+bounce-p.vy*p.life;
      ctx.globalAlpha=Math.max(0,p.life*2);
      ctx.fillStyle=p.c;
      ctx.beginPath();ctx.arc(sx,sy,Math.max(1.5,scale*CX*0.04),0,6.28);ctx.fill();
      ctx.globalAlpha=1;
    }
    /* rival karts on this segment (not player, player drawn last in front) */
    for(i=0;i<racers.length;i++){
      var r=racers[i];
      if(r===player)continue;
      if(segIndex(r.z)!==seg.i)continue;
      drawKartAt(r,scale,seg.y,clip,false);
    }
  }
  /* player projected at their world z so they sit on the road */
  var prel=CAM_OFF;
  var pscale=CAM_D/Math.max(40,prel);
  drawKartAt(player,pscale,player.y,H,true);
}

function drawKartAt(r,scale,roadY,clip,isP){
  var uw=unitW(scale);
  var sw=uw*(isP?0.62:0.54);
  var sh=sw*0.96;
  var sx=worldSX(r.x,scale);
  var sy=CY-scale*(roadY-camY)*CY+bounce;
  var im=r.im;
  if(isP){
    if(r.steer<-0.35)im=IM.playerL;
    else if(r.steer>0.35)im=IM.playerR;
    else im=IM.player;
  }
  ctx.save();
  if(clip!=null&&clip<H&&!isP){ctx.beginPath();ctx.rect(0,0,W,clip);ctx.clip()}
  /* contact point is the road at sy; wheels sit on a tight oval shadow */
  ctx.translate(sx,sy);
  ctx.rotate(r.steer*0.16);
  ctx.fillStyle='rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(0,-sh*0.035,sw*0.34,sh*0.055,0,0,6.28);
  ctx.fill();
  if(isP&&r.invulnT>0&&((raceT*16)|0)%2===0)ctx.globalAlpha=0.32;
  if(ready(im))ctx.drawImage(im,-sw/2,-sh,sw,sh);
  ctx.globalAlpha=1;
  if(r.shieldT>0&&ready(IM.shield)){
    ctx.globalAlpha=0.55+Math.sin(raceT*8)*0.1;
    ctx.drawImage(IM.shield,-sw*0.62,-sh*1.08,sw*1.24,sh*1.24);
    ctx.globalAlpha=1;
  }
  ctx.restore();
  if(r.boostT>0&&isP)drawSpeedLines();
}

function drawSpeedLines(){
  /* only during boost, and only along the left and right edges */
  var i,n=8;
  ctx.save();
  ctx.lineCap='round';
  for(i=0;i<n;i++){
    var t=(raceT*2.6+i*0.125)%1;
    var y=H*0.28+t*(H*0.58);
    var len=16+t*34;
    var inset=10+t*16;
    var a=0.12+t*0.4;
    ctx.strokeStyle='rgba(255,252,230,'+a+')';
    ctx.lineWidth=1.6+t*1.4;
    ctx.beginPath();ctx.moveTo(inset,y);ctx.lineTo(inset+5,y+len);ctx.stroke();
    ctx.beginPath();ctx.moveTo(W-inset,y);ctx.lineTo(W-inset-5,y+len);ctx.stroke();
  }
  ctx.restore();
}

function drawCount(){
  if(state==='count'&&countT>0){
    var n=Math.ceil(countT);
    var txt=n>=1?String(n):'';
    if(txt){
      ctx.save();
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='900 '+Math.floor(H*0.18)+'px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
      ctx.fillStyle='#fce404';
      ctx.strokeStyle='rgba(0,0,0,0.45)';
      ctx.lineWidth=10;
      ctx.strokeText(txt,CX,CY-20);
      ctx.fillText(txt,CX,CY-20);
      ctx.restore();
    }
  }
  if(goFlash>0){
    ctx.save();
    ctx.globalAlpha=Math.min(1,goFlash*2);
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='900 '+Math.floor(H*0.14)+'px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
    ctx.fillStyle='#fce404';
    ctx.strokeStyle='rgba(0,0,0,0.45)';
    ctx.lineWidth=8;
    ctx.strokeText('GO!',CX,CY-20);
    ctx.fillText('GO!',CX,CY-20);
    ctx.restore();
  }
  if(flash>0){
    ctx.fillStyle='rgba(255,255,255,'+(flash*0.45)+')';
    ctx.fillRect(0,0,W,H);
  }
}

function draw(){
  size();
  if(!player){ctx.fillStyle='#8ec8ef';ctx.fillRect(0,0,W,H);return}
  ctx.save();
  if(hurtShake>0){
    ctx.translate(Math.sin(raceT*52)*9*hurtShake, Math.cos(raceT*41)*6*hurtShake);
  }
  drawSky();
  ctx.fillStyle='#4caf62';ctx.fillRect(0,CY-2,W,H-(CY-2));
  drawRoad();
  drawWorldSprites();
  ctx.restore();
  drawCount();
}

function loop(ts){
  raf=requestAnimationFrame(loop);
  if(!lastTs)lastTs=ts;
  var dt=(ts-lastTs)/1000;lastTs=ts;
  if(state==='count'||state==='racing'||state==='done')update(dt);
  if(state!=='menu')draw();
}

/* ---------- flow ---------- */
function formatTime(t){
  var m=Math.floor(t/60), s=t-m*60;
  return m+':'+(s<10?'0':'')+s.toFixed(2);
}
function loadBest(){
  try{return parseFloat(localStorage.getItem(BEST_KEY)||'')}catch(e){return 0}
}
function saveBest(t){
  var b=loadBest();
  if(!b||t<b){try{localStorage.setItem(BEST_KEY,String(t))}catch(e){}return true}
  return false;
}
function showBest(){
  var b=loadBest();
  if(bestLine)bestLine.textContent=b?'最佳成績 '+formatTime(b):'';
}
function start(){
  unlockAudio();
  resetRace();
  frozen=0;
  state='count';
  ov.hidden=true;
  hud.hidden=false;
  if(controls)controls.hidden=false;
  itemBtn.hidden=false;
  syncItemBtn();
  syncHud();
  startEngine();
  lastTs=0;
  camY=player.y+CAM_H;
  if(!raf)raf=requestAnimationFrame(loop);
}
function finishRace(reason){
  if(state==='done')return;
  state='done';
  stopEngine();
  var place=player.place;
  var rec=false;
  var t=formatTime(player.finishT||raceT);
  var dist=Math.max(0,Math.round(progressOf(player)*0.055/3.6));
  var lapNow=Math.min(LAPS, (player.laps||0)+ (player.finished?0:1) );
  if(reason==='out'){
    if(how)how.hidden=true;
    if(ovLogo)ovLogo.hidden=true;
    ovT.textContent='出局了';
    ovS.innerHTML='<span class="big">'+ (PLACE_ZH[place-1]||'—') +'</span><br>跑到第 '+lapNow+' 圈　距離 '+dist+' 公尺';
  }else{
    sfxFinish();
    rec=saveBest(player.finishT||raceT);
    if(how)how.hidden=true;
    if(ovLogo)ovLogo.hidden=true;
    ovT.textContent='衝線！';
    ovS.innerHTML='<span class="big">'+PLACE_ZH[place-1]+'</span><br>時間 '+t+(rec?'　新最佳！':'');
  }
  var pick=window.PCGames?PCGames.pickHtml():'';
  var recBox=ov.querySelector('.rec');
  if(recBox)recBox.remove();
  if(pick){
    var host=how||ovS;
    host.insertAdjacentHTML('beforebegin',pick);
  }
  go.textContent='再來一場';
  fine.textContent='最高成績只存在你的手機瀏覽器。這是非官方小遊戲，沒有兌換或獎品。';
  ov.hidden=false;
  hud.hidden=true;
  itemBtn.hidden=true;
  if(controls)controls.hidden=true;
}
function backToIntro(){
  /* used if needed */
}

function shotPlay(){
  unlockAudio();
  resetRace();
  ov.hidden=true;
  hud.hidden=false;
  if(controls)controls.hidden=false;
  itemBtn.hidden=false;
  player.z=SHOT_Z;
  player.x=-0.52;
  player.y=roadYAt(player.z);
  player.speed=MAX_SPD*0.9;
  player.laps=1;
  player.item='turbo';
  player.boostT=0;
  player.steer=-1;
  player.lives=3;player.invulnT=0;
  sprHazard(segIndex(SHOT_Z+780),'barrel',0.05,1.05);
  sprHazard(segIndex(SHOT_Z+1040),'cone',0.42,1);
  sprHazard(segIndex(SHOT_Z+1040),'cone',0.58,1);
  sprHazard(segIndex(SHOT_Z+1320),'crate',0.50,1.05);
  sprHazard(segIndex(SHOT_Z+1600),'spud',0.12,1.08);
  racers[1].z=SHOT_Z+640;racers[1].x=0.40;racers[1].speed=MAX_SPD*0.82;racers[1].laps=1;racers[1].y=roadYAt(racers[1].z);
  racers[2].z=SHOT_Z+520;racers[2].x=0.18;racers[2].speed=MAX_SPD*0.8;racers[2].laps=1;racers[2].y=roadYAt(racers[2].z);
  racers[3].z=SHOT_Z+1100;racers[3].x=0.55;racers[3].speed=MAX_SPD*0.88;racers[3].laps=1;racers[3].y=roadYAt(racers[3].z);
  camY=player.y+CAM_H;
  raceT=12;
  frozen=1;
  state='racing';
  syncItemBtn();
  var i,order=racers.slice().sort(function(a,b){return progressOf(b)-progressOf(a)});
  for(i=0;i<order.length;i++)order[i].place=i+1;
  lastTs=0;
  if(!raf)raf=requestAnimationFrame(loop);
  size();draw();syncHud();
}

/* init */
function onResize(){if(state!=='menu')draw()}
buildTrack();
showBest();
setMuteUI();
size();
window.addEventListener('resize',onResize);
window.addEventListener('orientationchange',function(){setTimeout(onResize,180)});
d.addEventListener('keydown',function(e){onKey(e,true);syncSteerBtns()});
d.addEventListener('keyup',function(e){onKey(e,false);syncSteerBtns()});
bindLock(canvas,'pointerdown',onDown);
bindLock(canvas,'pointermove',onMove);
d.addEventListener('pointerup',onUp);
d.addEventListener('pointercancel',onUp);
bindLock(d,'touchmove',preventPage);
bindPad(btnL,'l');
bindPad(btnR,'r');
go.addEventListener('click',function(){unlockAudio();if(state==='done'||state==='menu')start()});
itemBtn.addEventListener('click',function(e){e.stopPropagation();useItem(player)});
itemBtn.addEventListener('pointerdown',function(e){e.stopPropagation();if(e.cancelable)e.preventDefault()});
muteBtn.addEventListener('click',function(e){e.stopPropagation();unlockAudio();setMuted(!muted)});
d.addEventListener('pointerdown',function first(){unlockAudio();d.removeEventListener('pointerdown',first,true)},true);

window.PCKart={
  start:start,
  shotPlay:shotPlay,
  setMuted:setMuted,
  useItem:function(){useItem(player)},
  hurt:function(k){return hurtPlayer(k||'obs')},
  view:function(){
    size();draw();
    var rel=CAM_OFF, scale=CAM_D/Math.max(40,rel);
    var camZ=player.z-CAM_OFF, base=segIndex(camZ);
    var near=segs[(base+8)%N].p1, far=segs[(base+40)%N].p1;
    return {
      cx:CX, camX:0,
      roadNear:near&&near.sx, roadFar:far&&far.sx,
      playerSx:worldSX(player.x,scale),
      x:player.x, steer:player.steer, z:player.z
    };
  },

  state:function(){return {mode:state,place:player&&player.place,laps:player&&player.laps,spd:player&&player.speed,item:player&&player.item,n:N,shot:SHOT_Z,z:player&&player.z,x:player&&player.x,steer:player&&player.steer,curve:player?curveNow(player.z):0,off:player?Math.abs(player.x)>=1:false,padL:padL,padR:padR,keyL:!!keys.l,keyR:!!keys.r,slip:player&&player.slipT,lives:player&&player.lives,invuln:player&&player.invulnT,shield:player&&player.shieldT}},
  skipToRace:function(){
    if(state==='menu'||state==='done')start();
    countT=0;state='racing';goFlash=0;frozen=0;
  },
  setInput:function(side){
    padL=side==='l'?1:0;padR=side==='r'?1:0;
    keys={};
    if(side!=='l'&&side!=='r')steer=0;
    syncSteerBtns();
  },
  placeOn:function(kind){
    var i=4,x0=0,spd=MAX_SPD*0.92;
    if(kind==='curve')i=28+12; /* mid first right-hand curve */
    else if(kind==='straight')i=8;
    if(kind==='offset'){i=8;x0=0.4}
    player.z=segs[i].z;player.x=x0;player.y=roadYAt(player.z);player.speed=spd;
    player.slipT=0;player.stunT=0;player.boostT=0;
    hazards.length=0;missiles.length=0;
    var ri;
    for(ri=0;ri<racers.length;ri++){
      if(racers[ri]===player)continue;
      racers[ri].z=player.z+trackLen*0.5;racers[ri].x=1.4;
      racers[ri].item=null;racers[ri].itemDelay=99;racers[ri].slipT=0;racers[ri].stunT=0;
    }
    camY=player.y+CAM_H;
    return {z:player.z,x:player.x,curve:curveNow(player.z)};
  },
  tick:function(n,dt,safe){
    dt=dt||1/60;n=n||1;
    var k,i;
    for(k=0;k<n;k++){
      if(safe){
        hazards.length=0;missiles.length=0;
        player.slipT=0;player.stunT=0;
        for(i=0;i<racers.length;i++){
          racers[i].item=null;racers[i].itemDelay=99;
          if(racers[i]!==player){racers[i].z=player.z+trackLen*0.5;racers[i].x=1.4;racers[i].slipT=0;racers[i].stunT=0}
        }
      }
      update(dt);
    }
  }
};

if(/[?&]shot=1/.test(location.search)){
  if(document.readyState==='complete')setTimeout(shotPlay,200);
  else window.addEventListener('load',function(){setTimeout(shotPlay,200)});
}
})();
