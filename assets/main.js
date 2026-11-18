(function(){
var d=document;d.documentElement.classList.add('js');
// optional images: show only when the file loads
[].forEach.call(d.querySelectorAll('img.oi'),function(im){
  function ok(){im.parentNode.classList.add('has')}
  if(im.complete&&im.naturalWidth)ok();else{im.addEventListener('load',ok);im.addEventListener('error',function(){im.remove()})}
});
// scroll reveal
var els=[].slice.call(d.querySelectorAll('.rv'));
if('IntersectionObserver' in window){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});
  els.forEach(function(el,i){el.style.transitionDelay=(i%4)*70+'ms';io.observe(el)});
}else{els.forEach(function(el){el.classList.add('in')})}

// today's must-order
var PICKS=[
 {n:'奶油松露',t:'12/1 上市的新風味粉，搶先嘗鮮。',i:'new-creamy-truffle.webp',to:'#it-truffle'},
 {n:'熔岩起司枕',t:'酥脆外皮包著流心起司，一口咬下。',i:'new-cheese-pillow.webp',to:'#it-pillow'},
 {n:'香菜爆擊風味',t:'香菜控請尖叫，一口接一口。',i:'season-coriander.webp',to:'#it-coriander'},
 {n:'莓好氣泡醋飲',t:'清爽酸甜的氣泡感，好解膩。統一時代B2門市限定。',i:'season-berry-fizz.webp',to:'#it-berry'},
 {n:'歡樂派對三拼 $278',t:'薯條、捲捲薯、雞米花一次吃到。',i:'icons/party.webp',sq:1,to:'#it-party'},
 {n:'雙拼套餐 A $200',t:'兩份薯條加一杯飲料，選 2 種口味。',i:'icons/combo.webp',sq:1,to:'#it-combo'},
 {n:'捲捲薯 $138',t:'一圈一圈的酥脆，搖上你愛的粉。',i:'icons/loopy.webp',sq:1,to:'#it-loopy'},
 {n:'雞米花 $158',t:'外酥內嫩，一口一顆停不下來。',i:'icons/pops.webp',sq:1,to:'#it-pops'},
 {n:'微笑薯餅 $138',t:'笑臉造型的薯餅，加購價 $38。',i:'icons/smiley.webp',sq:1,to:'#it-smiley'},
 {n:'招牌薯條 中份 $128',t:'經典薯條，現炸現搖。',i:'icons/fries.webp',sq:1,to:'#it-fries'}
];
var lastPick=-1;
function pickHtml(){
  var k;do{k=Math.floor(Math.random()*PICKS.length)}while(k===lastPick&&PICKS.length>1);lastPick=k;var p=PICKS[k];
  return '<div class="rec"><span class="recl">今天必點</span><div class="recb"><img'+(p.sq?' class="sq"':'')+' src="assets/'+p.i+'" alt="'+p.n+'" width="68" height="68"><div><b>'+p.n+'</b><span class="rt">'+p.t+'</span></div></div><a class="go" href="'+p.to+'">看這一項</a></div>';
}
// mini game
var cv=d.getElementById('game'),ctx=cv.getContext('2d');
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var elScore=d.getElementById('score'),elTime=d.getElementById('time'),elBest=d.getElementById('best');
var W=0,H=0,dpr=1,run=false,left=30,score=0,items=[],pops=[],spawn=0,last=0,raf=0,elapsed=0;
var box={x:0,w:96,h:56,shake:0};
var mi=new Image(),mok=false;mi.onload=function(){mok=true;draw()};mi.src='assets/mascot.webp';
var best=0;try{best=parseInt(localStorage.getItem('potatoCornerBest')||'0',10)||0}catch(e){}
elBest.textContent=best;
function size(){
  var w=cv.parentNode.clientWidth;dpr=Math.min(window.devicePixelRatio||1,2);
  W=w;H=Math.round(w*1.2);cv.width=W*dpr;cv.height=H*dpr;cv.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);box.w=Math.max(84,W*.24);box.h=box.w*.6;
  if(!box.x)box.x=W/2;box.x=Math.min(Math.max(box.x,box.w/2),W-box.w/2);draw();
}
function setX(cx){var r=cv.getBoundingClientRect();box.x=Math.min(Math.max(cx-r.left,box.w/2),W-box.w/2)}
cv.addEventListener('pointerdown',function(e){setX(e.clientX);try{cv.setPointerCapture(e.pointerId)}catch(_){}});
cv.addEventListener('pointermove',function(e){if(e.buttons||e.pointerType==='touch')setX(e.clientX)});
d.addEventListener('keydown',function(e){if(!run)return;if(e.key==='ArrowLeft'){box.x=Math.max(box.w/2,box.x-30);e.preventDefault()}if(e.key==='ArrowRight'){box.x=Math.min(W-box.w/2,box.x+30);e.preventDefault()}});
function stick(x,y,len,col,rot){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.fillStyle=col;var w=len*.2;ctx.beginPath();ctx.roundRect?ctx.roundRect(-w/2,-len/2,w,len,w/2):ctx.rect(-w/2,-len/2,w,len);ctx.fill();ctx.restore()}
function drawItem(it){
  var s=it.s;
  if(it.t==='fry'){stick(it.x-s*.22,it.y,s,'#ffcb05',-.25+it.r);stick(it.x,it.y-s*.06,s*1.1,'#ffd93b',it.r);stick(it.x+s*.22,it.y,s,'#f5b800',.25+it.r)}
  else if(it.t==='burnt'){stick(it.x-s*.22,it.y,s,'#3b2a1a',-.25+it.r);stick(it.x,it.y-s*.06,s*1.1,'#241810',it.r);stick(it.x+s*.22,it.y,s,'#4a3320',.25+it.r);ctx.font=(s*.5)+'px sans-serif';ctx.textAlign='center';ctx.fillText('💨',it.x,it.y-s*.65)}
  else{ctx.font=(s*1.1)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🧂',it.x,it.y);ctx.textBaseline='alphabetic'}
}
function drawBox(){
  if(mok){var ms=box.w*.62,mx=box.x,my=H-box.h-10-ms*.12;ctx.save();ctx.beginPath();ctx.arc(mx,my,ms/2,0,6.2832);ctx.clip();ctx.drawImage(mi,mx-ms/2,my-ms/2,ms,ms);ctx.restore();ctx.lineWidth=3;ctx.strokeStyle='#fce404';ctx.beginPath();ctx.arc(mx,my,ms/2,0,6.2832);ctx.stroke()}
  var bx=box.x+(box.shake>0?Math.sin(box.shake*60)*3:0),by=H-box.h-10,w=box.w,h=box.h;
  ctx.fillStyle='#fce404';ctx.beginPath();ctx.moveTo(bx-w/2,by);ctx.lineTo(bx+w/2,by);ctx.lineTo(bx+w*.4,by+h);ctx.lineTo(bx-w*.4,by+h);ctx.closePath();ctx.fill();
  ctx.fillStyle='#148c44';ctx.beginPath();ctx.moveTo(bx-w*.44,by+h*.3);ctx.lineTo(bx+w*.44,by+h*.3);ctx.lineTo(bx+w*.4,by+h*.8);ctx.lineTo(bx-w*.4,by+h*.8);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold '+(h*.2)+'px sans-serif';ctx.textAlign='center';ctx.fillText('Potato',bx,by+h*.5);ctx.fillText('Corner',bx,by+h*.72);
}
function draw(){
  ctx.clearRect(0,0,W,H);
  items.forEach(drawItem);drawBox();
  pops.forEach(function(p){ctx.globalAlpha=Math.max(p.a,0);ctx.fillStyle=p.c;ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText(p.s,p.x,p.y);ctx.globalAlpha=1});
}
function add(){
  var r=Math.random(),t=r<.58?'fry':(r<.8?'burnt':'salt'),s=Math.max(30,W*.09);
  items.push({t:t,x:s+Math.random()*(W-2*s),y:-s,s:s,v:(150+elapsed*3.5+Math.random()*80)*(W/360),r:Math.random()-.5,w:(Math.random()-.5)*2});
}
function pop(x,y,s,c){pops.push({x:x,y:y,s:s,c:c,a:1})}
function setScore(n){score=Math.max(0,n);elScore.textContent=score}
function loop(ts){
  if(!run)return;
  var dt=Math.min((ts-last)/1000,.05);last=ts;
  left-=dt;elapsed+=dt;spawn-=dt;box.shake=Math.max(0,box.shake-dt);
  if(spawn<=0){add();spawn=Math.max(.28,.75-elapsed*.015)}
  var top=H-box.h-10-(mok?box.w*.26:0);
  for(var i=items.length-1;i>=0;i--){
    var it=items[i];it.y+=it.v*dt;it.r+=it.w*dt;
    if(it.y+it.s*.4>=top&&it.y<top+box.h*.6&&Math.abs(it.x-box.x)<box.w/2+it.s*.15){
      if(it.t==='fry'){setScore(score+1);pop(it.x,top-6,'+1','#0b612e')}
      else if(it.t==='salt'){setScore(score+3);pop(it.x,top-6,'+3 風味粉','#148c44');box.shake=.3}
      else{setScore(score-3);pop(it.x,top-6,'-3 燒焦','#c0392b');box.shake=.4;if(navigator.vibrate)try{navigator.vibrate(60)}catch(_){}}
      items.splice(i,1);
    }else if(it.y>H+it.s){items.splice(i,1)}
  }
  pops.forEach(function(p){p.y-=40*dt;p.a-=dt*1.4});pops=pops.filter(function(p){return p.a>0});
  elTime.textContent=Math.max(0,Math.ceil(left));
  draw();
  if(left<=0){end();return}
  raf=requestAnimationFrame(loop);
}
function start(){
  items=[];pops=[];setScore(0);left=30;elapsed=0;spawn=.3;run=true;ov.hidden=true;elTime.textContent=30;
  last=performance.now();raf=requestAnimationFrame(loop);
}
function end(){
  run=false;cancelAnimationFrame(raf);draw();
  var nb=score>best;if(nb){best=score;try{localStorage.setItem('potatoCornerBest',String(best))}catch(e){}elBest.textContent=best}
  ovT.textContent='時間到';
  ovS.innerHTML='你的分數 <span class="big">'+score+'</span><br>'+(nb?'新的最高分':'最高分 '+best)+pickHtml();
  go.textContent='再玩一次';ov.hidden=false;
}
go.addEventListener('click',start);
d.addEventListener('visibilitychange',function(){if(d.hidden&&run){run=false;cancelAnimationFrame(raf);ovT.textContent='暫停中';ovS.textContent='回到頁面後再開始';go.textContent='重新開始';ov.hidden=false}});
window.addEventListener('resize',size);size();
})();
