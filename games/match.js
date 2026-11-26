(function(){
var d=document,G=window.PCGames;
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var elScore=d.getElementById('score'),elTime=d.getElementById('time'),elBest=d.getElementById('best');
var board=d.getElementById('board');
var KEY='pcGameMatchBest';
var FLAVORS=[
  {id:'onion',n:'酸奶洋蔥',src:'icons/onion.webp'},
  {id:'bbq',n:'碳烤BBQ',src:'icons/bbq.webp'},
  {id:'cheese',n:'香濃起司',src:'icons/cheese.webp'},
  {id:'chili',n:'香辣BBQ',src:'icons/chili.webp'},
  {id:'limited',n:'本月限定',src:'icons/limited.webp'},
  {id:'coriander',n:'香菜爆擊',src:'season-coriander.webp'}
];
var best=G.getBest(KEY);elBest.textContent=best;elTime.textContent=60;
var run=false,left=60,score=0,open=[],lock=false,leftPairs=0,combo=0,last=0,raf=0,cards=[];
function setScore(n){score=Math.max(0,n);elScore.textContent=score}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function build(){
  board.innerHTML='';
  var pack=[];
  FLAVORS.forEach(function(f){pack.push(f);pack.push(f)});
  shuffle(pack);
  leftPairs=FLAVORS.length;
  open=[];lock=false;combo=0;cards=[];
  pack.forEach(function(f,i){
    var btn=d.createElement('button');
    btn.type='button';
    btn.className='mcard';
    btn.setAttribute('aria-label', '牌 '+(i+1));
    btn.innerHTML='<span class="inner"><span class="face front"><img src="'+G.asset('mascot.webp')+'" alt=""></span><span class="face back"><img src="'+G.asset(f.src)+'" alt=""><span>'+f.n+'</span></span></span>';
    btn.addEventListener('click',function(){flip(btn,f)});
    board.appendChild(btn);
    cards.push(btn);
  });
}
function flip(btn,f){
  if(!run||lock||btn.classList.contains('on')||btn.classList.contains('ok'))return;
  btn.classList.add('on');
  open.push({btn:btn,f:f});
  if(G.audio)G.audio.play('flip');
  if(open.length<2)return;
  lock=true;
  var a=open[0],b=open[1];
  open=[];
  if(a.f.id===b.f.id){
    a.btn.classList.add('ok');b.btn.classList.add('ok');
    combo+=1;
    var pts=100+(combo>1?(combo-1)*40:0);
    setScore(score+pts);
    leftPairs-=1;
    lock=false;
    if(G.audio)G.audio.play('match');
    if(navigator.vibrate)try{navigator.vibrate(25)}catch(_){}
    if(leftPairs<=0)end(true);
  }else{
    combo=0;
    if(G.audio)G.audio.play('miss');
    setTimeout(function(){
      a.btn.classList.remove('on');b.btn.classList.remove('on');
      lock=false;
    },650);
  }
}
function loop(ts){
  if(!run)return;
  var dt=Math.min((ts-last)/1000,.05);last=ts;
  left-=dt;
  elTime.textContent=Math.max(0,Math.ceil(left));
  if(left<=0){end(false);return}
  raf=requestAnimationFrame(loop);
}
function start(){
  setScore(0);left=60;run=true;ov.hidden=true;elTime.textContent=60;
  if(G.audio){G.audio.unlock();G.audio.play('start');G.audio.startBgm('match')}
  build();
  last=performance.now();raf=requestAnimationFrame(loop);
}
function end(cleared){
  if(!run&&!cleared)return;
  run=false;cancelAnimationFrame(raf);
  if(G.audio){G.audio.stopBgm();G.audio.play(cleared?'win':'over')}
  var bonus=0;
  if(cleared){bonus=Math.max(0,Math.ceil(left))*10;setScore(score+bonus)}
  var nb=score>best;if(nb){best=score;G.setBest(KEY,best);elBest.textContent=best}
  ovT.textContent=cleared?'全部配對完成':'時間到';
  ovS.innerHTML='你的分數 <span class="big">'+score+'</span><br>'+(cleared?'剩餘時間加分 +'+bonus+'<br>':'還剩 '+leftPairs+' 對沒配完<br>')+(nb?'新的最高分':'最高分 '+best)+G.pickHtml();
  go.textContent='再玩一次';ov.hidden=false;
}
go.addEventListener('click',start);
d.addEventListener('visibilitychange',function(){if(d.hidden&&run){run=false;cancelAnimationFrame(raf);if(G.audio)G.audio.stopBgm();ovT.textContent='暫停中';ovS.textContent='回到頁面後再開始';go.textContent='重新開始';ov.hidden=false}});
if(G.audio)G.audio.configure({key:'pcGameMatchMuted',button:d.getElementById('muteBtn')});
window.PCMatch={
  start:start,
  end:end,
  audio:function(){return G.audio?G.audio.info():null},
  info:function(){return {run:run,score:score,left:left,leftPairs:leftPairs}}
};
})();
