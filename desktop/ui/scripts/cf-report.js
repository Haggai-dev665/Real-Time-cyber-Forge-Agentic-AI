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
    } else if (s.type === 'md') {
      // AI-written markdown body (DeepSeek report sections)
      inner += '<div class="pr-md">' + mdLite(s.body) + '</div>';
    }
    return '<section class="pr-sec">' + inner + '</section>';
  }

  function headerHtml(opts, user) {
    var name = (user && (user.name || ((user.firstName || '') + ' ' + (user.lastName || '')).trim())) || '';
    var email = (user && user.email) || '';
    var who = name || email || 'Authenticated user';
    var preparedFor = name && email ? (esc(name) + ' &lt;' + esc(email) + '&gt;') : esc(who);
    var now = new Date();
    // A clean letterhead (logo + classification + report id/date) above a
    // centred LaTeX-style title block (\maketitle: title, subtitle, by-line).
    return '' +
      '<div class="pr-letterhead">' +
        '<img class="pr-logo" src="' + LOGO + '" alt="CyberForge" />' +
        '<div class="pr-lh-meta">' +
          '<div class="pr-class">' + esc(opts.classification || 'CONFIDENTIAL · TLP:AMBER') + '</div>' +
          '<div class="pr-lh-id">' + esc(opts.id || ('RPT-' + String(Date.now()).slice(-6))) + ' &middot; ' + esc(now.toISOString().slice(0, 10)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pr-titleblock">' +
        '<h1>' + esc(opts.title || 'CyberForge Report') + '</h1>' +
        (opts.subtitle ? ('<div class="pr-sub">' + esc(opts.subtitle) + '</div>') : '') +
        '<div class="pr-byline">' +
          '<span>Prepared by <b>CyberForge &mdash; AI Security Console</b></span>' +
          '<span>Prepared for <b>' + preparedFor + '</b></span>' +
          '<span>' + esc(now.toLocaleString()) + '</span>' +
        '</div>' +
      '</div>';
  }

  function buildHtml(opts, user) {
    var secs = (opts.sections || []).map(sectionHtml).join('');
    return '' +
      '<img class="pr-watermark" src="' + MARK + '" alt="" aria-hidden="true" />' +
      headerHtml(opts, user) +
      secs +
      '<div class="pr-foot">' +
        'CyberForge &mdash; AI Security Console &middot; ' + esc(opts.classification || 'CONFIDENTIAL · TLP:AMBER') +
        ' &middot; Generated from live on-device data; intended for the named recipient only.' +
      '</div>';
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#' + ROOT_ID + '{display:none}',
      '@media print{',
      '  @page{margin:20mm 18mm}',
      '  html,body{height:auto !important;background:#fff !important;overflow:visible !important}',
      // hide every app surface
      '  .stage,.window,.agent-fab,.cf-agent-frame,.cf-fab,#topbar,.topbar,.statusbar,.sidebar,.main-head,.kpi-row,.rp-grid,.ai-grid{display:none !important}',
      '  body>*:not(#' + ROOT_ID + '){display:none !important}',
      // LaTeX-style serif document (Computer/Latin Modern if present, else Georgia/Times)
      '  #' + ROOT_ID + '{display:block !important;position:relative;color:#1a1a1a;',
      '    font-family:"Latin Modern Roman","CMU Serif",Georgia,"Times New Roman",Times,serif;',
      '    font-size:11.2pt;line-height:1.55;counter-reset:cfsec}',
      '  #' + ROOT_ID + ' *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}',
      // watermark — faint logo mark, fixed so it repeats on every printed page
      '  #' + ROOT_ID + ' .pr-watermark{position:fixed;top:50%;left:50%;width:56%;',
      '    transform:translate(-50%,-50%) rotate(-20deg);opacity:0.06;z-index:0;pointer-events:none}',
      '  #' + ROOT_ID + ' .pr-letterhead,#' + ROOT_ID + ' .pr-titleblock,#' + ROOT_ID + ' .pr-sec,#' + ROOT_ID + ' .pr-foot{position:relative;z-index:1}',
      // organised letterhead
      '  #' + ROOT_ID + ' .pr-letterhead{display:flex;align-items:center;gap:14px;border-bottom:1.5pt solid #1a1a1a;padding-bottom:9px}',
      '  #' + ROOT_ID + ' .pr-logo{height:30px;width:auto;flex:none}',
      '  #' + ROOT_ID + ' .pr-lh-meta{margin-left:auto;text-align:right}',
      '  #' + ROOT_ID + ' .pr-class{font-size:8pt;letter-spacing:1.2px;color:#7a1f2b;font-weight:700;text-transform:uppercase}',
      '  #' + ROOT_ID + ' .pr-lh-id{font-size:9pt;color:#555;margin-top:3px}',
      // LaTeX \\maketitle title block
      '  #' + ROOT_ID + ' .pr-titleblock{text-align:center;margin:24px 0 20px}',
      '  #' + ROOT_ID + ' .pr-titleblock h1{font-size:23pt;font-weight:700;line-height:1.15;margin:0 0 5px}',
      '  #' + ROOT_ID + ' .pr-sub{font-style:italic;font-size:12pt;color:#444;margin-bottom:14px}',
      '  #' + ROOT_ID + ' .pr-byline{display:flex;justify-content:center;gap:24px;flex-wrap:wrap;font-size:9.5pt;color:#555;',
      '    border-top:.5pt solid #bbb;border-bottom:.5pt solid #bbb;padding:6px 0}',
      '  #' + ROOT_ID + ' .pr-byline b{color:#1a1a1a;font-weight:700}',
      // numbered sections (\\section)
      '  #' + ROOT_ID + ' .pr-sec{margin-top:15px;break-inside:avoid}',
      '  #' + ROOT_ID + ' h2{counter-increment:cfsec;font-size:13pt;font-weight:700;margin:0 0 7px;padding-bottom:2px;border-bottom:.5pt solid #ccc}',
      '  #' + ROOT_ID + ' h2::before{content:counter(cfsec) "\\2003";color:#7a1f2b}',
      // body text — justified, with LaTeX paragraph indents (not the first)
      '  #' + ROOT_ID + ' p{font-size:11.2pt;color:#222;margin:0 0 7px;text-align:justify;hyphens:auto;-webkit-hyphens:auto}',
      '  #' + ROOT_ID + ' .pr-sec>p+p,#' + ROOT_ID + ' .pr-md p+p{text-indent:1.5em}',
      // metric tabular
      '  #' + ROOT_ID + ' .pr-metrics{width:100%;border-collapse:collapse;margin:6px 0 8px}',
      '  #' + ROOT_ID + ' .pr-metrics td{border:.5pt solid #999;padding:9px;text-align:center}',
      '  #' + ROOT_ID + ' .pm-v{font-size:16pt;font-weight:700;display:block;color:#1a1a1a}',
      '  #' + ROOT_ID + ' .pm-l{font-size:7.5pt;letter-spacing:.5px;color:#666;text-transform:uppercase}',
      // findings
      '  #' + ROOT_ID + ' .pr-find{display:flex;gap:8px;padding:6px 0;border-bottom:.5pt solid #ddd;break-inside:avoid}',
      '  #' + ROOT_ID + ' .pf-dot{width:7px;height:7px;border-radius:50%;margin-top:6px;flex:none}',
      '  #' + ROOT_ID + ' .pf-body{flex:1}',
      '  #' + ROOT_ID + ' .pr-find b{font-size:11pt}',
      '  #' + ROOT_ID + ' .pr-find p{font-size:10pt;color:#444;margin:2px 0 0;text-align:left;text-indent:0}',
      '  #' + ROOT_ID + ' .pf-sev{margin-left:auto;font-size:7.5pt;font-weight:700;padding:2px 7px;border:.5pt solid;border-radius:3px;height:fit-content}',
      // key/value tabular
      '  #' + ROOT_ID + ' .pr-kv{width:100%;border-collapse:collapse}',
      '  #' + ROOT_ID + ' .pr-kv td{border:.5pt solid #ccc;padding:6px 9px;font-size:10.5pt}',
      '  #' + ROOT_ID + ' .pr-kv .k{width:34%;color:#555}',
      // Q&A
      '  #' + ROOT_ID + ' .pr-qa{margin:0 0 10px;break-inside:avoid}',
      '  #' + ROOT_ID + ' .pr-q{font-weight:700;font-size:11pt;margin-bottom:3px}',
      '  #' + ROOT_ID + ' .pr-q::before{content:"Q.\\2002";color:#7a1f2b}',
      '  #' + ROOT_ID + ' .pr-a{padding-left:13px;border-left:1.5pt solid #ddd}',
      // markdown / qa sub-headings, lists, inline code
      '  #' + ROOT_ID + ' .pr-md .qa-h,#' + ROOT_ID + ' .pr-a .qa-h{font-weight:700;font-style:italic;color:#1a1a1a;font-size:11.4pt;margin:9px 0 3px}',
      '  #' + ROOT_ID + ' code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:9.3pt;background:#f0f0f0;padding:1px 3px;border-radius:2px}',
      '  #' + ROOT_ID + ' ul{margin:4px 0 8px 0;padding-left:20px}',
      '  #' + ROOT_ID + ' li{font-size:10.8pt;color:#222;margin:3px 0;text-align:justify}',
      // footer
      '  #' + ROOT_ID + ' .pr-foot{margin-top:22px;border-top:.5pt solid #999;padding-top:7px;',
      '    font-size:8.5pt;color:#777;text-align:center;font-style:italic}',
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
