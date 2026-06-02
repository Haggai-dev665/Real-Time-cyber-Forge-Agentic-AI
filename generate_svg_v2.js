const fs = require('fs');

function rect(cx, cy, w, h, textLines, cls="box", rx=8) {
    let yStart = cy - ((textLines.length - 1) * 10);
    let texts = textLines.map((t, i) => `<text x="${cx}" y="${yStart + (i * 20)}" class="text ${i===0?'text-bold':''}">${t}</text>`).join('\n');
    return `<rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="${rx}" class="${cls}" />\n${texts}`;
}

function diamond(cx, cy, w, h, textLines) {
    let pts = `${cx},${cy - h/2} ${cx + w/2},${cy} ${cx},${cy + h/2} ${cx - w/2},${cy}`;
    let yStart = cy - ((textLines.length - 1) * 10);
    let texts = textLines.map((t, i) => `<text x="${cx}" y="${yStart + (i * 20)}" class="text text-bold">${t}</text>`).join('\n');
    return `<polygon points="${pts}" class="diamond" />\n${texts}`;
}

function line(pathStr, label="", lX=0, lY=0, arrow=true) {
    let marker = arrow ? ' marker-end="url(#arrow)"' : '';
    let route = `<path d="${pathStr}" class="conn"${marker} />`;
    if (label) {
        let width = label.length * 7.5;
        let rx = lX - width/2;
        route += `\n<rect x="${rx}" y="${lY - 11}" width="${width}" height="22" class="bg-white" />`;
        route += `\n<text x="${lX}" y="${lY + 1}" class="label">${label}</text>`;
    }
    return route;
}

let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" width="100%" height="100%" style="background-color: #ffffff; max-width: 1000px; margin: 0 auto; display: block;">
<defs>
    <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
    </marker>
    <style>
        * { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        .conn { stroke: #333; stroke-width: 2.5px; fill: none; }
        .box { fill: #f0f4f8; stroke: #0277bd; stroke-width: 2px; }
        .diamond { fill: #fff3e0; stroke: #f57c00; stroke-width: 2px; }
        .alert-box { fill: #ffebee; stroke: #d32f2f; stroke-width: 3px; }
        .ai-box { fill: #f3e5f5; stroke: #6a1b9a; stroke-width: 2px; }
        .db-box { fill: #e8f5e9; stroke: #2e7d32; stroke-width: 2px; }
        .text { font-size: 15px; text-anchor: middle; fill: #111; dominant-baseline: middle; }
        .text-bold { font-weight: 700; font-size: 15px; }
        .label { font-size: 13px; font-weight: 700; text-anchor: middle; fill: #b71c1c; dominant-baseline: middle; }
        .bg-white { fill: #ffffff; rx: 4px; }
        .title { font-size: 24px; font-weight: 800; text-anchor: middle; fill: #111; }
    </style>
</defs>

<!-- Enforce white background completely -->
<rect width="100%" height="100%" fill="#ffffff" />
`;

out += `<text x="500" y="40" class="title">Advanced AI Threat Detection URL Scan Flowchart</text>\n`;

// Elements
out += rect(500, 100, 180, 50, ["User Visits URL"], "box", 25) + "\n";
out += rect(500, 190, 220, 60, ["Desktop Telemetry", "Intercepts & Submits URL"]) + "\n";

// Condition 1: Cache
out += diamond(500, 310, 160, 80, ["Is in Cache?"]) + "\n";
out += rect(200, 310, 180, 60, ["Restore Previous", "Verdict (Fast Path)"]) + "\n";

// Condition 2: False Positive
out += diamond(500, 450, 220, 80, ["On Safe List?", "(Avoid False Positives)"]) + "\n";
out += rect(200, 450, 180, 60, ["Mark Low-Risk", "Proceed Safely"]) + "\n";

// Stage 1
out += rect(500, 590, 260, 80, ["Stage 1: Initial Scan", "AI URL BERT & DGA Detect", "+ Web Scrapper DOM Fetch"]) + "\n";
out += rect(860, 590, 180, 60, ["Hugging Face Space", "Transformer Models"], "ai-box") + "\n";

// Stage 2
out += rect(500, 730, 260, 80, ["Stage 2: Deep Inspection", "IOC Extraction (RegEx)", "Behaviour & MITRE Mapping"]) + "\n";

// Stage 3
out += rect(500, 870, 260, 60, ["Stage 3: Enrichment", "Threat Intel Retrieval"]) + "\n";
out += rect(860, 870, 180, 60, ["AlienVault OTX", "Reputation API"], "db-box") + "\n";

// Condition 3: Final Analysis Risk Score Evaluation
out += diamond(500, 1010, 180, 80, ["Risk >= Threshold?"]) + "\n";

// End Actions
out += rect(200, 1010, 220, 70, ["PROTECT & ALERT", "Block/Warn User via UI"], "alert-box") + "\n";
out += rect(800, 1010, 180, 60, ["Mark Clean", "Silently Logged"]) + "\n";

out += rect(200, 1140, 220, 70, ["REPORT: Gemini AI", "Generate Explainable", "Narrative Threat Report"], "ai-box") + "\n";

out += rect(500, 1260, 240, 60, ["Appwrite Database", "Persist Alert & Telemetry"], "db-box") + "\n";
out += rect(500, 1360, 120, 40, ["Finish"], "box", 20) + "\n";


// Lines and wiring
out += line("M 500,125 L 500,160") + "\n";
out += line("M 500,220 L 500,270") + "\n";

// Cache Flow
out += line("M 420,310 L 290,310", "Yes (Cached)", 355, 300) + "\n";
out += line("M 500,350 L 500,410", "No", 500, 380) + "\n";

// Safe List Flow
out += line("M 390,450 L 290,450", "Yes (Trusted)", 340, 440) + "\n";
out += line("M 500,490 L 500,550", "No", 500, 520) + "\n";

// Stage 1 -> Hugging Face (bidirectional)
out += line("M 630,580 L 770,580") + "\n";
out += line("M 770,600 L 630,600") + "\n";

out += line("M 500,630 L 500,690") + "\n";
out += line("M 500,770 L 500,840") + "\n";

// Stage 3 -> OTX (bidirectional)
out += line("M 630,860 L 770,860") + "\n";
out += line("M 770,880 L 630,880") + "\n";

out += line("M 500,900 L 500,970") + "\n";

// Risk Evaluation Decision
out += line("M 410,1010 L 310,1010", "Yes (Malicious)", 360, 1000) + "\n";
out += line("M 590,1010 L 710,1010", "No (Clean)", 650, 1000) + "\n";

// Report flow from Malicious 
out += line("M 200,1045 L 200,1105") + "\n";
out += line("M 200,1175 L 200,1260 L 380,1260") + "\n";

// Clean flow
out += line("M 800,1040 L 800,1260 L 620,1260") + "\n";

// Long bypass from Safe & Cached directly to Appwrite Layer
out += line("M 200,340 L 200,380 L 50,380 L 50,1280 L 380,1280") + "\n"; // From Cache
out += line("M 200,480 L 200,510 L 50,510", "", 0, 0, false) + "\n"; // From Safe List merges to Highway

out += line("M 500,1290 L 500,1340") + "\n";

out += "</svg>";
fs.writeFileSync('thesis/diagrams/system_flowchart.svg', out);
