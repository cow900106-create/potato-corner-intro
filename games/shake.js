(function(){
var d=document,G=window.PCGames;
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var elScore=d.getElementById('score'),elTime=d.getElementById('time'),elBest=d.getElementById('best');
var cup=d.getElementById('cup'),cupHit=d.getElementById('cupHit'),mixFill=d.getElementById('mixFill'),mixPct=d.getElementById('mixPct');
var flavIcon=d.getElementById('flavIcon'),flavName=d.getElementById('flavName'),dust=d.getElementById('dust');
var flash=d.getElementById('flash'),bits=d.getElementById('bits'),tip=d.getElementById('tip');
var permWrap=d.getElementById('permWrap'),permBtn=d.getElementById('perm');
var KEY='pcGameShakeBest';
var FLAVORS=[
  {n:'酸奶洋蔥',src:'icons/onion.webp',c:'#7db343'},
  {n:'碳烤BBQ',src:'icons/bbq.webp',c:'#8a3d12'},
  {n:'香濃起司',src:'icons/cheese.webp',c:'#f0c400'},
  {n:'香辣BBQ',src:'icons/chili.webp',c:'#c0392b'},
  {n:'香菜爆擊',src:'season-coriander.webp',c:'#3a8f4d'},
  {n:'本月限定',src:'icons/limited.webp',c:'#d4a017'}
];
var best=G.getBest(KEY);elBest.textContent=best;elTime.textContent=40;
var run=false,left=40,score=0,mix=0,need=12,round=0,flav=FLAVORS[0],last=0,raf=0,motionOn=false,lastShake=0,lastAcc=null,rockT=0;
function setScore(n){score=Math.max(0,n);elScore.textContent=score}
function showFlav(){
  flavIcon.src=G.asset(flav.src);
  flavIcon.alt=flav.n;
  flavName.textContent=flav.n;
  dust.style.background=flav.c;
  dust.style.opacity=String(0.15+mix*0.55);
  mixFill.style.width=(mix*100)+'%';
  mixPct.textContent=String(Math.round(mix*100));
}
function nextFlav(){
  var k;do{k=Math.floor(Math.random()*FLAVORS.length)}while(FLAVORS[k]===flav&&FLAVORS.length>1);
  flav=FLAVORS[k];
  mix=0;need=12+Math.min(8,round*2);round++;
  showFlav();
}
function spark(){
  var b=d.createElement('span');b.className='bit';
  b.style.background=flav.c;
  b.style.left=(30+Math.random()*40)+'%';
  b.style.top=(20+Math.random()*20)+'%';
  bits.appendChild(b);
  setTimeout(function(){if(b.parentNode)b.parentNode.removeChild(b)},800);
}
function addMix(amt){
  if(!run)return;
  mix=Math.min(1,mix+amt);
  rockT=.18;
  cup.classList.add('busy');
  spark();
  showFlav();
  if(mix>=1){
    var pts=100+Math.max(0,8-round)*5;
    setScore(score+pts);
    flash.textContent='搖勻了 +'+pts;
    flash.classList.remove('on');void flash.offsetWidth;flash.classList.add('on');
    if(navigator.vibrate)try{navigator.vibrate(30)}catch(_){}
    nextFlav();
  }
}
function onMotion(e){
  if(!run)return;
  var a=e.accelerationIncludingGravity||e.acceleration;if(!a||a.x==null)return;
  var now=performance.now();
  if(lastAcc){
    var dx=a.x-lastAcc.x,dy=a.y-lastAcc.y,dz=a.z-lastAcc.z;
    var mag=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(mag>14&&now-lastShake>140){lastShake=now;addMix(1/need)}
  }
  lastAcc={x:a.x,y:a.y,z:a.z};
}
function listenMotion(){
  if(motionOn)return;
  window.addEventListener('devicemotion',onMotion,true);
  motionOn=true;
  tip.textContent='搖一搖或點杯子';
  if(permWrap)permWrap.hidden=true;
}
function askPerm(){
  if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
    DeviceMotionEvent.requestPermission().then(function(s){if(s==='granted')listenMotion();else tip.textContent='沒有開啟搖動感應，改連點杯子也可以'}).catch(function(){tip.textContent='改連點杯子也可以'});
  }else listenMotion();
}
if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
  permWrap.hidden=false;
  permBtn.addEventListener('click',function(e){e.stopPropagation();askPerm()});
}else if(window.DeviceMotionEvent){
  listenMotion();
}else{
  tip.textContent='連點杯子把粉搖均勻';
}
cupHit.addEventListener('pointerdown',function(e){e.preventDefault();addMix(1/need)});
function loop(ts){
  if(!run)return;
  var dt=Math.min((ts-last)/1000,.05);last=ts;
  left-=dt;rockT=Math.max(0,rockT-dt);
  if(rockT<=0)cup.classList.remove('busy');
  elTime.textContent=Math.max(0,Math.ceil(left));
  if(left<=0){end();return}
  raf=requestAnimationFrame(loop);
}
function start(){
  setScore(0);left=40;round=0;run=true;ov.hidden=true;elTime.textContent=40;
  flav=FLAVORS[Math.floor(Math.random()*FLAVORS.length)];
  mix=0;need=12;showFlav();
  last=performance.now();raf=requestAnimationFrame(loop);
}
function end(){
  run=false;cancelAnimationFrame(raf);cup.classList.remove('busy');
  if(mix>0&&mix<1)setScore(score+Math.round(mix*40));
  var nb=score>best;if(nb){best=score;G.setBest(KEY,best);elBest.textContent=best}
  ovT.textContent='時間到';
  ovS.innerHTML='你的分數 <span class="big">'+score+'</span><br>搖勻 '+round+' 種風味粉<br>'+(nb?'新的最高分':'最高分 '+best)+G.pickHtml();
  go.textContent='再玩一次';ov.hidden=false;
}
go.addEventListener('click',function(){
  if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'&&!motionOn){
    /* permission stays on the dedicated button so start still works by tapping */
  }
  start();
});
d.addEventListener('visibilitychange',function(){if(d.hidden&&run){run=false;cancelAnimationFrame(raf);ovT.textContent='暫停中';ovS.textContent='回到頁面後再開始';go.textContent='重新開始';ov.hidden=false}});
})();
