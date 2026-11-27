(function(){
var d=document,G=window.PCGames;
if(G&&G.guardZoom)G.guardZoom();
var cv=d.getElementById('stage'),ctx=cv.getContext('2d',{alpha:false});
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var ovlogo=d.getElementById('ovlogo'),ovcover=d.getElementById('ovcover'),how=d.getElementById('how');
var elScore=d.getElementById('score'),elBest=d.getElementById('best'),elHud=d.getElementById('hud');
var elMult=d.getElementById('mult'),elLives=d.getElementById('lives');
var bestLine=d.getElementById('bestLine'),toLobby=d.getElementById('toLobby'),recSlot=d.getElementById('recSlot');
var pads=d.getElementById('pads'),btnL=d.getElementById('btnL'),btnR=d.getElementById('btnR'),btnShoot=d.getElementById('btnShoot');
var KEY='pcGamePinballBest';
var W=0,H=0,dpr=1,run=false,frozen=false,over=false,score=0,best=G.getBest(KEY);
var last=0,raf=0,mult=1,ballsLeft=3,combo=0,comboT=0,goldFlash=0,shake=0,chargeTick=0;
var power=0,gateClosed=false,stillT=0,serveT=0,fadeBall=0,lastLaunch=0;
var heldL=0,heldR=0,heldS=0,prevL=0,prevR=0;
var pointers={},keys={l:0,r:0,s:0};
var ball=null,parts=[],floats=[],lights=[];
var walls=[],bumpers=[],gates=[],targets=[],slings=[],flips=[],railY=0,T={};
if(elBest)elBest.textContent=best;
if(bestLine)bestLine.textContent=best?'最高分 '+best:'';

function src(p){var i=new Image();i.src=p;return i}
var IM={
  ball:src('img/pinball/ball.webp'),
  cheese:src('img/pinball/bumper-cheese.webp'),
  chili:src('img/pinball/bumper-chili.webp'),
  onion:src('img/pinball/bumper-onion.webp')
};
function ready(im){return im&&im.complete&&im.naturalWidth>0}
for(var _k in IM){IM[_k].addEventListener('load',function(){if(!run)draw()})}

var SUB=10,GRAV=1850,MAXV=2800,STILL=22,MIN_POWER=0.72,LAUNCH_GAP=280;

function sfx(name,opts){if(G.audio)G.audio.play(name,opts||{})}
function setScore(n){score=Math.max(0,n|0);if(elScore)elScore.textContent=score}
function setMult(n){mult=Math.max(1,Math.min(5,n|0));if(elMult)elMult.textContent=mult+'x'}
function renderLives(){
  if(!elLives)return;
  var html='',i;
  for(i=0;i<3;i++)html+='<img src="img/pinball/ball.webp" alt="" width="20" height="20"'+(i>=ballsLeft?' class="off"':'')+'>';
  elLives.innerHTML=html;
}
function updateHud(){setScore(score);setMult(mult);renderLives();if(elBest)elBest.textContent=best}

function addWall(ax,ay,bx,by,rad,e,kind,kick){
  walls.push({ax:ax,ay:ay,bx:bx,by:by,rad:rad==null?5:rad,e:e==null?0.42:e,kind:kind||'wall',kick:kick||0});
}
function addArc(cx,cy,r,a0,a1,n,rad,e,kind){
  var i,a,b,s=(a1-a0)/n;
  for(i=0;i<n;i++){
    a=a0+i*s;b=a0+(i+1)*s;
    addWall(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(b)*r,cy+Math.sin(b)*r,rad,e,kind);
  }
}

function layout(){
  var wrap=cv.parentNode.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(1,Math.floor(wrap.width));
  H=Math.max(1,Math.floor(wrap.height));
  cv.width=W*dpr;cv.height=H*dpr;
  cv.style.width=W+'px';cv.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  var safeT=0,safeB=0;
  try{
    var cs=getComputedStyle(d.documentElement);
    /* reserved in CSS already; keep table clear of HUD/pads */
  }catch(e){}
  var hudH=54+safeT;
  var padH=Math.max(78,Math.round(H*0.105))+safeB;
  var L=Math.max(8,Math.round(W*0.035));
  var R=W-L;
  var top=hudH+4;
  var bot=H-padH-2;
  var ballR=Math.max(11.5,Math.min(14.2,(R-L)*0.038));
  var laneW=Math.max(56,Math.round(ballR*2+24)); /* walls + clearance so the ball can curve */
  var laneL=R-laneW;
  var playW=laneL-L;
  var mid=L+playW/2;
  var arcR=(R-L)*0.5;
  var cx=(L+R)/2;
  var cy=top+arcR;
  var br=Math.max(26,Math.min(38,playW*0.112));
  var flipLen=Math.max(54,Math.min(70,playW*0.26));
  var flipY=bot-28;
  var restC=Math.cos(0.52);
  var pivotGap=flipLen*2*restC + ballR*2 + 18;
  var leftPx=mid-pivotGap/2;
  var rightPx=mid+pivotGap/2;
  T={L:L,R:R,top:top,bot:bot,laneL:laneL,laneR:R,laneW:laneW,playW:playW,mid:mid,arcR:arcR,cx:cx,cy:cy,ballR:ballR,hudH:hudH,padH:padH,flipY:flipY,flipLen:flipLen};
  var bumpY=cy+T.arcR*0.55+playW*0.20-52;

  walls=[];
  /* outer cabinet rails */
  addArc(cx,cy,arcR,Math.PI,Math.PI*2,22,6,0.4,'arch');
  addWall(R,cy,R,bot-4,6,0.4,'wall');
  /* lane floor + inner lane wall (open at the arch so the ball can exit) */
  addWall(laneL+1,bot-4,R-1,bot-4,4,0.2,'laneFloor');
  addWall(laneL,bot-4,laneL,cy+10,4,0.4,'laneInner');
  /* one-way gate (toggled in collide) */
  addWall(laneL,cy-24,laneL,cy+18,6,0.35,'gateDoor');
  /* inner wireform under the arch: ball rolls right-to-left across 3 gates, then drops in */
  var channel=Math.max(46,Math.min(58,arcR*0.28));
  var innerR=arcR-channel;
  var aRight=Math.PI*2-0.10,aLeft=Math.PI-0.28;
  function apex(ang,rad){return {x:cx+Math.cos(ang)*rad,y:cy+Math.sin(ang)*rad}}
  addArc(cx,cy,innerR,aRight,aLeft,22,5,0.18,'rail');
  var ir=apex(aRight,innerR);
  addWall(laneL-2,cy+8,ir.x,ir.y+2,5,0.18,'rail'); /* entrance bridge from the lane */
  var ex=apex(aLeft,innerR);
  /* short inward lip aims the rail drop at the raised cluster, with bumper clearance */
  addWall(ex.x,ex.y,ex.x+20,ex.y+22,5,0.16,'rail');
  railY=cy-innerR*0.15;
  T.innerR=innerR;T.aLeft=aLeft;T.aRight=aRight;

  /* left wall splits into a downward kicker that feeds the raised bumper cluster */
  var midR=innerR+channel*0.45;
  var kickStartY=cy+28;
  var kickX=L+playW*0.12;
  var kickEndY=Math.max(kickStartY+24,bumpY-10);
  var leftReturnY=Math.max(kickEndY,bumpY)+br*1.25;
  addWall(L,cy,L,kickStartY,6,0.4,'wall');
  addWall(L,kickStartY,kickX,kickEndY,6,0.18,'kicker',200);
  addWall(kickX,kickEndY,L,leftReturnY,6,0.28,'wall');
  addWall(L,leftReturnY,L,bot-8,6,0.4,'wall');

  /* inlane slants funneling onto flippers (no cruel outlanes) */
  addWall(L,bot-110,leftPx-18,flipY+8,6,0.38,'wall');
  addWall(laneL,bot-110,rightPx+18,flipY+8,6,0.38,'wall');
  /* short apron walls beside drain */
  addWall(leftPx-18,flipY+8,leftPx-6,bot+6,5,0.25,'wall');
  addWall(rightPx+18,flipY+8,rightPx+6,bot+6,5,0.25,'wall');

  var saveLit=gates.map(function(g){return g.lit});
  var gAng=[Math.PI+0.42,Math.PI*1.5,Math.PI*2-0.48];
  var gMeta=[
    {id:'cheese',color:'#f5c430',glow:'#ffe36b',name:'起司'},
    {id:'bbq',color:'#c45a1c',glow:'#ff8a3a',name:'BBQ'},
    {id:'chili',color:'#d3261f',glow:'#ff6b5a',name:'香辣'}
  ];
  gates=gMeta.map(function(m,i){
    var pt=apex(gAng[i],midR);
    return {id:m.id,x:pt.x,y:pt.y,r:16,lit:!!saveLit[i],color:m.color,glow:m.glow,name:m.name};
  });

  var saveB=bumpers.map(function(b){return {flash:b.flash,pop:b.pop,cd:b.cd}});
  /* bumper cluster already lifted ~52px via bumpY */
  bumpers=[
    {id:'cheese',x:mid-playW*0.165,y:bumpY,r:br,img:IM.cheese,color:'#f5c430',score:100,flash:0,pop:0,cd:0},
    {id:'chili',x:mid+playW*0.165,y:bumpY,r:br,img:IM.chili,color:'#d3261f',score:100,flash:0,pop:0,cd:0},
    {id:'onion',x:mid,y:bumpY+br*1.55,r:br,img:IM.onion,color:'#efe6c8',score:100,flash:0,pop:0,cd:0}
  ];
  for(var i=0;i<saveB.length&&i<bumpers.length;i++){
    bumpers[i].flash=saveB[i].flash;bumpers[i].pop=saveB[i].pop;bumpers[i].cd=saveB[i].cd;
  }

  var ty=bumpY+br*2.55;
  var saveDown=targets.map(function(t){return t.down});
  targets=[
    {x:L+22,y:ty,w:18,h:28,down:!!saveDown[0],color:'#f5c430',cd:0},
    {x:L+22,y:ty+34,w:18,h:28,down:!!saveDown[1],color:'#c45a1c',cd:0},
    {x:L+22,y:ty+68,w:18,h:28,down:!!saveDown[2],color:'#d3261f',cd:0}
  ];

  var slingTop=flipY-118;
  var slingBot=flipY-18;
  slings=[
    {
      ax:L+36,ay:slingTop,bx:leftPx-28,by:slingBot-8,
      cx:L+22,cy:slingBot,
      color:'#e8a020',cd:0
    },
    {
      ax:laneL-36,ay:slingTop,bx:rightPx+28,by:slingBot-8,
      cx:laneL-22,cy:slingBot,
      color:'#e8a020',cd:0
    }
  ];
  /* sling rubber + sides */
  slings.forEach(function(s,idx){
    addWall(s.ax,s.ay,s.bx,s.by,6,0.2,'sling',560);
    addWall(s.ax,s.ay,s.cx,s.cy,5,0.3,'slingSide',0);
    addWall(s.cx,s.cy,s.bx,s.by,5,0.3,'slingSide',0);
    s.side=idx===0?-1:1;
  });

  var saveAng=flips.map(function(f){return {ang:f.ang,omega:f.omega}});
  flips=[
    {side:-1,px:leftPx,py:flipY,len:flipLen,rest:0.52,up:-0.42,ang:0.52,omega:0,rad:8,prev:0.52},
    {side:1,px:rightPx,py:flipY,len:flipLen,rest:Math.PI-0.52,up:Math.PI+0.42,ang:Math.PI-0.52,omega:0,rad:8,prev:Math.PI-0.52}
  ];
  if(saveAng[0]){flips[0].ang=saveAng[0].ang;flips[0].omega=saveAng[0].omega;flips[0].prev=saveAng[0].ang}
  if(saveAng[1]){flips[1].ang=saveAng[1].ang;flips[1].omega=saveAng[1].omega;flips[1].prev=saveAng[1].ang}

  lights=[];
  var li;
  for(li=0;li<=20;li++){
    var a=Math.PI+li*(Math.PI/20);
    lights.push({x:cx+Math.cos(a)*(arcR-7),y:cy+Math.sin(a)*(arcR-7),on:li%2===0,ph:li});
  }

  if(ball){
    ball.r=T.ballR;
    /* keep inside bounds after rotate/resize */
    if(ball.mode==='lane'){
      ball.x=Math.min(Math.max(ball.x,laneL+ball.r+2),R-ball.r-2);
      ball.y=Math.min(Math.max(ball.y,cy+ball.r),bot-4-ball.r);
    }else{
      ball.x=Math.min(Math.max(ball.x,L+ball.r+2),R-ball.r-2);
      ball.y=Math.min(Math.max(ball.y,top+ball.r),bot+40);
    }
  }
  draw();
}

function spawnBurst(x,y,color,n,spd){
  var i,a,s;
  n=n||12;
  for(i=0;i<n;i++){
    a=Math.random()*Math.PI*2;
    s=(spd||160)+Math.random()*180;
    parts.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.28+Math.random()*0.32,t:0.28+Math.random()*0.32,r:1.6+Math.random()*2.4,color:color||'#ffe36b'});
  }
}
function floatText(x,y,text,color){
  floats.push({x:x,y:y,vy:-46,t:0.75,text:text,color:color||'#fce404'});
}
function award(pts,x,y,label){
  var got=(pts|0)*mult;
  setScore(score+got);
  floatText(x,y-8,label||('+' + got),'#fce404');
}

function makeBall(x,y,mode){
  return {x:x,y:y,vx:0,vy:0,r:T.ballR,rot:0,omega:0,mode:mode||'lane',alive:true};
}
function serveBall(){
  if(!T.laneL)layout();
  var x=(T.laneL+T.R)/2;
  var y=T.bot-4-T.ballR-1;
  ball=makeBall(x,y,'lane');
  power=0;gateClosed=false;stillT=0;serveT=0;fadeBall=0;
}

function flipEnds(f){
  return {ax:f.px,ay:f.py,bx:f.px+Math.cos(f.ang)*f.len,by:f.py+Math.sin(f.ang)*f.len};
}

function hitCapsule(b,ax,ay,bx,by,rad,e,kick,omegaP){
  var abx=bx-ax,aby=by-ay;
  var apx=b.x-ax,apy=b.y-ay;
  var ab2=abx*abx+aby*aby;
  var t=ab2>0?Math.max(0,Math.min(1,(apx*abx+apy*aby)/ab2)):0;
  var cx=ax+abx*t,cy=ay+aby*t;
  var dx=b.x-cx,dy=b.y-cy;
  var dist=Math.hypot(dx,dy);
  var minD=b.r+rad;
  if(dist>=minD)return 0;
  var nx,ny,nl;
  if(dist<1e-6){
    nx=-aby;ny=abx;nl=Math.hypot(nx,ny)||1;nx/=nl;ny/=nl;
    dist=0;
  }else{nx=dx/dist;ny=dy/dist}
  var pen=minD-dist;
  b.x+=nx*pen;b.y+=ny*pen;
  var rvx=0,rvy=0;
  if(omegaP){
    rvx=-omegaP*(cy-/*pivot*/ (arguments.length>9?0:0));
  }
  /* optional pivot velocity passed as ovx,ovy */
  return {nx:nx,ny:ny,cx:cx,cy:cy,pen:pen,e:e,kick:kick||0,t:t};
}

function resolveCapsule(b,ax,ay,bx,by,rad,e,kick,ovx,ovy){
  var abx=bx-ax,aby=by-ay;
  var apx=b.x-ax,apy=b.y-ay;
  var ab2=abx*abx+aby*aby;
  var t=ab2>0?Math.max(0,Math.min(1,(apx*abx+apy*aby)/ab2)):0;
  var cx=ax+abx*t,cy=ay+aby*t;
  var dx=b.x-cx,dy=b.y-cy;
  var dist=Math.hypot(dx,dy);
  var minD=b.r+rad;
  if(dist>=minD)return false;
  var nx,ny,nl;
  if(dist<1e-6){
    nx=-aby;ny=abx;nl=Math.hypot(nx,ny)||1;nx/=nl;ny/=nl;
  }else{nx=dx/dist;ny=dy/dist}
  b.x+=nx*(minD-dist);b.y+=ny*(minD-dist);
  var rvx=ovx||0,rvy=ovy||0;
  var relx=b.vx-rvx,rely=b.vy-rvy;
  var vn=relx*nx+rely*ny;
  if(vn<0){
    var bounce=1+(e==null?0.42:e);
    b.vx-=bounce*vn*nx;
    b.vy-=bounce*vn*ny;
  }
  if(kick){b.vx+=nx*kick;b.vy+=ny*kick}
  var sp=Math.hypot(b.vx,b.vy);
  if(sp>MAXV){b.vx=b.vx/sp*MAXV;b.vy=b.vy/sp*MAXV}
  /* spin from tangential */
  var tx=-ny,ty=nx;
  var vt=(b.vx-rvx)*tx+(b.vy-rvy)*ty;
  b.omega=vt/Math.max(b.r,1)*0.6;
  return {nx:nx,ny:ny,cx:cx,cy:cy,vn:vn,t:t};
}

function collideWalls(b){
  var i,w,hit,kind,use;
  for(i=0;i<walls.length;i++){
    w=walls[i];
    if(w.kind==='gateDoor'){
      if(!gateClosed&&b.mode==='lane')continue;
      if(!gateClosed&&b.x>T.laneL-b.r*0.4)continue;
    }
    var kick=w.kick;
    /* kicker is a one-way feed: only punch falling balls, so bumper rebounds can escape to the flippers */
    if(w.kind==='kicker'&&b.vy<30)kick=0;
    hit=resolveCapsule(b,w.ax,w.ay,w.bx,w.by,w.rad,w.e,kick);
    if(hit&&w.kind==='sling'){
      var sl=slings[w.ax<T.mid?0:1];
      if(sl&&sl.cd<=0){
        sl.cd=0.16;
        award(20,hit.cx,hit.cy);
        spawnBurst(hit.cx,hit.cy,'#ffd36a',10,240);
        sfx('sling');
      }
    }
  }
}

function collideFlippers(b,dt){
  var i,f,e,ovx,ovy,hit;
  for(i=0;i<flips.length;i++){
    f=flips[i];
    e=flipEnds(f);
    /* velocity at closest point ≈ omega × r from pivot */
    /* we pass per-point in resolve by computing after closest */
    hit=function(){
      var abx=e.bx-e.ax,aby=e.by-e.ay;
      var apx=b.x-e.ax,apy=b.y-e.ay;
      var ab2=abx*abx+aby*aby;
      var t=ab2>0?Math.max(0,Math.min(1,(apx*abx+apy*aby)/ab2)):0;
      var cx=e.ax+abx*t,cy=e.ay+aby*t;
      var rx=cx-f.px,ry=cy-f.py;
      var fovx=-f.omega*ry,fovy=f.omega*rx;
      return resolveCapsule(b,e.ax,e.ay,e.bx,e.by,f.rad,0.52,0,fovx,fovy);
    }();
    if(hit){
      var tip=0.4+0.6*(hit.t==null?0.7:hit.t);
      if(Math.abs(f.omega)>4){
        /* swinging flipper: strong upward pop, more at the tip */
        var punch=Math.min(820,Math.abs(f.omega)*32)*tip;
        b.vy-=punch*0.9;
        b.vx+=(f.side<0?1:-1)*punch*0.32;
      }else if((i===0?heldL:heldR)&&Math.abs(f.ang-f.up)<0.2){
        /* held-up rubber still has some bounce */
        if(hit.vn<0)b.vy-=90*tip;
      }
    }
  }
}

function collideBumpers(b){
  var i,p,dx,dy,dist,minD,nx,ny,vn,kick;
  for(i=0;i<bumpers.length;i++){
    p=bumpers[i];
    dx=b.x-p.x;dy=b.y-p.y;
    dist=Math.hypot(dx,dy);
    minD=b.r+p.r;
    if(dist>=minD)continue;
    if(dist<1e-6){nx=0;ny=-1;dist=0}else{nx=dx/dist;ny=dy/dist}
    b.x+=nx*(minD-dist);b.y+=ny*(minD-dist);
    vn=b.vx*nx+b.vy*ny;
    if(vn<0){b.vx-=1.15*vn*nx;b.vy-=1.15*vn*ny}
    kick=440;
    b.vx+=nx*kick;b.vy+=ny*kick;
    var sp=Math.hypot(b.vx,b.vy);
    if(sp>MAXV){b.vx=b.vx/sp*MAXV;b.vy=b.vy/sp*MAXV}
    if(p.cd<=0){
      p.cd=0.12;p.flash=1;p.pop=1;
      combo=comboT>0?combo+1:1;comboT=1.15;
      award(p.score,p.x,p.y-p.r);
      spawnBurst(b.x,b.y,p.color,14,260);
      sfx('bumper',{combo:combo});
      shake=Math.min(0.22,shake+0.08);
    }
  }
}

function collideTargets(b){
  var i,t,nx,ny,cx,cy,dx,dy,px,py,hit;
  for(i=0;i<targets.length;i++){
    t=targets[i];
    if(t.down)continue;
    /* capsule-ish rect vs circle: closest point on rect */
    px=Math.min(Math.max(b.x,t.x),t.x+t.w);
    py=Math.min(Math.max(b.y,t.y),t.y+t.h);
    dx=b.x-px;dy=b.y-py;
    var dist=Math.hypot(dx,dy);
    if(dist>=b.r)continue;
    if(dist<1e-6){nx=1;ny=0}else{nx=dx/dist;ny=dy/dist}
    b.x+=nx*(b.r-dist);b.y+=ny*(b.r-dist);
    var vn=b.vx*nx+b.vy*ny;
    if(vn<0){b.vx-=1.05*vn*nx;b.vy-=1.05*vn*ny}
    if(t.cd<=0){
      t.down=true;t.cd=0.2;
      award(250,t.x+t.w/2,t.y,'+'+250*mult);
      spawnBurst(t.x+t.w/2,t.y+t.h/2,t.color,10,200);
      sfx('gate');
      maybeResetTargets();
    }
  }
}

function maybeResetTargets(){
  for(var i=0;i<targets.length;i++)if(!targets[i].down)return;
  award(500,T.L+40,targets[1].y,'全中 +'+500*mult);
  goldFlash=0.45;
  sfx('upgrade');
  setTimeout(function(){
    for(var j=0;j<targets.length;j++)targets[j].down=false;
  },700);
}

function collideGates(b){
  if(b.mode!=='play'&&b.mode!=='lane')return;
  var i,g,dx,dy;
  for(i=0;i<gates.length;i++){
    g=gates[i];
    dx=b.x-g.x;dy=b.y-g.y;
    if(dx*dx+dy*dy<(g.r+b.r)*(g.r+b.r)){
      if(!g.lit){
        g.lit=true;
        award(50,g.x,g.y-10);
        sfx('gate');
        spawnBurst(g.x,g.y,g.glow,8,140);
        maybeMult();
      }
    }
  }
}

function maybeMult(){
  for(var i=0;i<gates.length;i++)if(!gates[i].lit)return;
  if(mult<5){
    setMult(mult+1);
    goldFlash=0.8;
    floatText(T.mid,T.cy+40,mult+'x 倍率！','#fff36a');
    sfx('mult');
    spawnBurst(T.mid,railY,'#ffe36b',22,280);
  }else{
    award(1000,T.mid,railY,'倍率滿 +'+1000*mult);
    goldFlash=0.6;
    sfx('mult');
  }
  for(i=0;i<gates.length;i++)gates[i].lit=false;
}

function stepFlippers(dt){
  var i,f,target,spd,maxSpd;
  for(i=0;i<flips.length;i++){
    f=flips[i];
    f.prev=f.ang;
    target=(i===0?(heldL?f.up:f.rest):(heldR?f.up:f.rest));
    var diff=target-f.ang;
    /* rise snappy, fall a bit slower */
    maxSpd=( (i===0?heldL:heldR) ? 34 : 18);
    var step=Math.max(-maxSpd*dt,Math.min(maxSpd*dt,diff));
    f.ang+=step;
    /* snap if close */
    if(Math.abs(target-f.ang)<0.01)f.ang=target;
    f.omega=dt>0?(f.ang-f.prev)/dt:0;
  }
}

function minLaunchSpeed(){
  /* always enough to crest the arch and drop into the playfield */
  var from=ball?ball.y:(T.bot||720);
  var peak=(T.cy&&T.arcR)?(T.cy-T.arcR):(T.top||60);
  var h=Math.max(180,from-peak+140);
  return Math.sqrt(2*GRAV*h)+420;
}

function firePlunger(){
  if(!ball||!ball.alive||ball.mode!=='lane'||over){power=0;return false}
  var p=Math.max(MIN_POWER,Math.min(1,power||MIN_POWER));
  var need=minLaunchSpeed();
  ball.vy=-(need+(p-MIN_POWER)/(1-MIN_POWER)*560);
  ball.vx=-28-p*22;
  /* nudge off the exact lane center so the arch peels the ball left */
  if(T.laneL&&ball.x>(T.laneL+T.R)/2+1)ball.x=(T.laneL+T.R)/2-2;
  power=0;
  lastLaunch=performance.now();
  sfx('launch');
  spawnBurst(ball.x,ball.y+ball.r,'#fff6bf',8,120);
  return true;
}

function tryLaunch(){
  if(!run||over||frozen)return false;
  if(performance.now()-lastLaunch<LAUNCH_GAP)return false;
  if(ball&&ball.mode==='lane')return firePlunger();
  return false;
}

function loseBall(){
  if(!ball||!ball.alive)return;
  ball.alive=false;
  fadeBall=0.35;
  sfx('leak');
  spawnBurst(ball.x,Math.min(ball.y,T.bot),'#f4c14a',12,150);
  ballsLeft=Math.max(0,ballsLeft-1);
  renderLives();
  if(ballsLeft<=0){
    endGame();
    return;
  }
  serveT=0.7;
  ball=null;
  gateClosed=false;power=0;combo=0;
}

function endGame(){
  if(over)return;
  over=true;heldL=heldR=heldS=0;pointers={};
  if(G.audio){G.audio.stopBgm();G.audio.play('over')}
  if(score>best){best=score;G.setBest(KEY,best);if(elBest)elBest.textContent=best}
  if(bestLine)bestLine.textContent='最高分 '+best;
  setTimeout(showOver,700);
}

function showOver(){
  run=false;cancelAnimationFrame(raf);draw();
  var nb=score>=best&&score>0;
  ovT.textContent='球都漏完了';
  ovS.innerHTML='你的分數 <span class="big">'+score+'</span><br>'+(nb?'新的最高分！':'最高分 '+best);
  if(recSlot)recSlot.innerHTML=G.pickHtml();
  go.textContent='再玩一次';
  if(how)how.hidden=true;
  if(ovcover)ovcover.hidden=true;
  if(ovlogo)ovlogo.hidden=false;
  if(toLobby)toLobby.hidden=false;
  if(bestLine)bestLine.hidden=true;
  ov.className='overlay pinover';
  ov.hidden=false;
}

function resetState(){
  parts=[];floats=[];ball=null;power=0;gateClosed=false;stillT=0;serveT=0;
  setScore(0);setMult(1);ballsLeft=3;combo=0;comboT=0;goldFlash=0;shake=0;
  over=false;frozen=false;heldL=heldR=heldS=0;pointers={};keys={l:0,r:0,s:0};
  for(var i=0;i<gates.length;i++)gates[i].lit=false;
  for(i=0;i<targets.length;i++)targets[i].down=false;
  for(i=0;i<bumpers.length;i++){bumpers[i].flash=0;bumpers[i].pop=0;bumpers[i].cd=0}
  if(recSlot)recSlot.innerHTML='';
  updateHud();
}

function start(){
  resetState();
  run=true;over=false;frozen=false;
  if(how)how.hidden=false;
  if(ovcover)ovcover.hidden=false;
  if(ovlogo)ovlogo.hidden=false;
  if(toLobby)toLobby.hidden=true;
  if(bestLine){bestLine.hidden=false;bestLine.textContent=best?'最高分 '+best:''}
  if(recSlot)recSlot.innerHTML='';
  ov.className='overlay pinstart';
  ov.hidden=true;
  if(elHud)elHud.hidden=false;
  if(pads)pads.hidden=false;
  layout();
  serveBall();
  updateHud();
  if(G.audio){G.audio.unlock();G.audio.play('start');G.audio.startBgm('pinball')}
  last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}

function physics(dt){
  if(!T.L)return;
  dt=Math.min(0.033,dt);
  var n=SUB,h=dt/n,i,j,b,sp;
  stepFlippers(dt);
  if(heldS&&ball&&ball.mode==='lane'&&!over){
    if(power<MIN_POWER)power=MIN_POWER;
    power=Math.min(1,power+dt/0.7);
    chargeTick-=dt;
    if(chargeTick<=0){sfx('plunger',{power:power});chargeTick=0.09}
  }else if(!heldS){
    chargeTick=0;
  }
  if(serveT>0){
    serveT-=dt;
    if(serveT<=0&&!over&&!ball)serveBall();
  }
  if(comboT>0){comboT-=dt;if(comboT<=0)combo=0}
  if(goldFlash>0)goldFlash-=dt;
  if(shake>0)shake-=dt;
  for(i=0;i<bumpers.length;i++){
    if(bumpers[i].cd>0)bumpers[i].cd-=dt;
    if(bumpers[i].flash>0)bumpers[i].flash=Math.max(0,bumpers[i].flash-dt*4);
    if(bumpers[i].pop>0)bumpers[i].pop=Math.max(0,bumpers[i].pop-dt*5);
  }
  for(i=0;i<slings.length;i++)if(slings[i].cd>0)slings[i].cd-=dt;
  for(i=0;i<targets.length;i++)if(targets[i].cd>0)targets[i].cd-=dt;

  if(ball&&ball.alive){
    for(j=0;j<n;j++){
      b=ball;
      if(b.mode!=='lane'||Math.abs(b.vy)+Math.abs(b.vx)>8){
        b.vy+=GRAV*h;
      }
      b.x+=b.vx*h;b.y+=b.vy*h;
      b.rot+=(b.omega||0)*h;
      collideWalls(b);
      collideFlippers(b,h);
      collideBumpers(b);
      collideTargets(b);
      collideGates(b);
      sp=Math.hypot(b.vx,b.vy);
      if(sp>MAXV){b.vx=b.vx/sp*MAXV;b.vy=b.vy/sp*MAXV}
      /* light damping */
      b.vx*=(1-0.08*h);b.vy*=(1-0.02*h);
      /* contain */
      if(b.x<T.L+b.r-2){b.x=T.L+b.r;if(b.vx<0)b.vx*=-0.4}
      if(b.x>T.R-b.r+2){b.x=T.R-b.r;if(b.vx>0)b.vx*=-0.4}
      if(b.y<T.top-16){b.y=T.top-16;if(b.vy<0)b.vy*=-0.05}
      /* enter playfield */
      if(b.mode==='lane'&&b.x<T.laneL-b.r*0.85&&b.y<railY+30){
        b.mode='play';gateClosed=true;
      }
    }
    /* drain: center gap between resting flipper tips, or fallen below the table */
    var inGap=flips.length===2&&ball.x>flips[0].px+8&&ball.x<flips[1].px-8;
    if(ball.alive&&ball.mode==='play'&&((inGap&&ball.y>flips[0].py+10)||ball.y>T.bot+ball.r+2)&&ball.x<T.laneL-2){
      loseBall();
    }else if(ball&&ball.alive&&ball.y>H+40){
      if(ball.mode==='play')loseBall();
      else{ /* bounced in lane off-screen? reset to shelf */
        serveBall();
      }
    }
    if(ball&&ball.alive&&ball.mode==='play'){
      sp=Math.hypot(ball.vx,ball.vy);
      if(sp<STILL){
        stillT+=dt;
        if(stillT>=2){
          stillT=0;
          var toMid=Math.atan2((T.cy+T.arcR*0.9)-ball.y, T.mid-ball.x);
          var k=380+Math.random()*80;
          ball.vx+=Math.cos(toMid)*k;ball.vy+=Math.sin(toMid)*k-160;
          spawnBurst(ball.x,ball.y,'#fff6bf',8,120);
        }
      }else stillT=0;
    }else stillT=0;
  }

  for(i=parts.length-1;i>=0;i--){
    var p=parts[i];
    p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;p.vx*=0.98;
    if(p.t<=0)parts.splice(i,1);
  }
  for(i=floats.length-1;i>=0;i--){
    var f=floats[i];
    f.t-=dt;f.y+=f.vy*dt;
    if(f.t<=0)floats.splice(i,1);
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

function drawFryFlipper(f){
  var e=flipEnds(f);
  var ang=f.ang;
  ctx.save();
  ctx.translate(f.px,f.py);
  ctx.rotate(ang);
  /* golden french fry paddle */
  var L=f.len,th=f.rad*2.1;
  ctx.shadowColor='rgba(255,210,60,.55)';
  ctx.shadowBlur=10;
  var grd=ctx.createLinearGradient(0,-th,0,th);
  grd.addColorStop(0,'#fff3a0');
  grd.addColorStop(0.35,'#f5c430');
  grd.addColorStop(1,'#c47a12');
  ctx.fillStyle=grd;
  roundRect(6,-th/2,L-2,th,th/2);
  ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(120,60,0,.35)';
  ctx.lineWidth=1.2;
  ctx.stroke();
  /* fry lines */
  ctx.strokeStyle='rgba(150,70,0,.28)';
  ctx.lineWidth=1;
  var k;
  for(k=1;k<=3;k++){
    ctx.beginPath();
    ctx.moveTo(14, -th/2+k*th/4);
    ctx.lineTo(L-8, -th/2+k*th/4);
    ctx.stroke();
  }
  /* pivot cap */
  ctx.fillStyle='#c4312a';
  ctx.beginPath();ctx.arc(0,0,f.rad+2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fce404';
  ctx.beginPath();ctx.arc(0,0,f.rad-1.5,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawCurly(s){
  /* curly-fry rubber along the inner face */
  var mx=(s.ax+s.bx)/2,my=(s.ay+s.by)/2;
  ctx.save();
  ctx.strokeStyle='#e8a020';
  ctx.lineWidth=7;
  ctx.lineCap='round';
  ctx.shadowColor='rgba(255,180,40,.45)';
  ctx.shadowBlur=8;
  ctx.beginPath();
  var nx=-(s.by-s.ay),ny=s.bx-s.ax,nl=Math.hypot(nx,ny)||1;
  nx/=nl;ny/=nl;
  /* side sign so the curl sits inward */
  var sign=s.side|| -1;
  var i,t,x,y,ox;
  ctx.moveTo(s.ax,s.ay);
  for(i=1;i<=12;i++){
    t=i/12;
    x=s.ax+(s.bx-s.ax)*t;
    y=s.ay+(s.by-s.ay)*t;
    ox=Math.sin(t*Math.PI*3)*8;
    ctx.lineTo(x+nx*ox*sign,y+ny*ox*sign);
  }
  ctx.stroke();
  ctx.shadowBlur=0;
  ctx.strokeStyle='#fff3a0';
  ctx.lineWidth=2;
  ctx.globalAlpha=0.7;
  ctx.stroke();
  ctx.globalAlpha=1;
  /* clay base triangle */
  ctx.fillStyle='rgba(180,50,30,.55)';
  ctx.beginPath();
  ctx.moveTo(s.ax,s.ay);ctx.lineTo(s.bx,s.by);ctx.lineTo(s.cx,s.cy);ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw(){
  if(!W)return;
  var sx=0,sy=0;
  if(shake>0){
    sx=(Math.random()-0.5)*6*shake;
    sy=(Math.random()-0.5)*6*shake;
  }
  ctx.setTransform(dpr,0,0,dpr,sx,sy);
  /* opaque wipe — avoids iPhone Safari ghosting */
  ctx.fillStyle='#1a0a14';
  ctx.fillRect(-10,-10,W+20,H+20);

  if(!T.L){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return;
  }

  /* cabinet */
  var cab=ctx.createLinearGradient(0,T.top,0,T.bot);
  cab.addColorStop(0,'#6b1d2a');
  cab.addColorStop(1,'#3a0f18');
  ctx.fillStyle=cab;
  roundRect(T.L-10,T.top-6,T.R-T.L+20,T.bot-T.top+28,22);
  ctx.fill();

  /* playfield felt */
  ctx.save();
  roundRect(T.L-2,T.top+2,T.laneL-T.L+8,T.bot-T.top+8,16);
  ctx.clip();
  var felt=ctx.createLinearGradient(0,T.top,0,T.bot);
  felt.addColorStop(0,'#1d5a32');
  felt.addColorStop(0.5,'#147038');
  felt.addColorStop(1,'#0c4a28');
  ctx.fillStyle=felt;
  ctx.fillRect(0,0,W,H);
  /* subtle light stripes */
  ctx.globalAlpha=0.07;
  ctx.fillStyle='#fff6bf';
  var gy;
  for(gy=T.top;gy<T.bot;gy+=28)ctx.fillRect(T.L,gy,T.playW,10);
  ctx.globalAlpha=1;
  ctx.restore();

  /* lane well */
  ctx.fillStyle='#2a0f16';
  ctx.fillRect(T.laneL-1,T.cy,T.R-T.laneL+8,T.bot-T.cy+10);

  /* neon rails */
  function strokeWalls(kind,color,width,blur){
    ctx.save();
    ctx.strokeStyle=color;
    ctx.lineWidth=width;
    ctx.lineCap='round';
    ctx.shadowColor=color;
    ctx.shadowBlur=blur||0;
    ctx.beginPath();
    var i,w,ok=false;
    for(i=0;i<walls.length;i++){
      w=walls[i];
      if(kind&&w.kind!==kind)continue;
      if(w.kind==='gateDoor'&&!gateClosed)continue;
      if(w.kind==='sling'||w.kind==='slingSide')continue;
      ctx.moveTo(w.ax,w.ay);ctx.lineTo(w.bx,w.by);
      ok=true;
    }
    ctx.stroke();
    ctx.restore();
  }
  strokeWalls('arch','#fce404',7,14);
  strokeWalls('arch','#fff6bf',2.5,0);
  strokeWalls('wall','#f0c14a',6,8);
  strokeWalls('kicker','#e89220',7,10);
  strokeWalls('kicker','#ffe36b',2.5,0);
  strokeWalls('laneInner','#f0c14a',6,8);
  if(gateClosed)strokeWalls('gateDoor','#ff8a3a',6,10);
  strokeWalls('rail','#9ad4ff',6,12);
  strokeWalls('rail','#e8f6ff',2,0);
  strokeWalls('laneFloor','#c47a12',5,0);

  /* arch lights */
  var li,lg,on;
  for(li=0;li<lights.length;li++){
    lg=lights[li];
    on=(li+((performance.now()/280)|0))%3!==0;
    ctx.beginPath();
    ctx.fillStyle=on?'#fff36a':'#7a5a18';
    ctx.shadowColor='#fce404';
    ctx.shadowBlur=on?10:0;
    ctx.arc(lg.x,lg.y,3.2,0,Math.PI*2);
    ctx.fill();
  }
  ctx.shadowBlur=0;

  /* multiplier gates */
  var g,i;
  for(i=0;i<gates.length;i++){
    g=gates[i];
    ctx.save();
    ctx.translate(g.x,g.y);
    ctx.fillStyle=g.lit?g.color:'rgba(20,20,20,.45)';
    ctx.shadowColor=g.lit?g.glow:'transparent';
    ctx.shadowBlur=g.lit?16:0;
    ctx.beginPath();ctx.arc(0,0,g.r,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=3;
    ctx.strokeStyle=g.lit?g.glow:'rgba(255,255,255,.28)';
    ctx.stroke();
    ctx.shadowBlur=0;
    ctx.fillStyle=g.lit?'#fff':'#d7eadc';
    ctx.font='bold 9px -apple-system,sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(g.name,0,0);
    ctx.restore();
  }

  /* drop targets */
  var t;
  for(i=0;i<targets.length;i++){
    t=targets[i];
    if(t.down){
      ctx.globalAlpha=0.28;
      ctx.fillStyle=t.color;
      roundRect(t.x,t.y+t.h-6,t.w,6,2);ctx.fill();
      ctx.globalAlpha=1;
      continue;
    }
    ctx.save();
    ctx.fillStyle=t.color;
    ctx.shadowColor=t.color;
    ctx.shadowBlur=8;
    roundRect(t.x,t.y,t.w,t.h,5);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,.4)';
    roundRect(t.x+3,t.y+3,t.w-6,8,3);ctx.fill();
    ctx.restore();
  }

  /* slings */
  for(i=0;i<slings.length;i++)drawCurly(slings[i]);

  /* bumpers */
  var p,scale,im;
  for(i=0;i<bumpers.length;i++){
    p=bumpers[i];
    scale=1+p.pop*0.22;
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.scale(scale,scale);
    ctx.beginPath();
    ctx.arc(0,0,p.r+8,0,Math.PI*2);
    ctx.strokeStyle=p.flash>0?'#fff6bf':p.color;
    ctx.lineWidth=p.flash>0?6:3;
    ctx.shadowColor=p.color;
    ctx.shadowBlur=p.flash>0?22:12;
    ctx.globalAlpha=0.9;
    ctx.stroke();
    ctx.globalAlpha=1;
    ctx.shadowBlur=0;
    im=p.img;
    var sz=p.r*2.15;
    if(ready(im)){
      ctx.drawImage(im,-sz/2,-sz/2-2,sz,sz);
    }else{
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  /* plunger in the lane */
  var px=(T.laneL+T.R)/2,pTop=T.bot-4,pLen=36+power*46;
  ctx.save();
  ctx.fillStyle='#fce404';
  ctx.strokeStyle='#8a5a00';
  ctx.lineWidth=2;
  roundRect(px-6,pTop,12,18,3);ctx.fill();ctx.stroke();
  ctx.fillStyle='#c4312a';
  roundRect(px-4,pTop+8,8,pLen,3);ctx.fill();
  ctx.restore();

  /* flippers on top of table, under the ball */
  for(i=0;i<flips.length;i++)drawFryFlipper(flips[i]);

  /* drain hint */
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.moveTo(flips[0].px+8,T.bot-4);
  ctx.lineTo(flips[1].px-8,T.bot-4);
  ctx.lineTo(flips[1].px-4,T.bot+16);
  ctx.lineTo(flips[0].px+4,T.bot+16);
  ctx.closePath();ctx.fill();

  /* ball */
  if(ball&&ball.alive){
    ctx.save();
    ctx.translate(ball.x,ball.y);
    ctx.rotate(ball.rot||0);
    ctx.shadowColor='rgba(0,0,0,.45)';
    ctx.shadowBlur=8;
    var brs=ball.r*2.15;
    if(ready(IM.ball))ctx.drawImage(IM.ball,-brs/2,-brs/2,brs,brs);
    else{
      ctx.fillStyle='#f0c14a';
      ctx.beginPath();ctx.arc(0,0,ball.r,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  /* particles */
  for(i=0;i<parts.length;i++){
    p=parts[i];
    ctx.globalAlpha=Math.max(0,p.t/p.life);
    ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;

  /* floating scores */
  ctx.font='bold 15px -apple-system,"PingFang TC",sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  for(i=0;i<floats.length;i++){
    var fl=floats[i];
    ctx.globalAlpha=Math.max(0,fl.t/0.75);
    ctx.fillStyle=fl.color;
    ctx.strokeStyle='rgba(0,0,0,.45)';
    ctx.lineWidth=3;
    ctx.strokeText(fl.text,fl.x,fl.y);
    ctx.fillText(fl.text,fl.x,fl.y);
  }
  ctx.globalAlpha=1;

  /* charge meter */
  if(run&&!over&&ball&&ball.mode==='lane'&&power>0){
    var mx=T.laneL-10,my=T.bot-90,mh=70,mw=8;
    ctx.fillStyle='rgba(0,0,0,.4)';
    roundRect(mx,my,mw,mh,4);ctx.fill();
    ctx.fillStyle='#fce404';
    var fh=mh*power;
    roundRect(mx,my+mh-fh,mw,fh,4);ctx.fill();
  }

  /* gold multiplier flash */
  if(goldFlash>0){
    ctx.save();
    var grd2=ctx.createRadialGradient(T.mid,railY,10,T.mid,railY,T.playW*0.7);
    grd2.addColorStop(0,'rgba(255,230,80,'+(0.38*Math.min(1,goldFlash*2))+')');
    grd2.addColorStop(1,'rgba(255,230,80,0)');
    ctx.fillStyle=grd2;
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function loop(now){
  var dt=Math.min(0.033,(now-last)/1000)||0.016;
  last=now;
  if(run&&!frozen)physics(dt);
  /* rising-edge flipper sound */
  if(heldL&&!prevL)sfx('flipper');
  if(heldR&&!prevR)sfx('flipper');
  prevL=heldL;prevR=heldR;
  if(btnL)btnL.classList.toggle('held',!!heldL);
  if(btnR)btnR.classList.toggle('held',!!heldR);
  if(btnShoot)btnShoot.classList.toggle('held',!!heldS);
  draw();
  raf=requestAnimationFrame(loop);
}

function syncHeld(){
  var l=keys.l,r=keys.r,s=keys.s,id;
  for(id in pointers){
    if(pointers[id]==='L')l=1;
    else if(pointers[id]==='R')r=1;
    else if(pointers[id]==='S')s=1;
  }
  heldL=l;heldR=r;heldS=s;
}

function kindFromPoint(x,y,target){
  if(target&&target.closest){
    if(target.closest('#btnL,.pbtn-l'))return 'L';
    if(target.closest('#btnR,.pbtn-r'))return 'R';
    if(target.closest('#btnShoot,.pbtn-shoot'))return 'S';
    if(target.closest('a,button.hud-mute,.hud-mute,.runback,.overlay'))return null;
  }
  if(!T.L)return x<W/2?'L':'R';
  /* plunger / launch lane */
  if(x>=T.laneL-6&&y>=T.cy)return 'S';
  var mid=(T.L+T.laneL)/2;
  return x<mid?'L':'R';
}

function holdStart(id,kind){
  if(!kind)return;
  pointers[id]=kind;
  if(kind==='S'&&ball&&ball.mode==='lane'){
    /* a tap already has enough power to clear the arch; hold only adds punch */
    if(power<MIN_POWER)power=MIN_POWER;
  }
  syncHeld();
}
function holdEnd(id,doLaunch){
  var k=pointers[id];
  if(!k)return;
  delete pointers[id];
  syncHeld();
  if(doLaunch&&k==='S'&&!heldS)tryLaunch();
}

function onDown(e){
  if(!run||over)return;
  var kind=kindFromPoint(e.clientX,e.clientY,e.target);
  if(!kind)return;
  if(e.cancelable)e.preventDefault();
  holdStart('p'+e.pointerId,kind);
  try{if(e.target&&e.target.setPointerCapture)e.target.setPointerCapture(e.pointerId)}catch(err){}
}
function onUp(e){
  holdEnd('p'+e.pointerId,true);
}
function onCancel(e){
  /* iPhone Safari often fires pointercancel mid-press; do not drop the shot.
     Launch after a tick if no pointer/touch is still holding the plunger. */
  holdEnd('p'+e.pointerId,false);
  if(!heldS){
    setTimeout(function(){if(!heldS)tryLaunch()},40);
  }
}

function touchPos(tr){return {x:tr.clientX,y:tr.clientY,target:document.elementFromPoint(tr.clientX,tr.clientY)||cv}}
function onTouchStart(e){
  if(!run||over)return;
  var i,tr,k,pos;
  for(i=0;i<e.changedTouches.length;i++){
    tr=e.changedTouches[i];
    pos=touchPos(tr);
    k=kindFromPoint(pos.x,pos.y,pos.target||e.target);
    if(!k)continue;
    holdStart('t'+tr.identifier,k);
  }
  if(e.cancelable)e.preventDefault();
}
function onTouchEnd(e){
  var i,tr;
  for(i=0;i<e.changedTouches.length;i++){
    tr=e.changedTouches[i];
    holdEnd('t'+tr.identifier,true);
  }
  if(e.cancelable)e.preventDefault();
}

[cv,btnL,btnR,btnShoot].forEach(function(el){
  if(!el)return;
  el.addEventListener('pointerdown',onDown,{passive:false});
  el.addEventListener('touchstart',onTouchStart,{passive:false});
  el.addEventListener('touchend',onTouchEnd,{passive:false});
  el.addEventListener('touchcancel',onTouchEnd,{passive:false});
});
window.addEventListener('pointerup',onUp);
window.addEventListener('pointercancel',onCancel);
if(btnShoot){
  btnShoot.addEventListener('click',function(e){
    if(e&&e.preventDefault)e.preventDefault();
    if(!heldS)tryLaunch();
  });
}

d.addEventListener('keydown',function(e){
  if(e.code==='ArrowLeft'||e.code==='KeyA'){keys.l=1;syncHeld();if(e.preventDefault)e.preventDefault()}
  else if(e.code==='ArrowRight'||e.code==='KeyD'){keys.r=1;syncHeld();if(e.preventDefault)e.preventDefault()}
  else if(e.code==='Space'){keys.s=1;syncHeld();if(e.preventDefault)e.preventDefault()}
});
d.addEventListener('keyup',function(e){
  if(e.code==='ArrowLeft'||e.code==='KeyA'){keys.l=0;syncHeld()}
  else if(e.code==='ArrowRight'||e.code==='KeyD'){keys.r=0;syncHeld()}
  else if(e.code==='Space'){keys.s=0;syncHeld();tryLaunch()}
});

go.addEventListener('click',function(){start()});
if(G.audio)G.audio.configure({key:'pcGamePinballMuted',button:d.getElementById('muteBtn')});
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&run&&!over){
    run=false;cancelAnimationFrame(raf);
    if(G.audio)G.audio.pauseBgm();
    ovT.textContent='暫停中';
    ovS.textContent='回到頁面後再開始';
    go.textContent='重新開始';
    if(how)how.hidden=false;
    if(ovcover)ovcover.hidden=false;
    if(toLobby)toLobby.hidden=true;
    if(recSlot)recSlot.innerHTML='';
    ov.className='overlay pinstart';
    ov.hidden=false;
  }
});
window.addEventListener('resize',layout);
if(window.visualViewport)window.visualViewport.addEventListener('resize',layout);
layout();requestAnimationFrame(layout);

window.PCPinball={
  start:start,
  launch:function(p){if(!run)start();if(!ball||ball.mode!=='lane')serveBall();power=p==null?1:p;firePlunger()},
  setFlippers:function(l,r){heldL=!!l;heldR=!!r},
  drain:function(){if(!run)start();if(!ball){ballsLeft=Math.max(1,ballsLeft);serveBall();ball.mode='play';gateClosed=true}loseBall()},
  end:function(){ballsLeft=0;endGame();showOver()},
  seed:function(){
    if(!run)start();
    frozen=true;over=false;
    if(!T.L)layout();
    gateClosed=true;
    setScore(16800);setMult(3);combo=6;comboT=2;ballsLeft=2;goldFlash=0.85;shake=0.15;
    for(var i=0;i<gates.length;i++)gates[i].lit=true;
    bumpers[0].flash=1;bumpers[0].pop=0.8;
    bumpers[1].flash=0.6;bumpers[2].flash=0.4;
    var p=bumpers[0],q=bumpers[2];
    ball=makeBall((p.x+q.x)/2,(p.y+q.y)/2-8,'play');
    ball.vx=160;ball.vy=-80;
    parts=[];floats=[];
    spawnBurst(ball.x,ball.y,'#f5c430',20,300);
    spawnBurst(p.x,p.y,'#ffe36b',12,200);
    spawnBurst(bumpers[1].x,bumpers[1].y,'#d3261f',10,180);
    floatText(ball.x,ball.y-28,'+'+300,'#fce404');
    floatText(T.mid,T.cy-20,'3x 倍率！','#fff36a');
    updateHud();
    if(elHud)elHud.hidden=false;
    if(pads)pads.hidden=false;
    ov.hidden=true;
    draw();
  },
  freeze:function(on){frozen=!!on;if(on)draw()},
  info:function(){
    return {
      run:run,over:over,frozen:frozen,score:score,best:best,mult:mult,
      ballsLeft:ballsLeft,combo:combo,power:+power.toFixed(3),
      gateClosed:gateClosed,heldL:heldL,heldR:heldR,heldS:heldS,
      ball:ball?{x:+ball.x.toFixed(1),y:+ball.y.toFixed(1),vx:+ball.vx.toFixed(1),vy:+ball.vy.toFixed(1),mode:ball.mode,alive:ball.alive,r:ball.r}:null,
      gates:gates.map(function(g){return {id:g.id,lit:g.lit}}),
      targets:targets.map(function(t){return !!t.down}),
      flips:flips.map(function(f){return {ang:+f.ang.toFixed(3),omega:+f.omega.toFixed(2)}}),
      bumpers:bumpers.map(function(b){return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),r:b.r,flash:+b.flash.toFixed(2),pop:+b.pop.toFixed(2)}}),
      w:W,h:H,table:T.L?{L:T.L,R:T.R,laneL:T.laneL,top:T.top,bot:T.bot,railY:railY}:null
    };
  },
  audio:function(){return G.audio?G.audio.info():null}
};
})();
