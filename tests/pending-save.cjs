'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=path.resolve(__dirname,'..');
async function preservePending(cancelled){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{id,value:'',checked:false,disabled:false,dataset:{},children:[],classList:{toggle(){}},replaceChildren(...x){this.children=x},append(...x){this.children.push(...x)},querySelectorAll(){return []}});return elements.get(id)};
 const document={getElementById:element,querySelectorAll(){return []},createElement(){return element('generated'+elements.size)},addEventListener(){}};
 const ctx=vm.createContext({document,window:{addEventListener(){}},TextEncoder,TextDecoder,Uint8Array,Map,Set,File,Blob,btoa,atob,console,URL,setTimeout,confirm:()=>true});
 for(const name of ['item-core','catalog','add-catalog','additions','equipment','categories','inventory-list','stat-catalog','stats','friends','points','equipment-ui','add-ui'])vm.runInContext(fs.readFileSync(path.join(repo,'src',name+'.js'),'utf8'),ctx);
 vm.runInContext(`
  pending=()=>{};render=()=>{};clearDetail=()=>{};previewAdd=()=>{};renderAddQueue=()=>{};
  doc=SaveCore.parse(new TextEncoder().encode(JSON.stringify({savePlayerData:{__type:'PlayerData, Assembly-CSharp',value:{ItemHad:{}}},saveInfoData:{value:{}},saveTime:{value:{yearTime:1,monthTime:2,dayTime:3,minutes:4,seconds:5,MS:1,IsOpen:false}}})));
  model=Equipment.inspect(doc);file=new File([doc.bytes],'fixture.es3');nativeSession='session';catalogVerified=true;$('addTrial').checked=true;newAdds.set('3妆花缎','2');
  window.nativeRequest=payload=>{globalThis.captured=payload;return new Promise((resolve,reject)=>{globalThis.ack=resolve;globalThis.fail=reject})};
  globalThis.saving=$('export').onclick();
 `,ctx);
 for(let i=0;i<20&&!ctx.captured;i++)await new Promise(resolve=>setImmediate(resolve));
 assert(ctx.captured,'save reached pending native response');
 assert.equal(vm.runInContext('busy && newAdds.size===1 && $("addTrial").disabled && captured.kind==="save-copy"',ctx),true);
 vm.runInContext('$("addTrial").checked=false;$("addTrial").onchange();',ctx);
 vm.runInContext(cancelled?'ack({cancelled:true})':'fail(Error("synthetic save failure"))',ctx);
 await ctx.saving;
 assert.equal(vm.runInContext('!busy && newAdds.get("3妆花缎")==="2" && $("addTrial").checked && !$("addTrial").disabled',ctx),true);
 assert.match(vm.runInContext('$("status").textContent',ctx),cancelled?/변경 계획은 유지/:/synthetic save failure/);
 console.log('PASS pending additions survive '+(cancelled?'cancel':'failure'));
}
function testUiFeatures(){
 const html=fs.readFileSync(path.join(repo,'src/equipment-page.html'),'utf8');
 const modeMatch=html.match(/<div id="modeNotice" class="notice">([^<]+)<\/div>/);
 assert.ok(modeMatch,'equipment-page.html must contain #modeNotice');
 const initialModeNotice=modeMatch[1];
 assert.ok(initialModeNotice.includes('브라우저판은 원본을 덮어쓰지 않고 수정본을 다운로드합니다'));
 const elements=new Map(),docListeners={},winListeners={};
 const makeEl=(id='')=>{
  const el={
   value:'',checked:false,disabled:false,hidden:false,open:false,textContent:'',className:'',tagName:'',isContentEditable:false,dataset:{},children:[],parentElement:null,
   classList:{toggle(){},add(){},remove(){}},
   replaceChildren(...x){this.children=x;},
   append(...x){this.children.push(...x);},prepend(...x){this.children.unshift(...x);},
   before(){},
   querySelectorAll(){return [];},
   focus(){this.focused=true;document.activeElement=this;},
   select(){this.selected=true;},
   click(){if(!this.disabled&&typeof this.onclick==='function')this.onclick();},
   setAttribute(k,v){this[k]=v;}
  };
  Object.defineProperty(el,'id',{get(){return this._id||'';},set(v){this._id=String(v||'');if(this._id)elements.set(this._id,this);},enumerable:true});
  if(id)el.id=id;
  return el;
 };
 const element=id=>{if(!elements.has(id))elements.set(id,makeEl(id));return elements.get(id);};
 const document={
  activeElement:{tagName:'BODY'},
  getElementById:element,
  querySelectorAll(){return [];},
  createElement(tag){const el=element('generated'+elements.size);el.tagName=String(tag||'').toUpperCase();return el;},
  addEventListener(type,fn){(docListeners[type]||(docListeners[type]=[])).push(fn);}
 };
 const windowObj={addEventListener(type,fn){(winListeners[type]||(winListeners[type]=[])).push(fn);}};
 element('modeNotice').textContent=initialModeNotice;
 element('file').parentElement={hidden:false,before(){}};
 element('codeAtlasCategory').value='all';
 const ctx=vm.createContext({document,window:windowObj,TextEncoder,TextDecoder,Uint8Array,Map,Set,File,Blob,btoa,atob,console,URL,setTimeout,confirm:()=>true});
 for(const name of ['item-core','catalog','add-catalog','additions','equipment','categories','inventory-list','stat-catalog','stats','friends','points','equipment-ui','add-ui'])vm.runInContext(fs.readFileSync(path.join(repo,'src',name+'.js'),'utf8'),ctx);
 assert.equal(vm.runInContext('EDITOR_CODE_ATLAS.length',ctx),38);
 const zhanghua=vm.runInContext('EDITOR_CODE_ATLAS.find(r=>r[0]==="mat-zhanghua")',ctx);
 assert.ok(zhanghua&&zhanghua.join(' ').includes('3妆花缎')&&zhanghua.join(' ').includes('직금'));
 assert.ok(!zhanghua.join(' ').includes('재저장 보존'));
 assert.equal(element('codeAtlasStatus').textContent,'전체 38개 항목 표시 중');
 assert.equal(element('editorCodeAtlasBody').children[0].children.length,39);
 element('codeAtlasSearch').value='황우곡 오두';
 element('codeAtlasSearch').oninput();
 assert.equal(element('editorCodeAtlasBody').children[0].children.length,3);
 assert.equal(element('codeAtlasStatus').textContent,'조건 일치 2개 / 전체 38개 항목 표시 중');
 element('codeAtlasReset').onclick();
 assert.equal(element('codeAtlasSearch').value,'');
 assert.equal(element('codeAtlasCategory').value,'all');
 assert.equal(element('editorCodeAtlasBody').children[0].children.length,39);
 assert.equal(element('codeAtlasStatus').textContent,'전체 38개 항목 표시 중');
 assert.ok((winListeners.keydown||[]).length>0);
 document.activeElement={tagName:'BODY'};
 vm.runInContext("tab='stats'",ctx);
 element('editorCodeAtlasBox').open=false;element('codeAtlasSearch').focused=false;element('codeAtlasSearch').selected=false;
 winListeners.keydown[0]({key:'/',preventDefault(){}});
 assert.equal(element('codeAtlasSearch').focused&&element('codeAtlasSearch').selected&&element('editorCodeAtlasBox').open,true);
 vm.runInContext("tab='items'",ctx);
 document.activeElement={tagName:'BODY'};
 element('search').focused=false;element('search').selected=false;
 winListeners.keydown[0]({key:'/',preventDefault(){}});
 assert.equal(element('search').focused,false);
 element('search').disabled=false;
 winListeners.keydown[0]({key:'/',preventDefault(){}});
 assert.equal(element('search').focused&&element('search').selected,true);
 document.activeElement={tagName:'INPUT'};
 element('search').focused=false;
 winListeners.keydown[0]({key:'/',preventDefault(){}});
 assert.equal(element('search').focused,false);
 const presetEvent={target:{closest:s=>s==='[data-editor-preset]'?{getAttribute:n=>n==='data-editor-preset'?'starter-comfort':null}:null}};
 docListeners.click[0](presetEvent);
 assert.equal(element('editorPresetStatus').textContent,'먼저 상단 [세이브 .es3 열기]로 세이브 파일을 연 뒤 프리셋을 눌러주세요.');
 assert.equal(element('modeNotice').textContent,initialModeNotice);
 ctx.chrome=windowObj.chrome={webview:{postMessage(){},addEventListener(){}}};
 vm.runInContext('installNative()',ctx);
 assert.ok(element('modeNotice').textContent.includes('같은 파일에 저장합니다'));
 docListeners.click[0](presetEvent);
 assert.equal(element('editorPresetStatus').textContent,'먼저 상단 [게임 세이브 열기]로 세이브 파일을 연 뒤 프리셋을 눌러주세요.');
 vm.runInContext(`
  const fixture={
   savePlayerData:{__type:'PlayerData, Assembly-CSharp',value:{Lv:10,Power:20,Perception:20,Agility:20,PhysicalPower:20,Channel:20,BerathSkill:20,WuXing:15,SixProCurrent:{1:20,2:20,3:20,4:20,5:20,6:20},_BaseHp:658,_MaxHp:658,_Hp:658,DressInKangFu:null,DressBigLoop:{},DressSmallLoop:{},PlayerDressEquip:{},CharacterHad:{},LifeTypeHadPerk:{0:[],2:[]},FoodItem:{},FoodItemExtra:{},SkillTimeHad:{},ItemHad:{'铜钱':{_Name:'铜钱',_Count:100},'3妆花缎':{_Name:'3妆花缎',_Count:5}},EquipHad:{'5凌霜':[{_Name:'5凌霜',_Lv:5,_SkillLv:{},_QiItemNames:[]}],'5光棍':[{_Name:'5光棍',_Lv:5,_SkillLv:{},_QiItemNames:[]}],'5百花杀':[{_Name:'5百花杀',_Lv:5,_SkillLv:{},_QiItemNames:[]}]},TalentAdd:5,AddProSpot:10,UseLifePeak:0,LifeExp:{0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0},FriendLoveNum:{'鹿柒':10,'兔千千':25}}},
   saveFriendData:{value:{AddFriends:{},LeaveFriends:{}}},
   saveInfoData:{value:{}}
  };
  doc=SaveCore.parse(new TextEncoder().encode(JSON.stringify(fixture)));
  model=Equipment.inspect(doc);
  file=new File([doc.bytes],'synthetic.es3');
  nativeSession='session';
  catalogVerified=true;
  busy=false;
  render();
  sync();
 `,ctx);
 const clickPreset=k=>docListeners.click[0]({target:{closest:s=>s==='[data-editor-preset]'?{getAttribute:n=>n==='data-editor-preset'?k:null}:null}});
 const clickQSearch=v=>docListeners.click[0]({target:{closest:s=>s==='[data-editor-qsearch]'?{getAttribute:n=>n==='data-editor-qsearch'?v:null}:null}});
 vm.runInContext("$('pointsTab').click();$('pointTalentAdd').value='100';$('pointAddProSpot').value='200';queuePoints();",ctx);
 clickPreset('life-medicine');
 assert.equal(vm.runInContext('pointValues.TalentAdd',ctx),'115');
 assert.equal(vm.runInContext('pointValues.AddProSpot',ctx),'200');
 assert.equal(vm.runInContext('pointValues.MedicineLevel',ctx),'45');
 assert.equal(vm.runInContext('pointValues.LifePoints',ctx),'20');
 clickPreset('life-medicine');
 assert.equal(vm.runInContext('pointValues.TalentAdd',ctx),'130');
 clickPreset('life-all-master');
 assert.equal(vm.runInContext('pointValues.TalentAdd',ctx),'130');
 assert.equal(vm.runInContext('pointValues.AddProSpot',ctx),'200');
 assert.equal(vm.runInContext('pointValues.LifePoints',ctx),'50');
 assert.equal(vm.runInContext('pointValues.ForgeLevel',ctx),'60');
 assert.equal(vm.runInContext('pointValues.LockpickLevel',ctx),'60');
 vm.runInContext("$('pointTalentAdd').value='999990';queuePoints();",ctx);
 clickPreset('life-medicine');
 assert.equal(vm.runInContext("invalidDrafts.has('points')",ctx),true);
 assert.equal(element('editorPresetStatus').className,'status error');
 assert.ok(!element('editorPresetStatus').textContent.includes('프리셋 적용 완료'));
 clickPreset('life-all-master');
 assert.equal(vm.runInContext("invalidDrafts.has('points')",ctx),false);
 assert.equal(vm.runInContext('pointValues.TalentAdd',ctx),'999990');
 assert.equal(element('editorPresetStatus').className,'status');
 vm.runInContext("$('friendsTab').click();$('friendLove_luxi').value='100';queueFriendLove();",ctx);
 clickPreset('friend-love-60');
 assert.equal(vm.runInContext('friendLoveValues.luxi',ctx),'100');
 assert.equal(vm.runInContext('friendLoveValues.tuqianqian',ctx),'60');
 vm.runInContext("listStates.items.category='99';listStates.items.subcategory='sub';listStates.gears.category='99';listStates.gears.scope='friend';$('catalogState').value='blocked';",ctx);
 clickQSearch('items:장화단');
 assert.equal(vm.runInContext('listStates.items.category',ctx),'all');
 assert.equal(vm.runInContext('listStates.items.subcategory',ctx),'all');
 assert.equal(vm.runInContext('listResult.total',ctx),1);
 clickQSearch('gears:5凌霜');
 assert.equal(vm.runInContext('listStates.gears.category',ctx),'all');
 assert.equal(vm.runInContext('listStates.gears.scope',ctx),'all');
 assert.equal(vm.runInContext('listResult.total',ctx),1);
 clickQSearch('gears:5光棍');
 assert.equal(vm.runInContext('listResult.total',ctx),1);
 clickQSearch('gears:百花杀');
 assert.equal(vm.runInContext('listResult.total',ctx),1);
 clickQSearch('add:장화단');
 assert.equal(element('catalogState').value,'all');
 assert.ok(element('catalogTree').children.length>=1);
 const qChips=[...html.matchAll(/data-editor-qsearch="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(qChips.length,10);
 for (const qChip of qChips) {
   ctx.qChip=qChip;
   const type=qChip.slice(0,qChip.indexOf(':'));
   ctx.kw=qChip.slice(qChip.indexOf(':')+1).toLocaleLowerCase('ko');
   let matches=false;
   if(type==='items'){
     matches=vm.runInContext("Object.entries(GameCatalog.items).some(([k,v])=>(String(v||'')+' '+k).toLocaleLowerCase('ko').includes(kw))",ctx);
   }else if(type==='gears'){
     matches=vm.runInContext("Object.entries(GameCatalog.gears).some(([k,v])=>(String(v?.label||'')+' '+k).toLocaleLowerCase('ko').includes(kw))",ctx);
   }else if(type==='add'){
     matches=vm.runInContext("AddCatalog.records.some(r=>[r.id,r.label,r.original].some(s=>String(s||'').toLowerCase().includes(kw)))",ctx);
   }else{
     throw new Error('Unknown qChip type: '+qChip);
   }
   assert.equal(matches,true,qChip);
 }

  vm.runInContext(`globalThis.setSave=playerVal=>{const baseItems={'铜钱':{_Name:'铜钱',_Count:100},'3妆花缎':{_Name:'3妆花缎',_Count:5}},baseGears={'5凌霜':[{_Name:'5凌霜',_Lv:5,_SkillLv:{},_QiItemNames:[]}],'5光棍':[{_Name:'5光棍',_Lv:5,_SkillLv:{},_QiItemNames:[]}],'5百花杀':[{_Name:'5百花杀',_Lv:5,_SkillLv:{},_QiItemNames:[]}]};doc=SaveCore.parse(new TextEncoder().encode(JSON.stringify({savePlayerData:{__type:'PlayerData, Assembly-CSharp',value:{ItemHad:baseItems,EquipHad:baseGears,...playerVal}},saveFriendData:{value:{AddFriends:{},LeaveFriends:{}}},saveInfoData:{value:{}}})));model=Equipment.inspect(doc);file=new File([doc.bytes],'t.es3');counts.clear();options.clear();statValues=null;resetDrafts();render();sync();};`, ctx);

  vm.runInContext(`setSave({Lv:10,Power:20,Perception:20,Agility:20,PhysicalPower:20,Channel:20,BerathSkill:20,WuXing:15,SixProCurrent:{1:20,2:20,3:20,4:20,5:20,6:20},_BaseHp:658,_MaxHp:658,_Hp:658,DressInKangFu:null,DressBigLoop:{},DressSmallLoop:{},PlayerDressEquip:{},CharacterHad:{},LifeTypeHadPerk:{0:[],2:[]},FoodItem:{buff:1},FoodItemExtra:{},SkillTimeHad:{},TalentAdd:5,AddProSpot:10,UseLifePeak:0,LifeExp:{0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0},FriendLoveNum:{'鹿柒':10}})`, ctx);
  clickPreset('starter-comfort');
  assert.equal(vm.runInContext(`invalidDrafts.has('stats')`, ctx), true);
  assert.equal(element('editorPresetStatus').className, 'status error');
  assert.equal(element('status').className, 'status error');
  vm.runInContext(`discardDraft('stats')`, ctx);
  assert.equal(vm.runInContext(`invalidDrafts.has('stats')`, ctx), false);

  vm.runInContext(`setSave({FriendLoveNum:{'鹿柒':'bad'}})`, ctx);
  clickPreset('money-rich');
  assert.equal(vm.runInContext(`counts.get('/savePlayerData/value/ItemHad/铜钱')`, ctx), '500000');
  assert.equal(element('export').disabled, false);
  for(const p of ['starter-comfort','life-medicine','life-all-master','friend-love-60']){
    clickPreset(p);
    assert.equal(element('editorPresetStatus').className, 'status error');
    assert.equal(element('status').className, 'status error');
    assert.equal(vm.runInContext(`counts.get('/savePlayerData/value/ItemHad/铜钱')`, ctx), '500000');
  }
  assert.equal(vm.runInContext(`invalidDrafts.has('stats')&&invalidDrafts.has('points')&&invalidDrafts.has('friendLove')`, ctx), true);
  assert.equal(element('export').disabled, true);
  vm.runInContext(`discardDraft('stats');discardDraft('points');discardDraft('friendLove');`, ctx);
  assert.equal(element('export').disabled, false);

  vm.runInContext(`setSave({FriendLoveNum:'bad'})`, ctx);
  clickPreset('money-rich');
  clickPreset('friend-love-60');
  const directQueuesOk = vm.runInContext(`friendSelected='/saveFriendData/value/AddFriends/bad';queueFriend();queueStats()===false && queuePoints()===false && queueFriendLove()===false && invalidDrafts.has('friend:/saveFriendData/value/AddFriends/bad') && counts.get('/savePlayerData/value/ItemHad/铜钱')==='500000'`, ctx);
  assert.equal(directQueuesOk, true);
  vm.runInContext(`discardDraft('stats');discardDraft('points');discardDraft('friendLove');discardDraft('friend:/saveFriendData/value/AddFriends/bad');`, ctx);
  assert.equal(vm.runInContext(`invalidDrafts.size`, ctx), 0);
  assert.equal(element('export').disabled, false);
 console.log('PASS v0.11.1 UI code atlas, modeNotice, presets, and shortcuts');
}
(async()=>{await preservePending(true);await preservePending(false);testUiFeatures();})().catch(e=>{console.error(e);process.exitCode=1});