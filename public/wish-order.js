export function newestWishes(wishes){
  return [...wishes].sort((a,b)=>(Date.parse(b.ts)-Date.parse(a.ts))||((b.generation||0)-(a.generation||0))||(b.seq-a.seq));
}
