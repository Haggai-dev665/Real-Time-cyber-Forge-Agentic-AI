/* pages/login.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
fitWindow('win');
forgeIllustration(document.getElementById('forge'),236);
cfWordmark(document.getElementById('word'));

/* Already signed in (valid keychain session)? Skip the form and enter the app.
   Covers reaching this page straight from the installer or a direct link. */
if(window.cfAuth && cfAuth.available()){
  cfAuth.isAuthenticated().then(function(r){ if(r&&r.authenticated){ window.location.replace('threat-overview.html'); } }).catch(function(){});
}

document.getElementById('eye').addEventListener('click',function(){const pw=document.getElementById('pw');pw.type=pw.type==='password'?'text':'password';this.style.color=pw.type==='text'?'var(--amber-2)':'';});
document.getElementById('remember').addEventListener('click',function(){this.querySelector('.cb').classList.toggle('on');});

const btn=document.getElementById('signin');
const errEl=document.getElementById('authErr');
const original=btn.innerHTML;
function showErr(m){errEl.textContent=m;errEl.classList.add('show');}
function clearErr(){errEl.textContent='';errEl.classList.remove('show');}
function setBusy(b){btn.disabled=b;btn.innerHTML=b?'<span class="spinner sm" style="border-top-color:#1a1206;border-color:rgba(26,18,6,.3)"></span>Authenticating…':original;}

/* Enter the app after a successful sign-in. When the session could not be saved
   for the next launch, say so first: the user is signed in until the app closes. */
function enterApp(res){
  if(res&&res.sessionSaved===false&&res.sessionNote){
    showErr(res.sessionNote+' Opening the app…');
    setTimeout(function(){window.location.href='threat-overview.html';},5000);
    return;
  }
  window.location.href='threat-overview.html';
}

async function signIn(){
  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('pw').value;
  clearErr();
  if(!email||!password){showErr('Enter your work email and password.');return;}
  setBusy(true);
  try{
    const res=await cfAuth.login(email,password);
    if(res&&res.success){enterApp(res);return;}
    showErr((res&&(res.message||res.error))||'Invalid email or password.');
    setBusy(false);
  }catch(e){showErr((e&&e.message)?e.message:String(e));setBusy(false);}
}
btn.addEventListener('click',signIn);
['email','pw'].forEach(id=>document.getElementById(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();signIn();}}));

/* Google sign-in — opens the consent flow in the system browser, captures the
   code on a loopback port, exchanges it via the backend. Needs GOOGLE_CLIENT_ID
   configured on the server. */
const gbtn=document.getElementById('googleBtn');
if(gbtn) gbtn.addEventListener('click',async()=>{
  clearErr(); gbtn.style.opacity='.6'; gbtn.style.pointerEvents='none';
  try{
    const res=await cfAuth.google();
    if(res&&res.success){enterApp(res);return;}
    showErr((res&&(res.message||res.error))||'Google sign-in is not available. Configure GOOGLE_CLIENT_ID on the server.');
  }catch(e){showErr((e&&e.message)?e.message:'Google sign-in failed.');}
  gbtn.style.opacity=''; gbtn.style.pointerEvents='';
});

// The form is never submitted by the browser: sign-in runs from the button and Enter.
document.getElementById('form').addEventListener('submit', function (e) { e.preventDefault(); });

