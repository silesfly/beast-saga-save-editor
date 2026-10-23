'use strict';
const FriendStats=(()=>{
 const base='/saveFriendData/value',f=Math.fround;
 const six=PlayerStats.definitions.slice(1,7).map(([k,label])=>[k,label]);
 const definitions=[...six,['WuXing','오성'],['remainingPro','남은 능력치 포인트'],['remainingTalent','남은 특성 포인트']];
 function inspect(doc){
  const all=[];for(const group of ['AddFriends','LeaveFriends']){const n=doc.byPath.get(base+'/'+group);if(!n)continue;if(n.kind!=='object')throw Error('동료 목록 형식이 올바르지 않습니다.');
   for(const x of n.children){if(x.kind!=='object')continue;const name=x.children.find(c=>c.path.at(-1)==='_Name');all.push({path:x.ptr,id:x.path.at(-1),name:name?.kind==='string'?name.text:x.path.at(-1),group:group==='AddFriends'?'합류':'이탈'});}
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
 return {definitions,inspect,data,fields,validate,hp,calculate,apply};
})();
if(typeof module!=='undefined')module.exports=FriendStats;
