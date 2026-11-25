(function(){
var d=document,G=window.PCGames;
var cv=d.getElementById('stage'),ctx=cv.getContext('2d');
var wrap=d.getElementById('wrap');
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go'),how=d.getElementById('how'),ovlogo=d.getElementById('ovlogo');
var elScore=d.getElementById('score'),elDist=d.getElementById('dist'),elBest=d.getElementById('best');
var KEY='pcGameRunBest',KEYD='pcGameRunBestDist';
var W=0,H=0,dpr=1,focal=1,horizon=0,camH=1.8;
var LANE=1.22,NEAR=8.2,FAR=78;
var run=false,crashing=false,crashT=0,last=0,raf=0,camZ=0,speed=0,dist=0,score=0,coins=0,pops=[];
var best=G.getBest(KEY),bestDist=G.getBest(KEYD);
elBest.textContent=best;elDist.textContent=0;
var player={lane:0,x:0,y:0,vy:0,state:'run',rollT:0,tilt:0,landT:0};
var objs=[],nextZ=0,flavI=0;
var IM={
  mascot:img('img/mascot-run.png'),
  fries:img('img/fries.png'),
  loopy:img('img/loopy.png'),
  pops:img('img/pops.png'),
  drink:img('img/drink.png'),
  onion:img('img/onion.png'),
  bbq:img('img/bbq.png'),
  cheese:img('img/cheese.png'),
  chili:img('img/chili.png'),
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
  horizon=H*0.34;
  focal=W*1.55;
  camH=(H*0.86-horizon)*NEAR/focal;
  draw();
}

function proj(wx,wy,relZ){
  var z=Math.max(relZ,0.55);
  var s=focal/z;
  return {x:W/2+wx*s,y:horizon+(camH-wy)*s,s:s};
}

function laneX(lane){return lane*LANE}

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
  crashing=false;crashT=0;nextZ=camZ+NEAR+52;
  // first stretch: coins, then easy obstacles
  seedCoins(camZ+NEAR+12,0);
  seedCoins(camZ+NEAR+16,1);
  seedCoins(camZ+NEAR+22,-1);
  seedCoins(camZ+NEAR+28,0);
  seedCoins(camZ+NEAR+34,1);
  seedCoins(camZ+NEAR+40,-1);
}

function seedCoins(z,lane){
  objs.push({typ:'coin',kind:FLAVS[flavI++%FLAVS.length],lane:lane,z:z,hit:0});
}

function spawnRow(){
  var z=nextZ;
  var gap=Math.max(16,speed*0.62);
  nextZ=z+gap;
  var r=Math.random();
  var easy=dist<45;
  if(easy){
    if(r<.7){
      var lane=(Math.random()*3|0)-1;
      seedCoins(z,lane);
      if(Math.random()<.45)seedCoins(z+gap*0.35,(lane+1+Math.random()*2|0)%3-1);
    }else{
      place(z, (Math.random()*3|0)-1, Math.random()<.5?'loopy':'pops');
    }
    return;
  }
  if(r<.16){
    // two tall, one gap
    var open=(Math.random()*3|0)-1;
    for(var L=-1;L<=1;L++)if(L!==open)place(z,L,'drink');
    seedCoins(z,open);
  }else if(r<.32){
    var L=(Math.random()*3|0)-1;
    place(z,L,'fries');
    seedCoins(z,L); // under the arch
    if(Math.random()<.5)place(z,((L+2)%3)-1,'loopy');
  }else if(r<.5){
    var L=(Math.random()*3|0)-1;
    place(z,L,'loopy');
    seedCoins(z,L); // jump to collect
    if(Math.random()<.4)place(z,((L+2)%3)-1,'pops');
  }else if(r<.68){
    var L=(Math.random()*3|0)-1;
    place(z,L,'pops');
    if(Math.random()<.5)seedCoins(z,((L+1)%3)-1);
  }else if(r<.84){
    var L=(Math.random()*3|0)-1;
    place(z,L,'drink');
    seedCoins(z,L===0?(Math.random()<.5?1:-1):(L===1?-1:1));
  }else{
    // zigzag singles
    var L=(Math.random()*3|0)-1;
    place(z,L, ['loopy','pops','drink','fries'][Math.random()*4|0]);
    seedCoins(z+gap*0.4, -L||(Math.random()<.5?1:-1));
  }
}
function place(z,lane,kind){
  objs.push({typ:'obs',kind:kind,lane:lane,z:z,hit:0});
}

/* hit profiles: low/mid jumpable, tall must lane-change, arch must roll */
function profile(kind){
  if(kind==='loopy')return {shape:'low',h:0.72,w:1.12};
  if(kind==='pops')return {shape:'low',h:1.05,w:1.14};
  if(kind==='drink')return {shape:'tall',h:2.45,w:1.02};
  if(kind==='fries')return {shape:'arch',h:2.5,w:1.22,gap:0.58};
  return {shape:'low',h:0.8,w:1.0};
}

function playerBox(){
  var body=LANE/3;
  var h=player.state==='roll'?body*0.5:body*1.05;
  return {x:player.x,w:body*0.72,y:player.y,h:h,z:camZ+NEAR};
}

function collide(o){
  var pb=playerBox();
  var rel=o.z-pb.z;
  if(rel>0.55||rel<-0.45)return false;
  var ox=laneX(o.lane);
  if(Math.abs(ox-pb.x)>LANE*0.48)return false;
  if(o.typ==='coin'){
    var cy=o._above?0.95:0.4;
    if(o._above&&player.y<0.25)return false;
    return pb.y+pb.h>cy-0.25 && pb.y<cy+0.4;
  }
  var p=profile(o.kind);
  if(p.shape==='arch'){
    // opening from 0 to gap; hit if head above gap
    return pb.y+pb.h>p.gap;
  }
  // solid from 0 to h
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

  // lane lerp
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
    if(o.z<camZ+1.5){objs.splice(i,1);continue}
    // coins over lows / under arches
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
        var pr=proj(laneX(o.lane),o._above?0.9:0.45,o.z-camZ);
        pops.push({x:pr.x,y:pr.y,s:'+15',c:'#0b612e',a:1});
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

/* -------- draw -------- */
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);
  else ctx.rect(x,y,w,h);
}

function drawRoad(){
  // sky
  var g=ctx.createLinearGradient(0,0,0,horizon+8);
  g.addColorStop(0,'#0e5a2c');
  g.addColorStop(1,'#8fd3a4');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // sun
  ctx.fillStyle='#fce404';
  ctx.beginPath();ctx.arc(W*0.78,horizon*0.45,H*0.06,0,6.2832);ctx.fill();

  var segs=26;
  for(var i=segs;i>=0;i--){
    var z0=NEAR+(FAR-NEAR)*(i+1)/segs;
    var z1=NEAR+(FAR-NEAR)*i/segs;
    function trap(half,zA,zB){
      var a=proj(-half,0,zA),b=proj(half,0,zA),c=proj(half,0,zB),d=proj(-half,0,zB);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();
    }
    // grass sides
    ctx.fillStyle=(i%2===0)?'#0f7a38':'#148c44';
    trap(8,z0,z1);ctx.fill();
    // road
    ctx.fillStyle=(i%2===0)?'#e8c94a':'#d6b536';
    trap(LANE*1.72,z0,z1);ctx.fill();
  }
  var yN=proj(0,0,NEAR).y;
  if(yN<H){
    ctx.fillStyle='#0f7a38';
    ctx.fillRect(0,yN-1,W,H-yN+3);
    var Lft=proj(-LANE*1.72,0,NEAR),Rgt=proj(LANE*1.72,0,NEAR);
    var widen=(H-yN)/(H*0.2);
    ctx.fillStyle='#e8c94a';
    ctx.beginPath();
    ctx.moveTo(Lft.x,yN);ctx.lineTo(Rgt.x,yN);
    ctx.lineTo(Rgt.x+(Rgt.x-W/2)*widen,H+2);
    ctx.lineTo(Lft.x+(Lft.x-W/2)*widen,H+2);
    ctx.closePath();ctx.fill();
  }
  // lane dividers (dashed), move with camZ
  var dash=3.2,gap=2.4,period=dash+gap;
  var start=camZ%period;
  ctx.lineCap='butt';
  for(var side=-1;side<=1;side+=2){
    var xw=side*LANE*0.5;
    for(var z=NEAR-start;z<FAR;z+=period){
      if(z<NEAR-0.2)continue;
      var a=proj(xw,0.01,z),b=proj(xw,0.01,z+dash);
      ctx.strokeStyle='#fff6bf';
      ctx.lineWidth=Math.max(2,a.s*0.06);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
  }
}
function ROAD_W(){return LANE*1.72}

function drawImg(im,x,y,w,h){
  if(ready(im))ctx.drawImage(im,x,y,w,h);
}

function drawShadow(x,y,s,rx){
  ctx.save();ctx.globalAlpha=0.34;ctx.fillStyle='#000';
  ctx.beginPath();ctx.ellipse(x,y+s*0.02,s*(rx||0.5),s*0.16,0,0,6.2832);ctx.fill();ctx.restore();
}

/* simple extruded box for a pseudo-3D look, no 3D engine */
function drawPrism(cx,yG,w,h,s,front,side,top,im){
  var depth=Math.max(7,s*0.32),skew=(cx<W/2?1:-1)*depth*0.8,lift=depth*0.55;
  var x0=cx-w/2,x1=cx+w/2,y0=yG-h,y1=yG;
  ctx.fillStyle=top;
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y0);ctx.lineTo(x1+skew,y0-lift);ctx.lineTo(x0+skew,y0-lift);ctx.closePath();ctx.fill();
  ctx.fillStyle=side;
  if(skew>0){ctx.beginPath();ctx.moveTo(x1,y0);ctx.lineTo(x1+skew,y0-lift);ctx.lineTo(x1+skew,y1-lift);ctx.lineTo(x1,y1);ctx.closePath();ctx.fill();}
  else{ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+skew,y0-lift);ctx.lineTo(x0+skew,y1-lift);ctx.lineTo(x0,y1);ctx.closePath();ctx.fill();}
  ctx.fillStyle=front;
  if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x0,y0,w,h,Math.min(10,w*0.08));ctx.fill();}
  else ctx.fillRect(x0,y0,w,h);
  if(im)drawImg(im,x0+w*0.07,y0+h*0.06,w*0.86,h*0.88);
}

function drawObj(o){
  var rel=o.z-camZ;
  if(rel<1||rel>FAR)return;
  var fade=rel>FAR-12?Math.max(0,(FAR-rel)/12):1;
  ctx.save();ctx.globalAlpha=fade;
  var lx=laneX(o.lane);
  if(o.typ==='coin'){
    var wy=o._above?0.9:0.42;
    var p=proj(lx,wy,rel);
    var sz=Math.max(16,0.55*p.s);
    // bob
    p.y-=Math.sin(camZ*3+o.z)*0.06*p.s;
    drawImg(IM[o.kind],p.x-sz/2,p.y-sz/2,sz,sz);
    ctx.restore();return;
  }
  var pr=profile(o.kind);
  var gnd=proj(lx,0,rel);
  drawShadow(gnd.x,gnd.y,gnd.s,pr.w*0.62);
  if(pr.shape==='arch'){
    var top=proj(lx,pr.h,rel),gap=proj(lx,pr.gap,rel);
    var half=pr.w*0.5*gnd.s,pw=Math.max(8,0.24*gnd.s);
    var yTop=top.y,yGap=gap.y,yG=gnd.y,x=gnd.x;
    var beamH=Math.max(10,yGap-yTop);
    drawPrism(x-half+pw/2,yG,pw,yG-yTop,gnd.s,'#0b612e','#06361a','#148c44',null);
    drawPrism(x+half-pw/2,yG,pw,yG-yTop,gnd.s,'#0b612e','#06361a','#148c44',null);
    drawPrism(x,yGap,half*2,beamH,gnd.s,'#fce404','#c9a600','#fff6bf',null);
    var fw=half*1.7,fh=fw*0.7;
    drawImg(IM.fries,x-fw/2,yTop-fh*0.62,fw,fh);
  }else{
    var h=pr.h*gnd.s,w=pr.w*gnd.s;
    var pal={
      loopy:['#fff6bf','#c9a600','#fce404'],
      pops:['#ffe0b0','#b56b1b','#ffd27a'],
      drink:['#148c44','#0b612e','#fce404']
    }[o.kind]||['#fff6bf','#8a6a10','#fce404'];
    drawPrism(gnd.x,gnd.y,w,h,gnd.s,pal[0],pal[1],pal[2],IM[o.kind]);
  }
  ctx.restore();
}

function drawPlayer(){
  var rel=NEAR;
  var feet=proj(player.x,player.y,rel);
  var phase=camZ*2.4;
  var onGround=player.y<=0.02&&player.state!=='roll';
  var bounce=onGround&&player.state==='run'?(Math.sin(phase)*0.5+0.5)*0.05:0;
  var wobble=onGround&&player.state==='run'?Math.sin(phase)*0.11:0;
  var sx=1,sy=1,rot=player.tilt+wobble;
  if(player.state==='jump'){
    if(player.vy>0){sx=0.9;sy=1.16;rot=player.tilt-0.2}
    else{sx=0.96;sy=1.06;rot=player.tilt+0.12}
  }else if(player.state==='roll'){
    var u=1-player.rollT/0.52;
    rot=player.tilt+u*Math.PI*2;
    sx=1.12;sy=0.48;
  }else if(player.landT>0){
    var k=player.landT/0.16;
    sy=1-0.16*k;sx=1+0.08*k;
  }
  if(crashing){rot=player.tilt;sy=0.85;sx=1.08}
  var aspect=ready(IM.mascot)?IM.mascot.naturalWidth/IM.mascot.naturalHeight:0.95;
  var cw=(LANE*feet.s)/3;
  var ch=cw/aspect;
  var gnd=proj(player.x,0,rel);
  drawShadow(gnd.x,gnd.y,gnd.s*(player.state==='roll'?0.7:1),0.5);
  ctx.save();
  ctx.translate(feet.x,feet.y-bounce*feet.s);
  ctx.scale(sx,sy);
  if(player.state==='roll'||crashing){
    ctx.translate(0,-ch*0.52);
    ctx.rotate(rot);
    drawImg(IM.mascot,-cw/2,-ch*0.48,cw,ch);
  }else{
    ctx.rotate(rot);
    drawImg(IM.mascot,-cw/2,-ch,cw,ch);
  }
  ctx.restore();
}

function draw(){
  if(!W)return;
  ctx.clearRect(0,0,W,H);
  drawRoad();
  // objects far to near
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
  update(dt);draw();
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
size();requestAnimationFrame(size);
})();
