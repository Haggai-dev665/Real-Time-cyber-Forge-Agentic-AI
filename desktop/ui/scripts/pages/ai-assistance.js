/* pages/ai-assistance.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
buildHeader({status:'ASSISTANT',cta:'New Chat'});
buildSidebar('assistant');
buildFooter({items:[{txt:'assistant: no answer yet',cls:'sb-amber',id:'sbEngine'}]});
fitWindow('win');

const chat=document.getElementById('chat');
const botAv='<span class="av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/></svg></span>';
const userAv='<span class="av"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg></span>';

// Quotes too: mdToHtml puts link addresses from model text inside href="…" (SEC-05)
function escHtml(s){return CF.esc(s);}
function cfInvoke(cmd,args){ try{ if(window.CF&&CF.invoke) return CF.invoke(cmd,args||{}); }catch(e){} return Promise.reject(new Error('no tauri')); }

function addUser(text){
  const m=document.createElement('div');m.className='msg user';
  m.innerHTML=userAv+'<div class="bubble">'+text+'</div>';chat.appendChild(m);chat.scrollTop=chat.scrollHeight;
}
function addBot(html){
  const m=document.createElement('div');m.className='msg ai';
  const b=document.createElement('div');b.className='bubble';
  m.innerHTML=botAv;m.appendChild(b);b.innerHTML=html;
  chat.appendChild(m);chat.scrollTop=chat.scrollHeight;
  return b;
}

/* lightweight, safe markdown -> HTML (escape first, then format).
   Structure: consecutive text lines form one paragraph; a line that is only bold
   text, or a short "Title:" line, is a subheading; lists, headings, rules and
   code blocks as usual; the ML service's "From the reviewed sources" supplement
   is set apart as a note. */
function mdToHtml(raw){
  const lines=escHtml(raw).replace(/\r/g,'').split('\n'); const out=[]; let list=null,inCode=false,code=[],para=[];
  const inline=t=>t.replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g,'$1<i>$2</i>').replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  const closeList=()=>{ if(list){ out.push('</'+list+'>'); list=null; } };
  const openList=kind=>{ if(list!==kind){ closeList(); out.push('<'+kind+'>'); list=kind; } };
  const flushPara=()=>{ if(para.length){ out.push('<p>'+inline(para.join(' '))+'</p>'); para=[]; } };
  const block=html=>{ flushPara(); closeList(); out.push(html); };
  for(const raw of lines){
    const ln=raw.replace(/\s+$/,'');
    if(/^\s*```/.test(ln)){ if(inCode){ out.push('<div class="codeline">'+code.join('\n')+'</div>'); code=[]; inCode=false; } else { flushPara(); closeList(); inCode=true; } continue; }
    if(inCode){ code.push(raw); continue; }
    if(ln.trim()===''){ flushPara(); closeList(); continue; }
    const h=ln.match(/^\s*#{1,6}\s+(.+)$/); if(h){ block('<div class="md-h">'+inline(h[1])+'</div>'); continue; }
    if(/^\s*(?:-{3,}|\*{3,})\s*$/.test(ln)){ block('<hr>'); continue; }
    const note=ln.match(/^\s*\*\*From the reviewed sources:\*\*\s*(.+)$/); if(note){ block('<div class="md-note"><b>From the reviewed sources</b> '+inline(note[1])+'</div>'); continue; }
    const sub=ln.match(/^\s*\*\*([^*]{1,80}?):?\*\*:?\s*$/)||ln.match(/^\s*([A-Z][^.!?:]{1,48}):\s*$/); if(sub){ block('<div class="md-sub">'+inline(sub[1])+'</div>'); continue; }
    const ol=ln.match(/^\s*\d+[.)]\s+(.+)$/); if(ol){ flushPara(); openList('ol'); out.push('<li>'+inline(ol[1])+'</li>'); continue; }
    const li=ln.match(/^\s*[-*•]\s+(.+)$/); if(li){ flushPara(); openList('ul'); out.push('<li>'+inline(li[1])+'</li>'); continue; }
    closeList(); para.push(ln.trim());
  }
  if(inCode) out.push('<div class="codeline">'+code.join('\n')+'</div>');
  flushPara(); closeList(); return out.join('');
}

/* ============================ CHAT STORE (local, persisted) ============================ */
var CHATS_KEY='cf_ai_chats', CUR_KEY='cf_ai_cur'; // installation-local store, shared across account switches
function loadChats(){ try{ return JSON.parse(localStorage.getItem(CHATS_KEY)||'[]'); }catch(e){ return []; } }
var chats=loadChats(), currentId=localStorage.getItem(CUR_KEY)||'';
function persist(){ try{ localStorage.setItem(CHATS_KEY,JSON.stringify(chats)); localStorage.setItem(CUR_KEY,currentId); }catch(e){} }
function curChat(){ for(var i=0;i<chats.length;i++) if(chats[i].id===currentId) return chats[i]; return null; }
function newChat(){ finishTypingIfAny(); var id='c'+Date.now().toString(36);
  chats.unshift({id:id,title:'',messages:[],at:Date.now()}); currentId=id; persist();
  renderChatList(); chat.innerHTML=''; seed(); updateSuggest(); var i=document.getElementById('msgInput'); if(i)i.focus(); }
function selectChat(id){ finishTypingIfAny(); currentId=id; persist(); renderChatList(); renderMessages(); updateSuggest(); }
function deleteChat(id){ finishTypingIfAny(); chats=chats.filter(function(c){return c.id!==id;});
  if(currentId===id) currentId=chats[0]?chats[0].id:'';
  if(!chats.length){ persist(); newChat(); return; }
  persist(); renderChatList(); renderMessages(); updateSuggest(); }
function pushMsg(role,text,answer){ var c=curChat(); if(!c)return; var m={role:role,text:text,at:Date.now()};
  if(role==='ai'&&answer){ var d=(answer&&answer.data)||answer; m.engine=CF.engineOf(answer); m.references=Array.isArray(d.references)?d.references.slice(0,3):[]; m.grounding=d.grounding||null;
    if(typeof d.thinking==='string'&&d.thinking){ m.thinking=d.thinking.slice(0,4000); m.thinkingMs=+d.thinking_ms||null; } }
  c.messages.push(m);
  if(role==='user'&&!c.title) c.title=text.slice(0,42); c.at=Date.now(); persist(); renderChatList(); }
function renderChatList(){ var el=document.getElementById('chatList'); if(!el)return;
  if(!chats.length){ el.innerHTML='<div style="padding:16px;text-align:center;color:var(--faint);font-family:var(--mono);font-size:10.5px">No conversations yet</div>'; return; }
  el.innerHTML=chats.map(function(c){ var on=c.id===currentId;
    return '<div class="chatrow'+(on?' active':'')+'" data-id="'+c.id+'">'+
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>'+
      '<span class="ct">'+escHtml(c.title||'New chat')+'</span>'+
      '<span class="del" data-del="'+c.id+'" title="Delete chat"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></span></div>'; }).join('');
  el.querySelectorAll('.chatrow').forEach(function(r){ r.addEventListener('click',function(e){ if(e.target.closest('.del'))return; selectChat(r.dataset.id); }); });
  el.querySelectorAll('.del').forEach(function(d){ d.addEventListener('click',function(e){ e.stopPropagation(); deleteChat(d.dataset.del); }); });
}
function renderMessages(){ chat.innerHTML=''; var c=curChat();
  if(!c||!c.messages.length){ seed(); return; }
  c.messages.forEach(function(m){ if(m.role==='user') addUser(escHtml(m.text)); else { var b=addBot(''); b.innerHTML=mdToHtml(m.text)+CF.referenceNoteHTML(m); if(m.thinking) b.insertBefore(thoughtPanel(m.thinking,m.thinkingMs,false).el,b.firstChild); } });
  chat.scrollTop=chat.scrollHeight; }
function updateSuggest(){ var s=document.getElementById('suggest'); if(!s)return; var c=curChat(); s.style.display=(c&&c.messages.length)?'none':'flex'; }

/* ============================ MEMORY GROUNDING ============================ */
/* Pull the most relevant memories saved across the app (OTX intel, scans,
   browser intelligence, etc. — the same store the Memory page shows) and use
   them as grounding context for the model. memory_search => Tauri camelCases
   `top_k` to `topK`. */
function gatherMemory(q){
  // Pull BOTH semantic matches (relevance) AND recent memory (so listing /
  // aggregation questions like "what scans have run?" work even when the wording
  // doesn't lexically match the stored text). Merge, newest-aware, deduped.
  var pSearch=cfInvoke('memory_search',{query:q, topK:8})
    .then(function(r){ return (r&&r.data&&r.data.results)||[]; }).catch(function(){ return []; });
  var pList=cfInvoke('memory_list',{limit:80})
    .then(function(r){ return (r&&r.data)||{}; }).catch(function(){ return {}; });
  return Promise.all([pSearch,pList]).then(function(a){
    var sem=a[0]||[], listd=a[1]||{}, recent=listd.memories||[];
    var seen={}, merged=[];
    function add(m){ if(!m||!m.text) return; var k=String(m.text).slice(0,120); if(seen[k]) return; seen[k]=1;
      merged.push({text:m.text, category:m.category||m.kind||'memory', kind:m.kind, ts:m.ts, url:m.url, risk:m.risk}); }
    sem.forEach(add);           // most relevant first
    recent.forEach(add);        // then fill with recent activity (scans, reports, analyses)
    var items=merged.slice(0,20);
    items._counts={ total:(listd.total!=null?listd.total:merged.length), episodic:listd.episodic||0, semantic:listd.semantic||0, procedural:listd.procedural||0 };
    return items;
  });
}
/* The Analysis Agents' model reads at most about 2,400 characters and runs on
   a small CPU: the longer the prompt, the less time is left to answer. So the
   most relevant memories go in, each shortened, about 1,600 characters in all. */
var MAX_MEMORIES=6, MAX_MEMORY_CHARS=220, MAX_TURNS=4, MAX_TURN_CHARS=200;
function clipText(t,n){ t=String(t||'').replace(/\s+/g,' ').trim(); return t.length>n?t.slice(0,n-1)+'…':t; }

/* The assistant is a conversation first. The user's CyberForge memory goes in
   only when the message is about their security data; "hi" or "thanks" is
   answered as itself, not as a query over their scans. */
var DATA_TERMS=/\b(scan(s|ned|ning)?|threats?|alerts?|urls?|links?|sites?|websites?|domains?|ips?|hash(es)?|iocs?|malware|phish(ing)?|risks?|reports?|memor(y|ies)|history|block(ed|ing)?|protect(ed|ion)?|incidents?|findings?|devices?|agents?|intel|pulses?|otx|mitre|cves?|vulnerab\w*|attacks?|breach\w*|suspicious|infected|virus\w*|ransomware|firewall|browsing|visited)\b/i;
var ADDRESS=/https?:\/\/|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\b/i;  // a URL or a domain name
function wantsMemory(q){ q=String(q||''); return DATA_TERMS.test(q)||ADDRESS.test(q); }

/* The last couple of exchanges, so a follow-up reads as part of the conversation. */
function recentTurns(){
  var c=curChat(); if(!c||!c.messages) return [];
  return c.messages.slice(0,-1).slice(-MAX_TURNS).map(function(m){ return (m.role==='user'?'User: ':'Assistant: ')+clipText(m.text,MAX_TURN_CHARS); });
}

function buildAugmented(q, mems){
  var turns=recentTurns();
  var history=turns.length?'Earlier in this conversation:\n'+turns.join('\n')+'\n\n':'';
  if(!mems||!mems.length) return history?history+'User: '+q:q;
  var c=mems._counts||{};
  var ctx=mems.slice(0,MAX_MEMORIES).map(function(m,i){ return (i+1)+'. ['+m.category+'] '+clipText(m.text,MAX_MEMORY_CHARS); }).join('\n');
  return history+'My CyberForge memory ('+(c.total||mems.length)+' items; the most relevant shown). Use it only if it helps answer, and cite hosts, verdicts and risk scores from it; never invent scans, threats or detections:\n'+ctx+'\n\nMy question: '+q;
}
function memChipHTML(n){ return '<div class="mem-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a4 4 0 0 0-4 4 4 4 0 0 0-1 7 4 4 0 0 0 5 4 4 4 0 0 0 5-4 4 4 0 0 0-1-7 4 4 0 0 0-4-4Z"/></svg>grounded in '+n+' memor'+(n===1?'y':'ies')+'</div>'; }

/* ============================ THINKING + TYPEWRITER ============================ */
function thinkingHTML(){ return '<div class="think"><span class="eq"><i></i><i></i><i></i><i></i><i></i></span><span class="think-line"></span><span class="think-txt">Thinking…</span></div>'; }
function rotateThinking(b){ var msgs=['Reading memory…','Connecting signals…','Reasoning…','Composing reply…']; var i=0;
  var t=b.querySelector('.think-txt'); if(t)t.textContent=msgs[0];
  var iv=setInterval(function(){ i=(i+1)%msgs.length; var el=b.querySelector('.think-txt'); if(el)el.textContent=msgs[i]; },1100);
  return function(){ clearInterval(iv); }; }

var typingIv=null, typingState=null;
function typeInto(b, full, mems, fallback, onDone){
  b.innerHTML='<span class="typed"></span><span class="tcursor"></span>';
  var span=b.querySelector('.typed');
  var i=0, n=full.length, step=Math.max(1, Math.round(n/240));
  typingState={b:b, full:full, mems:mems, fallback:fallback, onDone:onDone};
  typingIv=setInterval(function(){
    i=Math.min(n, i+step+(Math.random()<0.3?1:0));
    span.textContent=full.slice(0,i);
    chat.scrollTop=chat.scrollHeight;
    if(i>=n) finishTyping();
  }, 14);
}
/* ---- threat detection from grounded memory -> Block / Protect actions ---- */
function hostOf(u){ try{ var h=(String(u).split('://')[1]||String(u)).split('/')[0]; return h.split('?')[0].replace(/^www\./,''); }catch(e){ return ''; } }
function hostFromText(t){ var m=String(t||'').match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i); return m?m[1].replace(/^www\./,''):''; }
function threatCandidate(mems){
  if(!mems||!mems.length) return null; var best=null;
  mems.forEach(function(m){
    var risk=(m.risk!=null)?+m.risk:0;
    var mal=/phishing|malicious|malware|ransomware|botnet|trojan|c2|spyware|dga/i.test(m.text||'');
    var host=m.url?hostOf(m.url):(mal?hostFromText(m.text):'');
    if(!host) return;
    var sev=Math.max(risk, mal?65:0);
    if(sev>=50 && (!best || sev>best.risk)) best={host:host, risk:sev};
  });
  return best;
}
function appendThreatActions(bubble, threat){
  // Shared Block / Protect / Allow actions (cyberforge-shared.js) so the
  // assistant, floating agent and agent core all behave identically.
  if(window.CF&&CF.threatActions){ bubble.appendChild(CF.threatActions({host:threat.host, risk:threat.risk})); chat.scrollTop=chat.scrollHeight; }
}

function finishTyping(){
  if(!typingIv) return; clearInterval(typingIv); typingIv=null;
  var s=typingState; typingState=null;
  var html=(s.mems&&s.mems.length?memChipHTML(s.mems.length):'')+mdToHtml(s.full);
  // which engine produced this answer, as reported by whoever answered (s.fallback carries the answer body)
  html+=CF.referenceNoteHTML(s.fallback);
  s.b.innerHTML=html;
  var threat=threatCandidate(s.mems); if(threat) appendThreatActions(s.b, threat);
  chat.scrollTop=chat.scrollHeight;
  busy=false;
  if(s.onDone) s.onDone();
}
function finishTypingIfAny(){ if(typingIv) finishTyping(); }

/* ============================ ASK ============================ */
const modelBadge=document.getElementById('modelBadge'), ctxModel=document.getElementById('ctxModel');
let busy=false;
function updateModel(body){ var nice=CF.engineShort(body), full=CF.engineLabel(body);
  if(modelBadge){ modelBadge.textContent=nice; modelBadge.title=full; } if(ctxModel){ ctxModel.textContent=nice; ctxModel.title=full; }
  var sb=document.getElementById('sbEngine'); if(sb) sb.textContent='assistant: '+nice; }

/* ============================ STREAMED ANSWERS ============================
   The assistant reasons first on real questions (a "Thinking" panel that fills as it
   reasons and folds to "Thought for N s"), then writes the answer, shown as it arrives.
   The final answer comes back checked: it can carry reviewed facts the stream did not. */
function el(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function thoughtPanel(text,ms,live){
  var d=el('details','thought'+(live?'':' done')); d.open=!!live;
  var sum=el('summary'); var eq=el('span','eq'); for(var i=0;i<5;i++) eq.appendChild(el('i'));
  var label=el('span','tl',live?'Thinking…':'Thought'+(ms?' for '+(ms/1000).toFixed(1)+' s':''));
  sum.appendChild(eq); sum.appendChild(label); sum.appendChild(el('span','chev','›'));
  var body=el('div','thought-body',text||'');
  d.appendChild(sum); d.appendChild(body);
  return { el:d, body:body, done:function(seconds){ d.open=false; d.classList.add('done'); label.textContent='Thought for '+seconds.toFixed(1)+' s'; } };
}
var liveStreams={};
if(window.CF&&CF.listen) CF.listen('cf-chat-stream',function(p){ var l=p&&liveStreams[p.id]; if(l) l.push(p.type,String(p.delta==null?'':p.delta)); });
function liveAnswer(b){
  b.textContent='';
  var t0=Date.now(), tAnswer=0, thinking='', text='', raf=0;
  var thought=thoughtPanel('',null,true); b.appendChild(thought.el);
  var ans=el('div','answer-live'); var cursor=el('span','tcursor'); ans.appendChild(cursor); b.appendChild(ans);
  function paint(){ raf=0; ans.innerHTML=mdToHtml(text); ans.appendChild(cursor); chat.scrollTop=chat.scrollHeight; }
  return {
    push:function(type,delta){
      if(type==='thinking'){ thinking+=delta; thought.body.textContent=thinking; thought.body.scrollTop=thought.body.scrollHeight; chat.scrollTop=chat.scrollHeight; return; }
      if(type!=='answer') return;
      if(!tAnswer){ tAnswer=Date.now(); if(thinking) thought.done((tAnswer-t0)/1000); else thought.el.remove(); }
      text+=delta; if(!raf) raf=requestAnimationFrame(paint);
    },
    finish:function(body,mems){
      if(raf) cancelAnimationFrame(raf);
      var d=(body&&body.data)||body||{};
      var final=d.response||d.answer||d.text||d.reply||text||'I couldn\'t generate a response just now. Please retry shortly.';
      var reasoning=(typeof d.thinking==='string'&&d.thinking)||thinking;
      if(reasoning){
        if(!thought.el.parentNode) b.insertBefore(thought.el,b.firstChild);
        thought.body.textContent=reasoning;
        thought.done(d.thinking_ms!=null?d.thinking_ms/1000:((tAnswer||Date.now())-t0)/1000);
      }else if(thought.el.parentNode) thought.el.remove();
      ans.className='';
      ans.innerHTML=(mems&&mems.length?memChipHTML(mems.length):'')+mdToHtml(final)+CF.referenceNoteHTML(body);
      return final;
    }
  };
}
function messageActions(bubble,q,final){
  var row=el('div','msg-actions');
  var copy=el('button',null,'Copy'); copy.type='button';
  copy.addEventListener('click',function(){ try{ navigator.clipboard.writeText(final).then(function(){ copy.textContent='Copied'; setTimeout(function(){ copy.textContent='Copy'; },1400); }); }catch(e){} });
  var again=el('button',null,'Regenerate'); again.type='button';
  again.addEventListener('click',function(){
    if(busy) return; var c=curChat(); if(c&&c.messages.length&&c.messages[c.messages.length-1].role==='ai'){ c.messages.pop(); persist(); }
    var m=bubble.closest('.msg'); if(m) m.remove(); ask(q,true);
  });
  row.appendChild(copy); row.appendChild(again); bubble.appendChild(row);
}
/* The conversation so far, as real turns (the question itself goes separately). */
function chatHistory(){
  var c=curChat(); if(!c||!c.messages) return [];
  return c.messages.slice(0,-1).slice(-6).map(function(m){ return {role:m.role==='user'?'user':'assistant', content:clipText(m.text,1500)}; });
}
function buildQuery(q, mems){
  if(!mems||!mems.length) return q;
  var c=mems._counts||{};
  var ctx=mems.slice(0,MAX_MEMORIES).map(function(m,i){ return (i+1)+'. ['+m.category+'] '+clipText(m.text,MAX_MEMORY_CHARS); }).join('\n');
  return 'My CyberForge memory ('+(c.total||mems.length)+' items; the most relevant shown). Use it only if it helps answer, and cite hosts, verdicts and risk scores from it; never invent scans, threats or detections:\n'+ctx+'\n\nMy question: '+q;
}

async function ask(q, again){
  if(busy) return; busy=true;
  finishTypingIfAny();
  if(!again){ addUser(escHtml(q)); pushMsg('user',q); updateSuggest(); }
  const b=addBot('');
  const live=liveAnswer(b);
  const id='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  try{
    const found=wantsMemory(q)?await gatherMemory(q):[];
    const mems=found.slice(0,MAX_MEMORIES); mems._counts=found._counts;  // the ones actually sent
    liveStreams[id]=live;
    let body;
    try{ body=await CF.invoke('ml_security_chat_stream',{ query:buildQuery(q,mems), history:chatHistory(), think:'auto', requestId:id }); }
    finally{ delete liveStreams[id]; }
    // the answer body goes along so the engine that produced it is shown under it
    const final=live.finish(body,mems);
    pushMsg('ai',final,body); updateModel(body);
    messageActions(b,q,final);
    var threat=threatCandidate(mems); if(threat) appendThreatActions(b, threat);
    chat.scrollTop=chat.scrollHeight;
  }catch(e){
    const why=String((e&&e.message)||e);
    const offline=/no tauri|tauri-unavailable/i.test(why);
    b.textContent= offline
      ? 'The AI service is only available inside the desktop app (Tauri bridge not found).'
      : /privacy|allow|permission|sign in/i.test(why) ? why : 'I hit an error reaching the assistant. Please retry shortly.';
  }finally{ busy=false; }
}
const input=document.getElementById('msgInput'), send=document.getElementById('sendBtn');
function submit(){ const v=input.value.trim(); if(!v)return; input.value=''; ask(v); }
send.addEventListener('click',submit);
input.addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
var nc=document.getElementById('newChatBtn'); if(nc) nc.addEventListener('click', newChat);
var cn=document.getElementById('convNew'); if(cn) cn.addEventListener('click', newChat);

/* ---- suggestions ---- */
const suggestions=[
  ['What does my recent threat intel say about the most-targeted countries?','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18"/></svg>'],
  ['Summarise the malware families and TTPs in my memory','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z"/></svg>'],
  ['How should I respond to a ransomware infection?','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m6 15 4-5 3 3 5-7"/></svg>'],
  ['Map a phishing attack to MITRE ATT&CK','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>']
];
const suggestEl=document.getElementById('suggest');
suggestEl.innerHTML=suggestions.map(s=>'<div class="schip" data-q="'+s[0].replace(/"/g,'&quot;')+'">'+s[1]+s[0]+'</div>').join('');
suggestEl.querySelectorAll('.schip').forEach(c=>c.addEventListener('click',()=>ask(c.dataset.q)));

/* ---- Generate a branded PDF SECURITY REPORT from the user's real findings ----
   (not the chat transcript): the shared CF.findingsReport engine gathers scans,
   browsing history, threat-intel, actions and risks, and the assistant explains the
   findings in depth. Rendered by CFReport as a LaTeX-style document. */
function generateSecurityReport(){
  if(!window.CFReport){ if(CF.toast)CF.toast('Report module not loaded','error'); return; }
  if(!CF.findingsReport){ if(CF.toast)CF.toast('Report agents not loaded — restart the app','error'); return; }
  var btn=document.getElementById('exportPdfBtn'); var orig=btn?btn.innerHTML:'';
  if(btn){ btn.disabled=true; btn.style.opacity='.6'; }
  if(CF.toast) CF.toast('Generating your security report — reading findings and writing it with the assistant…','ok');
  CF.findingsReport({ rangeSec: 30*86400, label:'the last 30 days', maxTokens: 2200 }).then(function(res){
    return CFReport.export({
      title:'CyberForge Security Report',
      subtitle:'Findings, risk assessment & recommendations · last 30 days',
      id:'RPT-'+String(Date.now()).slice(-6), classification:'CONFIDENTIAL · TLP:AMBER',
      sections: res.sections
    }).then(function(){
      if(CF.remember && res.data){ var d=res.data; CF.remember('Security report ('+res.label+'): '+d.histWin.length+' visits, '+d.scans.length+' scans, '+d.risks.length+' flagged risks, '+d.actions.length+' actions.',{kind:'procedural',category:'report',risk:(res.risk==='crit'?80:(res.risk==='high'?60:30))}); }
      if(CF.toast)CF.toast('Report ready — choose “Save as PDF” in the print dialog','ok');
    });
  }).catch(function(){ if(CF.toast)CF.toast('Could not generate the report — try again','error'); })
  .then(function(){ if(btn){ btn.disabled=false; btn.style.opacity=''; btn.innerHTML=orig; } });
}
var epb=document.getElementById('exportPdfBtn'); if(epb) epb.addEventListener('click',generateSecurityReport);

/* ---- live session context from cf-telemetry ---- */
(function(){
  function apply(p){ if(!p)return;
    var st=(p.status&&p.status.data)||null;
    if(st){ var be=document.getElementById('ctxBackend'); if(be)be.textContent=st.backendOk?'online':'offline';
      var th=document.getElementById('ctxThreats'); if(th)th.textContent=(st.threatCount!=null?st.threatCount:'—');
      var ls=document.getElementById('liveState'); if(ls)ls.textContent=st.backendOk?'Server online':'Server offline'; }
    var br=(p.browsers&&p.browsers.data)||null;
    if(br){ var b=document.getElementById('ctxBrowsers'); if(b)b.textContent=(br.installed||0)+' detected'; }
  }
  try{ var T=window.__TAURI__||(window.parent&&window.parent.__TAURI__);
    if(T&&T.event&&T.event.listen) T.event.listen('cf-telemetry', function(e){ apply(e.payload); });
  }catch(e){}
})();

function seed(){
  addBot('Hi — I\'m the <b>CyberForge Assistant</b>. I read your local CyberForge <b>memory</b> (threat-intel, scans, browser intelligence saved across the app) to ground every answer. Ask me about threats, malware, MITRE ATT&CK, IOCs, or incident-response playbooks.');
}

/* ============================ INIT ============================ */
renderChatList();
if(!chats.length){ newChat(); }
else { if(!curChat()) currentId=chats[0].id; renderChatList(); renderMessages(); updateSuggest(); }
