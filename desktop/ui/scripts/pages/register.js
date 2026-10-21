/* pages/register.html — moved out of the page so the desktop CSP needs no 'unsafe-inline' for scripts (SEC-05). */
fitWindow('win');
forgeIllustration(document.getElementById('forge'),212);
cfWordmark(document.getElementById('word'));

document.getElementById('eye').addEventListener('click',function(){const pw=document.getElementById('pw');pw.type=pw.type==='password'?'text':'password';this.style.color=pw.type==='text'?'var(--amber-2)':'';});
document.getElementById('terms').addEventListener('click',function(){this.querySelector('.cb').classList.toggle('on');});

const pw=document.getElementById('pw'),bars=document.querySelectorAll('.strength i'),sl=document.getElementById('sl');
pw.addEventListener('input',()=>{
  const v=pw.value;let s=0;if(v.length>=8)s++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))s++;if(/\d/.test(v))s++;if(/[@$!%*?&]/.test(v))s++;
  bars.forEach((b,i)=>{b.classList.toggle('on',i<s);b.classList.toggle('good',s>=4);});
  const missing=passwordMissing(v);
  sl.textContent=missing.length?'Still needs '+missing.join(', '):'Meets the password rule';
  sl.style.color=s>=4?'var(--green)':s>=2?'var(--amber-2)':'var(--faint)';
});

const btn=document.getElementById('create');
const errEl=document.getElementById('authErr');
const original=btn.innerHTML;
function showErr(m){errEl.textContent=m;errEl.classList.add('show');}
function clearErr(){errEl.textContent='';errEl.classList.remove('show');}
function setBusy(b){btn.disabled=b;btn.innerHTML=b?'<span class="spinner sm" style="border-top-color:#1a1206;border-color:rgba(26,18,6,.3)"></span>Creating account…':original;}

/* The backend's rule (backend/src/routes/auth.js): 8+ characters, a lower- and an
   upper-case letter, a digit, and one of @ $ ! % * ? & — other symbols such as #
   or . do not count, and the first character must be a letter, digit or one of them. */
const PASSWORD_SYMBOLS='@$!%*?&';
function passwordMissing(v){
  const need=[];
  if(!v||v.length<8)need.push('at least 8 characters');
  if(!/[a-z]/.test(v||''))need.push('a lower-case letter');
  if(!/[A-Z]/.test(v||''))need.push('an upper-case letter');
  if(!/\d/.test(v||''))need.push('a number');
  if(!/[@$!%*?&]/.test(v||''))need.push('one of '+PASSWORD_SYMBOLS.split('').join(' ')+' (other symbols do not count)');
  if(v&&!/^[A-Za-z\d@$!%*?&]/.test(v))need.push('to start with a letter, a number or one of '+PASSWORD_SYMBOLS.split('').join(' '));
  return need;
}

async function createAccount(){
  const first=document.getElementById('firstName').value.trim();
  const last=document.getElementById('lastName').value.trim();
  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('pw').value;
  clearErr();
  if(!first||!last){showErr('Enter your first and last name.');return;}
  if(first.length>50||last.length>50){showErr('First and last name must each be 50 characters or fewer.');return;}
  if(!email){showErr('Enter your email.');return;}
  const missing=passwordMissing(password);
  if(missing.length){showErr('The password needs '+missing.join(', ')+'.');return;}
  if(!document.getElementById('terms').querySelector('.cb').classList.contains('on')){showErr('Please accept the Terms of Service to continue.');return;}
  setBusy(true);
  try{
    const res=await cfAuth.register(first,last,email,password);
    if(res&&res.success){
      // signed in, but the session could not be saved for the next launch: say so first
      if(res.sessionSaved===false&&res.sessionNote){ showErr(res.sessionNote+' Opening the app…'); setTimeout(function(){window.location.href='threat-overview.html';},5000); return; }
      window.location.href='threat-overview.html';return;
    }
    showErr((res&&(res.message||res.error))||'Could not create account.');
    setBusy(false);
  }catch(e){showErr((e&&e.message)?e.message:String(e));setBusy(false);}
}
btn.addEventListener('click',createAccount);

// The form is never submitted by the browser: sign-in runs from the button and Enter.
document.getElementById('form').addEventListener('submit', function (e) { e.preventDefault(); });

