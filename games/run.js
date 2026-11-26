(function(){
var d=document,G=window.PCGames;
var cv=d.getElementById('stage'),ctx=cv.getContext('2d');
var wrap=d.getElementById('wrap');
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go'),how=d.getElementById('how'),ovlogo=d.getElementById('ovlogo'),hud=d.getElementById('hud'),fine=d.getElementById('fine');
var elScore=d.getElementById('score'),elDist=d.getElementById('dist'),elBest=d.getElementById('best');
var KEY='pcGameRunBest',KEYD='pcGameRunBestDist';
var W=0,H=0,dpr=1,focal=1,horizon=0,camH=1.8;
var LANE=1.22,NEAR=5.7,FAR=78,ROAD=1.52;
var CHAR=0.50; // width vs nearest lane; scales with the zoomed track
var FEET=0.84; // player a little lower so the track fills more of the phone
var HORIZON=0.13; // just a sliver of clean sky above the vanishing point
var PERSP=0.34; // vertical falloff
var PERSP_X=0.10; // shallower width falloff so mid-ground lanes stay edge-to-edge
var run=false,frozen=false,crashing=false,crashT=0,last=0,raf=0,camZ=0,speed=0,dist=0,score=0,coins=0,pops=[];
var best=G.getBest(KEY),bestDist=G.getBest(KEYD);
elBest.textContent=best;elDist.textContent=0;
var player={lane:0,x:0,y:0,vy:0,state:'run',rollT:0,tilt:0,landT:0};
var objs=[],nextZ=0,flavI=0;
var IM={
  onion:img('img/run/jar-onion.webp'),
  bbq:img('img/run/jar-bbq.webp'),
  cheese:img('img/run/jar-cheese.webp'),
  chili:img('img/run/jar-chili.webp'),
  coin:img('img/run/coin.webp'),
  run:[img('img/run/potato-run0.webp'),img('img/run/potato-run1.webp'),img('img/run/potato-run2.webp'),img('img/run/potato-run3.webp')],
  jump:[img('img/run/potato-jump0.webp'),img('img/run/potato-jump1.webp')],
  roll:[img('img/run/potato-roll0.webp'),img('img/run/potato-roll1.webp')],
  charRun:img('img/run/potato-run0.webp'),
  charJump:img('img/run/potato-jump0.webp'),
  charSlide:img('img/run/potato-roll0.webp'),
  fries:img('img/run/obs-arch.webp'),
  loopy:img('img/run/obs-loopy.webp'),
  pops:img('img/run/obs-pops.webp'),
  drink:img('img/run/obs-drink.webp'),
  train:img('img/run/obs-train.webp'),
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
  horizon=H*HORIZON;
  // 3 lanes fill left–right from the player's feet through mid-ground
  var fill=1.18;
  focal=W*fill*NEAR/(2*LANE*ROAD);
  camH=(H*FEET-horizon)*NEAR/focal;
  draw();
}

function depthZ(relZ,k){
  var z=Math.max(relZ,0.55);
  if(z<=NEAR)return z;
  return NEAR+(z-NEAR)*(k==null?PERSP:k);
}
function proj(wx,wy,relZ){
  var zy=depthZ(relZ,PERSP);
  var zx=depthZ(relZ,PERSP_X);
  var sy=focal/zy,sx=focal/zx;
  return {x:W/2+wx*sx,y:horizon+(camH-wy)*sy,s:sx};
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
function supportY(){
  var fl=0,pbz=camZ+NEAR,px=player.x;
  for(var i=0;i<objs.length;i++){
    var o=objs[i];
    if(o.typ!=='obs'||o.kind!=='train')continue;
    var zLen=o.len||10.4;
    if(pbz<o.z+0.05||pbz>o.z+zLen-0.12)continue;
    if(Math.abs(laneX(o.lane)-px)>LANE*0.50)continue;
    var h=profile('train').h;
    if(player.y>=h-0.22)fl=Math.max(fl,h);
  }
  return fl;
}
function jump(){
  if(player.state==='roll')return;
  var fl=supportY();
  if(player.y>fl+0.12)return;
  player.state='jump';player.vy=10.0;player.y=fl+0.02;player.landT=0;
}
function roll(){
  var fl=supportY();
  if(player.state==='jump'&&player.y>fl+0.3)return;
  player.state='roll';player.rollT=0.82;player.vy=0;player.y=fl;
}

/* -------- spawn -------- */
function resetWorld(){
  objs=[];pops=[];camZ=0;speed=19;dist=0;coins=0;setScore(0);
  player.lane=0;player.x=0;player.y=0;player.vy=0;player.state='run';player.rollT=0;player.tilt=0;player.landT=0;
  crashing=false;crashT=0;
  var base=camZ+NEAR;
  nextZ=base+72;
  seedChain(base+8,0,5,0.95,0.45,0.45);
  seedChain(base+12,1,4,0.9,0.45,0.45);
  place(base+18,-1,'loopy');
  seedChain(base+18,-1,3,0.85,0.95,0.95);
  // jumpable train on the right, coin ramp leading onto the roof
  place(base+24,1,'train');
  seedChain(base+18.5,1,7,0.9,0.45,1.52);
  seedChain(base+25.2,1,6,1.5,1.52,1.52);
  place(base+28,0,'pops');
  place(base+40,-1,'drink');
  seedChain(base+40,0,5,0.95,0.45,0.45);
  place(base+48,0,'fries');
  seedChain(base+48,0,3,0.8,0.45,0.45);
  place(base+58,-1,'train');
  seedChain(base+53,-1,6,0.9,0.45,1.52);
  seedChain(base+59,-1,5,1.5,1.52,1.52);
  place(base+72,1,'drink');
}

function seedCoins(z,lane){
  seedChain(z,lane,1,1,0.45,0.45);
}
function seedChain(z,lane,n,gap,y0,y1){
  n=n||5;gap=gap==null?0.95:gap;
  y0=y0==null?0.45:y0;y1=y1==null?y0:y1;
  for(var i=0;i<n;i++){
    var t=n===1?0:i/(n-1);
    objs.push({typ:'coin',kind:FLAVS[flavI++%FLAVS.length],lane:lane,z:z+i*gap,hit:0,wy:y0+(y1-y0)*t});
  }
}

function spawnRow(){
  var z=nextZ;
  var gap=Math.max(20,speed*0.95);
  nextZ=z+gap;
  var r=Math.random();
  var easy=dist<55;
  if(easy){
    if(r<.22){
      var lane=(Math.random()*3|0)-1;
      seedChain(z,lane,5,0.9,0.45,0.45);
      if(Math.random()<.45)seedChain(z+gap*0.35,(lane+1+Math.random()*2|0)%3-1,4,0.9,0.45,0.45);
    }else if(r<.44){
      place(z,(Math.random()*3|0)-1, Math.random()<.5?'loopy':'pops');
    }else if(r<.66){
      place(z,(Math.random()*3|0)-1,'fries');
      seedChain(z,((Math.random()*3|0)-1),3,0.85,0.45,0.45);
    }else if(r<.82){
      place(z,(Math.random()*3|0)-1,'drink');
    }else{
      var L=(Math.random()*3|0)-1;
      place(z,L,'train');
      seedChain(z-5,L,6,0.9,0.45,1.52);
      seedChain(z+1.2,L,5,1.5,1.52,1.52);
      nextZ=z+10.4+Math.max(16,gap*0.75);
    }
    return;
  }
  if(r<.2){
    var L=(Math.random()*3|0)-1;
    place(z,L,'train');
    seedChain(z-5.2,L,6,0.9,0.45,1.52);
    seedChain(z+1.2,L,5,1.55,1.52,1.52);
    if(Math.random()<.45)place(z, L===0?1:-1, 'drink');
    nextZ=z+10.4+Math.max(16,gap*0.75);
  }else if(r<.34){
    var open=(Math.random()*3|0)-1;
    for(var L=-1;L<=1;L++)if(L!==open)place(z,L,'drink');
    seedChain(z,open,5,0.9,0.45,0.45);
  }else if(r<.48){
    var L=(Math.random()*3|0)-1;
    place(z,L,'fries');
    seedChain(z,L,3,0.85,0.45,0.45);
    if(Math.random()<.5)place(z,((L+2)%3)-1,'loopy');
  }else if(r<.64){
    var L=(Math.random()*3|0)-1;
    place(z,L,'loopy');
    seedChain(z,L,3,0.85,0.95,0.95);
    if(Math.random()<.4)place(z,((L+2)%3)-1,'pops');
  }else if(r<.78){
    var L=(Math.random()*3|0)-1;
    place(z,L,'pops');
    if(Math.random()<.5)seedChain(z,((L+1)%3)-1,4,0.9,0.45,0.45);
  }else{
    var L=(Math.random()*3|0)-1;
    place(z,L, Math.random()<.5?'drink':'fries');
    seedChain(z+gap*0.35, -L||(Math.random()<.5?1:-1), 5, 0.9, 0.45, 0.45);
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
  if(kind==='drink')return {shape:'tall',h:2.85,w:1.08};
  if(kind==='fries')return {shape:'arch',h:2.45,w:1.20,gap:0.82};
  if(kind==='train')return {shape:'platform',h:1.08,w:1.16};
  return {shape:'low',h:0.8,w:1.0};
}

function playerBox(){
  var body=LANE*CHAR;
  var h=player.state==='roll'?0.42:0.95;
  return {x:player.x,w:body*0.62,y:player.y,h:h,z:camZ+NEAR+1.15};
}

function collide(o){
  var pb=playerBox();
  var rel=o.z-pb.z;
  var zLen=o.len||0.55;
  var sweep=Math.max(1.4,speed*0.10);
  if(rel>sweep||rel<-zLen)return false;
  var ox=laneX(o.lane);
  if(Math.abs(ox-pb.x)>LANE*0.48)return false;
  if(o.typ==='coin'){
    var cy=o.wy!=null?o.wy:(o._above?0.95:0.45);
    if(cy>0.8&&player.y<cy-0.7)return false;
    return pb.y+pb.h>cy-0.25 && pb.y<cy+0.4;
  }
  var p=profile(o.kind);
  if(p.shape==='arch'){
    return pb.y+pb.h>p.gap;
  }
  if(p.shape==='platform'){
    return pb.y < p.h-0.08;
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
  speed=Math.min(36,19+17*(1-Math.exp(-Math.max(0,dist)/300)));
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
  var fl=supportY();
  if(player.state==='jump'||player.y>fl){
    player.vy-=20*dt;
    player.y+=player.vy*dt;
    if(player.y<=fl){
      player.y=fl;player.vy=0;
      if(player.state==='jump'){player.state='run';player.landT=0.16}
    }else if(player.state==='run'&&player.y>fl+0.15){
      player.state='jump';
    }
  }
  if(player.landT>0)player.landT=Math.max(0,player.landT-dt);

  if(camZ+FAR>nextZ)spawnRow();

  var pbz=camZ+NEAR;
  for(var i=objs.length-1;i>=0;i--){
    var o=objs[i];
    if(o.z+(o.len||0)<camZ+1.2){objs.splice(i,1);continue}
    if(o.typ==='coin'&&o.wy==null){
      o._above=false;
      for(var j=0;j<objs.length;j++){
        var q=objs[j];
        if(q.typ!=='obs'||q.lane!==o.lane)continue;
        if((q.kind==='loopy'||q.kind==='pops')&&Math.abs(q.z-o.z)<0.8){o._above=true;o.wy=0.95}
        if(q.kind==='train'&&o.z>=q.z-0.2&&o.z<=q.z+(q.len||10.4)){o.wy=1.52}
      }
    }
    if(!o.hit&&collide(o)){
      if(o.typ==='coin'){
        o.hit=1;coins+=15;setScore(Math.floor(dist)+coins);
        var prj=proj(laneX(o.lane),o.wy!=null?o.wy:0.45,o.z-camZ);
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
var ARCH_GAP=15.5, GATE_W=5.25, GATE_H=4.15, BLDG_GAP=16.5;

function drawSky(){
  // a little clean sky above the horizon — no hills, no roadside scenery
  var g=ctx.createLinearGradient(0,0,0,horizon);
  g.addColorStop(0,'#6ec4e6');
  g.addColorStop(0.55,'#b7e4f4');
  g.addColorStop(1,'#e8f4fa');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,horizon+1);
  // below the horizon, fill with the same pale sky so any sliver at the
  // far sides is clean sky, not a grassy landscape
  ctx.fillStyle='#e8f4fa';
  ctx.fillRect(0,horizon,W,H-horizon+2);
}

function drawRoad(){
  var segs=32,rh=roadHalf(),DRAW_FAR=FAR*2.2,bed=rh+0.06;
  function trap(x0,x1,zA,zB){
    var a=proj(x0,0,zA),b=proj(x1,0,zA),c=proj(x1,0,zB),d=proj(x0,0,zB);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();
  }
  var halfLane=LANE*0.49;
  for(var i=segs;i>=0;i--){
    var z0=NEAR+(DRAW_FAR-NEAR)*(i+1)/segs;
    var z1=NEAR+(DRAW_FAR-NEAR)*i/segs;
    if(z0>FAR+8)continue;
    // dark grooves between the three tracks — no grassy shoulder
    ctx.fillStyle=(i%2===0)?'#6a5818':'#5a4a14';
    trap(-bed,bed,z0,z1);ctx.fill();
    var stripe=i%2===0;
    for(var L=-1;L<=1;L++){
      var cx=laneX(L);
      ctx.fillStyle=stripe?'#e8c94a':'#d6b536';
      trap(cx-halfLane,cx+halfLane,z0,z1);ctx.fill();
    }
  }
  // let the track end a little short of the horizon instead of a grassy vanishing wedge
  var farZ=Math.min(DRAW_FAR,FAR+4),Lp=proj(-bed,0,farZ),Rp=proj(bed,0,farZ);
  if(Lp.y>horizon+2){
    ctx.fillStyle='#5a4a14';
    ctx.beginPath();ctx.moveTo(Lp.x,Lp.y);ctx.lineTo(Rp.x,Rp.y);
    ctx.lineTo(W/2,horizon+2);ctx.closePath();ctx.fill();
  }
  var yN=proj(0,0,NEAR).y;
  if(yN<H){
    var zBot=Math.max(0.55,camH*focal/Math.max(8,H-horizon));
    for(var L=-1;L<=1;L++){
      var cx=laneX(L);
      var Lft=proj(cx-halfLane,0,NEAR),Rgt=proj(cx+halfLane,0,NEAR);
      var Lb=proj(cx-halfLane,0,zBot),Rb=proj(cx+halfLane,0,zBot);
      ctx.fillStyle='#e8c94a';
      ctx.beginPath();
      ctx.moveTo(Lft.x,yN);ctx.lineTo(Rgt.x,yN);
      ctx.lineTo(Rb.x,H+2);ctx.lineTo(Lb.x,H+2);
      ctx.closePath();ctx.fill();
    }
  }
}

function drawRails(rh){
  var h=1.25,thick=0.28,segs=22,DRAW_FAR=FAR*1.8;
  function quad(a,b,c,d,col){
    ctx.fillStyle=col;
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);
    ctx.closePath();ctx.fill();
  }
  for(var side=-1;side<=1;side+=2){
    var x0=side*(rh+thick*0.15),x1=side*(rh+thick);
    for(var i=segs;i>=0;i--){
      var z0=NEAR+(DRAW_FAR-NEAR)*(i+1)/segs;
      var z1=NEAR+(DRAW_FAR-NEAR)*i/segs;
      if(z1<NEAR)z1=NEAR;
      var i0=proj(x0,0,z0),i1=proj(x0,0,z1);
      var o0=proj(x1,0,z0),o1=proj(x1,0,z1);
      var i0t=proj(x0,h,z0),i1t=proj(x0,h,z1);
      var o0t=proj(x1,h,z0),o1t=proj(x1,h,z1);
      quad(o0t,o1t,o1,o0,'#0b4e28');
      quad(i0t,i1t,o1t,o0t,'#fce404');
      quad(i0t,i1t,i1,i0,i%2?'#148c44':'#0f7a38');
    }
  }
}

function drawBuildings(){
  var z0=Math.floor((camZ-6)/BLDG_GAP)*BLDG_GAP;
  for(var z=z0;z<camZ+FAR;z+=BLDG_GAP){
    var rel=z-camZ;
    if(rel<6||rel>FAR-2)continue;
    var fade=rel>FAR-10?Math.max(0,(FAR-rel)/10):1;
    fade*=Math.min(1,(rel-6)/5);
    var idx=Math.floor(z/BLDG_GAP);
    var side=(idx%2===0)?-1:1;
    var x=side*(roadHalf()+3.15+(idx%3)*0.18);
    var im=(idx%2===0)?IM.bldgA:IM.bldgB;
    if(!ready(im))continue;
    var gnd=proj(x,0,rel);
    var wh=2.55+(idx%3)*0.2;
    var top=proj(x,wh,rel);
    var ww=wh*(im.naturalWidth/im.naturalHeight);
    var h=Math.max(6,gnd.y-top.y);
    var w=ww*gnd.s;
    ctx.save();ctx.globalAlpha=fade*0.92;
    ctx.drawImage(im,gnd.x-w/2,gnd.y-h,w,h);
    ctx.restore();
  }
}

function drawGate(z){
  var rel=z-camZ;
  if(rel<NEAR*0.92||rel>FAR)return;
  if(!ready(IM.gate))return;
  var fade=rel>FAR-8?Math.max(0,(FAR-rel)/8):1;
  var gnd=proj(0,0,rel);
  var top=proj(0,GATE_H,rel);
  var w=GATE_W*gnd.s;
  var h=Math.max(8,gnd.y-top.y);
  ctx.save();ctx.globalAlpha=fade;
  ctx.drawImage(IM.gate,gnd.x-w/2,gnd.y-h,w,h);
  ctx.restore();
}

/* -------- obstacles -------- */
function blitSprite(im,lx,rel,worldW,worldH,opts){
  opts=opts||{};
  if(!ready(im))return false;
  var baseY=opts.y||0;
  var gnd=proj(lx,baseY,rel);
  var top=proj(lx,baseY+worldH,rel);
  var w=worldW*gnd.s;
  var h=Math.max(4,gnd.y-top.y);
  if(!opts.noshadow)drawShadow(gnd.x,gnd.y,gnd.s,worldW*0.48);
  ctx.drawImage(im,gnd.x-w/2,gnd.y-h,w,h);
  return true;
}

function drawObj(o){
  var rel=o.z-camZ;
  if(rel<1||rel>FAR)return;
  var fade=rel>FAR-8?Math.max(0,(FAR-rel)/8):1;
  ctx.save();ctx.globalAlpha=fade;
  var lx=laneX(o.lane);
  if(o.typ==='coin'){
    var wy=o.wy!=null?o.wy:(o._above?0.95:0.45);
    var p=proj(lx,wy,rel);
    var sz=Math.max(16,0.52*p.s);
    var im=ready(IM[o.kind])?IM[o.kind]:(ready(IM.coin)?IM.coin:null);
    if(im){
      ctx.save();
      ctx.globalAlpha=fade*0.5;
      ctx.fillStyle='#ffe27a';
      ctx.beginPath();ctx.ellipse(p.x,p.y+sz*0.08,sz*0.38,sz*0.16,0,0,6.2832);ctx.fill();
      ctx.restore();
      ctx.drawImage(im,p.x-sz/2,p.y-sz/2,sz,sz);
    }else{
      ctx.fillStyle='#fce404';
      ctx.beginPath();ctx.arc(p.x,p.y,sz*0.42,0,6.2832);ctx.fill();
    }
    ctx.restore();return;
  }
  if(o.kind==='train'){drawTrain(o,lx,rel);ctx.restore();return}
  var pr=profile(o.kind);
  var im=IM[o.kind];
  if(!blitSprite(im,lx,rel,pr.w,pr.h)){
    // fallback box if a sprite is still loading
    var gnd=proj(lx,0,rel),top=proj(lx,pr.h,rel);
    drawPrism(gnd.x,gnd.y,pr.w*gnd.s,Math.max(8,gnd.y-top.y),gnd.s,'#148c44','#0b4e28','#fce404',{depth:0.4});
  }
  ctx.restore();
}

function drawTrain(o,lx,rel){
  var pr=profile('train');
  var len=o.len||10.4;
  var n=3,carLen=len/n,gap=0.22;
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
    var front=i===0?'#148c44':'#fce404';
    var side=i===0?'#0b4e28':'#c9a214';
    var top=i===0?'#1aa050':'#fff3a8';
    drawShadow(g0.x,g0.y,g0.s,pr.w*0.62);
    // walkable roof
    quad(l0t,r0t,r1t,l1t,top);
    ctx.strokeStyle='rgba(80,60,10,0.35)';
    ctx.lineWidth=Math.max(1,g0.s*0.02);
    ctx.beginPath();ctx.moveTo(l0t.x,l0t.y);ctx.lineTo(r0t.x,r0t.y);ctx.lineTo(r1t.x,r1t.y);ctx.lineTo(l1t.x,l1t.y);ctx.closePath();ctx.stroke();
    if(lx<=0)quad(r0t,r0,r1,r1t,side);
    else quad(l0t,l0,l1,l1t,side);
    quad(l0t,r0t,r0,l0,front);
    ctx.strokeStyle='rgba(20,30,20,0.35)';
    ctx.beginPath();ctx.moveTo(l0t.x,l0t.y);ctx.lineTo(r0t.x,r0t.y);ctx.lineTo(r0.x,r0.y);ctx.lineTo(l0.x,l0.y);ctx.closePath();ctx.stroke();
    // brand band
    var by0=l0t.y+(l0.y-l0t.y)*0.48,by1=l0t.y+(l0.y-l0t.y)*0.62;
    ctx.fillStyle=i===0?'#fce404':'#148c44';
    ctx.beginPath();
    ctx.moveTo(l0.x+(l0t.x-l0.x)*0.52,by0);
    ctx.lineTo(r0.x+(r0t.x-r0.x)*0.52,by0);
    ctx.lineTo(r0.x+(r0t.x-r0.x)*0.40,by1);
    ctx.lineTo(l0.x+(l0t.x-l0.x)*0.40,by1);
    ctx.closePath();ctx.fill();
    // wheels, static
    ctx.fillStyle='#1d2b1f';
    ctx.beginPath();ctx.ellipse(l0.x+g0.s*0.08,l0.y-g0.s*0.04,g0.s*0.1,g0.s*0.07,0,0,6.2832);ctx.fill();
    ctx.beginPath();ctx.ellipse(r0.x-g0.s*0.08,r0.y-g0.s*0.04,g0.s*0.1,g0.s*0.07,0,0,6.2832);ctx.fill();
  }
  // clay crate face at the near end
  blitSprite(IM.train,lx,rel,pr.w*1.02,pr.h*1.08,{noshadow:true});
}

/* -------- potato, drawn from behind with Q clay sprites -------- */
function charFrame(){
  if(player.state==='jump'){
    var fl=supportY();
    return (player.vy<=1.2||player.y>fl+1.05)?(IM.jump[1]||IM.jump[0]):(IM.jump[0]||IM.charJump);
  }
  if(player.state==='roll'){
    var frames=IM.roll||[];
    if(!frames.length)return IM.charSlide;
    var t=1-Math.max(0,player.rollT)/0.82;
    return frames[(Math.floor(t*frames.length*2)+ (t>0.5?1:0))%frames.length]||frames[0];
  }
  var frames=IM.run||[];
  if(!frames.length)return IM.charRun;
  return frames[Math.floor(Math.abs(camZ)*0.48)%frames.length]||frames[0];
}

function drawPlayer(){
  var gnd=proj(player.x,supportY(),NEAR);
  var feet=proj(player.x,player.y,NEAR);
  var cw=LANE*gnd.s*CHAR;
  var im=charFrame();
  if(!ready(im))return;
  var ch=cw*(im.naturalHeight/im.naturalWidth);
  var bounce=0;
  if(player.state==='run')bounce=Math.abs(Math.sin(camZ*1.55))*gnd.s*0.028;
  var sx=1,sy=1,rot=player.tilt*0.35;
  if(player.landT>0&&player.state==='run'){
    var k=player.landT/0.16;
    sy=1-0.08*k;sx=1+0.05*k;
  }
  if(crashing){rot=player.tilt;sy=0.9;sx=1.06}
  drawShadow(gnd.x,gnd.y,gnd.s*(player.state==='roll'?0.7:1),0.55);
  ctx.save();
  ctx.translate(feet.x,feet.y-bounce);
  ctx.rotate(rot);
  ctx.scale(sx,sy);
  ctx.drawImage(im,-cw/2,-ch,cw,ch);
  ctx.restore();
}

/* -------- frame -------- */
function draw(){
  if(!W)return;
  ctx.clearRect(0,0,W,H);
  drawSky();
  drawRoad();
  var list=objs.slice().sort(function(a,b){return b.z-a.z});
  var pz=camZ+NEAR;
  var drawnP=false;
  for(var i=0;i<list.length;i++){
    if(!drawnP&&list[i].z<pz){drawPlayer();drawnP=true}
    drawObj(list[i]);
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
  if(how)how.hidden=true;if(fine)fine.hidden=true;
  if(hud)hud.hidden=false;
  d.body.classList.add('playing');
  last=performance.now();
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(loop);
  size();
}

function end(){
  run=false;crashing=false;cancelAnimationFrame(raf);draw();
  setScore(Math.floor(dist)+coins);
  var nb=score>best;if(nb){best=score;G.setBest(KEY,best);elBest.textContent=best}
  if(dist>bestDist){bestDist=dist;G.setBest(KEYD,Math.floor(bestDist))}
  ov.classList.remove('runstart');
  if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
  if(hud)hud.hidden=true;
  d.body.classList.remove('playing');
  ovT.textContent='撞到了';
  ovS.innerHTML='你跑了 <span class="big">'+Math.floor(dist)+'</span> 公尺<br>分數 <span class="big">'+score+'</span><br>'+(nb?'新的最高分':'最高分 '+best)+G.pickHtml();
  go.textContent='再玩一次';ov.hidden=false;
}

go.addEventListener('click',start);
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&run&&!crashing){
    run=false;cancelAnimationFrame(raf);
    ov.classList.remove('runstart');if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
    if(hud)hud.hidden=true;
    d.body.classList.remove('playing');
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
    if(s==='roll'){player.rollT=0.7;player.y=0;player.vy=0}
    else if(s==='jump'){player.vy=2.2;player.y=1.55}
    else{player.y=0;player.vy=0;player.rollT=0}
  },
  info:function(){return {camZ:camZ,dist:dist,speed:speed,lane:player.lane,state:player.state,y:player.y,W:W,H:H,objs:objs.map(function(o){return {typ:o.typ,kind:o.kind,lane:o.lane,z:o.z,rel:o.z-camZ}})}}
};
size();requestAnimationFrame(size);
})();
