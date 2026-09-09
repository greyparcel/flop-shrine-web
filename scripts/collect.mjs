import {createFeed} from '../feed.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const feed=createFeed({dataDir:path.join(root,'archive'),policyPath:path.join(root,'config/feed-policy.json')});
const result=await feed.get();
if(result.status!==200||result.body.status!=='fresh')throw Error('Collection failed; previous archive retained');
console.log(JSON.stringify({status:result.body.status,total:result.body.total,checkedAt:result.body.checkedAt,historyIncomplete:result.body.historyIncomplete}));
