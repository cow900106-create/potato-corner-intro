(function(){
var d=document,G=window.PCGames;
var ov=d.getElementById('ov'),ovT=d.getElementById('ovT'),ovS=d.getElementById('ovS'),go=d.getElementById('go');
var how=d.getElementById('how'),ovlogo=d.getElementById('ovlogo'),wrap=d.getElementById('wrap');
var hud=d.getElementById('hud'),fine=d.getElementById('fine');
var elMoney=d.getElementById('money'),elLost=d.getElementById('lost'),elHearts=d.getElementById('hearts');
var elCusts=d.getElementById('custs');
var elRaws=d.getElementById('raws'),elFryers=d.getElementById('fryers'),elFlavs=d.getElementById('flavs');
var elPlates=d.getElementById('plates'),elServes=d.getElementById('serves'),elDrinks=d.getElementById('drinks');
var trashBtn=d.getElementById('trashBtn'),pauseBtn=d.getElementById('pauseBtn'),muteBtn=d.getElementById('muteBtn');
var KEY='pcGameShopBest';
var best=G.getBest(KEY);
var SEATS=4;
var IMG='img/shop/';
var FOOD={
  fries:{name:'薯條',price:80,img:IMG+'fries.webp',bin:IMG+'bin-fries.webp'},
  loopy:{name:'捲捲薯',price:90,img:IMG+'loopy.webp',bin:IMG+'bin-loopy.webp'},
  pops:{name:'雞米花',price:100,img:IMG+'pops.webp',bin:IMG+'bin-pops.webp'},
  drink:{name:'飲料',price:45,img:IMG+'cup-cola.webp'}
};
var DRINK_IDS=['cola','sprite','tea'];
var DRINKS={
  cola:{id:'cola',name:'可樂',img:IMG+'cup-cola.webp',machine:IMG+'drink-cola.webp'},
  sprite:{id:'sprite',name:'雪碧',img:IMG+'cup-sprite.webp',machine:IMG+'drink-sprite.webp'},
  tea:{id:'tea',name:'紅茶',img:IMG+'cup-tea.webp',machine:IMG+'drink-tea.webp'}
};
var FLAV={
  onion:{name:'酸奶洋蔥',short:'洋蔥',img:IMG+'powder-onion.webp'},
  bbq:{name:'碳烤BBQ',short:'BBQ',img:IMG+'powder-bbq.webp'},
  cheese:{name:'香濃起司',short:'起司',img:IMG+'powder-cheese.webp'},
  chili:{name:'香辣BBQ',short:'香辣',img:IMG+'powder-chili.webp'}
};
var FOODS=['fries','loopy','pops'],FLAVS=['onion','bbq','cheese','chili'];
var SKINS=['a','b','c','d'];
var run=false,money=0,lost=0,pendingOver=0,fryers=[],plates=[],serves=[],drinks=[],sel=null;
var custs=[],spawnT=0,uid=1,last=0,raf=0,toastT=0,toastMsg='',dirty=true,coins=[];
function mark(){dirty=true}
function L(){
  var t=1-Math.exp(-Math.max(0,money)/700);
  return {
    fryers:3,
    spawn:4.5-t*2.2,
    patience:25-t*6,
    cook:4.0,
    burn:7.75,
    combo:0.18+t*0.5,
    drink:1.6
  };
}
function nextId(){return uid++}
function preventPage(e){if(ov&&!ov.hidden)return;e.preventDefault()}
wrap.addEventListener('touchmove',preventPage,{passive:false});

var MUTE_KEY='pcGameShopMuted';
var actx=null,master=null,meter=null,meterData=null,sizzles=[null,null,null],pourOff=0,unlocked=false;
var muted=false;
try{muted=localStorage.getItem(MUTE_KEY)==='1'}catch(e){}
function unlockAudio(){
  var AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  if(!actx){
    actx=new AC();
    master=actx.createGain();
    master.gain.value=muted?0:0.9;
    master.connect(actx.destination);
    meter=actx.createAnalyser();
    meter.fftSize=2048;
    meterData=new Uint8Array(meter.fftSize);
    master.connect(meter);
  }
  if(actx.state==='suspended')actx.resume();
  unlocked=true;
  return actx;
}
function syncMuteBtn(){
  if(!muteBtn)return;
  muteBtn.setAttribute('aria-pressed', muted?'true':'false');
  muteBtn.setAttribute('aria-label', muted?'已靜音，點擊開啟音效':'音效開啟，點擊靜音');
  muteBtn.title=muted?'已靜音':'音效開';
  muteBtn.textContent=muted?'靜音':'聲音';
}
function setMuted(on){
  muted=!!on;
  try{localStorage.setItem(MUTE_KEY, muted?'1':'0')}catch(e){}
  if(master){
    var t=actx?actx.currentTime:0;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(muted?0:0.9, t);
  }
  syncMuteBtn();
}
function toggleMute(e){
  if(e)e.stopPropagation();
  unlockAudio();
  setMuted(!muted);
}
function noiseBuf(sec){
  var n=Math.max(1,Math.floor(actx.sampleRate*sec));
  var b=actx.createBuffer(1,n,actx.sampleRate);
  var d=b.getChannelData(0);
  for(var i=0;i<n;i++)d[i]=Math.random()*2-1;
  return b;
}
function connectOut(node){node.connect(master)}
function env(g,t,peak,atk,hold,rel){
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(peak,t+atk);
  g.gain.setValueAtTime(peak,t+atk+hold);
  g.gain.exponentialRampToValueAtTime(0.0008,t+atk+hold+rel);
}
function oscTone(type,freq,freq2,dur,peak,atk){
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime;
  var o=actx.createOscillator();
  o.type=type;o.frequency.setValueAtTime(freq,t);
  if(freq2!=null)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq2),t+dur);
  var g=actx.createGain();
  env(g,t,peak,atk||0.01,Math.max(0,dur-0.08-(atk||0.01)),0.08);
  o.connect(g);connectOut(g);o.start(t);o.stop(t+dur+0.05);
}
function noiseShot(dur,peak,hp,lp,q){
  if(!unlockAudio()||!master)return;
  var t=actx.currentTime;
  var src=actx.createBufferSource();
  src.buffer=noiseBuf(Math.max(0.08,dur));
  var f=actx.createBiquadFilter();
  f.type='bandpass';
  f.frequency.value=hp||1800;
  f.Q.value=q||0.8;
  if(lp){
    var l=actx.createBiquadFilter();
    l.type='lowpass';l.frequency.value=lp;
    src.connect(f);f.connect(l);
    var g=actx.createGain();
    env(g,t,peak,0.008,Math.max(0,dur-0.05),0.06);
    l.connect(g);connectOut(g);
  }else{
    var g=actx.createGain();
    env(g,t,peak,0.008,Math.max(0,dur-0.05),0.06);
    src.connect(f);f.connect(g);connectOut(g);
  }
  src.start(t);src.stop(t+dur+0.05);
}
function sfxDrop(){
  if(!unlockAudio())return;
  var t=actx.currentTime;
  oscTone('sine',180,70,0.16,0.28,0.005);
  noiseShot(0.22,0.22,900,2400,0.6);
  noiseShot(0.35,0.12,3200,8000,1.2);
}
function sfxPowder(){
  if(!unlockAudio())return;
  var t=actx.currentTime;
  for(var i=0;i<5;i++){
    (function(delay){
      var src=actx.createBufferSource();
      src.buffer=noiseBuf(0.12);
      var f=actx.createBiquadFilter();
      f.type='bandpass';f.frequency.value=3500+Math.random()*2500;f.Q.value=1.6;
      var g=actx.createGain();
      var tt=t+delay;
      env(g,tt,0.1,0.005,0.03,0.07);
      src.connect(f);f.connect(g);connectOut(g);
      src.start(tt);src.stop(tt+0.15);
    })(i*0.05);
  }
}
function sfxPour(){
  if(!unlockAudio())return;
  var t=actx.currentTime;
  pourOff=t+1.5;
  var src=actx.createBufferSource();
  src.buffer=noiseBuf(1.6);src.loop=false;
  var f=actx.createBiquadFilter();
  f.type='bandpass';f.Q.value=0.9;
  f.frequency.setValueAtTime(1400,t);
  f.frequency.exponentialRampToValueAtTime(700,t+1.35);
  var g=actx.createGain();
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(0.16,t+0.08);
  g.gain.setValueAtTime(0.14,t+1.15);
  g.gain.exponentialRampToValueAtTime(0.0008,t+1.5);
  src.connect(f);f.connect(g);connectOut(g);
  src.start(t);src.stop(t+1.55);
}
function sfxDing(){
  if(!unlockAudio())return;
  oscTone('sine',1320,1320,0.18,0.2,0.005);
  oscTone('sine',1760,1760,0.22,0.16,0.008);
}
function sfxCoins(){
  if(!unlockAudio())return;
  var t=actx.currentTime;
  [0,0.07,0.14,0.22].forEach(function(dt,i){
    var o=actx.createOscillator();
    o.type='square';
    o.frequency.setValueAtTime(1800+i*220,t+dt);
    o.frequency.exponentialRampToValueAtTime(900+i*80,t+dt+0.09);
    var f=actx.createBiquadFilter();f.type='bandpass';f.frequency.value=2200;f.Q.value=4;
    var g=actx.createGain();
    env(g,t+dt,0.07,0.004,0.03,0.06);
    o.connect(f);f.connect(g);connectOut(g);
    o.start(t+dt);o.stop(t+dt+0.14);
  });
}
function sfxLeave(){
  if(!unlockAudio())return;
  oscTone('triangle',320,90,0.32,0.18,0.02);
  oscTone('sawtooth',180,70,0.4,0.08,0.03);
}
function sfxOver(){
  if(!unlockAudio())return;
  if(!actx)return;
  var t=actx.currentTime;
  [392,311,247].forEach(function(freq,i){
    var o=actx.createOscillator();
    o.type='triangle';o.frequency.value=freq;
    var g=actx.createGain();
    var tt=t+i*0.28;
    env(g,tt,0.16,0.02,0.22,0.18);
    o.connect(g);connectOut(g);o.start(tt);o.stop(tt+0.5);
  });
}
function startSizzle(i,state){
  if(!unlockAudio()||!master)return;
  var gain=state==='burnt'?0.045:(state==='ready'?0.035:0.05);
  var freq=state==='burnt'?1800:2800;
  if(sizzles[i]){
    var n=sizzles[i];
    var t=actx.currentTime;
    n.gain.gain.setTargetAtTime(gain,t,0.15);
    n.filt.frequency.setTargetAtTime(freq,t,0.15);
    return;
  }
  var src=actx.createBufferSource();
  src.buffer=noiseBuf(1.2);src.loop=true;
  var filt=actx.createBiquadFilter();
  filt.type='bandpass';filt.frequency.value=freq;filt.Q.value=0.7;
  var hp=actx.createBiquadFilter();
  hp.type='highpass';hp.frequency.value=800;
  var g=actx.createGain();
  g.gain.value=gain;
  var lfo=actx.createOscillator();
  lfo.type='sine';lfo.frequency.value=8+i*1.3;
  var lg=actx.createGain();lg.gain.value=gain*0.25;
  lfo.connect(lg);lg.connect(g.gain);
  src.connect(hp);hp.connect(filt);filt.connect(g);connectOut(g);
  src.start();lfo.start();
  sizzles[i]={src:src,filt:filt,gain:g,lfo:lfo,lg:lg};
}
function stopSizzle(i){
  var n=sizzles[i];
  if(!n)return;
  try{n.src.stop()}catch(e){}
  try{n.lfo.stop()}catch(e){}
  try{n.src.disconnect();n.filt.disconnect();n.gain.disconnect();n.lfo.disconnect();n.lg.disconnect()}catch(e){}
  sizzles[i]=null;
}
function stopAllSfx(){
  for(var i=0;i<sizzles.length;i++)stopSizzle(i);
}
function syncSizzle(){
  if(!fryers||!fryers.length){stopAllSfx();return}
  fryers.forEach(function(f,i){
    if(f.state==='cook'||f.state==='ready'||f.state==='burnt')startSizzle(i,f.state);
    else stopSizzle(i);
  });
}
function sfxPeak(){
  if(!meter||!meterData)return 0;
  meter.getByteTimeDomainData(meterData);
  var p=0;
  for(var i=0;i<meterData.length;i++){
    var v=Math.abs(meterData[i]-128)/128;
    if(v>p)p=v;
  }
  return p;
}
var SFX={drop:sfxDrop,sizzle:function(){startSizzle(0,'cook')},powder:sfxPowder,pour:sfxPour,ding:sfxDing,coins:sfxCoins,leave:sfxLeave,over:sfxOver};
syncMuteBtn();


function icon(src,cls){return '<img src="'+src+'" alt="" draggable="false"'+(cls?' class="'+cls+'"':'')+'>'}
function drinkOf(it){return (it&&DRINKS[it.drink])?DRINKS[it.drink]:DRINKS.cola}
function itemImg(it){return it.type==='drink'?drinkOf(it).img:FOOD[it.type].img}
function itemHtml(it,cls){
  var flav=it.flavor?icon(FLAV[it.flavor].img,'flav'):'';
  var dust=it.flavor?'<i class="dust" aria-hidden="true"></i>':'';
  var extra=(cls||'')+(it.flavor?' flav-'+it.flavor:'');
  return '<div class="item '+extra+(it.burnt?' burnt':'')+'" data-id="'+it.id+'">'+icon(itemImg(it))+flav+dust+'</div>';
}
function skinSrc(skin,mood){return IMG+'cust-'+skin+'-'+mood+'.webp'}
function moodOf(c){
  if(c.leave==='ok')return 'happy';
  if(c.leave==='gone'||c.patience/c.maxP<=0.28)return 'angry';
  return 'idle';
}

function makeOrder(comboChance){
  function oneFood(){return {type:FOODS[Math.random()*FOODS.length|0],flavor:FLAVS[Math.random()*FLAVS.length|0],done:0}}
  function oneDrink(){return {type:'drink',drink:DRINK_IDS[Math.random()*DRINK_IDS.length|0],flavor:null,done:0}}
  var r=Math.random();
  if(r<comboChance){
    if(Math.random()<.5)return [oneFood(),oneDrink()];
    return [oneFood(),oneFood(),oneDrink()];
  }
  return Math.random()<.22?[oneDrink()]:[oneFood()];
}

function resetRound(){
  spawnT=0.25;pendingOver=0;
  fryers=[];for(var i=0;i<3;i++)fryers.push({id:i,food:null,t:0,state:'empty'});
  plates=[null,null,null];serves=[null,null,null];
  drinks=DRINK_IDS.map(function(k){return {t:-1,cup:null,kind:k}});
  sel=null;custs=[];coins=[];
  elMoney.textContent='$'+money;
  syncLives();
  stopAllSfx();
  buildStations();
  render();
  syncSizzle();
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
      sfxDrop();syncSizzle();
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
    if(slot<0){toast('待調味區滿了');return}
    plates[slot]={id:nextId(),type:f.food,flavor:null,shaking:0};
    f.food=null;f.t=0;f.state='empty';
    syncSizzle();
    render();return;
  }
  if(f.state==='burnt'){
    f.food=null;f.t=0;f.state='empty';
    syncSizzle();
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
  if(slot<0){toast('先把炸好的放到待調味紙杯');return}
  plates[slot].flavor=k;plates[slot].shaking=0.55;
  sfxPowder();
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
  m.t=0;sfxPour();render();
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
    if(o.type==='drink'){if((o.drink||'')!==(it.drink||''))continue;}
    else if(o.flavor!==it.flavor)continue;
    match=i;break;
  }
  if(match<0)return false;
  c.order[match].done=1;
  removeFound(findItem(it.id));
  sel=null;
  sfxDing();
  var leftover=c.order.filter(function(o){return !o.done});
  if(leftover.length===0){
    var price=0;
    c.order.forEach(function(o){price+=FOOD[o.type].price});
    var tip=Math.round(price*0.28*(c.patience/c.maxP));
    addMoney(price+tip);
    sfxCoins();
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

function syncLives(){
  if(elLost)elLost.textContent=String(lost);
  if(elHearts){
    var html='';
    for(var i=0;i<3;i++)html+='<i class="heart'+(i<lost?' off':'')+'" aria-hidden="true"></i>';
    elHearts.innerHTML=html;
  }
  if(elHearts&&elHearts.parentNode)elHearts.parentNode.setAttribute('aria-label','走掉 '+lost+'/3');
}
function addMoney(n){
  money+=n;
  elMoney.textContent='$'+money;
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

  fryers.forEach(function(f){
    if(f.state==='cook'||f.state==='ready'){
      var prev=f.state;
      f.t+=dt;
      if(f.t>=cfg.burn)f.state='burnt';
      else if(f.t>=cfg.cook)f.state='ready';
      if(f.state!==prev){syncSizzle();mark();}
    }
  });
  plates.forEach(function(p,i){
    if(!p||!(p.shaking>0))return;
    p.shaking-=dt;
    if(p.shaking<=0){
      var slot=-1;for(var s=0;s<serves.length;s++)if(!serves[s]){slot=s;break}
      if(slot<0){p.shaking=0.1;return}
      serves[slot]={id:p.id,type:p.type,flavor:p.flavor};
      plates[i]=null;sfxDing();mark();
    }
  });
  drinks.forEach(function(m,i){
    if(m.t<0)return;
    m.t+=dt;
    if(m.t>=cfg.drink){
      if(m.cup){m.t=cfg.drink-0.05;return}
      m.cup={id:nextId(),type:'drink',drink:m.kind||DRINK_IDS[i],flavor:null};m.t=-1;mark();
    }
  });
  custs.forEach(function(c){
    if(c.arrive>0){c.arrive-=dt;if(c.arrive<0)c.arrive=0;return}
    if(c.leave){c.leaveT-=dt;return}
    c.patience-=dt;
    if(c.patience<=0){
      c.leave='gone';c.leaveT=0.55;lost+=1;syncLives();
      sfxLeave();toast('客人走了');mark();
      if(lost>=3)pendingOver=0.45;
    }
  });
  var n=custs.length;custs=custs.filter(function(c){return !(c.leave&&c.leaveT<=0)});if(custs.length!==n)mark();

  spawnT-=dt;
  if(spawnT<=0){spawnCust(false);spawnT=cfg.spawn;mark()}

  if(toastT>0)toastT-=dt;
  coins=coins.filter(function(x){x.t-=dt;return x.t>0});
  if(pendingOver>0){
    pendingOver-=dt;
    if(pendingOver<=0){gameOver();return}
  }
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
        if(o.type==='drink'){
          var dk=drinkOf(o);
          html+='<span class="need drink-need'+(o.done?' done':'')+'">'+icon(dk.img)+'<em class="dlab">'+dk.name+'</em></span>';
        }else{
          var lab=o.flavor&&FLAV[o.flavor]?FLAV[o.flavor].short:FOOD[o.type].name;
          html+='<span class="need food-need'+(o.done?' done':'')+'">'+icon(FOOD[o.type].img)+(o.flavor?icon(FLAV[o.flavor].img,'flav'):'')+'<em class="dlab">'+lab+'</em></span>';
        }
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
    var flavCls=it&&it.flavor?' flav-'+it.flavor:'';
    var filled=it?' filled':'';
    var dish='<img class="dish empty-cup" src="'+IMG+'cup-empty.webp" alt="" draggable="false">';
    var sprinkles='';
    if(it&&it.shaking>0){
      sprinkles='<span class="sprinkles" aria-hidden="true">';
      for(var n=0;n<10;n++)sprinkles+='<i style="left:'+(8+n*8)+'%;animation-delay:'+(n*0.05)+'s"></i>';
      sprinkles+='</span>';
    }
    var hold=it?('<div class="hold">'+itemHtml(it,it.id===sel?'picked':'')+sprinkles+'</div>'):'';
    return '<button class="cell slot '+kind+busy+flavCls+filled+'" data-kind="'+kind+'" data-i="'+i+'" type="button">'+dish+hold+'<span class="plab">'+lab+'</span></button>';
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
    var art=(!f.food||st==='empty')?IMG+'fryer-basket-empty.webp':(IMG+'fryer-'+f.food+'-'+(st==='burnt'?'burnt':(st==='ready'?'ready':'cook'))+'.webp');
    var fx='<span class="bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>'
      +'<span class="heat" aria-hidden="true"><i></i><i></i><i></i></span>'
      +'<span class="smoke" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
    return '<button class="cell fryer '+st+'" data-i="'+i+'" type="button"><span class="ring" style="--p:'+pct+'"></span><img class="art" src="'+art+'" alt="" draggable="false">'+fx+'<span class="plab">'+lab+'</span></button>';
  }).join('');
  [].forEach.call(elFryers.querySelectorAll('.fryer'),function(btn){
    btn.addEventListener('click',function(){tapFryer(+btn.getAttribute('data-i'))});
  });

  elDrinks.innerHTML=drinks.map(function(m,i){
    var kind=m.kind||DRINK_IDS[i];
    var dk=DRINKS[kind];
    var fillPct=m.t<0?0:Math.min(1,m.t/cfg.drink);
    var lab=m.cup?'點杯':(m.t>=0?'裝杯中':dk.name);
    var cup=m.cup?'<img class="cup-out item'+(m.cup.id===sel?' picked':'')+'" data-id="'+m.cup.id+'" src="'+drinkOf(m.cup).img+'" alt="" draggable="false">':'';
    return '<button class="cell drink-eq kind-'+kind+(m.t>=0?' busy':'')+'" data-i="'+i+'" type="button"><img class="art" src="'+dk.machine+'" alt="" draggable="false"><b class="mlab">'+dk.name+'</b><i class="drink-fill" style="height:'+(fillPct*22)+'px"></i>'+cup+'<span class="plab">'+lab+'</span></button>';
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
    var el=d.querySelector('.fryer[data-i="'+i+'"]');
    if(!el)return;
    var cook=0,pct=0;
    if(f.state==='cook'){cook=Math.min(1,f.t/cfg.cook);pct=cook*100;}
    else if(f.state==='ready'||f.state==='burnt'){cook=1;pct=100;}
    el.style.setProperty('--cook',cook.toFixed(3));
    var ring=el.querySelector('.ring');
    if(ring)ring.style.setProperty('--p',String(pct));
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
  if(hud)hud.hidden=!on;
  if(on)d.body.classList.add('playing');
  else d.body.classList.remove('playing');
}
function pauseGame(){
  if(!run)return;
  run=false;cancelAnimationFrame(raf);stopAllSfx();
  ov.classList.remove('runstart','shopstart');if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
  showHud(false);
  ovT.textContent='暫停中';ovS.textContent='點按鈕再開始';
  go.textContent='重新開始';go.dataset.next='';ov.hidden=false;
}

function start(){
  unlockAudio();
  money=0;lost=0;pendingOver=0;run=true;ov.hidden=true;ov.classList.remove('runstart','shopstart');
  if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
  showHud(true);
  resetRound();
  last=performance.now();
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(loop);
}

function pauseEnd(title,msg,again){
  run=false;cancelAnimationFrame(raf);stopAllSfx();
  toastT=0;toastMsg='';
  var tip=d.getElementById('toast');
  if(tip){tip.textContent='';tip.className='toast'}
  ov.classList.remove('runstart','shopstart');
  if(how)how.hidden=true;if(ovlogo)ovlogo.hidden=true;if(fine)fine.hidden=true;
  showHud(false);
  ovT.textContent=title;
  ovS.innerHTML=msg;go.textContent=again;ov.hidden=false;
}

function gameOver(){
  stopAllSfx();sfxOver();
  var nb=money>best;if(nb){best=money;G.setBest(KEY,best)}
  pauseEnd('客人走光了','營業額 <span class="big">$'+money+'</span><br>'+(nb?'新的最高分！':'最高分 $'+best)+G.pickHtml(),'再玩一次');
}

go.addEventListener('click',function(){
  unlockAudio();
  start();
});
function firstUnlock(){unlockAudio();d.removeEventListener('pointerdown',firstUnlock,true)}
d.addEventListener('pointerdown',firstUnlock,true);
if(muteBtn)muteBtn.addEventListener('click',toggleMute);

if(trashBtn)trashBtn.addEventListener('click',trash);
if(pauseBtn)pauseBtn.addEventListener('click',pauseGame);
d.addEventListener('visibilitychange',function(){
  if(d.hidden&&run){
    run=false;cancelAnimationFrame(raf);stopAllSfx();
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
    if(fryers[0])fryers[0].t=2.2;
    if(fryers[1])fryers[1].t=1.8;
    if(fryers[2])fryers[2].t=1.4;
    plates[0]={id:nextId(),type:'fries',flavor:null,shaking:0};
    serves[0]={id:nextId(),type:'loopy',flavor:'cheese'};
    drinks[0].cup={id:nextId(),type:'drink',drink:'cola',flavor:null};
    drinks[1].cup={id:nextId(),type:'drink',drink:'sprite',flavor:null};
    drinks[2].t=0.7;
    while(custs.length<4)spawnCust(true);
    if(custs[0])custs[0].order=[{type:'fries',flavor:'onion',done:0},{type:'drink',drink:'cola',flavor:null,done:0}];
    if(custs[1])custs[1].order=[{type:'drink',drink:'tea',flavor:null,done:0}];
    if(custs[2])custs[2].order=[{type:'loopy',flavor:'cheese',done:0},{type:'drink',drink:'sprite',flavor:null,done:0}];
    if(custs[3])custs[3].order=[{type:'pops',flavor:'bbq',done:0}];
    lost=0;syncLives();
    custs.forEach(function(c){c.enter=0;c.fromDoor=false;c.arrive=0});
    mark();render();paint();
  },
  seedServe:function(){
    if(!run)start();
    plates=[null,null,null];
    serves[0]={id:nextId(),type:'fries',flavor:'onion'};
    serves[1]={id:nextId(),type:'loopy',flavor:'cheese'};
    serves[2]={id:nextId(),type:'pops',flavor:'chili'};
    if(fryers[0]){fryers[0].food='fries';fryers[0].t=2.4;fryers[0].state='cook';}
    if(fryers[1]){fryers[1].food='loopy';fryers[1].t=1.8;fryers[1].state='cook';}
    if(fryers[2]){fryers[2].food='pops';fryers[2].t=1.2;fryers[2].state='cook';}
    while(custs.length<4)spawnCust(true);
    custs.forEach(function(c){c.enter=0;c.fromDoor=false;c.arrive=0});
    lost=0;syncLives();
    mark();render();paint();
  },
  plateReady:function(){
    if(!custs.length)spawnCust(true);
    var c=custs[0];
    var o=c.order.filter(function(x){return !x.done})[0]||c.order[0];
    var slot=-1;for(var i=0;i<serves.length;i++)if(!serves[i]){slot=i;break}
    if(slot<0)slot=0;
    if(o.type==='drink'){
      serves[slot]={id:nextId(),type:'drink',drink:o.drink,flavor:null};
    }else{
      serves[slot]={id:nextId(),type:o.type,flavor:o.flavor};
    }
    mark();render();paint();
  },
  pay:function(){
    for(var i=0;i<serves.length;i++)if(serves[i]&&autoServeItem(serves[i]))return;
    for(var i=0;i<drinks.length;i++)if(drinks[i].cup&&autoServeItem(drinks[i].cup))return;
  },
  end:function(){lost=3;syncLives();gameOver();},
  info:function(){return {run:run,money:money,lost:lost,serves:serves.filter(Boolean).length,custs:custs.length,fryers:fryers.map(function(f){return f.state})}},
  sfx:{
    unlock:unlockAudio,
    play:function(name){if(SFX[name])SFX[name]()},
    names:['drop','sizzle','powder','pour','ding','coins','leave','over'],
    muted:function(){return muted},
    setMuted:setMuted,
    ctxState:function(){return actx?actx.state:'none'},
    sizzleActive:function(){return sizzles.map(function(n){return !!n})},
    peak:sfxPeak,
    key:MUTE_KEY
  }
};

lost=0;money=0;resetRound();
})();
