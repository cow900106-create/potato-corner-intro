(function(){
var d=document,G=window.PCGames;
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var how=d.getElementById('how'),ovlogo=d.getElementById('ovlogo'),wrap=d.getElementById('wrap');
var hud=d.getElementById('hud'),fine=d.getElementById('fine');
var elLv=d.getElementById('lv'),elTime=d.getElementById('time'),elMoney=d.getElementById('money'),elGoal=d.getElementById('goal');
var elCusts=d.getElementById('custs'),elTray=d.getElementById('tray'),elShaker=d.getElementById('shaker');
var elRaws=d.getElementById('raws'),elFryers=d.getElementById('fryers'),elFlavs=d.getElementById('flavs');
var drinkBtn=d.getElementById('drinkBtn'),drinkFill=d.getElementById('drinkFill'),trashBtn=d.getElementById('trashBtn');
var KEY='pcGameShopBest';
var best=G.getBest(KEY);
var SEATS=4;
var FOOD={
  fries:{name:'薯條',price:80,img:'img/fries.png'},
  loopy:{name:'捲捲薯',price:90,img:'img/loopy.png'},
  pops:{name:'雞米花',price:100,img:'img/pops.png'},
  drink:{name:'飲料',price:45,img:'img/drink.png'}
};
var FLAV={
  onion:{name:'酸奶洋蔥',img:'img/onion.png'},
  bbq:{name:'碳烤BBQ',img:'img/bbq.png'},
  cheese:{name:'香濃起司',img:'img/cheese.png'},
  chili:{name:'香辣BBQ',img:'img/chili.png'}
};
var FOODS=['fries','loopy','pops'],FLAVS=['onion','bbq','cheese','chili'];
var LEVELS=[
  {goal:360,time:90,fryers:2,spawn:4.5,patience:20,cook:3.2,burn:6.2,combo:0.18,drink:1.6},
  {goal:640,time:90,fryers:3,spawn:3.3,patience:15,cook:2.7,burn:5.3,combo:0.4,drink:1.4},
  {goal:900,time:90,fryers:3,spawn:2.6,patience:12,cook:2.3,burn:4.6,combo:0.55,drink:1.2}
];
var SHIRTS=['#e74c3c','#3498db','#9b59b6','#e67e22','#1abc9c','#f1c40f'];
var HAIRS=['#3a2a1a','#6b3a1a','#1a1a1a','#8a5a2a','#4a3050','#c9a44a'];
var run=false,lv=0,timeLeft=90,money=0,levelMoney=0,fryers=[],shaker=null,tray=[],sel=null;
var drinkT=-1,custs=[],spawnT=0,uid=1,last=0,raf=0,toastT=0,toastMsg='',dirty=true;
function mark(){dirty=true}
function L(){return LEVELS[lv]}
function nextId(){return uid++}
function preventPage(e){if(ov&&!ov.hidden)return;e.preventDefault()}
wrap.addEventListener('touchmove',preventPage,{passive:false});

function icon(src,alt){return '<img src="'+src+'" alt="'+(alt||'')+'" draggable="false">'}
function itemHtml(it,cls){
  var flav=it.flavor?icon(FLAV[it.flavor].img,FLAV[it.flavor].name):'';
  return '<div class="item '+(cls||'')+(it.burnt?' burnt':'')+'" data-id="'+it.id+'">'+icon(FOOD[it.type].img,FOOD[it.type].name)+flav+'</div>';
}

function makeOrder(comboChance){
  function oneFood(){
    return {type:FOODS[Math.random()*FOODS.length|0],flavor:FLAVS[Math.random()*FLAVS.length|0],done:0};
  }
  function oneDrink(){return {type:'drink',flavor:null,done:0}}
  var r=Math.random();
  if(r<comboChance){
    if(Math.random()<.5)return [oneFood(),oneDrink()];
    return [oneFood(),oneFood(),oneDrink()];
  }
  return Math.random()<.22?[oneDrink()]:[oneFood()];
}

function resetLevel(keepMoney){
  var cfg=L();
  timeLeft=cfg.time;levelMoney=0;spawnT=0.2;
  fryers=[];for(var i=0;i<cfg.fryers;i++)fryers.push({id:i,food:null,t:0,state:'empty'});
  shaker=null;tray=[];sel=null;drinkT=-1;custs=[];
  if(!keepMoney)money=0;
  elLv.textContent=String(lv+1);
  elGoal.textContent='$'+cfg.goal;
  elMoney.textContent='$'+money;
  elTime.textContent=String(Math.ceil(timeLeft));
  buildStations();
  render();
}

function buildStations(){
  elRaws.innerHTML=FOODS.map(function(k){
    return '<button class="st raw" data-food="'+k+'" type="button">'+icon(FOOD[k].img,FOOD[k].name)+'<span>'+FOOD[k].name+'</span></button>';
  }).join('');
  elFlavs.innerHTML=FLAVS.map(function(k){
    return '<button class="st flav" data-flav="'+k+'" type="button"><i class="lid"></i><span class="body">'+icon(FLAV[k].img,FLAV[k].name)+'</span><span>'+FLAV[k].name+'</span></button>';
  }).join('');
  [].forEach.call(elRaws.querySelectorAll('.raw'),function(btn){
    btn.addEventListener('click',function(){startFry(btn.getAttribute('data-food'))});
  });
  [].forEach.call(elFlavs.querySelectorAll('.flav'),function(btn){
    btn.addEventListener('click',function(){pickFlav(btn.getAttribute('data-flav'))});
  });
}

function startFry(food){
  if(!run)return;
  for(var i=0;i<fryers.length;i++){
    if(fryers[i].state==='empty'){
      fryers[i].food=food;fryers[i].t=0;fryers[i].state='cook';
      render();return;
    }
  }
  toast('油鍋滿了');
}

function tapFryer(i){
  if(!run)return;
  var f=fryers[i];
  if(f.state==='ready'){
    if(shaker){toast('搖搖杯還有東西');return}
    shaker={id:nextId(),type:f.food,flavor:null,shaking:0};
    f.food=null;f.t=0;f.state='empty';
    render();return;
  }
  if(f.state==='burnt'){
    f.food=null;f.t=0;f.state='empty';
    render();return;
  }
}

function pickFlav(k){
  if(!run||!shaker||shaker.shaking)return;
  if(shaker.flavor)return;
  shaker.flavor=k;shaker.shaking=0.55;
  render();
}

function takeDrink(){
  if(!run)return;
  if(drinkT>=0)return;
  if(tray.length>=4){toast('出餐盤滿了');return}
  drinkT=0;render();
}

function trash(){
  if(!run)return;
  if(sel!=null){
    tray=tray.filter(function(it){return it.id!==sel});
    sel=null;render();return;
  }
  if(shaker&&!shaker.shaking){shaker=null;render();return}
  toast('先點要丟掉的餐點');
}

function findItem(id){
  for(var i=0;i<tray.length;i++)if(tray[i].id===id)return {it:tray[i],idx:i};
  return null;
}

function serveTo(c, it, idx){
  var match=-1;
  for(var i=0;i<c.order.length;i++){
    var o=c.order[i];
    if(o.done)continue;
    if(o.type!==it.type)continue;
    if(o.type!=='drink'&&o.flavor!==it.flavor)continue;
    match=i;break;
  }
  if(match<0)return false;
  c.order[match].done=1;
  tray.splice(idx,1);sel=null;
  var leftover=c.order.filter(function(o){return !o.done});
  if(leftover.length===0){
    var price=0;
    c.order.forEach(function(o){price+=FOOD[o.type].price});
    var tip=Math.round(price*0.28*(c.patience/c.maxP));
    addMoney(price+tip);
    toast('+$'+(price+tip)+(tip?(' 含小費 $'+tip):''));
    c.leave='ok';c.leaveT=0.45;
  }
  render();
  return true;
}

function autoServe(id){
  var found=findItem(id);
  if(!found)return false;
  var list=custs.slice().sort(function(a,b){return a.patience-b.patience});
  for(var i=0;i<list.length;i++){
    if(list[i].leave)continue;
    if(serveTo(list[i],found.it,found.idx))return true;
  }
  return false;
}

function tapTray(id){
  if(!run)return;
  if(autoServe(id))return;
  sel=(sel===id)?null:id;
  render();
}

function tapCust(slot){
  if(!run||sel==null)return;
  var c=null;custs.forEach(function(x){if(x.slot===slot)c=x});
  var found=findItem(sel);
  if(!c||!found)return;
  if(!serveTo(c,found.it,found.idx))toast('不是這份');
}

function addMoney(n){
  money+=n;levelMoney+=n;
  elMoney.textContent='$'+money;
}

function toast(m){toastMsg=m;toastT=1.15}

function spawnCust(){
  if(custs.length>=SEATS)return;
  var used={};custs.forEach(function(c){used[c.slot]=1});
  var slot=0;for(;slot<SEATS;slot++)if(!used[slot])break;
  var cfg=L();
  custs.push({
    slot:slot,order:makeOrder(cfg.combo),patience:cfg.patience,maxP:cfg.patience,
    shirt:SHIRTS[Math.random()*SHIRTS.length|0],hair:HAIRS[Math.random()*HAIRS.length|0],leave:null,leaveT:0
  });
}

function update(dt){
  var cfg=L();
  timeLeft-=dt;
  if(timeLeft<0)timeLeft=0;
  elTime.textContent=String(Math.ceil(timeLeft));

  fryers.forEach(function(f){
    if(f.state==='cook'||f.state==='ready'){
      var prev=f.state;
      f.t+=dt;
      if(f.t>=cfg.burn)f.state='burnt';
      else if(f.t>=cfg.cook)f.state='ready';
      if(f.state!==prev)mark();
    }
  });
  if(shaker&&shaker.shaking>0){
    shaker.shaking-=dt;
    if(shaker.shaking<=0){
      if(tray.length>=4){shaker.shaking=0.1}
      else{
        tray.push({id:shaker.id,type:shaker.type,flavor:shaker.flavor});
        shaker=null;mark();
      }
    }
  }
  if(drinkT>=0){
    drinkT+=dt;
    if(drinkT>=cfg.drink){
      if(tray.length>=4){drinkT=cfg.drink-0.05}
      else{tray.push({id:nextId(),type:'drink',flavor:null});drinkT=-1;mark()}
    }
  }
  custs.forEach(function(c){
    if(c.leave){c.leaveT-=dt;return}
    c.patience-=dt;
    if(c.patience<=0){c.leave='gone';c.leaveT=0.4;toast('客人走了');mark()}
  });
  var n=custs.length;custs=custs.filter(function(c){return !(c.leave&&c.leaveT<=0)});if(custs.length!==n)mark();

  spawnT-=dt;
  if(spawnT<=0){spawnCust();spawnT=cfg.spawn;mark()}

  if(toastT>0)toastT-=dt;
  if(levelMoney>=cfg.goal){levelClear();return}
  if(timeLeft<=0){fail();return}
}

function render(){
  var cfg=L();
  var html='';
  for(var s=0;s<SEATS;s++){
    var c=null;custs.forEach(function(x){if(x.slot===s)c=x});
    html+='<button class="cust'+(c&&c.leave==='gone'?' leaving':(c&&c.leave==='ok'?' happy':''))+'" data-slot="'+s+'" type="button" '+(c?'':'disabled')+'>';
    if(c){
      html+='<div class="bubble">';
      c.order.forEach(function(o){
        html+='<span class="need'+(o.done?' done':'')+'">'+icon(FOOD[o.type].img,FOOD[o.type].name)+(o.flavor?icon(FLAV[o.flavor].img,FLAV[o.flavor].name):'')+'</span>';
      });
      html+='</div>';
      var pct=Math.max(0,c.patience/c.maxP);
      var col=pct>0.45?'#148c44':(pct>0.22?'#e0a800':'#c0392b');
      html+='<div class="pbar"><i style="width:'+(pct*100)+'%;background:'+col+'"></i></div>';
      html+='<div class="stool"></div><div class="person" style="--shirt:'+c.shirt+';--hair:'+(c.hair||'#3a2a1a')+'"><i class="hd"></i><i class="bd"></i></div>';
    }else{
      html+='<div class="stool"></div><div class="person empty"></div>';
    }
    html+='</button>';
  }
  elCusts.innerHTML=html;
  [].forEach.call(elCusts.querySelectorAll('.cust'),function(btn){
    btn.addEventListener('click',function(){tapCust(+btn.getAttribute('data-slot'))});
  });

  if(!shaker)elShaker.innerHTML='<span class="ph">空的</span>';
  else{
    elShaker.innerHTML=itemHtml(shaker,'in-shake')+(shaker.shaking>0?'<em class="shake-anim">搖匀中</em>':(shaker.flavor?'':'<em>選風味粉</em>'));
    elShaker.className='shaker'+(shaker.shaking>0?' busy':'');
  }

  elTray.innerHTML=tray.length?tray.map(function(it){return itemHtml(it,it.id===sel?'picked':'')}).join(''):'<span class="ph">還沒有完成的餐</span>';
  [].forEach.call(elTray.querySelectorAll('.item'),function(el){
    bindItem(el,+el.getAttribute('data-id'));
  });

  elFryers.innerHTML=fryers.map(function(f,i){
    var st=f.state;
    var lab=st==='empty'?'空鍋':(st==='cook'?'油炸中':(st==='ready'?'好了，點進杯子':(st==='burnt'?'焦了，點掉':'')));
    var pct=0;
    if(st==='cook')pct=Math.min(100,(f.t/cfg.cook)*100);
    else if(st==='ready'||st==='burnt')pct=100;
    var img=st==='empty'?'':'<img src="'+FOOD[f.food].img+'" alt="" draggable="false">';
    return '<button class="fryer '+st+'" data-i="'+i+'" type="button"><span class="ring" style="--p:'+pct+'"></span><span class="pot-inner">'+img+'<span class="oil '+(st==='burnt'?'dark':(st==='ready'?'gold':''))+'"></span></span><span class="flab">'+lab+'</span></button>';
  }).join('');
  [].forEach.call(elFryers.querySelectorAll('.fryer'),function(btn){
    btn.addEventListener('click',function(){tapFryer(+btn.getAttribute('data-i'))});
  });

  var fillPct=drinkT<0?0:Math.min(1,drinkT/cfg.drink);
  if(drinkFill)drinkFill.style.height=(fillPct*100)+'%';
  drinkBtn.className='eq drink-eq'+(drinkT>=0?' busy':'');

  var tip=d.getElementById('toast');
  if(!tip){
    tip=d.createElement('div');tip.id='toast';tip.className='toast';
    d.getElementById('stage').appendChild(tip);
  }
  tip.textContent=toastMsg;
  tip.className='toast'+(toastT>0?' on':'');
}

function bindItem(el,id){
  el.addEventListener('click',function(e){e.stopPropagation();if(skipClick){skipClick=false;return}tapTray(id)});
  el.addEventListener('pointerdown',function(e){onDragStart(e,id,el)});
}

var drag=null,skipClick=false,ghost=null;
function onDragStart(e,id,el){
  if(!run)return;
  try{el.setPointerCapture(e.pointerId)}catch(_){}
  drag={id:id,x:e.clientX,y:e.clientY,moved:false};
}
function onDragMove(e){
  if(!drag)return;
  var dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved&&dx*dx+dy*dy<144)return;
  drag.moved=true;
  if(!ghost){
    var src=elTray.querySelector('.item[data-id="'+drag.id+'"]');
    if(!src)return;
    ghost=src.cloneNode(true);
    ghost.classList.add('ghost');
    d.body.appendChild(ghost);
  }
  ghost.style.left=(e.clientX-25)+'px';
  ghost.style.top=(e.clientY-25)+'px';
}
function onDragEnd(e){
  if(!drag)return;
  var info=drag;drag=null;
  if(ghost){ghost.remove();ghost=null}
  if(!info.moved)return;
  skipClick=true;
  var top=d.elementFromPoint(e.clientX,e.clientY);
  var btn=top&&top.closest?top.closest('.cust'):null;
  if(btn&&!btn.disabled){
    sel=info.id;
    tapCust(+btn.getAttribute('data-slot'));
  }
}
d.addEventListener('pointermove',onDragMove);
d.addEventListener('pointerup',onDragEnd);
d.addEventListener('pointercancel',onDragEnd);

function paint(){
  var cfg=L();
  fryers.forEach(function(f,i){
    var ring=d.querySelector('.fryer[data-i="'+i+'"] .ring');
    if(!ring)return;
    var pct=0;
    if(f.state==='cook')pct=Math.min(100,(f.t/cfg.cook)*100);
    else if(f.state==='ready'||f.state==='burnt')pct=100;
    ring.style.setProperty('--p',String(pct));
  });
  custs.forEach(function(c){
    var bar=d.querySelector('.cust[data-slot="'+c.slot+'"] .pbar i');
    if(!bar||c.leave)return;
    var pct=Math.max(0,c.patience/c.maxP);
    bar.style.width=(pct*100)+'%';
    bar.style.background=pct>0.45?'#148c44':(pct>0.22?'#e0a800':'#c0392b');
  });
  var fillPct=drinkT<0?0:Math.min(1,drinkT/L().drink);
  if(drinkFill)drinkFill.style.height=(fillPct*100)+'%';
  var tip=d.getElementById('toast');
  if(tip){tip.textContent=toastMsg;tip.className='toast'+(toastT>0?' on':'')}
}

function loop(ts){
  if(!run)return;
  var dt=Math.min((ts-last)/1000,.05);last=ts;
  update(dt);
  if(dirty){render();dirty=false}
  paint();
  if(run)raf=requestAnimationFrame(loop);
}

function showHud(on){
  if(hud)hud.hidden=!on;
  if(on)d.body.classList.add('playing');
  else d.body.classList.remove('playing');
}

function start(){
  lv=0;money=0;run=true;ov.hidden=true;ov.classList.remove('runstart','shopstart');
  if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
  showHud(true);
  resetLevel(false);
  last=performance.now();
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(loop);
}

function pauseEnd(title,msg,again){
  run=false;cancelAnimationFrame(raf);
  ov.classList.remove('runstart','shopstart');
  if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
  showHud(false);
  ovT.textContent=title;
  ovS.innerHTML=msg;go.textContent=again;ov.hidden=false;
}

function levelClear(){
  if(lv>=LEVELS.length-1){
    var nb=money>best;if(nb){best=money;G.setBest(KEY,best)}
    pauseEnd('全部過關','3 關總營業額 <span class="big">$'+money+'</span><br>'+(nb?'新的最高分':'最高分 $'+best)+G.pickHtml(),'再玩一次');
    return;
  }
  run=false;cancelAnimationFrame(raf);
  ov.classList.remove('runstart','shopstart');
  if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
  showHud(false);
  ovT.textContent='第 '+(lv+1)+' 關過關';
  ovS.innerHTML='目前營業額 <span class="big">$'+money+'</span><br>下一關客人會更快。';
  go.textContent='下一關';
  go.dataset.next='1';
  ov.hidden=false;
}

function fail(){
  var nb=money>best;if(nb){best=money;G.setBest(KEY,best)}
  pauseEnd('時間到','第 '+(lv+1)+' 關沒達到 $'+L().goal+'<br>總營業額 <span class="big">$'+money+'</span><br>'+(nb?'新的最高分':'最高分 $'+best)+G.pickHtml(),'再玩一次');
}

go.addEventListener('click',function(){
  if(go.dataset.next==='1'){
    go.dataset.next='';
    lv+=1;run=true;ov.hidden=true;
    showHud(true);
    resetLevel(true);
    last=performance.now();
    raf=requestAnimationFrame(loop);
    return;
  }
  start();
});
drinkBtn.addEventListener('click',takeDrink);
trashBtn.addEventListener('click',trash);
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&run){
    run=false;cancelAnimationFrame(raf);
    ov.classList.remove('runstart','shopstart');if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
    showHud(false);
    ovT.textContent='暫停中';ovS.textContent='回到頁面後再開始';
    go.textContent='重新開始';go.dataset.next='';ov.hidden=false;
  }
});

window.PCShop={
  start:start,
  startFry:startFry,
  tapFryer:tapFryer,
  pickFlav:pickFlav,
  takeDrink:takeDrink,
  advance:function(sec){
    if(!run)return;
    update(sec);
    if(dirty){render();dirty=false}
    paint();
  },
  seed:function(){
    // put a mid-cook pot and a waiting customer for screenshots
    if(!fryers.length)return;
    startFry('fries');
    if(fryers[1]){startFry('loopy');fryers[1].t=1.2}
    if(fryers[0])fryers[0].t=1.6;
    while(custs.length<3)spawnCust();
    mark();render();paint();
  },
  plateReady:function(){
    if(!custs.length)spawnCust();
    var c=custs[0];
    var o=c.order[0];
    if(o.type==='drink'){
      tray.push({id:nextId(),type:'drink',flavor:null});
    }else{
      tray.push({id:nextId(),type:o.type,flavor:o.flavor});
    }
    mark();render();paint();
  },
  info:function(){return {run:run,lv:lv,money:money,timeLeft:timeLeft,tray:tray.length,custs:custs.length,fryers:fryers.map(function(f){return f.state})}}
};

lv=0;resetLevel(false);
})();
