'use strict';
// Installed IL2CPP build: GetHp 13e18f0, UpDataHp 13e7ac0, GetEquipSkills 13c15d0.
const PlayerStats=(()=>{
 const root='/savePlayerData/value',f=Math.fround;
 const definitions=[['Lv','레벨',1000],['Power','역도',100000],['Perception','감지',100000],['Agility','영교',100000],['PhysicalPower','체백',100000],['Channel','경맥',100000],['BerathSkill','속도',100000],['WuXing','오성',100000]];
 const six=definitions.slice(1,7).map(x=>x[0]);
 const flat=['属性增加-力道','属性增加-感知','属性增加-灵巧','属性增加-体魄','属性增加-经脉','属性增加-速度'];
 function object(n){if(n?.kind!=='object')throw Error('능력치 계산에 필요한 저장 구조가 없습니다.');return n;}
 function read(n){
  if(!n)throw Error('연계 계산에 필요한 필드가 없습니다.');
  if(n.kind==='object')return Object.fromEntries(n.children.map(x=>[x.path.at(-1),read(x)]));
  if(n.kind==='array')return n.children.map(read);
  if(n.kind==='number'){const v=Number(n.raw);if(!Number.isFinite(v))throw Error('유효하지 않은 저장 숫자');return v;}
  if(n.kind==='null')return null;return n.text;
 }
 function num(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw Error(label+' 값이 올바르지 않습니다.');return f(v);}
 function dict(v,label){if(!v||Array.isArray(v)||typeof v!=='object')throw Error(label+' 구조를 확인할 수 없습니다.');return v;}
 function arr(v,label){if(!Array.isArray(v))throw Error(label+' 목록을 확인할 수 없습니다.');return v;}
 function fields(doc){
  object(doc.byPath.get(root));
  return Object.fromEntries(definitions.map(([key,label])=>{const n=doc.byPath.get(root+'/'+key);if(n?.kind!=='number')throw Error(label+' 필드가 없습니다.');return [key,n.raw];}));
 }
 function validate(values){
  if(!values||typeof values!=='object'||Object.keys(values).some(k=>!definitions.some(x=>x[0]===k)))throw Error('지원하지 않는 능력치');
  const out={};for(const [key,label,max] of definitions){const s=String(values[key]);if(!/^[1-9]\d*$/.test(s)||Number(s)>max)throw Error(label+'은 1~'+max.toLocaleString()+' 정수로 입력하세요 (편집기 제한).');out[key]=Number(s);}return out;
 }
 function aggregate(p,initial=[]){
  const result=Object.create(null),sources=[];
  function add(key,v,source,target=result){v=num(v,key);target[key]=f((target[key]||0)+v);if(source&&v&&(key===flat[3]||key==='属性膨胀'||['提供气血','提供气血2','传奇铁匠','传奇织锦师'].includes(key)))sources.push({source,key,value:v});}
  function fixed(type,name,scale=1,target=result){
   const entry=StatCatalog[type]?.[name];if(!entry)throw Error('자동 계산에 없는 게임 정의: '+name);
   for(const [k,values] of Object.entries(entry.skills))add(k,f((values[0]||0)*scale),entry.label+' ['+name+']',target);
  }
  for(const [key,value,label] of initial)add(key,value,label);
  // The installed InKangFu/UniqueSkill calculate functions return the base value, independent of level.
  if(p.DressInKangFu!==null){dict(p.DressInKangFu,'장착 내공');fixed('InKangFuDataSet',p.DressInKangFu._Name);}
  for(const group of ['DressBigLoop','DressSmallLoop'])for(const x of Object.values(dict(p[group],group)))fixed('UniqueSkillDataSet',x._Name);
  for(const x of Object.values(dict(p.PlayerDressEquip,'장착 장비'))){
   if(x===null)continue;
   const gear=Object.create(null);fixed('EquipDataSet',x._Name,1,gear);
   for(const [key,levels] of Object.entries(dict(x._SkillLv,'장비 옵션'))){
    const skill=GameCatalog.skills[key];if(!skill)throw Error('알 수 없는 장비 옵션: '+key);
    for(const lv of arr(levels,'옵션 등급')){if(!Number.isInteger(lv)||lv<0||lv>100)throw Error('장비 등급 범위 오류');add(key,f(skill.base+f(lv*skill.step)),x._Name+' 옵션',gear);}
   }
   if(arr(x._QiItemNames,'장비 부착물').length)throw Error('부착물이 있는 장비의 기혈 보정은 아직 지원하지 않습니다. 능력치 저장을 중단했습니다.');
   for(const [key,v] of Object.entries(gear))add(key,v,null);
  }
  for(const x of Object.values(dict(p.CharacterHad,'특성'))){if(!Number.isInteger(x.Num)||x.Num<0||x.Num>10000)throw Error('특성 횟수 오류');fixed('CharacterDataSet',x._Name,x.Num);}
  const life=Object.create(null);for(const list of Object.values(dict(p.LifeTypeHadPerk,'생활 특성')))for(const x of arr(list,'생활 특성'))fixed('LifePerkDataSet',x._Name,1,life);
  for(const [key,v] of Object.entries(life))add(key,v,null);
  for(const group of ['FoodItem','FoodItemExtra'])if(Object.keys(dict(p[group],group)).length)throw Error('음식 효과가 남아 있는 세이브의 자동 기혈 계산은 아직 지원하지 않습니다. 게임에서 효과가 끝난 뒤 저장하고 다시 여세요.');
  if(Object.hasOwn(dict(p.SkillTimeHad,'시간 효과'),'开悟'))add('属性增加-悟性',2,'개오');
  return {result,sources};
 }
 function calculate(doc,values){
  SaveCore.requireGame(doc);const p=read(object(doc.byPath.get(root))),v=validate(values),{result:s,sources}=aggregate(p);
  const multiplier=Object.hasOwn(s,'属性膨胀')?s['属性膨胀']:1;
  const effective=six.map((k,i)=>Math.trunc(f(f(v[k]*(i===5?1:multiplier))+(s[flat[i]]||0))));
  if(effective.some(n=>!Number.isFinite(n)||n<0||n>2147483647))throw Error('장비·특성 보정 후 능력치가 계산 범위를 벗어납니다.');
  const base=f(f(200+f((v.Lv-1)*30))*f(1+f(effective[3]*f(.02))));
  let total=f(base+(s['提供气血']||0));
  for(const [key,life] of [['传奇铁匠','0'],['传奇织锦师','2']])if((s[key]||0)>0)total=f(total+f(arr(p.LifeTypeHadPerk[life],'전설 생활 특성').length*s[key]));
  const max=f(total*f(1+(s['提供气血2']||0))),oldMax=num(p._MaxHp,'최대 기혈'),oldHp=num(p._Hp,'현재 기혈');
  if(max<1||max>1e9||oldMax<1||oldHp<0||oldHp>oldMax)throw Error('현재 또는 계산된 기혈 값이 지원 범위를 벗어납니다.');
  // UpDataHp preserves missing HP (absolute damage), with a minimum of one.
  let hp=max>=oldMax?f(oldHp+f(max-oldMax)):f(oldHp-f(oldMax-max));if(hp<=0)hp=1;
  const changes=new Map();
  for(const [k] of definitions)changes.set(root+'/'+k,String(v[k]));
  // SaveProLifePoints (13d4340) snapshots raw fields into SixProCurrent; ResetPointLast restores them.
  six.forEach((k,i)=>changes.set(root+'/SixProCurrent/'+(i+1),String(v[k])));
  for(const [key,val] of [['_BaseHp',base],['_MaxHp',max],['_Hp',hp]]){
   const n=doc.byPath.get(root+'/'+key);if(n?.kind!=='number')throw Error('기혈 필드가 없습니다.');
   // Preserve original spelling when it represents the same IEEE single precision value.
   changes.set(n.ptr,f(Number(n.raw))===val?n.raw:String(val));
  }
  for(const [path,value] of changes){const n=doc.byPath.get(path);if(n?.kind!=='number')throw Error('기존 능력치 필드가 없습니다: '+path);if(n.raw===value)changes.delete(path);}
  return {values:v,effective,base,max,hp,oldMax,oldHp,sources,changes};
 }
 function apply(doc,values){const plan=calculate(doc,values);return SaveCore.patch(doc,plan.changes,new Set(['_BaseHp','_MaxHp','_Hp'].map(k=>root+'/'+k)));}
 return {definitions,fields,validate,aggregate,calculate,apply,root,read};
})();
if(typeof module!=='undefined')module.exports=PlayerStats;
