(function(){
var d=document,G=window.PCGames;
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var how=d.getElementById('how'),ovlogo=d.getElementById('ovlogo'),wrap=d.getElementById('wrap');
var hud=d.getElementById('hud'),fine=d.getElementById('fine');
var elLv=d.getElementById('lv'),elTime=d.getElementById('time'),elMoney=d.getElementById('money'),elGoal=d.getElementById('goal');
var elCusts=d.getElementById('custs');
var elRaws=d.getElementById('raws'),elFryers=d.getElementById('fryers'),elFlavs=d.getElementById('flavs');
var elPlates=d.getElementById('plates'),elServes=d.getElementById('serves'),elDrinks=d.getElementById('drinks');
var trashBtn=d.getElementById('trashBtn'),pauseBtn=d.getElementById('pauseBtn');
var KEY='pcGameShopBest';
var best=G.getBest(KEY);
var SEATS=4;
var IMG='img/shop/';
var FOOD={
  fries:{name:'薯條',price:80,img:IMG+'fries.webp',bin:IMG+'bin-fries.webp'},
  loopy:{name:'捲捲薯',price:90,img:IMG+'loopy.webp',bin:IMG+'bin-loopy.webp'},
  pops:{name:'雞米花',price:100,img:IMG+'pops.webp',bin:IMG+'bin-pops.webp'},
  drink:{name:'飲料',price:45,img:IMG+'drink.webp'}
};
var FLAV={
  onion:{name:'酸奶洋蔥',img:IMG+'jar-onion.webp'},
  bbq:{name:'碳烤BBQ',img:IMG+'jar-bbq.webp'},
  cheese:{name:'香濃起司',img:IMG+'jar-cheese.webp'},
  chili:{name:'香辣BBQ',img:IMG+'jar-chili.webp'}
};
var FOODS=['fries','loopy','pops'],FLAVS=['onion','bbq','cheese','chili'];
var SKINS=['a','b','c','d'];
var LEVELS=[
  {goal:360,time:90,fryers:3,spawn:4.5,patience:20,cook:3.2,burn:6.2,combo:0.18,drink:1.6},
  {goal:640,time:90,fryers:3,spawn:3.3,patience:15,cook:2.7,burn:5.3,combo:0.4,drink:1.4},
  {goal:900,time:90,fryers:3,spawn:2.6,patience:12,cook:2.3,burn:4.6,combo:0.55,drink:1.2}
];
var run=false,lv=0,timeLeft=90,money=0,levelMoney=0,fryers=[],plates=[],serves=[],drinks=[],sel=null;
var custs=[],spawnT=0,uid=1,last=0,raf=0,toastT=0,toastMsg='',dirty=true,coins=[];
function mark(){dirty=true}
function L(){return LEVELS[lv]}
function nextId(){return uid++}
function preventPage(e){if(ov&&!ov.hidden)return;e.preventDefault()}
wrap.addEventListener('touchmove',preventPage,{passive:false});

function icon(src,cls){return '<img src="'+src+'" alt="" draggable="false"'+(cls?' class="'+cls+'"':'')+'>'}
function itemHtml(it,cls){
  var flav=it.flavor?icon(FLAV[it.flavor].img,'flav'):'';
  return '<div class="item '+(cls||'')+(it.burnt?' burnt':'')+'" data-id="'+it.id+'">'+icon(FOOD[it.type].img)+flav+'</div>';
}
function skinSrc(skin,mood){return IMG+'cust-'+skin+'-'+mood+'.webp'}
function moodOf(c){
  if(c.leave==='ok')return 'happy';
  if(c.leave==='gone'||c.patience/c.maxP<=0.28)return 'angry';
  return 'idle';
}

function makeOrder(comboChance){
  function oneFood(){return {type:FOODS[Math.random()*FOODS.length|0],flavor:FLAVS[Math.random()*FLAVS.length|0],done:0}}
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
  timeLeft=cfg.time;levelMoney=0;spawnT=0.25;
  fryers=[];for(var i=0;i<3;i++)fryers.push({id:i,food:null,t:0,state:'empty'});
  plates=[null,null,null];serves=[null,null,null];
  drinks=[{t:-1,cup:null},{t:-1,cup:null},{t:-1,cup:null}];
  sel=null;custs=[];coins=[];
  if(!keepMoney)money=0;
  elLv.textContent=String(lv+1)+'/3';
  elGoal.textContent='$'+cfg.goal;
  elMoney.textContent='$'+money;
  elTime.textContent=String(Math.ceil(timeLeft));
  syncGoal();
  buildStations();
  render();
}

function buildStations(){
  elRaws.innerHTML=FOODS.map(function(k){
    return '<button class="cell st raw" data-food="'+k+'" type="button">'+icon(FOOD[k].bin)+'<span>'+FOOD[k].name+'</span></button>';
  }).join('');
  elFlavs.innerHTML=FLAVS.map(function(k){
    return '<button class="cell st flav" data-flav="'+k+'" type="button">'+icon(FLAV[k].img)+'<span>'+({onion:'洋蔥',bbq:'BBQ',cheese:'起司',chili:'香辣'}[k]||FLAV[k].name)+'</span></button>';
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
    var slot=-1;for(var p=0;p<plates.length;p++)if(!plates[p]){slot=p;break}
    if(slot<0){toast('待調味盤滿了');return}
    plates[slot]={id:nextId(),type:f.food,flavor:null,shaking:0};
    f.food=null;f.t=0;f.state='empty';
    render();return;
  }
  if(f.state==='burnt'){
    f.food=null;f.t=0;f.state='empty';
    render();return;
  }
}

function pickFlav(k){
  if(!run)return;
  var slot=-1;
  if(sel!=null){
    for(var i=0;i<plates.length;i++){
      if(plates[i]&&plates[i].id===sel&&!plates[i].flavor&&!plates[i].shaking)slot=i;
    }
  }
  if(slot<0){
    for(var i=0;i<plates.length;i++){
      if(plates[i]&&!plates[i].flavor&&!plates[i].shaking){slot=i;break}
    }
  }
  if(slot<0){toast('先把炸好的放到待調味盤');return}
  plates[slot].flavor=k;plates[slot].shaking=0.55;
  render();
}

function takeDrink(i){
  if(!run)return;
  if(i==null)i=0;
  var m=drinks[i];
  if(!m)return;
  if(m.cup){
    if(autoServeItem(m.cup))return;
    sel=(sel===m.cup.id)?null:m.cup.id;
    render();return;
  }
  if(m.t>=0)return;
  m.t=0;render();
}

function trash(){
  if(!run)return;
  if(sel!=null){
    for(var i=0;i<serves.length;i++)if(serves[i]&&serves[i].id===sel){serves[i]=null;sel=null;render();return}
    for(var i=0;i<plates.length;i++)if(plates[i]&&plates[i].id===sel&&!plates[i].shaking){plates[i]=null;sel=null;render();return}
    for(var i=0;i<drinks.length;i++)if(drinks[i].cup&&drinks[i].cup.id===sel){drinks[i].cup=null;sel=null;render();return}
  }
  for(var i=0;i<plates.length;i++)if(plates[i]&&!plates[i].shaking&&!plates[i].flavor){plates[i]=null;render();return}
  toast('先點要丟掉的餐點');
}

function findItem(id){
  for(var i=0;i<serves.length;i++)if(serves[i]&&serves[i].id===id)return {it:serves[i],idx:i,kind:'serve'};
  for(var i=0;i<drinks.length;i++)if(drinks[i].cup&&drinks[i].cup.id===id)return {it:drinks[i].cup,idx:i,kind:'drink'};
  for(var i=0;i<plates.length;i++)if(plates[i]&&plates[i].id===id)return {it:plates[i],idx:i,kind:'plate'};
  return null;
}
function removeFound(found){
  if(!found)return;
  if(found.kind==='serve')serves[found.idx]=null;
  else if(found.kind==='drink')drinks[found.idx].cup=null;
  else if(found.kind==='plate')plates[found.idx]=null;
}

function spawnCoins(slot){
  coins.push({slot:slot,t:0.8});
  mark();
}

function serveTo(c, it, idx){
  if(c.arrive>0||c.leave)return false;
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
  removeFound(findItem(it.id));
  sel=null;
  var leftover=c.order.filter(function(o){return !o.done});
  if(leftover.length===0){
    var price=0;
    c.order.forEach(function(o){price+=FOOD[o.type].price});
    var tip=Math.round(price*0.28*(c.patience/c.maxP));
    addMoney(price+tip);
    toast('+$'+(price+tip)+(tip?(' 含小費 $'+tip):''));
    spawnCoins(c.slot);
    c.leave='ok';c.leaveT=0.7;
  }
  render();
  return true;
}

function autoServeItem(it){
  if(!it)return false;
  var list=custs.slice().sort(function(a,b){return a.patience-b.patience});
  for(var i=0;i<list.length;i++){
    if(list[i].leave||list[i].arrive>0)continue;
    if(serveTo(list[i],it))return true;
  }
  return false;
}
function autoServe(id){
  var found=findItem(id);
  if(!found)return false;
  return autoServeItem(found.it);
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

function syncGoal(){
  var el=d.getElementById('goalFill'),g=L().goal;
  if(el)el.style.width=Math.min(100,(levelMoney/g)*100)+'%';
}
function addMoney(n){
  money+=n;levelMoney+=n;
  elMoney.textContent='$'+money;
  syncGoal();
}

function toast(m){toastMsg=m;toastT=1.15}

function spawnCust(instant){
  if(custs.length>=SEATS)return;
  var used={};custs.forEach(function(c){used[c.slot]=1});
  var slot=0;for(;slot<SEATS;slot++)if(!used[slot])break;
  var usedSkin={};custs.forEach(function(c){usedSkin[c.skin]=1});
  var skin=SKINS.filter(function(s){return !usedSkin[s]})[0]||SKINS[Math.random()*SKINS.length|0];
  var cfg=L();
  custs.push({
    slot:slot,order:makeOrder(cfg.combo),patience:cfg.patience,maxP:cfg.patience,
    skin:skin,leave:null,leaveT:0,enter:0,fromDoor:!instant,arrive:instant?0:0.7
  });
  mark();
}

function seatLeft(slot){return 14+(slot+0.5)*(72/SEATS)}

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
  plates.forEach(function(p,i){
    if(!p||!(p.shaking>0))return;
    p.shaking-=dt;
    if(p.shaking<=0){
      var slot=-1;for(var s=0;s<serves.length;s++)if(!serves[s]){slot=s;break}
      if(slot<0){p.shaking=0.1;return}
      serves[slot]={id:p.id,type:p.type,flavor:p.flavor};
      plates[i]=null;mark();
    }
  });
  drinks.forEach(function(m){
    if(m.t<0)return;
    m.t+=dt;
    if(m.t>=cfg.drink){
      if(m.cup){m.t=cfg.drink-0.05;return}
      m.cup={id:nextId(),type:'drink',flavor:null};m.t=-1;mark();
    }
  });
  custs.forEach(function(c){
    if(c.arrive>0){c.arrive-=dt;if(c.arrive<0)c.arrive=0;return}
    if(c.leave){c.leaveT-=dt;return}
    c.patience-=dt;
    if(c.patience<=0){c.leave='gone';c.leaveT=0.55;toast('客人走了');mark()}
  });
  var n=custs.length;custs=custs.filter(function(c){return !(c.leave&&c.leaveT<=0)});if(custs.length!==n)mark();

  spawnT-=dt;
  if(spawnT<=0){spawnCust(false);spawnT=cfg.spawn;mark()}

  if(toastT>0)toastT-=dt;
  coins=coins.filter(function(x){x.t-=dt;return x.t>0});
  if(levelMoney>=cfg.goal){levelClear();return}
  if(timeLeft<=0){fail();return}
}

function render(){
  var cfg=L();
  var html='';
  for(var s=0;s<SEATS;s++){
    var c=null;custs.forEach(function(x){if(x.slot===s)c=x});
    if(!c)continue;
    var leaving=c.leave==='gone'?' leaving':(c.leave==='ok'?' happy-leave':'');
    var entering=c.fromDoor?' entering':'';
    html+='<button class="cust'+leaving+entering+'" data-slot="'+s+'" type="button" style="left:'+seatLeft(s)+'%">';
    if(c.arrive<=0 && !c.fromDoor){
      html+='<div class="bubble">';
      c.order.forEach(function(o){
        html+='<span class="need'+(o.done?' done':'')+'">'+icon(FOOD[o.type].img)+(o.flavor?icon(FLAV[o.flavor].img,'flav'):'')+'</span>';
      });
      html+='</div>';
      var pct=Math.max(0,c.patience/c.maxP);
      var col=pct>0.45?'#148c44':(pct>0.22?'#e0a800':'#c0392b');
      html+='<div class="pbar"><i style="width:'+(pct*100)+'%;background:'+col+'"></i></div>';
    }
    html+='<img class="body" src="'+skinSrc(c.skin,moodOf(c))+'" alt="" draggable="false">';
    coins.forEach(function(cn){
      if(cn.slot===s)html+='<img class="fly-coin" src="'+IMG+'coin.webp" alt="" draggable="false">';
    });
    html+='</button>';
  }
  elCusts.innerHTML=html;
  [].forEach.call(elCusts.querySelectorAll('.cust'),function(btn){
    btn.addEventListener('click',function(){tapCust(+btn.getAttribute('data-slot'))});
  });
  if(custs.some(function(c){return c.fromDoor})){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        custs.forEach(function(c){c.fromDoor=false});
        [].forEach.call(elCusts.querySelectorAll('.cust.entering'),function(el){el.classList.remove('entering')});
      });
    });
  }

  function slotHtml(it,kind,i,lab){
    var busy=it&&it.shaking>0?' busy':'';
    var hold=it?('<div class="hold">'+itemHtml(it,it.id===sel?'picked':'')+(it.shaking>0?'':'')+'</div>'):'';
    return '<button class="cell slot '+kind+busy+'" data-kind="'+kind+'" data-i="'+i+'" type="button"><img class="dish" src="'+IMG+'plate-round.webp" alt="" draggable="false">'+hold+'<span class="plab">'+lab+'</span></button>';
  }
  elPlates.innerHTML=plates.map(function(it,i){
    var lab=!it?'待調味':(it.shaking>0?'調味中':(it.flavor?'好了':'選粉'));
    return slotHtml(it,'plate',i,lab);
  }).join('');
  elServes.innerHTML=serves.map(function(it,i){
    return slotHtml(it,'serve',i,it?'出餐':'');
  }).join('');
  [].forEach.call((elPlates&&elPlates.querySelectorAll('.item'))||[],function(el){
    bindItem(el,+el.getAttribute('data-id'));
  });
  [].forEach.call((elServes&&elServes.querySelectorAll('.item'))||[],function(el){
    bindItem(el,+el.getAttribute('data-id'));
  });

  elFryers.innerHTML=fryers.map(function(f,i){
    var st=f.state;
    var lab=st==='empty'?'空':(st==='cook'?'油炸中':(st==='ready'?'好了':(st==='burnt'?'焦了':'')));
    var pct=0;
    if(st==='cook')pct=Math.min(100,(f.t/cfg.cook)*100);
    else if(st==='ready'||st==='burnt')pct=100;
    var src=st==='burnt'?IMG+'fryer-wide-burnt.webp':((st==='cook'||st==='ready')?IMG+'fryer-wide-cook.webp':IMG+'fryer-wide-empty.webp');
    var food=(f.food&&st!=='empty')?'<img class="food-in" src="'+FOOD[f.food].img+'" alt="" draggable="false">':'';
    return '<button class="cell fryer '+st+'" data-i="'+i+'" type="button"><span class="ring" style="--p:'+pct+'"></span><img class="art" src="'+src+'" alt="" draggable="false">'+food+'<span class="plab">'+lab+'</span></button>';
  }).join('');
  [].forEach.call(elFryers.querySelectorAll('.fryer'),function(btn){
    btn.addEventListener('click',function(){tapFryer(+btn.getAttribute('data-i'))});
  });

  elDrinks.innerHTML=drinks.map(function(m,i){
    var fillPct=m.t<0?0:Math.min(1,m.t/cfg.drink);
    var lab=m.cup?'點杯':(m.t>=0?'裝杯中':'');
    var cup=m.cup?'<img class="cup-out item'+(m.cup.id===sel?' picked':'')+'" data-id="'+m.cup.id+'" src="'+FOOD.drink.img+'" alt="" draggable="false">':'';
    return '<button class="cell drink-eq'+(m.t>=0?' busy':'')+'" data-i="'+i+'" type="button"><img class="art" src="'+IMG+'drink-wide.webp" alt="" draggable="false"><i class="drink-fill" style="height:'+(fillPct*22)+'px"></i>'+cup+'<span class="plab">'+lab+'</span></button>';
  }).join('');
  [].forEach.call(elDrinks.querySelectorAll('.drink-eq'),function(btn){
    btn.addEventListener('click',function(){takeDrink(+btn.getAttribute('data-i'))});
  });
  [].forEach.call(elDrinks.querySelectorAll('.cup-out'),function(el){
    bindItem(el,+el.getAttribute('data-id'));
  });

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
    var src=d.querySelector('.item[data-id="'+drag.id+'"], .cup-out[data-id="'+drag.id+'"]');
    if(!src)return;
    ghost=src.cloneNode(true);
    ghost.classList.add('ghost');
    d.body.appendChild(ghost);
  }
  ghost.style.left=(e.clientX-24)+'px';
  ghost.style.top=(e.clientY-24)+'px';
}
function onDragEnd(e){
  if(!drag)return;
  var info=drag;drag=null;
  if(ghost){ghost.remove();ghost=null}
  if(!info.moved)return;
  skipClick=true;
  var top=d.elementFromPoint(e.clientX,e.clientY);
  var btn=top&&top.closest?top.closest('.cust'):null;
  if(btn){
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
    var body=d.querySelector('.cust[data-slot="'+c.slot+'"] .body');
    var el=d.querySelector('.cust[data-slot="'+c.slot+'"]');
    if(el&&!c.fromDoor)el.classList.remove('entering');
    if(body){
      var src=skinSrc(c.skin,moodOf(c));
      if(body.getAttribute('src')!==src)body.setAttribute('src',src);
    }
    if(!bar||c.leave)return;
    var pct=Math.max(0,c.patience/c.maxP);
    bar.style.width=(pct*100)+'%';
    bar.style.background=pct>0.45?'#148c44':(pct>0.22?'#e0a800':'#c0392b');
  });
  var cfgP=L();
  drinks.forEach(function(m,i){
    var fill=d.querySelector('.drink-eq[data-i="'+i+'"] .drink-fill');
    if(fill)fill.style.height=((m.t<0?0:Math.min(1,m.t/cfgP.drink))*22)+'px';
  });
  syncGoal();
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
  if(pauseBtn)pauseBtn.hidden=!on;
  if(on)d.body.classList.add('playing');
  else d.body.classList.remove('playing');
}
function pauseGame(){
  if(!run)return;
  run=false;cancelAnimationFrame(raf);
  ov.classList.remove('runstart','shopstart');if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
  showHud(false);
  ovT.textContent='暫停中';ovS.textContent='點按鈕再開始';
  go.textContent='重新開始';go.dataset.next='';ov.hidden=false;
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
if(trashBtn)trashBtn.addEventListener('click',trash);
if(pauseBtn)pauseBtn.addEventListener('click',pauseGame);
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
    if(!fryers.length)return;
    startFry('fries');
    startFry('loopy');
    startFry('pops');
    if(fryers[0])fryers[0].t=1.6;
    if(fryers[1])fryers[1].t=1.2;
    if(fryers[2])fryers[2].t=0.8;
    plates[0]={id:nextId(),type:'fries',flavor:null,shaking:0};
    serves[0]={id:nextId(),type:'loopy',flavor:'cheese'};
    drinks[0].t=0.6;
    drinks[1].cup={id:nextId(),type:'drink',flavor:null};
    while(custs.length<4)spawnCust(true);
    custs.forEach(function(c){c.enter=0;c.fromDoor=false;c.arrive=0});
    mark();render();paint();
  },
  plateReady:function(){
    if(!custs.length)spawnCust(true);
    var c=custs[0];
    var o=c.order.filter(function(x){return !x.done})[0]||c.order[0];
    var slot=-1;for(var i=0;i<serves.length;i++)if(!serves[i]){slot=i;break}
    if(slot<0)slot=0;
    if(o.type==='drink'){
      serves[slot]={id:nextId(),type:'drink',flavor:null};
    }else{
      serves[slot]={id:nextId(),type:o.type,flavor:o.flavor};
    }
    mark();render();paint();
  },
  pay:function(){
    for(var i=0;i<serves.length;i++)if(serves[i]&&autoServeItem(serves[i]))return;
    for(var i=0;i<drinks.length;i++)if(drinks[i].cup&&autoServeItem(drinks[i].cup))return;
  },
  info:function(){return {run:run,lv:lv,money:money,timeLeft:timeLeft,serves:serves.filter(Boolean).length,custs:custs.length,fryers:fryers.map(function(f){return f.state})}}
};

lv=0;resetLevel(false);
})();
