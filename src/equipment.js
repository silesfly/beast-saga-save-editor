'use strict';
const Equipment = (()=>{
 const base='/savePlayerData/value';
 const enc=new TextEncoder();
 const aliases=new Map([['3妆花缎','장화단'],['5法文戒指','룬 반지']]);
 const labels=new Map([['五行增强-木','목행 무공 피해 증가'],['五行增强-金','금행 무공 피해 증가'],['五行增强-水','수행 무공 피해 증가'],['五行增强-火','화행 무공 피해 증가'],['五行增强-土','토행 무공 피해 증가'],['属性增加-速度','속도 능력치 증가'],['抗点穴增加','점혈 저항 증가'],['抗着火增加','화상 저항 증가'],['抗流血增加','출혈 저항 증가'],['闪避','회피']]);
 const field=(n,key)=>n?.children.find(x=>x.path.at(-1)===key);
 const name=n=>{const s=field(n,'_Name');return s?.kind==='string'?s.text:null;};
 const display=id=>{const label=GameCatalog.gears[id]?.label||GameCatalog.items[id]||aliases.get(id);return label?label+' · '+id:id;};
 function effects(node){
  if(node?.kind!=='object'||node.children.length>20)return null;
  const result=[];
  for(const n of node.children){
   if(n.kind!=='array'||n.children.length<1||n.children.length>8||n.children.some(x=>x.kind!=='number'||!/^\d+$/.test(x.raw)||Number(x.raw)>100))return null;
   result.push({id:JSON.stringify([n.path.at(-1),n.children.map(x=>x.raw)]),key:n.path.at(-1),levels:n.children.map(x=>x.raw),arrayRaw:n.children.map(x=>x.raw).join(',')});
  }return result;
 }
 function inspect(doc){
  SaveCore.requireGame(doc);
  const inventory=doc.byPath.get(base+'/ItemHad');
  if(inventory?.kind!=='object')throw Error('보유 아이템 ItemHad 객체가 없습니다. 지원 형식을 확인하세요.');
  const items=[];
  for(const n of inventory.children){
   const id=name(n),count=field(n,'_Count');
   if(n.kind==='object'&&id===n.path.at(-1)&&count?.kind==='number'&&/^\d+$/.test(count.raw))
    items.push({path:n.ptr,name:id,label:display(id),count:count.raw,countPath:count.ptr});
  }
  const gears=[];
  function add(n,owner){
   if(n?.kind!=='object')return;
   const id=name(n),level=field(n,'_Lv'),skill=field(n,'_SkillLv'),fx=effects(skill);
   if(!id||level?.kind!=='number'||!/^\d+$/.test(level.raw)||fx===null)return;
   gears.push({path:n.ptr,name:id,label:display(id),level:level.raw,owner,skillPath:skill.ptr,effects:fx});
  }
  const dressed=doc.byPath.get(base+'/PlayerDressEquip');
  if(dressed?.kind==='object')for(const n of dressed.children)add(n,'주인공 장착 · 슬롯 '+n.path.at(-1));
  const bag=doc.byPath.get(base+'/EquipHad');
  if(bag?.kind==='object')for(const group of bag.children)if(group.kind==='array')for(const n of group.children){
   if(name(n)===group.path.at(-1))add(n,'가방 · '+(Number(n.path.at(-1))+1)+'번째 개체');
  }
  for(const group of ['AddFriends','LeaveFriends']){
   const friends=doc.byPath.get('/saveFriendData/value/'+group);
   if(friends?.kind!=='object')continue;
   for(const friend of friends.children){
    const equips=field(friend,'_PlayerDressEquip'),friendName=field(friend,'_Name');
    if(equips?.kind==='object')for(const n of equips.children)add(n,'동료 '+(friendName?.text||friend.path.at(-1))+' ('+friend.path.at(-1)+') · '+(group==='AddFriends'?'합류':'이탈')+' · 슬롯 '+n.path.at(-1));
   }
  }
  for(const gear of gears){
   gear.recommended=GameCatalog.gears[gear.name]?.options||[];
   const def=AddCatalog.records.find(r=>r.kind==='equipment'&&r.id===gear.name);
   gear.slotLimit=def?.slots??0;
   const choices=new Map(gear.effects.map(x=>[x.id,x]));
   for(const key of gear.recommended){const levels=[gear.level],id=JSON.stringify([key,levels]);choices.set(id,{id,key,levels,arrayRaw:levels[0]});}
   gear.choices=[...choices.values()];
  }
  return {items,gears,itemByPath:new Map(items.map(x=>[x.path,x])),gearByPath:new Map(gears.map(x=>[x.path,x]))};
 }
 function effectLabel(fx){return (GameCatalog.skills[fx.key]?.label||labels.get(fx.key)||fx.key)+' · 등급 '+fx.levels.join('/')+' ['+fx.key+']';}
 const moneyPath=base+'/ItemHad/铜钱';
 function isMoney(item){return item?.path===moneyPath&&item.name==='铜钱'&&item.countPath===moneyPath+'/_Count';}
 function money(model){return model?.items.find(isMoney)||null;}
 function number(item,value){
  const currency=isMoney(item),valid=currency?/^(0|[1-9]\d{0,6})$/:/^[1-9]\d{0,6}$/;
  if(typeof value!=='string'||!valid.test(value)||Number(value)>1000000)throw Error((currency?'금액은 0':'수량은 1')+'~1,000,000 사이 정수로 입력하세요. 이는 편집기 제한이며 게임 상한 검증값은 아닙니다.');
  return value;
 }
 function editable(gear){
  if(!gear.recommended.length||gear.slotLimit<1)return '이 장비에 확인된 옵션 슬롯이 없습니다.';
  if(!/^[1-7]$/.test(gear.level))return '장비 레벨이 확인된 생성 범위를 벗어납니다.';
  if(gear.effects.some(f=>!gear.recommended.includes(f.key)||f.levels.some(v=>v!==gear.level)))return '기존 옵션에 생성 규칙 밖의 값이 있습니다. 원값을 보존하며 편집은 차단합니다.';
  if(gear.effects.reduce((n,f)=>n+f.levels.length,0)>gear.slotLimit)return '기존 중첩 수가 정의의 슬롯 수를 초과합니다. 원값을 보존합니다.';
  return '';
 }
 function validateChoice(gear,ids){
  if(!Array.isArray(ids))throw Error('옵션 변경 목록 오류');
  if(JSON.stringify(ids)===JSON.stringify(gear.effects.map(f=>f.id)))return gear.effects;
  const reason=editable(gear);if(reason)throw Error(reason);
  const group=new Map();let total=0;
  for(const id of ids){let key,levels;try{[key,levels]=JSON.parse(id);}catch{throw Error('옵션 형식 오류');}
   if(typeof key!=='string'||!gear.recommended.includes(key)||!Array.isArray(levels)||!levels.length||levels.some(v=>v!==gear.level))throw Error('장비별 후보 또는 확인된 생성 등급이 아닙니다.');
   total+=levels.length;if(total>gear.slotLimit)throw Error('정의에서 확인한 슬롯 수를 넘습니다.');
   if(!group.has(key))group.set(key,[]);group.get(key).push(...levels);
  }
  const original=gear.effects.reduce((n,f)=>n+f.levels.length,0);
  if(total<original)throw Error('기존 옵션 중첩을 줄일 수 없습니다.');
  return [...group].map(([key,levels])=>({id:JSON.stringify([key,levels]),key,levels,arrayRaw:levels.join(',')}));
 }
 function apply(doc,counts,options){
  const model=inspect(doc),replacements=[];
  if(!(counts instanceof Map)||!(options instanceof Map)||counts.size>model.items.length||options.size>model.gears.length)throw Error('보유 항목 수를 벗어난 변경 목록');
  for(const [path,value] of counts){
   const item=model.itemByPath.get(path);if(!item)throw Error('보유 아이템 경로가 아닙니다.');number(item,value);
   const n=doc.byPath.get(item.countPath);if(value!==n.raw)replacements.push({node:n,data:enc.encode(value)});
  }
  for(const [path,ids] of options){
   const gear=model.gearByPath.get(path);if(!gear)throw Error('보유 장비 경로가 아닙니다.');
   const fx=validateChoice(gear,ids);
   if(JSON.stringify(ids)!==JSON.stringify(gear.effects.map(x=>x.id)))
    replacements.push({node:doc.byPath.get(gear.skillPath),data:enc.encode('{'+fx.map(x=>JSON.stringify(x.key)+':['+x.arrayRaw+']').join(',')+'}')});
  }
  replacements.sort((a,b)=>a.node.start-b.node.start);
  let size=doc.bytes.length,end=0;
  for(const r of replacements){if(r.node.start<end)throw Error('겹치는 변경');end=r.node.end;size+=r.data.length-(r.node.end-r.node.start);}
  if(size>SaveCore.MAX_BYTES)throw Error('파일 크기 한도 초과');
  const out=new Uint8Array(size);let src=0,dst=0;
  for(const r of replacements){const original=doc.bytes.subarray(src,r.node.start);out.set(original,dst);dst+=original.length;out.set(r.data,dst);dst+=r.data.length;src=r.node.end;}
  out.set(doc.bytes.subarray(src),dst);
  const check=inspect(SaveCore.parse(out));
  if(check.items.length!==model.items.length||check.gears.length!==model.gears.length)throw Error('보유 개체 수가 달라졌습니다.');
  for(const [p,v] of counts)if(check.itemByPath.get(p)?.count!==v)throw Error('수량 재검증 실패');
  for(const [p,ids] of options)if(JSON.stringify(check.gearByPath.get(p)?.effects.map(x=>x.id))!==JSON.stringify(validateChoice(model.gearByPath.get(p),ids).map(x=>x.id)))throw Error('옵션 재검증 실패');
  return out;
 }
 return {inspect,effectLabel,number,validateChoice,apply,money,isMoney,editable};
})();
if(typeof module!=='undefined')module.exports=Equipment;
