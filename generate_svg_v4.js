const fs = require('fs');

function encodeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rect(cx, cy, w, h, textLines, cls="box", rx=8) {
    let yStart = cy - ((textLines.length - 1) * 10);
    let texts = textLines.map((t, i) => '<text x="' + cx + '" y="' + (yStart + (i * 20)) + '" class="text ' + (i===0?'text-bold':'') + '">' + encodeXml(t) + '</text>').join('\\n');
    return '<rect x="' + (cx - w/2) + '" y="' + (cy - h/2) + '" width="' + w + '" height="' + h + '" rx="' + rx + '" class="' + cls + '" />\\n' + texts;
}

function diamond(cx, cy, w, h, textLines) {
    let pts = cx + ',' + (cy - h/2) + ' ' + (cx + w/2) + ',' + cy + ' ' + cx + ',' + (cy + h/2) + ' ' + (cx - w/2) + ',' + cy;
    let yStart = cy - ((textLines.length - 1) * 10);
    let texts = textLines.map((t, i) => '<text x="' + cx + '" y="' + (yStart + (i * 20)) + '" class="text text-bold">' + encodeXml(t) + '</text>').join('\\n');
    return '<polygon points="' + pts + '" class="diamond" />\\n' + texts;
}

function line(pathStr, label="", lX=0, lY=0, arrow=true) {
    let marker = arrow ? ' marker-end="url(#arrow)"' : '';
    let route = '<path d="' + pathStr + '" class="conn"' + marker + ' />';
    if (label) {
        let width = label.length * 7.5;
        let rx = lX - width/2;
        route += '\\n<rect x="' + rx + '" y="' + (lY - 11) + '" width="' + width + '" height="22" class="bg-white" />';
        route += '\\n<text x="' + lX + '" y="' + (lY + 1) + '" class="label">' + encodeXml(label) + '</text>';
    }
    return route;
}

let out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800" width="100%" height="100%" style="background-color: #ffffff; max-width: 1200px; margin: 0 auto; display: block;">\\n' +
'<defs>\\n' +
'    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">\\n' +
'        <polygon points="0 0, 10 3.5, 0 7" fill="#333" />\\n' +
'    </marker>\\n' +
'    <style>\\n' +
'        * { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }\\n' +
'        .conn { stroke: #333; stroke-width: 2.5px; fill: none; }\\n' +
'        .box { fill: #f0f4f8; stroke: #0277bd; stroke-width: 2px; }\\n' +
'        .diamond { fill: #fff3e0; stroke: #f57c00; stroke-width: 2px; }\\n' +
'        .alert-box { fill: #ffebee; stroke: #d32f2f; stroke-width: 3px; }\\n' +
'        .ai-box { fill: #f3e5f5; stroke: #6a1b9a; stroke-width: 2px; }\\n' +
'        .db-box { fill: #e8f5e9; stroke: #2e7d32; stroke-width: 2px; }\\n' +
'        .user-box { fill: #e3f2fd; stroke: #00695c; stroke-width: 2px; }\\n' +
'        .text { font-size: 14px; text-anchor: middle; fill: #111; dominant-baseline: middle; }\\n' +
'        .text-bold { font-weight: 700; font-size: 14px; }\\n' +
'        .label { font-size: 13px; font-weight: 700; text-anchor: middle; fill: #b71c1c; dominant-baseline: middle; }\\n' +
'        .bg-white { fill: #ffffff; rx: 4px; }\\n' +
'        .title { font-size: 26px; font-weight: 800; text-anchor: middle; fill: #111; }\\n' +
'    </style>\\n' +
'</defs>\\n\\n' +
'<rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />\\n' +
'<text x="600" y="40" class="title">CyberForge Distributed Architecture &amp; Threat Analysis Pipeline</text>\\n\\n';

// Level 1: Desktop Telemetry
out += rect(600, 100, 220, 50, ["User Browses Web"], "user-box", 25) + "\\n";
out += rect(600, 180, 260, 60, ["Tauri Desktop App", "Intercepts URL Activity"]) + "\\n";
out += line("M 600,125 L 600,150") + "\\n";

// Level 2: Backend Orchestrator & Fast Checks
out += rect(600, 270, 280, 60, ["Node.js Orchestrator API", "Receives Telemetry"]) + "\\n";
out += line("M 600,210 L 600,240") + "\\n";

out += diamond(600, 370, 180, 80, ["URL in Cache?"]) + "\\n";
out += line("M 600,300 L 600,330") + "\\n";

// Cache bypass
out += rect(250, 370, 180, 60, ["Return Cached", "Verdict immediately"], "db-box") + "\\n";
out += line("M 510,370 L 340,370", "Yes", 425, 360) + "\\n";

// Safe list check
out += diamond(600, 490, 240, 80, ["Is on Global Allowlist?", "(e.g. Google, GitHub)"]) + "\\n";
out += line("M 600,410 L 600,450", "No", 600, 430) + "\\n";

// False Positive Avoidance (Safe List)
out += rect(250, 490, 220, 60, ["Mark URL Safe", "Avoids False Positive Noise"], "box") + "\\n";
out += line("M 480,490 L 360,490", "Yes", 420, 480) + "\\n";

// Level 3: Stage 1 Agents (Parallel)
out += rect(600, 600, 300, 50, ["DAG Pipeline Execution Triggered"], "box") + "\\n";
out += line("M 600,530 L 600,575", "No", 600, 555) + "\\n";

out += rect(300, 690, 200, 60, ["URL Phishing BERT", "FastAPI Hugging Face Space"], "ai-box") + "\\n";
out += rect(600, 690, 200, 60, ["DGA Detector", "Entropy Heuristics"]) + "\\n";
out += rect(900, 690, 200, 60, ["Web Scraper", "Headless Scrapper.live"]) + "\\n";

out += line("M 600,625 L 600,660") + "\\n";
out += line("M 580,625 L 300,660") + "\\n";
out += line("M 620,625 L 900,660") + "\\n";   

// Level 4: Stage 2 & 3 Agents (Deep Content Analysis)
out += rect(600, 820, 320, 60, ["Wait for DOM Scrape Result", "Send to Deep Content Analyzers"]) + "\\n";
out += line("M 300,720 L 550,790") + "\\n";
out += line("M 600,720 L 600,790") + "\\n";
out += line("M 900,720 L 650,790") + "\\n";

out += rect(300, 920, 200, 60, ["IOC Extractor", "(IPs, Hashes, Links)"]) + "\\n";
out += rect(600, 920, 200, 60, ["Behavioral Analyzer", "Examine JS / Network"]) + "\\n";
out += rect(900, 920, 200, 60, ["MITRE TTP Mapper", "Align to Cyber Kill Chain"]) + "\\n";

out += line("M 600,850 L 600,890") + "\\n";
out += line("M 580,850 L 300,890") + "\\n";
out += line("M 620,850 L 900,890") + "\\n";

// Level 5: Threat Intel Enrichment
out += rect(600, 1040, 280, 60, ["AlienVault OTX Enrichment", "Correlate Extracted IOCs"], "db-box") + "\\n";
out += line("M 300,950 L 550,1010") + "\\n";
out += line("M 600,950 L 600,1010") + "\\n";
out += line("M 900,950 L 650,1010") + "\\n";

// Final Aggregation
out += rect(600, 1160, 280, 60, ["Aggregate Scores & Findings", "(Weighting Algorithm)"], "box") + "\\n";
out += line("M 600,1070 L 600,1130") + "\\n";

// Threat Evaluation Decision
out += diamond(600, 1280, 220, 80, ["Verdict Threshold:", "Risk Score >= 0.35?"]) + "\\n";
out += line("M 600,1190 L 600,1240") + "\\n";

// Threat Flow (Protect and Report)
out += rect(300, 1400, 240, 70, ["Trigger UI Alert!", "Notify user instantly protects"], "alert-box") + "\\n";
out += line("M 490,1280 L 300,1280 L 300,1365", "Yes (Threat Found)", 395, 1270) + "\\n";

out += rect(300, 1520, 280, 70, ["Gemini 2.5 / LLM Chain", "Generate Explainable Narrative"], "ai-box") + "\\n";
out += line("M 300,1435 L 300,1485") + "\\n";

// Clean Flow
out += rect(900, 1400, 240, 60, ["Mark URL Safe", "Seamless browsing experience"], "box") + "\\n";
out += line("M 710,1280 L 900,1280 L 900,1370", "No (Clean / Safe)", 805, 1270) + "\\n";

// Connect to Persist
out += rect(600, 1660, 280, 60, ["Save Alert Data to Appwrite", "Update Redis Cache"], "db-box") + "\\n";

// Downlines to finish
out += line("M 300,1555 L 300,1660 L 460,1660") + "\\n"; // From LLM 
out += line("M 900,1430 L 900,1660 L 740,1660") + "\\n"; // From Safe Flow

// Downlines from early exits directly to save
// Cache downline
out += line("M 160,370 L 50,370 L 50,1680 L 460,1680", "", 0, 0, false) + "\\n";
// False positive avoid downline
out += line("M 140,490 L 50,490", "", 0, 0, false) + "\\n";

out += '</svg>';
fs.writeFileSync('thesis/diagrams/system_flowchart.svg', out);
