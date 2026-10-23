'use strict';
const InventoryList=(()=>{
 const collator=new Intl.Collator('ko',{numeric:true,sensitivity:'variant'});
 const names=[['name-asc','이름 가나다순'],['name-desc','이름 역순']];
 function sorts(kind){return [['category-asc','카테고리순'],['category-desc','카테고리 역순'],...names,...(kind==='items'?[['count-desc','수량 많은 순'],['count-asc','수량 적은 순']]:[['level-desc','등급 높은 순'],['level-asc','등급 낮은 순'],['owner-asc','보유 위치순'],['owner-desc','보유 위치 역순']]),['original','세이브 기록순']];}
 function defaults(){return Object.fromEntries(['items','gears'].map(k=>[k,{sort:'name-asc',size:50,page:1,query:'',scope:'all',category:'all',subcategory:'all'}]));}
 function query(source,state,kind){
  const q=String(state.query||'').trim().toLocaleLowerCase('ko'),scope=state.scope;
  const entries=source.filter(x=>Categories.matches(x,kind,state)&&(!q||(x.label+' '+x.name+' '+Categories.describe(x,kind).text+' '+(x.owner||'')+' '+(x.effects||[]).map(Equipment.effectLabel).join(' ')).toLocaleLowerCase('ko').includes(q))&&(kind==='items'||scope==='all'||scope==='player'&&x.owner.startsWith('주인공')||scope==='bag'&&x.owner.startsWith('가방')||scope==='friend'&&x.owner.startsWith('동료')));
  const sort=sorts(kind).some(([k])=>k===state.sort)?state.sort:'name-asc';
  const tie=(a,b)=>collator.compare(a.label,b.label)||collator.compare(a.name,b.name)||collator.compare(a.path,b.path);
  if(sort!=='original')entries.sort((a,b)=>{
   const [key,dir]=sort.split('-');let result=0;
   if(key==='category'){const ac=Categories.describe(a,kind),bc=Categories.describe(b,kind);result=ac.rank-bc.rank||collator.compare(ac.subLabel,bc.subLabel);}
   else if(key==='count'||key==='level')result=Number(a[key])-Number(b[key]);
   else result=collator.compare(String(a[key==='name'?'label':key]||''),String(b[key==='name'?'label':key]||''));
   return (dir==='desc'?-result:result)||tie(a,b);
  });
  const size=[25,50,100,200].includes(state.size)?state.size:50,total=entries.length,pages=Math.ceil(total/size),page=Math.min(Math.max(1,Number.isInteger(state.page)?state.page:1),Math.max(1,pages)),offset=(page-1)*size;
  return {entries:entries.slice(offset,offset+size),total,pages,page,size,start:total?offset+1:0,end:Math.min(offset+size,total)};
 }
 return {defaults,sorts,query};
})();
