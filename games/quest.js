(function(){
'use strict';
var d=document, canvas=d.getElementById('stage'), ctx=canvas.getContext('2d',{alpha:false});
var ov=d.getElementById('ov'), ovT=d.getElementById('ovT'), ovS=d.getElementById('ovS');
var ovLogo=d.getElementById('ovlogo'), how=d.getElementById('how'), fine=d.getElementById('fine');
var go=d.getElementById('go'), pads=d.getElementById('pads'), muteBtn=d.getElementById('muteBtn');
var bestLine=d.getElementById('bestLine'), skillCdEl=d.getElementById('skillCd');
var btnL=d.getElementById('btnL'), btnR=d.getElementById('btnR');
var btnJump=d.getElementById('btnJump'), btnAtk=d.getElementById('btnAtk'), btnSkill=d.getElementById('btnSkill');

function img(src){var i=new Image();i.src=src;return i}
function ready(im){return im&&im.complete&&im.naturalWidth>0}
var IM={
  idle:img('img/quest/hero-idle.webp'),
  walk1:img('img/quest/hero-walk1.webp'),
  walk2:img('img/quest/hero-walk2.webp'),
  attack:img('img/quest/hero-attack.webp'),
  jump:img('img/quest/hero-jump.webp'),
  slime:img('img/quest/slime.webp'),
  burnt:img('img/quest/burnt.webp'),
  chili:img('img/quest/chili.webp'),
  boss:img('img/quest/boss.webp'),
  sky:img('img/quest/sky.webp'),
  ground:img('img/quest/ground.webp'),
  platform:img('img/quest/platform.webp'),
  coin:img('img/quest/coin.webp'),
  gem:img('img/quest/gem.webp'),
  potion:img('img/quest/potion.webp'),
  tree:img('img/quest/tree.webp')
};

var MUTE_KEY='pc-quest-mute', BEST_KEY='pc-quest-best';
var W=844, H=390, DPR=1, GROUND=302, WORLD_W=2200;
var GRAV=1950, JUMP_V=-640, MOVE=280, ACCEL=2200, FRICTION=2000, COYOTE=0.12;
var SKILL_CD=5.5, SKILL_COST=22, ATK_TIME=0.32;
var flashCvs=d.createElement('canvas'), flashCtx=flashCvs.getContext('2d');

var state='menu'; /* menu, play, over */
var frozen=false, lastTs=0, raf=0;
var camX=0, phase='mobs', stage=1, banner=null, bannerT=0;
var player=null, enemies=[], drops=[], nums=[], parts=[], bolts=[], plats=[];
var trees=[], holdL=0, holdR=0, keys={};
var score=0, kills=0, coins=0, paused=false;

var KINDS={
  slime:{hp:28, atk:8, spd:55, w:78, h:70, exp:14, coin:2, img:'slime', name:'油滴史萊姆'},
  burnt:{hp:48, atk:12, spd:70, w:78, h:82, exp:22, coin:3, img:'burnt', name:'焦黑薯塊'},
  chili:{hp:36, atk:10, spd:90, w:62, h:92, exp:20, coin:3, img:'chili', name:'辣椒精靈'},
  boss:{hp:260, atk:18, spd:80, w:150, h:168, exp:90, coin:16, img:'boss', name:'焦黑大薯王'}
};

/* ---------- audio ---------- */
var actx=null, master=null, unlocked=false, muted=false;
try{muted=localStorage.getItem(MUTE_KEY)==='1'}catch(e){}
function unlockAudio(){
  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  if(!actx){
    actx=new AC();
    master=actx.createGain();
    master.gain.value=muted?0:0.9;
    master.connect(actx.destination);
  }
  if(actx.state==='suspended')actx.resume();
  unlocked=true;
  return actx;
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
function noiseBuf(sec){
  var n=Math.max(1,Math.floor(actx.sampleRate*sec));
  var b=actx.createBuffer(1,n,actx.sampleRate);
  var d=b.getChannelData(0);
  for(var i=0;i<n;i++)d[i]=Math.random()*2-1;
  return b;
}
function env(g,t,peak,atk,hold,rel){
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(peak,t+atk);
  g.gain.setValueAtTime(peak,t+atk+hold);
  g.gain.exponentialRampToValueAtTime(0.0008,t+atk+hold+rel);
}
function oscTone(type,freq,freq2,dur,peak,atk){
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime;
  var o=actx.createOscillator();
  o.type=type;o.frequency.setValueAtTime(freq,t);
  if(freq2!=null)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq2),t+dur);
  var g=actx.createGain();
  env(g,t,peak,atk||0.01,Math.max(0,dur-0.08-(atk||0.01)),0.08);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.05);
}
function noiseShot(dur,peak,hp,q){
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime;
  var src=actx.createBufferSource();
  src.buffer=noiseBuf(Math.max(0.08,dur));
  var f=actx.createBiquadFilter();
  f.type='bandpass';f.frequency.value=hp||1800;f.Q.value=q||0.8;
  var g=actx.createGain();
  env(g,t,peak,0.008,Math.max(0,dur-0.05),0.06);
  src.connect(f);f.connect(g);g.connect(master);
  src.start(t);src.stop(t+dur+0.05);
}
function sfxSlash(){noiseShot(0.16,0.22,1400,0.7);oscTone('sawtooth',420,180,0.14,0.1,0.004)}
function sfxHit(){oscTone('square',220,90,0.12,0.16,0.003);noiseShot(0.1,0.16,700,0.8)}
function sfxCrit(){oscTone('square',880,440,0.16,0.18,0.003);oscTone('sine',1320,990,0.2,0.14,0.004);noiseShot(0.12,0.14,2400,1.2)}
function sfxDown(){oscTone('triangle',280,70,0.28,0.18,0.01);noiseShot(0.2,0.12,400,0.6)}
function sfxCoin(){oscTone('square',1320,1800,0.1,0.1,0.003);oscTone('sine',1760,2200,0.12,0.08,0.005)}
function sfxSkill(){
  noiseShot(0.35,0.2,2200,0.6);
  oscTone('sawtooth',280,720,0.28,0.14,0.02);
  oscTone('sine',880,1400,0.32,0.1,0.04);
}
function sfxLevel(){
  [523,659,784,1046].forEach(function(f,i){oscTone('sine',f,f*1.02,0.22,0.14,0.01+i*0.08)});
  oscTone('triangle',1318,1318,0.35,0.1,0.22);
}
function sfxHurt(){oscTone('sawtooth',180,70,0.22,0.2,0.004);noiseShot(0.18,0.16,300,0.5)}
function sfxOver(){
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime;
  [392,349,294,220].forEach(function(f,i){
    var o=actx.createOscillator();o.type='triangle';
    o.frequency.setValueAtTime(f,t+i*0.16);
    var g=actx.createGain();
    env(g,t+i*0.16,0.16,0.01,0.1,0.16);
    o.connect(g);g.connect(master);o.start(t+i*0.16);o.stop(t+i*0.16+0.32);
  });
}
function sfxPickup(){oscTone('sine',880,1320,0.1,0.1,0.003)}

/* ---------- helpers ---------- */
function clamp(v,a,b){return v<a?a:v>b?b:v}
function lerp(a,b,t){return a+(b-a)*t}
function rand(a,b){return a+Math.random()*(b-a)}
function irand(a,b){return a+Math.floor(Math.random()*(b-a+1))}
function aabb(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by}
function bestScore(){try{return parseInt(localStorage.getItem(BEST_KEY)||'0',10)||0}catch(e){return 0}}
function saveBest(n){
  var b=bestScore();
  if(n>b){try{localStorage.setItem(BEST_KEY,String(n))}catch(e){}return true}
  return false;
}
function expNeed(lv){return 36+lv*28}

function size(){
  var wrap=d.getElementById('wrap');
  var rw=Math.max(1,wrap.clientWidth||window.innerWidth);
  var rh=Math.max(1,wrap.clientHeight||window.innerHeight);
  DPR=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(W*DPR);
  canvas.height=Math.round(H*DPR);
  canvas.style.width=rw+'px';
  canvas.style.height=rh+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
}

/* ---------- world ---------- */
function makePlats(){
  plats=[
    {x:380,y:214,w:230},
    {x:780,y:168,w:250},
    {x:1180,y:214,w:230},
    {x:1580,y:160,w:240},
    {x:1960,y:214,w:200}
  ];
  trees=[
    {x:180,s:1.0},{x:560,s:0.85},{x:1020,s:1.1},{x:1480,s:0.9},{x:1880,s:1.05}
  ];
}
function makePlayer(){
  return {
    x:180,y:GROUND,vx:0,vy:0,face:1,onG:true,coyote:0,
    w:50,h:90,drawW:92,drawH:116,
    hp:100,maxHp:100,mp:50,maxMp:50,
    atk:14,lv:1,exp:0,need:expNeed(1),
    atkT:0,hitDone:0,skillT:0,skillFx:0,hurtT:0,inv:0,
    anim:0,dead:0,jumpBuf:0,levelFx:0
  };
}
function spawnEnemy(kind,x,y){
  var k=KINDS[kind];
  var mul=1+(stage-1)*0.22;
  var e={
    kind:kind,x:x,y:y==null?GROUND:y,vx:0,vy:0,face:-1,onG:true,
    w:k.w*0.46,h:k.h*0.88,drawW:k.w,drawH:k.h,
    hp:Math.round(k.hp*mul),maxHp:Math.round(k.hp*mul),
    atk:Math.round(k.atk*(1+(stage-1)*0.12)),spd:k.spd,
    exp:Math.round(k.exp*(1+(stage-1)*0.1)),coin:k.coin,
    flash:0,hurtT:0,cd:rand(0.4,1.6),phase:0,dead:0,bob:Math.random()*6
  };
  if(kind==='boss'){e.w=70;e.h=148;e.drawW=k.w;e.drawH=k.h;e.cd=1.6}
  enemies.push(e);
  return e;
}
function waveMobs(st){
  var list=[];
  if(st===1)list=['slime','slime','slime','burnt'];
  else if(st===2)list=['slime','slime','burnt','chili','burnt'];
  else if(st===3)list=['slime','burnt','chili','burnt','chili','slime'];
  else{
    var n=5+Math.min(4,st);
    var pool=['slime','slime','burnt','chili'];
    for(var i=0;i<n;i++)list.push(pool[i%pool.length]);
  }
  var used=[];
  list.forEach(function(k){
    var x, tries=0;
    do{x=rand(360,WORLD_W-120);tries++}while(tries<8&&(Math.abs(x-player.x)<180||used.some(function(u){return Math.abs(u-x)<90})));
    used.push(x);
    spawnEnemy(k,x);
  });
}
function addNum(x,y,n,crit){
  nums.push({x:x,y:y,n:n,crit:!!crit,t:0,life:0.85,vx:rand(-18,18),vy:-70});
}
function addDrop(typ,x,y){
  drops.push({typ:typ,x:x,y:y,vy:rand(-220,-80),vx:rand(-70,70),t:0,mag:0});
}
function burst(x,y,col,n,spd){
  for(var i=0;i<n;i++){
    var a=rand(0,Math.PI*2),s=rand(40,spd||180);
    parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:rand(0.3,0.7),col:col,s:rand(2.5,5.5)});
  }
}
function showBanner(text,sec){banner=text;bannerT=sec||1.5}

function start(){
  unlockAudio();
  state='play';frozen=false;paused=false;
  score=0;kills=0;coins=0;stage=1;phase='mobs';
  enemies=[];drops=[];nums=[];parts=[];bolts=[];
  player=makePlayer();
  makePlats();
  camX=0;
  waveMobs(stage);
  showBanner('第 1 關',1.4);
  ov.hidden=true;
  if(pads)pads.hidden=false;
  d.body.classList.add('playing');
  lastTs=0;
  if(!raf)raf=requestAnimationFrame(loop);
}

function gameOver(){
  state='over';
  sfxOver();
  if(pads)pads.hidden=true;
  var nb=saveBest(score);
  var pick=window.PCGames?PCGames.pickHtml():'';
  if(ovLogo)ovLogo.hidden=true;
  if(how)how.hidden=true;
  ovT.textContent='冒險結束';
  ovS.innerHTML='等級 <span class="big">LV.'+player.lv+'</span><br>分數 <span class="big">'+score+'</span>　擊敗 <span class="big">'+kills+'</span><br>'+(nb?'新的最高分！':'最高分 '+bestScore())+pick;
  go.textContent='再玩一次';
  fine.textContent='最高分只存在你的手機瀏覽器。這是非官方小遊戲，沒有兌換或獎品。';
  ov.hidden=false;
}

function levelUp(){
  player.lv++;
  player.exp-=player.need;
  if(player.exp<0)player.exp=0;
  player.need=expNeed(player.lv);
  player.maxHp+=18;
  player.atk+=3;
  player.hp=player.maxHp;
  player.mp=player.maxMp;
  player.levelFx=1.4;
  sfxLevel();
  burst(player.x,player.y-80,'#fce404',22,240);
  burst(player.x,player.y-80,'#fff6bf',12,160);
}

/* ---------- combat ---------- */
function tryAtk(){
  if(state!=='play'||player.dead||player.atkT>0)return;
  player.atkT=ATK_TIME;player.hitDone=0;
  sfxSlash();
}
function trySkill(){
  if(state!=='play'||player.dead)return;
  if(player.skillT>0||player.mp<SKILL_COST)return;
  player.mp-=SKILL_COST;
  player.skillT=SKILL_CD;
  player.skillFx=0.45;
  sfxSkill();
  var cx=player.x+player.face*88, cy=player.y-48;
  var cols=['#f5a623','#7de3a8','#e04a1f','#fff6bf','#6b3b1f'];
  for(var i=0;i<36;i++){
    var a=(player.face>0?-0.7:Math.PI-0.7)+rand(-0.7,0.7);
    var s=rand(90,280);
    parts.push({x:cx,y:cy,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,t:0,life:rand(0.35,0.7),col:cols[i%cols.length],s:rand(3,7)});
  }
  skillHit(cx,cy,130,Math.round(player.atk*2.3));
}
function skillHit(cx,cy,r,dmg){
  enemies.forEach(function(e){
    if(e.dead)return;
    var ex=e.x, ey=e.y-e.h*0.5;
    var dx=ex-cx, dy=ey-cy;
    if(dx*dx+dy*dy<=r*r) hitEnemy(e,dmg,true);
  });
}
function meleeHit(){
  var p=player, f=p.face;
  var ax=f>0?p.x+10:p.x-100, aw=90;
  var ay=p.y-78, ah=70;
  enemies.forEach(function(e){
    if(e.dead)return;
    if(aabb(ax,ay,aw,ah,e.x-e.w/2,e.y-e.h,e.w,e.h)){
      var crit=Math.random()<0.18;
      var dmg=Math.round(p.atk*rand(0.88,1.14)*(crit?2.15:1));
      hitEnemy(e,dmg,crit);
    }
  });
}
function hitEnemy(e,dmg,crit){
  e.hp-=dmg;
  e.flash=0.14;
  e.hurtT=0.2;
  e.vx+=(e.x>=player.x?1:-1)*(crit?280:180);
  e.vy-=80;
  addNum(e.x,e.y-e.h-6,dmg,crit);
  burst(e.x,e.y-e.h*0.6,crit?'#fce404':'#fff',crit?8:5,140);
  if(crit)sfxCrit();else sfxHit();
  score+=dmg;
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  if(e.dead)return;
  e.dead=1;e.hp=0;kills++;
  sfxDown();
  player.exp+=e.exp;
  score+=e.exp*2+(e.kind==='boss'?400:0);
  burst(e.x,e.y-e.h*0.5,'#fff6bf',14,200);
  var n=e.coin+irand(0,2);
  for(var i=0;i<n;i++)addDrop('coin',e.x+rand(-16,16),e.y-20);
  if(Math.random()<0.45)addDrop('gem',e.x,e.y-24);
  if(Math.random()<(e.kind==='boss'?0.8:0.22))addDrop('potion',e.x+rand(-10,10),e.y-24);
  if(player.exp>=player.need)levelUp();
  if(e.kind==='boss'){
    showBanner('第 '+(stage+1)+' 關',1.6);
    stage++;
    phase='clear';
    setTimeout(function(){
      if(state!=='play')return;
      phase='mobs';
      waveMobs(stage);
    },1400);
  }
}
function hurtPlayer(dmg,srcX){
  if(player.inv>0||player.dead||state!=='play')return;
  player.hp-=dmg;
  player.hurtT=0.35;
  player.inv=0.85;
  player.vx+=(player.x>=srcX?1:-1)*220;
  player.vy=-180;
  sfxHurt();
  burst(player.x,player.y-50,'#ff6b6b',8,140);
  if(player.hp<=0){
    player.hp=0;player.dead=1;
    setTimeout(function(){if(state==='play')gameOver()},500);
  }
}

/* ---------- update ---------- */
function footOnPlat(x,y,vy,w){
  if(vy<0)return null;
  for(var i=0;i<plats.length;i++){
    var p=plats[i];
    if(x+w/2>p.x&&x-w/2<p.x+p.w){
      if(y>=p.y-8&&y<=p.y+16)return p;
    }
  }
  return null;
}
function updatePlayer(dt){
  var p=player;
  if(p.dead){p.vy+=GRAV*dt;p.y+=p.vy*dt;if(p.y>GROUND){p.y=GROUND;p.vy=0}return}
  var dir=(holdR||keys.Right||keys.KeyD?1:0)-(holdL||keys.Left||keys.KeyA?1:0);
  if(p.atkT>0.08)dir=dir*0.35;
  if(dir){p.vx+=dir*ACCEL*dt;p.face=dir>0?1:-1}
  else{
    if(p.vx>0){p.vx=Math.max(0,p.vx-FRICTION*dt)}
    else if(p.vx<0){p.vx=Math.min(0,p.vx+FRICTION*dt)}
  }
  p.vx=clamp(p.vx,-MOVE,MOVE);
  if(p.jumpBuf>0)p.jumpBuf-=dt;
  var wantJump=p.jumpBuf>0;
  if(p.onG)p.coyote=COYOTE;
  else p.coyote-=dt;
  if(wantJump&&p.coyote>0){
    p.vy=JUMP_V;p.onG=false;p.coyote=0;p.jumpBuf=0;
  }
  p.vy+=GRAV*dt;
  p.x+=p.vx*dt;
  p.y+=p.vy*dt;
  p.x=clamp(p.x,40,WORLD_W-40);
  p.onG=false;
  var plat=footOnPlat(p.x,p.y,p.vy,p.w);
  if(plat&&p.vy>=0){p.y=plat.y;p.vy=0;p.onG=true}
  if(p.y>=GROUND){p.y=GROUND;p.vy=0;p.onG=true}
  if(p.atkT>0){
    var prev=p.atkT;p.atkT-=dt;
    if(!p.hitDone&&p.atkT<=ATK_TIME-0.07&&prev>ATK_TIME-0.07){meleeHit();p.hitDone=1}
    if(p.atkT<0)p.atkT=0;
  }
  if(p.skillT>0)p.skillT=Math.max(0,p.skillT-dt);
  if(p.skillFx>0)p.skillFx=Math.max(0,p.skillFx-dt);
  if(p.hurtT>0)p.hurtT=Math.max(0,p.hurtT-dt);
  if(p.inv>0)p.inv=Math.max(0,p.inv-dt);
  if(p.levelFx>0)p.levelFx=Math.max(0,p.levelFx-dt);
  p.mp=Math.min(p.maxMp,p.mp+8*dt);
  p.anim+=dt*(Math.abs(p.vx)>20?8:4);
  if(p.exp>=p.need)levelUp();
}
function updateEnemy(e,dt){
  if(e.dead){e.y+=40*dt;e.flash=0;return}
  if(e.flash>0)e.flash-=dt;
  if(e.hurtT>0)e.hurtT-=dt;
  e.bob+=dt;
  e.cd-=dt;
  var dx=player.x-e.x;
  if(Math.abs(dx)>16)e.face=dx>0?1:-1;
  var aggro=Math.abs(dx)<520;
  if(e.kind==='boss'){
    if(e.phase==='dash'){
      e.x+=e.face*340*dt;
      if(e.cd<=0){e.phase=0;e.cd=rand(1.4,2.2)}
    }else if(e.phase==='slam'){
      if(e.cd<=0){
        e.phase=0;e.cd=rand(1.2,2);
        if(Math.abs(player.x-e.x)<110&&Math.abs(player.y-e.y)<80)hurtPlayer(e.atk+6,e.x);
        burst(e.x,e.y-10,'#6b3b1f',12,180);
      }
    }else if(e.cd<=0){
      if(Math.abs(dx)<140){e.phase='slam';e.cd=0.4}
      else{e.phase='dash';e.cd=0.55}
    }else if(aggro){
      e.vx=e.face*e.spd*0.7;
    }
  }else if(e.kind==='chili'){
    if(aggro)e.vx=e.face*e.spd*0.7;
    else e.vx=e.face*e.spd*0.35;
    if(e.cd<=0&&aggro&&Math.abs(dx)<460){
      e.cd=rand(1.8,2.6);
      bolts.push({x:e.x+e.face*16,y:e.y-e.h*0.6,vx:e.face*220,vy:-40,life:2.2,atk:e.atk});
    }
  }else{
    if(aggro)e.vx=e.face*e.spd*(e.kind==='burnt'?0.85:0.65);
    else{
      if(e.cd<=0){e.face*=-1;e.cd=rand(1.2,2.6)}
      e.vx=e.face*e.spd*0.4;
    }
  }
  if(e.hurtT>0)e.vx*=0.4;
  e.vy+=GRAV*dt;
  e.x+=e.vx*dt;
  e.y+=e.vy*dt;
  e.x=clamp(e.x,50,WORLD_W-50);
  e.onG=false;
  var plat=footOnPlat(e.x,e.y,e.vy,e.w);
  if(plat&&e.vy>=0){e.y=plat.y;e.vy=0;e.onG=true}
  if(e.y>=GROUND){e.y=GROUND;e.vy=0;e.onG=true}
  if(!player.dead&&player.inv<=0&&aabb(player.x-player.w/2,player.y-player.h,player.w,player.h,e.x-e.w/2,e.y-e.h,e.w,e.h)){
    hurtPlayer(e.atk,e.x);
  }
}
function updateBolts(dt){
  for(var i=bolts.length-1;i>=0;i--){
    var b=bolts[i];
    b.vy+=GRAV*0.35*dt;
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    if(b.y>GROUND+20||b.life<=0||b.x<-20||b.x>WORLD_W+20){bolts.splice(i,1);continue}
    if(!player.dead&&player.inv<=0&&aabb(player.x-player.w/2,player.y-player.h,player.w,player.h,b.x-8,b.y-8,16,16)){
      hurtPlayer(b.atk,b.x);bolts.splice(i,1);
    }
  }
}
function updateDrops(dt){
  for(var i=drops.length-1;i>=0;i--){
    var o=drops[i];
    o.t+=dt;
    if(!o.mag){
      o.vy+=GRAV*dt;o.x+=o.vx*dt;o.y+=o.vy*dt;o.vx*=0.98;
      if(o.y>=GROUND){o.y=GROUND;o.vy*=-0.25;o.vx*=0.6;if(Math.abs(o.vy)<40)o.vy=0}
    }
    var dx=player.x-o.x, dy=(player.y-40)-o.y, dist=Math.hypot(dx,dy);
    if(dist<110||o.mag){
      o.mag=1;
      var s=420*dt;
      if(dist>1){o.x+=dx/dist*s;o.y+=dy/dist*s}
    }
    if(dist<28||(o.mag&&dist<36)){
      if(o.typ==='coin'){coins++;score+=10;sfxCoin()}
      else if(o.typ==='gem'){player.exp+=10;score+=25;sfxPickup();if(player.exp>=player.need)levelUp()}
      else{player.hp=Math.min(player.maxHp,player.hp+32);sfxPickup()}
      drops.splice(i,1);
    }
  }
}
function updateFX(dt){
  for(var i=nums.length-1;i>=0;i--){
    var n=nums[i];n.t+=dt;n.x+=n.vx*dt;n.y+=n.vy*dt;n.vy+=80*dt;
    if(n.t>=n.life)nums.splice(i,1);
  }
  for(var j=parts.length-1;j>=0;j--){
    var p=parts[j];p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.vx*=0.98;
    if(p.t>=p.life)parts.splice(j,1);
  }
  if(bannerT>0){bannerT-=dt;if(bannerT<=0)banner=null}
  if(phase==='mobs'&&enemies.every(function(e){return e.dead||e.kind==='boss'})&&enemies.filter(function(e){return !e.dead}).length===0){
    phase='bossWait';
    showBanner('BOSS 出現！',1.3);
    setTimeout(function(){
      if(state!=='play'||phase!=='bossWait')return;
      phase='boss';
      var bx=clamp(player.x+360,400,WORLD_W-140);
      spawnEnemy('boss',bx);
    },900);
  }
  /* purge dead extras after a bit */
  enemies=enemies.filter(function(e){return !e.dead||e.y<H+80});
}

function loop(ts){
  raf=requestAnimationFrame(loop);
  if(!lastTs)lastTs=ts;
  var dt=Math.min(0.033,(ts-lastTs)/1000);
  lastTs=ts;
  if(state==='play'&&!frozen&&!paused){
    updatePlayer(dt);
    enemies.forEach(function(e){updateEnemy(e,dt)});
    updateBolts(dt);
    updateDrops(dt);
    updateFX(dt);
    var target=player.x-280;
    camX=lerp(camX,target,1-Math.pow(0.001,dt));
    camX=clamp(camX,0,Math.max(0,WORLD_W-W));
  }
  draw();
  syncPads();
}

/* ---------- draw ---------- */
function sx(x){return x-camX}
function drawImg(im,x,y,w,h,flip,flash){
  if(!ready(im))return;
  ctx.save();
  ctx.translate(x,y);
  if(flip)ctx.scale(-1,1);
  ctx.drawImage(im,-w/2,-h,w,h);
  if(flash){
    var cw=Math.max(2,Math.round(w)), ch=Math.max(2,Math.round(h));
    flashCvs.width=cw;flashCvs.height=ch;
    flashCtx.clearRect(0,0,cw,ch);
    flashCtx.drawImage(im,0,0,cw,ch);
    flashCtx.globalCompositeOperation='source-in';
    flashCtx.fillStyle='#fff';
    flashCtx.fillRect(0,0,cw,ch);
    ctx.globalAlpha=0.42;
    ctx.drawImage(flashCvs,-w/2,-h,w,h);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}
function heroFrame(){
  var p=player;
  if(p.atkT>0)return IM.attack;
  if(!p.onG)return IM.jump;
  if(Math.abs(p.vx)>30)return (Math.floor(p.anim)%2===0)?IM.walk1:IM.walk2;
  return IM.idle;
}
function drawSky(){
  if(ready(IM.sky)){
    var par=camX*0.18;
    var sw=IM.sky.naturalWidth, sh=IM.sky.naturalHeight;
    var dh=H, dw=dh*sw/sh;
    var ox=-((par)%dw);
    if(ox>0)ox-=dw;
    for(var x=ox-dw;x<W+dw;x+=dw)ctx.drawImage(IM.sky,x,0,dw,dh);
  }else{
    ctx.fillStyle='#62c8f8';ctx.fillRect(0,0,W,H);
  }
}
function drawGround(){
  if(!ready(IM.ground)){
    ctx.fillStyle='#5aaa32';ctx.fillRect(0,GROUND,W,H-GROUND);return;
  }
  var gh=128, gw=gh*IM.ground.naturalWidth/IM.ground.naturalHeight;
  var top=GROUND-36;
  var start= -((camX)%gw);
  if(start>0)start-=gw;
  for(var x=start-gw;x<W+gw;x+=gw)ctx.drawImage(IM.ground,x,top,gw,gh);
  if(top+gh<H){
    ctx.fillStyle='#c8a36a';
    ctx.fillRect(0,top+gh-2,W,H-(top+gh-2));
  }
}
function drawTrees(){
  if(!ready(IM.tree))return;
  trees.forEach(function(t){
    var x=sx(t.x), h=150*t.s, w=h*0.82;
    if(x<-w||x>W+w)return;
    drawImg(IM.tree,x,GROUND+6,w,h,false,false);
  });
}
function drawPlats(){
  plats.forEach(function(p){
    var x=sx(p.x+p.w/2);
    if(x<-p.w||x>W+p.w)return;
    if(ready(IM.platform))ctx.drawImage(IM.platform,sx(p.x),p.y-18,p.w,56);
    else{
      ctx.fillStyle='#b8864a';ctx.fillRect(sx(p.x),p.y,p.w,18);
    }
  });
}
function drawDrops(){
  drops.forEach(function(o){
    var im=o.typ==='coin'?IM.coin:o.typ==='gem'?IM.gem:IM.potion;
    var bob=Math.sin(o.t*6)*3;
    var s=o.typ==='potion'?30:26;
    drawImg(im,sx(o.x),o.y-8+bob,s,s,false,false);
  });
}
function drawEnemies(){
  enemies.forEach(function(e){
    if(e.dead&&e.y>H+20)return;
    var x=sx(e.x);
    if(x<-120||x>W+120)return;
    var bob=e.kind==='slime'?Math.sin(e.bob*5)*2:0;
    var im=IM[KINDS[e.kind].img]||IM.slime;
    ctx.globalAlpha=e.dead?0.5:1;
    drawImg(im,x,e.y+bob,e.drawW,e.drawH,e.face<0,e.flash>0);
    ctx.globalAlpha=1;
    if(!e.dead&&e.kind!=='boss'&&e.hp<e.maxHp){
      var bw=Math.max(36,e.drawW*0.55), bh=5;
      var bx=x-bw/2, by=e.y-e.drawH-8;
      ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(bx-1,by-1,bw+2,bh+2);
      ctx.fillStyle='#e24b4b';ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),bh);
    }
  });
}
function drawBolts(){
  bolts.forEach(function(b){
    var x=sx(b.x);
    ctx.save();
    ctx.translate(x,b.y);
    var g=ctx.createRadialGradient(0,0,1,0,0,9);
    g.addColorStop(0,'#fff6bf');g.addColorStop(0.4,'#f5a623');g.addColorStop(1,'rgba(224,74,31,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });
}
function drawPlayer(){
  var p=player;
  if(p.inv>0&&Math.floor(p.inv*14)%2===0&&!p.dead)return;
  var im=heroFrame();
  var x=sx(p.x);
  if(p.skillFx>0){
    ctx.save();
    ctx.globalAlpha=0.45*p.skillFx/0.45;
    var rg=ctx.createRadialGradient(x+p.face*70,p.y-48,10,x+p.face*70,p.y-48,130);
    rg.addColorStop(0,'rgba(252,228,4,.7)');
    rg.addColorStop(0.5,'rgba(125,227,168,.35)');
    rg.addColorStop(1,'rgba(224,74,31,0)');
    ctx.fillStyle=rg;ctx.beginPath();ctx.arc(x+p.face*70,p.y-48,130,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  drawImg(im,x,p.y+2,p.drawW,p.drawH,p.face<0,p.hurtT>0);
  if(p.levelFx>0){
    var k=1-p.levelFx/1.4;
    var sc=0.8+Math.sin(Math.min(1,k*3)*Math.PI)*0.35;
    ctx.save();
    ctx.globalAlpha=Math.max(0,1-k);
    ctx.translate(x,p.y-p.drawH-8);
    ctx.scale(sc,sc);
    ctx.font='900 22px -apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=5;ctx.strokeStyle='#0b612e';ctx.fillStyle='#fce404';
    ctx.strokeText('LEVEL UP!',0,0);ctx.fillText('LEVEL UP!',0,0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha=0.5*(1-k);
    ctx.strokeStyle='#fce404';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,p.y-50,30+k*70,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
}
function drawNums(){
  nums.forEach(function(n){
    var a=1-n.t/n.life;
    var sc=n.crit?(1.45+Math.sin(Math.min(1,n.t*18))*0.15):1;
    ctx.save();
    ctx.globalAlpha=Math.max(0,a);
    ctx.translate(sx(n.x),n.y);
    ctx.scale(sc,sc);
    ctx.font='900 '+(n.crit?26:18)+'px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=n.crit?6:4;
    ctx.strokeStyle=n.crit?'#7a4a00':'#3a2a10';
    ctx.fillStyle=n.crit?'#fce404':'#fff8e8';
    var lab=String(n.n);
    ctx.strokeText(lab,1,2);ctx.strokeText(lab,0,0);ctx.fillText(lab,0,0);
    ctx.restore();
  });
}
function drawParts(){
  parts.forEach(function(p){
    var a=1-p.t/p.life;
    ctx.globalAlpha=Math.max(0,a);
    ctx.fillStyle=p.col;
    ctx.beginPath();ctx.arc(sx(p.x),p.y,p.s*(0.6+a*0.4),0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;
}
function bar(x,y,w,h,ratio,col,back){
  ctx.fillStyle=back||'rgba(0,0,0,.45)';
  ctx.fillRect(x,y,w,h);
  ctx.fillStyle=col;
  ctx.fillRect(x,y,Math.max(0,w*clamp(ratio,0,1)),h);
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);
}
function drawHUD(){
  var p=player;
  ctx.save();
  ctx.font='800 12px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
  ctx.textBaseline='middle';
  var x=72, y=16;
  ctx.fillStyle='rgba(8,40,18,.55)';
  ctx.fillRect(x-8,y-10,268,58);
  ctx.fillStyle='#fce404';ctx.font='900 15px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
  ctx.textAlign='left';
  ctx.fillText('LV.'+p.lv,x,y);
  ctx.fillStyle='#fff';ctx.font='800 11px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
  ctx.fillText('HP',x+58,y);
  bar(x+78,y-6,150,12,p.hp/p.maxHp,'#3cc15a');
  ctx.fillStyle='#fff';ctx.font='700 10px sans-serif';
  ctx.textAlign='center';ctx.fillText(Math.ceil(p.hp)+'/'+p.maxHp,x+153,y);
  ctx.textAlign='left';
  ctx.fillStyle='#fff';ctx.font='800 11px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
  ctx.fillText('MP',x+58,y+16);
  bar(x+78,y+10,150,10,p.mp/p.maxMp,'#4aa3f5');
  ctx.fillStyle='#fff';ctx.font='800 11px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
  ctx.fillText('EXP',x,y+34);
  bar(x+32,y+28,196,8,p.exp/p.need,'#fce404');
  ctx.textAlign='right';
  ctx.fillStyle='#fff';ctx.font='800 12px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
  var rx=W-78;
  ctx.fillText('第 '+stage+' 關',rx,16);
  ctx.fillStyle='#fce404';
  ctx.fillText('金幣 '+coins,rx,34);
  ctx.fillStyle='#fff';
  ctx.fillText('分數 '+score,rx,50);
  ctx.restore();

  var boss=enemies.filter(function(e){return e.kind==='boss'&&!e.dead})[0];
  if(boss){
    var bw=360, bx=(W-bw)/2, by=64;
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(bx-4,by-16,bw+8,28);
    ctx.fillStyle='#fce404';ctx.font='900 12px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('焦黑大薯王',W/2,by-8);
    bar(bx,by+2,bw,8,boss.hp/boss.maxHp,'#e24b4b','rgba(40,0,0,.6)');
  }
  if(banner){
    ctx.save();
    ctx.globalAlpha=bannerT>0.3?1:Math.max(0,bannerT/0.3);
    ctx.font='900 28px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=7;ctx.strokeStyle='#0b612e';ctx.fillStyle='#fce404';
    ctx.strokeText(banner,W/2,H*0.32);ctx.fillText(banner,W/2,H*0.32);
    ctx.restore();
  }
}
function draw(){
  ctx.clearRect(0,0,W,H);
  drawSky();
  drawTrees();
  drawPlats();
  drawGround();
  drawDrops();
  drawEnemies();
  drawBolts();
  if(player)drawPlayer();
  drawParts();
  drawNums();
  if(player&&(state==='play'||state==='over'))drawHUD();
}
function syncPads(){
  if(!skillCdEl||!player)return;
  if(player.skillT>0){
    btnSkill.classList.add('cd');
    skillCdEl.style.height=(player.skillT/SKILL_CD*100)+'%';
  }else{
    btnSkill.classList.remove('cd');
    skillCdEl.style.height='0';
  }
}

/* ---------- input ---------- */
function bindHold(btn,set){
  if(!btn)return;
  var pid=null;
  function down(e){
    e.preventDefault();e.stopPropagation();
    unlockAudio();
    pid=e.pointerId;set(1);btn.classList.add('on');
    try{btn.setPointerCapture(e.pointerId)}catch(err){}
  }
  function up(e){
    if(pid!=null&&e.pointerId!==pid&&e.type!=='pointercancel')return;
    set(0);btn.classList.remove('on');pid=null;
  }
  btn.addEventListener('pointerdown',down);
  btn.addEventListener('pointerup',up);
  btn.addEventListener('pointercancel',up);
  btn.addEventListener('lostpointercapture',up);
}
bindHold(btnL,function(v){holdL=v});
bindHold(btnR,function(v){holdR=v});
function tapBtn(btn,fn){
  if(!btn)return;
  btn.addEventListener('pointerdown',function(e){
    e.preventDefault();e.stopPropagation();
    unlockAudio();fn();btn.classList.add('on');
    try{btn.setPointerCapture(e.pointerId)}catch(err){}
  });
  function up(){btn.classList.remove('on')}
  btn.addEventListener('pointerup',up);
  btn.addEventListener('pointercancel',up);
}
tapBtn(btnJump,function(){if(player)player.jumpBuf=0.14});
tapBtn(btnAtk,tryAtk);
tapBtn(btnSkill,trySkill);

d.addEventListener('keydown',function(e){
  if(e.repeat&&(e.code==='Space'||e.code==='KeyW'||e.code==='ArrowUp'||e.code==='KeyJ'||e.code==='KeyZ'||e.code==='KeyK'||e.code==='KeyX'))return;
  keys[e.code.replace('Arrow','')]=1;
  keys[e.code]=1;
  if(e.code==='ArrowLeft'||e.code==='ArrowRight'||e.code==='ArrowUp'||e.code==='Space')e.preventDefault();
  unlockAudio();
  if(state==='menu'&&(e.code==='Enter'||e.code==='Space')){start();return}
  if(state==='over'&&(e.code==='Enter'||e.code==='Space')){start();return}
  if(e.code==='Space'||e.code==='KeyW'||e.code==='ArrowUp'){if(player)player.jumpBuf=0.14}
  if(e.code==='KeyJ'||e.code==='KeyZ')tryAtk();
  if(e.code==='KeyK'||e.code==='KeyX')trySkill();
});
d.addEventListener('keyup',function(e){
  keys[e.code.replace('Arrow','')]=0;
  keys[e.code]=0;
});

go.addEventListener('click',function(e){e.stopPropagation();unlockAudio();start()});
muteBtn.addEventListener('click',function(e){e.stopPropagation();unlockAudio();setMuted(!muted)});
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&state==='play'){paused=true}
  else{paused=false;lastTs=0}
});
window.addEventListener('resize',size);
if(window.visualViewport)window.visualViewport.addEventListener('resize',size);

function waitImgs(cb){
  var list=Object.keys(IM).map(function(k){return IM[k]});
  var n=list.length,c=0;
  function tick(){if(++c>=n)cb()}
  list.forEach(function(im){if(im.complete)tick();else{im.onload=tick;im.onerror=tick}});
}

/* screenshot hooks */
function shotPlay(){
  start();
  stage=1;phase='mobs';
  enemies=[];drops=[];nums=[];parts=[];bolts=[];
  player.x=340;player.y=GROUND;player.face=1;player.vx=0;player.vy=0;player.onG=true;
  player.atkT=0.18;player.hitDone=1;player.lv=3;player.exp=40;player.need=expNeed(3);
  player.hp=86;player.maxHp=136;player.mp=28;player.maxMp=50;player.atk=20;
  player.skillFx=0.28;player.skillT=3.2;player.levelFx=0;
  camX=player.x-280;
  spawnEnemy('slime',455);
  spawnEnemy('burnt',560);
  spawnEnemy('chili',680);
  addNum(455,GROUND-118,24,false);
  addNum(560,GROUND-150,51,true);
  addDrop('coin',500,GROUND-4);
  addDrop('gem',610,GROUND-4);
  addDrop('potion',500,GROUND-30);
  var cx=player.x+70,cy=player.y-50,cols=['#f5a623','#7de3a8','#e04a1f','#fff6bf'];
  for(var i=0;i<14;i++){
    var a=-0.15+rand(-0.35,0.2),s=rand(20,90);
    parts.push({x:cx+Math.cos(a)*s*0.2,y:cy+rand(-18,18),vx:Math.cos(a)*s,vy:rand(-40,20),t:0.05,life:0.55,col:cols[i%cols.length],s:rand(3,6)});
  }
  coins=18;score=1260;kills=7;
  banner=null;bannerT=0;
  frozen=true;state='play';
  if(pads)pads.hidden=false;
  ov.hidden=true;
  size();draw();
}
function shotBoss(){
  start();
  enemies=[];drops=[];nums=[];parts=[];bolts=[];
  stage=2;phase='boss';
  player.x=420;player.y=GROUND;player.face=1;player.vx=0;player.vy=0;player.onG=true;
  player.atkT=0.16;player.hitDone=1;player.lv=4;player.exp=20;player.need=expNeed(4);
  player.hp=92;player.maxHp=154;player.mp=34;player.maxMp=50;
  camX=player.x-260;
  var b=spawnEnemy('boss',680);
  b.hp=Math.round(b.maxHp*0.62);
  b.face=-1;
  addNum(700,GROUND-200,86,true);
  coins=34;score=2480;kills=15;
  banner=null;bannerT=0;
  frozen=true;state='play';
  if(pads)pads.hidden=false;
  ov.hidden=true;
  size();draw();
}

window.PCQuest={
  start:start,
  shotPlay:shotPlay,
  shotBoss:shotBoss,
  freeze:function(on){frozen=!!on;if(frozen)draw()},
  info:function(){return {state:state,stage:stage,phase:phase,lv:player&&player.lv,hp:player&&player.hp,score:score,kills:kills,en:enemies.map(function(e){return e.kind+' '+e.hp}),W:W,H:H}}
};

setMuteUI();
size();
if(bestLine){
  var b=bestScore();
  bestLine.textContent=b?'最高分 '+b:'';
}
waitImgs(function(){size();draw()});
if(/[?&]shot=play/.test(location.search))waitImgs(function(){shotPlay()});
else if(/[?&]shot=boss/.test(location.search))waitImgs(function(){shotBoss()});
requestAnimationFrame(size);
})();
