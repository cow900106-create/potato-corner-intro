(function(){
var d=document,G=window.PCGames;
var cv=d.getElementById('stage'),ctx=cv.getContext('2d');
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var elScore=d.getElementById('score'),elBest=d.getElementById('best'),elHud=d.getElementById('hud');
var KEY='pcGameCatchBest';
var W=0,H=0,dpr=1,run=false,frozen=false,score=0,items=[],pops=[],spawn=0,last=0,raf=0,flash=0,bounce=0,overT=0;
var box={x:0};
var best=G.getBest(KEY);if(elBest)elBest.textContent=best;

function src(p){var i=new Image();i.src=p;return i}
var IM={
  fries:src('img/shop/fries.webp'),
  loopy:src('img/shop/loopy.webp'),
  pops:src('img/shop/pops.webp'),
  drink:src('img/shop/drink.webp'),
  onion:src('img/shop/jar-onion.webp'),
  bbq:src('img/shop/jar-bbq.webp'),
  cheese:src('img/shop/jar-cheese.webp'),
  chili:src('img/shop/jar-chili.webp'),
  burntFries:src('img/catch/burnt-fries.webp'),
  burntLoopy:src('img/catch/burnt-loopy.webp'),
  burntPops:src('img/catch/burnt-pops.webp'),
  tray:src('img/catch/tray.webp'),
  char:src('img/run/char-run.webp'),
  charJump:src('img/run/char-jump.webp')
};
var GOOD=[
  {k:'fries',im:'fries',pts:1,lab:'薯條',scale:1},
  {k:'loopy',im:'loopy',pts:2,lab:'捲捲薯',scale:1},
  {k:'pops',im:'pops',pts:2,lab:'雞米花',scale:1},
  {k:'drink',im:'drink',pts:3,lab:'飲料',scale:.88},
  {k:'onion',im:'onion',pts:3,lab:'洋蔥粉',scale:.78},
  {k:'bbq',im:'bbq',pts:3,lab:'BBQ粉',scale:.78},
  {k:'cheese',im:'cheese',pts:3,lab:'起司粉',scale:.78},
  {k:'chili',im:'chili',pts:3,lab:'香辣粉',scale:.78}
];
var BURNT=[
  {k:'burntFries',im:'burntFries',pts:0,lab:'燒焦薯條',scale:1,burnt:1},
  {k:'burntLoopy',im:'burntLoopy',pts:0,lab:'燒焦捲捲薯',scale:1,burnt:1},
  {k:'burntPops',im:'burntPops',pts:0,lab:'燒焦雞米花',scale:1,burnt:1}
];
function ready(im){return im&&im.complete&&im.naturalWidth>0}

function size(){
  var r=cv.parentNode.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(1,Math.floor(r.width));
  H=Math.max(1,Math.floor(r.height));
  cv.width=W*dpr;cv.height=H*dpr;
  cv.style.width=W+'px';cv.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(!box.x)box.x=W/2;
  box.x=Math.min(Math.max(box.x,trayW()/2),W-trayW()/2);
  draw();
}
function trayW(){return Math.max(150,Math.min(W*0.46,210))}
function trayH(){return trayW()*0.72}
function charH(){return Math.max(150,Math.min(H*0.28,230))}
function groundY(){return H-Math.max(10, (window.visualViewport?0:0))+0}
function safeBottom(){return 8}
function trayTop(){return H-safeBottom()-trayH()*0.92}
function hitBox(){
  var w=trayW()*0.82,h=trayH()*0.5,y=trayTop()+trayH()*0.12;
  return {x:box.x-w/2,y:y,w:w,h:h};
}

function setX(cx){
  var r=cv.getBoundingClientRect();
  box.x=Math.min(Math.max(cx-r.left,trayW()/2),W-trayW()/2);
}
cv.addEventListener('pointerdown',function(e){setX(e.clientX);try{cv.setPointerCapture(e.pointerId)}catch(_){} e.preventDefault()},{passive:false});
cv.addEventListener('pointermove',function(e){if(e.buttons||e.pointerType==='touch')setX(e.clientX)},{passive:true});
d.addEventListener('keydown',function(e){
  if(!run||frozen)return;
  if(e.key==='ArrowLeft'){box.x=Math.max(trayW()/2,box.x-28);e.preventDefault()}
  if(e.key==='ArrowRight'){box.x=Math.min(W-trayW()/2,box.x+28);e.preventDefault()}
});

function diff(){
  var s=score;
  var sp=(210+s*4)* (H/760);
  if(sp>540*(H/760))sp=540*(H/760);
  var interval=Math.max(.30,.92-s*.008);
  var burst=s>=18 && Math.random()<Math.min(.38,.08+s*.004);
  var burntP=Math.min(.30,.13+s*.003);
  return {speed:sp,interval:interval,burst:burst,burntP:burntP};
}

function add(force){
  var df=diff();
  var typ;
  if(force)typ=force;
  else if(Math.random()<df.burntP)typ=BURNT[Math.random()*BURNT.length|0];
  else typ=GOOD[Math.random()*GOOD.length|0];
  var s=Math.max(64,W*0.17)* (typ.scale||1);
  var margin=s*.6;
  items.push({
    typ:typ,x:margin+Math.random()*(W-2*margin),y:-s,s:s,
    v:df.speed*(.86+Math.random()*.28),r:(Math.random()-.5)*.4,w:(Math.random()-.5)*1.4,
    smoke:Math.random()*6
  });
}

function pop(x,y,s,c){pops.push({x:x,y:y,s:s,c:c,a:1,sc:1})}
function setScore(n){score=Math.max(0,n);if(elScore)elScore.textContent=score}

function drawBg(){
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0b5a2a');
  g.addColorStop(.45,'#148c44');
  g.addColorStop(.78,'#7bc43a');
  g.addColorStop(1,'#fce404');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(252,228,4,.18)';
  for(var i=0;i<6;i++){
    ctx.beginPath();
    ctx.arc(W*(.12+i*.16),H*(.18+(i%2)*.1),18+i*3,0,6.28);
    ctx.fill();
  }
  var gy=H-Math.max(36,H*.08);
  var gg=ctx.createLinearGradient(0,gy,0,H);
  gg.addColorStop(0,'rgba(252,228,4,.0)');
  gg.addColorStop(.35,'#e8d24a');
  gg.addColorStop(1,'#c9a600');
  ctx.fillStyle=gg;ctx.fillRect(0,gy,W,H-gy);
}

function blit(im,x,y,w,h,rot){
  if(!ready(im))return false;
  ctx.save();
  ctx.translate(x,y);
  if(rot)ctx.rotate(rot);
  ctx.drawImage(im,-w/2,-h/2,w,h);
  ctx.restore();
  return true;
}

function drawSmoke(it,t){
  if(!it.typ.burnt)return;
  var n=3;
  for(var i=0;i<n;i++){
    var ph=it.smoke+t*1.6+i*1.1;
    var ox=Math.sin(ph)*it.s*.12;
    var oy=-it.s*.42- (ph%3)*it.s*.08;
    var a=.28- (ph%3)*0.07;
    if(a<=0)continue;
    ctx.globalAlpha=Math.max(0,a);
    ctx.fillStyle='#d8d4ce';
    ctx.beginPath();
    ctx.ellipse(it.x+ox,it.y+oy,it.s*.09+i*2,it.s*.13+i*2,0,0,6.28);
    ctx.fill();
    ctx.globalAlpha=1;
  }
}

function drawItem(it,t){
  var im=IM[it.typ.im];
  var h=it.s,w=it.s;
  if(ready(im)){w=it.s;h=it.s*(im.naturalHeight/im.naturalWidth);if(h>it.s*1.25){h=it.s*1.15;w=h*(im.naturalWidth/im.naturalHeight)}}
  drawSmoke(it,t);
  if(!blit(im,it.x,it.y,w,h,it.r)){
    ctx.fillStyle=it.typ.burnt?'#2a1a12':'#fce404';
    ctx.beginPath();ctx.arc(it.x,it.y,it.s*.4,0,6.28);ctx.fill();
  }
}

function drawPlayer(){
  var ch=charH(),cw=ch*0.78;
  var trayw=trayW(),trayh=trayH();
  var ty=trayTop()+trayh/2;
  var cy=trayTop()-ch*0.42;
  var b=bounce>0?Math.sin(Math.min(bounce,1)*Math.PI):0;
  var squish=1-b*.08,stretch=1+b*.14;
  var charIm=(bounce>0.08&&ready(IM.charJump))?IM.charJump:IM.char;
  ctx.save();
  ctx.translate(box.x, cy+ch/2);
  ctx.scale(squish,stretch);
  blit(charIm,0,-ch*.08,cw,ch,0);
  ctx.restore();
  ctx.save();
  ctx.translate(box.x, ty);
  ctx.scale(1+b*.06,1-b*.05);
  blit(IM.tray,0,0,trayw,trayh,0);
  ctx.restore();
}

function drawPops(){
  pops.forEach(function(p){
    ctx.globalAlpha=Math.max(p.a,0);
    ctx.fillStyle=p.c;
    ctx.font='bold '+Math.round(22*p.sc)+'px -apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC",sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=4;
    ctx.fillText(p.s,p.x,p.y);
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  });
}

function draw(){
  if(!W||!H)return;
  drawBg();
  var t=performance.now()/1000;
  items.forEach(function(it){drawItem(it,t)});
  drawPlayer();
  drawPops();
  if(flash>0){
    ctx.fillStyle='rgba(160,20,10,'+(Math.min(flash,1)*.32)+')';
    ctx.fillRect(0,0,W,H);
  }
}

function loop(ts){
  if(!run)return;
  var dt=Math.min((ts-last)/1000,.05);last=ts;
  if(!frozen){
    spawn-=dt;bounce=Math.max(0,bounce-dt*2.4);flash=Math.max(0,flash-dt*2.2);
    if(overT>0){
      overT-=dt;
      items.forEach(function(it){it.r+=it.w*dt*.4});
      pops.forEach(function(p){p.y-=50*dt;p.a-=dt*1.2;p.sc+=dt*.4});
      pops=pops.filter(function(p){return p.a>0});
      draw();
      if(overT<=0){showOver();return}
      raf=requestAnimationFrame(loop);
      return;
    }
    if(spawn<=0){
      add();
      var df=diff();
      spawn=df.interval;
      if(df.burst)add();
    }
    var hit=hitBox();
    for(var i=items.length-1;i>=0;i--){
      var it=items[i];
      it.y+=it.v*dt;it.r+=it.w*dt;
      var caught=it.y+it.s*.2>=hit.y && it.y-it.s*.15<=hit.y+hit.h && Math.abs(it.x-box.x)<hit.w/2+it.s*.12;
      if(caught){
        if(it.typ.burnt){
          flash=1;bounce=.7;
          pop(it.x,hit.y-8,'燒焦了','#ffe0c8');
          if(navigator.vibrate)try{navigator.vibrate(80)}catch(_){}
          items.splice(i,1);
          overT=.38;
        }else{
          setScore(score+it.typ.pts);
          bounce=.55;
          pop(it.x,hit.y-6,'+'+it.typ.pts+' '+it.typ.lab,'#fce404');
          items.splice(i,1);
        }
      }else if(it.y>H+it.s){items.splice(i,1)}
    }
    pops.forEach(function(p){p.y-=70*dt;p.a-=dt*1.15;p.sc+=dt*.35});
    pops=pops.filter(function(p){return p.a>0});
  }
  draw();
  raf=requestAnimationFrame(loop);
}

function start(){
  items=[];pops=[];setScore(0);spawn=.4;run=true;frozen=false;flash=0;bounce=0;overT=0;
  var how=d.getElementById('how');if(how)how.hidden=false;
  ov.hidden=true;if(elHud)elHud.hidden=false;
  last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}

function showOver(){
  run=false;cancelAnimationFrame(raf);draw();
  var nb=score>best;if(nb){best=score;G.setBest(KEY,best);if(elBest)elBest.textContent=best}
  ovT.textContent='接到燒焦的了';
  ovS.innerHTML='你的分數 <span class="big">'+score+'</span><br>'+(nb?'新的最高分！':'最高分 '+best)+G.pickHtml();
  go.textContent='再玩一次';
  var how=d.getElementById('how');if(how)how.hidden=true;
  ov.hidden=false;
}

function endNow(){
  overT=0;showOver();
}

go.addEventListener('click',start);
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&run&&overT<=0){
    run=false;cancelAnimationFrame(raf);
    ovT.textContent='暫停中';
    ovS.textContent='回到頁面後再開始';
    go.textContent='重新開始';
    var how=d.getElementById('how');if(how)how.hidden=false;
    ov.hidden=false;
  }
});
window.addEventListener('resize',size);
if(window.visualViewport)window.visualViewport.addEventListener('resize',size);
size();requestAnimationFrame(size);

window.PCCatch={
  start:start,
  seed:function(){
    if(!run)start();
    items=[];pops=[];setScore(18);bounce=.2;
    var mid=W/2,s=Math.max(70,W*.18);
    function place(typ,x,y){items.push({typ:typ,x:x,y:y,s:s*(typ.scale||1),v:0,r:0,w:0,smoke:1})}
    place(GOOD[0], mid-W*.28, H*.22);
    place(GOOD[1], mid+W*.08, H*.30);
    place(BURNT[0], mid+W*.26, H*.24);
    place(GOOD[3], mid-W*.12, H*.14);
    place(GOOD[4], mid+W*.32, H*.42);
    draw();
  },
  end:function(){overT=0;showOver()},
  catchBurnt:function(){
    if(!run)start();
    setScore(score||24);
    var typ=BURNT[0],s=Math.max(70,W*.2);
    items.push({typ:typ,x:box.x,y:trayTop()+20,s:s,v:0,r:0,w:0,smoke:2});
    flash=1;bounce=.7;pop(box.x,trayTop()-8,'燒焦了','#ffe0c8');
    overT=.35;
  },
  freeze:function(on){frozen=!!on;if(on)draw()},
  setScore:setScore,
  setX:function(n){box.x=Math.min(Math.max(n*W,trayW()/2),W-trayW()/2)},
  info:function(){return {run:run,score:score,best:best,items:items.length,frozen:frozen,overT:overT}}
};
})();
