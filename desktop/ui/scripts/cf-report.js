/* ===========================================================================
   cf-report.js — shared branded PDF report builder for CyberForge.

   Any page can call:
       CFReport.export({ title, subtitle, id, classification, sections })
   to render a clean, light, print-only document and open the OS print dialog
   (Save as PDF in the Tauri webview). The report carries:
     • the CyberForge logo file as a header mark,
     • the CyberForge mark as a faint full-page watermark (repeats per page),
     • the signed-in user's name/email in the header ("Prepared for"),
     • detailed, justified paragraphs and clear section explanations.

   Section schema (shared with reports.html):
     { h, type:'p',     body:'paragraph text (\\n\\n splits paragraphs)' }
     { h, type:'stats', body:[[value,label,color?], ...] }
     { h, type:'finds', body:[[sev,title,desc], ...] }   sev: crit|high|med|info
     { h, type:'kv',    body:[[key,value], ...] }
     { h, type:'qa',    body:[[question,answer], ...] }   answer may be markdown-ish
   =========================================================================== */
(function () {
  var STYLE_ID = 'cf-print-style';
  var ROOT_ID = 'cfPrintRoot';
  // Paths are resolved relative to the PAGE (ui/pages/*), so ../assets is correct.
  var LOGO = '../assets/cyber-forge-logo.svg';
  var MARK = '../assets/cyber-forge-mark.svg';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var SEV = {
    crit: '#c2283b', high: '#b87800', med: '#0a72b8', info: '#5a6b82',
    critical: '#c2283b', medium: '#0a72b8', low: '#5a6b82'
  };
  function sevColor(s) { return SEV[String(s || 'info').toLowerCase()] || '#5a6b82'; }

  /* lightweight markdown → safe HTML for AI answers in a 'qa' section */
  function mdLite(raw) {
    var lines = esc(raw).split('\n'), out = [], inList = false;
    var inline = function (t) {
      return t.replace(/`([^`]+)`/g, '<code>$1</code>')
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    };
    var closeList = function () { if (inList) { out.push('</ul>'); inList = false; } };
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      var h = ln.match(/^#{1,6}\s+(.+)$/);
      if (h) { closeList(); out.push('<p class="qa-h">' + inline(h[1]) + '</p>'); continue; }
      var li = ln.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
      if (li) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + inline(li[1]) + '</li>'); continue; }
      closeList();
      if (ln.trim() === '') continue;
      out.push('<p>' + inline(ln) + '</p>');
    }
    closeList();
    return out.join('');
  }

  function paragraphs(body) {
    return String(body || '').split(/\n\n+/).map(function (p) {
      return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function sectionHtml(s) {
    var inner = '<h2>' + esc(s.h) + '</h2>';
    if (s.type === 'p') {
      inner += paragraphs(s.body);
    } else if (s.type === 'stats') {
      inner += '<table class="pr-metrics"><tr>' + (s.body || []).map(function (d) {
        return '<td><span class="pm-v"' + (d[2] ? ' style="color:' + d[2] + '"' : '') + '>' +
          esc(d[0]) + '</span><span class="pm-l">' + esc(d[1]) + '</span></td>';
      }).join('') + '</tr></table>';
    } else if (s.type === 'finds') {
      inner += (s.body || []).map(function (f) {
        var col = sevColor(f[0]);
        return '<div class="pr-find"><span class="pf-dot" style="background:' + col + '"></span>' +
          '<div class="pf-body"><b>' + esc(f[1]) + '</b><p>' + esc(f[2]) + '</p></div>' +
          '<span class="pf-sev" style="color:' + col + ';border-color:' + col + '">' +
          esc(String(f[0]).toUpperCase()) + '</span></div>';
      }).join('');
    } else if (s.type === 'kv') {
      inner += '<table class="pr-kv">' + (s.body || []).map(function (r) {
        return '<tr><td class="k">' + esc(r[0]) + '</td><td class="v">' + esc(r[1]) + '</td></tr>';
      }).join('') + '</table>';
    } else if (s.type === 'qa') {
      inner += (s.body || []).map(function (q) {
        return '<div class="pr-qa"><div class="pr-q">' + esc(q[0]) + '</div>' +
          '<div class="pr-a">' + mdLite(q[1]) + '</div></div>';
      }).join('');
    }
    return '<section class="pr-sec">' + inner + '</section>';
  }

  function headerHtml(opts, user) {
    var name = (user && (user.name || ((user.firstName || '') + ' ' + (user.lastName || '')).trim())) || '';
    var email = (user && user.email) || '';
    var who = name || email || 'Authenticated user';
    var preparedFor = name && email ? (esc(name) + ' &lt;' + esc(email) + '&gt;') : esc(who);
    var now = new Date();
    return '' +
      '<div class="pr-head">' +
        '<img class="pr-logo" src="' + LOGO + '" alt="CyberForge" />' +
        '<div class="pr-head-c">' +
          '<div class="pr-class">' + esc(opts.classification || 'CONFIDENTIAL · TLP:AMBER') + '</div>' +
          '<h1>' + esc(opts.title || 'CyberForge Report') + '</h1>' +
          '<div class="pr-sub">' + esc(opts.subtitle || 'CyberForge — AI Security Console') + '</div>' +
        '</div>' +
        '<div class="pr-id">' +
          '<div><span>Report</span>' + esc(opts.id || ('RPT-' + String(Date.now()).slice(-6))) + '</div>' +
          '<div><span>Date</span>' + esc(now.toISOString().slice(0, 10)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pr-who">' +
        '<div><span>Prepared for</span>' + preparedFor + '</div>' +
        '<div><span>Generated</span>' + esc(now.toLocaleString()) + '</div>' +
      '</div>';
  }

  function buildHtml(opts, user) {
    var secs = (opts.sections || []).map(sectionHtml).join('');
    return '' +
      '<img class="pr-watermark" src="' + MARK + '" alt="" aria-hidden="true" />' +
      headerHtml(opts, user) +
      secs +
      '<div class="pr-foot">' +
        'CyberForge — AI Security Console · ' + esc(opts.classification || 'CONFIDENTIAL · TLP:AMBER') +
        ' · This report was generated from live system data and is intended for the named recipient only.' +
      '</div>';
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#' + ROOT_ID + '{display:none}',
      '@media print{',
      '  @page{margin:16mm 15mm}',
      '  html,body{height:auto !important;background:#fff !important;overflow:visible !important}',
      // hide every app surface
      '  .stage,.window,.agent-fab,.cf-agent-frame,.cf-fab,#topbar,.topbar,.statusbar,.sidebar,.main-head,.kpi-row,.rp-grid,.ai-grid{display:none !important}',
      '  body>*:not(#' + ROOT_ID + '){display:none !important}',
      '  #' + ROOT_ID + '{display:block !important;position:relative;color:#16181d;',
      '    font-family:\'Space Grotesk\',system-ui,Arial,sans-serif;line-height:1.62;font-size:12px}',
      '  #' + ROOT_ID + ' *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}',
      // watermark — fixed so it repeats on every printed page
      '  #' + ROOT_ID + ' .pr-watermark{position:fixed;top:50%;left:50%;width:62%;',
      '    transform:translate(-50%,-50%) rotate(-18deg);opacity:0.05;z-index:0;pointer-events:none}',
      '  #' + ROOT_ID + ' .pr-head,#' + ROOT_ID + ' .pr-who,#' + ROOT_ID + ' .pr-sec,#' + ROOT_ID + ' .pr-foot{position:relative;z-index:1}',
      // header
      '  #' + ROOT_ID + ' .pr-head{display:flex;align-items:flex-start;gap:16px;border-bottom:2px solid #1F1A1B;padding-bottom:12px}',
      '  #' + ROOT_ID + ' .pr-logo{width:168px;height:auto;flex:none}',
      '  #' + ROOT_ID + ' .pr-head-c{flex:1;padding-top:4px}',
      '  #' + ROOT_ID + ' .pr-class{font-family:\'JetBrains Mono\',monospace;font-size:8.5px;letter-spacing:1.5px;color:#b87800;font-weight:700}',
      '  #' + ROOT_ID + ' h1{font-size:22px;font-weight:700;margin:3px 0 2px;color:#1F1A1B}',
      '  #' + ROOT_ID + ' .pr-sub{font-size:11px;color:#666}',
      '  #' + ROOT_ID + ' .pr-id{text-align:right;font-family:\'JetBrains Mono\',monospace;font-size:10px;color:#333}',
      '  #' + ROOT_ID + ' .pr-id span{display:block;font-size:7.5px;letter-spacing:1px;color:#999;text-transform:uppercase}',
      '  #' + ROOT_ID + ' .pr-id div{margin-bottom:6px}',
      // "prepared for" band
      '  #' + ROOT_ID + ' .pr-who{display:flex;justify-content:space-between;gap:16px;margin:10px 0 4px;',
      '    padding:8px 12px;background:#faf6ee;border:1px solid #ecdfc7;border-radius:6px;font-size:10.5px;color:#4a4030}',
      '  #' + ROOT_ID + ' .pr-who span{display:block;font-size:7.5px;letter-spacing:1px;color:#a08a5e;text-transform:uppercase;font-family:\'JetBrains Mono\',monospace}',
      // sections
      '  #' + ROOT_ID + ' .pr-sec{margin-top:18px;break-inside:avoid}',
      '  #' + ROOT_ID + ' h2{font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:#9a6a00;',
      '    border-bottom:1px solid #e3d9c5;padding-bottom:4px;margin:0 0 9px;font-family:\'JetBrains Mono\',monospace}',
      '  #' + ROOT_ID + ' p{font-size:12px;color:#2c2c2c;margin:0 0 9px;text-align:justify}',
      '  #' + ROOT_ID + ' .pr-metrics{width:100%;border-collapse:collapse;margin:4px 0 6px}',
      '  #' + ROOT_ID + ' .pr-metrics td{border:1px solid #d9d2c4;padding:10px;text-align:center;font-family:\'JetBrains Mono\',monospace}',
      '  #' + ROOT_ID + ' .pm-v{font-size:19px;font-weight:700;display:block;color:#1F1A1B}',
      '  #' + ROOT_ID + ' .pm-l{font-size:7.5px;letter-spacing:1px;color:#888;text-transform:uppercase}',
      '  #' + ROOT_ID + ' .pr-find{display:flex;gap:9px;padding:8px 0;border-bottom:1px solid #eee;break-inside:avoid}',
      '  #' + ROOT_ID + ' .pf-dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex:none}',
      '  #' + ROOT_ID + ' .pf-body{flex:1}',
      '  #' + ROOT_ID + ' .pr-find b{font-size:12px;color:#1F1A1B}',
      '  #' + ROOT_ID + ' .pr-find p{font-size:10.5px;color:#555;margin:2px 0 0;text-align:left}',
      '  #' + ROOT_ID + ' .pf-sev{margin-left:auto;font-size:8px;font-weight:700;font-family:\'JetBrains Mono\',monospace;',
      '    padding:2px 7px;border:1px solid;border-radius:4px;height:fit-content}',
      '  #' + ROOT_ID + ' .pr-kv{width:100%;border-collapse:collapse}',
      '  #' + ROOT_ID + ' .pr-kv td{border:1px solid #e6e0d4;padding:7px 10px;font-size:11px}',
      '  #' + ROOT_ID + ' .pr-kv .k{width:34%;color:#777;font-family:\'JetBrains Mono\',monospace;font-size:10px}',
      // Q&A transcript
      '  #' + ROOT_ID + ' .pr-qa{margin:0 0 12px;break-inside:avoid}',
      '  #' + ROOT_ID + ' .pr-q{font-weight:700;color:#1F1A1B;font-size:12px;margin-bottom:3px}',
      '  #' + ROOT_ID + ' .pr-q::before{content:"Q  ";color:#b87800;font-family:\'JetBrains Mono\',monospace}',
      '  #' + ROOT_ID + ' .pr-a{padding-left:14px;border-left:2px solid #ecdfc7}',
      '  #' + ROOT_ID + ' .pr-a .qa-h{font-weight:700;color:#9a6a00;margin:6px 0 2px}',
      '  #' + ROOT_ID + ' .pr-a code{font-family:\'JetBrains Mono\',monospace;font-size:10.5px;background:#f3efe6;padding:1px 4px;border-radius:3px}',
      '  #' + ROOT_ID + ' ul{margin:4px 0 8px 2px;padding-left:16px}',
      '  #' + ROOT_ID + ' li{font-size:11px;color:#333;margin:2px 0}',
      // footer
      '  #' + ROOT_ID + ' .pr-foot{margin-top:22px;border-top:1px solid #ddd;padding-top:9px;',
      '    font-size:8.5px;color:#999;font-family:\'JetBrains Mono\',monospace;text-align:center}',
      '}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = STYLE_ID; st.textContent = css;
    document.head.appendChild(st);
  }

  function root() {
    var el = document.getElementById(ROOT_ID);
    if (!el) { el = document.createElement('div'); el.id = ROOT_ID; document.body.appendChild(el); }
    return el;
  }

  function getUser() {
    try {
      if (window.CF && CF.invoke) {
        return CF.invoke('auth_get_user').then(function (r) { return (r && r.user) || null; })
          .catch(function () { return null; });
      }
    } catch (e) {}
    return Promise.resolve(null);
  }

  function doExport(opts) {
    injectStyle();
    return getUser().then(function (user) {
      root().innerHTML = buildHtml(opts || {}, user);
      // let images/layout settle, then open the print dialog (Save as PDF)
      return new Promise(function (resolve) {
        setTimeout(function () {
          try { window.print(); } catch (e) {}
          resolve(true);
        }, 250);
      });
    });
  }

  window.CFReport = { export: doExport, sevColor: sevColor };
})();
