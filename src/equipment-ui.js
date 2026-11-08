'use strict';
const $=id=>document.getElementById(id);
let listStates=InventoryList.defaults(),listResult=null;
let pointValues=null,pointDraft=null;
let statValues=null,statDraft=null,statsReady=false;
let friendPending=new Map(),friendDrafts=new Map(),friendLoveValues=null,friendLoveDraft=null,friendSelected=null,countDrafts=new Map(),optionDrafts=new Map(),invalidDrafts=new Map();
const newAdds=new Map();let catalogVerified=false;
const hasEdits=()=>pendingSize()>0||invalidDrafts.size>0;
function resetDrafts(){newAdds.clear();pointValues=null;pointDraft=null;statDraft=null;friendPending.clear();friendDrafts.clear();friendLoveValues=null;friendLoveDraft=null;countDrafts.clear();optionDrafts.clear();invalidDrafts.clear();}

const pendingSize=()=>newAdds.size+counts.size+options.size+(statValues?1:0)+friendPending.size+(friendLoveValues?1:0)+(pointValues?1:0);
let optionScope='affixes',nativeSession=null;
let doc=null,model=null,file=null,counts=new Map(),options=new Map(),selected=null,tab='stats',generation=0,revision=0,busy=false;
function msg(text,error=false){$('status').textContent=text;$('status').className=error?'status error':'status';}
function dl(data,name,type='application/octet-stream'){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function filename(){return file.name.replace(/\.es3$/i,'').replace(/[^\p{L}\p{N}_. -]/gu,'_').slice(0,100);}
function sync(){
 for(const id of ['addTrial','addQuantity','catalogSearch','catalogState','verifyCatalog'])$(id).disabled=busy;
 const cash=Equipment.money(model);$('moneyButton').disabled=!cash||busy;
 $('moneyButton').textContent=cash?'돈 · 동전 수정 ('+Number(counts.get(cash.path)??cash.count).toLocaleString()+')':'돈 · 동전 수정';
 $('backup').disabled=!doc||busy; $('file').disabled=busy; if($('nativeOpen'))$('nativeOpen').disabled=busy; $('export').disabled=!doc||busy||pendingSize()===0||invalidDrafts.size>0;
 $('clear').disabled=busy||!hasEdits();$('stage').disabled=!selected||busy||tab==='gears'&&!!Equipment.editable(selected);
 for(const el of document.querySelectorAll('#fields input,#fields select,#statsFields input,#friendFields input,#friendLoveFields input,#friendPicker,#pointsFields input'))el.disabled=busy||el.dataset.locked==='true';
 $('stageStats').disabled=!doc||busy||!statsReady;
 syncListControls();
 $('pendingCount').textContent=(pendingSize())+'개 대상 변경 대기';
}
function clearDetail(){selected=null;$('selection').textContent='목록에서 항목을 선택하세요';$('owner').textContent='';$('fields').replaceChildren();sync();}
async function loadFile(f){
 if(!f||busy)return;
 if(!f.skipConfirm && hasEdits() && !confirm('대기 변경을 버리고 다른 파일을 여시겠습니까?'))return;
 const gen=++generation;revision++;listStates=InventoryList.defaults();listResult=null;statValues=null;resetDrafts();friendSelected=null;doc=null;model=null;file=null;counts=new Map();options=new Map();
 $('list').replaceChildren();$('changes').replaceChildren();$('matches').textContent='';$('totals').textContent='분석 중…';clearDetail();
 try{
  if(!/\.es3$/i.test(f.name)||f.size>SaveCore.MAX_BYTES)throw Error('10 MiB 이하의 .es3 파일을 선택하세요.');
  const bytes=new Uint8Array(await f.arrayBuffer());if(gen!==generation)return;
  const parsed=SaveCore.requireGame(SaveCore.parse(bytes)),inspected=Equipment.inspect(parsed);
  doc=parsed;model=inspected;file=f;nativeSession=f.nativeSession||null;$('search').value='';
  $('totals').textContent=f.name+' · 일반 아이템 '+model.items.length+'종 · 장비 '+model.gears.length+'개';
  render();sync();msg('세이브를 열었습니다. 주인공 능력치, 아이템 수량, 장비 옵션을 편집하세요.');
 }catch(e){if(gen!==generation)return;$('totals').textContent='열기 실패';msg(e.message,true);sync();}
}
function render(){
 $('addPanel').hidden=tab!=='add';$('addTab').classList.toggle('active',tab==='add');
 $('pointsPanel').hidden=tab!=='points';$('pointsTab').classList.toggle('active',tab==='points');
 $('itemsTab').classList.toggle('active',tab==='items');$('gearsTab').classList.toggle('active',tab==='gears');
 $('statsTab').classList.toggle('active',tab==='stats');$('statsPanel').hidden=tab!=='stats';$('friendsPanel').hidden=tab!=='friends';$('friendsTab').classList.toggle('active',tab==='friends');$('inventoryGrid').hidden=tab==='stats'||tab==='friends'||tab==='points'||tab==='add';
 if(tab==='add'){renderAdd();return;}if(tab==='points'){renderPoints();return;}if(tab==='stats'){renderStats();return;}if(tab==='friends'){renderFriends();return;}
 $('scope').hidden=tab!=='gears';$('list').replaceChildren();
 const state=listStates[tab];renderCategoryFilters(state);$('search').value=state.query;$('scope').value=state.scope;$('pageSize').value=String(state.size);
 $('listSort').replaceChildren();for(const [value,label] of InventoryList.sorts(tab))$('listSort').append(option(value,label));$('listSort').value=state.sort;
 listResult=InventoryList.query(model?(tab==='items'?model.items:model.gears):[],state,tab);state.page=listResult.page;
 $('matches').textContent=model?(listResult.total?'총 '+listResult.total+'개 · '+listResult.start+'–'+listResult.end+'번째 · '+listResult.page+' / '+listResult.pages+' 페이지':'검색 결과가 없습니다.'):'파일을 열면 목록이 표시됩니다.';
 $('pageSelect').replaceChildren();for(let n=1;n<=listResult.pages;n++)$('pageSelect').append(option(String(n),n+' / '+listResult.pages));if(!listResult.pages)$('pageSelect').append(option('1','0 / 0'));$('pageSelect').value=String(state.page);
 for(const x of listResult.entries){
  const button=document.createElement('button');button.className='entry';button.setAttribute('data-path',x.path);button.classList.toggle('selected',selected?.path===x.path);button.setAttribute('aria-pressed',selected?.path===x.path?'true':'false');
  if(counts.has(x.path)||options.has(x.path))button.classList.add('changed');
  const title=document.createElement('strong'),sub=document.createElement('span');title.textContent=x.label;
  sub.textContent=Categories.describe(x,tab).text+' · '+(tab==='items'?'현재 '+Number(x.count).toLocaleString()+'개'+(counts.has(x.path)?' → '+Number(counts.get(x.path)).toLocaleString()+'개 (변경 대기)':''):x.owner+' · 장비 등급 '+x.level+' · '+x.effects.map(Equipment.effectLabel).join(' / '));
  button.append(title,sub);button.onclick=()=>{if(!busy){choose(x);render();}};$('list').append(button);
 }
 syncListControls();
}
function option(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;return o;}
function choose(x){
 selected=x;$('selection').textContent=x.label;$('owner').textContent=(x.owner||'주인공 보유 아이템')+' · '+Categories.describe(x,tab).text;$('fields').replaceChildren();
 if(tab==='items'){
  const p=document.createElement('p');p.textContent='현재 수량: '+Number(x.count).toLocaleString()+'개';
  const currency=Equipment.isMoney(x);
  const label=document.createElement('label');label.textContent=currency?'보유 금액 선택 (동전)':'수량 선택';label.htmlFor='quantityPreset';
  const select=document.createElement('select');select.id='quantityPreset';
  const current=countDrafts.get(x.path)??counts.get(x.path)??x.count;
  for(const n of [...new Set([x.count,'1','10','99','100','999','1000','9999','10000','99999','100000','999999','1000000',current])].sort((a,b)=>Number(a)-Number(b)))select.append(option(n,Number(n).toLocaleString()+'개'+(n===x.count?' (현재)':'')));
  select.append(option('custom','직접 입력'));select.value=current;
  const input=document.createElement('input');input.id='quantity';input.type='text';input.inputMode='numeric';input.value=current;input.setAttribute('aria-label','설정할 수량');
  select.onchange=()=>{if(select.value!=='custom')input.value=select.value;else input.focus();};input.oninput=()=>{select.value='custom';};
  if(currency&&current!=='0')select.prepend(option('0','0 (동전)'));
  const note=document.createElement('p');note.className='muted';note.textContent=currency?'주인공이 보유한 동전(铜钱)만 수정합니다. 입력 범위 0~1,000,000은 편집기 제한입니다. 게임 내 상한·불러오기는 미검증입니다. 상점 잔액은 바꾸지 않습니다.':'입력 범위 1~1,000,000개는 편집기 제한입니다. 게임의 수량 상한은 미검증입니다. 0개 삭제와 새 아이템 추가는 지원하지 않습니다.';
  $('fields').append(p,label,select,input,note);
 }else{
  const reason=Equipment.editable(x)||(!catalogVerified?'분류별 아이템 추가 화면에서 설치 데이터를 먼저 확인하세요.':''),p=document.createElement('p');
  p.textContent=reason||'장비별 후보만 선택합니다. 등급 '+x.level+'은 현재 장비 생성 등급입니다. 새 중첩은 복사본 시험이며 게임 효과는 미검증입니다.';
  $('fields').append(p);
  const stored=optionDrafts.get(x.path)||options.get(x.path)||x.effects.map(e=>e.id);
  let rows=stored.flatMap(id=>{const [key,levels]=JSON.parse(id);return levels.map(lv=>({key,lv}));});
  const box=document.createElement('div');box.id='effectFields';$('fields').append(box);
  function buildEffects(){box.replaceChildren();rows.forEach((row,i)=>{
   const label=document.createElement('label');label.textContent='중첩 '+(i+1)+' · 등급 '+row.lv;
   const kind=document.createElement('select');kind.id='effect'+i;kind.className='effectKind';kind.dataset.locked=String(!!reason);
   for(const key of [...new Set([row.key,...x.recommended])])kind.append(option(key,(GameCatalog.skills[key]?.label||key)+' ['+key+']'));
   kind.value=row.key;kind.disabled=!!reason;
   const value=document.createElement('input');value.type='hidden';value.className='effect';value.value=JSON.stringify([row.key,[row.lv]]);
   kind.onchange=()=>{row.key=kind.value;value.value=JSON.stringify([row.key,[row.lv]]);};
   box.append(label,kind,value);
  });}
  buildEffects();
  const add=document.createElement('button');add.type='button';add.textContent='새 옵션 중첩 추가 · 복사본 시험';add.id='appendEffect';
  add.disabled=!!reason||rows.length>=x.slotLimit;
  add.onclick=()=>{if(busy||reason||rows.length>=x.slotLimit)return;rows.push({key:x.recommended[0],lv:x.level});buildEffects();add.disabled=rows.length>=x.slotLimit;$('stage').onclick();};
  $('fields').append(add);
  const note=document.createElement('p');note.className='muted';note.textContent='같은 옵션의 반복은 한 키의 레벨 배열로 저장합니다. 기존 중첩 삭제는 차단합니다. 정의 슬롯 '+x.slotLimit+'개, 현재 중첩 '+x.effects.reduce((n,f)=>n+f.levels.length,0)+'개. 영화 부착은 별도 기능으로 미지원입니다.';$('fields').append(note);

 }
 const details=document.createElement('details'),summary=document.createElement('summary'),path=document.createElement('code');summary.textContent='저장 위치 확인';path.textContent=x.path;details.append(summary,path);$('fields').append(details);sync();
}
function pending(){
 $('changes').replaceChildren();
 for(const [type,changes] of [['items',counts],['gears',options]])for(const [path,value] of changes){
  const x=(type==='items'?model.itemByPath:model.gearByPath).get(path),li=document.createElement('li'),text=document.createElement('span'),remove=document.createElement('button');
  text.textContent=describe(type,x,value);remove.textContent='취소';remove.onclick=()=>{if(busy)return;changes.delete(path);countDrafts.delete(path);optionDrafts.delete(path);invalidDrafts.delete('entry:'+path);revision++;pending();render();if(selected?.path===path)choose(selected);};li.append(text,remove);$('changes').append(li);
 }
 if(statValues){const li=document.createElement('li'),remove=document.createElement('button');li.textContent='주인공 능력치 · '+PlayerStats.definitions.map(([k,label])=>label+' '+statValues[k]).join(' / ')+' · 기혈 자동 계산';remove.textContent='취소';remove.onclick=()=>{if(busy)return;statValues=null;statDraft=null;invalidDrafts.delete('stats');revision++;pending();render();};li.append(remove);$('changes').append(li);}
 const linked=!!statValues||[...options.keys()].some(p=>p.startsWith(PlayerStats.root+'/PlayerDressEquip/'));
 if(linked&&doc){const li=document.createElement('li');try{const d=SaveCore.parse(Equipment.apply(doc,counts,options)),r=PlayerStats.calculate(d,statValues||PlayerStats.fields(d));li.textContent='기혈 자동 연계: 최대 '+fmt(r.oldMax)+' → '+fmt(r.max)+' / 현재 '+fmt(r.oldHp)+' → '+fmt(r.hp);}catch(e){li.textContent=e.message;li.className='error';}$('changes').append(li);}
 pointChanges();friendChanges();invalidChanges();sync();
}
function describe(type,x,value){return type==='items'?x.label+' : '+x.count+' → '+value+'개':x.label+' ('+x.owner+') : '+x.effects.map(Equipment.effectLabel).join(' / ')+' → '+Equipment.validateChoice(x,value).map(Equipment.effectLabel).join(' / ');}
$('file').onchange=e=>{const f=e.target.files[0];e.target.value='';loadFile(f);};
$('moneyButton').onclick=()=>{
 if(busy)return;const cash=Equipment.money(model);if(!cash)return;
 tab='items';clearDetail();listStates.items={...InventoryList.defaults().items,query:'铜钱'};render();choose(cash);
 msg('주인공 보유 동전입니다. 금액 입력 후 세이브 저장을 누르세요.');
};
for(const [id,value] of [['addTab','add'],['pointsTab','points'],['statsTab','stats'],['friendsTab','friends'],['itemsTab','items'],['gearsTab','gears']])$(id).onclick=()=>{if(busy)return;tab=value;clearDetail();render();};
$('categoryFilter').onchange=()=>changeList('category',$('categoryFilter').value);
$('subcategoryFilter').onchange=()=>changeList('subcategory',$('subcategoryFilter').value);
$('search').oninput=()=>changeList('query',$('search').value);
$('scope').onchange=()=>changeList('scope',$('scope').value);
$('listSort').onchange=()=>changeList('sort',$('listSort').value);
$('pageSize').onchange=()=>changeList('size',Number($('pageSize').value));
$('pageSelect').onchange=()=>changeList('page',Number($('pageSelect').value));
$('firstPage').onclick=()=>changeList('page',1);$('prevPage').onclick=()=>changeList('page',listStates[tab]?.page-1);
$('nextPage').onclick=()=>changeList('page',listStates[tab]?.page+1);$('lastPage').onclick=()=>changeList('page',listResult?.pages);
function changeList(key,value){if(busy||!listStates[tab])return;listStates[tab][key]=value;if(key==='category')listStates[tab].subcategory='all';if(key!=='page')listStates[tab].page=1;render();$('list').scrollTop=0;}
function syncListControls(){const active=!!model&&!!listStates[tab]&&!busy;
 for(const id of ['listSort','pageSize','search','scope','categoryFilter','subcategoryFilter'])$(id).disabled=!active;
 $('pageSelect').disabled=!active||!listResult?.pages;
 $('firstPage').disabled=$('prevPage').disabled=!active||!listResult?.pages||listResult.page<=1;
 $('nextPage').disabled=$('lastPage').disabled=!active||!listResult?.pages||listResult.page>=listResult.pages;
}

$('stage').onclick=()=>{
 try{
  if(!selected||busy)return;
  if(tab==='items'){
   countDrafts.set(selected.path,$('quantity').value);const v=Equipment.number(selected,$('quantity').value);if(v===selected.count)counts.delete(selected.path);else counts.set(selected.path,v);
  }else{
   const rawIds=[...document.querySelectorAll('.effect')].map(s=>s.value);optionDrafts.set(selected.path,rawIds);const ids=Equipment.validateChoice(selected,rawIds).map(f=>f.id);
   if(JSON.stringify(ids)===JSON.stringify(selected.effects.map(x=>x.id)))options.delete(selected.path);else options.set(selected.path,ids);
  }
  invalidDrafts.delete('entry:'+selected.path);revision++;pending();render();msg(window.nativeRequest?'변경이 자동 반영됐습니다. 세이브 저장을 누르면 자동 백업 후 적용합니다.':'변경 목록에 추가했습니다. 다운로드 전까지 파일은 변경되지 않습니다.');
 }catch(e){invalidDrafts.set('entry:'+selected.path,e.message);pending();msg(e.message,true);}
};
$('clear').onclick=()=>{if(!busy&&confirm('대기 변경을 모두 취소할까요?')){counts.clear();options.clear();statValues=null;resetDrafts();statDraft=null;invalidDrafts.delete('stats');revision++;pending();render();if(selected)choose(selected);}};
$('backup').onclick=()=>{if(doc&&!busy)dl(doc.bytes,filename()+'.ORIGINAL-BACKUP.es3');};
$('export').onclick=async()=>{
 if(!doc||busy||pendingSize()===0||invalidDrafts.size)return;
 busy=true;sync();const gen=generation,rev=revision,source=doc,f=file,oldCounts=new Map(counts),oldOptions=new Map([...options].map(([k,v])=>[k,[...v]])),oldAdds=new Map(newAdds),oldTrial=$('addTrial').checked,name=filename();
 try{
  const current=new Uint8Array(await f.arrayBuffer());
  if(gen!==generation||rev!==revision)throw Error('파일 또는 변경 목록이 바뀌어 내보내기를 취소했습니다.');
  if(current.length!==source.bytes.length||current.some((b,i)=>b!==source.bytes[i]))throw Error('원본 파일이 외부에서 변경되었습니다. 다시 여세요.');
  for(const id of oldAdds.keys())if([...oldCounts.keys()].some(p=>p===Additions.plan(source,new Map([[id,oldAdds.get(id)]]),oldTrial).bag.ptr+'/'+id))throw Error('같은 항목의 수량 설정과 추가를 동시에 저장할 수 없습니다. 하나를 취소하세요.');
  let out=Equipment.apply(source,oldCounts,oldOptions);
  const copyOnly=oldAdds.size>0||oldOptions.size>0;
  if(copyOnly&&!catalogVerified)throw Error('검증한 설치 데이터가 필요합니다.');
  if(oldAdds.size)out=Additions.apply(SaveCore.parse(out),oldAdds,oldTrial);
  if(statValues||[...oldOptions.keys()].some(p=>p.startsWith(PlayerStats.root+'/PlayerDressEquip/'))){const staged=SaveCore.parse(out);out=PlayerStats.apply(staged,statValues||PlayerStats.fields(staged));}
  out=FriendStats.apply(SaveCore.parse(out),friendPending,friendGearPaths(oldOptions));
  if(friendLoveValues)out=FriendStats.applyLove(SaveCore.parse(out),friendLoveValues);
  if(pointValues)out=PlayerPoints.apply(SaveCore.parse(out),pointValues);
  const preview=[...oldCounts].map(([p,v])=>describe('items',model.itemByPath.get(p),v)).concat([...oldOptions].map(([p,v])=>describe('gears',model.gearByPath.get(p),v))).join('\n\n');
  if(window.nativeRequest){
   if(!nativeSession)throw Error('위쪽 세이브 열기 버튼으로 실제 파일을 다시 여세요.');
   msg('원본 자동 백업 및 세이브 저장 중…');
   const result=await window.nativeRequest({kind:copyOnly?'save-copy':'save',session:nativeSession,data:toBase64(out)});
   if(result.cancelled){msg('복사본 저장을 취소했습니다. 변경 계획은 유지됩니다.');return;}
   doc=SaveCore.parse(out);model=Equipment.inspect(doc);file=new File([out],f.name);file.nativeSession=result.session;nativeSession=result.session;
   counts.clear();options.clear();statValues=null;resetDrafts();statDraft=null;invalidDrafts.delete('stats');revision++;pending();render();clearDetail();
   $('totals').textContent=result.path+' · 저장 완료';
   msg(copyOnly?'복사본 저장 완료 · 게임 검증 전 시험본: '+result.path:'세이브 저장 완료. 게임에서 이 슬롯을 불러오세요. 자동 백업: '+result.backup);
  }else{
   if(!confirm('별도 수정본을 다운로드합니다. 게임에 바로 적용하려면 EXE를 사용하세요.\n\n'+preview.slice(0,6000)))return;
   dl(out,name+'.ITEMS-EDITED.es3');msg('수정본 다운로드를 요청했습니다. 브라우저 버전은 원본을 교체하지 않습니다.');
  }
 }catch(e){msg(e.message,true);}finally{busy=false;sync();}
};
window.addEventListener('beforeunload',e=>{if(hasEdits()){e.preventDefault();e.returnValue='';}});sync();

function toBase64(data){let s='';for(let i=0;i<data.length;i+=16384)s+=String.fromCharCode(...data.subarray(i,i+16384));return btoa(s);}
function installNative(){
 let sequence=0;const requests=new Map();
 window.nativeRequest=payload=>new Promise((resolve,reject)=>{const id=String(++sequence);requests.set(id,{resolve,reject});chrome.webview.postMessage({...payload,id});});
 chrome.webview.addEventListener('message',e=>{const r=e.data,p=requests.get(r.id);if(!p)return;requests.delete(r.id);r.ok?p.resolve(r):p.reject(Error(r.error||'요청 실패'));});
 $('file').parentElement.hidden=true;$('backup').hidden=true;
 const open=document.createElement('button');open.id='nativeOpen';open.className='primary';open.textContent='게임 세이브 열기';$('file').parentElement.before(open);
 open.onclick=async()=>{
  if(busy)return;
  if(hasEdits()&&!confirm('저장하지 않은 변경을 버리고 다른 세이브를 여시겠습니까?'))return;
  busy=true;sync();
  try{const r=await nativeRequest({kind:'open'});if(r.cancelled)return;
   const f=new File([Uint8Array.from(atob(r.data),c=>c.charCodeAt(0))],r.name);f.nativeSession=r.session;f.skipConfirm=true;
   busy=false;await loadFile(f);if(model)$('totals').textContent=r.path+' · 일반 아이템 '+model.items.length+'종 · 장비 '+model.gears.length+'개';
  }catch(e){msg(e.message,true);}finally{busy=false;sync();}
 };
 $('export').textContent='세이브 저장 · 자동 백업';
 $('saveHelp').textContent='기존 값만 편집하면 자동 백업 후 같은 파일에 저장합니다. 아이템 추가·옵션 변경이 있으면 새 복사본으로 저장합니다. 게임을 종료하고 시험용 복사본을 여세요.';
 msg('게임을 종료하고 실제 세이브 파일을 여세요. 저장하면 자동 백업 후 원래 파일에 적용합니다.');
}
if(window.chrome?.webview)installNative();

function fmt(n){return Number(n).toLocaleString('ko-KR',{maximumFractionDigits:3});}
function renderStats(){
 statsReady=false;
 $('statsFields').replaceChildren();$('statsPreview').replaceChildren();$('stageStats').disabled=!doc||busy;if(!doc)return;
 try{
  const values=statDraft||statValues||PlayerStats.fields(doc);
  for(const [key,label,max] of PlayerStats.definitions){const box=document.createElement('label');box.textContent=label;const input=document.createElement('input');input.type='number';input.step='1';input.min='1';input.max=String(max);input.id='stat'+key;input.value=values[key];input.disabled=busy;input.oninput=previewStats;box.append(input);$('statsFields').append(box);}
  previewStats();
 }catch(e){$('statsPreview').textContent=e.message;$('statsPreview').className='error';$('stageStats').disabled=true;}
}
function statInputs(){return Object.fromEntries(PlayerStats.definitions.map(([key])=>[key,$('stat'+key).value]));}
function previewStats(){
 const preview=$('statsPreview');preview.replaceChildren();statsReady=false;
 try{
  const d=SaveCore.parse(Equipment.apply(doc,new Map(),options)),r=PlayerStats.calculate(d,statInputs());preview.className='';
  const table=document.createElement('table');for(const [label,before,after] of [['연계 수치','현재 세이브','변경 후'],['기본 기혈',Number(d.byPath.get(PlayerStats.root+'/_BaseHp').raw),r.base],['최대 기혈',r.oldMax,r.max],['현재 기혈',r.oldHp,r.hp]]){const row=document.createElement('tr');for(const val of [label,before,after]){const c=document.createElement('td');c.textContent=typeof val==='number'?fmt(val):val;row.append(c);}table.append(row);}preview.append(table);
  const info=document.createElement('p');info.className='muted';info.textContent='계산에 적용한 체백: '+fmt(r.effective[3])+' (기본 '+r.values.PhysicalPower+' + 장비·특성 보정). 잃은 기혈량을 유지하며 현재 기혈이 0 이하가 되면 1로 계산합니다.';preview.append(info);
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='기혈 보정 근거 '+r.sources.length+'개';details.append(summary);for(const x of r.sources){const line=document.createElement('div');line.textContent=x.source+' · '+(GameCatalog.skills[x.key]?.label||x.key)+' '+fmt(x.value);details.append(line);}preview.append(details);
  statsReady=true;$('stageStats').disabled=busy;
 }catch(e){preview.className='error';preview.textContent=e.message;$('stageStats').disabled=true;}
}
$('stageStats').onclick=()=>queueStats(true);
function queueStats(force=false){if(busy||!doc)return;statDraft=statInputs();try{const d=SaveCore.parse(Equipment.apply(doc,new Map(),options)),r=PlayerStats.calculate(d,statDraft);statValues=force||r.changes.size?{...statDraft}:null;invalidDrafts.delete('stats');revision++;pending();msg('능력치 변경이 자동 반영됐습니다. 세이브 저장을 누르면 기혈도 함께 적용됩니다.');}catch(e){invalidDrafts.set('stats',e.message);pending();msg(e.message,true);}}


function stagedEquipment(){return options.size?SaveCore.parse(Equipment.apply(doc,new Map(),options)):doc;}
function friendGearPaths(opts){const paths=new Set();for(const path of opts.keys()){const marker='/_PlayerDressEquip/';if(path.startsWith('/saveFriendData/value/')&&path.includes(marker))paths.add(path.slice(0,path.indexOf(marker)));}return paths;}
function renderFriends(){
 const picker=$('friendPicker');picker.replaceChildren();$('friendFields').replaceChildren();$('friendInfo').textContent='';$('friendPreview').textContent='';
 if($('friendLoveFields'))$('friendLoveFields').replaceChildren();if($('friendLovePreview'))$('friendLovePreview').textContent='';
 if(!doc)return;
 renderFriendLove();
 const all=FriendStats.inspect(doc);if(!all.some(x=>x.path===friendSelected))friendSelected=all[0]?.path||null;
 for(const x of all)picker.append(option(x.path,x.name+' ('+x.ko+') · '+x.group+' ['+x.id+']'));
 picker.value=friendSelected||'';if(!friendSelected){$('friendInfo').textContent='이 세이브에는 합류·이탈 동료가 없습니다.';return;}
 try{const p=FriendStats.data(doc,friendSelected),values=friendDrafts.get(friendSelected)||friendPending.get(friendSelected)||FriendStats.fields(doc,friendSelected),who=all.find(x=>x.path===friendSelected);
 $('friendInfo').textContent='레벨 '+p._Lv+(who?.initLove!==null?' · 초기 호감도 '+who.initLove:'')+(who?.shixindan?' · 제5장 시심단 변수('+who.shixindan+')':'')+' · 포인트 직접 설정은 배운 특성을 유지합니다.';
 for(const [k,label] of FriendStats.definitions){const box=document.createElement('label'),input=document.createElement('input');box.textContent=label;input.id='friend'+k;input.type='number';input.min='0';input.max='1000000';input.step='1';input.value=values[k];input.disabled=busy;box.append(input);$('friendFields').append(box);}friendPreview();
 }catch(e){$('friendPreview').textContent=e.message;}
}
function renderFriendLove(){
 const container=$('friendLoveFields');if(!container||!doc)return;container.replaceChildren();
 try{
  const entries=FriendStats.inspectLove(doc),stored=friendLoveDraft||friendLoveValues||{};
  for(const x of entries){
   const box=document.createElement('label'),input=document.createElement('input');
   box.textContent=x.slot+'번 '+x.ko+' ('+x.name+') · '+(x.present?'현재 기록':'미기록 · 초기 '+x.init)+(x.shixindan?' · [시심단 변수]':'');
   input.id='friendLove_'+x.id;input.dataset.loveId=x.id;input.dataset.locked=String(!x.present);
   input.type='number';input.min='0';input.max='1000';input.step='1';
   input.value=x.present?(stored[x.id]??x.value):String(x.init);
   input.disabled=busy||!x.present;
   box.append(input);container.append(box);
  }
  previewFriendLove();
 }catch(e){if($('friendLovePreview')){$('friendLovePreview').className='status error';$('friendLovePreview').textContent=e.message;}}
}
function friendLoveInputs(){
 const out={};for(const x of FriendStats.inspectLove(doc)){if(!x.present)continue;const el=$('friendLove_'+x.id);if(el)out[x.id]=el.value;}return out;
}
function previewFriendLove(){
 const preview=$('friendLovePreview');if(!preview||!doc)return;
 try{
  const entries=FriendStats.inspectLove(doc),presentCount=entries.filter(x=>x.present).length;
  if(!presentCount){preview.className='status';preview.textContent='이 세이브에는 아직 초기화된 FriendLoveNum 호감도 기록이 없습니다 (테이블 기본 초기값 참조).';return;}
  const r=FriendStats.calculateLove(doc,friendLoveInputs());
  preview.className='status';
  preview.textContent='기록된 호감도 슬롯 '+presentCount+'개 중 '+r.changes.size+'개 변경 대기 (전체 23슬롯 · 제5장 시심단 변수 7인 표시)';
 }catch(e){preview.className='status error';preview.textContent=e.message;}
}
function queueFriendLove(){
 if(busy||!doc)return;friendLoveDraft=friendLoveInputs();
 try{
  const r=FriendStats.calculateLove(doc,friendLoveDraft);
  friendLoveValues=r.changes.size?{...friendLoveDraft}:null;
  invalidDrafts.delete('friendLove');revision++;pending();previewFriendLove();
  msg('동료 호감도(FriendLoveNum) 변경이 자동 반영됐습니다. 세이브 저장을 누르면 적용됩니다.');
 }catch(e){invalidDrafts.set('friendLove',e.message);pending();previewFriendLove();msg(e.message,true);}
}
function friendInputs(){return Object.fromEntries(FriendStats.definitions.map(([k])=>[k,$('friend'+k).value]));}
function friendPreview(){try{
 const d=stagedEquipment(),p=FriendStats.data(d,friendSelected),r=FriendStats.calculate(d,friendSelected,friendInputs(),friendGearPaths(options).has(friendSelected)).linked;
 $('friendPreview').className='status';
 $('friendPreview').textContent=r?'기혈 미리보기: 최대 '+fmt(r.oldMax)+' → '+fmt(r.max)+' / 현재 '+fmt(r.oldHp)+' → '+fmt(r.hp)+' · 계산 체백 '+fmt(r.effective):'기혈: 현재 '+fmt(p._Hp)+' / 최대 '+fmt(p._MaxHp)+' · 체백이나 장착 옵션을 바꾸면 자동 계산합니다.';
 }catch(e){$('friendPreview').className='status error';$('friendPreview').textContent='기혈 미리보기: '+e.message;}}

$('friendPicker').onchange=()=>{friendSelected=$('friendPicker').value;renderFriends();};
function queueFriend(){if(busy||!doc||!friendSelected)return;const key='friend:'+friendSelected,values=friendInputs();friendDrafts.set(friendSelected,values);try{const r=FriendStats.calculate(stagedEquipment(),friendSelected,values,friendGearPaths(options).has(friendSelected));if(r.changes.size)friendPending.set(friendSelected,{...values});else friendPending.delete(friendSelected);invalidDrafts.delete(key);revision++;pending();friendPreview();msg('동료 변경이 자동 반영됐습니다. 세이브 저장을 누르면 적용됩니다.');}catch(e){invalidDrafts.set(key,e.message);pending();friendPreview();msg(e.message,true);}}
function friendChanges(){
 if(!doc)return;const all=FriendStats.inspect(doc);
 for(const [path,values] of friendPending){const li=document.createElement('li'),button=document.createElement('button'),who=all.find(x=>x.path===path);li.textContent=who.name+' ('+who.group+') · '+FriendStats.definitions.map(([k,label])=>label+' '+values[k]).join(' / ');button.textContent='취소';button.onclick=()=>discardDraft('friend:'+path);li.append(button);$('changes').append(li);}
 if(friendLoveValues){
  const entries=FriendStats.inspectLove(doc),summary=entries.filter(x=>x.present&&friendLoveValues[x.id]!==undefined&&friendLoveValues[x.id]!==x.value).map(x=>x.ko+' '+x.value+'→'+friendLoveValues[x.id]);
  if(summary.length){const li=document.createElement('li'),button=document.createElement('button');li.textContent='동료 호감도(FriendLoveNum) · '+summary.join(' / ');button.textContent='취소';button.onclick=()=>discardDraft('friendLove');li.append(button);$('changes').append(li);}
 }
}
function discardDraft(key){if(busy)return;if(key==='points'){pointValues=null;pointDraft=null;}else if(key==='stats'){statValues=null;statDraft=null;}else if(key==='friendLove'){friendLoveValues=null;friendLoveDraft=null;}else if(key.startsWith('friend:')){const path=key.slice(7);friendPending.delete(path);friendDrafts.delete(path);}else{const path=key.slice(6);counts.delete(path);options.delete(path);countDrafts.delete(path);optionDrafts.delete(path);}invalidDrafts.delete(key);revision++;pending();render();if(selected&&tab!=='stats'&&tab!=='friends')choose(selected);}
function invalidChanges(){for(const [key,error] of invalidDrafts){const li=document.createElement('li'),button=document.createElement('button');li.className='error';li.textContent='저장 전 확인: '+error;button.textContent='이 입력 취소';button.onclick=()=>discardDraft(key);li.append(button);$('changes').append(li);}}
document.addEventListener('input',e=>{
 if(busy||!doc)return;
 if(e.target.closest('#pointsFields'))queuePoints();
 else if(e.target.closest('#statsFields'))queueStats();
 else if(e.target.closest('#friendFields'))queueFriend();
 else if(e.target.closest('#friendLoveFields'))queueFriendLove();
 else if(e.target.id==='quantity')$('stage').onclick();
});
document.addEventListener('change',e=>{if(busy||!doc)return;if(e.target.id==='quantityPreset'&&e.target.value!=='custom'||e.target.matches('.effect,.effectKind'))$('stage').onclick();});

function renderPoints(){
 $('pointsFields').replaceChildren();$('pointsPreview').textContent='';if(!doc)return;
 try{const values=pointDraft||pointValues||PlayerPoints.fields(doc);
  const skillIdxByKey=new Map((PlayerPoints.lifeSkills||[]).map(([idx,k])=>[k,idx]));
  for(const [key,label,min,max] of PlayerPoints.definitions){
   const box=document.createElement('label');box.textContent=label;
   const input=document.createElement('input');input.type='number';input.step='1';input.min=String(min);input.max=String(max);input.id='point'+key;input.value=values[key];
   const idx=skillIdxByKey.get(key),locked=idx!==undefined&&!doc.byPath.has('/savePlayerData/value/LifeExp/'+idx);
   input.dataset.locked=String(locked);input.disabled=busy||locked;
   box.append(input);$('pointsFields').append(box);
  }previewPoints();
 }catch(e){$('pointsPreview').className='status error';$('pointsPreview').textContent=e.message;}
}
function pointInputs(){return Object.fromEntries(PlayerPoints.definitions.map(([k])=>[k,$('point'+k).value]));}
function previewPoints(){try{const r=PlayerPoints.calculate(doc,pointInputs());$('pointsPreview').className='status';$('pointsPreview').textContent='특성 누적 추가분 '+r.values.TalentAdd+' / 능력치 추가분 '+r.values.AddProSpot+' / 생활 포인트 '+r.values.LifePoints+' / 의술 '+r.values.MedicineLevel+' · 단조 '+r.values.ForgeLevel+' · 해정 '+r.values.LockpickLevel;}catch(e){$('pointsPreview').className='status error';$('pointsPreview').textContent=e.message;}}
function queuePoints(){if(busy||!doc)return;pointDraft=pointInputs();try{const r=PlayerPoints.calculate(doc,pointDraft);pointValues=r.changes.size?{...pointDraft}:null;invalidDrafts.delete('points');revision++;pending();previewPoints();msg('포인트 변경이 자동 반영됐습니다. 세이브 저장을 누르면 적용됩니다.');}catch(e){invalidDrafts.set('points',e.message);pending();previewPoints();msg(e.message,true);}}
function pointChanges(){if(!pointValues)return;const li=document.createElement('li'),button=document.createElement('button');li.textContent='주인공 포인트 · '+PlayerPoints.definitions.map(([k,label])=>label+' '+pointValues[k]).join(' / ');button.textContent='취소';button.onclick=()=>discardDraft('points');li.append(button);$('changes').append(li);}

function renderCategoryFilters(state){
 const source=model?(tab==='items'?model.items:model.gears):[],groups=Categories.groups(source,tab),subs=Categories.subgroups(source,tab,state.category);
 $('categoryFilter').replaceChildren(option('all','전체 ('+source.length+')'));for(const g of groups)$('categoryFilter').append(option(g.id,g.label+' ('+g.count+')'));$('categoryFilter').value=state.category;
 $('subcategoryLabel').hidden=tab!=='items';$('subcategoryFilter').replaceChildren(option('all','전체'));for(const g of subs)$('subcategoryFilter').append(option(g.id,g.label+' ('+g.count+')'));$('subcategoryFilter').value=state.subcategory;
}

const EDITOR_CODE_ATLAS=[
 ['Lv','주인공 능력치','레벨 (Lv)','1 ~ 1,000 (권장 30~60)','기혈 기본치(레벨당 +30) 및 상위 비경·연속 전투 진입 기준'],
 ['Power','주인공 능력치','역도 (힘)','60 ~ 500 (서장 바위 12+)','외공 공격력 증폭 · 서장 동굴 바위(역도 12) 등 물리 기믹 판정'],
 ['Perception','주인공 능력치','감지 (통찰)','70 ~ 500 (팔괘진 70+)','홍향산 팔괘진 즉시 해제(70) · 비도 뽑기(30) · 숨은 상자/단서 포착'],
 ['Agility','주인공 능력치','영교 (손재주)','60 ~ 500 (설계도·함정)','묵운상행 배접 칼 설계도 · 자물쇠 즉시 해금(GetImm) · 낚시 보정'],
 ['PhysicalPower','주인공 능력치','체백 (생명력)','60 ~ 500 (기혈 배율)','최대 기혈 자동 계산의 핵심 배율(체백 1당 기본 기혈 +2% 증폭)'],
 ['Channel','주인공 능력치','경맥 (내공)','60 ~ 500 (내력·음공)','내공·심법 효율 및 진기·음공 피해량 상승'],
 ['BerathSkill','주인공 능력치','속도 (경공)','60 ~ 500 (선공·재행동)','전투 턴 선점 및 비묘답운보·연격 재행동 빈도 결정'],
 ['WuXing','주인공 능력치','오성 (깨달음)','25 ~ 100 (무공 수련)','상급 무공·심법 수련 조건 충족 및 설득·문답 선택지 보정'],
 ['MedicineLevel','특성·9대 생활 기술','의술 레벨 (LifeExp/4)','15 ~ 60 (사형 진찰 45)','3장 사형 진찰(의술 45) 직접 통과 및 생활 포인트 자동 해금(11레벨+)'],
 ['ForgeCraftWeave','특성·9대 생활 기술','단조(0)·공예(1)·재봉(2)·요리(3)','15 ~ 60 (안거성 단조 15)','안거성 절세 검(단조 15), 기관 세공(공예), 비단 방어구(재봉), 약선 요리(요리) 해금'],
 ['FishTradeSpeechLock','특성·9대 생활 기술','낚시(5)·상업(6)·화술(7)·해정(8)','15 ~ 60 (즉시 어획·해금)','낚시 즉시 어획(GetImm), 상점·암시장 흥정, 설득 분기, 자물쇠 즉시 해금(CaltHelpOpenLock)'],
 ['LifePoints','특성·9대 생활 기술','생활 포인트 (남은 수량)','10 ~ 50 (UseLifePeak 연동)','9대 생활 기술 레벨 합산으로 해금된 생활 특기 포인트를 원하는 잔여 수량으로 설정'],
 ['TalentAdd','특성·9대 생활 기술','특성 포인트 (누적 추가분)','10 ~ 30 (전투·생활 특성)','기존 배운 특성을 유지한 채 추가 특성을 자유롭게 개방'],
 ['money-coin','화폐·필수 약재','보유 동전 (노잣돈 · 铜钱)','100,000 ~ 500,000문','단방회 상인 쇼핑(운상천·칠보옥여의), 광림성 오두 구매, 오자사 시주 해결'],
 ['herb-moon-dew','화폐·필수 약재','월수 (月髓 · 황우곡 4대 약재)','1 ~ 3개','토천천 영입 필수 약재 1 — 홍향산 밤 연못 채집 또는 화흥성 교수 의뢰'],
 ['herb-snow-lotus','화폐·필수 약재','천산설련 (天山雪莲 · 4대 약재)','1 ~ 3개','토천천 영입 필수 약재 2 — 황우곡 단방 고소강에게 구매'],
 ['herb-aconite','화폐·필수 약재','오두 (乌头 · 황우곡 4대 약재)','1 ~ 3개','토천천 영입 필수 약재 3 — 광림성 약방 해랍아에게 구매'],
 ['herb-ascension-dew','화폐·필수 약재','승천로 (承天露 · 4대 약재)','1 ~ 3개','토천천 영입 필수 약재 4 — 용거성 시내 약방에서 구매'],
 ['pill-zhanghua','화폐·필수 약재','장화단 (3妆花缎) · 연수단','5 ~ 20개','게임 재저장 보존이 확인된 대표 회복·성장 재료 및 천년설삼 연수단'],
 ['item-miasma-water','화폐·필수 약재','장기 제거수 (驱瘴水)','1 ~ 3개','안거성 동쪽 고분 독안개 돌파 및 수(寿) 영입 필수 영약'],
 ['gear-lingshuang','신병·핵심 장비','능상 (凌霜 · 전설 신병 검)','장비 등급 5~6 · 치명/빙결','서호지궁 도안 + 천산 자루 + 필보산장 코등이 + 임안교 검신 제작'],
 ['gear-guanggun','신병·핵심 장비','광곤 (一根老光棍 · 전설 신병 곤)','장비 등급 5~6 · 연격/제어','홍향산 연못·동굴·서쪽 성벽 동굴 3대 부품 + 영온 제작'],
 ['gear-fenghua','신병·핵심 장비','풍화검 · 금색 백화살 · 금색 천권','동료 호감도 60 전용 신병','묘화래(풍화검), 서삼랑(금색 백화살), 랑연(금색 천권·천추) 종결 무기'],
 ['gear-frenzy-neck','신병·핵심 장비','광기 목걸이 · 영롱심 · 기뢰고','핵심 장신구 3대장','아리 후속(광기 목걸이), 아심여철(영롱심), 박인도 기우(기뢰고)'],
 ['manual-xuantian','내공·무공 비급','현천공 · 오자선심 · 파도구음공','최상급 내공·심법','사명가위 완결(현천공), 오자사 대역 폭로(오자선심), 칠요환패 교환'],
 ['manual-sword34','내공·무공 비급','검삼십사 · 금사금학권 · 천인소','최상급 초식 비급','녹칠 호감도 60(검삼십사), 권법 코어(금사금학권), 음공 코어(천인소)'],
 ['FriendLoveData','호감도·분기 변수','동료 23개 호감도 슬롯 (FriendLoveNum)','초기치 0~90 · 이벤트 60+','아수(초기 90), 랑형·상릉상(초기 30), 사형(초기 20), 부(초기 15), 사소·녹칠(초기 10) 및 랑구사(23번) 슬롯 관리'],
 ['ShixindanFlags','호감도·분기 변수','제5장 구판 악 노선 시심단 변수 7종','0(미투여) / 1(투여)','토천천·랑연·서삼랑·사소·묘춘야·묘화래·장영롱 7인 전용 시심단 강제 재영입 플래그 (후천충·녹칠·사형 비할당)'],
 ['CaltChongBattleHP','투충·미니게임 수식','투충(고충) 기본 기혈·공격력 수식','기혈 ((등급×0.1+1)²×750+350)','기본 공격력 ((등급×0.1+1)²×200+50)×난수(0.80~1.21) · 오행 상성 우위 1.5배 / 열세 0.5배 적용'],
 ['CaltChongSkill5','투충·미니게임 수식','투충 5대 상태이상 특수기 판정','출혈·흡혈·화상·중독·빙결','고충 전투 중 등급·속성별로 발동하는 5대 특수 상태이상(출혈·흡혈·화상·중독·빙결) 피해 및 제어 수식'],
 ['SaveFishData','투충·미니게임 수식','낚시 세이브 데이터 · 즉시 어획 판정','영교·낚싯대 보정 (GetImm)','능력치·낚싯대 등급 충족 시 미니게임 생략 즉시 어획(GetImm), 다중 어획량(AwardNumber), 실패 보정 보상(GiveFailAward) 관리'],
 ['CaltHelpOpenLock','투충·미니게임 수식','자물쇠 따기 즉시 해금 · 내구도 수식','영교·해정 임계치 즉시 해금','영교(Agility)·해정(LifeExp/8) 수치에 따라 자물쇠 크기(LockSize) 확장, 내구도 감소율(HPReduce) 완화 및 미니게임 생략 즉시 해금(GetImm) 판정'],
 ['SaveSeedData','생활·상점·무공 테이블','약초밭 씨앗 재배 데이터 (SaveSeedData)','성장 단계 · 수확 수량 기록','황우곡·거점 약초밭에 심은 영약 씨앗의 경과 시간 및 수확 가능 상태 저장 테이블'],
 ['SaveTrapPutData','생활·상점·무공 테이블','수렵 덫 설치 데이터 (SaveTrapPutData)','설치 좌표 · 포획 보상 기록','야외 사냥터에 설치한 덫의 위치와 시간 경과 후 포획된 야수·재료 결과 저장 테이블'],
 ['SaveShopData','생활·상점·무공 테이블','상점·암시장 재고 데이터 (SaveShopData)','한정 재고 · 암시장 1·3·6단계','광림성 오두(한정 1개), 황우곡 단방회 상인, 오천성 암시장(특수 재료 1·3·6개 제출 해금) 품목별 잔여 수량 기록'],
 ['SaveGambleData','생활·상점·무공 테이블','도박장·패구·주사위 데이터 (SaveGambleData)','누적 승패 · 판돈 상한 기록','음수교 불주 고묘 패구, 금당도 만진각 주사위·기계 도박 등 미니게임 누적 승리 플래그 기록'],
 ['KFTable334','생활·상점·무공 테이블','전 무공 334종 테이블 (KFTable)','오행 5속성 · 3슬롯 코스트','금·목·수·화·토 5행 속성과 문파(school)·품급(rank 1~6)·초식 발동 코스트 3슬롯으로 구성된 334종 무공 마스터 테이블'],
 ['MissionPoint1086','생활·상점·무공 테이블','퀘스트 단계·거점 트리거 (MissionPoint)','236개 임무 · 1,086개 진행 지점','메인·문파·동료 호감도 임무 236종의 세부 진행 단계(1,086개 트리거 포인트) 달성 상태 기록']
];

function renderCodeAtlas(){
 const body=$('editorCodeAtlasBody'),catSel=$('codeAtlasCategory'),searchEl=$('codeAtlasSearch');
 if(!body||!catSel||!searchEl)return;
 if(catSel.children.length<=1){
  for(const c of [...new Set(EDITOR_CODE_ATLAS.map(r=>r[1]))])catSel.append(option(c,c));
 }
 const q=String(searchEl.value||'').trim().toLocaleLowerCase('ko'),cat=catSel.value||'all';
 const rows=EDITOR_CODE_ATLAS.filter(r=>(cat==='all'||r[1]===cat)&&(!q||r.join(' ').toLocaleLowerCase('ko').includes(q)));
 const table=document.createElement('table');
 const head=document.createElement('tr');
 for(const h of ['코드 / 분류','한글 명칭','권장 수치 · 공식','세이브 경로 · 인게임 판정 설명']){const td=document.createElement('td');td.textContent=h;head.append(td);}
 table.append(head);
 for(const [code,group,ko,rec,desc] of rows){
  const tr=document.createElement('tr');
  for(const text of [group+' ['+code+']',ko,rec,desc]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
  table.append(tr);
 }
 body.replaceChildren(table);
}
if($('codeAtlasSearch'))$('codeAtlasSearch').oninput=renderCodeAtlas;
if($('codeAtlasCategory'))$('codeAtlasCategory').onchange=renderCodeAtlas;
renderCodeAtlas();

const STAT_PRESETS={
 'starter-comfort':{Lv:'15',Power:'60',Perception:'60',Agility:'60',PhysicalPower:'60',Channel:'60',BerathSkill:'60',WuXing:'25',label:'초회차 쾌적 시작 (6대 능력치 60 · 오성 25)'},
 'skill-check-pass':{Lv:'30',Power:'120',Perception:'120',Agility:'120',PhysicalPower:'100',Channel:'100',BerathSkill:'100',WuXing:'50',label:'만능 판정 통과 (역도·감지·영교 120 · 오성 50)'},
 'veteran-ngplus':{Lv:'60',Power:'500',Perception:'500',Agility:'500',PhysicalPower:'500',Channel:'500',BerathSkill:'500',WuXing:'100',label:'고수 다회차 (레벨 60 · 전 능력치 500 · 오성 100)'}
};
function setPresetNote(txt,isErr=false){const el=$('editorPresetStatus');if(el){el.textContent=txt;el.className=isErr?'status error':'status';}}
document.addEventListener('click',e=>{
 const presetBtn=e.target.closest?.('[data-editor-preset]');
 if(presetBtn){
  const key=presetBtn.getAttribute('data-editor-preset');
  if(!doc||busy){setPresetNote('먼저 상단 [세이브 .es3 열기]로 세이브 파일을 연 뒤 프리셋을 눌러주세요.',true);return;}
  if(STAT_PRESETS[key]){
   const p=STAT_PRESETS[key];$('statsTab')?.click();
   for(const [k,v] of Object.entries(p))if(k!=='label'&&$('stat'+k))$('stat'+k).value=v;
   previewStats();queueStats(true);
   setPresetNote('프리셋 적용 완료: '+p.label+' — 하단 저장/다운로드 버튼으로 반영하세요.');
  }else if(key==='life-medicine'){
   $('pointsTab')?.click();
   const cur=PlayerPoints.fields(doc);
   const nextVals={TalentAdd:String(Math.max(15,Number(cur.TalentAdd)+15)),AddProSpot:String(Math.max(20,Number(cur.AddProSpot))),LifePoints:'20',MedicineLevel:'45'};
   for(const [k,v] of Object.entries(nextVals))if($('point'+k))$('point'+k).value=v;
   queuePoints();
   setPresetNote('프리셋 적용 완료: 의술 레벨 45 · 생활 포인트 20 · 특성 추가분 반영');
  }else if(key==='life-all-master'){
   $('pointsTab')?.click();
   const cur=PlayerPoints.fields(doc);
   const nextVals={TalentAdd:String(Math.max(30,Number(cur.TalentAdd))),AddProSpot:String(Math.max(50,Number(cur.AddProSpot))),LifePoints:'50'};
   for(const [idx,k] of PlayerPoints.lifeSkills)if(doc.byPath.has('/savePlayerData/value/LifeExp/'+idx))nextVals[k]='60';
   for(const [k,v] of Object.entries(nextVals))if($('point'+k))$('point'+k).value=v;
   queuePoints();
   setPresetNote('프리셋 적용 완료: 9대 생활 기술 레벨 60 · 생활 포인트 50 일괄 반영');
  }else if(key==='friend-love-60'){
   $('friendsTab')?.click();
   const entries=FriendStats.inspectLove(doc).filter(x=>x.present);
   if(!entries.length){setPresetNote('이 세이브에는 아직 기록된 동료 호감도(FriendLoveNum) 슬롯이 없습니다.',true);return;}
   for(const x of entries){const el=$('friendLove_'+x.id);if(el)el.value=String(Math.max(60,Number(x.value)));}
   queueFriendLove();
   setPresetNote('프리셋 적용 완료: 기록된 동료 호감도 슬롯 '+entries.length+'개를 60 이상으로 일괄 반영');
  }else if(key==='money-rich'){
   const cash=Equipment.money(model);
   if(!cash){setPresetNote('이 세이브에서 보유 동전 항목을 찾지 못했습니다.',true);return;}
   $('moneyButton')?.click();
   if($('quantity')){$('quantity').value='500000';$('stage')?.click();setPresetNote('프리셋 적용 완료: 보유 동전 500,000문 변경 대기 반영');}
  }
  return;
 }
 const qBtn=e.target.closest?.('[data-editor-qsearch]');
 if(qBtn){
  const [targetTab,kw]=(qBtn.getAttribute('data-editor-qsearch')||'').split(':');
  if(targetTab==='add'){
   $('addTab')?.click();
   const cs=$('catalogSearch');if(cs){cs.value=kw||'';cs.dispatchEvent?.(new Event('input',{bubbles:true}));cs.focus?.();}
  }else{
   $(targetTab==='gears'?'gearsTab':'itemsTab')?.click();
   const s=$('search');if(s){s.value=kw||'';if(typeof s.oninput==='function')s.oninput();s.focus?.();}
  }
  setPresetNote('한글 빠른 검색 전환: ['+(kw||'')+'] 목록 필터링');
 }
});
