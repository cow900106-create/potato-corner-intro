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
var SKILL_CD=5.5, SKILL_COST=22;
var COMBOS=[
  {dur:0.26,hitAt:0.055,lunge:210,dmg:1.00,knock:260,launch:90,arc:86,heavy:0,stop:0.038},
  {dur:0.28,hitAt:0.055,lunge:240,dmg:1.18,knock:310,launch:120,arc:102,heavy:0,stop:0.046},
  {dur:0.44,hitAt:0.07,lunge:340,dmg:1.95,knock:480,launch:360,arc:138,heavy:1,stop:0.055}
];
var flashCvs=d.createElement('canvas'), flashCtx=flashCvs.getContext('2d');
var POW_COLS=['#f5a623','#7de3a8','#e04a1f','#fff6bf','#fce404','#ff7a3a','#c9f28a'];

var state='menu'; /* menu, play, over */
var frozen=false, lastTs=0, raf=0;
var camX=0, phase='mobs', stage=1, banner=null, bannerT=0;
var player=null, enemies=[], drops=[], nums=[], parts=[], bolts=[], plats=[];
var trees=[], slashes=[], trails=[], beams=[];
var holdL=0, holdR=0, keys={};
var score=0, kills=0, coins=0, paused=false;
var hitStop=0, shakeT=0, shakeMag=0, shock=null;

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
  var ch=b.getChannelData(0);
  for(var i=0;i<n;i++)ch[i]=Math.random()*2-1;
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
function sfxSlash(step){
  var heavy=step>=2;
  noiseShot(heavy?0.22:0.16,heavy?0.3:0.22,heavy?900:1400,0.65);
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime;
  var o=actx.createOscillator();
  o.type='sawtooth';
  o.frequency.setValueAtTime(heavy?280:520,t);
  o.frequency.exponentialRampToValueAtTime(heavy?90:160,t+(heavy?0.2:0.12));
  var f=actx.createBiquadFilter();f.type='lowpass';f.frequency.value=heavy?1400:2400;
  var g=actx.createGain();
  env(g,t,heavy?0.2:0.12,0.004,0.04,heavy?0.16:0.1);
  o.connect(f);f.connect(g);g.connect(master);o.start(t);o.stop(t+0.28);
  if(heavy)oscTone('sine',70,40,0.18,0.22,0.004);
}
function sfxHit(heavy){
  oscTone('sine',heavy?70:90,40,heavy?0.2:0.12,heavy?0.28:0.18,0.002);
  oscTone('triangle',heavy?160:220,70,0.14,0.14,0.002);
  noiseShot(heavy?0.16:0.1,heavy?0.24:0.16,heavy?500:800,0.7);
  oscTone('square',heavy?520:700,180,0.08,0.08,0.002);
}
function sfxCrit(){
  oscTone('sine',70,50,0.16,0.2,0.002);
  oscTone('square',980,520,0.16,0.16,0.003);
  oscTone('sine',1560,1100,0.2,0.14,0.004);
  noiseShot(0.14,0.18,2600,1.1);
}
function sfxDown(){oscTone('triangle',280,70,0.28,0.18,0.01);noiseShot(0.2,0.12,400,0.6)}
function sfxCoin(){oscTone('square',1320,1800,0.1,0.1,0.003);oscTone('sine',1760,2200,0.12,0.08,0.005)}
function sfxSkillCharge(){
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime;
  var o=actx.createOscillator();o.type='sawtooth';
  o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(760,t+0.22);
  var g=actx.createGain();env(g,t,0.16,0.02,0.1,0.12);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+0.28);
  oscTone('sine',880,1400,0.22,0.08,0.04);
  noiseShot(0.22,0.1,2000,0.7);
}
function sfxSkillBurst(){
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime;
  oscTone('sine',58,36,0.42,0.32,0.004);
  oscTone('triangle',140,60,0.3,0.18,0.006);
  noiseShot(0.4,0.28,400,0.5);
  noiseShot(0.28,0.16,1800,0.7);
  oscTone('sawtooth',320,90,0.28,0.12,0.01);
  [0,0.06,0.12].forEach(function(dt,i){oscTone('sine',880+i*220,1320+i*180,0.16,0.1,0.004+dt)});
}
function sfxSkillTick(){
  oscTone('square',880,440,0.1,0.12,0.002);
  oscTone('sine',1320,900,0.14,0.1,0.003);
  noiseShot(0.1,0.12,2200,1);
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
function addShake(t,mag){
  shakeT=Math.max(shakeT,t);
  shakeMag=Math.max(shakeMag,mag);
}
function addHitStop(t){hitStop=Math.max(hitStop,t)}

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
    atkT:0,atkDur:0,hitDone:0,combo:0,comboWin:0,trailAcc:0,
    skillT:0,skill:null,hurtT:0,inv:0,
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
    flash:0,hurtT:0,sq:0,cd:rand(0.4,1.6),phase:0,dead:0,bob:Math.random()*6
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
function addNum(x,y,n,crit,pop){
  nums.push({x:x,y:y,n:n,crit:!!crit,t:0,life:crit||pop?1.05:0.9,vx:rand(-22,22),vy:crit||pop?-160:-110,pop:!!(crit||pop)});
}
function addDrop(typ,x,y){
  drops.push({typ:typ,x:x,y:y,vy:rand(-220,-80),vx:rand(-70,70),t:0,mag:0});
}
function burst(x,y,col,n,spd,star){
  for(var i=0;i<n;i++){
    var a=rand(0,Math.PI*2),s=rand(40,spd||180);
    parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,t:0,life:rand(0.28,0.7),col:col,s:rand(2.5,6),typ:star?'star':'dot'});
  }
}
function spawnSlash(heavy,r){
  slashes.push({
    x:player.x+player.face*42,y:player.y-54,face:player.face,
    t:0,life:heavy?0.4:0.28,r:r,heavy:!!heavy
  });
}
function showBanner(text,sec){banner=text;bannerT=sec||1.5}

function resetFX(){
  slashes=[];trails=[];beams=[];shock=null;hitStop=0;shakeT=0;shakeMag=0;
}

function start(){
  unlockAudio();
  state='play';frozen=false;paused=false;
  score=0;kills=0;coins=0;stage=1;phase='mobs';
  enemies=[];drops=[];nums=[];parts=[];bolts=[];
  resetFX();
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
  burst(player.x,player.y-80,'#fce404',22,240,true);
  burst(player.x,player.y-80,'#fff6bf',12,160,false);
}

/* ---------- combat ---------- */
function tryAtk(){
  if(state!=='play'||!player||player.dead)return;
  if(player.skill&&player.skill.t<0.3)return;
  if(player.atkT>0 && (!player.hitDone||player.atkT>0.15))return;
  var step=0;
  if(player.comboWin>0&&player.combo<2)step=player.combo+1;
  var c=COMBOS[step];
  player.combo=step;
  player.atkT=c.dur;
  player.atkDur=c.dur;
  player.hitDone=0;
  player.comboWin=0;
  player.vx=player.face*c.lunge;
  if(c.heavy&&player.onG)player.vy=-90;
  sfxSlash(step);
}
function skillBtnPop(){
  if(!btnSkill)return;
  btnSkill.classList.remove('pop');
  void btnSkill.offsetWidth;
  btnSkill.classList.add('pop');
  setTimeout(function(){btnSkill.classList.remove('pop')},260);
}
function trySkill(){
  if(state!=='play'||!player||player.dead)return;
  if(player.skill||player.skillT>0||player.mp<SKILL_COST)return;
  player.mp-=SKILL_COST;
  player.skillT=SKILL_CD;
  player.skill={t:0,hits:0};
  player.vy=-380;player.onG=false;player.vx*=0.25;
  player.atkT=0;
  sfxSkillCharge();
  skillBtnPop();
  addShake(0.16,3.5);
  burst(player.x,player.y-60,'#fce404',16,160,true);
}
function skillWaveHit(idx){
  var r=560;
  enemies.forEach(function(e){
    if(e.dead)return;
    var dx=e.x-player.x, dy=(e.y-e.h*0.5)-(player.y-50);
    if(dx*dx+dy*dy>r*r)return;
    var dmg=Math.round(player.atk*(1.35+idx*0.22)*rand(0.96,1.12));
    hitEnemy(e,dmg,true,{knock:340+idx*70,launch:180+idx*40,stop:0.03,spark:1,numOff:idx});
  });
  addShake(0.18,8-idx);
  sfxSkillTick();
}
function meleeHit(){
  var p=player, f=p.face, c=COMBOS[p.combo]||COMBOS[0];
  var reach=c.heavy?130:100;
  var ax=f>0?p.x+8:p.x-8-reach, aw=reach;
  var ay=p.y-(c.heavy?96:80), ah=c.heavy?96:76;
  var any=0;
  enemies.forEach(function(e){
    if(e.dead)return;
    if(aabb(ax,ay,aw,ah,e.x-e.w/2,e.y-e.h,e.w,e.h)){
      var crit=c.heavy||Math.random()<0.2;
      var dmg=Math.round(p.atk*c.dmg*rand(0.9,1.14)*(crit&&!c.heavy?2.15:c.heavy&&crit?1.15:1));
      if(c.heavy)dmg=Math.round(dmg*(crit?1.15:1));
      hitEnemy(e,dmg,crit,{knock:c.knock,launch:c.launch,stop:c.stop,spark:1,heavy:c.heavy});
      any=1;
    }
  });
  spawnSlash(c.heavy,c.arc);
  var cx=p.x+f*70, cy=p.y-52;
  burst(cx,cy,'#fce404',c.heavy?16:9,c.heavy?280:180,true);
  burst(cx,cy,'#fff6bf',c.heavy?10:6,140,false);
  if(any)addHitStop(c.stop);
  addShake(c.heavy?0.18:0.08,c.heavy?9:4.5);
}
function hitEnemy(e,dmg,crit,opt){
  opt=opt||{};
  e.hp-=dmg;
  e.flash=opt.heavy?0.2:0.14;
  e.hurtT=opt.heavy?0.38:0.22;
  e.sq=0.22;
  var dir=e.x>=player.x?1:-1;
  e.vx=dir*(opt.knock||(crit?280:180));
  e.vy=-(opt.launch||80);
  e.onG=false;
  var ny=e.y-e.h-8-(opt.numOff||0)*22;
  addNum(e.x+rand(-8,8),ny,dmg,crit,opt.heavy);
  burst(e.x,e.y-e.h*0.55,crit?'#fce404':'#fff',crit||opt.spark?12:6,opt.heavy?240:160,!!crit);
  if(crit)sfxCrit();else sfxHit(!!opt.heavy);
  score+=dmg;
  if(opt.stop)addHitStop(opt.stop);
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  if(e.dead)return;
  e.dead=1;e.hp=0;kills++;
  sfxDown();
  player.exp+=e.exp;
  score+=e.exp*2+(e.kind==='boss'?400:0);
  burst(e.x,e.y-e.h*0.5,'#fff6bf',16,220,true);
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
  if(player.skill&&player.skill.t<0.7)return;
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
function updateSkill(dt){
  var s=player.skill;
  if(!s)return;
  s.t+=dt;
  if(s.t>=0.22&&s.hits===0){
    sfxSkillBurst();
    addShake(0.42,13);
    addHitStop(0.05);
    shock={x:player.x,y:player.y-50,t:0,life:0.55};
    beams=[];
    for(var i=0;i<7;i++){
      beams.push({x:player.x+rand(-380,380),t:rand(0,0.12),life:0.7+rand(0,0.2),w:rand(16,28)});
    }
    for(var j=0;j<70;j++){
      var ang=rand(0,Math.PI*2);
      parts.push({
        typ:'swirl',ang:ang,rad:rand(20,70),spin:rand(6,12)*(Math.random()<0.5?-1:1),
        x:player.x,y:player.y-50,vx:0,vy:0,t:0,life:0.95,
        col:POW_COLS[j%POW_COLS.length],s:rand(4,9)
      });
    }
  }
  var ticks=[0.22,0.38,0.54,0.70];
  if(s.hits<ticks.length&&s.t>=ticks[s.hits]){
    skillWaveHit(s.hits);
    s.hits++;
  }
  if(s.t>1.2)player.skill=null;
}
function updatePlayer(dt){
  var p=player;
  if(p.dead){p.vy+=GRAV*dt;p.y+=p.vy*dt;if(p.y>GROUND){p.y=GROUND;p.vy=0}return}
  updateSkill(dt);
  var charging=p.skill&&p.skill.t<0.28;
  var dir=(holdR||keys.Right||keys.KeyD?1:0)-(holdL||keys.Left||keys.KeyA?1:0);
  if(p.atkT>0.1||charging)dir=dir*0.2;
  if(p.skill&&p.skill.t<0.85)dir=0;
  if(dir){p.vx+=dir*ACCEL*dt;p.face=dir>0?1:-1}
  else{
    var fric=p.atkT>0?FRICTION*0.45:FRICTION;
    if(p.vx>0){p.vx=Math.max(0,p.vx-fric*dt)}
    else if(p.vx<0){p.vx=Math.min(0,p.vx+fric*dt)}
  }
  var maxV=p.atkT>0?420:MOVE;
  p.vx=clamp(p.vx,-maxV,maxV);
  if(p.jumpBuf>0)p.jumpBuf-=dt;
  var wantJump=p.jumpBuf>0;
  if(p.onG)p.coyote=COYOTE;
  else p.coyote-=dt;
  if(wantJump&&p.coyote>0&&!(p.skill&&p.skill.t<0.5)){
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
    var prev=p.atkT,c=COMBOS[p.combo]||COMBOS[0];
    p.atkT-=dt;
    var elapsed=c.dur-p.atkT, prevEl=c.dur-prev;
    if(!p.hitDone&&elapsed>=c.hitAt&&prevEl<c.hitAt){meleeHit();p.hitDone=1}
    p.trailAcc=(p.trailAcc||0)+dt;
    if(p.trailAcc>0.026){
      p.trailAcc=0;
      trails.push({x:p.x-p.face*8,y:p.y,face:p.face,t:0,life:0.2,w:p.drawW,h:p.drawH});
    }
    if(p.atkT<=0){
      p.atkT=0;
      p.comboWin=p.combo>=2?0.1:0.44;
    }
  }else if(p.comboWin>0){
    p.comboWin-=dt;
    if(p.comboWin<=0){p.comboWin=0;p.combo=0}
  }
  if(p.skillT>0)p.skillT=Math.max(0,p.skillT-dt);
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
  if(e.sq>0)e.sq-=dt;
  e.bob+=dt;
  e.cd-=dt;
  var dx=player.x-e.x;
  var stunned=e.hurtT>0;
  if(!stunned&&Math.abs(dx)>16)e.face=dx>0?1:-1;
  var aggro=Math.abs(dx)<520;
  if(!stunned){
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
  }
  e.vy+=GRAV*dt;
  e.x+=e.vx*dt;
  e.y+=e.vy*dt;
  e.x=clamp(e.x,50,WORLD_W-50);
  e.onG=false;
  var plat=footOnPlat(e.x,e.y,e.vy,e.w);
  if(plat&&e.vy>=0){e.y=plat.y;e.vy=0;e.onG=true;if(stunned)e.vx*=0.7}
  if(e.y>=GROUND){e.y=GROUND;e.vy=0;e.onG=true;if(stunned)e.vx*=0.7}
  if(!stunned&&!player.dead&&player.inv<=0&&aabb(player.x-player.w/2,player.y-player.h,player.w,player.h,e.x-e.w/2,e.y-e.h,e.w,e.h)){
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
    var n=nums[i];n.t+=dt;n.x+=n.vx*dt;n.y+=n.vy*dt;n.vy+=140*dt;
    if(n.t>=n.life)nums.splice(i,1);
  }
  for(var j=parts.length-1;j>=0;j--){
    var p=parts[j];
    p.t+=dt;
    if(p.typ==='swirl'){
      p.ang+=p.spin*dt;
      p.rad+=180*dt;
      var cx=player?player.x:p.x, cy=player?player.y-50:p.y;
      p.x=cx+Math.cos(p.ang)*p.rad;
      p.y=cy+Math.sin(p.ang)*p.rad*0.55;
    }else{
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.vx*=0.98;
    }
    if(p.t>=p.life)parts.splice(j,1);
  }
  for(var s=slashes.length-1;s>=0;s--){
    slashes[s].t+=dt;
    if(slashes[s].t>=slashes[s].life)slashes.splice(s,1);
  }
  for(var tr=trails.length-1;tr>=0;tr--){
    trails[tr].t+=dt;
    if(trails[tr].t>=trails[tr].life)trails.splice(tr,1);
  }
  if(shock){shock.t+=dt;if(shock.t>=shock.life)shock=null}
  for(var b=beams.length-1;b>=0;b--){
    beams[b].t+=dt;
    if(beams[b].t>=beams[b].life)beams.splice(b,1);
  }
  if(shakeT>0){shakeT-=dt;shakeMag*=0.88;if(shakeT<=0){shakeT=0;shakeMag=0}}
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
  enemies=enemies.filter(function(e){return !e.dead||e.y<H+80});
}

function loop(ts){
  raf=requestAnimationFrame(loop);
  if(!lastTs)lastTs=ts;
  var dt=Math.min(0.033,(ts-lastTs)/1000);
  lastTs=ts;
  if(state==='play'&&!frozen&&!paused){
    if(hitStop>0){
      hitStop-=dt;
      if(shakeT>0){shakeT-=dt;shakeMag*=0.9}
    }else{
      updatePlayer(dt);
      enemies.forEach(function(e){updateEnemy(e,dt)});
      updateBolts(dt);
      updateDrops(dt);
      updateFX(dt);
      var target=player.x-280;
      camX=lerp(camX,target,1-Math.pow(0.001,dt));
      camX=clamp(camX,0,Math.max(0,WORLD_W-W));
    }
  }
  draw();
  syncPads();
}

/* ---------- draw ---------- */
function sx(x){return x-camX}
function drawImg(im,x,y,w,h,flip,flash,sqx,sqy){
  if(!ready(im))return;
  ctx.save();
  ctx.translate(x,y);
  if(flip)ctx.scale(-1,1);
  if(sqx||sqy)ctx.scale(sqx||1,sqy||1);
  ctx.drawImage(im,-w/2,-h,w,h);
  if(flash){
    var cw=Math.max(2,Math.round(w)), ch=Math.max(2,Math.round(h));
    flashCvs.width=cw;flashCvs.height=ch;
    flashCtx.clearRect(0,0,cw,ch);
    flashCtx.drawImage(im,0,0,cw,ch);
    flashCtx.globalCompositeOperation='source-in';
    flashCtx.fillStyle='#fff';
    flashCtx.fillRect(0,0,cw,ch);
    ctx.globalAlpha=0.5;
    ctx.drawImage(flashCvs,-w/2,-h,w,h);
    ctx.globalAlpha=1;
  }
  ctx.restore();
}
function heroFrame(){
  var p=player;
  if(p.skill&&p.skill.t<0.85)return p.skill.t<0.22?IM.jump:IM.attack;
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
function squashOf(e){
  if(!e.sq||e.sq<=0)return {x:1,y:1};
  var k=1-e.sq/0.22;
  if(k<0.45){var u=k/0.45;return {x:1.28-0.08*u,y:0.68+0.1*u}}
  var v=(k-0.45)/0.55;
  return {x:0.86+0.14*v,y:1.22-0.22*v};
}
function drawEnemies(){
  enemies.forEach(function(e){
    if(e.dead&&e.y>H+20)return;
    var x=sx(e.x);
    if(x<-120||x>W+120)return;
    var bob=e.kind==='slime'?Math.sin(e.bob*5)*2:0;
    var im=IM[KINDS[e.kind].img]||IM.slime;
    var sq=squashOf(e);
    ctx.globalAlpha=e.dead?0.5:1;
    drawImg(im,x,e.y+bob,e.drawW,e.drawH,e.face<0,e.flash>0,sq.x,sq.y);
    ctx.globalAlpha=1;
    if(!e.dead&&e.kind!=='boss'&&e.hp<e.maxHp){
      var bw=Math.max(36,e.drawW*0.55), bh=5;
      var bx=x-bw/2, by=e.y-e.drawH*sq.y-10;
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
function drawTrails(){
  trails.forEach(function(tr){
    var a=1-tr.t/tr.life;
    ctx.save();
    ctx.globalAlpha=Math.max(0,a*0.32);
    drawImg(IM.attack,sx(tr.x),tr.y+2,tr.w,tr.h,tr.face<0,false);
    ctx.restore();
  });
}
function drawSlashes(){
  slashes.forEach(function(s){
    var k=s.t/s.life;
    var a=k<0.2?k/0.2:Math.max(0,1-(k-0.2)/0.8);
    var r=s.r*(0.7+k*0.45);
    var x=sx(s.x), y=s.y;
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s.face,1);
    ctx.rotate(-0.15+k*0.2);
    ctx.lineCap='round';
    ctx.globalAlpha=a*0.28;
    ctx.fillStyle='#fce404';
    ctx.beginPath();ctx.arc(0,0,r+18,-1.3,0.6);ctx.arc(0,0,Math.max(8,r-34),0.6,-1.3,true);ctx.closePath();ctx.fill();
    ctx.globalAlpha=a*0.45;
    ctx.strokeStyle='#fff6bf';
    ctx.lineWidth=(s.heavy?40:26);
    ctx.beginPath();ctx.arc(0,0,r,-1.25,0.55);ctx.stroke();
    ctx.globalAlpha=a*0.98;
    var grad=ctx.createLinearGradient(-r,0,r,20);
    grad.addColorStop(0,'rgba(255,246,191,0)');
    grad.addColorStop(0.35,'#fff6bf');
    grad.addColorStop(0.6,'#fce404');
    grad.addColorStop(1,'rgba(245,166,35,0)');
    ctx.strokeStyle=grad;
    ctx.lineWidth=s.heavy?20:13;
    ctx.beginPath();ctx.arc(0,0,r,-1.2,0.5);ctx.stroke();
    ctx.globalAlpha=a;
    ctx.strokeStyle='#fff';
    ctx.lineWidth=s.heavy?7:4;
    ctx.beginPath();ctx.arc(0,0,r+1,-1.05,0.35);ctx.stroke();
    ctx.restore();
  });
}
function drawSkillFX(){
  var s=player&&player.skill;
  if(!s&&!shock&&!beams.length)return;
  if(s){
    var dim=s.t<0.22?0.45:Math.max(0.16,0.34-(s.t-0.22)*0.2);
    if(dim>0){
      ctx.fillStyle='rgba(6,12,36,'+dim+')';
      ctx.fillRect(-30,-30,W+60,H+60);
    }
    var x=sx(player.x), y=player.y-58;
    if(s.t<0.28){
      var u=s.t/0.22;
      ctx.save();
      ctx.globalAlpha=0.85*(1-Math.max(0,s.t-0.18)/0.1);
      ctx.strokeStyle='#fce404';
      ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(x,y,18+u*46,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='rgba(255,246,191,.8)';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(x,y,10+u*28,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
  }
  if(shock){
    var k=shock.t/shock.life, rr=(40+k*520);
    ctx.save();
    ctx.globalAlpha=Math.max(0,1-k)*0.35;
    ctx.strokeStyle='rgba(252,228,4,.9)';
    ctx.lineWidth=36*(1-k)+10;
    ctx.beginPath();ctx.arc(sx(shock.x),shock.y,rr,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=Math.max(0,1-k)*0.9;
    ctx.strokeStyle='#fce404';
    ctx.lineWidth=18*(1-k)+5;
    ctx.beginPath();ctx.arc(sx(shock.x),shock.y,rr,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#fff6bf';
    ctx.lineWidth=6*(1-k)+2;
    ctx.beginPath();ctx.arc(sx(shock.x),shock.y,rr*0.86,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  beams.forEach(function(b){
    var k=b.t/b.life, fade=k<0.15?k/0.15:Math.max(0,1-(k-0.15)/0.85);
    var x=sx(b.x);
    ctx.save();
    var g=ctx.createLinearGradient(x,20,x,H-40);
    g.addColorStop(0,'rgba(255,246,191,0)');
    g.addColorStop(0.2,'rgba(252,228,4,'+(0.8*fade)+')');
    g.addColorStop(1,'rgba(245,166,35,0)');
    ctx.fillStyle=g;
    ctx.fillRect(x-b.w/2,16,b.w*1.15,H-50);
    ctx.globalAlpha=fade*0.95;
    ctx.fillStyle='#fff6bf';
    ctx.fillRect(x-b.w*0.18,16,b.w*0.36,H-50);
    ctx.restore();
  });
}
function drawPlayer(){
  var p=player;
  if(p.inv>0&&Math.floor(p.inv*14)%2===0&&!p.dead)return;
  var im=heroFrame();
  var x=sx(p.x);
  var lean=p.atkT>0?1.08:1;
  var leanY=p.atkT>0?0.94:1;
  drawImg(im,x,p.y+2,p.drawW*lean,p.drawH*leanY,p.face<0,p.hurtT>0);
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
    var pop=n.t<0.12?1.15+n.t*6:1;
    var sc=(n.crit||n.pop)?(1.7+Math.sin(Math.min(1,n.t*16))*0.2)*pop:1.15*pop;
    ctx.save();
    ctx.globalAlpha=Math.max(0,a);
    ctx.translate(sx(n.x),n.y);
    ctx.scale(sc,sc);
    ctx.font='900 '+(n.crit||n.pop?28:20)+'px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=n.crit||n.pop?7:5;
    ctx.strokeStyle=n.crit||n.pop?'#7a4a00':'#3a2a10';
    ctx.fillStyle=n.crit||n.pop?'#fce404':'#fff8e8';
    var lab=String(n.n);
    ctx.strokeText(lab,1,2);ctx.strokeText(lab,0,0);ctx.fillText(lab,0,0);
    ctx.restore();
  });
}
function drawParts(){
  parts.forEach(function(p){
    var a=1-p.t/p.life;
    var x=sx(p.x), y=p.y, sz=p.s*(0.6+a*0.5);
    ctx.globalAlpha=Math.max(0,a);
    ctx.fillStyle=p.col;
    if(p.typ==='star'){
      ctx.save();ctx.translate(x,y);ctx.rotate(p.t*8);
      ctx.beginPath();
      for(var i=0;i<4;i++){
        var ang=i*Math.PI/2;
        ctx.lineTo(Math.cos(ang)*sz,Math.sin(ang)*sz);
        ctx.lineTo(Math.cos(ang+0.6)*sz*0.35,Math.sin(ang+0.6)*sz*0.35);
      }
      ctx.closePath();ctx.fill();ctx.restore();
    }else{
      ctx.beginPath();ctx.arc(x,y,sz,0,Math.PI*2);ctx.fill();
    }
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
    var bw=300, bx=W/2-20, by=86;
    ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(bx-4,by-16,bw+8,28);
    ctx.fillStyle='#fce404';ctx.font='900 12px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('焦黑大薯王',bx+bw/2,by-8);
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
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  var ox=0,oy=0;
  if(shakeT>0&&shakeMag>0){
    if(frozen){ox=5;oy=-3}
    else{ox=(Math.random()*2-1)*shakeMag;oy=(Math.random()*2-1)*shakeMag*0.55}
  }
  ctx.translate(ox,oy);
  ctx.clearRect(-20,-20,W+40,H+40);
  drawSky();
  drawTrees();
  drawPlats();
  drawGround();
  drawSkillFX();
  drawDrops();
  drawTrails();
  drawEnemies();
  drawBolts();
  if(player)drawPlayer();
  drawSlashes();
  drawParts();
  drawNums();
  if(player&&(state==='play'||state==='over'))drawHUD();
}
function syncPads(){
  if(!skillCdEl||!player)return;
  if(player.skillT>0){
    btnSkill.classList.add('cd');
    btnSkill.classList.remove('ready');
    skillCdEl.style.height=(player.skillT/SKILL_CD*100)+'%';
  }else{
    btnSkill.classList.remove('cd');
    skillCdEl.style.height='0';
    if(state==='play'&&!player.dead&&player.mp>=SKILL_COST)btnSkill.classList.add('ready');
    else btnSkill.classList.remove('ready');
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

function seedCommon(){
  if(pads)pads.hidden=false;
  ov.hidden=true;
  banner=null;bannerT=0;
  frozen=true;state='play';
  size();
}

/* screenshot hooks */
function shotPlay(){
  start();
  stage=1;phase='mobs';
  enemies=[];drops=[];nums=[];parts=[];bolts=[];resetFX();
  player.x=340;player.y=GROUND;player.face=1;player.vx=0;player.vy=0;player.onG=true;
  player.atkT=0.16;player.atkDur=0.26;player.combo=0;player.hitDone=1;
  player.lv=3;player.exp=40;player.need=expNeed(3);
  player.hp=86;player.maxHp=136;player.mp=28;player.maxMp=50;player.atk=20;
  player.skill=null;player.skillT=0;player.levelFx=0;
  camX=player.x-280;
  spawnEnemy('slime',455);
  spawnEnemy('burnt',560);
  spawnEnemy('chili',680);
  addNum(455,GROUND-118,24,false);
  addNum(560,GROUND-150,51,true);
  addDrop('coin',500,GROUND-4);
  addDrop('gem',610,GROUND-4);
  addDrop('potion',500,GROUND-30);
  coins=18;score=1260;kills=7;
  seedCommon();draw();
}
function shotBoss(){
  start();
  enemies=[];drops=[];nums=[];parts=[];bolts=[];resetFX();
  stage=2;phase='boss';
  player.x=420;player.y=GROUND;player.face=1;player.vx=0;player.vy=0;player.onG=true;
  player.atkT=0;player.hitDone=1;player.lv=4;player.exp=20;player.need=expNeed(4);
  player.hp=92;player.maxHp=154;player.mp=34;player.maxMp=50;
  player.skill=null;player.skillT=0;
  camX=player.x-260;
  var b=spawnEnemy('boss',680);
  b.hp=Math.round(b.maxHp*0.62);
  b.face=-1;
  addNum(730,GROUND-200,86,true);
  coins=34;score=2480;kills=15;
  seedCommon();draw();
}
function shotAttack(){
  start();
  enemies=[];drops=[];nums=[];parts=[];bolts=[];resetFX();
  stage=1;phase='mobs';
  player.x=350;player.y=GROUND;player.face=1;player.vx=180;player.vy=0;player.onG=true;
  player.combo=2;player.atkT=0.28;player.atkDur=0.44;player.hitDone=1;
  player.lv=3;player.exp=50;player.need=expNeed(3);
  player.hp=110;player.maxHp=136;player.mp=36;player.maxMp=50;player.atk=20;
  player.skill=null;player.skillT=2.4;player.levelFx=0;
  camX=player.x-260;
  trails.push({x:player.x-28,y:GROUND,face:1,t:0.06,life:0.2,w:player.drawW,h:player.drawH});
  trails.push({x:player.x-52,y:GROUND,face:1,t:0.12,life:0.2,w:player.drawW,h:player.drawH});
  slashes.push({x:player.x+48,y:player.y-54,face:1,t:0.08,life:0.4,r:138,heavy:1});
  var sl=spawnEnemy('slime',500);sl.flash=0.05;sl.sq=0.16;sl.vx=320;sl.hp=12;sl.hurtT=0.2;
  var br=spawnEnemy('burnt',620);br.flash=0.04;br.sq=0.14;br.vx=260;br.hurtT=0.18;
  spawnEnemy('chili',760);
  burst(500,GROUND-60,'#fce404',18,240,true);
  burst(500,GROUND-60,'#fff6bf',10,160,false);
  addNum(488,GROUND-122,28,false,true);
  addNum(570,GROUND-168,67,true);
  shakeT=0.12;shakeMag=6;
  coins=22;score=1580;kills=9;
  seedCommon();draw();
}
function shotSkill(){
  start();
  enemies=[];drops=[];nums=[];parts=[];bolts=[];resetFX();
  stage=2;phase='mobs';
  player.x=400;player.y=GROUND-46;player.face=1;player.vx=0;player.vy=-40;player.onG=false;
  player.atkT=0;player.lv=4;player.exp=30;player.need=expNeed(4);
  player.hp=120;player.maxHp=154;player.mp=8;player.maxMp=50;player.atk=22;
  player.skill={t:0.48,hits:3};player.skillT=SKILL_CD;player.levelFx=0;
  camX=player.x-300;
  shock={x:player.x,y:player.y-20,t:0.18,life:0.55};
  beams=[
    {x:player.x-220,t:0.2,life:0.7,w:22},
    {x:player.x-80,t:0.12,life:0.7,w:26},
    {x:player.x+40,t:0.16,life:0.7,w:20},
    {x:player.x+160,t:0.1,life:0.7,w:24},
    {x:player.x+280,t:0.22,life:0.7,w:18}
  ];
  for(var j=0;j<80;j++){
    var ang=j/56*Math.PI*2;
    var rad=70+((j*17)%160);
    parts.push({
      typ:'swirl',ang:ang,rad:rad,spin:8,x:player.x+Math.cos(ang)*rad,
      y:player.y-20+Math.sin(ang)*rad*0.55,vx:0,vy:0,t:0.2,life:0.95,
      col:POW_COLS[j%POW_COLS.length],s:rand(4,9)
    });
  }
  var e1=spawnEnemy('slime',520);e1.flash=0.06;e1.sq=0.18;e1.vx=280;e1.y=GROUND-24;e1.hurtT=0.2;
  var e2=spawnEnemy('burnt',640);e2.flash=0.06;e2.sq=0.18;e2.vx=300;e2.y=GROUND-18;e2.hurtT=0.2;
  var e3=spawnEnemy('chili',300);e3.flash=0.05;e3.sq=0.16;e3.vx=-240;e3.face=1;e3.hurtT=0.2;
  addNum(520,GROUND-130,38,true);addNum(535,GROUND-168,41,true);addNum(548,GROUND-206,44,true);
  addNum(640,GROUND-140,42,true);addNum(658,GROUND-182,46,true);
  addNum(300,GROUND-150,36,true);addNum(290,GROUND-190,40,true);
  shakeT=0.2;shakeMag=8;
  coins=40;score=2760;kills=14;
  seedCommon();draw();
}

window.PCQuest={
  start:start,
  shotPlay:shotPlay,
  shotBoss:shotBoss,
  shotAttack:shotAttack,
  shotSkill:shotSkill,
  freeze:function(on){frozen=!!on;if(frozen)draw()},
  info:function(){return {state:state,stage:stage,phase:phase,lv:player&&player.lv,hp:player&&player.hp,score:score,kills:kills,combo:player&&player.combo,skill:player&&player.skill&&player.skill.t,en:enemies.map(function(e){return e.kind+' '+e.hp}),W:W,H:H}}
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
else if(/[?&]shot=attack/.test(location.search))waitImgs(function(){shotAttack()});
else if(/[?&]shot=skill/.test(location.search))waitImgs(function(){shotSkill()});
requestAnimationFrame(size);
})();
