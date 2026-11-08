'use strict';
const FriendStats=(()=>{
 const base='/saveFriendData/value',loveRoot='/savePlayerData/value/FriendLoveNum',f=Math.fround;
 const six=PlayerStats.definitions.slice(1,7).map(([k,label])=>[k,label]);
 const definitions=[...six,['WuXing','오성'],['remainingPro','남은 능력치 포인트'],['remainingTalent','남은 특성 포인트']];
 const loveTable=[
  {slot:1,name:'兔千千',id:'tuqianqian',ko:'토천천',init:0,show:1,shixindan:'第五章邪线喂兔千千尸心丹',note:'황우곡 영입 · 5장 악 노선 시심단 변수 할당'},
  {slot:2,name:'狼渊',id:'langyuan',ko:'랑연',init:0,show:1,shixindan:'第五章邪线喂狼渊尸心丹',note:'백령어 영입 · 5장 악 노선 시심단 변수 할당'},
  {slot:3,name:'鼠三娘',id:'shusanniang',ko:'서삼랑',init:0,show:1,shixindan:'第五章邪线喂鼠三娘尸心丹',note:'곤륜신교 영입 · 5장 악 노선 시심단 변수 할당'},
  {slot:4,name:'狮逍',id:'shixiao',ko:'사소',init:10,show:1,shixindan:'第五章邪线喂狮逍尸心丹',note:'필보산장 영입 · 초기 호감도 10 · 시심단 변수 할당'},
  {slot:5,name:'猴千冲',id:'houqianchong',ko:'후천충',init:0,show:1,shixindan:null,note:'오자사 영입 · 시심단 변수 없음'},
  {slot:6,name:'猫春也',id:'maochunye',ko:'묘춘야',init:0,show:1,shixindan:'第五章邪线喂猫春也尸心丹',note:'파도천궁 영입 · 5장 악 노선 시심단 변수 할당'},
  {slot:7,name:'猫花来',id:'maohualai',ko:'묘화래',init:0,show:1,shixindan:'第五章邪线喂猫花来尸心丹',note:'파도천궁 영입 · 5장 악 노선 시심단 변수 할당'},
  {slot:8,name:'藏玲珑',id:'zanglinglong',ko:'장영롱',init:0,show:1,shixindan:'第五章邪线喂藏玲珑尸心丹',note:'궁공파 영입 · 5장 악 노선 시심단 변수 할당'},
  {slot:9,name:'阿守',id:'Ashou',ko:'아수',init:90,show:0,shixindan:null,note:'소촌 초기 동료 · 초기 호감도 90 고정'},
  {slot:10,name:'狼萤',id:'langying',ko:'랑형',init:30,show:0,shixindan:null,note:'황천곡 합류 · 초기 호감도 30'},
  {slot:11,name:'无常',id:'wuchang',ko:'무상',init:0,show:0,shixindan:null,note:'곤붕교 회유·구출 분기 슬롯'},
  {slot:12,name:'忘忧',id:'wangyou',ko:'망우',init:0,show:0,shixindan:null,note:'안거성 정보 거래·구판 중립/악 노선 슬롯'},
  {slot:13,name:'三里',id:'sanli',ko:'삼리',init:0,show:0,shixindan:null,note:'문파·서브 사건 연동 내부 슬롯'},
  {slot:14,name:'不周',id:'buzhou',ko:'부주',init:0,show:0,shixindan:null,note:'필보산장 협방·후반 곤붕교 회유 슬롯'},
  {slot:15,name:'枯冢',id:'kuzhong',ko:'고총',init:0,show:0,shixindan:null,note:'곤붕교·후반 사건 연동 내부 슬롯'},
  {slot:16,name:'寿',id:'shou',ko:'수',init:0,show:0,shixindan:null,note:'안거성 고분·황우곡 변호 합류 슬롯'},
  {slot:17,name:'鹿柒',id:'luxi',ko:'녹칠',init:10,show:1,shixindan:null,note:'순하장·관성탑 메인 히로인 · 초기 호감도 10'},
  {slot:18,name:'蛇形',id:'shexing',ko:'사형',init:20,show:1,shixindan:null,note:'박인도·광림성 영입 · 초기 호감도 20'},
  {slot:19,name:'狼萤2',id:'langying2',ko:'랑형 (후반)',init:30,show:0,shixindan:null,note:'후반 분기 전용 2번째 슬롯 · 초기 호감도 30'},
  {slot:20,name:'福',id:'fu',ko:'부 (복)',init:15,show:0,shixindan:null,note:'금당도 만진각 생존 분기 · 초기 호감도 15'},
  {slot:21,name:'象凌霜',id:'xianglingshuang',ko:'상릉상',init:30,show:0,shixindan:null,note:'칠요궁 합류 · 초기 호감도 30'},
  {slot:22,name:'象凌霜2',id:'xianglingshuang2',ko:'상릉상 (후반)',init:30,show:0,shixindan:null,note:'칠요궁 후반 분기 2번째 슬롯 · 초기 호감도 30'},
  {slot:23,name:'狼九思',id:'langjiusi',ko:'랑구사',init:0,show:0,shixindan:null,note:'개편판 23번째 확장 슬롯'}
 ];
 const loveById=new Map(loveTable.map(x=>[x.id,x])),loveByName=new Map(loveTable.map(x=>[x.name,x]));
 function inspectLove(doc){
  const rootNode=doc.byPath.get(loveRoot);
  if(rootNode&&rootNode.kind!=='object')throw Error('동료 호감도(FriendLoveNum) 형식이 올바르지 않습니다.');
  return loveTable.map(entry=>{
   const ptr=loveRoot+'/'+entry.name,node=doc.byPath.get(ptr);
   const present=node?.kind==='number'&&/^-?\d+$/.test(node.raw);
   return {...entry,ptr,present,value:present?node.raw:String(entry.init)};
  });
 }
 function loveFields(doc){
  const out={};for(const x of inspectLove(doc))if(x.present)out[x.id]=x.value;return out;
 }
 function calculateLove(doc,values){
  if(!values||typeof values!=='object')throw Error('지원하지 않는 동료 호감도 항목');
  const entries=inspectLove(doc),byId=new Map(entries.map(x=>[x.id,x])),byName=new Map(entries.map(x=>[x.name,x])),byPtr=new Map(entries.map(x=>[x.ptr,x]));
  const normalized={},changes=new Map(),pairs=values instanceof Map?[...values.entries()]:Object.entries(values);
  for(const [k,raw] of pairs){
   const entry=byId.get(k)||byName.get(k)||byPtr.get(k);
   if(!entry||!entry.present)throw Error('세이브에 기록된 동료 호감도 슬롯만 수정할 수 있습니다: '+k);
   const s=String(raw);
   if(!/^(0|[1-9]\d{0,3})$/.test(s)||Number(s)>1000)throw Error(entry.ko+' 호감도는 0~1,000 정수로 입력하세요.');
   const v=Number(s),node=doc.byPath.get(entry.ptr);
   normalized[entry.id]=String(v);
   if(Number(node.raw)!==v)changes.set(entry.ptr,String(v));
  }
  return {values:normalized,changes};
 }
 function applyLove(doc,values){return SaveCore.patch(doc,calculateLove(doc,values).changes);}
 function inspect(doc){
  const all=[];for(const group of ['AddFriends','LeaveFriends']){const n=doc.byPath.get(base+'/'+group);if(!n)continue;if(n.kind!=='object')throw Error('동료 목록 형식이 올바르지 않습니다.');
   for(const x of n.children){if(x.kind!=='object')continue;const name=x.children.find(c=>c.path.at(-1)==='_Name');
    const id=x.path.at(-1),nm=name?.kind==='string'?name.text:id,meta=loveById.get(id)||loveByName.get(nm)||null;
    const lovePtr=meta?loveRoot+'/'+meta.name:null,loveNode=lovePtr?doc.byPath.get(lovePtr):null,hasLove=loveNode?.kind==='number'&&/^-?\d+$/.test(loveNode.raw);
    all.push({path:x.ptr,id,name:nm,ko:meta?.ko||nm,group:group==='AddFriends'?'합류':'이탈',loveSlot:meta?.slot||null,initLove:meta?.init??null,shixindan:meta?.shixindan||null,lovePath:hasLove?lovePtr:null,love:hasLove?loveNode.raw:null});}
  }return all;
 }
 function data(doc,path){if(!inspect(doc).some(x=>x.path===path))throw Error('저장에 있는 동료만 수정할 수 있습니다.');return PlayerStats.read(doc.byPath.get(path));}
 function integer(n,label){if(!Number.isInteger(n)||n<-2147483648||n>2147483647)throw Error(label+' 저장값이 정수 범위를 벗어납니다.');return n;}
 function fields(doc,path){const p=data(doc,path),v={};for(const [k] of definitions){if(k==='remainingPro')v[k]=integer(p._AddProSpot,k)-integer(p._UseProSpot,k);else if(k==='remainingTalent')v[k]=integer(p._TalentAdd,k)-integer(p._UseTalent,k);else{const i=six.findIndex(x=>x[0]===k);v[k]=i<0?p['_'+k]:integer(p.SixProCurrent?.[i+1],k);if(typeof p['_'+k]!=='number'||!Number.isFinite(p['_'+k]))throw Error('동료 능력치 필드 없음: '+k);}}return Object.fromEntries(Object.entries(v).map(([k,n])=>[k,String(n)]));}
 function validate(values){if(!values||Object.keys(values).some(k=>!definitions.some(d=>d[0]===k)))throw Error('지원하지 않는 동료 항목');const v={};for(const [k,label] of definitions){const s=String(values[k]);if(!/^(0|[1-9]\d*)$/.test(s)||Number(s)>1000000)throw Error(label+'은 0~1,000,000 정수로 입력하세요.');v[k]=Number(s);}return v;}
 function hp(p,physical){
  if(!Number.isInteger(p._Lv)||p._Lv<1||p._Lv>10000)throw Error('동료 레벨을 확인할 수 없습니다.');
  const initial=[];if(!p.LvOpenSkill||typeof p.LvOpenSkill!=='object'||Array.isArray(p.LvOpenSkill))throw Error('동료 레벨 특성 정보가 없습니다.');
  for(const [level,x] of Object.entries(p.LvOpenSkill)){
   if(!/^\d+$/.test(level))throw Error('동료 레벨 특성 형식 오류');if(Number(level)>p._Lv||x===null)continue;
   if(!GameCatalog.skills[x._Name])throw Error('알 수 없는 동료 레벨 특성: '+x._Name);
   const keys=x._SkillVlue?.m_keys,values=x._SkillVlue?.m_values;
   if(!Array.isArray(keys)||!Array.isArray(values)||keys.length!==values.length||new Set(keys).size!==keys.length||keys.some(k=>!Number.isInteger(k))||values.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw Error('동료 레벨 특성 수치 형식 오류');
   const i=keys.indexOf(0);initial.push([x._Name,i<0?0:values[i],'레벨 '+level+' 특성']);
  }
  const normalized={DressInKangFu:p._DressInKangFu,DressBigLoop:p._DressBigLoop,DressSmallLoop:p._DressSmallLoop,PlayerDressEquip:p._PlayerDressEquip,CharacterHad:p.CharacterHad,LifeTypeHadPerk:{},FoodItem:p.FoodItem,FoodItemExtra:p.FoodItemExtra,SkillTimeHad:{}};
  const {result:s,sources}=PlayerStats.aggregate(normalized,initial),mul=Object.hasOwn(s,'属性膨胀')?s['属性膨胀']:1;
  // FriendData.UpDataHp differs from player: effective physique has a minimum of 1; no life-perk HP terms.
  const effective=Math.trunc(Math.max(1,f(f(physical*mul)+(s['属性增加-体魄']||0))));
  if(!Number.isFinite(effective)||effective>2147483647)throw Error('동료 체백 계산 범위 초과');
  const base=f(f(200+f((p._Lv-1)*30))*f(1+f(effective*f(.02))));
  const max=f(f(base+(s['提供气血']||0))*f(1+(s['提供气血2']||0))),oldMax=f(p._MaxHp),oldHp=f(p._Hp);
  if(![base,max,oldMax,oldHp].every(Number.isFinite)||max<1||max>1e9||oldMax<1||oldHp<0||oldHp>oldMax)throw Error('동료 기혈 값이 지원 범위를 벗어납니다.');
  const raw=max>=oldMax?f(oldHp+f(max-oldMax)):f(oldHp-f(oldMax-max)),current=raw<=0?1:raw;
  return {base,max,hp:current,effective,oldMax,oldHp,sources};
 }
 function calculate(doc,path,values,recalculate=false){
  const p=data(doc,path),v=validate(values),before=fields(doc,path),changes=new Map();
  // Original CompanionStats reads the snapshot; only explicitly changed stats update both copies.
  six.forEach(([k],i)=>{if(v[k]!==Number(before[k])){changes.set(path+'/_'+k,String(v[k]));changes.set(path+'/SixProCurrent/'+(i+1),String(v[k]));}});
  changes.set(path+'/_WuXing',String(v.WuXing));
  // Original editor semantics: requested remaining points + spent; learned traits are preserved.
  changes.set(path+'/_AddProSpot',String(integer(v.remainingPro+integer(p._UseProSpot,'사용 능력치'),'능력치 합계')));
  changes.set(path+'/_UseTalent',String(integer(integer(p._TalentAdd,'총 특성')-v.remainingTalent,'사용 특성')));
  let linked=null;
  if(recalculate||v.PhysicalPower!==Number(before.PhysicalPower)){
   linked=hp(p,v.PhysicalPower!==Number(before.PhysicalPower)?v.PhysicalPower:p._PhysicalPower);
   for(const [key,value] of [['_BaseHp',linked.base],['_MaxHp',linked.max],['_Hp',linked.hp]]){const n=doc.byPath.get(path+'/'+key);if(n?.kind!=='number')throw Error('동료 기혈 필드 없음');changes.set(n.ptr,f(Number(n.raw))===value?n.raw:String(value));}
  }
  for(const [key,value] of changes){const n=doc.byPath.get(key);if(n?.kind!=='number')throw Error('동료 저장 필드 없음: '+key);if(Number(n.raw)===Number(value))changes.delete(key);}
  return {values:v,changes,linked};
 }
 function apply(doc,pending,recalcPaths=new Set()){
  if(!(pending instanceof Map)||!(recalcPaths instanceof Set))throw Error('동료 변경 목록 오류');
  const changes=new Map(),floatPaths=new Set();for(const path of new Set([...pending.keys(),...recalcPaths])){
   const r=calculate(doc,path,pending.get(path)||fields(doc,path),recalcPaths.has(path));for(const [k,v] of r.changes)changes.set(k,v);
   for(const k of ['_BaseHp','_MaxHp','_Hp'])floatPaths.add(path+'/'+k);
  }return SaveCore.patch(doc,changes,floatPaths);
 }
 return {definitions,loveTable,inspect,inspectLove,loveFields,calculateLove,applyLove,data,fields,validate,hp,calculate,apply};
})();
if(typeof module!=='undefined')module.exports=FriendStats;
