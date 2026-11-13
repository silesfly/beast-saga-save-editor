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
 const makeEl=(id='')=>({
  id,value:'',checked:false,disabled:false,hidden:false,open:false,textContent:'',className:'',tagName:'',isContentEditable:false,dataset:{},children:[],parentElement:null,
  classList:{toggle(){},add(){},remove(){}},
  replaceChildren(...x){this.children=x;},
  append(...x){this.children.push(...x);},
  before(){},
  querySelectorAll(){return [];},
  focus(){this.focused=true;document.activeElement=this;},
  select(){this.selected=true;}
 });
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
 console.log('PASS v0.11 UI code atlas, modeNotice, and shortcuts');
}
(async()=>{await preservePending(true);await preservePending(false);testUiFeatures();})().catch(e=>{console.error(e);process.exitCode=1});