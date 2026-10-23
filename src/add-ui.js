'use strict';
let addSelected=null;
function renderAdd(){
 const tree=$('catalogTree'),query=$('catalogSearch').value.trim().toLowerCase(),state=$('catalogState').value;
 const open=new Set([...tree.querySelectorAll('details[open]')].map(d=>d.dataset.group));tree.replaceChildren();
 const groups=new Map();for(const row of AddCatalog.records){if(query&&![row.id,row.label,row.original].some(s=>s.toLowerCase().includes(query)))continue;if(state==='candidate'&&!row.candidate||state==='blocked'&&row.candidate)continue;const key=(row.kind==='equipment'?'장비 / ':'아이템 / ')+row.group;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 for(const [key,rows] of groups){const detail=document.createElement('details'),title=document.createElement('summary');detail.dataset.group=key;detail.open=open.has(key)||!!query;title.textContent=key+' ('+rows.length+')';detail.append(title);
  const fill=()=>{if(detail.dataset.loaded)return;detail.dataset.loaded='true';for(const row of rows){const b=document.createElement('button');b.className='entry';b.dataset.catalogId=row.id;b.dataset.kind=row.kind;b.textContent=row.label+' · '+row.id+' · '+(row.candidate?'복사본 시험 후보':'추가 차단');b.onclick=()=>{if(busy)return;addSelected=row;$('addQuantity').value=newAdds.get(row.id)||'1';previewAdd();};detail.append(b);}};
  detail.ontoggle=()=>{if(detail.open)fill();};if(detail.open)fill();tree.append(detail);
 }
 previewAdd();renderAddQueue();
}
function previewAdd(){
 $('addSelection').textContent=addSelected?addSelected.label+' ['+addSelected.id+']':'분류를 펼쳐 항목을 선택하세요';
 $('addReason').textContent=addSelected?.reason||'';$('queueAdd').disabled=true;$('addPreview').textContent='';
 if(!addSelected||!doc||!addSelected.candidate)return;
 if(!catalogVerified){$('addPreview').textContent='EXE에서 설치 데이터 해시를 먼저 확인하세요.';return;}
 try{const p=Additions.plan(doc,new Map([[addSelected.id,$('addQuantity').value]]),$('addTrial').checked),s=p.summary[0];$('addPreview').textContent=(s.kind==='merge'?'기존 스택 병합':'새 항목 생성')+' · '+s.before+' → '+s.after+'개 · 게임 시간 MS 갱신 포함';$('queueAdd').disabled=busy;}catch(e){$('addPreview').textContent=e.message;}
}
function renderAddQueue(){const list=$('addQueue');list.replaceChildren();for(const [id,count] of newAdds){const li=document.createElement('li'),cancel=document.createElement('button');li.textContent=id+' +'+count+'개 ';cancel.textContent='취소';cancel.onclick=()=>{if(busy)return;newAdds.delete(id);revision++;renderAddQueue();pending();};li.append(cancel);list.append(li);}}
$('catalogSearch').oninput=renderAdd;$('catalogState').onchange=renderAdd;
$('addQuantity').oninput=previewAdd;
$('addTrial').onchange=()=>{if(busy){if(newAdds.size)$('addTrial').checked=true;return;}if(!$('addTrial').checked&&newAdds.size){newAdds.clear();revision++;pending();renderAddQueue();}previewAdd();};
$('queueAdd').onclick=()=>{if(busy||!addSelected)return;try{const next=new Map(newAdds);next.set(addSelected.id,$('addQuantity').value);Additions.plan(doc,next,$('addTrial').checked);newAdds.set(addSelected.id,$('addQuantity').value);revision++;pending();renderAddQueue();msg('복사본 추가 계획에 넣었습니다. 원본 덮어쓰기 없이 별도 파일로 저장합니다.');}catch(e){msg(e.message,true);}};

$('verifyCatalog').onclick=async()=>{if(busy)return;if(!window.nativeRequest){msg('새 기능의 설치 데이터 확인은 Windows EXE에서 지원합니다.',true);return;}catalogVerified=false;$('catalogVerification').textContent='확인 중';busy=true;sync();try{const result=await nativeRequest({kind:'verify-catalog'});if(result.cancelled)return;catalogVerified=result.verified===true;$('catalogVerification').textContent=catalogVerified?'설치 자산·코드·메타데이터 일치 · 게임 실행 검증은 미완료':'불일치';}catch(e){catalogVerified=false;msg(e.message,true);}finally{busy=false;sync();previewAdd();}};
