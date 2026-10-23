'use strict';
const $=id=>document.getElementById(id);
let listStates=InventoryList.defaults(),listResult=null;
let pointValues=null,pointDraft=null;
let statValues=null,statDraft=null,statsReady=false;
let friendPending=new Map(),friendDrafts=new Map(),friendSelected=null,countDrafts=new Map(),optionDrafts=new Map(),invalidDrafts=new Map();
const hasEdits=()=>pendingSize()>0||invalidDrafts.size>0;
function resetDrafts(){pointValues=null;pointDraft=null;statDraft=null;friendPending.clear();friendDrafts.clear();countDrafts.clear();optionDrafts.clear();invalidDrafts.clear();}

const pendingSize=()=>counts.size+options.size+(statValues?1:0)+friendPending.size+(pointValues?1:0);
let optionScope='affixes',nativeSession=null;
let doc=null,model=null,file=null,counts=new Map(),options=new Map(),selected=null,tab='stats',generation=0,revision=0,busy=false;
function msg(text,error=false){$('status').textContent=text;$('status').className=error?'status error':'status';}
function dl(data,name,type='application/octet-stream'){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}
function filename(){return file.name.replace(/\.es3$/i,'').replace(/[^\p{L}\p{N}_. -]/gu,'_').slice(0,100);}
function sync(){
 const cash=Equipment.money(model);$('moneyButton').disabled=!cash||busy;
 $('moneyButton').textContent=cash?'돈 · 동전 수정 ('+Number(counts.get(cash.path)??cash.count).toLocaleString()+')':'돈 · 동전 수정';
 $('backup').disabled=!doc||busy; $('file').disabled=busy; if($('nativeOpen'))$('nativeOpen').disabled=busy; $('export').disabled=!doc||busy||pendingSize()===0||invalidDrafts.size>0;
 $('clear').disabled=busy||!hasEdits();$('stage').disabled=!selected||busy||tab==='gears'&&selected.effects.length===0;
 for(const el of document.querySelectorAll('#fields input,#fields select,#statsFields input,#friendFields input,#friendPicker,#pointsFields input'))el.disabled=busy;
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
 $('pointsPanel').hidden=tab!=='points';$('pointsTab').classList.toggle('active',tab==='points');
 $('itemsTab').classList.toggle('active',tab==='items');$('gearsTab').classList.toggle('active',tab==='gears');
 $('statsTab').classList.toggle('active',tab==='stats');$('statsPanel').hidden=tab!=='stats';$('friendsPanel').hidden=tab!=='friends';$('friendsTab').classList.toggle('active',tab==='friends');$('inventoryGrid').hidden=tab==='stats'||tab==='friends'||tab==='points';
 if(tab==='points'){renderPoints();return;}if(tab==='stats'){renderStats();return;}if(tab==='friends'){renderFriends();return;}
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
  const p=document.createElement('p');p.textContent='게임 소스에서 추출한 옵션입니다. 기존 '+x.effects.length+'개 슬롯을 유지합니다.';$('fields').append(p);
  const scopeLabel=document.createElement('label');scopeLabel.textContent='옵션 목록 범위';
  const scope=document.createElement('select');scope.id='optionScope';
  scope.append(option('recommended','이 장비 기본 옵션 ('+x.recommended.length+'종)'),option('affixes','모든 장비 옵션 (49종)'),option('all','전체 기술 정의 (370종 · 실험적)'));
  scope.value=optionScope;scope.onchange=()=>{optionScope=scope.value;buildEffects();};$('fields').append(scopeLabel,scope);
  const search=document.createElement('input');search.type='search';search.placeholder='옵션 이름 검색';search.id='optionSearch';$('fields').append(search);
  const box=document.createElement('div');box.id='effectFields';$('fields').append(box);
  let selectedIds=[...(optionDrafts.get(x.path)||options.get(x.path)||x.effects.map(e=>e.id))];
  function buildEffects(){
   box.replaceChildren();
   const allowed=optionScope==='recommended'?x.recommended:optionScope==='affixes'?GameCatalog.affixes:Object.keys(GameCatalog.skills);
   const query=search.value.trim().toLowerCase();
   x.effects.forEach((fx,i)=>{
    const current=x.choices.find(c=>c.id===selectedIds[i])||fx;
    const label=document.createElement('label');label.textContent='옵션 '+(i+1)+' · 원래 '+Equipment.effectLabel(fx);
    const kind=document.createElement('select');kind.id='effect'+i;kind.className='effectKind';
    const candidates=[...new Set([current.key,...allowed.filter(k=>(k+' '+GameCatalog.skills[k]?.label).toLowerCase().includes(query))])];
    for(const key of candidates)kind.append(option(key,(x.recommended.includes(key)?'★ ':'')+(GameCatalog.skills[key]?.label||key)+' ['+key+']'));
    kind.value=current.key;
    const level=document.createElement('select');level.className='effect';level.id='effectLevel'+i;
    const description=document.createElement('p');description.className='muted';
    function levels(){
     level.replaceChildren();const choices=x.choices.filter(c=>c.key===kind.value);
     for(const c of choices)level.append(option(c.id,'등급 '+c.levels.join('/')+(c.levels.join('/')===x.level?' · 장비 등급':'')));
     const prior=x.choices.find(c=>c.id===selectedIds[i]);
     level.value=choices.find(c=>c.levels.join('/')===prior?.levels.join('/'))?.id||choices.find(c=>c.levels.join('/')===x.level)?.id||choices[0].id;
     selectedIds[i]=level.value;
     const s=GameCatalog.skills[kind.value];description.textContent=(s?.description||s?.functionDescription||'게임 설명 없음').replace(/\[\/?color[^\]]*\]/g,'')+' · N/K는 게임 계산값입니다.';
    }
    kind.onchange=levels;level.onchange=()=>{selectedIds[i]=level.value;};levels();box.append(label,kind,level,description);
   });
  }
  search.oninput=buildEffects;buildEffects();
  const note=document.createElement('p');note.className='muted';note.textContent='★는 이 장비의 기본 옵션입니다. 다른 장비 옵션·전체 기술은 자연 생성 범위 밖이며, 효과가 없거나 조합에 따라 다를 수 있습니다. 등급 0~7은 설치 게임의 장비 등급 범위입니다.';$('fields').append(note);
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
for(const [id,value] of [['pointsTab','points'],['statsTab','stats'],['friendsTab','friends'],['itemsTab','items'],['gearsTab','gears']])$(id).onclick=()=>{if(busy)return;tab=value;clearDetail();render();};
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
   const ids=[...document.querySelectorAll('.effect')].map(s=>s.value);optionDrafts.set(selected.path,ids);Equipment.validateChoice(selected,ids);
   if(JSON.stringify(ids)===JSON.stringify(selected.effects.map(x=>x.id)))options.delete(selected.path);else options.set(selected.path,ids);
  }
  invalidDrafts.delete('entry:'+selected.path);revision++;pending();render();msg(window.nativeRequest?'변경이 자동 반영됐습니다. 세이브 저장을 누르면 자동 백업 후 적용합니다.':'변경 목록에 추가했습니다. 다운로드 전까지 파일은 변경되지 않습니다.');
 }catch(e){invalidDrafts.set('entry:'+selected.path,e.message);pending();msg(e.message,true);}
};
$('clear').onclick=()=>{if(!busy&&confirm('대기 변경을 모두 취소할까요?')){counts.clear();options.clear();statValues=null;resetDrafts();statDraft=null;invalidDrafts.delete('stats');revision++;pending();render();if(selected)choose(selected);}};
$('backup').onclick=()=>{if(doc&&!busy)dl(doc.bytes,filename()+'.ORIGINAL-BACKUP.es3');};
$('export').onclick=async()=>{
 if(!doc||busy||pendingSize()===0||invalidDrafts.size)return;
 busy=true;sync();const gen=generation,rev=revision,source=doc,f=file,oldCounts=new Map(counts),oldOptions=new Map([...options].map(([k,v])=>[k,[...v]])),name=filename();
 try{
  const current=new Uint8Array(await f.arrayBuffer());
  if(gen!==generation||rev!==revision)throw Error('파일 또는 변경 목록이 바뀌어 내보내기를 취소했습니다.');
  if(current.length!==source.bytes.length||current.some((b,i)=>b!==source.bytes[i]))throw Error('원본 파일이 외부에서 변경되었습니다. 다시 여세요.');
  let out=Equipment.apply(source,oldCounts,oldOptions);
  if(statValues||[...oldOptions.keys()].some(p=>p.startsWith(PlayerStats.root+'/PlayerDressEquip/'))){const staged=SaveCore.parse(out);out=PlayerStats.apply(staged,statValues||PlayerStats.fields(staged));}
  out=FriendStats.apply(SaveCore.parse(out),friendPending,friendGearPaths(oldOptions));
  if(pointValues)out=PlayerPoints.apply(SaveCore.parse(out),pointValues);
  const preview=[...oldCounts].map(([p,v])=>describe('items',model.itemByPath.get(p),v)).concat([...oldOptions].map(([p,v])=>describe('gears',model.gearByPath.get(p),v))).join('\n\n');
  if(window.nativeRequest){
   if(!nativeSession)throw Error('위쪽 세이브 열기 버튼으로 실제 파일을 다시 여세요.');
   msg('원본 자동 백업 및 세이브 저장 중…');
   const result=await window.nativeRequest({kind:'save',session:nativeSession,data:toBase64(out)});
   doc=SaveCore.parse(out);model=Equipment.inspect(doc);file=new File([out],f.name);file.nativeSession=result.session;nativeSession=result.session;
   counts.clear();options.clear();statValues=null;resetDrafts();statDraft=null;invalidDrafts.delete('stats');revision++;pending();render();clearDetail();
   $('totals').textContent=result.path+' · 저장 완료';
   msg('세이브 저장 완료. 게임에서 이 슬롯을 불러오세요. 자동 백업: '+result.backup);
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
 $('saveHelp').textContent='열었던 세이브를 자동 백업한 뒤 같은 슬롯 파일에 저장합니다. 게임을 종료한 상태에서 편집하세요.';
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
 const picker=$('friendPicker');picker.replaceChildren();$('friendFields').replaceChildren();$('friendInfo').textContent='';$('friendPreview').textContent='';if(!doc)return;
 const all=FriendStats.inspect(doc);if(!all.some(x=>x.path===friendSelected))friendSelected=all[0]?.path||null;
 for(const x of all)picker.append(option(x.path,x.name+' · '+x.group+' ['+x.id+']'));
 picker.value=friendSelected||'';if(!friendSelected){$('friendInfo').textContent='이 세이브에는 합류·이탈 동료가 없습니다.';return;}
 try{const p=FriendStats.data(doc,friendSelected),values=friendDrafts.get(friendSelected)||friendPending.get(friendSelected)||FriendStats.fields(doc,friendSelected);
 $('friendInfo').textContent='레벨 '+p._Lv+' · 포인트 직접 설정은 배운 특성을 유지합니다. 기본 능력치 수정으로 포인트가 차감되지 않습니다.';
 for(const [k,label] of FriendStats.definitions){const box=document.createElement('label'),input=document.createElement('input');box.textContent=label;input.id='friend'+k;input.type='number';input.min='0';input.max='1000000';input.step='1';input.value=values[k];input.disabled=busy;box.append(input);$('friendFields').append(box);}friendPreview();
 }catch(e){$('friendPreview').textContent=e.message;}
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
}
function discardDraft(key){if(busy)return;if(key==='points'){pointValues=null;pointDraft=null;}else if(key==='stats'){statValues=null;statDraft=null;}else if(key.startsWith('friend:')){const path=key.slice(7);friendPending.delete(path);friendDrafts.delete(path);}else{const path=key.slice(6);counts.delete(path);options.delete(path);countDrafts.delete(path);optionDrafts.delete(path);}invalidDrafts.delete(key);revision++;pending();render();if(selected&&tab!=='stats'&&tab!=='friends')choose(selected);}
function invalidChanges(){for(const [key,error] of invalidDrafts){const li=document.createElement('li'),button=document.createElement('button');li.className='error';li.textContent='저장 전 확인: '+error;button.textContent='이 입력 취소';button.onclick=()=>discardDraft(key);li.append(button);$('changes').append(li);}}
document.addEventListener('input',e=>{
 if(busy||!doc)return;
 if(e.target.closest('#pointsFields'))queuePoints();
 else if(e.target.closest('#statsFields'))queueStats();
 else if(e.target.closest('#friendFields'))queueFriend();
 else if(e.target.id==='quantity')$('stage').onclick();
});
document.addEventListener('change',e=>{if(busy||!doc)return;if(e.target.id==='quantityPreset'&&e.target.value!=='custom'||e.target.matches('.effect,.effectKind'))$('stage').onclick();});

function renderPoints(){
 $('pointsFields').replaceChildren();$('pointsPreview').textContent='';if(!doc)return;
 try{const values=pointDraft||pointValues||PlayerPoints.fields(doc);
  for(const [key,label,min,max] of PlayerPoints.definitions){const box=document.createElement('label');box.textContent=label;const input=document.createElement('input');input.type='number';input.step='1';input.min=String(min);input.max=String(max);input.id='point'+key;input.value=values[key];input.disabled=busy;box.append(input);$('pointsFields').append(box);}previewPoints();
 }catch(e){$('pointsPreview').className='status error';$('pointsPreview').textContent=e.message;}
}
function pointInputs(){return Object.fromEntries(PlayerPoints.definitions.map(([k])=>[k,$('point'+k).value]));}
function previewPoints(){try{const r=PlayerPoints.calculate(doc,pointInputs());$('pointsPreview').className='status';$('pointsPreview').textContent='특성 누적 추가분 '+r.values.TalentAdd+' / 생활 포인트 '+r.values.LifePoints+' / 의술 레벨 '+r.values.MedicineLevel;}catch(e){$('pointsPreview').className='status error';$('pointsPreview').textContent=e.message;}}
function queuePoints(){if(busy||!doc)return;pointDraft=pointInputs();try{const r=PlayerPoints.calculate(doc,pointDraft);pointValues=r.changes.size?{...pointDraft}:null;invalidDrafts.delete('points');revision++;pending();previewPoints();msg('포인트 변경이 자동 반영됐습니다. 세이브 저장을 누르면 적용됩니다.');}catch(e){invalidDrafts.set('points',e.message);pending();previewPoints();msg(e.message,true);}}
function pointChanges(){if(!pointValues)return;const li=document.createElement('li'),button=document.createElement('button');li.textContent='주인공 포인트 · '+PlayerPoints.definitions.map(([k,label])=>label+' '+pointValues[k]).join(' / ');button.textContent='취소';button.onclick=()=>discardDraft('points');li.append(button);$('changes').append(li);}

function renderCategoryFilters(state){
 const source=model?(tab==='items'?model.items:model.gears):[],groups=Categories.groups(source,tab),subs=Categories.subgroups(source,tab,state.category);
 $('categoryFilter').replaceChildren(option('all','전체 ('+source.length+')'));for(const g of groups)$('categoryFilter').append(option(g.id,g.label+' ('+g.count+')'));$('categoryFilter').value=state.category;
 $('subcategoryLabel').hidden=tab!=='items';$('subcategoryFilter').replaceChildren(option('all','전체'));for(const g of subs)$('subcategoryFilter').append(option(g.id,g.label+' ('+g.count+')'));$('subcategoryFilter').value=state.subcategory;
}
