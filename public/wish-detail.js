import {getFeed,detailURL,feedNotice,authorLabel} from './feed-client.js';
const query=new URLSearchParams(location.search),seq=query.get('seq'),generation=query.get('generation');
const status=document.querySelector('#feed-info'),text=document.querySelector('#text');

function freshness(snapshot){status.textContent=feedNotice(snapshot)||(snapshot.checkedAt?'Updated '+new Date(snapshot.checkedAt).toLocaleString():'');}
try{
  if(seq===null){
    document.title='All wishes · FLOP Shrine';
    document.querySelector('h1').textContent='FLOP / SHRINE · ALL WISHES';
    const archive=document.querySelector('#archive'),more=document.querySelector('#more');
    let cursor=null,busy=false;const rendered=new Set();
    async function appendBatch(){
      if(busy)return;busy=true;more.disabled=true;
      try{
        const snapshot=await getFeed('limit=30'+(cursor?'&before='+encodeURIComponent(cursor):''));
        freshness(snapshot);text.textContent=`${snapshot.total} collected wishes · Newest first`;
        for(const wish of snapshot.wishes){
          if(rendered.has(wish.id))continue;rendered.add(wish.id);
          const article=document.createElement('article');article.dataset.wishId=wish.id;
          const content=document.createElement('p');content.className='archive-text';content.textContent=wish.text;
          const meta=document.createElement('p');meta.className='archive-meta';meta.textContent=`${wish.ts} · ${authorLabel(wish)}`;
          const link=document.createElement('a');link.href=detailURL(wish);link.textContent=`shrine · ${wish.id} ↗`;
          article.append(content,meta,link);archive.append(article);
        }
        cursor=snapshot.next;more.hidden=!cursor;
      }catch{status.textContent='Could not load wishes. Reload to try again.';}
      finally{busy=false;more.disabled=false;}
    }
    more.onclick=appendBatch;await appendBatch();
  }else{
    const snapshot=await getFeed('seq='+encodeURIComponent(seq)+(generation!==null?'&generation='+encodeURIComponent(generation):''));
    freshness(snapshot);const wish=snapshot.wishes[0];
    text.textContent=wish.text;
    document.querySelector('#author').textContent=authorLabel(wish);
    document.querySelector('#record').textContent=`${wish.room} · generation ${wish.generation} · #${wish.seq} · ${wish.ts}`;
    const source=document.querySelector('#source');
    source.href=`https://technocore.chat/r/shrine?since=${wish.seq-1}&limit=1&format=json`;
    source.title='Current room; its generation may have changed since this post.';source.hidden=false;
  }
}catch(e){text.textContent=e.body?.status==='unavailable'?'Wishes are temporarily unavailable.':'This wish is not available on the site yet, or is no longer displayed. Check the generation and sequence, then try again later.';}


