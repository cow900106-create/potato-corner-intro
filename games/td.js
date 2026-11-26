(function(){
var d=document,G=window.PCGames;
var cv=d.getElementById('stage'),ctx=cv.getContext('2d',{alpha:false});
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var ovlogo=d.getElementById('ovlogo'),ovcover=d.getElementById('ovcover'),how=d.getElementById('how');
var elWave=d.getElementById('waveN'),elGold=d.getElementById('gold'),elLives=d.getElementById('lives');
var elHud=d.getElementById('hud'),spdBtn=d.getElementById('spdBtn'),nextBtn=d.getElementById('nextBtn');
var buildPan=d.getElementById('buildPan'),towPan=d.getElementById('towPan');
var bestLine=d.getElementById('bestLine'),toLobby=d.getElementById('toLobby'),recSlot=d.getElementById('recSlot');
var KEY='pcGameTdBest';
var W=0,H=0,dpr=1,run=false,over=false,paused=false,speed=1;
var gold=0,lives=10,wave=1,score=0,best=G.getBest(KEY),kills=0,earned=0,cleared=0;
var last=0,raf=0,uid=1,time=0,shake=0,sfxAt=0;
var path=[],segs=[],pathLen=0,pathW=52,pads=[],decor=[];
var enemies=[],towers=[],shots=[],fx=[],floats=[],queue=[],spawnT=0,waving=false,waiting=true,bonus=0;
var sel=null,map={t:56,b:0,l:16,r:0};
var START_GOLD=300,MAX_LIVES=10;

var KINDS={
  cheese:{name:'起司砲台',cost:80,up:[70,120],range:[118,136,156],dmg:[22,34,52],rate:[0.62,0.5,0.38],desc:'單體高傷',color:'#f5c430',file:'tower-cheese'},
  chili:{name:'香辣噴射器',cost:110,up:[90,150],range:[96,112,128],dmg:[12,18,26],rate:[1.05,0.88,0.72],splash:[44,54,64],desc:'範圍濺射',color:'#e23b2e',file:'tower-chili'},
  onion:{name:'洋蔥減速塔',cost:90,up:[75,130],range:[108,126,144],dmg:[5,8,12],rate:[0.85,0.7,0.55],slow:[0.4,0.5,0.6],slowT:1.6,desc:'奶油減速',color:'#d7efb0',file:'tower-onion'}
};
var MOBS={
  chunk:{name:'焦黑小薯塊',hp:36,spd:40,gold:8,leak:1,r:17,file:'enemy-chunk'},
  slime:{name:'油膩史萊姆',hp:22,spd:66,gold:10,leak:1,r:16,file:'enemy-slime'},
  tank:{name:'焦黑巨薯怪',hp:170,spd:26,gold:22,leak:2,r:24,file:'enemy-tank'},
  boss:{name:'焦黑大薯王',hp:460,spd:22,gold:60,leak:5,r:30,file:'enemy-boss'}
};
var ORDER=['cheese','chili','onion'];

function src(p){var i=new Image();i.src=p;return i}
function ready(im){return im&&im.complete&&im.naturalWidth>0}
var IM={
  cheese:src('img/td/tower-cheese.webp'),
  chili:src('img/td/tower-chili.webp'),
  onion:src('img/td/tower-onion.webp'),
  chunk:src('img/td/enemy-chunk.webp'),
  slime:src('img/td/enemy-slime.webp'),
  tank:src('img/td/enemy-tank.webp'),
  boss:src('img/td/enemy-boss.webp'),
  stall:src('img/td/stall.webp'),
  cover:src('img/td/cover.webp')
};
for(var k in IM){IM[k].addEventListener('load',function(){if(!over)draw()})}

if(bestLine)bestLine.textContent=best?'最高分 '+best:'';

function sfx(name,gap){
  if(!G.audio)return;
  var now=performance.now();
  if(gap&&now-sfxAt<gap)return;
  sfxAt=now;
  G.audio.play(name);
}
function setGold(n){gold=Math.max(0,n|0);if(elGold)elGold.textContent=gold;if(sel)refreshPan()}
function setLives(n){lives=Math.max(0,n|0);if(elLives)elLives.textContent=lives}
function setWave(n){wave=Math.max(1,n|0);if(elWave)elWave.textContent=wave}
function addScore(n){score=Math.max(0,score+(n|0))}

function kindAt(t,lv){
  var k=KINDS[t],i=Math.max(0,Math.min(2,(lv||1)-1));
  return {
    name:k.name,color:k.color,file:k.file,desc:k.desc,
    cost:k.cost,up:k.up[Math.min(i,1)],
    range:k.range[i],dmg:k.dmg[i],rate:k.rate[i],
    splash:k.splash?k.splash[i]:0,
    slow:k.slow?k.slow[i]:0,slowT:k.slowT||0
  };
}

function buildPathMeta(){
  segs=[];pathLen=0;
  for(var i=0;i<path.length-1;i++){
    var dx=path[i+1].x-path[i].x,dy=path[i+1].y-path[i].y,len=Math.hypot(dx,dy)||1;
    segs.push({x0:path[i].x,y0:path[i].y,x1:path[i+1].x,y1:path[i+1].y,dx:dx,dy:dy,len:len,acc:pathLen});
    pathLen+=len;
  }
}
function posAt(dist){
  if(dist<=0)return {x:path[0].x,y:path[0].y,ang:Math.atan2(path[1].y-path[0].y,path[1].x-path[0].x)};
  if(dist>=pathLen){
    var a=path[path.length-2],b=path[path.length-1];
    return {x:b.x,y:b.y,ang:Math.atan2(b.y-a.y,b.x-a.x)};
  }
  for(var i=0;i<segs.length;i++){
    var s=segs[i];
    if(dist<=s.acc+s.len){
      var t=(dist-s.acc)/s.len;
      return {x:s.x0+s.dx*t,y:s.y0+s.dy*t,ang:Math.atan2(s.dy,s.dx)};
    }
  }
  var lastP=path[path.length-1];
  return {x:lastP.x,y:lastP.y,ang:0};
}
function distToPath(x,y){
  var bestD=1e9;
  for(var i=0;i<segs.length;i++){
    var s=segs[i],l2=s.len*s.len||1;
    var t=Math.max(0,Math.min(1,((x-s.x0)*s.dx+(y-s.y0)*s.dy)/l2));
    var d=Math.hypot(x-(s.x0+s.dx*t),y-(s.y0+s.dy*t));
    if(d<bestD)bestD=d;
  }
  return bestD;
}
function pathCover(x,y,range,step){
  step=step||2;
  if(!pathLen)return 0;
  var hit=0,n=Math.floor(pathLen/step);
  for(var i=0;i<=n;i++){
    var p=posAt(Math.min(pathLen,i*step));
    if(Math.hypot(p.x-x,p.y-y)<=range)hit++;
  }
  return hit*step;
}
function coverFracs(x,y,range,step){
  step=step||4;
  var minF=1,maxF=0,hit=0,n=Math.max(1,Math.floor(pathLen/step));
  for(var i=0;i<=n;i++){
    var d=Math.min(pathLen,i*step),p=posAt(d);
    if(Math.hypot(p.x-x,p.y-y)<=range){
      hit++;
      var f=d/pathLen;
      if(f<minF)minF=f;
      if(f>maxF)maxF=f;
    }
  }
  return {len:hit*step,min:hit?minF:0,max:hit?maxF:0};
}
function midpt(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
function along(a,b,t){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
function clampPad(x,y,padR){
  return {
    x:Math.max(map.l+padR,Math.min(map.r-padR,x)),
    y:Math.max(map.t+padR,Math.min(map.b-padR,y))
  };
}
function stallBox(){
  var p=path[path.length-1];
  var w=Math.min(128,W*0.36),h=w*0.92;
  return {l:p.x-w/2,t:p.y-h+18,w:w,h:h};
}
function avoidStall(x,y,padR){
  var s=stallBox();
  if(x+padR>s.l&&x-padR<s.l+s.w&&y+padR>s.t&&y-padR<s.t+s.h){
    if(x<s.l+s.w*0.4)x=s.l-padR-8;
    else if(x>s.l+s.w*0.6)x=s.l+s.w+padR+8;
    else y=s.t-padR-8;
  }
  return clampPad(x,y,padR);
}
function rng(s){s=Math.sin(s*127.1)*43758.5453;return s-Math.floor(s)}

function layout(){
  var r=cv.parentNode.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(1,Math.floor(r.width));
  H=Math.max(1,Math.floor(r.height));
  cv.width=W*dpr;cv.height=H*dpr;
  cv.style.width=W+'px';cv.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  var safeT=0,safeB=0;
  map.t=56+safeT;
  map.b=H-72-safeB;
  map.l=16;
  map.r=W-16;
  pathW=Math.max(46,Math.min(60,Math.round(W*0.145)));
  var L=map.l,R=map.r,T=map.t,B=map.b,mw=R-L,mh=B-T;
  var xL=L+mw*0.26,xR=L+mw*0.76,mid=(L+R)/2;
  /* S-path now finishes with a bottom horizontal so the lower-left
     corner actually sits beside a lane, then drops to the stall. */
  path=[
    {x:xL,y:T+8},
    {x:xL,y:T+mh*0.16},
    {x:xR,y:T+mh*0.16},
    {x:xR,y:T+mh*0.36},
    {x:xL,y:T+mh*0.36},
    {x:xL,y:T+mh*0.56},
    {x:xR,y:T+mh*0.56},
    {x:xR,y:T+mh*0.74},
    {x:xL,y:T+mh*0.74},
    {x:mid,y:B-6}
  ];
  buildPathMeta();
  var old=pads.slice();
  pads=[];
  var padR=Math.max(18,Math.round(W*0.055));
  var minD=pathW*0.5+padR+6;
  var D=Math.min(minD+8,66);
  var P=path;
  var lastDx=P[9].x-P[8].x,lastDy=P[9].y-P[8].y,lastLen=Math.hypot(lastDx,lastDy)||1;
  var lpx=-lastDy/lastLen,lpy=lastDx/lastLen;
  var pL=along(P[8],P[9],0.28),pR=along(P[8],P[9],0.45);
  var cands=[
    {x:midpt(P[1],P[2]).x,y:P[1].y-D},
    {x:P[2].x+D,y:midpt(P[2],P[3]).y},
    {x:P[0].x-D,y:midpt(P[0],P[1]).y},
    midpt(midpt(P[1],P[2]),midpt(P[4],P[3])),
    {x:P[4].x-D,y:midpt(P[4],P[5]).y},
    midpt(midpt(P[4],P[3]),midpt(P[5],P[6])),
    {x:P[6].x+D,y:midpt(P[6],P[7]).y},
    midpt(midpt(P[5],P[6]),midpt(P[8],P[7])),
    {x:P[2].x,y:P[2].y-D},
    {x:pR.x-lpx*D,y:pR.y-lpy*D},
    {x:pL.x+lpx*D,y:pL.y+lpy*D}
  ];
  function acceptPad(pt){
    pt=avoidStall(pt.x,pt.y,padR);
    var d0=distToPath(pt.x,pt.y);
    if(d0<minD-2){
      var best=null;
      for(var a=0;a<16;a++){
        var ang=a*Math.PI/8;
        var q=avoidStall(pt.x+Math.cos(ang)*D,pt.y+Math.sin(ang)*D,padR);
        var dd=distToPath(q.x,q.y),cov=pathCover(q.x,q.y,KINDS.chili.range[0]);
        var score=Math.abs(dd-D)+(dd<minD-1?200:0)+(cov<100?80:0);
        if(!best||score<best.s)best={s:score,x:q.x,y:q.y};
      }
      if(best)pt={x:best.x,y:best.y};
      pt=avoidStall(pt.x,pt.y,padR);
    }
    return pt;
  }
  for(var i=0;i<cands.length;i++){
    var pt=acceptPad(cands[i]);
    for(var j=0;j<pads.length;j++){
      var gap=Math.hypot(pt.x-pads[j].x,pt.y-pads[j].y);
      if(gap<70&&gap>0.1){
        var ux=(pt.x-pads[j].x)/gap,uy=(pt.y-pads[j].y)/gap;
        var want=72-gap;
        pt=avoidStall(pt.x+ux*want,pt.y+uy*want,padR);
      }
    }
    if(pathCover(pt.x,pt.y,KINDS.chili.range[0])<100){
      var pulled=null,bestC=pathCover(pt.x,pt.y,KINDS.chili.range[0]);
      for(var a=0;a<24;a++){
        var ang=a*Math.PI/12,q=avoidStall(pt.x+Math.cos(ang)*28,pt.y+Math.sin(ang)*28,padR);
        var cov=pathCover(q.x,q.y,KINDS.chili.range[0]),dd=distToPath(q.x,q.y);
        if(dd<minD-2)continue;
        if(cov>bestC){bestC=cov;pulled=q}
      }
      if(pulled&&bestC>=100)pt=pulled;
    }
    var prev=old[i];
    pads.push({x:pt.x,y:pt.y,r:padR,tower:prev&&prev.tower?prev.tower:null,pop:prev&&prev.pop||0});
  }
  for(var ti=0;ti<towers.length;ti++){
    var tw=towers[ti];
    if(tw.pad!=null&&pads[tw.pad]){tw.x=pads[tw.pad].x;tw.y=pads[tw.pad].y}
  }
  decor=[];
  for(var i=0;i<48;i++){
    var dx=map.l+rng(i*3.17)*mw,dy=map.t+rng(i*5.91)*mh;
    if(distToPath(dx,dy)<pathW*0.6+10)continue;
    var nearPad=false;
    for(var p=0;p<pads.length;p++)if(Math.hypot(dx-pads[p].x,dy-pads[p].y)<pads[p].r+8)nearPad=true;
    if(nearPad)continue;
    decor.push({x:dx,y:dy,r:6+rng(i*2.2)*12,c:rng(i*1.7)>0.55?'#4f9a2c':'#7bc247',kind:'clump'});
  }
  for(var i=0;i<10;i++){
    var dx=map.l+rng(80+i*4.3)*mw,dy=map.t+rng(90+i*6.1)*mh;
    if(distToPath(dx,dy)<pathW*0.6+6)continue;
    decor.push({x:dx,y:dy,r:4+rng(i)*5,c:'#c8b48a',kind:'rock'});
  }
  draw();
}

function wavePlan(n){
  var hpMul=Math.pow(1.22,n-1),spdMul=1+(n-1)*0.035;
  var list=[],t=0;
  var chunks=6+n*2;
  if(n>=3)chunks=6+n;
  for(var i=0;i<chunks;i++){list.push({type:'chunk',delay:t});t+=Math.max(0.38,0.62-n*0.012)}
  if(n>=2){
    t=0.8;
    var slimes=2+Math.floor(n*1.3);
    for(var i=0;i<slimes;i++){list.push({type:'slime',delay:t});t+=Math.max(0.32,0.48-n*0.01)}
  }
  if(n>=4){
    t=2.2;
    var tanks=1+Math.floor((n-3)/2);
    for(var i=0;i<tanks;i++){list.push({type:'tank',delay:t});t+=1.35}
  }
  if(n%5===0){
    list.push({type:'boss',delay:Math.max(t,3.2)+0.4});
  }
  list.sort(function(a,b){return a.delay-b.delay});
  return list.map(function(it){
    var m=MOBS[it.type];
    return {type:it.type,delay:it.delay,hp:Math.round(m.hp*hpMul),spd:m.spd*spdMul,gold:m.gold+Math.floor((n-1)/2),leak:m.leak,r:m.r};
  });
}

function spawnMob(spec,at){
  var p=posAt(at||0);
  var e={
    id:uid++,type:spec.type,hp:spec.hp,max:spec.hp,spd:spec.spd,gold:spec.gold,leak:spec.leak,r:spec.r,
    dist:at||0,x:p.x,y:p.y,ang:p.ang,slow:0,slowMul:1,flash:0,bob:Math.random()*6.28,dead:false
  };
  enemies.push(e);
  return e;
}

function startWave(early){
  if(!run||over||waving)return;
  if(early&&bonus>0){setGold(gold+bonus);earned+=bonus;floatText(W/2,map.t+28,'+'+bonus+' 提前開波','#fce404');bonus=0}
  waving=true;waiting=false;queue=wavePlan(wave);spawnT=0;
  hidePans();
  if(nextBtn)nextBtn.hidden=true;
  sfx('wave');
}

function waveCleared(){
  waving=false;waiting=true;cleared=Math.max(cleared,wave);
  addScore(80+wave*8);
  if(wave===15){
    floatText(W/2,H*0.42,'第 15 波通關！繼續挑戰','#fce404');
    sfx('upgrade');
  }
  setWave(wave+1);
  bonus=15+wave*3;
  showNext();
}

function showNext(){
  if(!nextBtn||over||!run)return;
  nextBtn.hidden=false;
  nextBtn.textContent=bonus>0?('下一波  +'+bonus+' 金幣'):'下一波';
}

function hidePans(){
  sel=null;
  if(buildPan)buildPan.hidden=true;
  if(towPan)towPan.hidden=true;
}

var panLock=0;
function dockPan(el,y){
  if(!el)return;
  if(y>H*0.55){
    el.style.bottom='auto';
    el.style.top='calc(56px + env(safe-area-inset-top, 0px))';
  }else{
    el.style.top='auto';
    el.style.bottom='calc(70px + env(safe-area-inset-bottom, 0px))';
  }
}
function openBuild(i){
  sel={kind:'pad',i:i};
  panLock=performance.now()+300;
  if(towPan)towPan.hidden=true;
  if(!buildPan)return;
  var html='';
  for(var n=0;n<ORDER.length;n++){
    var id=ORDER[n],k=KINDS[id],afford=gold>=k.cost;
    html+='<button class="tdpick tdbtn'+(afford?'':' off')+'" type="button" data-type="'+id+'" '+(afford?'':'disabled')+'>'+
      '<img src="img/td/'+k.file+'.webp" alt="" width="52" height="52">'+
      '<span class="nm">'+k.name+'</span>'+
      '<span class="pr">'+k.cost+' 金幣</span>'+
      '<span class="ds">'+k.desc+'</span></button>';
  }
  buildPan.innerHTML=html;
  buildPan.hidden=false;
  dockPan(buildPan, pads[i]?pads[i].y:0);
  if(nextBtn&&!waving)nextBtn.hidden=true;
}
function openTower(i){
  var tw=towers[i];if(!tw)return;
  panLock=performance.now()+300;
  sel={kind:'tower',i:i};
  if(buildPan)buildPan.hidden=true;
  if(!towPan)return;
  var k=kindAt(tw.type,tw.lv);
  var maxed=tw.lv>=3;
  var cost=maxed?0:KINDS[tw.type].up[tw.lv-1];
  var spent=tw.spent||KINDS[tw.type].cost;
  var refund=Math.floor(spent*7/10);
  var stars=(tw.lv>=1?'★':'☆')+(tw.lv>=2?'★':'☆')+(tw.lv>=3?'★':'☆');
  var upLabel=maxed?('已滿等  LV.3'):('升級  LV.'+tw.lv+'→LV.'+(tw.lv+1)+'  '+cost);
  towPan.innerHTML=
    '<div class="td-stars">'+stars+'</div>'+
    '<button class="tdact up tdbtn'+(maxed||gold<cost?' off':'')+'" id="upBtn" type="button" '+(maxed||gold<cost?'disabled':'')+'>'+upLabel+'</button>'+
    '<button class="tdact sell tdbtn" id="sellBtn" type="button">拆除  +'+refund+'</button>';
  towPan.hidden=false;
  dockPan(towPan, tw.y);
  if(nextBtn&&!waving)nextBtn.hidden=true;
}
function refreshPan(){
  if(!sel)return;
  if(sel.kind==='pad')openBuild(sel.i);
  else openTower(sel.i);
}

function doBuild(padI,type){
  var pad=pads[padI],k=KINDS[type];
  if(!pad||pad.tower||!k||gold<k.cost||over||!run)return false;
  setGold(gold-k.cost);
  var tw={
    id:uid++,type:type,lv:1,x:pad.x,y:pad.y,pad:padI,cool:0.15,spent:k.cost,scale:0.2,pop:0.35,face:1
  };
  pad.tower=tw;pad.pop=0.35;
  towers.push(tw);
  hidePans();
  if(waiting)showNext();
  sfx('build');
  return tw;
}
function doUpgrade(i){
  var tw=towers[i];if(!tw||tw.lv>=3)return false;
  var cost=KINDS[tw.type].up[tw.lv-1];
  if(gold<cost)return false;
  setGold(gold-cost);
  tw.lv+=1;tw.spent=(tw.spent||0)+cost;tw.pop=0.28;tw.scale=1.18;
  openTower(i);
  sfx('upgrade');
  return true;
}
function doSell(i){
  var tw=towers[i];if(!tw)return false;
  var refund=Math.floor((tw.spent||KINDS[tw.type].cost)*7/10);
  setGold(gold+refund);
  if(pads[tw.pad])pads[tw.pad].tower=null;
  towers.splice(i,1);
  hidePans();
  if(waiting)showNext();
  floatText(tw.x,tw.y-30,'+'+refund,'#fce404');
  sfx('drop');
  return true;
}

function hitTarget(e,dmg,slow,slowT){
  if(!e||e.dead)return;
  e.hp-=dmg;
  e.flash=1;
  if(slow&&slowT){e.slow=Math.max(e.slow,slowT);e.slowMul=Math.min(e.slowMul||1,1-slow)}
  floatText(e.x+rng(e.id)*16-8,e.y-e.r-8,'-'+Math.round(dmg),slow?'#c8f7a0':'#fff6bf');
  if(e.hp<=0)kill(e);
}
function kill(e){
  if(e.dead)return;
  e.dead=true;
  setGold(gold+e.gold);
  earned+=e.gold;kills+=1;addScore(e.gold+2);
  floatText(e.x,e.y-10,'+'+e.gold,'#fce404');
  burst(e.x,e.y,e.type==='slime'?'#e0a030':'#6b3a1c',12,160);
  ring(e.x,e.y,'#fce404');
  sfx('coin',40);
}
function leak(e){
  if(e.dead)return;
  e.dead=true;
  setLives(lives-e.leak);
  shake=0.35;
  floatText(e.x,e.y-12,'-'+e.leak+' 愛心','#ff8a8a');
  sfx('leak');
  if(lives<=0)endGame();
}

function burst(x,y,color,n,power){
  n=n||10;power=power||140;
  for(var i=0;i<n;i++){
    var a=Math.random()*6.283,s=(0.4+Math.random())*power;
    fx.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,r:2+Math.random()*4,life:1,color:color,kind:'crumb'});
  }
}
function ring(x,y,color,vr){
  fx.push({x:x,y:y,r:8,vr:vr||220,life:1,color:color,kind:'ring'});
}
function boom(x,y,r,color){
  fx.push({x:x,y:y,r:8,max:r,life:1,color:color,kind:'boom'});
}
function mist(x,y,r){
  fx.push({x:x,y:y,r:r*0.4,max:r,life:1,color:'rgba(180,230,160,0.35)',kind:'mist'});
}
function floatText(x,y,s,color){
  floats.push({x:x,y:y,s:s,color:color||'#fce404',a:1,vy:-46});
}

function firstInRange(tw,range){
  var bestE=null,bestD=-1;
  for(var i=0;i<enemies.length;i++){
    var e=enemies[i];if(e.dead)continue;
    var d=Math.hypot(e.x-tw.x,e.y-tw.y);
    if(d<=range+e.r&&e.dist>bestD){bestD=e.dist;bestE=e}
  }
  return bestE;
}
function chiliTarget(tw,range,splash){
  var bestE=null,bestN=-1,bestD=-1;
  for(var i=0;i<enemies.length;i++){
    var e=enemies[i];if(e.dead)continue;
    if(Math.hypot(e.x-tw.x,e.y-tw.y)>range+e.r)continue;
    var n=0;
    for(var j=0;j<enemies.length;j++){
      var o=enemies[j];if(o.dead)continue;
      if(Math.hypot(o.x-e.x,o.y-e.y)<=splash+o.r)n++;
    }
    if(n>bestN||(n===bestN&&e.dist>bestD)){bestN=n;bestD=e.dist;bestE=e}
  }
  return bestE;
}
function onionTarget(tw,range){
  var bestE=null,bestD=-1,bestSlow=2;
  for(var i=0;i<enemies.length;i++){
    var e=enemies[i];if(e.dead)continue;
    if(Math.hypot(e.x-tw.x,e.y-tw.y)>range+e.r)continue;
    var sl=e.slow||0;
    if(sl<bestSlow-0.05||(Math.abs(sl-bestSlow)<0.05&&e.dist>bestD)){bestSlow=sl;bestD=e.dist;bestE=e}
  }
  return bestE;
}

function fire(tw,target){
  var k=kindAt(tw.type,tw.lv);
  tw.cool=k.rate;
  tw.face=target.x>=tw.x?1:-1;
  tw.fired=(tw.fired||0)+1;
  var muzzleY=tw.y-28;
  shots.push({
    type:tw.type,x:tw.x,y:muzzleY,tx:target.x,ty:target.y,tid:target.id,twid:tw.id,pad:tw.pad,
    spd: tw.type==='chili'?340:280, dmg:k.dmg, splash:k.splash||0, slow:k.slow||0, slowT:k.slowT||0,
    life:1.4
  });
  if(tw.type==='chili')sfx('shoot',50);
  else if(tw.type==='onion')sfx('slow',70);
  else sfx('shoot',45);
}

function tickTowers(dt){
  for(var i=0;i<towers.length;i++){
    var tw=towers[i],k=kindAt(tw.type,tw.lv);
    if(tw.pop>0){tw.pop-=dt;tw.scale=tw.pop>0.12?1.18-(0.35-tw.pop)*0.4:0.2+(1-0.2)*Math.min(1,(0.35-tw.pop)/0.23)}
    else tw.scale=1;
    tw.cool=Math.max(0,tw.cool-dt);
    if(tw.cool>0||!waving&&enemies.length===0)continue;
    var tgt=tw.type==='chili'?chiliTarget(tw,k.range,k.splash):tw.type==='onion'?onionTarget(tw,k.range):firstInRange(tw,k.range);
    if(tgt)fire(tw,tgt);
  }
}
function findE(id){
  for(var i=0;i<enemies.length;i++)if(enemies[i].id===id&&!enemies[i].dead)return enemies[i];
  return null;
}
function tickShots(dt){
  for(var i=shots.length-1;i>=0;i--){
    var s=shots[i];
    var tgt=findE(s.tid);
    if(tgt){s.tx=tgt.x;s.ty=tgt.y}
    var dx=s.tx-s.x,dy=s.ty-s.y,d=Math.hypot(dx,dy)||1;
    var step=s.spd*dt;
    if(step>=d){
      impact(s,tgt);
      shots.splice(i,1);
    }else{
      s.x+=dx/d*step;s.y+=dy/d*step;
      s.life-=dt;
      if(s.life<=0)shots.splice(i,1);
    }
  }
}
function impact(s,tgt){
  var hurt=false;
  function noteHit(){
    if(hurt)return;
    hurt=true;
    for(var ti=0;ti<towers.length;ti++)if(towers[ti].id===s.twid){towers[ti].hits=(towers[ti].hits||0)+1;break}
  }
  if(s.type==='chili'){
    boom(s.tx,s.ty,s.splash,'#ff6a2a');
    burst(s.tx,s.ty,'#ff7a30',16,180);
    sfx('splash',55);
    for(var i=0;i<enemies.length;i++){
      var e=enemies[i];if(e.dead)continue;
      if(Math.hypot(e.x-s.tx,e.y-s.ty)<=s.splash+e.r){hitTarget(e,s.dmg,0,0);noteHit()}
    }
  }else if(s.type==='onion'){
    mist(s.tx,s.ty,42);
    if(tgt){hitTarget(tgt,s.dmg,s.slow,s.slowT);noteHit()}
    else {
      for(var i=0;i<enemies.length;i++){
        var e=enemies[i];if(e.dead)continue;
        if(Math.hypot(e.x-s.tx,e.y-s.ty)<=28+e.r){hitTarget(e,s.dmg,s.slow,s.slowT);noteHit();break}
      }
    }
  }else{
    burst(s.tx,s.ty,'#f5c430',8,120);
    if(tgt){hitTarget(tgt,s.dmg,0,0);noteHit()}
  }
}

function tickEnemies(dt){
  for(var i=enemies.length-1;i>=0;i--){
    var e=enemies[i];
    if(e.dead){enemies.splice(i,1);continue}
    if(e.slow>0){e.slow-=dt;if(e.slow<=0){e.slow=0;e.slowMul=1}}
    var mul=e.slow>0?e.slowMul:1;
    e.dist+=e.spd*mul*dt;
    e.flash=Math.max(0,e.flash-dt*4);
    e.bob+=dt*6;
    if(e.dist>=pathLen){leak(e);enemies.splice(i,1);continue}
    var p=posAt(e.dist);
    e.x=p.x;e.y=p.y;e.ang=p.ang;
  }
}
function tickFx(dt){
  for(var i=fx.length-1;i>=0;i--){
    var p=fx[i];
    p.life-=dt*(p.kind==='boom'||p.kind==='mist'?1.6:1.8);
    if(p.kind==='crumb'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=240*dt}
    if(p.kind==='ring')p.r+=p.vr*dt;
    if(p.kind==='boom'||p.kind==='mist')p.r+=(p.max-8)*dt*2.2;
    if(p.life<=0)fx.splice(i,1);
  }
  for(var i=floats.length-1;i>=0;i--){
    var f=floats[i];
    f.y+=f.vy*dt;f.a-=dt*1.15;
    if(f.a<=0)floats.splice(i,1);
  }
}

function tickSpawn(dt){
  if(!waving)return;
  spawnT+=dt;
  while(queue.length&&queue[0].delay<=spawnT){
    spawnMob(queue.shift(),0);
  }
  if(!queue.length&&enemies.length===0)waveCleared();
}

function canvasXY(e){
  var r=cv.getBoundingClientRect();
  return {x:(e.clientX-r.left)*(W/Math.max(1,r.width)),y:(e.clientY-r.top)*(H/Math.max(1,r.height))};
}
function onTap(e){
  if(!run||over||paused)return;
  var p=canvasXY(e);
  for(var i=towers.length-1;i>=0;i--){
    var tw=towers[i];
    if(Math.hypot(p.x-tw.x,p.y-(tw.y-16))<=30){openTower(i);return}
  }
  for(var i=0;i<pads.length;i++){
    var pad=pads[i];
    if(!pad.tower&&Math.hypot(p.x-pad.x,p.y-pad.y)<=pad.r+10){openBuild(i);return}
  }
  hidePans();
  if(waiting)showNext();
}
cv.addEventListener('pointerdown',function(e){
  if(!run||over)return;
  onTap(e);
  e.preventDefault();
},{passive:false});

if(buildPan)buildPan.addEventListener('click',function(e){
  if(performance.now()<panLock){e.preventDefault();e.stopPropagation();return}
  var b=e.target.closest('[data-type]');
  if(!b||!sel||sel.kind!=='pad')return;
  doBuild(sel.i,b.getAttribute('data-type'));
});
if(towPan)towPan.addEventListener('click',function(e){
  if(performance.now()<panLock){e.preventDefault();e.stopPropagation();return}
  if(!sel||sel.kind!=='tower')return;
  if(e.target.closest('#upBtn'))doUpgrade(sel.i);
  else if(e.target.closest('#sellBtn'))doSell(sel.i);
});
if(nextBtn)nextBtn.addEventListener('click',function(){startWave(true)});
if(spdBtn)spdBtn.addEventListener('click',function(){
  speed=speed===1?2:1;
  spdBtn.textContent=speed+'x';
  spdBtn.setAttribute('aria-pressed',speed===2?'true':'false');
});

function drawBg(){
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#8ed14d');
  g.addColorStop(0.45,'#67b536');
  g.addColorStop(1,'#3f8a28');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,200,0.10)';
  ctx.beginPath();ctx.ellipse(W*0.78,H*0.08,W*0.4,H*0.12,0,0,6.28);ctx.fill();
  for(var i=0;i<decor.length;i++){
    var c=decor[i];
    ctx.fillStyle=c.c;
    ctx.beginPath();
    if(c.kind==='rock'){ctx.ellipse(c.x,c.y,c.r*1.3,c.r*0.7,0.2,0,6.28);ctx.fill()}
    else{ctx.ellipse(c.x,c.y,c.r,c.r*0.7,0,0,6.28);ctx.fill()}
  }
}
function drawPath(){
  if(!segs.length)return;
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='#8a6230';
  ctx.lineWidth=pathW+10;
  ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
  for(var i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);
  ctx.stroke();
  ctx.strokeStyle='#c4a06a';
  ctx.lineWidth=pathW;
  ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
  for(var i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);
  ctx.stroke();
  ctx.strokeStyle='#d8b888';
  ctx.lineWidth=Math.max(2,pathW*0.08);
  ctx.setLineDash([18,14]);
  ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
  for(var i=1;i<path.length;i++)ctx.lineTo(path[i].x,path[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
  /* entrance */
  var p0=path[0];
  ctx.fillStyle='rgba(11,97,46,.82)';
  roundRect(p0.x-28,p0.y-22,56,18,8);
  ctx.fill();
  ctx.fillStyle='#fce404';
  ctx.font='bold 11px sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('入口',p0.x,p0.y-13);
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function drawPads(){
  for(var i=0;i<pads.length;i++){
    var p=pads[i],pop=p.pop||0;
    if(pop>0)p.pop=Math.max(0,pop-0.016);
    var pr=p.r*(p.tower?0.92:1)+(pop>0?4:0);
    ctx.beginPath();ctx.ellipse(p.x,p.y+3,pr*1.05,pr*0.62,0,0,6.28);
    ctx.fillStyle='rgba(60,40,16,0.28)';ctx.fill();
    var grd=ctx.createRadialGradient(p.x-4,p.y-4,2,p.x,p.y,pr);
    grd.addColorStop(0,p.tower?'#d7c09a':'#efe0b8');
    grd.addColorStop(1,'#b8945c');
    ctx.beginPath();ctx.ellipse(p.x,p.y,pr,pr*0.78,0,0,6.28);
    ctx.fillStyle=grd;ctx.fill();
    ctx.lineWidth=3;
    ctx.strokeStyle=sel&&sel.kind==='pad'&&sel.i===i?'#fce404':'#8a6230';
    ctx.stroke();
    if(!p.tower){
      ctx.beginPath();ctx.ellipse(p.x,p.y,pr*0.55,pr*0.42,0,0,6.28);
      ctx.strokeStyle='rgba(252,228,4,0.7)';ctx.lineWidth=2;ctx.stroke();
    }
  }
}
function drawStall(){
  var p=path[path.length-1];
  var im=IM.stall,w=Math.min(128,W*0.36),h=w*0.92;
  if(ready(im))ctx.drawImage(im,p.x-w/2,p.y-h+18,w,h);
  /* lives pips under stall if low */
}
function drawRange(){
  if(!sel||sel.kind!=='tower')return;
  var tw=towers[sel.i];if(!tw)return;
  var k=kindAt(tw.type,tw.lv);
  ctx.beginPath();ctx.arc(tw.x,tw.y,k.range,0,6.28);
  ctx.fillStyle='rgba(252,228,4,0.12)';ctx.fill();
  ctx.strokeStyle='rgba(252,228,4,0.7)';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.stroke();ctx.setLineDash([]);
}
function drawTowers(){
  for(var i=0;i<towers.length;i++){
    var tw=towers[i],im=IM[tw.type],sc=tw.scale||1;
    var w=58*sc,h=66*sc;
    ctx.save();
    ctx.translate(tw.x,tw.y);
    if(tw.face<0)ctx.scale(-1,1);
    if(ready(im))ctx.drawImage(im,-w/2,-h+10,w,h);
    ctx.restore();
    if(sel&&sel.kind==='tower'&&sel.i===i){
      ctx.beginPath();ctx.arc(tw.x,tw.y+4,22,0,6.28);
      ctx.strokeStyle='#fce404';ctx.lineWidth=2;ctx.stroke();
    }
    if(tw.lv>1){
      ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
      ctx.fillStyle='#fce404';
      ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=3;
      var stars=tw.lv===3?'★★★':'★★';
      ctx.strokeText(stars,tw.x,tw.y-h+16);
      ctx.fillText(stars,tw.x,tw.y-h+16);
    }
  }
}
function drawMobs(){
  var list=enemies.slice().sort(function(a,b){return a.y-b.y});
  for(var i=0;i<list.length;i++){
    var e=list[i],im=IM[e.type];
    var bob=Math.sin(e.bob)*2;
    var sz=e.type==='boss'?64:e.type==='tank'?54:e.type==='slime'?40:42;
    sz=sz*(e.r/18);
    var y=e.y+bob;
    ctx.save();
    if(e.slow>0){
      ctx.beginPath();ctx.arc(e.x,y,e.r+8,0,6.28);
      ctx.fillStyle='rgba(170,230,170,0.28)';ctx.fill();
    }
    if(ready(im))ctx.drawImage(im,e.x-sz/2,y-sz+8,sz,sz);
    if(e.flash>0){
      ctx.globalAlpha=0.55*e.flash;
      ctx.fillStyle='#fff';
      ctx.beginPath();ctx.ellipse(e.x,y-sz*0.35,sz*0.32,sz*0.38,0,0,6.28);ctx.fill();
      ctx.globalAlpha=1;
    }
    /* hp bar */
    var bw=Math.max(22,sz*0.7),bh=5,bx=e.x-bw/2,by=y-sz-2;
    ctx.fillStyle='rgba(0,0,0,.45)';roundRect(bx-1,by-1,bw+2,bh+2,3);ctx.fill();
    ctx.fillStyle='#7a1c1c';roundRect(bx,by,bw,bh,2);ctx.fill();
    var pct=Math.max(0,e.hp/e.max);
    ctx.fillStyle=pct>0.45?'#7ad13a':'#f0c14a';
    if(pct>0){roundRect(bx,by,Math.max(2,bw*pct),bh,2);ctx.fill()}
    ctx.restore();
  }
}
function drawShots(){
  for(var i=0;i<shots.length;i++){
    var s=shots[i];
    if(s.type==='chili'){
      ctx.fillStyle='#ff4a1a';
      ctx.beginPath();ctx.arc(s.x,s.y,6,0,6.28);ctx.fill();
      ctx.fillStyle='rgba(255,120,40,0.5)';
      ctx.beginPath();ctx.arc(s.x,s.y,11,0,6.28);ctx.fill();
    }else if(s.type==='onion'){
      ctx.fillStyle='rgba(200,240,170,0.85)';
      ctx.beginPath();ctx.arc(s.x,s.y,7,0,6.28);ctx.fill();
      ctx.strokeStyle='rgba(140,210,110,0.9)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(s.x,s.y,10,0,6.28);ctx.stroke();
    }else{
      ctx.fillStyle='#f5c430';
      ctx.beginPath();ctx.arc(s.x,s.y,6,0,6.28);ctx.fill();
      ctx.fillStyle='#fff3a8';
      ctx.beginPath();ctx.arc(s.x-1.5,s.y-1.5,2.4,0,6.28);ctx.fill();
    }
  }
}
function drawFx(){
  for(var i=0;i<fx.length;i++){
    var p=fx[i];
    ctx.globalAlpha=Math.max(0,p.life);
    if(p.kind==='crumb'){
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.fill();
    }else if(p.kind==='ring'){
      ctx.strokeStyle=p.color;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.stroke();
    }else if(p.kind==='boom'){
      var grd=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,p.r);
      grd.addColorStop(0,'rgba(255,220,80,0.7)');
      grd.addColorStop(0.45,'rgba(255,90,20,0.45)');
      grd.addColorStop(1,'rgba(255,60,0,0)');
      ctx.fillStyle=grd;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.fill();
    }else if(p.kind==='mist'){
      ctx.fillStyle='rgba(180,230,160,0.32)';
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.fill();
      ctx.strokeStyle='rgba(150,220,140,0.5)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r*0.7,0,6.28);ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(var i=0;i<floats.length;i++){
    var f=floats[i];
    ctx.globalAlpha=Math.max(0,f.a);
    ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.45)';ctx.fillStyle=f.color;
    ctx.strokeText(f.s,f.x,f.y);ctx.fillText(f.s,f.x,f.y);
    ctx.globalAlpha=1;
  }
}
function draw(){
  var ox=0,oy=0;
  if(shake>0){ox=(Math.random()-0.5)*8*shake;oy=(Math.random()-0.5)*8*shake}
  ctx.setTransform(dpr,0,0,dpr,ox*dpr,oy*dpr);
  ctx.fillStyle='#5aaa32';
  ctx.fillRect(-20,-20,W+40,H+40);
  drawBg();
  drawPath();
  drawPads();
  drawStall();
  drawRange();
  drawMobs();
  drawTowers();
  drawShots();
  drawFx();
}

function loop(now){
  if(!run)return;
  var dt=Math.min(0.05,(now-last)/1000);last=now;
  if(!paused&&!over){
    var step=dt*speed;
    time+=step;
    if(shake>0)shake=Math.max(0,shake-dt*2);
    tickSpawn(step);
    tickEnemies(step);
    tickTowers(step);
    tickShots(step);
    tickFx(step);
  }else{
    tickFx(dt);
  }
  draw();
  raf=requestAnimationFrame(loop);
}

function resetState(){
  enemies=[];towers=[];shots=[];fx=[];floats=[];queue=[];
  for(var i=0;i<pads.length;i++){pads[i].tower=null;pads[i].pop=0}
  setGold(START_GOLD);setLives(MAX_LIVES);setWave(1);
  score=0;kills=0;earned=0;cleared=0;speed=1;bonus=0;
  waving=false;waiting=true;over=false;paused=false;sel=null;shake=0;spawnT=0;time=0;
  if(spdBtn){spdBtn.textContent='1x';spdBtn.setAttribute('aria-pressed','false')}
  if(recSlot)recSlot.innerHTML='';
  hidePans();
}

function start(){
  resetState();
  run=true;over=false;paused=false;
  if(how)how.hidden=false;
  if(ovcover)ovcover.hidden=false;
  if(ovlogo)ovlogo.hidden=false;
  if(toLobby)toLobby.hidden=true;
  if(recSlot)recSlot.innerHTML='';
  ov.className='overlay tdstart';
  ov.hidden=true;
  if(elHud)elHud.hidden=false;
  if(spdBtn)spdBtn.hidden=false;
  showNext();
  if(G.audio){G.audio.unlock();G.audio.play('start');G.audio.startBgm('td')}
  last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}

function endGame(){
  if(over)return;
  over=true;waiting=false;waving=false;
  hidePans();
  if(nextBtn)nextBtn.hidden=true;
  addScore(lives*20+cleared*20);
  if(G.audio){G.audio.stopBgm();G.audio.play('over')}
  if(score>best){best=score;G.setBest(KEY,best)}
  if(bestLine)bestLine.textContent='最高分 '+best;
  setTimeout(showOver,600);
}
function showOver(){
  run=false;cancelAnimationFrame(raf);draw();
  var nb=score>=best&&score>0;
  ovT.textContent='攤位被攻破了';
  ovS.innerHTML='守到第 <span class="big">'+Math.max(1,cleared||wave)+'</span> 波<br>本局分數 <b>'+score+'</b>　'+(nb?'新的最高分！':'最高分 '+best);
  if(recSlot)recSlot.innerHTML=G.pickHtml();
  go.textContent='再玩一次';
  if(how)how.hidden=true;
  if(ovcover)ovcover.hidden=true;
  if(toLobby)toLobby.hidden=false;
  ov.className='overlay tdover';
  ov.hidden=false;
}

function showPause(){
  paused=true;
  ovT.textContent='暫停中';
  ovS.textContent='回到頁面後再繼續守衛。';
  go.textContent='繼續';
  if(how)how.hidden=false;
  if(ovcover)ovcover.hidden=false;
  if(toLobby)toLobby.hidden=true;
  if(recSlot)recSlot.innerHTML='';
  ov.className='overlay tdstart';
  ov.hidden=false;
}
function resume(){
  paused=false;
  ov.hidden=true;
  if(G.audio){G.audio.unlock();G.audio.resumeBgm()}
  last=performance.now();
  cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}

go.addEventListener('click',function(){
  if(paused&&run&&!over){resume();return}
  start();
});
if(G.audio)G.audio.configure({key:'pcGameTdMuted',button:d.getElementById('muteBtn')});
d.addEventListener('visibilitychange',function(){
  if(d.hidden){
    if(run&&!over&&!paused)showPause();
    if(G.audio)G.audio.pauseBgm();
  }
});
window.addEventListener('resize',layout);
if(window.visualViewport)window.visualViewport.addEventListener('resize',layout);
layout();requestAnimationFrame(layout);


function coverInfo(){
  var out=[];
  for(var i=0;i<pads.length;i++){
    var p=pads[i],row={i:i,x:p.x,y:p.y,d:+distToPath(p.x,p.y).toFixed(1),cover:{},ok:true};
    for(var n in KINDS){
      var rng=KINDS[n].range[0],fr=coverFracs(p.x,p.y,rng);
      row.cover[n]={range:rng,len:+fr.len.toFixed(1),min:+fr.min.toFixed(3),max:+fr.max.toFixed(3)};
      if(fr.len<100)row.ok=false;
    }
    out.push(row);
  }
  return out;
}
function bottomLeftPad(){
  var best=0,score=1e9;
  for(var i=0;i<pads.length;i++){
    var s=pads[i].x+pads[i].y*0.15;
    if(s<score){score=s;best=i}
  }
  /* prefer the lowest-left pad in the bottom half when one exists */
  var low=null;
  for(var i=0;i<pads.length;i++){
    if(pads[i].y<map.t+(map.b-map.t)*0.55)continue;
    var s=pads[i].x*1.2+pads[i].y*-0.15;
    if(!low||s<low.s)low={i:i,s:s};
  }
  return low?low.i:best;
}

window.PCTd={
  start:start,
  next:function(){startWave(true)},
  setSpeed:function(n){speed=n===2?2:1;if(spdBtn){spdBtn.textContent=speed+'x';spdBtn.setAttribute('aria-pressed',speed===2?'true':'false')}},
  gold:function(n){if(n!=null)setGold(n);return gold},
  lives:function(n){if(n!=null)setLives(n);return lives},
  build:function(i,type){return doBuild(i,type)},
  upgrade:function(i){return doUpgrade(i)},
  sell:function(i){return doSell(i)},
  spawn:function(type,dist){
    var m=MOBS[type]||MOBS.chunk;
    var hpMul=Math.pow(1.22,wave-1);
    return spawnMob({type:type,hp:Math.round(m.hp*hpMul),spd:m.spd,gold:m.gold,leak:m.leak,r:m.r},(dist||0)*pathLen);
  },
  killAll:function(){for(var i=enemies.length-1;i>=0;i--)kill(enemies[i]);enemies=[];},
  end:function(){endGame();showOver()},
  openBuild:openBuild,
  openTower:openTower,
  hidePans:hidePans,
  showcase:function(){
    if(!run)start();
    resetState();run=true;over=false;paused=false;waiting=false;waving=true;
    setGold(400);setWave(5);setLives(8);score=420;
    doBuild(3,'cheese');doBuild(5,'chili');doBuild(7,'onion');
    if(towers[0]){towers[0].lv=2;towers[0].spent=150}
    if(towers[1]){towers[1].lv=2;towers[1].spent=200}
    hidePans();if(nextBtn)nextBtn.hidden=true;
    function put(type,frac,hp){
      var m=MOBS[type];
      return spawnMob({type:type,hp:hp||m.hp,spd:0,gold:m.gold,leak:m.leak,r:m.r},frac*pathLen);
    }
    var eBoss=put('boss',0.18,320);
    var e0=put('chunk',0.28,28);
    var e1=put('slime',0.36,18);
    var e2=put('chunk',0.48,30);
    var e3=put('tank',0.58,140);
    var e4=put('chunk',0.70,30);
    var e5=put('slime',0.80,16);
    if(e0){boom(e0.x,e0.y,58,'#ff6a2a');burst(e0.x,e0.y,'#ff7a30',20,220);hitTarget(e0,12,0,0)}
    if(e3){boom(e3.x,e3.y,62,'#ff6a2a');burst(e3.x,e3.y,'#ff7a30',16,180);mist(e3.x,e3.y,48);hitTarget(e3,18,0.5,2)}
    if(e2){burst(e2.x,e2.y,'#f5c430',12,160);hitTarget(e2,22,0,0);ring(e2.x,e2.y,'#fce404',260)}
    if(e5){mist(e5.x,e5.y,46);hitTarget(e5,8,0.5,2)}
    if(towers[0]&&e2)fire(towers[0],e2);
    if(towers[1]&&e3)fire(towers[1],e3);
    if(towers[2]&&e4)fire(towers[2],e4);
    if(towers[0]&&e0){var k0=kindAt('cheese',2);shots.push({type:'cheese',x:towers[0].x-8,y:towers[0].y-28,tx:e0.x,ty:e0.y,tid:e0.id,spd:0,dmg:k0.dmg,splash:0,slow:0,slowT:0,life:1.2});}
    if(towers[1]&&e1){var k1=kindAt('chili',2);shots.push({type:'chili',x:towers[1].x+10,y:towers[1].y-24,tx:e1.x,ty:e1.y,tid:e1.id,spd:0,dmg:k1.dmg,splash:k1.splash,slow:0,slowT:0,life:1.2});}
    last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
  },
  info:function(){
    return {
      run:run,over:over,paused:paused,speed:speed,gold:gold,lives:lives,wave:wave,
      score:score,best:best,kills:kills,earned:earned,cleared:cleared,
      waiting:waiting,waving:waving,bonus:bonus,
      enemies:enemies.length,towers:towers.map(function(t){return {type:t.type,lv:t.lv,pad:t.pad,x:t.x,y:t.y,fired:t.fired||0,hits:t.hits||0}}),
      pads:pads.map(function(p){return {x:p.x,y:p.y,r:p.r,filled:!!p.tower}}),
      shots:shots.length,fx:fx.length,w:W,h:H,pathLen:pathLen,
      sel:sel,panel:buildPan&&!buildPan.hidden?'build':(towPan&&!towPan.hidden?'tower':null),
      bottomLeft:bottomLeftPad()
    };
  },
  coverInfo:coverInfo,
  bottomLeft:bottomLeftPad,
  audio:function(){return G.audio?G.audio.info():null}
};
})();
