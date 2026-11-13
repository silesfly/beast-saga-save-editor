'use strict';
const PlayerPoints=(()=>{
 const root='/savePlayerData/value',thresholds=[0, 10, 25, 45, 70, 100, 135, 175, 220, 270, 325, 385, 450, 520, 595, 675, 760, 850, 945, 1045, 1155, 1275, 1405, 1545, 1695, 1855, 2025, 2205, 2395, 2595, 2805, 3025, 3255, 3495, 3745, 4005, 4275, 4555, 4845, 5145, 5455, 5775, 6105, 6445, 6795, 7155, 7525, 7905, 8295, 8695, 9105, 9525, 9955, 10395, 10845, 11305, 11775, 12255, 12745, 13245, 13760, 14290, 14835, 15395, 15970, 16560, 17165, 17785, 18420, 19070, 19735, 20415, 21110, 21820, 22545, 23285, 24040, 24810, 25595, 26395, 27210, 28040, 28885, 29745, 30620, 31510, 32415, 33335, 34270, 35220, 36185, 37165, 38160, 39170, 40195, 41235, 42290, 43360, 44445, 45545];
 const lifeSkills=[
  ['0','ForgeLevel','단조 레벨 (철장 · LifeExp/0)'],
  ['1','CraftLevel','공예 레벨 (교예 · LifeExp/1)'],
  ['2','WeaveLevel','재봉 레벨 (직금 · LifeExp/2)'],
  ['3','CookLevel','요리 레벨 (주예 · LifeExp/3)'],
  ['4','MedicineLevel','의술 레벨 (의술 · LifeExp/4)'],
  ['5','FishLevel','낚시 레벨 (어획 · LifeExp/5)'],
  ['6','TradeLevel','상업 레벨 (흥정 · LifeExp/6)'],
  ['7','SpeechLevel','화술 레벨 (설득 · LifeExp/7)'],
  ['8','LockpickLevel','해정 레벨 (개쇄 · LifeExp/8)']
 ];
 const definitions=[
  ['TalentAdd','특성 포인트 · 누적 추가분',0,1000000],
  ['AddProSpot','능력치 포인트 · 누적 추가분',0,1000000],
  ['LifePoints','생활 포인트 · 남은 수량',0,1000000],
  ['MedicineLevel','의술 레벨',1,100],
  ['ForgeLevel','단조 레벨 (철장)',1,100],
  ['CraftLevel','공예 레벨 (교예)',1,100],
  ['WeaveLevel','재봉 레벨 (직금)',1,100],
  ['CookLevel','요리 레벨 (주예)',1,100],
  ['FishLevel','낚시 레벨 (어획)',1,100],
  ['TradeLevel','상업 레벨 (흥정)',1,100],
  ['SpeechLevel','화술 레벨 (설득)',1,100],
  ['LockpickLevel','해정 레벨 (개쇄)',1,100]
 ];
 function integer(doc,path){const n=doc.byPath.get(root+'/'+path);if(n?.kind!=='number'||!/^-?\d+$/.test(n.raw))throw Error('포인트 저장 필드를 확인할 수 없습니다: '+path);const v=Number(n.raw);if(!Number.isInteger(v)||v<-2147483648||v>2147483647)throw Error('포인트 저장 범위 오류: '+path);return v;}
 function level(exp){if(exp<0)throw Error('생활 경험치는 음수일 수 없습니다.');let n=1;while(n<100&&exp>=thresholds[n])n++;return n;}
 function life(doc,levels){
  const n=doc.byPath.get(root+'/LifeExp');if(n?.kind!=='object'||!doc.byPath.has(root+'/LifeExp/4'))throw Error('생활 기술 기록이 없습니다.');
  const map=typeof levels==='number'?{MedicineLevel:levels}:(levels||{});
  let sum=0;
  for(const x of n.children){
   const k=x.path.at(-1);if(!/^[0-8]$/.test(k))throw Error('알 수 없는 생활 기술 번호');
   const skillKey=lifeSkills[Number(k)][1];
   const lv=map[skillKey]!==undefined?Number(map[skillKey]):level(integer(doc,'LifeExp/'+k));
   sum+=lv-1;
  }
  return Math.trunc(sum/10);
 }
 function fields(doc){
  SaveCore.requireGame(doc);
  const n=doc.byPath.get(root+'/LifeExp');if(n?.kind!=='object'||!doc.byPath.has(root+'/LifeExp/4'))throw Error('생활 기술 기록이 없습니다.');
  const levels={};
  for(const [idx,key] of lifeSkills)levels[key]=doc.byPath.has(root+'/LifeExp/'+idx)?String(level(integer(doc,'LifeExp/'+idx))):'1';
  const earned=life(doc,levels),used=integer(doc,'UseLifePeak');
  return {TalentAdd:String(integer(doc,'TalentAdd')),AddProSpot:String(integer(doc,'AddProSpot')),LifePoints:String(earned>0?Math.max(0,earned-used):0),...levels};
 }
 function calculate(doc,values){
  const old=fields(doc),v={};
  if(!values||typeof values!=='object'||Object.keys(values).some(k=>!definitions.some(x=>x[0]===k)))throw Error('지원하지 않는 포인트 항목');
  for(const [k,label,min,max] of definitions){
   const raw=values[k]===undefined&&k!=='TalentAdd'&&k!=='AddProSpot'&&k!=='LifePoints'&&k!=='MedicineLevel'?old[k]:values[k];
   const s=String(raw);
   if(!/^(0|[1-9]\d*)$/.test(s)||Number(s)<min||Number(s)>max)throw Error(label+'은 '+min+'~'+max.toLocaleString()+' 정수로 입력하세요.');
   v[k]=Number(s);
  }
  const changes=new Map(),set=(path,value)=>{const n=doc.byPath.get(root+'/'+path);integer(doc,path);if(Number(n.raw)!==value)changes.set(n.ptr,String(value));};
  for(const k of ['TalentAdd','AddProSpot'])if(v[k]!==Number(old[k]))set(k,v[k]);
  const lifeChanged=lifeSkills.some(([,k])=>v[k]!==Number(old[k]));
  if(v.LifePoints!==Number(old.LifePoints)||lifeChanged){
   const earned=life(doc,v);
   if(v.LifePoints>0&&earned===0)throw Error('생활 기술이 낮아 포인트가 0으로 고정됩니다. 의술·단조 등 생활 기술 레벨을 11 이상으로 설정하세요.');
   for(const [idx,k] of lifeSkills){
    if(v[k]!==Number(old[k])){
     if(!doc.byPath.has(root+'/LifeExp/'+idx))throw Error('생활 기술 기록이 없습니다: '+k);
     set('LifeExp/'+idx,thresholds[v[k]-1]);
    }
   }
   set('UseLifePeak',earned-v.LifePoints);
  }
  return {values:v,changes};
 }
 function apply(doc,values){return SaveCore.patch(doc,calculate(doc,values).changes);}
 return {definitions,lifeSkills,thresholds,fields,calculate,apply,level};
})();
if(typeof module!=='undefined')module.exports=PlayerPoints;
