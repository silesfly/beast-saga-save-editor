'use strict';
const Additions=(()=>{
 const root='/savePlayerData/value/ItemHad',encode=new TextEncoder();
 const catalog=new Map(AddCatalog.records.filter(r=>r.kind==='item').map(r=>[r.id,r]));
 function amount(value){if(typeof value!=='string'||!/^([1-9]|[1-9][0-9])$/.test(value))throw Error('추가 수량은 1~99 정수입니다. 복사본 시험 한도이며 게임 상한이 아닙니다.');return Number(value);}
 function plan(doc,entries,trial){
  SaveCore.requireGame(doc);
  if(!(entries instanceof Map)||entries.size>20)throw Error('한 번에 최대 20종만 시험할 수 있습니다.');
  if(entries.size&&!trial)throw Error('게임 미검증 복사본 시험에 동의해야 합니다.');
  const bag=doc.byPath.get(root);if(bag?.kind!=='object')throw Error('ItemHad 객체가 없습니다.');
  const changes=[],insertions=[],summary=[];
  let clock=null;
  function time(){
   if(!clock){const read=k=>{const n=doc.byPath.get('/saveTime/value/'+k);if(n?.kind!=='number'||!/^\d+$/.test(n.raw)||!Number.isSafeInteger(Number(n.raw)))throw Error('게임 시간 필드를 확인할 수 없습니다: '+k);return Number(n.raw);};
    const open=doc.byPath.get('/saveTime/value/IsOpen');if(open?.kind!=='boolean')throw Error('게임 시간 상태 미확인');
    clock={ms:read('MS'),year:read('yearTime'),month:read('monthTime'),day:read('dayTime'),minutes:read('minutes'),seconds:read('seconds'),open:open.raw==='true'};
    if(clock.year>9999||clock.month>12||clock.day>31||clock.minutes>1440||clock.seconds>59||clock.ms>2147483646)throw Error('확인 범위를 벗어난 게임 시간입니다.');
   }
   if(!clock.open&&clock.ms<100)clock.ms=100;
   if(++clock.ms>2147483647)throw Error('시간 카운터 초과');
   const result=clock.year*1e10+clock.month*1e8+clock.day*1e6+clock.minutes*1e4+clock.seconds*100+clock.ms*.001;
   if(!Number.isFinite(result)||result===clock.year*1e10+clock.month*1e8+clock.day*1e6+clock.minutes*1e4+clock.seconds*100+(clock.ms-1)*.001)throw Error('시간 정밀도 범위를 벗어납니다.');return result;
  }
  for(const [id,text] of entries){const def=catalog.get(id);if(!def?.candidate)throw Error('추가 미지원 항목: '+id);const count=amount(text),p=root+'/'+id.replace(/~/g,'~0').replace(/\//g,'~1'),old=doc.byPath.get(p);const t=time();
   if(old){const fields=Object.fromEntries(old.children.map(n=>[n.path.at(-1),n]));
    if(old.kind!=='object'||fields._Name?.text!==id||fields._Count?.kind!=='number'||!/^\d+$/.test(fields._Count.raw)||fields._DressType?.raw!=='1'||fields._LockHp?.raw!=='0'||fields._GetTimeNew?.kind!=='number')throw Error('기존 아이템의 생성 구조가 다릅니다: '+id);
    const before=Number(fields._Count.raw),after=before+count;if(!Number.isSafeInteger(before)||after>1000000)throw Error('최종 수량이 편집기 시험 한도를 넘습니다.');
    changes.push({node:fields._Count,text:String(after)},{node:fields._GetTimeNew,text:String(t)});summary.push({id,before,after,kind:'merge'});
   }else{insertions.push([id,{_DressType:1,_Count:count,_Name:id,_LockHp:0,_GetTimeNew:t}]);summary.push({id,before:0,after:count,kind:'insert'});}
  }
  if(clock)changes.push({node:doc.byPath.get('/saveTime/value/MS'),text:String(clock.ms)});
  return {bag,changes,insertions,summary};
 }
 function apply(doc,entries,trial){
  const p=plan(doc,entries,trial);if(!entries.size)return doc.bytes;
  const edits=p.changes.map(c=>({start:c.node.start,end:c.node.end,data:encode.encode(c.text)}));
  if(p.insertions.length)edits.push({start:p.bag.end-1,end:p.bag.end-1,data:encode.encode((p.bag.children.length?',':'')+p.insertions.map(([k,v])=>JSON.stringify(k)+':'+JSON.stringify(v)).join(','))});
  edits.sort((a,b)=>a.start-b.start);let size=doc.bytes.length,last=0;
  for(const e of edits){if(e.start<last)throw Error('겹치는 추가 계획');last=e.end;size+=e.data.length-(e.end-e.start);}if(size>SaveCore.MAX_BYTES)throw Error('파일 크기 한도 초과');
  const out=new Uint8Array(size);let src=0,dst=0;for(const e of edits){out.set(doc.bytes.subarray(src,e.start),dst);dst+=e.start-src;out.set(e.data,dst);dst+=e.data.length;src=e.end;}out.set(doc.bytes.subarray(src),dst);
  const check=SaveCore.requireGame(SaveCore.parse(out)),changed=new Map(p.changes.map(c=>[c.node.ptr,c.text])),fresh=new Set(p.insertions.map(([id])=>root+'/'+id.replace(/~/g,'~0').replace(/\//g,'~1')));
  if(check.nodes.length!==doc.nodes.length+p.insertions.length*6)throw Error('추가 노드 수 불일치');
  for(const n of doc.nodes){const next=check.byPath.get(n.ptr);if(!next||next.kind!==n.kind)throw Error('기존 구조 손상');if(n.kind!=='array'&&n.kind!=='object'&&next.raw!==(changed.get(n.ptr)??n.raw))throw Error('비대상 값 변경');}
  for(const [id,value] of p.insertions){const ptr=root+'/'+id.replace(/~/g,'~0').replace(/\//g,'~1'),node=check.byPath.get(ptr);if(!fresh.has(ptr)||node?.kind!=='object'||node.children.length!==5)throw Error('새 항목 구조 오류');for(const [k,v] of Object.entries(value)){const n=check.byPath.get(ptr+'/'+k);if(typeof v==='string'?(n?.kind!=='string'||n.text!==v):(n?.kind!=='number'||n.raw!==JSON.stringify(v)))throw Error('새 필드 재검증 실패');}}
  return out;
 }
 return {amount,plan,apply};
})();
