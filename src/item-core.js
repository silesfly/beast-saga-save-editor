'use strict';
// Byte offsets, not JavaScript number round-tripping, define every replacement.
const SaveCore = (() => {
  const MAX_BYTES = 10 * 1024 * 1024, MAX_NODES = 150000, MAX_DEPTH = 96;
  const decoder = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true});
  const encoder = new TextEncoder();
  const numberRE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
  const candidateRE = /item|equip|inventory|bag|weapon|armor|affix|enchant|장비|아이템|背包|装备|物品/i;
  function pointer(path) { return path.length ? '/' + path.map(s=>String(s).replace(/~/g,'~0').replace(/\//g,'~1')).join('/') : ''; }
  function parse(input) {
    const bytes = new Uint8Array(input);
    if (!bytes.length || bytes.length > MAX_BYTES) throw Error('빈 파일 또는 10 MiB를 초과하는 파일입니다.');
    decoder.decode(bytes); // Reject invalid UTF-8, including UTF-16 and encrypted input.
    let s='';
    for(let i=0;i<bytes.length;i+=16384) s+=String.fromCharCode(...bytes.subarray(i,i+16384));
    let pos = bytes[0]===239 && bytes[1]===187 && bytes[2]===191 ? 3 : 0;
    const nodes=[], byPath=new Map();
    const ws=()=>{while(pos<s.length && /[\x20\t\r\n]/.test(s[pos])) pos++;};
    const fail=msg=>{throw Error(msg+' (바이트 '+pos+')');};
    function str() {
      const start=pos;
      if(s[pos++]!=='"') fail('문자열 시작 오류');
      let closed=false;
      while(pos<s.length) {
        const c=s[pos++];
        if(c==='"'){closed=true;break;}
        if(c==='\\'){if(pos>=s.length) fail('잘린 이스케이프');pos++;}
        else if(c.charCodeAt(0)<32) fail('문자열 제어 문자');
      }
      if(!closed) fail('잘린 문자열');
      if(pos-start>MAX_BYTES) fail('문자열 크기 한도 초과');
      const token=decoder.decode(bytes.subarray(start,pos));
      return JSON.parse(token.replace(/\\([\s\S])/gu,(whole,ch)=>ch==='“'||ch==='”'?ch:whole));
    }
    function value(path,depth,parent) {
      if(depth>MAX_DEPTH || nodes.length>=MAX_NODES) fail('구조 분석 한도 초과');
      ws(); const start=pos, c=s[pos];
      const ptr=pointer(path);
      if(ptr.length>4096) fail('경로 길이 한도 초과');
      const n={path,ptr,start,end:0,parent,kind:'',children:[],text:''};
      nodes.push(n); byPath.set(n.ptr,n);
      if(c==='{' || c==='[') {
        n.kind=c==='{'?'object':'array'; pos++; ws();
        const end=c==='{'?'}':']', keys=new Set(); let index=0;
        if(s[pos]!==end) while(true) {
          let key;
          if(c==='{') {
            ws();
            if(s[pos]==='"') key=str();
            else { const keyStart=pos; while(pos<s.length && /[0-9]/.test(s[pos]))pos++; if(pos===keyStart)fail('지원하지 않는 키'); key=s.slice(keyStart,pos); }
            if(keys.has(key)) fail('중복 키는 편집하지 않습니다');
            keys.add(key); ws(); if(s[pos++]!==':') fail('콜론 누락');
          } else key=String(index++);
          n.children.push(value([...path,key],depth+1,n)); ws();
          if(s[pos]===end) break;
          if(s[pos++]!==',') fail('구분자 오류');
        }
        if(s[pos++]!==end) fail('닫는 괄호 누락');
      } else if(c==='"') { n.kind='string'; n.text=str(); }
      else {
        while(pos<s.length && !/[\x20\t\r\n,\]}]/.test(s[pos])) pos++;
        const raw=s.slice(start,pos); n.text=raw;
        if(numberRE.test(raw)) n.kind='number';
        else if(raw==='true'||raw==='false') n.kind='boolean';
        else if(raw==='null') n.kind='null';
        else fail('지원하지 않는 값 또는 암호화·압축 파일');
      }
      n.end=pos; n.raw=(n.kind==='object'||n.kind==='array')?'':s.slice(start,pos); return n;
    }
    const root=value([],0,null); ws();
    if(pos!==s.length) fail('파일 뒤에 알 수 없는 데이터');
    if(root.kind!=='object') fail('최상위 객체가 아닙니다');
    return {bytes,nodes,byPath,root};
  }
  function requireGame(doc) {
    const type=doc.byPath.get('/savePlayerData/__type');
    if(type?.kind!=='string'||!type.text.startsWith('PlayerData,')||
       doc.byPath.get('/savePlayerData/value')?.kind!=='object'||
       doc.byPath.get('/saveInfoData/value')?.kind!=='object')
      throw Error('기존 편집기에서 확인한 영수강호 세이브 표식이 없습니다. SaveInfo 전용 파일, 다른 게임 또는 다른 형식일 수 있습니다.');
    return doc;
  }
  function validateNumber(node,text,allowFloat=false) {
    if(node?.kind!=='number') throw Error('기존 숫자 값만 수정할 수 있습니다.');
    if(typeof text!=='string'||text.length>80||!numberRE.test(text)) throw Error('올바른 숫자를 입력하세요. 쉼표·공백·NaN·Infinity는 허용하지 않습니다.');
    if(!Number.isFinite(Number(text))) throw Error('숫자가 너무 큽니다.');
    if(!allowFloat && /^-?\d+$/.test(node.raw) && !/^-?\d+$/.test(text)) throw Error('원래 정수인 항목에는 정수만 입력하세요.');
    // This is syntax protection only; game-specific ranges are not yet known.
    return text;
  }
  function patch(doc,changes,floatPaths=new Set()) {
    requireGame(doc);
    if(!(changes instanceof Map)) throw Error('변경 목록 오류');
    const edits=[];
    for(const [ptr,text] of changes) {
      const node=doc.byPath.get(ptr); validateNumber(node,text,floatPaths.has(ptr));
      if(node.raw!==text) edits.push({node,text});
    }
    edits.sort((a,b)=>a.node.start-b.node.start);
    let size=doc.bytes.length,last=0;
    for(const e of edits) {if(e.node.start<last) throw Error('겹치는 변경'); last=e.node.end; size+=e.text.length-(e.node.end-e.node.start);}
    if(size>MAX_BYTES) throw Error('수정본 크기 한도 초과');
    const out=new Uint8Array(size); let src=0,dst=0;
    for(const {node,text} of edits) {
      const unchanged=doc.bytes.subarray(src,node.start); out.set(unchanged,dst); dst+=unchanged.length;
      const replacement=encoder.encode(text); out.set(replacement,dst); dst+=replacement.length; src=node.end;
    }
    out.set(doc.bytes.subarray(src),dst);
    const check=requireGame(parse(out));
    if(check.nodes.length!==doc.nodes.length) throw Error('구조 변경 감지');
    for(let i=0;i<doc.nodes.length;i++) {
      const old=doc.nodes[i], fresh=check.nodes[i];
      if(old.ptr!==fresh.ptr || old.kind!==fresh.kind) throw Error('경로 변경 감지');
      if(old.kind!=='object' && old.kind!=='array' && fresh.raw!==(changes.get(old.ptr)??old.raw)) throw Error('비대상 값 변경 감지');
    }
    return out;
  }
  function isCandidate(n) {return n.path.some(p=>candidateRE.test(p));}
  return {parse,requireGame,patch,validateNumber,isCandidate,MAX_BYTES,pointer};
})();
if(typeof module!=='undefined') module.exports=SaveCore;
