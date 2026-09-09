// Room content is data; verification labels authors but does not gate inclusion.
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export const parseRecords=text=>JSON.parse(text,(key,value,context)=>key==='nonce'&&typeof value==='number'?(context?.source??(Number.isSafeInteger(value)?String(value):null)):value);
export async function normalize(record,generation){
  if(!Number.isSafeInteger(generation)||generation<0||!record||!Number.isSafeInteger(record.seq)||record.seq<1||
    typeof record.ts!=='string'||!Number.isFinite(Date.parse(record.ts))||typeof record.from!=='string'||!record.from.length||
    typeof record.text!=='string'||!record.text.trim()||[...record.text].length>4096)return null;
  let signatureVerified=false;
  try{
    if(/^did:key:z[1-9A-HJ-NP-Za-km-z]{47}$/.test(record.from)&&/^\d{1,19}$/.test(String(record.nonce))&&/^[A-Za-z0-9_-]{85}[AQgw]$/.test(record.sig)){
      let n=0n;for(const c of record.from.slice(9))n=n*58n+BigInt(alphabet.indexOf(c));
      const hex=n.toString(16).padStart(68,'0'),bytes=Uint8Array.from(hex.match(/../g),x=>parseInt(x,16));
      if(bytes.length===34&&bytes[0]===237&&bytes[1]===1){
        const key=await crypto.subtle.importKey('raw',bytes.slice(2),'Ed25519',false,['verify']);
        const sig=Uint8Array.from(atob(record.sig.replaceAll('-','+').replaceAll('_','/')+'=='),c=>c.charCodeAt(0));
        signatureVerified=await crypto.subtle.verify('Ed25519',key,sig,new TextEncoder().encode(`shrine|${record.nonce}|${record.text}`));
      }
    }
  }catch{/* Unsupported verification never becomes a verified identity. */}
  const fingerprint=await digest(signatureVerified?`${record.from}|${record.nonce}|${record.text}`:`unsigned|${generation}|${record.seq}|${record.from}|${record.text}`);
  return {...record,id:`${generation}:${record.seq}`,room:'shrine',generation,rawText:record.text,signatureVerified,fingerprint};
}
export function mergePosts(saved,incoming){
  const records=new Map(saved.map(w=>[w.id,w])),fingerprints=new Set(saved.map(w=>w.fingerprint));
  for(const w of incoming){if(!w||records.has(w.id)||fingerprints.has(w.fingerprint))continue;records.set(w.id,w);fingerprints.add(w.fingerprint);}
  return [...records.values()].sort((a,b)=>Date.parse(b.ts)-Date.parse(a.ts)||b.generation-a.generation||b.seq-a.seq);
}
export function selectFeed(all,policy,params,meta){
  const blocked=w=>policy.hiddenIds.includes(w.id)||policy.hiddenDids.includes(w.from)||(policy.hiddenFingerprints||[]).includes(w.fingerprint);
  const visible=all.filter(w=>!blocked(w));
  const watch=(params.get('watch')||'').split(',').slice(0,42);
  const hiddenIds=watch.filter(id=>policy.hiddenIds.includes(id)||all.some(w=>w.id===id&&blocked(w)));
  const base={...meta,total:visible.length,hiddenIds};
  if(params.get('meta')==='1')return base;
  if(params.has('seq')){
    const matches=visible.filter(w=>String(w.seq)===params.get('seq')&&(!params.has('generation')||String(w.generation)===params.get('generation')));
    if(matches.length!==1)throw Object.assign(new Error(matches.length?'Ambiguous generation':'Not displayed'),{status:matches.length?409:404,body:base});
    return {...base,wishes:matches};
  }
  const before=params.get('before'),index=before?all.findIndex(w=>w.id===before):-1;
  if(before&&index<0)throw Object.assign(new Error('Unknown cursor'),{status:409,body:base});
  const count=Math.min(200,Math.max(1,Number(params.get('limit'))||42));
  const available=all.slice(index+1).filter(w=>!blocked(w)),wishes=available.slice(0,count);
  return {...base,wishes,next:available.length>wishes.length?wishes.at(-1).id:null};
}
