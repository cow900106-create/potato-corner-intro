(function(){
var d=document,G=window.PCGames;
var cv=d.getElementById('stage'),ctx=cv.getContext('2d',{alpha:false});
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var ovlogo=d.getElementById('ovlogo'),ovcover=d.getElementById('ovcover'),how=d.getElementById('how');
var elScore=d.getElementById('score'),elBest=d.getElementById('best'),elLevel=d.getElementById('level'),elHud=d.getElementById('hud');
var nextBtn=d.getElementById('nextBtn'),nextIm=d.getElementById('nextIm');
var bestLine=d.getElementById('bestLine'),toLobby=d.getElementById('toLobby'),recSlot=d.getElementById('recSlot');
var KEY='pcGameBubbleBest';
var COLS=8,HEX=Math.sqrt(3);
var W=0,H=0,dpr=1,R=22,boardL=0,boardR=0,boardT=0,dangerY=0,shootX=0,shootY=0;
var run=false,over=false,score=0,best=G.getBest(KEY),level=1,busy=0,rowShift=0,rowDropping=false;
var last=0,raf=0,combo=0,shotsLeft=6,shotsMax=6,shotCount=0,celebrate=0,shake=0;
var aiming=false,pid=0,aimX=0,aimY=0,aimAng=-Math.PI/2,aimPts=[],aimGhost=null;
var current=null,nextBall=null,flying=null,grid=[],falling=[],parts=[],floats=[];
var lastSnap=null,lastBounces=0,lastPop=0,lastFall=0,cleared=0,topParity=0;
if(elBest)elBest.textContent=best;
if(bestLine)bestLine.textContent=best?'最高分 '+best:'';

var COLORS=[
  {id:'cheese',name:'起司',color:'#f5a018',tint:'#ffd36a'},
  {id:'chili',name:'香辣',color:'#e3262f',tint:'#ff7a7a'},
  {id:'onion',name:'洋蔥',color:'#2ecf8a',tint:'#8af0c0'},
  {id:'bbq',name:'BBQ',color:'#6a3518',tint:'#c47a4a'},
  {id:'purple',name:'紫薯',color:'#8b4dff',tint:'#c9a0ff'}
];
var BOMB={id:'bomb',name:'炸彈',color:'#ffd24a',tint:'#fff1a8'};
var META={
  cheese:{cx:0.499,cy:0.592,r:0.393},
  chili:{cx:0.499,cy:0.587,r:0.385},
  onion:{cx:0.499,cy:0.608,r:0.391},
  bbq:{cx:0.499,cy:0.605,r:0.391},
  purple:{cx:0.500,cy:0.598,r:0.392},
  bomb:{cx:0.499,cy:0.629,r:0.372}
};
function src(p){var i=new Image();i.src=p;return i}
var IM={};
['cheese','chili','onion','bbq','purple','bomb','cannon'].forEach(function(k){
  IM[k]=src('img/bubble/'+k+'.webp');
  IM[k].addEventListener('load',function(){if(k==='cannon')layout();else draw()});
});
var CANNON={px:0.480,py:0.742,mx:0.468,my:0.125};
function ready(im){return im&&im.complete&&im.naturalWidth>0}
function colorById(id){
  if(id==='bomb')return BOMB;
  for(var i=0;i<COLORS.length;i++)if(COLORS[i].id===id)return COLORS[i];
  return COLORS[0];
}
function palette(){
  var n=level<=1?3:level===2?4:5;
  return COLORS.slice(0,n);
}
function sfx(name,opts){if(G.audio)G.audio.play(name,opts||{})}

function rowParity(r){return (r+topParity)&1}
function colsInRow(r){return rowParity(r)===0?COLS:COLS-1}
function cellX(c,r){return boardL+R+c*(2*R)+(rowParity(r)?R:0)}
function cellY(r){return boardT+R+r*(R*HEX)+rowShift}
function valid(c,r){return r>=0&&c>=0&&c<colsInRow(r)}
function neighbors(c,r){
  return rowParity(r)===0
    ?[[c-1,r],[c+1,r],[c-1,r-1],[c,r-1],[c-1,r+1],[c,r+1]]
    :[[c-1,r],[c+1,r],[c,r-1],[c+1,r-1],[c,r+1],[c+1,r+1]];
}
function get(c,r){return (grid[r]&&grid[r][c])||null}
function setCell(c,r,ball){
  if(!grid[r])grid[r]=[];
  grid[r][c]=ball||null;
  if(ball){ball.c=c;ball.r=r;ball.x=cellX(c,r);ball.y=cellY(r)}
}
function eachBall(fn){
  for(var r=0;r<grid.length;r++){
    if(!grid[r])continue;
    for(var c=0;c<grid[r].length;c++){
      var b=grid[r][c];
      if(b)fn(b,c,r);
    }
  }
}
function maxFilledRow(){
  var m=-1;
  eachBall(function(b){if(b.r>m)m=b.r});
  return m;
}
function ballCount(){
  var n=0;eachBall(function(){n++});return n;
}
function colorsOnBoard(){
  var seen={},list=[];
  eachBall(function(b){
    if(b.id==='bomb')return;
    if(!seen[b.id]){seen[b.id]=1;list.push(b.id)}
  });
  return list;
}
function relayoutCells(){eachBall(function(b){b.x=cellX(b.c,b.r);b.y=cellY(b.r)})}

function setScore(n){score=Math.max(0,n|0);if(elScore)elScore.textContent=score}
function setLevel(n){level=Math.max(1,n|0);if(elLevel)elLevel.textContent=level}
function showQueue(){
  if(nextIm&&nextBall){
    var col=colorById(nextBall);
    nextIm.src='img/bubble/'+nextBall+'.webp';
    nextIm.alt=col.name;
    if(nextBtn){
      nextBtn.style.setProperty('--glow',col.color);
      nextBtn.style.borderColor=col.color;
      nextBtn.style.boxShadow='0 0 0 3px rgba(255,255,255,.92),0 0 16px '+col.color+',0 4px 0 rgba(0,0,0,.28),0 6px 12px rgba(0,0,0,.2)';
      var lab=nextBtn.querySelector('span');
      if(lab)lab.textContent='下一顆·'+col.name;
    }
  }
}

function layout(){
  var r=cv.parentNode.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  W=Math.max(1,Math.floor(r.width));
  H=Math.max(1,Math.floor(r.height));
  cv.width=W*dpr;cv.height=H*dpr;
  cv.style.width=W+'px';cv.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  var pad=Math.max(8,Math.round(W*0.02));
  boardL=pad+4;boardR=W-pad-4;
  R=(boardR-boardL)/(COLS*2);
  boardT=Math.max(52,Math.round(H*0.075))+8;
  var bot=Math.max(168,Math.round(H*0.205));
  dangerY=H-bot;
  shootX=(boardL+boardR)/2;
  shootY=H-Math.max(52,Math.round(bot*0.30)); /* axle / wheel pivot */
  relayoutCells();
  placeNextBtn();
  if(aiming)buildAim();
  draw();
}
function cannonScale(){
  var im=IM.cannon,w=ready(im)?im.naturalWidth:522,h=ready(im)?im.naturalHeight:720;
  var dist=Math.hypot((CANNON.mx-CANNON.px)*w,(CANNON.my-CANNON.py)*h);
  return (3.45*R)/Math.max(40,dist);
}
function barrelLen(){
  var im=IM.cannon,sc=cannonScale();
  var w=ready(im)?im.naturalWidth:522,h=ready(im)?im.naturalHeight:720;
  return Math.hypot((CANNON.mx-CANNON.px)*w,(CANNON.my-CANNON.py)*h)*sc;
}
function aimNow(){return (aiming||flying)?aimAng:-Math.PI/2}
function muzzleAt(ang){
  if(ang==null)ang=aimNow();
  var len=barrelLen();
  return {x:shootX+Math.cos(ang)*len,y:shootY+Math.sin(ang)*len};
}
function placeNextBtn(){
  if(!nextBtn)return;
  var x=Math.min(W-46,boardR-36);
  var y=Math.min(H-46,shootY+R*0.15);
  nextBtn.style.left=x+'px';
  nextBtn.style.top=y+'px';
}

function randId(fromBoard){
  var list=fromBoard?colorsOnBoard():null;
  var pal=palette();
  var ids=[];
  if(list&&list.length){
    for(var i=0;i<list.length;i++)ids.push(list[i]);
  }else{
    for(var j=0;j<pal.length;j++)ids.push(pal[j].id);
  }
  return ids[Math.floor(Math.random()*ids.length)]||pal[0].id;
}
function nextInQueue(){
  /* every 8th shot, or after a juicy combo, deal a rainbow bomb */
  if(shotCount>0&&shotCount%8===0)return 'bomb';
  if(lastPop+lastFall>=6&&Math.random()<0.55)return 'bomb';
  return randId(true);
}
function refillQueue(){
  if(!current)current=randId(true);
  if(!nextBall)nextBall=nextInQueue();
  if(nextBall===current&&nextBall!=='bomb'&&Math.random()<0.25)nextBall=randId(true);
  showQueue();
}

function sameGroup(c,r,id){
  var out=[],seen={},q=[[c,r]];
  seen[r+','+c]=1;
  while(q.length){
    var p=q.pop(),cell=get(p[0],p[1]);
    if(!cell||cell.id!==id)continue;
    out.push(cell);
    var nb=neighbors(p[0],p[1]);
    for(var i=0;i<nb.length;i++){
      var nc=nb[i][0],nr=nb[i][1],k=nr+','+nc;
      if(seen[k]||!valid(nc,nr)||!get(nc,nr))continue;
      if(get(nc,nr).id!==id)continue;
      seen[k]=1;q.push([nc,nr]);
    }
  }
  return out;
}
function ceilingConnected(){
  var seen={},q=[];
  if(grid[0]){
    for(var c=0;c<colsInRow(0);c++){
      if(get(c,0)){seen['0,'+c]=1;q.push([c,0])}
    }
  }
  while(q.length){
    var p=q.pop(),nb=neighbors(p[0],p[1]);
    for(var i=0;i<nb.length;i++){
      var nc=nb[i][0],nr=nb[i][1],k=nr+','+nc;
      if(seen[k]||!valid(nc,nr)||!get(nc,nr))continue;
      seen[k]=1;q.push([nc,nr]);
    }
  }
  return seen;
}
function cellsInRings(c,r,rings){
  var out=[],seen={};
  var q=[[c,r,0]];
  seen[r+','+c]=1;
  while(q.length){
    var p=q.shift(),cell=get(p[0],p[1]);
    if(cell)out.push(cell);
    if(p[2]>=rings)continue;
    var nb=neighbors(p[0],p[1]);
    for(var i=0;i<nb.length;i++){
      var nc=nb[i][0],nr=nb[i][1],k=nr+','+nc;
      if(seen[k]||!valid(nc,nr))continue;
      seen[k]=1;q.push([nc,nr,p[2]+1]);
    }
  }
  return out;
}

function wouldMatch(c,r,id){
  /* temporary occupancy test */
  var fake={id:id,c:c,r:r};
  if(!grid[r])grid[r]=[];
  var prev=grid[r][c];
  grid[r][c]=fake;
  var g=sameGroup(c,r,id);
  grid[r][c]=prev;
  return g.length>=3;
}
function fillLevel(){
  grid=[];falling=[];parts=[];floats=[];flying=null;rowShift=0;rowDropping=false;topParity=0;
  var rows=Math.min(7,4+Math.min(3,level));
  var pal=palette();
  var tries=0;
  for(var r=0;r<rows;r++){
    grid[r]=[];
    for(var c=0;c<colsInRow(r);c++){
      var ids=pal.map(function(p){return p.id});
      /* shuffle */
      for(var i=ids.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=ids[i];ids[i]=ids[j];ids[j]=t}
      var pick=ids[0];
      for(var k=0;k<ids.length;k++){
        if(!wouldMatch(c,r,ids[k])){pick=ids[k];break}
      }
      var b={id:pick,pop:0,scale:1};
      setCell(c,r,b);
      tries++;
    }
  }
  current=null;nextBall=null;shotCount=0;
  shotsMax=level>=5?5:6;shotsLeft=shotsMax;
  lastPop=0;lastFall=0;combo=0;
  refillQueue();
}

function spawnFloat(x,y,text,color){
  floats.push({x:x,y:y,text:text,color:color||'#fce404',life:0.9,vy:-36});
}
function spawnBurst(x,y,id,n){
  var col=colorById(id);
  n=n||10;
  for(var i=0;i<n;i++){
    var a=Math.random()*Math.PI*2,sp=60+Math.random()*180;
    parts.push({
      x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-40,
      life:0.35+Math.random()*0.35,r:2+Math.random()*3.5,
      color:Math.random()<0.5?col.color:col.tint
    });
  }
}

function popCells(list,kind){
  if(!list||!list.length)return 0;
  var n=list.length;
  for(var i=0;i<n;i++){
    var b=list[i];
    if(!get(b.c,b.r))continue;
    setCell(b.c,b.r,null);
    spawnBurst(b.x,b.y,b.id,kind==='bomb'?16:10);
  }
  return n;
}

function resolve(start){
  if(!start)return;
  var popped,kind='pop';
  if(start.id==='bomb'){
    popped=cellsInRings(start.c,start.r,2);
    kind='bomb';
  }else{
    var g=sameGroup(start.c,start.r,start.id);
    if(g.length>=3)popped=g;
  }
  if(!popped||!popped.length){
    lastPop=0;lastFall=0;combo=0;
    afterResolve(false);
    return;
  }
  var cx=0,cy=0;
  for(var i=0;i<popped.length;i++){cx+=popped[i].x;cy+=popped[i].y}
  cx/=popped.length;cy/=popped.length;
  var n=popCells(popped,kind);
  lastPop=n;
  combo=1;
  var pts=n*10;
  if(kind==='bomb')pts=n*20;
  setScore(score+pts);
  spawnFloat(cx,cy,'+'+pts+(kind==='bomb'?' 炸彈':''),kind==='bomb'?'#ffe566':'#fce404');
  if(kind==='bomb')sfx('bomb');else sfx('pop',{combo:1,n:n});
  /* hanging after pops */
  var hang=[];
  var connected=ceilingConnected();
  eachBall(function(b,c,r){
    if(!connected[r+','+c])hang.push(b);
  });
  lastFall=hang.length;
  if(hang.length){
    combo=2;
    var dropPts=hang.length*50;
    setScore(score+dropPts);
    var hx=0,hy=0;
    for(var h=0;h<hang.length;h++){
      var hb=hang[h];
      setCell(hb.c,hb.r,null);
      hx+=hb.x;hy+=hb.y;
      falling.push({
        id:hb.id,x:hb.x,y:hb.y,vx:(Math.random()-0.5)*40,vy:30+Math.random()*40,rot:0,life:0.9
      });
      spawnBurst(hb.x,hb.y,hb.id,6);
    }
    spawnFloat(hx/hang.length,hy/hang.length+8,'掉落 +'+dropPts,'#fff4b0');
    sfx('fall',{n:hang.length});
  }
  busy=Math.max(busy,0.42);
  afterResolve(true);
}

function afterResolve(didClear){
  if(ballCount()===0){
    busy=Math.max(busy,0.7);
    celebrate=1.1;
    var bonus=500+level*200+shotsLeft*30;
    setScore(score+bonus);
    spawnFloat(shootX,boardT+R*4,'過關 +'+bonus,'#fff18a');
    sfx('win');
    setTimeout(function(){
      if(over||!run)return;
      setLevel(level+1);
      cleared++;
      fillLevel();
      draw();
    },750);
    return;
  }
  if(!didClear)scheduleDrop();
  checkOver();
}

function scheduleDrop(){
  shotsLeft-=1;
  if(shotsLeft>0)return;
  shotsLeft=shotsMax;
  startRowDrop();
}
function startRowDrop(){
  if(rowDropping||over)return;
  rowDropping=true;rowShift=0;busy=Math.max(busy,0.38);
  sfx('wave');
}
function finishRowDrop(){
  var maxr=maxFilledRow();
  var moved=[];
  for(var r=maxr;r>=0;r--){
    if(!grid[r])continue;
    for(var c=0;c<colsInRow(r);c++){
      var b=get(c,r);
      if(!b)continue;
      grid[r][c]=null;
      moved.push({c:c,r:r+1,b:b});
    }
  }
  topParity^=1;
  grid=[];
  for(var i=0;i<moved.length;i++)setCell(moved[i].c,moved[i].r,moved[i].b);
  var pal=palette();
  if(!grid[0])grid[0]=[];
  for(var c0=0;c0<colsInRow(0);c0++){
    var ids=pal.map(function(p){return p.id});
    for(var i2=ids.length-1;i2>0;i2--){var j=Math.floor(Math.random()*(i2+1));var t=ids[i2];ids[i2]=ids[j];ids[j]=t}
    var pick=ids[0];
    for(var k=0;k<ids.length;k++)if(!wouldMatch(c0,0,ids[k])){pick=ids[k];break}
    setCell(c0,0,{id:pick,pop:0,scale:1});
  }
  rowShift=0;rowDropping=false;
  relayoutCells();
  checkOver();
}

function checkOver(){
  if(over)return;
  var hit=false;
  eachBall(function(b){if(b.y+R>=dangerY-1)hit=true});
  if(hit)endGame();
}

function nearestSnap(x,y,hit){
  var maxr=Math.max(maxFilledRow()+2,1,Math.ceil((dangerY-boardT)/(R*HEX))+1);
  var cands=[];
  for(var r=0;r<maxr;r++){
    for(var c=0;c<colsInRow(r);c++){
      if(get(c,r))continue;
      var cx=cellX(c,r),cy=cellY(r);
      var d=(cx-x)*(cx-x)+(cy-y)*(cy-y);
      var adj=0;
      if(r===0)adj=1;
      var nb=neighbors(c,r);
      for(var i=0;i<nb.length;i++)if(valid(nb[i][0],nb[i][1])&&get(nb[i][0],nb[i][1]))adj=1;
      if(hit&&hit.c!=null){
        var n2=neighbors(hit.c,hit.r);
        for(var k=0;k<n2.length;k++)if(n2[k][0]===c&&n2[k][1]===r)adj=2;
      }
      cands.push({c:c,r:r,x:cx,y:cy,d:d,adj:adj});
    }
  }
  cands.sort(function(a,b){
    if(b.adj!==a.adj)return b.adj-a.adj;
    return a.d-b.d;
  });
  /* prefer adjacent; if none, still take nearest empty so the ball never vanishes */
  for(var i=0;i<cands.length;i++)if(cands[i].adj>0)return cands[i];
  return cands[0]||null;
}

function attach(x,y,id,hit){
  var snap=nearestSnap(x,y,hit);
  if(!snap){current=id;showQueue();return}
  var ball={id:id,pop:0,scale:1.12};
  setCell(snap.c,snap.r,ball);
  lastSnap={c:snap.c,r:snap.r,id:id,x:ball.x,y:ball.y};
  busy=0.08;
  resolve(ball);
}

function fire(){
  if(!run||over||busy>0||flying||!current||rowDropping)return false;
  var ang=aimAng;
  var speed=860;
  var mz=muzzleAt(ang);
  flying={
    id:current,x:mz.x,y:mz.y,
    vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,
    bounces:0
  };
  lastBounces=0;
  current=nextBall;nextBall=null;
  shotCount+=1;
  refillQueue();
  sfx('shoot');
  aiming=false;aimGhost=null;
  return true;
}

function hitBallAt(x,y){
  var rad=R*2*0.92,rad2=rad*rad,found=null,best=1e15;
  eachBall(function(b){
    var dx=b.x-x,dy=b.y-y,d=dx*dx+dy*dy;
    if(d<=rad2&&d<best){best=d;found=b}
  });
  return found;
}

function bounceWalls(obj,radius){
  var L=boardL+radius,Rt=boardR-radius;
  var bounced=0;
  if(obj.x<L){obj.x=L+(L-obj.x);obj.vx=Math.abs(obj.vx);bounced=1}
  else if(obj.x>Rt){obj.x=Rt-(obj.x-Rt);obj.vx=-Math.abs(obj.vx);bounced=1}
  return bounced;
}

function stepFlying(dt){
  if(!flying)return;
  var step=Math.max(2.2,R*0.18);
  var dist=Math.sqrt(flying.vx*flying.vx+flying.vy*flying.vy)*dt;
  var n=Math.max(1,Math.ceil(dist/step));
  var ds=dt/n;
  for(var i=0;i<n;i++){
    flying.x+=flying.vx*ds;
    flying.y+=flying.vy*ds;
    if(bounceWalls(flying,R)){
      flying.bounces+=1;lastBounces=flying.bounces;
      sfx('wall');
    }
    var hit=hitBallAt(flying.x,flying.y);
    if(hit||flying.y-R<=boardT+0.5){
      /* back up a little so we snap from just outside */
      flying.x-=flying.vx*ds*0.5;
      flying.y-=flying.vy*ds*0.5;
      var id=flying.id,x=flying.x,y=flying.y;
      flying=null;
      attach(x,y,id,hit);
      return;
    }
    if(flying.y>H+R*2){
      /* shouldn't happen; return the ball */
      current=flying.id;flying=null;showQueue();
      return;
    }
  }
}

function clampAim(ang){
  var lo=-Math.PI+0.16,hi=-0.16;
  if(ang>0){
    /* downward: snap to nearest upward side */
    ang=ang>Math.PI/2?lo:hi;
  }
  if(ang>hi)ang=hi;
  if(ang<lo)ang=lo;
  return ang;
}
function setAimFrom(x,y){
  aimX=x;aimY=y;
  var origin=muzzleAt(aimNow());
  /* if we already have a stable up-muzzle, aim from that default muzzle so the first drag feels natural */
  var up=muzzleAt(-Math.PI/2);
  aimAng=clampAim(Math.atan2(y-up.y,x-up.x));
  buildAim();
}
function buildAim(){
  var origin=muzzleAt(aimAng);
  var pts=[],x=origin.x,y=origin.y;
  var vx=Math.cos(aimAng),vy=Math.sin(aimAng);
  var maxLen=H*2.6,traveled=0,step=5,bounces=0;
  pts.push({x:x,y:y});
  var ghost=null,safety=0;
  var L=boardL+R,Rt=boardR-R;
  while(traveled<maxLen&&safety++<800){
    x+=vx*step;y+=vy*step;traveled+=step;
    if(x<L){x=L+(L-x);vx=Math.abs(vx);bounces++;pts.push({x:x,y:y,bounce:1})}
    else if(x>Rt){x=Rt-(x-Rt);vx=-Math.abs(vx);bounces++;pts.push({x:x,y:y,bounce:1})}
    var hit=hitBallAt(x,y);
    if(hit||y-R<=boardT+0.5){
      var snap=nearestSnap(x,y,hit);
      if(snap)ghost={x:snap.x,y:snap.y,id:current};
      pts.push({x:x,y:y,end:1});
      break;
    }
    if(pts.length%2===0)pts.push({x:x,y:y});
  }
  aimPts=pts;aimGhost=ghost;
}

function inSwapZone(x,y){
  if(!nextBtn||nextBtn.hidden)return false;
  var r=nextBtn.getBoundingClientRect(),wr=cv.getBoundingClientRect();
  var lx=r.left-wr.left,rx=r.right-wr.left,ty=r.top-wr.top,by=r.bottom-wr.top;
  var pad=8;
  return x>=lx-pad&&x<=rx+pad&&y>=ty-pad&&y<=by+pad;
}
function swap(){
  if(!run||over||busy>0||flying||!current||!nextBall)return false;
  var t=current;current=nextBall;nextBall=t;
  showQueue();sfx('flip');
  if(aiming)buildAim();
  draw();
  return true;
}

function pointerPos(e){
  var r=cv.getBoundingClientRect();
  var src=e;
  if(e.changedTouches&&e.changedTouches[0])src=e.changedTouches[0];
  else if(e.touches&&e.touches[0])src=e.touches[0];
  return {x:(src.clientX-r.left)*(W/r.width),y:(src.clientY-r.top)*(H/r.height)};
}
var inputKind=null;
function eventKind(e){return e&&e.pointerType!=null?'pointer':(e&&e.type&&e.type.indexOf('touch')===0?'touch':'pointer')}
function onDown(e){
  if(!run||over||ov.hidden===false)return;
  var kind=eventKind(e);
  if(aiming&&inputKind&&inputKind!==kind)return;
  var t=e.target;
  if(t&&t.closest&&t.closest('button,a,.hud-mute,.runback,.bub-next,.overlay'))return;
  var p=pointerPos(e);
  if(inSwapZone(p.x,p.y))return;
  if(p.y>H-28)return;
  if(e.pointerId!=null){pid=e.pointerId;try{cv.setPointerCapture(e.pointerId)}catch(err){}}
  inputKind=kind;
  aiming=true;setAimFrom(p.x,p.y);
  if(e.cancelable)e.preventDefault();
  draw();
}
function onMove(e){
  if(!aiming)return;
  if(inputKind&&eventKind(e)!==inputKind)return;
  if(e.pointerId!=null&&pid&&e.pointerId!==pid)return;
  var p=pointerPos(e);
  setAimFrom(p.x,p.y);
  if(e.cancelable)e.preventDefault();
  draw();
}
function onUp(e){
  if(!aiming)return;
  if(inputKind&&e&&eventKind(e)!==inputKind)return;
  if(e&&e.pointerId!=null&&pid&&e.pointerId!==pid)return;
  var p=e?pointerPos(e):{x:aimX,y:aimY};
  if(p)setAimFrom(p.x,p.y);
  aiming=false;pid=0;inputKind=null;
  fire();
  if(e&&e.cancelable)e.preventDefault();
}
cv.addEventListener('pointerdown',onDown,{passive:false});
cv.addEventListener('pointermove',onMove,{passive:false});
cv.addEventListener('pointerup',onUp,{passive:false});
cv.addEventListener('pointercancel',onUp,{passive:false});
cv.addEventListener('touchstart',onDown,{passive:false});
cv.addEventListener('touchmove',onMove,{passive:false});
cv.addEventListener('touchend',onUp,{passive:false});
cv.addEventListener('touchcancel',onUp,{passive:false});
if(nextBtn)nextBtn.addEventListener('click',function(e){
  if(e)e.stopPropagation();
  swap();
});

function tick(dt){
  if(shake>0)shake=Math.max(0,shake-dt*4);
  if(celebrate>0)celebrate=Math.max(0,celebrate-dt);
  if(busy>0)busy=Math.max(0,busy-dt);
  if(flying)stepFlying(dt);
  if(rowDropping){
    var need=R*HEX;
    rowShift+=need*(dt/0.32);
    if(rowShift>=need){rowShift=need;finishRowDrop()}
    else relayoutCells();
  }
  for(var i=parts.length-1;i>=0;i--){
    var p=parts[i];
    p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=420*dt;
    if(p.life<=0)parts.splice(i,1);
  }
  for(var f=floats.length-1;f>=0;f--){
    var fl=floats[f];
    fl.life-=dt;fl.y+=fl.vy*dt;
    if(fl.life<=0)floats.splice(f,1);
  }
  for(var k=falling.length-1;k>=0;k--){
    var b=falling[k];
    b.life-=dt;b.vy+=760*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.rot+=(b.vx>0?1:-1)*dt*6;
    if(b.life<=0||b.y>H+80)falling.splice(k,1);
  }
}

function rgba(hex,a){
  var c=(hex||'#fff').replace('#','');
  if(c.length===3)c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  var n=parseInt(c,16);
  return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}
function drawBall(id,x,y,r,alpha,scale){
  var im=IM[id],meta=META[id]||{cx:0.5,cy:0.58,r:0.39};
  scale=scale==null?1:scale;
  alpha=alpha==null?1:alpha;
  var rr=r*scale;
  ctx.save();
  ctx.translate(x,y);
  if(alpha<1)ctx.globalAlpha=alpha;
  if(ready(im)){
    var dw=rr/meta.r,dh=dw;
    ctx.drawImage(im,-meta.cx*dw,-meta.cy*dh,dw,dh);
  }else{
    var col=colorById(id);
    ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);
    ctx.fillStyle=col.color;ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.2)';ctx.lineWidth=1.5;ctx.stroke();
  }
  ctx.restore();
}
function drawGlow(x,y,r,col,strength){
  strength=strength==null?1:strength;
  var g=ctx.createRadialGradient(x,y,r*0.55,x,y,r*1.55);
  g.addColorStop(0,rgba(col.tint||col.color,0));
  g.addColorStop(0.62,rgba(col.color,0.08*strength));
  g.addColorStop(0.8,rgba(col.color,0.42*strength));
  g.addColorStop(1,rgba(col.color,0));
  ctx.fillStyle=g;
  ctx.beginPath();ctx.arc(x,y,r*1.55,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x,y,r*1.05,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,'+(0.92*strength)+')';
  ctx.lineWidth=Math.max(2,r*0.09);ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,r*1.16,0,Math.PI*2);
  ctx.strokeStyle=rgba(col.color,0.95*strength);
  ctx.lineWidth=Math.max(2.4,r*0.12);ctx.stroke();
}
function drawDirArrow(x,y,ang,r,col,scale){
  scale=scale==null?1:scale;
  var d=r*1.42,size=r*0.62*scale;
  var tx=x+Math.cos(ang)*d,ty=y+Math.sin(ang)*d;
  ctx.save();
  ctx.translate(tx,ty);ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(size,0);
  ctx.lineTo(-size*0.55,size*0.62);
  ctx.lineTo(-size*0.28,0);
  ctx.lineTo(-size*0.55,-size*0.62);
  ctx.closePath();
  ctx.fillStyle=col.color;
  ctx.strokeStyle='rgba(255,255,255,.95)';
  ctx.lineWidth=2;ctx.lineJoin='round';
  ctx.stroke();ctx.fill();
  ctx.restore();
}
function drawNameTag(x,y,r,col){
  var label=col.name;
  ctx.save();
  ctx.font='bold 12px system-ui,sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  var w=ctx.measureText(label).width+14,h=18;
  /* keep the tag beside the ball so it never covers the cannon face */
  var tx=x-Math.max(w/2+r*1.05,r*1.7),ty=y+r*0.2;
  ctx.fillStyle='rgba(40,18,4,.78)';
  roundRect(tx-w/2,ty-h/2,w,h,9,true);
  ctx.strokeStyle=rgba(col.color,0.95);
  ctx.lineWidth=1.6;roundRect(tx-w/2,ty-h/2,w,h,9,false);
  ctx.fillStyle='#fff';
  ctx.fillText(label,tx,ty+0.5);
  ctx.restore();
}

function drawAim(){
  if(!aiming||!aimPts||aimPts.length<2)return;
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.setLineDash([8,8]);
  ctx.strokeStyle='rgba(80,40,0,.35)';
  ctx.lineWidth=6;
  ctx.beginPath();
  ctx.moveTo(aimPts[0].x,aimPts[0].y);
  for(var i=1;i<aimPts.length;i++)ctx.lineTo(aimPts[i].x,aimPts[i].y);
  ctx.stroke();
  ctx.strokeStyle='rgba(255,252,200,.98)';
  ctx.lineWidth=3.2;
  ctx.beginPath();
  ctx.moveTo(aimPts[0].x,aimPts[0].y);
  for(var i=1;i<aimPts.length;i++)ctx.lineTo(aimPts[i].x,aimPts[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
  /* bounce marks */
  for(var j=1;j<aimPts.length;j++){
    if(!aimPts[j].bounce)continue;
    ctx.beginPath();ctx.arc(aimPts[j].x,aimPts[j].y,4,0,Math.PI*2);
    ctx.fillStyle='#fff';ctx.fill();
  }
  if(aimGhost&&current){
    drawBall(aimGhost.id,aimGhost.x,aimGhost.y,R,0.38,1);
    ctx.beginPath();ctx.arc(aimGhost.x,aimGhost.y,R*0.98,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,248,180,.85)';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.stroke();
  }
  ctx.restore();
}

function drawShooter(){
  var ang=aimNow();
  var im=IM.cannon,sc=cannonScale();
  var iw=ready(im)?im.naturalWidth:522,ih=ready(im)?im.naturalHeight:720;
  var dw=iw*sc,dh=ih*sc;
  var defAng=Math.atan2((CANNON.my-CANNON.py)*ih,(CANNON.mx-CANNON.px)*iw);
  ctx.save();
  ctx.translate(shootX,shootY);
  ctx.rotate(ang-defAng);
  if(ready(im)){
    ctx.drawImage(im,-CANNON.px*dw,-CANNON.py*dh,dw,dh);
  }else{
    ctx.fillStyle='#f0c14a';
    roundRect(-R*1.1,-barrelLen(),R*2.2,barrelLen()+R*1.2,R*0.5,true);
  }
  ctx.restore();
  var pulse=0.85+0.15*Math.sin((last||0)/180);
  if(current&&!flying){
    var mz=muzzleAt(ang),col=colorById(current);
    drawGlow(mz.x,mz.y,R*1.08,col,pulse);
    drawBall(current,mz.x,mz.y,R,1,1.12);
    drawDirArrow(mz.x,mz.y,ang,R*1.08,col,1);
    drawNameTag(mz.x,mz.y,R*1.12,col);
  }
  if(flying){
    var fcol=colorById(flying.id);
    var fang=Math.atan2(flying.vy,flying.vx);
    drawGlow(flying.x,flying.y,R*1.05,fcol,1.1);
    drawBall(flying.id,flying.x,flying.y,R,1,1.1);
    drawDirArrow(flying.x,flying.y,fang,R*1.05,fcol,1.05);
  }
  /* shot countdown dots under the carriage */
  var dots=shotsMax,dwot=9,gap=5;
  var total=dots*dwot+(dots-1)*gap;
  var dx=shootX-total/2,dy=Math.min(H-16,shootY+R*2.05);
  for(var i=0;i<dots;i++){
    ctx.beginPath();ctx.arc(dx+dwot/2+i*(dwot+gap),dy,dwot/2,0,Math.PI*2);
    ctx.fillStyle=i<shotsLeft?'#fce404':'rgba(0,0,0,.28)';
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=1;ctx.stroke();
  }
}

function roundRect(x,y,w,h,r,fill){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill)ctx.fill();else ctx.stroke();
}

function drawBoard(){
  /* warm stall background */
  var g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#8fd15a');
  g.addColorStop(0.45,'#6bbb3a');
  g.addColorStop(1,'#3e8f28');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  /* soft awning stripes at very top */
  ctx.save();
  ctx.globalAlpha=0.22;
  for(var i=0;i<12;i++){
    ctx.fillStyle=i%2?'#f5a018':'#fce404';
    ctx.fillRect(i*(W/12),0,W/12,boardT-6);
  }
  ctx.restore();
  /* play well */
  ctx.fillStyle='rgba(255,244,200,.16)';
  roundRect(boardL-4,boardT-6,boardR-boardL+8,dangerY-boardT+10,16,true);
  /* wooden side rails */
  ctx.fillStyle='#c9852a';
  ctx.fillRect(boardL-7,boardT-8,7,dangerY-boardT+16);
  ctx.fillRect(boardR,boardT-8,7,dangerY-boardT+16);
  ctx.fillStyle='#e8b04a';
  ctx.fillRect(boardL-7,boardT-12,boardR-boardL+14,10);
  /* ceiling clay bar */
  ctx.fillStyle='#dba03a';
  roundRect(boardL-2,boardT-10,boardR-boardL+4,12,4,true);
}

function drawDanger(){
  ctx.save();
  ctx.setLineDash([8,7]);
  ctx.strokeStyle='rgba(255,240,80,.95)';
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(boardL,dangerY);
  ctx.lineTo(boardR,dangerY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='rgba(255,240,80,.9)';
  ctx.font='bold 11px system-ui,sans-serif';
  ctx.textAlign='center';
  ctx.fillText('警戒線',(boardL+boardR)/2,dangerY-6);
  ctx.restore();
}

function draw(){
  if(!W)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(shake>0){
    ctx.save();
    ctx.translate((Math.random()-0.5)*6*shake,(Math.random()-0.5)*6*shake);
  }
  drawBoard();
  drawDanger();
  eachBall(function(b){drawBall(b.id,b.x,b.y,R,1,b.scale||1)});
  if(!over)drawAim();
  for(var k=0;k<falling.length;k++){
    var fb=falling[k];
    ctx.save();ctx.translate(fb.x,fb.y);ctx.rotate(fb.rot||0);
    drawBall(fb.id,0,0,R,Math.max(0,fb.life*1.2),1);
    ctx.restore();
  }
  drawShooter();
  for(var i=0;i<parts.length;i++){
    var p=parts[i];
    ctx.globalAlpha=Math.max(0,p.life*2);
    ctx.fillStyle=p.color;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
  ctx.textAlign='center';
  ctx.font='bold 22px system-ui,sans-serif';
  ctx.lineJoin='round';
  for(var f=0;f<floats.length;f++){
    var fl=floats[f];
    ctx.globalAlpha=Math.max(0,Math.min(1,fl.life*1.6));
    ctx.strokeStyle='rgba(80,30,0,.45)';ctx.lineWidth=4;
    ctx.fillStyle=fl.color;
    ctx.strokeText(fl.text,fl.x,fl.y);
    ctx.fillText(fl.text,fl.x,fl.y);
    ctx.globalAlpha=1;
  }
  if(shake>0)ctx.restore();
}

function loop(now){
  if(!run)return;
  var dt=Math.min(0.033,(now-last)/1000);
  last=now;
  if(dt>0)tick(dt);
  draw();
  raf=requestAnimationFrame(loop);
}

function resetState(){
  grid=[];falling=[];parts=[];floats=[];flying=null;
  current=null;nextBall=null;aiming=false;pid=0;aimPts=[];aimGhost=null;
  setScore(0);setLevel(1);combo=0;shotCount=0;shotsMax=6;shotsLeft=6;
  busy=0;rowShift=0;rowDropping=false;celebrate=0;shake=0;
  lastSnap=null;lastBounces=0;lastPop=0;lastFall=0;cleared=0;topParity=0;
  over=false;
  if(recSlot)recSlot.innerHTML='';
}

function start(){
  resetState();
  run=true;over=false;
  if(how)how.hidden=false;
  if(ovcover)ovcover.hidden=false;
  if(ovlogo)ovlogo.hidden=false;
  if(toLobby)toLobby.hidden=true;
  if(recSlot)recSlot.innerHTML='';
  ov.className='overlay bubstart';
  ov.hidden=true;
  if(elHud)elHud.hidden=false;
  if(nextBtn)nextBtn.hidden=false;
  fillLevel();
  layout();
  if(G.audio){G.audio.unlock();G.audio.play('start');G.audio.startBgm('bubble')}
  last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
}

function endGame(){
  if(over)return;
  over=true;aiming=false;flying=null;shake=0.45;
  if(G.audio){G.audio.stopBgm();G.audio.play('over')}
  if(score>best){best=score;G.setBest(KEY,best);if(elBest)elBest.textContent=best}
  if(bestLine)bestLine.textContent='最高分 '+best;
  setTimeout(showOver,650);
}

function showOver(){
  run=false;cancelAnimationFrame(raf);draw();
  var nb=score>=best&&score>0;
  ovT.textContent='壓到警戒線了';
  ovS.innerHTML='你的分數 <span class="big">'+score+'</span><br>'+(nb?'新的最高分！':'最高分 '+best)+
    '<br>抵達第 '+level+' 關';
  if(recSlot)recSlot.innerHTML=G.pickHtml();
  go.textContent='再玩一次';
  if(how)how.hidden=true;
  if(ovcover)ovcover.hidden=true;
  if(toLobby)toLobby.hidden=false;
  ov.className='overlay bubover';
  ov.hidden=false;
}

if(G.audio)G.audio.configure({key:'pcGameBubbleMuted',button:d.getElementById('muteBtn')});
go.addEventListener('click',function(){
  if(go.textContent==='繼續玩'&&!over&&current){
    ov.hidden=true;
    if(elHud)elHud.hidden=false;
    if(nextBtn)nextBtn.hidden=false;
    run=true;
    if(G.audio){G.audio.unlock();G.audio.resumeBgm()}
    last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
    return;
  }
  start();
});
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&run&&!over){
    run=false;cancelAnimationFrame(raf);
    if(G.audio)G.audio.pauseBgm();
    ovT.textContent='暫停中';
    ovS.textContent='回到頁面後再開始';
    go.textContent='繼續玩';
    if(how)how.hidden=false;
    if(ovcover)ovcover.hidden=false;
    if(toLobby)toLobby.hidden=true;
    if(recSlot)recSlot.innerHTML='';
    ov.className='overlay bubstart';
    ov.hidden=false;
  }
});

window.addEventListener('resize',layout);
if(window.visualViewport)window.visualViewport.addEventListener('resize',layout);
layout();requestAnimationFrame(layout);

function clearGrid(){grid=[];falling=[];parts=[];floats=[];flying=null}

function seedBoard(rows){
  clearGrid();rowShift=0;rowDropping=false;over=false;busy=0;topParity=0;
  for(var r=0;r<rows.length;r++){
    grid[r]=[];
    for(var c=0;c<rows[r].length;c++){
      if(!rows[r][c])continue;
      setCell(c,r,{id:rows[r][c],pop:0,scale:1});
    }
  }
  relayoutCells();
}

window.PCBubble={
  start:start,
  swap:swap,
  fire:fire,
  end:endGame,
  showOver:showOver,
  setAim:function(ang){aimAng=clampAim(ang);aiming=true;buildAim();draw()},
  aimAt:function(nx,ny){setAimFrom(nx*W,ny*H);aiming=true;draw()},
  shootAngle:function(ang){aimAng=clampAim(ang);aiming=false;buildAim();return fire()},
  shootAt:function(nx,ny){setAimFrom(nx*W,ny*H);aiming=false;return fire()},
  shootCell:function(c,r){
    var x=cellX(c,r),y=cellY(r)+R*1.15;
    setAimFrom(x,y);aiming=false;return fire();
  },
  seedMatch:function(){
    if(!run)start();
    /* two cheese at bottom of a short stack, easy upward shot */
    seedBoard([
      ['chili','onion','chili','onion','chili','onion','chili','onion'],
      ['onion','chili','onion','chili','onion','chili','onion'],
      ['cheese','cheese','chili','onion','chili','onion','chili','onion']
    ]);
    current='cheese';nextBall='onion';showQueue();
    shotsLeft=shotsMax;busy=0;flying=null;aiming=false;
    draw();
  },
  seedHang:function(){
    if(!run)start();
    /* cheese on row 0 supporting a lone onion; pop 3 cheese and onion drops */
    seedBoard([
      ['cheese','cheese','chili','onion','chili','onion','chili','onion'],
      ['onion',null,null,null,null,null,null]
    ]);
    current='cheese';nextBall='chili';showQueue();
    shotsLeft=shotsMax;busy=0;flying=null;
    draw();
  },
  seedOver:function(){
    if(!run)start();
    var rows=Math.ceil((dangerY-boardT)/(R*HEX))+1;
    var data=[];
    for(var r=0;r<rows;r++){
      var line=[];
      for(var c=0;c<colsInRow(r);c++)line.push((r+c)%2?'chili':'onion');
      data.push(line);
    }
    seedBoard(data);
    checkOver();
    draw();
  },
  seedShot:function(){
    if(!run)start();
    seedBoard([
      ['cheese','chili','onion','bbq','purple','cheese','chili','onion'],
      ['chili','onion','bbq','purple','cheese','chili','onion'],
      ['onion','bbq','cheese','chili','onion','bbq','purple','cheese'],
      ['bbq','purple','chili','onion','cheese','chili','onion']
    ]);
    current='chili';nextBall='bomb';showQueue();
    shotsLeft=4;busy=0;flying=null;
    /* aim up-right so the path shows a clear wall bounce into the cluster */
    setAimFrom(boardR-6,shootY-R*8);
    aiming=true;
    spawnFloat((boardL+boardR)/2,cellY(2),'連消 +60','#fce404');
    spawnFloat((boardL+boardR)/2,cellY(3)+20,'掉落 +150','#fff4b0');
    spawnBurst(cellX(2,2),cellY(2),'chili',14);
    spawnBurst(cellX(3,2),cellY(2),'onion',10);
    draw();
  },
  dropRow:startRowDrop,
  setScore:setScore,
  setLevel:setLevel,
  freeze:function(on){if(on){busy=99}else busy=0},
  info:function(){
    return {
      run:run,over:over,score:score,best:best,level:level,busy:busy,
      current:current,next:nextBall,shotsLeft:shotsLeft,shotsMax:shotsMax,
      flying:!!flying,aiming:aiming,aimAng:aimAng,balls:ballCount(),shootX:shootX,shootY:shootY,muzzle:muzzleAt(),boardL:boardL,boardR:boardR,boardT:boardT,
      maxRow:maxFilledRow(),dangerY:dangerY,R:R,w:W,h:H,
      lastSnap:lastSnap,bounces:lastBounces,lastPop:lastPop,lastFall:lastFall,
      rowDropping:rowDropping,celebrate:celebrate,topParity:topParity
    };
  },
  audio:function(){return G.audio?G.audio.info():null}
};
})();
