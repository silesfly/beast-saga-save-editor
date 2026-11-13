'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const ctx=vm.createContext({TextEncoder,TextDecoder,Uint8Array,Map,Set});
for(const name of ['item-core','catalog','add-catalog','equipment','categories','inventory-list','stat-catalog','stats','friends','points'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),ctx);
const {C,E,L,P,S,F}=vm.runInContext('({C:SaveCore,E:Equipment,L:InventoryList,P:PlayerPoints,S:PlayerStats,F:FriendStats})',ctx);
const base='/savePlayerData/value/ItemHad/铜钱';
const synthetic=Buffer.from(JSON.stringify({savePlayerData:{__type:'PlayerData, Assembly-CSharp',value:{ItemHad:{'铜钱':{_Name:'铜钱',_Count:7},test:{_Name:'test',_Count:1}}}},saveInfoData:{value:{}},shop:{'铜钱':{_Count:999}},opaque:'한글 保留',big:9223372036854775807}));
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}
function edit(bytes,value){const d=C.parse(bytes),m=E.inspect(d);return E.apply(d,new Map([[E.money(m).path,value]]),new Map());}
test('money exact player identity and missing/wrong-name rejection',()=>{
 const d=C.parse(synthetic),m=E.inspect(d);assert.equal(E.money(m).path,base);
 assert.equal(E.money(null),null);assert.equal(E.money({items:[{name:'铜钱',path:'/shop/铜钱',countPath:'/shop/铜钱/_Count'}]}),null);
 const bad=Buffer.from(synthetic.toString().replace('"_Name":"铜钱"','"_Name":"test"'));assert.equal(E.money(E.inspect(C.parse(bad))),null);
});
test('zero/max round trip, exact unchanged byte prefix/suffix',()=>{
 const d=C.parse(synthetic),n=d.byPath.get(base+'/_Count');
 for(const amount of ['0','1','1000000']){const output=Buffer.from(edit(synthetic,amount));
  assert.equal(E.money(E.inspect(C.parse(output))).count,amount);
  assert.deepEqual(output,Buffer.concat([synthetic.subarray(0,n.start),Buffer.from(amount),synthetic.subarray(n.end)]));
  assert.equal(C.parse(output).byPath.get('/shop/铜钱/_Count').raw,'999');
 }
 assert.deepEqual(Buffer.from(edit(synthetic,'7')),synthetic);
});
test('invalid money and normal-item zero blocked; no input mutation',()=>{
 const d=C.parse(synthetic),m=E.inspect(d),before=Buffer.from(d.bytes);
 for(const v of ['','-1','1000001','1.2','1e3',' 1','1,000','01','NaN','Infinity',1,null])assert.throws(()=>E.number(E.money(m),v));
 assert.throws(()=>E.number(m.items.find(x=>x.name==='test'),'0'));
 assert.throws(()=>E.apply(d,new Map([['/shop/铜钱','1']]),new Map()));assert.deepEqual(Buffer.from(d.bytes),before);
});
test('money and ordinary item edits share one map',()=>{
 const d=C.parse(synthetic),m=E.inspect(d),other=m.items.find(x=>x.name==='test');
 const out=E.apply(d,new Map([[base,'100'],[other.path,'55']]),new Map()),r=E.inspect(C.parse(out));
 assert.equal(E.money(r).count,'100');assert.equal(r.itemByPath.get(other.path).count,'55');
});
test('9 life skills (LifeExp/0..8) and points round-trip with 4-key and 12-key inputs',()=>{
 const lifeFixture=Buffer.from(JSON.stringify({
  savePlayerData:{__type:'PlayerData, Assembly-CSharp',value:{
   ItemHad:{'铜钱':{_Name:'铜钱',_Count:100}},
   TalentAdd:5,AddProSpot:10,UseLifePeak:0,
   LifeExp:{0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0}
  }},
  saveInfoData:{value:{}},
  tail:'keep-exact'
 }));
 const d=C.parse(lifeFixture),f0=P.fields(d);
 assert.equal(P.lifeSkills.length,9);
 assert.equal(f0.MedicineLevel,'1');assert.equal(f0.ForgeLevel,'1');assert.equal(f0.LockpickLevel,'1');
 assert.deepEqual(Buffer.from(P.apply(d,f0)),lifeFixture);
 // 4-key legacy call compatibility
 const out4=Buffer.from(P.apply(d,{TalentAdd:'20',AddProSpot:'30',LifePoints:'3',MedicineLevel:'45'}));
 const d4=C.parse(out4),f4=P.fields(d4);
 assert.equal(f4.TalentAdd,'20');assert.equal(f4.AddProSpot,'30');assert.equal(f4.MedicineLevel,'45');assert.equal(f4.LifePoints,'3');
 assert.equal(d4.byPath.get('/savePlayerData/value/LifeExp/4').raw,String(P.thresholds[44]));
 assert.equal(d4.byPath.get('/savePlayerData/value/LifeExp/0').raw,'0');
 // 12-key multi-life-skill edit (Forge=15, Medicine=45, Fish=40, Lockpick=60)
 const out12=Buffer.from(P.apply(d,{...f0,TalentAdd:'30',AddProSpot:'50',LifePoints:'10',ForgeLevel:'15',MedicineLevel:'45',FishLevel:'40',LockpickLevel:'60'}));
 const d12=C.parse(out12),f12=P.fields(d12);
 assert.equal(f12.ForgeLevel,'15');assert.equal(f12.MedicineLevel,'45');assert.equal(f12.FishLevel,'40');assert.equal(f12.LockpickLevel,'60');
 assert.equal(f12.LifePoints,'10');assert.equal(f12.CraftLevel,'1');
 assert.equal(d12.byPath.get('/savePlayerData/value/LifeExp/0').raw,String(P.thresholds[14]));
 assert.equal(d12.byPath.get('/savePlayerData/value/LifeExp/5').raw,String(P.thresholds[39]));
 assert.equal(d12.byPath.get('/savePlayerData/value/LifeExp/8').raw,String(P.thresholds[59]));
 assert.throws(()=>P.apply(d,{...f0,ForgeLevel:'101'}));
 assert.throws(()=>P.apply(d,{...f0,LockpickLevel:'0'}));
 assert.throws(()=>P.apply(d,{...f0,LifePoints:'1'}),/생활 기술 레벨을 11 이상/);
 const outForge=Buffer.from(P.apply(d,{...f0,LifePoints:'1',MedicineLevel:'1',ForgeLevel:'11'}));
 const dForge=C.parse(outForge),fForge=P.fields(dForge);
 assert.equal(fForge.LifePoints,'1');assert.equal(fForge.MedicineLevel,'1');assert.equal(fForge.ForgeLevel,'11');
 assert.equal(dForge.byPath.get('/savePlayerData/value/LifeExp/0').raw,String(P.thresholds[10]));
 assert.equal(dForge.byPath.get('/savePlayerData/value/UseLifePeak').raw,'0');
});
test('23-slot FriendLoveTable metadata and FriendLoveNum byte-exact editing',()=>{
 assert.equal(F.loveTable.length,23);
 assert.equal(F.loveTable.filter(x=>x.shixindan).length,7);
 const loveFixture=Buffer.from(JSON.stringify({
  savePlayerData:{__type:'PlayerData, Assembly-CSharp',value:{
   ItemHad:{'铜钱':{_Name:'铜钱',_Count:50}},
   FriendLoveNum:{'鹿柒':10,'兔千千':25,'阿守':90}
  }},
  saveFriendData:{value:{AddFriends:{luxi:{_Name:'鹿柒',_Lv:20}},LeaveFriends:{Ashou:{_Name:'阿守',_Lv:15}}}},
  saveInfoData:{value:{}}
 }));
 const d=C.parse(loveFixture),entries=F.inspectLove(d);
 assert.equal(entries.length,23);
 assert.equal(entries.filter(x=>x.present).length,3);
 const friends=F.inspect(d);
 assert.equal(friends.length,2);
 assert.equal(friends[0].ko,'녹칠');assert.equal(friends[0].love,'10');assert.equal(friends[0].initLove,10);
 assert.deepEqual(Buffer.from(F.applyLove(d,F.loveFields(d))),loveFixture);
 const out=Buffer.from(F.applyLove(d,{luxi:'60',tuqianqian:'100'}));
 const d2=C.parse(out);
 assert.equal(d2.byPath.get('/savePlayerData/value/FriendLoveNum/鹿柒').raw,'60');
 assert.equal(d2.byPath.get('/savePlayerData/value/FriendLoveNum/兔千千').raw,'100');
 assert.equal(d2.byPath.get('/savePlayerData/value/FriendLoveNum/阿守').raw,'90');
 assert.throws(()=>F.applyLove(d,{wuchang:'60'}));
 assert.throws(()=>F.applyLove(d,{luxi:'1001'}));
 assert.throws(()=>F.applyLove(d,{luxi:'-1'}));
});
if(process.argv[2]){
 const bytes=fs.readFileSync(process.argv[2]),d=C.parse(bytes),m=E.inspect(d);
 test('private save money-only patch preserves every other byte',()=>{
  const n=d.byPath.get(base+'/_Count');assert(n);for(const amount of ['0','1000000'])assert.deepEqual(Buffer.from(edit(bytes,amount)),Buffer.concat([bytes.subarray(0,n.start),Buffer.from(amount),bytes.subarray(n.end)]));
 });
 test('private save no-op equipment/points and list pagination regression',()=>{
  assert.deepEqual(Buffer.from(E.apply(d,new Map(),new Map())),bytes);
  assert.deepEqual(Buffer.from(P.apply(d,P.fields(d))),bytes);
  for(const kind of ['items','gears'])for(const size of [25,50,100,200])for(const sort of ['category-asc','category-desc','original']){
   const state={...L.defaults()[kind],size,sort},first=L.query(m[kind],state,kind),seen=[];
   for(let page=1;page<=first.pages;page++)seen.push(...L.query(m[kind],{...state,page},kind).entries.map(x=>x.path));
   assert.equal(seen.length,m[kind].length);assert.equal(new Set(seen).size,m[kind].length);
  }
  assert(Object.keys(S.fields(d)).length);assert(F.inspect(d).length);
 });
 if(process.argv[3]){fs.writeFileSync(process.argv[3],edit(bytes,'1000000'));assert.equal(E.money(E.inspect(C.parse(fs.readFileSync(process.argv[3])))).count,'1000000');console.log('PASS disk write and reopen');passed++;}
}
console.log(JSON.stringify({status:'PASS',groups:passed}));
