(function(){
var d=document,G=window.PCGames;
var cv=d.getElementById('stage'),ctx=cv.getContext('2d');
var wrap=d.getElementById('wrap');
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go'),how=d.getElementById('how'),ovlogo=d.getElementById('ovlogo');
var elScore=d.getElementById('score'),elDist=d.getElementById('dist'),elBest=d.getElementById('best');
var KEY='pcGameRunBest',KEYD='pcGameRunBestDist';
var W=0,H=0,dpr=1,focal=1,horizon=0,camH=1.8;
var LANE=1.22,NEAR=5.7,FAR=78,ROAD=1.60;
var CHAR=0.56; // width vs nearest lane
var FEET=0.78; // feet at 78% of canvas height
var run=false,frozen=false,crashing=false,crashT=0,last=0,raf=0,camZ=0,speed=0,dist=0,score=0,coins=0,pops=[];
var best=G.getBest(KEY),bestDist=G.getBest(KEYD);
elBest.textContent=best;elDist.textContent=0;
var player={lane:0,x:0,y:0,vy:0,state:'run',rollT:0,tilt:0,landT:0};
var objs=[],nextZ=0,flavI=0;
var IM={
  onion:img('img/onion.png'),
  bbq:img('img/bbq.png'),
  cheese:img('img/cheese.png'),
  chili:img('img/chili.png')
};
var FLAVS=['onion','bbq','cheese','chili'];
function img(src){var i=new Image();i.src=src;return i}
function ready(im){return im&&im.complete&&im.naturalWidth>0}
function setScore(n){score=Math.max(0,n);elScore.textContent=score}

function size(){
  var r=cv.parentNode.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(1,Math.floor(r.width));
  H=Math.max(1,Math.floor(r.height));
  cv.width=W*dpr;cv.height=H*dpr;
  cv.style.width=W+'px';cv.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  horizon=H*0.28;
  focal=W*1.28;
  camH=(H*FEET-horizon)*NEAR/focal;
  draw();
}

function proj(wx,wy,relZ){
  var z=Math.max(relZ,0.55);
  var s=focal/z;
  return {x:W/2+wx*s,y:horizon+(camH-wy)*s,s:s};
}

function laneX(lane){return lane*LANE}
function roadHalf(){return LANE*ROAD}

/* -------- input -------- */
var sx=0,sy=0,sAt=0,swiping=false;
function bindLock(el,type,fn){el.addEventListener(type,fn,{passive:false})}
function preventPage(e){
  if(ov&&!ov.hidden)return;
  e.preventDefault();
}
bindLock(wrap,'touchstart',preventPage);
bindLock(wrap,'touchmove',preventPage);
bindLock(cv,'touchstart',preventPage);
bindLock(cv,'touchmove',preventPage);
bindLock(d,'touchmove',function(e){
  if(ov&&!ov.hidden)return;
  e.preventDefault();
});

function onDown(x,y){sx=x;sy=y;sAt=performance.now();swiping=true}
function onUp(x,y){
  if(!swiping)return;swiping=false;
  if(!run||crashing)return;
  var dx=x-sx,dy=y-sy,adx=Math.abs(dx),ady=Math.abs(dy);
  if(adx<28&&ady<28)return;
  if(adx>ady){if(dx>0)shift(1);else shift(-1)}
  else{if(dy<0)jump();else roll()}
}
cv.addEventListener('pointerdown',function(e){onDown(e.clientX,e.clientY);try{cv.setPointerCapture(e.pointerId)}catch(_){} e.preventDefault()});
cv.addEventListener('pointerup',function(e){onUp(e.clientX,e.clientY)});
cv.addEventListener('pointercancel',function(){swiping=false});
d.addEventListener('keydown',function(e){
  if(!run||crashing)return;
  var k=e.key;
  if(k==='ArrowLeft'||k==='a'||k==='A'){shift(-1);e.preventDefault()}
  else if(k==='ArrowRight'||k==='d'||k==='D'){shift(1);e.preventDefault()}
  else if(k==='ArrowUp'||k==='w'||k==='W'||k===' '){jump();e.preventDefault()}
  else if(k==='ArrowDown'||k==='s'||k==='S'){roll();e.preventDefault()}
});

function shift(dir){
  var n=player.lane+dir;
  if(n<-1||n>1)return;
  player.lane=n;
}
function jump(){
  if(player.state==='roll')return;
  if(player.y>0.12)return;
  player.state='jump';player.vy=8.7;player.y=0.02;player.landT=0;
}
function roll(){
  if(player.state==='jump'&&player.y>0.3)return;
  player.state='roll';player.rollT=0.52;player.vy=0;player.y=0;
}

/* -------- spawn -------- */
function resetWorld(){
  objs=[];pops=[];camZ=0;speed=26;dist=0;coins=0;setScore(0);
  player.lane=0;player.x=0;player.y=0;player.vy=0;player.state='run';player.rollT=0;player.tilt=0;player.landT=0;
  crashing=false;crashT=0;
  var base=camZ+NEAR;
  nextZ=base+62;
  seedCoins(base+10,0);
  seedCoins(base+14,1);
  seedCoins(base+18,-1);
  seedCoins(base+22,0);
  // scripted first obstacles so the road looks like a runner immediately
  place(base+28,-1,'loopy');
  seedCoins(base+28,-1);
  place(base+36,1,'fries');
  seedCoins(base+36,1);
  place(base+46,-1,'train');
  seedCoins(base+48,0);
  place(base+54,0,'pops');
  seedCoins(base+54,0);
  place(base+62,1,'drink');
}

function seedCoins(z,lane){
  objs.push({typ:'coin',kind:FLAVS[flavI++%FLAVS.length],lane:lane,z:z,hit:0});
}

function spawnRow(){
  var z=nextZ;
  var gap=Math.max(16,speed*0.62);
  nextZ=z+gap;
  var r=Math.random();
  var easy=dist<55;
  if(easy){
    if(r<.55){
      var lane=(Math.random()*3|0)-1;
      seedCoins(z,lane);
      if(Math.random()<.45)seedCoins(z+gap*0.35,(lane+1+Math.random()*2|0)%3-1);
    }else if(r<.8){
      place(z,(Math.random()*3|0)-1, Math.random()<.5?'loopy':'pops');
    }else{
      place(z,(Math.random()*3|0)-1,'fries');
    }
    return;
  }
  if(r<.16){
    var open=(Math.random()*3|0)-1;
    for(var L=-1;L<=1;L++)if(L!==open)place(z,L, Math.random()<.5?'drink':'train');
    seedCoins(z,open);
  }else if(r<.32){
    var L=(Math.random()*3|0)-1;
    place(z,L,'fries');
    seedCoins(z,L);
    if(Math.random()<.5)place(z,((L+2)%3)-1,'loopy');
  }else if(r<.5){
    var L=(Math.random()*3|0)-1;
    place(z,L,'loopy');
    seedCoins(z,L);
    if(Math.random()<.4)place(z,((L+2)%3)-1,'pops');
  }else if(r<.66){
    var L=(Math.random()*3|0)-1;
    place(z,L,'pops');
    if(Math.random()<.5)seedCoins(z,((L+1)%3)-1);
  }else if(r<.82){
    var L=(Math.random()*3|0)-1;
    place(z,L, Math.random()<.5?'drink':'train');
    seedCoins(z,L===0?(Math.random()<.5?1:-1):(L===1?-1:1));
  }else{
    var L=(Math.random()*3|0)-1;
    place(z,L,['loopy','pops','drink','fries','train'][Math.random()*5|0]);
    seedCoins(z+gap*0.4, -L||(Math.random()<.5?1:-1));
  }
}
function place(z,lane,kind){
  var o={typ:'obs',kind:kind,lane:lane,z:z,hit:0};
  if(kind==='train')o.len=10.4;
  objs.push(o);
}

/* hit profiles: low jump, tall lane-change, arch roll */
function profile(kind){
  if(kind==='loopy')return {shape:'low',h:0.82,w:1.16};
  if(kind==='pops')return {shape:'low',h:0.90,w:1.16};
  if(kind==='drink')return {shape:'tall',h:2.55,w:1.08};
  if(kind==='fries')return {shape:'arch',h:2.45,w:1.20,gap:0.82};
  if(kind==='train')return {shape:'tall',h:1.85,w:1.14};
  return {shape:'low',h:0.8,w:1.0};
}

function playerBox(){
  var body=LANE*CHAR;
  var h=player.state==='roll'?0.42:0.95;
  return {x:player.x,w:body*0.62,y:player.y,h:h,z:camZ+NEAR};
}

function collide(o){
  var pb=playerBox();
  var rel=o.z-pb.z;
  var zLen=o.len||0.55;
  var sweep=Math.max(0.8,speed*0.06);
  if(rel>sweep||rel<-zLen)return false;
  var ox=laneX(o.lane);
  if(Math.abs(ox-pb.x)>LANE*0.48)return false;
  if(o.typ==='coin'){
    var cy=o._above?0.95:0.42;
    if(o._above&&player.y<0.25)return false;
    return pb.y+pb.h>cy-0.25 && pb.y<cy+0.4;
  }
  var p=profile(o.kind);
  if(p.shape==='arch'){
    return pb.y+pb.h>p.gap;
  }
  return pb.y < p.h;
}

/* -------- update -------- */
function update(dt){
  if(crashing){
    crashT+=dt;
    player.tilt+=dt*8;
    player.y=Math.max(0,player.y+player.vy*dt);
    player.vy-=18*dt;
    if(crashT>0.6)end();
    return;
  }
  speed=Math.min(58,26+dist*0.08);
  camZ+=speed*dt;
  dist=camZ*1.15;
  elDist.textContent=String(Math.floor(dist));
  setScore(Math.floor(dist)+coins);

  var tx=laneX(player.lane);
  player.x+=(tx-player.x)*Math.min(1,dt*14);
  var wantTilt=(tx-player.x)*0.7;
  player.tilt+=(wantTilt-player.tilt)*Math.min(1,dt*10);

  if(player.state==='roll'){
    player.rollT-=dt;
    if(player.rollT<=0){player.state='run';player.rollT=0;player.landT=0.12}
  }
  if(player.state==='jump'||player.y>0){
    player.vy-=22*dt;
    player.y+=player.vy*dt;
    if(player.y<=0){player.y=0;player.vy=0;player.state='run';player.landT=0.16}
  }
  if(player.landT>0)player.landT=Math.max(0,player.landT-dt);

  if(camZ+FAR>nextZ)spawnRow();

  var pbz=camZ+NEAR;
  for(var i=objs.length-1;i>=0;i--){
    var o=objs[i];
    if(o.z+(o.len||0)<camZ+1.2){objs.splice(i,1);continue}
    if(o.typ==='coin'){
      o._above=false;
      for(var j=0;j<objs.length;j++){
        var q=objs[j];
        if(q.typ==='obs'&&q.lane===o.lane&&Math.abs(q.z-o.z)<0.8){
          if(q.kind==='loopy'||q.kind==='pops')o._above=true;
        }
      }
    }
    if(!o.hit&&collide(o)){
      if(o.typ==='coin'){
        o.hit=1;coins+=15;setScore(Math.floor(dist)+coins);
        var prj=proj(laneX(o.lane),o._above?0.9:0.45,o.z-camZ);
        pops.push({x:prj.x,y:prj.y,s:'+15',c:'#0b612e',a:1});
        objs.splice(i,1);
      }else{
        crash();
      }
    }
  }
  pops.forEach(function(p){p.y-=50*dt;p.a-=dt*1.5});
  pops=pops.filter(function(p){return p.a>0});
}

function crash(){
  if(crashing)return;
  crashing=true;crashT=0;player.vy=4;
  if(navigator.vibrate)try{navigator.vibrate(80)}catch(_){}
}

/* -------- draw helpers -------- */
function uhash(n){
  n|=0;
  n=(n*374761393+668265263)|0;
  n=(n^(n>>>13))*1274126177;
  return ((n^(n>>>16))>>>0)/4294967296;
}
function rr(x,y,w,h,r){
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);
  else ctx.rect(x,y,w,h);
}
function drawImg(im,x,y,w,h){
  if(ready(im))ctx.drawImage(im,x,y,w,h);
}
function drawShadow(x,y,s,rx){
  ctx.save();ctx.globalAlpha=0.32;ctx.fillStyle='#000';
  ctx.beginPath();ctx.ellipse(x,y+s*0.02,s*(rx||0.5),s*0.15,0,0,6.2832);ctx.fill();ctx.restore();
}

/* extruded box: front + top + side + light outline */
function drawPrism(cx,yG,w,h,s,front,side,top,opts){
  opts=opts||{};
  var taper=opts.taper||0;
  var depth=Math.max(8,s*(opts.depth||0.42));
  var dir=opts.dir!=null?opts.dir:(cx<W/2?1:-1);
  var skew=dir*depth*0.78;
  var lift=depth*0.58;
  var topW=w,botW=w*(1-taper);
  var x0t=cx-topW/2,x1t=cx+topW/2;
  var x0b=cx-botW/2,x1b=cx+botW/2;
  var y0=yG-h,y1=yG;
  // top
  ctx.fillStyle=top;
  ctx.beginPath();
  ctx.moveTo(x0t,y0);ctx.lineTo(x1t,y0);
  ctx.lineTo(x1t+skew,y0-lift);ctx.lineTo(x0t+skew,y0-lift);
  ctx.closePath();ctx.fill();
  // side
  ctx.fillStyle=side;
  if(skew>0){
    ctx.beginPath();
    ctx.moveTo(x1t,y0);ctx.lineTo(x1t+skew,y0-lift);
    ctx.lineTo(x1b+skew,y1-lift);ctx.lineTo(x1b,y1);
    ctx.closePath();ctx.fill();
  }else{
    ctx.beginPath();
    ctx.moveTo(x0t,y0);ctx.lineTo(x0t+skew,y0-lift);
    ctx.lineTo(x0b+skew,y1-lift);ctx.lineTo(x0b,y1);
    ctx.closePath();ctx.fill();
  }
  // front
  ctx.fillStyle=front;
  ctx.beginPath();
  ctx.moveTo(x0t,y0);ctx.lineTo(x1t,y0);
  ctx.lineTo(x1b,y1);ctx.lineTo(x0b,y1);
  ctx.closePath();ctx.fill();
  if(opts.stroke!==false){
    ctx.strokeStyle=opts.stroke||'rgba(20,30,20,0.45)';
    ctx.lineWidth=Math.max(1,s*0.025);
    ctx.stroke();
  }
}

/* -------- world -------- */
function drawSky(){
  var g=ctx.createLinearGradient(0,0,0,horizon+8);
  g.addColorStop(0,'#0e5a2c');
  g.addColorStop(0.7,'#5eae6e');
  g.addColorStop(1,'#9ed9b0');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // sun
  ctx.fillStyle='#fce404';
  ctx.beginPath();ctx.arc(W*0.78,horizon*0.42,H*0.055,0,6.2832);ctx.fill();
  // distant mall silhouette just on the horizon
  ctx.save();
  ctx.globalAlpha=0.28;
  ctx.fillStyle='#0b4a24';
  var hx=W*0.08,hy=horizon,bw=W*0.12;
  for(var i=0;i<9;i++){
    var bh=8+uhash(i+11)*22;
    ctx.fillRect(hx,hy-bh,bw*0.9,bh);
    hx+=bw*0.95;
  }
  ctx.restore();
}

function drawRoad(){
  var segs=26,rh=roadHalf();
  for(var i=segs;i>=0;i--){
    var z0=NEAR+(FAR-NEAR)*(i+1)/segs;
    var z1=NEAR+(FAR-NEAR)*i/segs;
    function trap(half,zA,zB){
      var a=proj(-half,0,zA),b=proj(half,0,zA),c=proj(half,0,zB),d=proj(-half,0,zB);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();
    }
    ctx.fillStyle=(i%2===0)?'#0f7a38':'#148c44';
    trap(14,z0,z1);ctx.fill();
    ctx.fillStyle=(i%2===0)?'#e8c94a':'#d6b536';
    trap(rh,z0,z1);ctx.fill();
  }
  var yN=proj(0,0,NEAR).y;
  if(yN<H){
    ctx.fillStyle='#0f7a38';
    ctx.fillRect(0,yN-1,W,H-yN+3);
    var Lft=proj(-rh,0,NEAR),Rgt=proj(rh,0,NEAR);
    var widen=(H-yN)/(H*0.22);
    ctx.fillStyle='#e8c94a';
    ctx.beginPath();
    ctx.moveTo(Lft.x,yN);ctx.lineTo(Rgt.x,yN);
    ctx.lineTo(Rgt.x+(Rgt.x-W/2)*widen,H+2);
    ctx.lineTo(Lft.x+(Lft.x-W/2)*widen,H+2);
    ctx.closePath();ctx.fill();
  }
  // curb
  ctx.strokeStyle='rgba(11,97,46,0.35)';
  var a=proj(-rh,0.01,NEAR),b=proj(-rh,0.01,FAR*0.7);
  var c=proj(rh,0.01,NEAR),e=proj(rh,0.01,FAR*0.7);
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(e.x,e.y);ctx.stroke();
  // lane dividers
  var dash=3.2,gap=2.4,period=dash+gap;
  var start=camZ%period;
  ctx.lineCap='butt';
  for(var side=-1;side<=1;side+=2){
    var xw=side*LANE*0.5;
    for(var z=NEAR-start;z<FAR;z+=period){
      if(z<NEAR-0.2)continue;
      var p0=proj(xw,0.01,z),p1=proj(xw,0.01,z+dash);
      ctx.strokeStyle='#fff6bf';
      ctx.lineWidth=Math.max(2,p0.s*0.06);
      ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();
    }
  }
}

/* food-court stalls & mall blocks along both shoulders */
function collectBuildings(){
  var list=[],spacing=4.0;
  var zStart=Math.floor((camZ+2)/spacing)*spacing;
  var zEnd=camZ+FAR;
  for(var zw=zEnd;zw>=zStart;zw-=spacing){
    var rel=zw-camZ;
    if(rel<2||rel>FAR)continue;
    var seed=Math.round(zw/spacing);
    list.push({typ:'bldg',row:'mall',side:-1,z:zw,rel:rel,seed:seed+17});
    list.push({typ:'bldg',row:'mall',side: 1,z:zw,rel:rel,seed:seed+91});
    list.push({typ:'bldg',row:'stall',side:-1,z:zw+spacing*0.45,rel:zw+spacing*0.45-camZ,seed:seed+3});
    list.push({typ:'bldg',row:'stall',side: 1,z:zw+spacing*0.45,rel:zw+spacing*0.45-camZ,seed:seed+53});
  }
  return list;
}

var STALL_PAL=[
  {f:'#fff6e8',s:'#c9b089',t:'#f7ecd4',a:'#c0392b',si:'#fce404'},
  {f:'#fffdf2',s:'#b8a56a',t:'#fce404',a:'#148c44',si:'#fff6bf'},
  {f:'#f3efe4',s:'#9a8a68',t:'#e8d9b0',a:'#d35400',si:'#fce404'},
  {f:'#eef8f0',s:'#7aa07a',t:'#d6eedb',a:'#0b612e',si:'#fff6bf'},
  {f:'#fff3d6',s:'#c4a24a',t:'#ffe9a3',a:'#c41e3a',si:'#148c44'}
];
var MALL_PAL=[
  {f:'#d9e8d4',s:'#8aa58a',t:'#eef6ec'},
  {f:'#efe6d2',s:'#b09a72',t:'#f7f0e2'},
  {f:'#cfd8c8',s:'#7d8c78',t:'#e4ece0'},
  {f:'#e8dcc4',s:'#a89470',t:'#f4ead6'}
];

function drawBuilding(b){
  if(b.rel<2||b.rel>FAR)return;
  var fade=b.rel>FAR-12?Math.max(0,(FAR-b.rel)/12):1;
  ctx.save();ctx.globalAlpha=fade;
  if(b.row==='mall')drawMall(b);
  else drawStall(b);
  ctx.restore();
}

function drawMall(b){
  var h=3.2+uhash(b.seed)*3.4;
  var w=2.0+uhash(b.seed+1)*1.4;
  var x=b.side*(roadHalf()+2.15+w*0.5);
  var pal=MALL_PAL[b.seed%MALL_PAL.length];
  var gnd=proj(x,0,b.rel);
  var top=proj(x,h,b.rel);
  var pw=w*gnd.s,ph=gnd.y-top.y;
  if(pw<4||ph<4)return;
  drawPrism(gnd.x,gnd.y,pw,ph,gnd.s,pal.f,pal.s,pal.t,{depth:0.7,dir:b.side});
  // window grid
  var cols=2+((b.seed>>2)&1),rows=2+((b.seed>>3)&2);
  ctx.fillStyle='rgba(40,70,50,0.28)';
  var m=pw*0.12,gw=(pw-m*2)/cols,gh=(ph*0.7)/rows;
  var y0=gnd.y-ph+ph*0.12;
  for(var r=0;r<rows;r++){
    for(var c=0;c<cols;c++){
      ctx.fillRect(gnd.x-pw/2+m+c*gw+gw*0.15,y0+r*(gh+2)+2,gw*0.7,gh*0.7);
    }
  }
}

function drawStall(b){
  var h=1.55+uhash(b.seed)*1.6;
  var w=1.35+uhash(b.seed+2)*0.9;
  var x=b.side*(roadHalf()+0.28+w*0.5);
  var pal=STALL_PAL[b.seed%STALL_PAL.length];
  var gnd=proj(x,0,b.rel);
  var top=proj(x,h,b.rel);
  var pw=w*gnd.s,ph=Math.max(8,gnd.y-top.y);
  if(pw<6)return;
  // body
  drawPrism(gnd.x,gnd.y,pw,ph,gnd.s,pal.f,pal.s,pal.t,{depth:0.5,dir:b.side});
  // counter (lower lip toward the road)
  var cw=pw*1.02,ch=ph*0.22;
  var cx=gnd.x-b.side*pw*0.06;
  drawPrism(cx,gnd.y,cw,ch,gnd.s,'#d9c49a','#8a7040','#efe0c0',{depth:0.28,dir:b.side});
  // awning hanging toward the road
  var aw=pw*1.15,ah=Math.max(6,ph*0.16);
  var ax=gnd.x-b.side*pw*0.08;
  var ay=gnd.y-ph+ah*0.15;
  drawPrism(ax,ay,aw,ah,gnd.s,pal.a,shade(pal.a,0.65),tint(pal.a,0.25),{depth:0.35,dir:b.side});
  // awning stripes
  ctx.save();
  ctx.globalAlpha=0.22;
  ctx.fillStyle='#fff';
  var stripes=4;
  for(var i=0;i<stripes;i++){
    if(i%2)ctx.fillRect(ax-aw/2+(i/stripes)*aw,ay-ah,aw/stripes,ah);
  }
  ctx.restore();
  // sign board
  var sw=pw*0.55,sh=Math.max(6,ph*0.18);
  ctx.fillStyle=pal.si;
  rr(gnd.x-sw/2,gnd.y-ph-sh*0.85,sw,sh,2);
  ctx.fill();
  ctx.strokeStyle='rgba(20,30,20,0.35)';
  ctx.lineWidth=1;ctx.stroke();
  // window
  ctx.fillStyle='rgba(40,70,80,0.2)';
  var ww=pw*0.55,wh=ph*0.38;
  ctx.fillRect(gnd.x-ww/2,gnd.y-ph*0.72,ww,wh);
}

function shade(hex,k){
  var n=parseInt(hex.slice(1),16);
  var r=((n>>16)&255)*k,g=((n>>8)&255)*k,b=(n&255)*k;
  return 'rgb('+((r)|0)+','+((g)|0)+','+((b)|0)+')';
}
function tint(hex,p){
  var n=parseInt(hex.slice(1),16);
  var r=((n>>16)&255),g=((n>>8)&255),b=(n&255);
  r=r+(255-r)*p;g=g+(255-g)*p;b=b+(255-b)*p;
  return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')';
}

/* -------- obstacles -------- */
function drawObj(o){
  var rel=o.z-camZ;
  if(rel<1||rel>FAR)return;
  var fade=rel>FAR-12?Math.max(0,(FAR-rel)/12):1;
  ctx.save();ctx.globalAlpha=fade;
  var lx=laneX(o.lane);
  if(o.typ==='coin'){
    var wy=o._above?0.95:0.45;
    var p=proj(lx,wy,rel);
    var sz=Math.max(14,0.36*p.s);
    p.y-=Math.sin(camZ*3+o.z)*0.05*p.s;
    // soft disc behind icon so it reads as a collectible
    ctx.fillStyle='rgba(255,255,255,0.55)';
    ctx.beginPath();ctx.arc(p.x,p.y,sz*0.62,0,6.2832);ctx.fill();
    drawImg(IM[o.kind],p.x-sz/2,p.y-sz/2,sz,sz);
    ctx.restore();return;
  }
  if(o.kind==='train'){drawTrain(o,lx,rel);ctx.restore();return}
  if(o.kind==='fries'){drawArch(o,lx,rel);ctx.restore();return}
  if(o.kind==='drink'){drawDrink(o,lx,rel);ctx.restore();return}
  if(o.kind==='loopy'){drawLoopy(o,lx,rel);ctx.restore();return}
  if(o.kind==='pops'){drawPops(o,lx,rel);ctx.restore();return}
  ctx.restore();
}

function drawArch(o,lx,rel){
  var pr=profile('fries');
  var gnd=proj(lx,0,rel);
  var top=proj(lx,pr.h,rel);
  var gap=proj(lx,pr.gap,rel);
  var half=pr.w*0.5*gnd.s;
  var pw=Math.max(12,0.30*gnd.s);
  var yG=gnd.y,yGap=gap.y,yTop=top.y,x=gnd.x;
  var beamH=Math.max(16,yGap-yTop);
  var openW=half*2-pw*2;
  drawShadow(x,yG,gnd.s,pr.w*0.72);
  // pillars
  drawPrism(x-half+pw/2,yG,pw,yG-yTop,gnd.s,'#d32f2f','#8e1518','#ef5350',{depth:0.55});
  drawPrism(x+half-pw/2,yG,pw,yG-yTop,gnd.s,'#d32f2f','#8e1518','#ef5350',{depth:0.55});
  // inner walls so the opening reads as a tunnel
  ctx.fillStyle='#7a1218';
  ctx.fillRect(x-half+pw,yGap,Math.max(5,pw*0.28),yG-yGap);
  ctx.fillRect(x+half-pw-Math.max(5,pw*0.28),yGap,Math.max(5,pw*0.28),yG-yGap);
  // beam (the giant fries box)
  drawPrism(x,yGap,half*2,beamH,gnd.s,'#e53935','#8e1518','#ff7043',{depth:0.6});
  // underside shadow of the beam
  ctx.fillStyle='rgba(0,0,0,0.38)';
  ctx.fillRect(x-openW/2,yGap,openW,Math.max(4,gnd.s*0.09));
  // yellow brand band
  ctx.fillStyle='#fce404';
  ctx.fillRect(x-half+pw*0.12,yTop+beamH*0.42,half*2-pw*0.24,Math.max(3,beamH*0.18));
  // fries sticking out of the box
  var n=9;
  for(var i=0;i<n;i++){
    var fx=x-half+pw*0.35+(i/(n-1))*(half*2-pw*0.7);
    var fh=(0.5+((i*37)%10)/16)*gnd.s*0.78;
    var fw=Math.max(3,gnd.s*0.075);
    ctx.fillStyle=i%2?'#fce404':'#e8c94a';
    ctx.strokeStyle='#b89620';
    ctx.lineWidth=1;
    rr(fx-fw/2,yTop-fh,fw,fh+2,fw*0.4);
    ctx.fill();ctx.stroke();
  }
}

function drawLoopy(o,lx,rel){
  var pr=profile('loopy');
  var gnd=proj(lx,0,rel);
  var top=proj(lx,pr.h,rel);
  var w=pr.w*gnd.s,h=Math.max(10,gnd.y-top.y);
  drawShadow(gnd.x,gnd.y,gnd.s,pr.w*0.7);
  drawPrism(gnd.x,gnd.y,w,h*0.40,gnd.s,'#c0392b','#7a1c16','#e74c3c',{depth:0.42});
  // soft mound
  var mx=gnd.x,my=gnd.y-h*0.34,mh=h*0.7,mw=w*0.92;
  ctx.fillStyle='#e0a83a';
  ctx.beginPath();ctx.ellipse(mx,my-mh*0.12,mw*0.5,mh*0.5,0,0,6.2832);ctx.fill();
  // clearly coiled curly fries sitting on the tray
  function coil(cx,cy,r,col,dir){
    ctx.strokeStyle=col;
    ctx.lineWidth=Math.max(2.4,gnd.s*0.085);
    ctx.lineCap='round';
    ctx.beginPath();
    var turns=2.3;
    for(var a=0;a<=turns*6.2832;a+=0.18){
      var rr=r*(1-a/(turns*6.2832)*0.85);
      var x=cx+Math.cos(a*dir)*rr;
      var y=cy+Math.sin(a*dir)*rr*0.62;
      if(a===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  var coils=[
    [-0.28,-0.22,0.20,1],[-0.02,-0.38,0.22,-1],[0.26,-0.22,0.19,1],
    [-0.16,-0.55,0.16,-1],[0.14,-0.55,0.15,1],[0.00,-0.12,0.17,1]
  ];
  for(var i=0;i<coils.length;i++){
    var C=coils[i];
    coil(mx+C[0]*w, my+C[1]*h, C[2]*w, i%2?'#f5d26a':'#c47a18', C[3]);
  }
}

function drawPops(o,lx,rel){
  var pr=profile('pops');
  var gnd=proj(lx,0,rel);
  var top=proj(lx,pr.h,rel);
  var w=pr.w*gnd.s,h=Math.max(10,gnd.y-top.y);
  drawShadow(gnd.x,gnd.y,gnd.s,pr.w*0.7);
  drawPrism(gnd.x,gnd.y,w,h*0.34,gnd.s,'#c0392b','#7a1c16','#e74c3c',{depth:0.4});
  // nugget lumps
  var lumps=[
    [0,-0.55,0.42,0.38],[ -0.28,-0.42,0.32,0.28],[0.26,-0.44,0.33,0.3],
    [-0.12,-0.72,0.28,0.24],[0.14,-0.7,0.26,0.22],[0.02,-0.32,0.3,0.24]
  ];
  for(var i=0;i<lumps.length;i++){
    var L=lumps[i];
    var nx=gnd.x+L[0]*w,ny=gnd.y+L[1]*h,nw=L[2]*w,nh=L[3]*h;
    var grd=ctx.createLinearGradient(nx-nw/2,ny,nx+nw/2,ny+nh/2);
    grd.addColorStop(0,'#ffe0a0');
    grd.addColorStop(0.55,'#e8a84a');
    grd.addColorStop(1,'#b56b1b');
    ctx.fillStyle=grd;
    ctx.beginPath();ctx.ellipse(nx,ny,nw/2,nh/2,0,0,6.2832);ctx.fill();
    ctx.strokeStyle='rgba(90,50,10,0.35)';
    ctx.lineWidth=1;ctx.stroke();
  }
}

function drawDrink(o,lx,rel){
  var pr=profile('drink');
  var gnd=proj(lx,0,rel);
  var top=proj(lx,pr.h,rel);
  var w=pr.w*gnd.s,h=Math.max(16,gnd.y-top.y);
  drawShadow(gnd.x,gnd.y,gnd.s,pr.w*0.62);
  // cup body, slightly tapered
  drawPrism(gnd.x,gnd.y,w,h*0.88,gnd.s,'#148c44','#0b4e28','#1aa050',{taper:0.22,depth:0.5});
  // yellow band
  var bandY=gnd.y-h*0.42,bandH=h*0.12;
  ctx.fillStyle='#fce404';
  ctx.beginPath();
  var tw=w*0.86,bw=w*0.78;
  ctx.moveTo(gnd.x-tw/2,bandY-bandH);
  ctx.lineTo(gnd.x+tw/2,bandY-bandH);
  ctx.lineTo(gnd.x+bw/2,bandY);
  ctx.lineTo(gnd.x-bw/2,bandY);
  ctx.closePath();ctx.fill();
  // lid
  var lidY=gnd.y-h*0.88;
  var dir=gnd.x<W/2?1:-1;
  var depth=Math.max(8,gnd.s*0.42),skew=dir*depth*0.78,lift=depth*0.58;
  ctx.fillStyle='#f4f0e6';
  ctx.beginPath();
  ctx.ellipse(gnd.x+skew*0.35,lidY-lift*0.25,w*0.5,Math.max(5,gnd.s*0.16),0,0,6.2832);
  ctx.fill();
  ctx.strokeStyle='rgba(20,30,20,0.3)';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#e8e0d0';
  ctx.beginPath();
  ctx.ellipse(gnd.x,lidY,w*0.48,Math.max(4,gnd.s*0.12),0,0,6.2832);
  ctx.fill();
  // straw
  var sx=gnd.x+w*0.12,sy=lidY,sh=h*0.28,sw=Math.max(3,w*0.07);
  ctx.fillStyle='#fce404';
  ctx.save();
  ctx.translate(sx,sy);
  ctx.rotate(-0.18);
  rr(-sw/2,-sh,sw,sh+4,sw*0.4);ctx.fill();
  ctx.fillStyle='#148c44';
  rr(-sw/2,-sh,sw,sh*0.35,sw*0.4);ctx.fill();
  ctx.restore();
}

function drawTrain(o,lx,rel){
  var pr=profile('train');
  var len=o.len||7.4;
  var n=4,carLen=len/n,gap=0.32;
  function quad(a,b,c,d,col){
    ctx.fillStyle=col;
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);
    ctx.closePath();ctx.fill();
  }
  for(var i=n-1;i>=0;i--){
    var z0=rel+i*carLen,z1=rel+(i+1)*carLen-gap;
    if(z1<1.2||z0>FAR)continue;
    if(z0<1.2)z0=1.2;
    var hw=pr.w*0.5,hh=pr.h;
    var l0=proj(lx-hw,0,z0),r0=proj(lx+hw,0,z0);
    var l1=proj(lx-hw,0,z1),r1=proj(lx+hw,0,z1);
    var l0t=proj(lx-hw,hh,z0),r0t=proj(lx+hw,hh,z0);
    var l1t=proj(lx-hw,hh,z1),r1t=proj(lx+hw,hh,z1);
    var g0=proj(lx,0,z0);
    var isEng=i===0;
    var front=isEng?'#148c44':'#fce404';
    var side=isEng?'#0b4e28':'#e0b800';
    var top=isEng?'#1aa050':'#fff6bf';
    drawShadow(g0.x,g0.y,g0.s,pr.w*0.6);
    quad(l0t,r0t,r1t,l1t,top);
    if(lx<=0)quad(r0t,r0,r1,r1t,side);
    else quad(l0t,l0,l1,l1t,side);
    quad(l0t,r0t,r0,l0,front);
    ctx.strokeStyle='rgba(20,30,20,0.35)';
    ctx.lineWidth=Math.max(1,g0.s*0.02);
    ctx.beginPath();ctx.moveTo(l0t.x,l0t.y);ctx.lineTo(r0t.x,r0t.y);ctx.lineTo(r0.x,r0.y);ctx.lineTo(l0.x,l0.y);ctx.closePath();ctx.stroke();
    // band on the front
    var by0=l0t.y+(l0.y-l0t.y)*0.48,by1=l0t.y+(l0.y-l0t.y)*0.60;
    ctx.fillStyle=isEng?'#fce404':'#148c44';
    ctx.beginPath();
    ctx.moveTo(l0.x+(l0t.x-l0.x)*0.52,by0);
    ctx.lineTo(r0.x+(r0t.x-r0.x)*0.52,by0);
    ctx.lineTo(r0.x+(r0t.x-r0.x)*0.40,by1);
    ctx.lineTo(l0.x+(l0t.x-l0.x)*0.40,by1);
    ctx.closePath();ctx.fill();
    if(isEng){
      ctx.fillStyle='rgba(20,40,30,0.35)';
      var wh=(l0.y-l0t.y)*0.22,ww=(r0t.x-l0t.x)*0.22;
      ctx.fillRect(l0t.x+ww*0.4,l0t.y+(l0.y-l0t.y)*0.18,ww,wh);
      ctx.fillRect(r0t.x-ww*1.4,l0t.y+(l0.y-l0t.y)*0.18,ww,wh);
    }else{
      // fries along the roof
      var midL=proj(lx-hw*0.7,hh,z0+carLen*0.2);
      var midR=proj(lx+hw*0.7,hh,z0+carLen*0.8);
      var nf=5;
      for(var k=0;k<nf;k++){
        var u=k/(nf-1);
        var fx=midL.x+(midR.x-midL.x)*u;
        var fy=midL.y+(midR.y-midL.y)*u;
        var fw=Math.max(2,g0.s*0.07),fh=g0.s*0.28+((k*11)%5)/5*g0.s*0.1;
        ctx.fillStyle=k%2?'#fce404':'#e8c94a';
        rr(fx-fw/2,fy-fh,fw,fh,fw*0.4);ctx.fill();
      }
    }
    // wheels at near corners
    ctx.fillStyle='#1d2b1f';
    ctx.beginPath();ctx.ellipse(l0.x+g0.s*0.08,l0.y-g0.s*0.04,g0.s*0.1,g0.s*0.07,0,0,6.2832);ctx.fill();
    ctx.beginPath();ctx.ellipse(r0.x-g0.s*0.08,r0.y-g0.s*0.04,g0.s*0.1,g0.s*0.07,0,0,6.2832);ctx.fill();
  }
}

/* -------- potato, drawn from behind -------- */
function drawPlayer(){
  var rel=NEAR;
  var feet=proj(player.x,player.y,rel);
  var gnd=proj(player.x,0,rel);
  var lanePx=LANE*feet.s;
  var cw=lanePx*CHAR;
  var ch=cw*1.48;
  var phase=camZ*2.55;
  var onGround=player.y<=0.02&&player.state!=='roll';
  var bounce=onGround&&player.state==='run'?(Math.sin(phase)*0.5+0.5)*0.04*ch:0;
  var sx=1,sy=1,rot=player.tilt;
  if(player.state==='run'&&onGround)rot+=Math.sin(phase)*0.05;
  if(player.state==='jump'){
    if(player.vy>0){sx=0.92;sy=1.08;rot=player.tilt-0.12}
    else{sx=0.97;sy=1.03;rot=player.tilt+0.08}
  }else if(player.state==='roll'){
    var u=1-player.rollT/0.52;
    rot=player.tilt+u*Math.PI*2;
    sx=1.12;sy=0.52;
  }else if(player.landT>0){
    var k=player.landT/0.16;
    sy=1-0.14*k;sx=1+0.07*k;
  }
  if(crashing){rot=player.tilt;sy=0.85;sx=1.08}
  drawShadow(gnd.x,gnd.y,gnd.s*(player.state==='roll'?0.7:1),0.55);
  ctx.save();
  ctx.translate(feet.x,feet.y-bounce);
  ctx.scale(sx,sy);
  if(player.state==='roll'||crashing){
    ctx.translate(0,-ch*0.52);
    ctx.rotate(rot);
    ctx.translate(0,ch*0.52);
  }else{
    ctx.rotate(rot);
  }
  drawPotatoBack(cw,ch,phase,player.state);
  ctx.restore();
}

function drawPotatoBack(w,h,phase,state){
  var bodyW=w*0.86,bodyH=h*0.76;
  var cx=0,cy=-h*0.54;
  var swing=0,step=0;
  if(state==='run'){swing=Math.sin(phase);step=Math.sin(phase)}
  else if(state==='jump'){swing=0.85;step=0.35}
  else if(state==='roll'){swing=0.2;step=0}
  var lw=Math.max(1.8,w*0.038);
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.lineWidth=lw;
  ctx.strokeStyle='#1d2b1f';

  function arm(dir,t,front){
    // t>0 means this arm is swinging back toward the camera
    // keep a wide outward angle so both arms stay visible at the sides
    var ang=dir*(0.78+(front?0.06:-0.04)) + t*0.22;
    var len=h*(front?0.40:0.33);
    var thick=w*(front?0.125:0.10);
    ctx.save();
    ctx.translate(dir*bodyW*0.48, cy-bodyH*0.10);
    ctx.rotate(ang);
    var grd=ctx.createLinearGradient(-thick,0,thick,len);
    grd.addColorStop(0,'#e0b75a');
    grd.addColorStop(1,'#b07e32');
    ctx.fillStyle=grd;
    ctx.beginPath();
    ctx.ellipse(0,len*0.44,thick,len*0.48,0,0,6.2832);
    ctx.fill();ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0,len*0.88,thick*0.82,thick*0.8,0,0,6.2832);
    ctx.fill();ctx.stroke();
    ctx.restore();
  }
  function shoe(dir,lift,towardCam){
    var x=dir*w*0.22;
    var y=-h*0.02-lift*h*0.16;
    ctx.save();
    ctx.translate(x,y);
    var kick=towardCam? (dir*0.08 - lift*1.15) : (dir*0.1 + lift*0.2);
    ctx.rotate(kick);
    var sw=w*0.32,sh=h*0.145;
    if(towardCam&&lift>0.2){
      ctx.fillStyle='#e6c888';
      ctx.beginPath();
      ctx.ellipse(0,sh*0.22,sw*0.54,sh*0.60,0,0,6.2832);
      ctx.fill();ctx.stroke();
      ctx.strokeStyle='rgba(90,55,20,0.4)';
      ctx.lineWidth=Math.max(1,lw*0.6);
      ctx.beginPath();ctx.ellipse(0,sh*0.22,sw*0.28,sh*0.28,0,0,6.2832);ctx.stroke();
      ctx.strokeStyle='#1d2b1f';ctx.lineWidth=lw;
    }
    ctx.fillStyle='#148c44';
    rr(-sw/2,-sh*0.9,sw,sh,sh*0.4);
    ctx.fill();ctx.stroke();
    ctx.fillStyle='#0b612e';
    rr(-sw*0.30,-sh*0.52,sw*0.60,sh*0.30,sh*0.12);
    ctx.fill();
    ctx.restore();
  }

  var leftBack=swing>0;

  // body — potato, no face
  ctx.beginPath();
  ctx.moveTo(cx, cy-bodyH*0.52);
  ctx.bezierCurveTo(cx+bodyW*0.56,cy-bodyH*0.50, cx+bodyW*0.54,cy+bodyH*0.15, cx+bodyW*0.40,cy+bodyH*0.48);
  ctx.bezierCurveTo(cx+bodyW*0.16,cy+bodyH*0.58, cx-bodyW*0.16,cy+bodyH*0.58, cx-bodyW*0.40,cy+bodyH*0.48);
  ctx.bezierCurveTo(cx-bodyW*0.54,cy+bodyH*0.15, cx-bodyW*0.56,cy-bodyH*0.50, cx,cy-bodyH*0.52);
  ctx.closePath();
  var grd=ctx.createLinearGradient(cx-bodyW*0.5,cy,cx+bodyW*0.5,cy+bodyH*0.2);
  grd.addColorStop(0,'#e0b75a');
  grd.addColorStop(0.45,'#d0a44c');
  grd.addColorStop(1,'#b07e32');
  ctx.fillStyle=grd;
  ctx.fill();ctx.stroke();

  // pale spots on the back
  ctx.fillStyle='rgba(236,214,160,0.8)';
  var spots=[[-0.14,-0.08,0.11,0.085],[0.15,0.02,0.09,0.07],[-0.02,0.18,0.10,0.075],[0.08,-0.20,0.07,0.055],[-0.20,0.10,0.07,0.055],[0.20,-0.12,0.06,0.05]];
  for(var i=0;i<spots.length;i++){
    var s=spots[i];
    ctx.beginPath();
    ctx.ellipse(cx+s[0]*bodyW, cy+s[1]*bodyH, s[2]*bodyW, s[3]*bodyH, 0.3, 0, 6.2832);
    ctx.fill();
  }

  // curly black hair on the crown
  var topY=cy-bodyH*0.50;
  ctx.strokeStyle='#1d2b1f';
  ctx.lineWidth=Math.max(2.5,w*0.068);
  ctx.lineCap='round';
  var curls=[
    {x:-w*0.20,s:-1,h:0.15},{x:-w*0.07,s:-1,h:0.17},{x:w*0.07,s:1,h:0.17},{x:w*0.20,s:1,h:0.15}
  ];
  for(var c=0;c<curls.length;c++){
    var u=curls[c];
    ctx.beginPath();
    ctx.moveTo(u.x, topY+h*0.02);
    ctx.bezierCurveTo(u.x+u.s*w*0.01, topY-h*u.h*0.55, u.x+u.s*w*0.13, topY-h*u.h, u.x+u.s*w*0.13, topY-h*u.h*0.45);
    ctx.bezierCurveTo(u.x+u.s*w*0.13, topY-h*u.h*0.15, u.x+u.s*w*0.02, topY-h*u.h*0.22, u.x+u.s*w*0.07, topY-h*u.h*0.48);
    ctx.stroke();
  }
  ctx.lineWidth=lw;
  ctx.strokeStyle='#1d2b1f';

  // both arms after the body so they stay visible at the sides
  arm(-1, swing, leftBack);
  arm( 1,-swing, !leftBack);

  // both shoes once: lifted foot shows the sole toward camera
  var leftLift=state==='jump'?0.25:Math.max(0,-step);
  var rightLift=state==='jump'?0.45:Math.max(0,step);
  shoe(-1,leftLift,leftLift>0.35);
  shoe(1,rightLift,rightLift>0.35);
}

/* -------- frame -------- */
function draw(){
  if(!W)return;
  ctx.clearRect(0,0,W,H);
  drawSky();
  drawRoad();
  var bld=collectBuildings();
  var list=objs.concat(bld).sort(function(a,b){return b.z-a.z});
  var pz=camZ+NEAR;
  var drawnP=false;
  for(var i=0;i<list.length;i++){
    if(!drawnP&&list[i].z<pz){drawPlayer();drawnP=true}
    if(list[i].typ==='bldg')drawBuilding(list[i]);
    else drawObj(list[i]);
  }
  if(!drawnP)drawPlayer();
  pops.forEach(function(p){
    ctx.globalAlpha=Math.max(p.a,0);
    ctx.fillStyle=p.c;ctx.font='bold 20px sans-serif';ctx.textAlign='center';
    ctx.fillText(p.s,p.x,p.y);ctx.globalAlpha=1;
  });
}

function loop(ts){
  if(!run)return;
  var dt=Math.min((ts-last)/1000,.05);last=ts;
  if(!frozen)update(dt);
  draw();
  if(run)raf=requestAnimationFrame(loop);
}

function start(){
  resetWorld();run=true;ov.hidden=true;ov.classList.remove('runstart');
  if(how)how.hidden=true;
  last=performance.now();
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(loop);
}

function end(){
  run=false;crashing=false;cancelAnimationFrame(raf);draw();
  setScore(Math.floor(dist)+coins);
  var nb=score>best;if(nb){best=score;G.setBest(KEY,best);elBest.textContent=best}
  if(dist>bestDist){bestDist=dist;G.setBest(KEYD,Math.floor(bestDist))}
  ov.classList.remove('runstart');
  if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;
  ovT.textContent='撞到了';
  ovS.innerHTML='你跑了 <span class="big">'+Math.floor(dist)+'</span> 公尺<br>分數 <span class="big">'+score+'</span><br>'+(nb?'新的最高分':'最高分 '+best)+G.pickHtml();
  go.textContent='再玩一次';ov.hidden=false;
}

go.addEventListener('click',start);
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&run&&!crashing){
    run=false;cancelAnimationFrame(raf);
    ov.classList.remove('runstart');if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;
    ovT.textContent='暫停中';ovS.textContent='回到頁面後再開始';
    go.textContent='重新開始';ov.hidden=false;
  }
});
window.addEventListener('resize',size);
if(window.visualViewport)window.visualViewport.addEventListener('resize',size);
// test hook for screenshots
window.PCRun={
  start:start,
  jump:jump,roll:roll,shift:shift,
  freeze:function(on){frozen=!!on;if(frozen)draw()},
  setLane:function(n){player.lane=Math.max(-1,Math.min(1,n));player.x=laneX(player.lane)},
  setCam:function(z){camZ=z;dist=camZ*1.15;elDist.textContent=String(Math.floor(dist));setScore(Math.floor(dist)+coins)},
  setState:function(s){
    player.state=s;player.tilt=0;player.landT=0;
    if(s==='roll'){player.rollT=0.28;player.y=0;player.vy=0}
    else if(s==='jump'){player.vy=1.2;player.y=1.2}
    else{player.y=0;player.vy=0;player.rollT=0}
  },
  info:function(){return {camZ:camZ,dist:dist,lane:player.lane,state:player.state,y:player.y,W:W,H:H,objs:objs.map(function(o){return {typ:o.typ,kind:o.kind,lane:o.lane,z:o.z,rel:o.z-camZ}})}}
};
size();requestAnimationFrame(size);
})();
