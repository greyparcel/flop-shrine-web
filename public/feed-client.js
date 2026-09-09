import {createHybridFeed} from './hybrid-feed.js';
export const getFeed=createHybridFeed();
export const detailURL=wish=>`./wish.html?generation=${wish.generation}&seq=${wish.seq}`;
export const authorLabel=wish=>wish.signatureVerified?wish.from:`Nickname: ${wish.from}`;
export function feedNotice(snapshot){
  if(snapshot.status==='unavailable')return 'Wishes are temporarily unavailable.';
  if(snapshot.status==='stale')return 'Showing saved wishes. Updates are temporarily unavailable.';
  if(snapshot.historyIncomplete)return 'Some older room posts could not be retrieved.';
  return '';
}
