const fs = require('fs');

function encodeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rect(cx, cy, w, h, textLines, bgColor="#e3f2fd", strokeColor="#1e88e5", sw=2, rx=8) {
    let texts = textLines.map((t, i) => {
        let fw = i === 0 ? "bold" : "normal";
        let fsLine = i === 0 ? "14" : "13";
        let yStart = cy - ((textLines.length - 1) * 9);
        return `<text x="${cx}" y="${yStart + (i * 18)}" fill="#111111" font-family="Arial, sans-serif" font-size="${fsLine}" font-weight="${fw}" text-anchor="middle" dominant-baseline="middle">${encodeXml(t)}</text>`;
    }).join('\\n');
    
    return `<rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${bgColor}" stroke="${strokeColor}" stroke-width="${sw}" />\\n${texts}`;
}

function diamond(cx, cy, w, h, textLines) {
    let pts = \`${cx},${cy - h/2} ${cx + w/2},${cy} ${cx},${cy + h/2} ${cx - w/2},${cy}\`;
    let texts = textLines.map((t, i) => {
        let yStart = cy - ((textLines.length - 1) * 9);
        return `<text x="${cx}" y="${yStart + (i * 18)}" fill="#111111" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${encodeXml(t)}</text>`;
    }).join('\\n');
    return `<polygon points="${pts}" fill="#fff8e1" stroke="#f57f17" stroke-width="2" />\\n${texts}`;
}

function line(pathStr, label="", lX=0, lY=0, arrow=true) {
    let marker = arrow ? ' marker-end="url(#arrow)"' : '';
    let route = `<path d="${pathStr}" fill="none" stroke="#424242" stroke-width="2"${marker} />`;
    if (label) {
        let width = label.length * 8;
        let rx = lX - width/2;
        route += `\\n<rect x="${rx}" y="${lY - 10}" width="${width}" height="20" fill="#ffffff" rx="4" />`;
        route += `\\n<text x="${lX}" y="${lY + 1}" fill="#b71c1c" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${encodeXml(label)}</text>`;
    }
    return route;
}

let out = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1700" width="100%" height="100%" style="background-color: #ffffff;">\\n\` +
\`<defs>\\n\` +
\`    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">\\n\` +
\`        <polygon points="0 0, 10 3.5, 0 7" fill="#424242" />\\n\` +
\`    </marker>\\n\` +
\`</defs>\\n\\n\` +
\`<rect x="0" y="0" width="100%" height="100%" fill="#ffffff" />\\n\\n\`;

// Helper functions variables
const BOX_DEF = ["#e3f2fd", "#1e88e5"];
const AI_DEF = ["#f3e5f5", "#8e24aa"];
const DB_DEF = ["#e8f5e9", "#43a047"];
const ALERT_DEF = ["#ffebee", "#e53935", 3];
const USER_DEF = ["#e0f7fa", "#00838f"];

// Level 1: Desktop Telemetry
out += rect(600, 60, 220, 50, ["User Browses Web"], ...USER_DEF, 25) + "\\n";
out += rect(600, 140, 260, 60, ["Tauri Desktop App", "Intercepts URL Activity"], ...BOX_DEF) + "\\n";
out += line("M 600,85 L 600,110") + "\\n";

// Level 2: Backend Orchestrator & Fast Checks
out += rect(600, 230, 280, 60, ["Node.js Orchestrator API", "Receives Telemetry"], ...BOX_DEF) + "\\n";
out += line("M 600,170 L 600,200") + "\\n";

out += diamond(600, 330, 180, 80, ["URL in Cache?"]) + "\\n";
out += line("M 600,260 L 600,290") + "\\n";

out += rect(250, 330, 180, 60, ["Return Cached", "Verdict immediately"], ...DB_DEF) + "\\n";
out += line("M 510,330 L 340,330", "Yes", 425, 320) + "\\n";

out += diamond(600, 450, 240, 80, ["Is on Global Allowlist?", "(e.g. Google, GitHub)"]) + "\\n";
out += line("M 600,370 L 600,410", "No", 600, 390) + "\\n";

out += rect(250, 450, 220, 60, ["Mark URL Safe", "Avoids False Positive Noise"], ...BOX_DEF) + "\\n";
out += line("M 480,450 L 360,450", "Yes", 420, 440) + "\\n";

// Level 3: Stage 1 Agents (Parallel)
out += rect(600, 560, 300, 50, ["DAG Pipeline Execution Triggered"], ...BOX_DEF) + "\\n";
out += line("M 600,490 L 600,535", "No", 600, 515) + "\\n";

out += rect(300, 650, 200, 60, ["URL Phishing BERT", "FastAPI Hugging Face Space"], ...AI_DEF) + "\\n";
out += rect(600, 650, 200, 60, ["DGA Detector", "Entropy Heuristics"], ...BOX_DEF) + "\\n";
out += rect(900, 650, 200, 60, ["Web Scraper", "Headless Scrapper.live"], ...DB_DEF) + "\\n";

out += line("M 600,585 L 600,620") + "\\n";
out += line("M 580,585 L 300,620") + "\\n";
out += line("M 620,585 L 900,620") + "\\n";

// Level 4: Stage 2 & 3 Agents (Deep Content Analysis)
out += rect(600, 780, 320, 60, ["Wait for DOM Scrape Result", "Send to Deep Content Analyzers"], ...BOX_DEF) + "\\n";
out += line("M 300,680 L 550,750") + "\\n";
out += line("M 600,680 L 600,750") + "\\n";
out += line("M 900,680 L 650,750") + "\\n";

out += rect(300, 880, 200, 60, ["IOC Extractor", "(IPs, Hashes, Links)"], ...BOX_DEF) + "\\n";
out += rect(600, 880, 200, 60, ["Behavioral Analyzer", "Examine JS / Network"], ...BOX_DEF) + "\\n";
out += rect(900, 880, 200, 60, ["MITRE TTP Mapper", "Align to Cyber Kill Chain"], ...BOX_DEF) + "\\n";

out += line("M 600,810 L 600,850") + "\\n";
out += line("M 580,810 L 300,850") + "\\n";
out += line("M 620,810 L 900,850") + "\\n";

// Level 5: Threat Intel Enrichment
out += rect(600, 1000, 280, 60, ["AlienVault OTX Enrichment", "Correlate Extracted IOCs"], ...DB_DEF) + "\\n";
out += line("M 300,910 L 550,970") + "\\n";
out += line("M 600,910 L 600,970") + "\\n";
out += line("M 900,910 L 650,970") + "\\n";

// Final Aggregation
out += rect(600, 1120, 280, 60, ["Aggregate Scores & Findings", "(Weighting Algorithm)"], ...BOX_DEF) + "\\n";
out += line("M 600,1030 L 600,1090") + "\\n";

// Threat Evaluation Decision
out += diamond(600, 1240, 220, 80, ["Verdict Threshold:", "Risk Score >= 0.35?"]) + "\\n";
out += line("M 600,1150 L 600,1200") + "\\n";

// Threat Flow (Protect and Report)
out += rect(300, 1360, 240, 70, ["Trigger UI Alert!", "Notify user instantly/protects"], ...ALERT_DEF) + "\\n";
out += line("M 490,1240 L 300,1240 L 300,1325", "Yes (Threat Found)", 395, 1230) + "\\n";

out += rect(300, 1480, 280, 70, ["Gemini 2.5 / LLM Chain", "Generate Explainable Narrative"], ...AI_DEF) + "\\n";
out += line("M 300,1395 L 300,1445") + "\\n";

// Clean Flow
out += rect(900, 1360, 240, 60, ["Mark URL Safe", "Seamless browsing experience"], ...DB_DEF) + "\\n";
out += line("M 710,1240 L 900,1240 L 900,1330", "No (Clean / Safe)", 805, 1230) + "\\n";

// Connect to Persist
out += rect(600, 1620, 280, 60, ["Save Alert Data to Appwrite", "Update Redis Cache"], ...DB_DEF) + "\\n";

// Downlines to finish
out += line("M 300,1515 L 300,1620 L 460,1620") + "\\n"; // From LLM 
out += line("M 900,1390 L 900,1620 L 740,1620") + "\\n"; // From Safe Flow

// Downlines from early exits directly to save
// Cache downline
out += line("M 160,330 L 50,330 L 50,1640 L 460,1640", "", 0, 0, false) + "\\n";
// False positive avoid downline
out += line("M 140,450 L 50,450", "", 0, 0, false) + "\\n";

out += "</svg>";
fs.writeFileSync('thesis/diagrams/system_flowchart.svg', out);
