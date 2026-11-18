// Export the complete SVG frame with the already installed Chromium browser.
// No account, mock native bridge or external service is involved.
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const out=path.join(__dirname,'diagrams-v4');
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
assert(chrome,'A local Chromium browser is required');
const browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'cf-diagrams-v4-')),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket;
(async()=>{
 const endpoint=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Browser startup timeout')),30000);browser.on('error',reject);browser.stderr.on('data',d=>{const m=String(d).match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 const pending=new Map();let id=0;
 socket.onmessage=e=>{const r=JSON.parse(e.data),p=pending.get(r.id);if(p){clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},25000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});
 const target=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
 const cmd=(m,p)=>send(m,p,sessionId);
 await cmd('Page.enable');await cmd('Runtime.enable');
 const audit=[];
 for(const fig of JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'))){
  await cmd('Emulation.setDeviceMetricsOverride',{width:fig.width,height:fig.height,deviceScaleFactor:3,mobile:false});
  await cmd('Page.navigate',{url:pathToFileURL(path.join(out,fig.slug+'.html')).href});
  await new Promise(r=>setTimeout(r,200));
  const ready=await cmd('Runtime.evaluate',{expression:'document.fonts.ready.then(()=>true)',awaitPromise:true,returnByValue:true});assert(!ready.exceptionDetails);
  const measured=await cmd('Runtime.evaluate',{expression:`(()=>{const s=document.querySelector('svg');if(!s)throw Error('No SVG');return [...s.querySelectorAll('text')].map(t=>{const b=t.getBBox();return {text:t.textContent,x:b.x,y:b.y,right:b.x+b.width,bottom:b.y+b.height,font:getComputedStyle(t).fontFamily}})})()`,returnByValue:true});
  assert(!measured.exceptionDetails,JSON.stringify(measured.exceptionDetails));
  const texts=measured.result.value;const bad=texts.filter(t=>t.x<0||t.y<0||t.right>fig.width||t.bottom>fig.height);
  assert.equal(bad.length,0,fig.slug+': text outside canvas '+JSON.stringify(bad));
  const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:fig.width,height:fig.height,scale:1}});
  fs.writeFileSync(path.join(out,fig.slug+'.png'),Buffer.from(shot.data,'base64'));
  audit.push({slug:fig.slug,pixels:[fig.width*3,fig.height*3],textBounds:'passed',fonts:[...new Set(texts.map(t=>t.font))]});
 }
 fs.writeFileSync(path.join(out,'render-audit.json'),JSON.stringify(audit,null,2));
 console.log('Rendered '+audit.length+' diagrams at 3x; all text is inside the canvas.');
 await send('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(socket)socket.close();browser.kill();});
