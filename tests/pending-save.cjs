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
(async()=>{await preservePending(true);await preservePending(false)})().catch(e=>{console.error(e);process.exitCode=1});