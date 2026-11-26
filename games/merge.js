(function(){
var d=document,G=window.PCGames;
var cv=d.getElementById('stage'),ctx=cv.getContext('2d',{alpha:false});
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var ovlogo=d.getElementById('ovlogo'),ovcover=d.getElementById('ovcover'),how=d.getElementById('how');
var elScore=d.getElementById('score'),elBest=d.getElementById('best'),elHud=d.getElementById('hud');
var nextWrap=d.getElementById('nextWrap'),nextIm=d.getElementById('nextIm'),chainEl=d.getElementById('chain');
var bestLine=d.getElementById('bestLine'),toLobby=d.getElementById('toLobby'),recSlot=d.getElementById('recSlot');
var KEY='pcGameMergeBest';
var W=0,H=0,dpr=1,run=false,frozen=false,over=false,score=0,best=G.getBest(KEY);
var last=0,raf=0,cool=0,combo=0,comboT=0,uid=1,warn=0,shake=0,celebrate=0,highest=1;
var pointing=false,pid=0,keys={l:0,r:0};
var balls=[],parts=[],floats=[],held=null,nextT=1,bumpT=0;
var box={l:0,t:0,r:0,b:0,wall:16,danger:0};
if(elBest)elBest.textContent=best;
if(bestLine)bestLine.textContent=best?'最高分 '+best:'';

var TIERS=[
  {id:1,name:'小薯豆',color:'#f3e0b8',score:1,file:'t1'},
  {id:2,name:'黃金薯球',color:'#f0c14a',score:3,file:'t2'},
  {id:3,name:'酥脆雞米花球',color:'#d3923a',score:6,file:'t3'},
  {id:4,name:'奶油洋蔥球',color:'#efe6c8',score:10,file:'t4'},
  {id:5,name:'濃起司薯球',color:'#f5c430',score:15,file:'t5'},
  {id:6,name:'BBQ醬薯球',color:'#8a3a1e',score:21,file:'t6'},
  {id:7,name:'香辣紅椒薯球',color:'#d3261f',score:28,file:'t7'},
  {id:8,name:'捲捲薯球',color:'#e8a020',score:36,file:'t8'},
  {id:9,name:'迷你土豆吉祥物',color:'#c47a3a',score:45,file:'t9'},
  {id:10,name:'巨無霸皇冠黃金大土豆',color:'#ffd24a',score:100,file:'t10'}
];
/* body center + radius in normalized image coords (sphere fills the collider) */
var META={
  t1:{cx:0.5,cy:0.5,r:0.355},
  t2:{cx:0.5,cy:0.5,r:0.345},
  t3:{cx:0.5,cy:0.5,r:0.460},
  t4:{cx:0.5,cy:0.5,r:0.460},
  t5:{cx:0.5,cy:0.5,r:0.337},
  t6:{cx:0.5,cy:0.5,r:0.340},
  t7:{cx:0.5,cy:0.5,r:0.373},
  t8:{cx:0.5,cy:0.5,r:0.452},
  t9:{cx:0.5,cy:0.5,r:0.320},
  t10:{cx:0.5,cy:0.5,r:0.278}
};
function src(p){var i=new Image();i.src=p;return i}
var IM={};
for(var i=0;i<TIERS.length;i++)IM[TIERS[i].id]=src('img/merge/'+TIERS[i].file+'.webp');
function ready(im){return im&&im.complete&&im.naturalWidth>0}
for(var k in IM){IM[k].addEventListener('load',function(){draw()})}
function tier(t){return TIERS[Math.max(1,Math.min(10,t|0))-1]}
function radius(t){
  var inner=Math.max(80,box.r-box.l-box.wall*2);
  return inner*0.048*Math.pow(1.18,t-1);
}
function randTier(){
  var w=[5,4,3,2,1],s=15,r=Math.random()*s,acc=0;
  for(var i=0;i<5;i++){acc+=w[i];if(r<acc)return i+1}
  return 1;
}

if(chainEl){
  var html='';
  for(var c=0;c<TIERS.length;c++){
    if(c)html+='<i class="arr" aria-hidden="true"></i>';
    html+='<img src="img/merge/'+TIERS[c].file+'.webp" alt="'+TIERS[c].name+'" title="'+TIERS[c].name+'" width="32" height="32">';
  }
  chainEl.innerHTML=html;
}

function setScore(n){score=Math.max(0,n|0);if(elScore)elScore.textContent=score}
function showNext(){
  if(!nextIm)return;
  nextIm.src='img/merge/'+tier(nextT).file+'.webp';
  nextIm.alt=tier(nextT).name;
}

function layout(){
  var r=cv.parentNode.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(1,Math.floor(r.width));
  H=Math.max(1,Math.floor(r.height));
  cv.width=W*dpr;cv.height=H*dpr;
  cv.style.width=W+'px';cv.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  var safeT=0,safeB=0;
  var hud=52+safeT;
  var chain=46;
  box.wall=Math.max(12,Math.round(W*0.038));
  box.l=Math.max(10,Math.round(W*0.045));
  box.r=W-box.l;
  box.t=hud+chain+6;
  box.b=H-Math.max(10,Math.round(H*0.02))-safeB;
  box.danger=box.t+box.wall+Math.max(44,Math.round((box.b-box.t)*0.10));
  if(held){held.r=radius(held.t);clampHeld()}
  for(var i=0;i<balls.length;i++){
    var b=balls[i];b.r=radius(b.t);b.m=b.r*b.r;
    b.x=Math.min(Math.max(b.x,box.l+box.wall+b.r),box.r-box.wall-b.r);
    b.y=Math.min(b.y,box.b-box.wall-b.r);
  }
  draw();
}

function innerL(){return box.l+box.wall}
function innerR(){return box.r-box.wall}
function innerT(){return box.t+box.wall}
function innerB(){return box.b-box.wall}

function clampHeld(){
  if(!held)return;
  var min=innerL()+held.r,max=innerR()-held.r;
  held.x=Math.min(Math.max(held.x,min),max);
  held.y=innerT()+held.r+2;
}

function makeBall(t,x,y,opts){
  opts=opts||{};
  var r=radius(t);
  return {
    id:uid++,t:t,x:x,y:y,vx:0,vy:0,omega:0,rot:(opts.rot||0),
    r:r,m:r*r,fresh:!!opts.fresh,settle:0,overT:0,born:opts.born||0,
    scale:opts.scale==null?1:opts.scale,dead:false,held:!!opts.held
  };
}

function armHeld(){
  var t=nextT;
  nextT=randTier();
  showNext();
  held=makeBall(t, (held&&held.x)||((innerL()+innerR())/2), 0, {held:1,rot:0});
  clampHeld();
}

function pointerX(cx){
  var r=cv.getBoundingClientRect();
  return (cx-r.left)*(W/Math.max(1,r.width));
}
function aimTo(cx){
  if(!held||over||!run)return;
  held.x=pointerX(cx);
  clampHeld();
}
function tryDrop(){
  if(!run||over||frozen||!held||cool>0)return false;
  var b=held;
  b.held=false;b.fresh=true;b.settle=0;b.vy=40;b.vx=0;
  balls.push(b);
  held=null;
  cool=0.45;
  armHeld();
  if(G.audio)G.audio.play('drop');
  return true;
}

cv.addEventListener('pointerdown',function(e){
  if(!run||over)return;
  pointing=true;pid=e.pointerId;
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
  aimTo(e.clientX);
  e.preventDefault();
},{passive:false});
cv.addEventListener('pointermove',function(e){
  if(!pointing||(pid&&e.pointerId!==pid))return;
  aimTo(e.clientX);
},{passive:true});
function ptrUp(e){
  if(!pointing)return;
  if(pid&&e.pointerId&&e.pointerId!==pid)return;
  pointing=false;pid=0;
  if(run&&!over)tryDrop();
}
cv.addEventListener('pointerup',ptrUp);
cv.addEventListener('pointercancel',ptrUp);
d.addEventListener('keydown',function(e){
  if(e.key==='ArrowLeft')keys.l=1;
  if(e.key==='ArrowRight')keys.r=1;
  if((e.key===' '||e.key==='ArrowDown'||e.key==='Enter')&&run&&!over){tryDrop();e.preventDefault()}
});
d.addEventListener('keyup',function(e){
  if(e.key==='ArrowLeft')keys.l=0;
  if(e.key==='ArrowRight')keys.r=0;
});

function burst(x,y,color,n,power){
  n=n||10;power=power||140;
  for(var i=0;i<n;i++){
    var a=Math.random()*6.283,s=(0.4+Math.random())*power;
    parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-40,r:2+Math.random()*4,life:1,color:color,kind:'crumb'});
  }
}
function ring(x,y,color){
  parts.push({x:x,y:y,r:8,vr:180,life:1,color:color,kind:'ring'});
}
function floatText(x,y,s,color){
  floats.push({x:x,y:y,s:s,color:color||'#fce404',a:1,vy:-42});
}

function doMerge(a,b){
  if(a.dead||b.dead)return;
  a.dead=b.dead=true;
  var x=(a.x*a.m+b.x*b.m)/(a.m+b.m);
  var y=(a.y*a.m+b.y*b.m)/(a.m+b.m);
  var col=tier(a.t).color;
  burst(x,y,col,12+a.t*2,120+a.t*8);
  ring(x,y,col);
  if(comboT>0)combo+=1;else combo=1;
  comboT=0.85;
  var nxt=a.t+1;
  if(a.t>=10){
    setScore(score+200+combo*20);
    highest=10;
    celebrate=1.2;
    shake=0.45;
    floatText(x,y-10,'頂級合成!','#fff4a0');
    if(combo>1)floatText(x,y+16,combo+'連擊!','#fff');
    if(G.audio)G.audio.play('mergeMax');
    return;
  }
  var nb=makeBall(nxt,x,y,{scale:0.58,born:0.28});
  nb.vy=-80;nb.vx=(a.vx+b.vx)*0.25;
  nb.rot=(a.rot+b.rot)/2;nb.omega=(a.omega+b.omega)*0.2;
  var add=tier(nxt).score*(combo>1?combo:1);
  setScore(score+add);
  if(nxt>highest)highest=nxt;
  floatText(x,y-8,'+'+add,tier(nxt).color);
  if(combo>1)floatText(x,y+14,combo+'連擊!','#fff');
  balls.push(nb);
  if(G.audio)G.audio.play('merge',{tier:nxt,combo:combo});
  if(nxt===10){
    celebrate=1.4;shake=0.4;
    floatText(x,y-28,'大土豆誕生!','#ffe566');
    if(G.audio)G.audio.play('mergeMax');
  }
}

function inertia(b){return 0.5*b.m*b.r*b.r}

function physics(dt){
  var steps=8,h=dt/steps,g=2050,rest=0.16,mu=0.28,slop=0.25,corr=0.8;
  var L=innerL(),R=innerR(),B=innerB();
  var maxSurf=480;

  function wall(b,nx,ny,pen){
    if(pen>0){b.x+=nx*pen;b.y+=ny*pen}
    else return;
    var I=inertia(b),tx=-ny,ty=nx;
    /* contact vel vs static wall; r_vec = -n*r, omega×r = (omega*ny*r, -omega*nx*r) */
    var cx=b.vx+b.omega*ny*b.r, cy=b.vy-b.omega*nx*b.r;
    var vn=cx*nx+cy*ny, vt=cx*tx+cy*ty, jn=0;
    if(vn<0){
      var e=Math.abs(vn)<60?0:rest;
      jn=-(1+e)*vn*b.m;
      b.vx+=jn/b.m*nx;b.vy+=jn/b.m*ny;
      if(Math.abs(vn)>90)maybeBump(Math.abs(vn));
      if(b.fresh&&Math.abs(vn)>20)b.fresh=false;
    }else{
      jn=b.m*g*h*Math.max(0,-ny);
      if(Math.abs(nx)>0.5)jn=Math.max(jn,b.m*18);
    }
    var kt=1/b.m+(b.r*b.r)/I;
    var jt=-vt/kt, lim=mu*Math.max(Math.abs(jn),b.m*g*h*0.25);
    if(jt>lim)jt=lim;if(jt<-lim)jt=-lim;
    b.vx+=jt/b.m*tx;b.vy+=jt/b.m*ty;
    b.omega+=(-b.r*jt)/I;
  }

  function pair(A,C){
    var dx=C.x-A.x,dy=C.y-A.y,min=A.r+C.r,dist2=dx*dx+dy*dy;
    if(dist2>=min*min||dist2<1e-12)return;
    var dist=Math.sqrt(dist2),nx=dx/dist,ny=dy/dist,overlap=min-dist;
    var inv=1/(A.m+C.m),sep=Math.max(0,overlap-slop)*corr;
    A.x-=nx*sep*C.m*inv;A.y-=ny*sep*C.m*inv;
    C.x+=nx*sep*A.m*inv;C.y+=ny*sep*A.m*inv;
    var IA=inertia(A),IC=inertia(C),tx=-ny,ty=nx;
    /* contact vel includes spin: vA + omegaA*rA*t , vC - omegaC*rC*t */
    var Avx=A.vx+A.omega*A.r*tx,Avy=A.vy+A.omega*A.r*ty;
    var Cvx=C.vx-C.omega*C.r*tx,Cvy=C.vy-C.omega*C.r*ty;
    var rvx=Cvx-Avx,rvy=Cvy-Avy;
    var vn=rvx*nx+rvy*ny,vt=rvx*tx+rvy*ty,jn=0;
    if(vn<0){
      var e=Math.abs(vn)<55?0:rest;
      if(overlap>A.r*0.28)e=0;
      jn=-(1+e)*vn/(1/A.m+1/C.m);
      A.vx-=jn/A.m*nx;A.vy-=jn/A.m*ny;
      C.vx+=jn/C.m*nx;C.vy+=jn/C.m*ny;
      if(Math.abs(vn)>90)maybeBump(Math.abs(jn)/Math.max(A.m,C.m));
      if(A.fresh&&Math.abs(jn)>8)A.fresh=false;
      if(C.fresh&&Math.abs(jn)>8)C.fresh=false;
    }else if(overlap>0.35){
      jn=Math.min(A.m,C.m)*g*h*0.85;
    }
    var kt=1/A.m+1/C.m+(A.r*A.r)/IA+(C.r*C.r)/IC;
    var jt=vt/kt,lim=mu*Math.max(Math.abs(jn),Math.min(A.m,C.m)*g*h*0.2);
    if(jt>lim)jt=lim;if(jt<-lim)jt=-lim;
    A.vx+=jt/A.m*tx;A.vy+=jt/A.m*ty;
    C.vx-=jt/C.m*tx;C.vy-=jt/C.m*ty;
    A.omega+=(A.r*jt)/IA;
    C.omega+=(C.r*jt)/IC;
  }

  function stabilize(b){
    var cap=maxSurf/Math.max(8,b.r);
    if(b.omega>cap)b.omega=cap;
    if(b.omega<-cap)b.omega=-cap;
    var spd=Math.hypot(b.vx,b.vy),surf=Math.abs(b.omega)*b.r;
    var onFloor=(b.y+b.r)>=(B-1.25);
    var damp=1.6;
    if(onFloor||spd<40)damp+=4;
    if(onFloor&&spd<22)damp+=8;
    if(surf>spd+24)damp+=7;
    b.omega*=Math.max(0,1-damp*h);
    /* in-place / squeezed spin: little horizontal motion should not keep spinning */
    if(Math.abs(b.vx)<22){
      b.omega*=Math.max(0,1-12*h);
      if(surf<45 && Math.abs(b.vx)<14)b.omega=0;
    }
    /* sleep spin when almost still; never cancel gravity in mid-air */
    if(spd<18 && surf<28)b.omega=0;
    if(onFloor && spd<10){
      if(Math.abs(b.vx)<8)b.vx=0;
      if(Math.abs(b.vy)<28)b.vy=0;
      if(surf<28)b.omega=0;
    }
  }

  for(var s=0;s<steps;s++){
    var live=[],i,j;
    for(i=0;i<balls.length;i++)if(!balls[i].dead)live.push(balls[i]);
    for(i=0;i<live.length;i++){
      var b=live[i];
      if(b.born>0)continue;
      b.vy+=g*h;
      b.vx*=(1-0.18*h);
      b.x+=b.vx*h;
      b.y+=b.vy*h;
      if(b.x-b.r<L)wall(b,1,0,L-(b.x-b.r));
      if(b.x+b.r>R)wall(b,-1,0,(b.x+b.r)-R);
      if(b.y+b.r>B)wall(b,0,-1,(b.y+b.r)-B);
    }
    for(var pass=0;pass<2;pass++){
      for(i=0;i<live.length;i++){
        for(j=i+1;j<live.length;j++){
          if(live[i].born>0||live[j].born>0)continue;
          pair(live[i],live[j]);
        }
      }
    }
    for(i=0;i<live.length;i++){
      if(live[i].born>0)continue;
      stabilize(live[i]);
      live[i].rot+=live[i].omega*h;
    }
  }
  /* merges after substeps */
  live=[];
  for(i=0;i<balls.length;i++)if(!balls[i].dead)live.push(balls[i]);
  live.sort(function(a,b){return a.id-b.id});
  for(i=0;i<live.length;i++){
    for(j=i+1;j<live.length;j++){
      A=live[i];C=live[j];
      if(A.dead||C.dead)continue;
      if(A.t!==C.t)continue;
      if(A.born>0||C.born>0)continue;
      dx=C.x-A.x;dy=C.y-A.y;
      if(dx*dx+dy*dy<=(A.r+C.r+1.8)*(A.r+C.r+1.8))doMerge(A,C);
    }
  }
  balls=balls.filter(function(b){return !b.dead});
}

function maybeBump(force){
  if(bumpT>0||force<40)return;
  bumpT=0.07;
  if(G.audio)G.audio.play('bump',{force:Math.min(1,force/220)});
}

function tickBalls(dt){
  for(var i=0;i<balls.length;i++){
    var b=balls[i];
    if(b.born>0){
      b.born-=dt;
      var k=1-Math.max(0,b.born)/0.28;
      /* bounce scale 0.58 -> 1.16 -> 1 */
      if(k<0.55)b.scale=0.58+k/0.55*0.62;
      else b.scale=1.20-(k-0.55)/0.45*0.20;
      if(b.born<=0){b.born=0;b.scale=1}
    }
    var spd=Math.hypot(b.vx,b.vy);
    if(!b.fresh && spd<28)b.settle=Math.min(1,b.settle+dt*2);
    if(b.fresh && b.y-b.r>box.danger+8 && spd<40)b.fresh=false;
  }
  for(i=0;i<parts.length;i++){
    var p=parts[i];
    p.life-=dt*(p.kind==='ring'?1.6:1.3);
    if(p.kind==='crumb'){p.vy+=900*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=0.98}
    if(p.kind==='ring')p.r+=p.vr*dt;
    if(p.kind==='spark'){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt*0.4}
  }
  parts=parts.filter(function(p){return p.life>0});
  for(i=0;i<floats.length;i++){
    var f=floats[i];f.y+=f.vy*dt;f.a-=dt*0.85;
  }
  floats=floats.filter(function(f){return f.a>0});
}

function danger(dt){
  var any=false;
  for(var i=0;i<balls.length;i++){
    var b=balls[i];
    if(b.dead||b.fresh||b.held||b.born>0)continue;
    if(b.y-b.r<box.danger){
      any=true;
      b.overT+=dt;
    }else b.overT=0;
  }
  if(any)warn=Math.min(2.6,warn+dt);
  else warn=Math.max(0,warn-dt*1.2);
  if(!over){
    for(i=0;i<balls.length;i++){
      if(!balls[i].fresh&&!balls[i].dead&&balls[i].overT>=2.5){endGame();break}
    }
  }
}

function drawBg(){
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#8fd14a');
  g.addColorStop(0.45,'#5aaa32');
  g.addColorStop(1,'#2f7a28');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(252,228,4,.10)';
  for(var i=0;i<7;i++){
    ctx.beginPath();
    ctx.arc(W*(0.1+i*0.14),H*(0.12+(i%3)*0.06),16+i*3,0,6.28);
    ctx.fill();
  }
}

function drawBox(){
  var L=box.l,T=box.t,R=box.r,B=box.b,w=box.wall;
  var bw=R-L,bh=B-T;
  /* outer wood */
  var og=ctx.createLinearGradient(L,T,R,B);
  og.addColorStop(0,'#e0b46a');
  og.addColorStop(0.5,'#c98a3a');
  og.addColorStop(1,'#a46824');
  ctx.fillStyle=og;
  roundRect(L-2,T-2,bw+4,bh+4,16);
  ctx.fill();
  /* inner well */
  var ig=ctx.createLinearGradient(L,T,L,B);
  ig.addColorStop(0,'#fff6cf');
  ig.addColorStop(0.2,'#f4d48a');
  ig.addColorStop(1,'#d9a24a');
  ctx.fillStyle=ig;
  roundRect(L+w,T+w,bw-w*2,bh-w*2,8);
  ctx.fill();
  /* inner shadow */
  ctx.strokeStyle='rgba(80,40,8,.35)';
  ctx.lineWidth=3;
  roundRect(L+w+1,T+w+1,bw-w*2-2,bh-w*2-2,8);
  ctx.stroke();
  /* wood grain ticks on walls */
  ctx.strokeStyle='rgba(90,50,10,.18)';
  ctx.lineWidth=1;
  for(var i=1;i<6;i++){
    var yy=T+w+(bh-w*2)*i/6;
    ctx.beginPath();ctx.moveTo(L+4,yy);ctx.lineTo(L+w-3,yy);ctx.stroke();
    ctx.beginPath();ctx.moveTo(R-w+3,yy);ctx.lineTo(R-4,yy);ctx.stroke();
  }
  /* danger line */
  var dy=box.danger,red=warn>0;
  ctx.save();
  ctx.setLineDash([8,7]);
  ctx.strokeStyle=red?'rgba(220,30,30,'+(0.7+0.3*Math.sin(performance.now()/90))+')':'rgba(200,40,40,.55)';
  ctx.lineWidth=red?3:2;
  ctx.beginPath();ctx.moveTo(L+w+4,dy);ctx.lineTo(R-w-4,dy);ctx.stroke();
  ctx.restore();
  if(red){
    ctx.fillStyle='rgba(200,16,16,'+Math.min(0.28,warn*0.12)+')';
    ctx.fillRect(L+w,T+w,bw-w*2,dy-(T+w));
    ctx.fillStyle='#fff';
    ctx.font='bold 13px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
    ctx.textAlign='center';
    ctx.fillText('快滿了！',(L+R)/2,dy-8);
  }
}

function roundRect(x,y,w,h,r){
  var rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}

function drawBall(b,ghost){
  var im=IM[b.t],meta=META['t'+b.t],sc=b.scale||1;
  ctx.save();
  ctx.translate(b.x,b.y);
  ctx.rotate(b.rot||0);
  ctx.scale(sc,sc);
  if(ghost)ctx.globalAlpha=0.55;
  if(ready(im)&&meta){
    var s=b.r/(meta.r*im.naturalWidth);
    var w=im.naturalWidth*s,h=im.naturalHeight*s;
    ctx.drawImage(im,-meta.cx*w,-meta.cy*h,w,h);
  }else{
    ctx.beginPath();ctx.arc(0,0,b.r,0,6.28);
    ctx.fillStyle=tier(b.t).color;ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.15)';ctx.lineWidth=2;ctx.stroke();
  }
  ctx.restore();
}

function drawAim(){
  if(!held||over)return;
  var x=held.x,top=held.y+held.r+2,bot=innerB();
  ctx.save();
  ctx.setLineDash([5,6]);
  ctx.strokeStyle='rgba(80,40,10,.35)';
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bot);ctx.stroke();
  ctx.restore();
  if(cool>0)ctx.globalAlpha=0.55;
  drawBall(held);
  ctx.globalAlpha=1;
}

function drawParts(){
  for(var i=0;i<parts.length;i++){
    var p=parts[i];
    ctx.globalAlpha=Math.max(0,p.life);
    if(p.kind==='ring'){
      ctx.strokeStyle=p.color;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.stroke();
    }else{
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.fill();
    }
  }
  ctx.globalAlpha=1;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  for(i=0;i<floats.length;i++){
    var f=floats[i];
    ctx.globalAlpha=Math.max(0,f.a);
    ctx.font='bold 18px -apple-system,BlinkMacSystemFont,"PingFang TC",sans-serif';
    ctx.lineWidth=4;ctx.strokeStyle='rgba(40,20,0,.45)';
    ctx.strokeText(f.s,f.x,f.y);
    ctx.fillStyle=f.color;ctx.fillText(f.s,f.x,f.y);
  }
  ctx.globalAlpha=1;
}

function drawCelebrate(){
  if(celebrate<=0)return;
  var t=performance.now()/180;
  ctx.globalAlpha=Math.min(1,celebrate)*0.9;
  for(var i=0;i<10;i++){
    var a=t+i*0.62,rad=40+celebrate*80;
    ctx.fillStyle=i%2?'#fce404':'#fff';
    ctx.beginPath();
    ctx.arc(W/2+Math.cos(a)*rad,box.t+80+Math.sin(a*1.3)*20,3+i%3,0,6.28);
    ctx.fill();
  }
  ctx.globalAlpha=1;
}

function draw(){
  if(!W||!H)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#5aaa32';
  ctx.fillRect(0,0,W,H);
  ctx.save();
  if(shake>0){
    var mag=shake*5;
    ctx.translate((Math.random()-0.5)*mag,(Math.random()-0.5)*mag);
  }
  drawBg();
  drawBox();
  drawAim();
  var list=balls.slice().sort(function(a,b){return a.y-b.y});
  for(var i=0;i<list.length;i++)if(!list[i].dead)drawBall(list[i]);
  drawParts();
  drawCelebrate();
  ctx.restore();
}

function loop(ts){
  if(!run)return;
  var dt=Math.min((ts-last)/1000,0.05);last=ts;
  if(!frozen){
    cool=Math.max(0,cool-dt);
    comboT=Math.max(0,comboT-dt);
    if(comboT<=0)combo=0;
    bumpT=Math.max(0,bumpT-dt);
    shake=Math.max(0,shake-dt*2);
    celebrate=Math.max(0,celebrate-dt);
    if(held&&(keys.l||keys.r)){
      held.x+=(keys.r-keys.l)*dt*280;
      clampHeld();
    }
    if(cool<=0&&!held&&!over)armHeld();
    if(!over)physics(dt);
    else{
      /* soft settle after over */
      physics(Math.min(dt,0.016));
    }
    tickBalls(dt);
    if(!over)danger(dt);
  }
  draw();
  raf=requestAnimationFrame(loop);
}

function resetState(){
  balls=[];parts=[];floats=[];held=null;nextT=randTier();
  setScore(0);combo=0;comboT=0;cool=0;warn=0;shake=0;celebrate=0;
  highest=1;over=false;frozen=false;pointing=false;uid=1;
  if(recSlot)recSlot.innerHTML='';
}

function start(){
  resetState();
  run=true;over=false;frozen=false;
  if(how)how.hidden=false;
  if(ovcover)ovcover.hidden=false;
  if(ovlogo)ovlogo.hidden=false;
  if(toLobby)toLobby.hidden=true;
  if(recSlot)recSlot.innerHTML='';
  ov.className='overlay mergestart';
  ov.hidden=true;
  if(elHud)elHud.hidden=false;
  if(nextWrap)nextWrap.hidden=false;
  if(chainEl)chainEl.hidden=false;
  armHeld();
  if(G.audio){G.audio.unlock();G.audio.play('start');G.audio.startBgm('merge')}
  last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}

function endGame(){
  if(over)return;
  over=true;pointing=false;held=null;
  shake=0.5;warn=2.6;
  if(G.audio){G.audio.stopBgm();G.audio.play('over')}
  var nb=score>best;
  if(nb){best=score;G.setBest(KEY,best);if(elBest)elBest.textContent=best}
  if(bestLine)bestLine.textContent='最高分 '+best;
  /* brief pause then show overlay */
  setTimeout(showOver,650);
}

function showOver(){
  run=false;cancelAnimationFrame(raf);draw();
  var hi=tier(highest);
  var nb=score>=best;
  ovT.textContent='堆太高了';
  ovS.innerHTML='你的分數 <span class="big">'+score+'</span><br>'+(nb&&score?'新的最高分！':'最高分 '+best)+
    '<div class="merge-hi"><img src="img/merge/'+hi.file+'.webp" alt="" width="56" height="56"><span>合成到 '+hi.name+'</span></div>';
  if(recSlot)recSlot.innerHTML=G.pickHtml();
  go.textContent='再玩一次';
  if(how)how.hidden=true;
  if(ovcover)ovcover.hidden=true;
  if(toLobby)toLobby.hidden=false;
  ov.className='overlay mergeover';
  ov.hidden=false;
}

go.addEventListener('click',function(){
  start();
});
if(G.audio)G.audio.configure({key:'pcGameMergeMuted',button:d.getElementById('muteBtn')});
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&run&&!over){
    run=false;cancelAnimationFrame(raf);
    if(G.audio)G.audio.stopBgm();
    ovT.textContent='暫停中';
    ovS.textContent='回到頁面後再開始';
    go.textContent='重新開始';
    if(how)how.hidden=false;
    if(ovcover)ovcover.hidden=false;
    if(toLobby)toLobby.hidden=true;
    if(recSlot)recSlot.innerHTML='';
    ov.className='overlay mergestart';
    ov.hidden=false;
  }
});
window.addEventListener('resize',layout);
if(window.visualViewport)window.visualViewport.addEventListener('resize',layout);
layout();requestAnimationFrame(layout);

window.PCMerge={
  start:start,
  seed:function(){
    if(!run)start();
    balls=[];parts=[];floats=[];setScore(128);highest=8;celebrate=0;warn=0;over=false;frozen=false;
    var L=innerL(),R=innerR(),B=innerB(),mid=(L+R)/2;
    function put(t,x,support){
      var b=makeBall(t,x,support-radius(t));
      b.fresh=false;b.settle=1;b.vy=0;b.vx=0;balls.push(b);return b;
    }
    var g=3;
    var a=put(1, mid-110, B);
    var c=put(3, mid-72, B);
    var e=put(4, mid-22, B);
    var f=put(6, mid+42, B);
    var h=put(2, mid+108, B);
    var p=put(5, mid-88, Math.min(a.y-a.r,c.y-c.r)+2);
    var q=put(7, mid+8, Math.min(e.y-e.r,f.y-f.r)+2);
    var r=put(8, mid-20, Math.min(p.y-p.r,q.y-q.r)+2);
    nextT=2;held=makeBall(3, mid, 0, {held:1});clampHeld();
    showNext();
    frozen=true;
    draw();
  },
  end:function(){endGame();showOver()},
  aim:function(n){if(!held)armHeld();held.x=innerL()+(innerR()-innerL())*n;clampHeld();draw()},
  drop:tryDrop,
  dropAt:function(n){if(!held)armHeld();held.x=innerL()+(innerR()-innerL())*n;clampHeld();return tryDrop()},
  place:function(t,nx,ny){
    var b=makeBall(t,innerL()+(innerR()-innerL())*(nx==null?0.5:nx),innerT()+(innerB()-innerT())*(ny==null?0.8:ny));
    b.fresh=false;balls.push(b);if(t>highest)highest=t;draw();return b;
  },
  freeze:function(on){frozen=!!on;if(on)draw()},
  nudge:function(id,vx,omega){
    for(var i=0;i<balls.length;i++){
      if(balls[i].id!==id)continue;
      if(vx!=null)balls[i].vx=vx;
      if(omega!=null)balls[i].omega=omega;
      return true;
    }
    return false;
  },
  setScore:setScore,
  info:function(){
    var maxAv=0,list=[];
    for(var i=0;i<balls.length;i++){
      var b=balls[i],av=b.omega||0;
      if(Math.abs(av)>Math.abs(maxAv))maxAv=av;
      list.push({id:b.id,t:b.t,x:+b.x.toFixed(1),y:+b.y.toFixed(1),vx:+b.vx.toFixed(3),vy:+b.vy.toFixed(3),av:+av.toFixed(4),rot:+(b.rot||0).toFixed(4),r:+b.r.toFixed(2),surf:+(Math.abs(av)*b.r).toFixed(2)});
    }
    return {
      run:run,over:over,score:score,best:best,combo:combo,cool:cool,warn:warn,
      balls:balls.length,held:held?held.t:0,next:nextT,highest:highest,
      danger:box.danger,w:W,h:H,maxAv:maxAv,list:list
    };
  },
  audio:function(){return G.audio?G.audio.info():null}
};
})();
