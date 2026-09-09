import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('./public/',import.meta.url)));
const port=Number(process.env.SHRINE_PORT||4177);
const project=path.dirname(root);
const siteURL=new URL(process.env.SHRINE_PUBLIC_URL||`http://127.0.0.1:${port}/`);
if(!['http:','https:'].includes(siteURL.protocol)||siteURL.username||siteURL.password)throw new Error('Invalid SHRINE_PUBLIC_URL');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.glb':'model/gltf-binary'};
http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const url=new URL(req.url,'http://localhost');
    const name=decodeURIComponent(url.pathname);
    const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep)||!types[path.extname(file)]){res.writeHead(404);res.end();return;}
    let data=await readFile(file);
    if(name==='/agent-prompt.txt')data=Buffer.from(data.toString().replaceAll('{{SHRINE_SITE_URL}}',siteURL.href.replace(/\/$/,'')));
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,process.env.SHRINE_HOST||'127.0.0.1',()=>console.log('FLOP Shrine: '+siteURL.href));
