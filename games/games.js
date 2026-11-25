(function(w){
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
function asset(p){return '../assets/'+p+'?v=11'}
function pickHtml(){
  var k;do{k=Math.floor(Math.random()*PICKS.length)}while(k===lastPick&&PICKS.length>1);
  lastPick=k;var p=PICKS[k];
  return '<div class="rec"><span class="recl">今天必點</span><div class="recb"><img'+(p.sq?' class="sq"':'')+' src="'+asset(p.i)+'" alt="'+p.n+'" width="68" height="68"><div><b>'+p.n+'</b><span class="rt">'+p.t+'</span></div></div><a class="go" href="../index.html'+p.to+'">看這一項</a></div>';
}
function getBest(key){
  try{return parseInt(localStorage.getItem(key)||'0',10)||0}catch(e){return 0}
}
function setBest(key,n){
  try{localStorage.setItem(key,String(n))}catch(e){}
}
function loadImg(src){
  var im=new Image();
  im.src=asset(src);
  return im;
}
w.PCGames={asset:asset,pickHtml:pickHtml,getBest:getBest,setBest:setBest,loadImg:loadImg};
})(window);
