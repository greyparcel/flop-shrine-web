import {getFeed,detailURL,feedNotice,authorLabel} from './feed-client.js';
import {newestWishes} from './wish-order.js';
export async function createWishDisplay({gateSpacing,gateCount}){
  const notice=document.querySelector('#feed-status'),refreshButton=document.querySelector('#refresh-wishes');
  let snapshot;
  try{snapshot=await getFeed(`limit=${gateCount}`);}catch{snapshot={wishes:[],status:'unavailable',version:null};}
  notice.textContent=feedNotice(snapshot);
  refreshButton.onclick=()=>location.reload();
  // Fetch once and keep assignments stable until the page is reloaded.
  const entries=newestWishes(snapshot.wishes).slice(0,gateCount);
  const removed=new Set();
  let polling=false;
  async function checkUpdates(){
    if(polling||document.hidden)return;polling=true;
    try{
      const current=await getFeed('meta=1&watch='+encodeURIComponent(entries.map(w=>w.id).join(',')));
      for(const id of current.hiddenIds||[])removed.add(id);
      refreshButton.hidden=current.version===snapshot.version;
      notice.textContent=feedNotice(current);
    }catch(e){
      if(e.body?.reason==='POLICY_UNAVAILABLE'){for(const w of entries)removed.add(w.id);refreshButton.hidden=false;}
      notice.textContent='Wish updates are temporarily unavailable.';
    }finally{polling=false;}
  }
  setInterval(checkUpdates,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdates();});
  const card=document.querySelector('#gate-wish');
  const title=card.querySelector('.wish-label'),text=card.querySelector('.wish-text'),author=card.querySelector('.wish-author'),source=card.querySelector('.wish-source');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let shown=null,previous=null,animation=null;
  let visible=false,visibilityAnimation=null;
  function setVisible(next){
    if(next===visible)return;
    const opacity=card.hidden?0:Number(getComputedStyle(card).opacity);
    visible=next;
    visibilityAnimation?.cancel();
    card.hidden=false;
    card.inert=!next;
    card.setAttribute('aria-hidden',String(!next));
    card.style.opacity=next?'1':'0';
    if(reduced.matches){card.hidden=!next;return;}
    visibilityAnimation=card.animate([{opacity},{opacity:next?1:0}],{duration:360,easing:'ease-in-out'});
    visibilityAnimation.onfinish=()=>{if(!visible)card.hidden=true;};
  }
  function update(distance){
    if(!entries.length)return null;
    // Start as the nearby gate leaves the view, slightly before the camera crosses it.
    const visualLead=1.8;
    const interval=Math.floor((distance-(9-visualLead))/gateSpacing);
    const entry=interval>=0&&interval<gateCount?entries[interval]:null;
    const candidate=entry&&!removed.has(entry.id)?entry:null;
    if(!candidate){setVisible(false);return null;}
    if(candidate.id!==shown){
      previous?.remove();animation?.cancel();
      const old=shown===null||!visible?null:text.cloneNode(true);
      title.textContent=`WISH ${String(Math.min(interval,entries.length-1)+1).padStart(2,'0')} / ${String(entries.length).padStart(2,'0')}`;
      text.textContent=candidate.text;
      author.textContent=candidate.signatureVerified?candidate.from.slice(0,16)+'…'+candidate.from.slice(-8):authorLabel(candidate);
      author.title=authorLabel(candidate);
      source.textContent='Read full wish ↗';
      source.href=detailURL(candidate);
      if(old&&!reduced.matches){
        old.classList.add('wish-previous');old.setAttribute('aria-hidden','true');
        text.parentElement.append(old);previous=old;
        old.animate([{opacity:1},{opacity:0}],{duration:360,easing:'ease-in-out'}).onfinish=()=>old.remove();
        animation=text.animate([{opacity:0},{opacity:1}],{duration:360,easing:'ease-in-out'});
      }
      shown=candidate.id;
    }
    setVisible(true);
    const footerTop=document.querySelector('footer').getBoundingClientRect().top;
    card.style.bottom=Math.max(0,innerHeight-footerTop+22)+'px';
    return candidate.seq;
  }
  return {update,count:entries.length};
}
