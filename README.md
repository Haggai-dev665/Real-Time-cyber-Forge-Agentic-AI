<div align="center">

# 🛡️ CyberForge — Real‑Time Agentic AI Security

**Your own AI security operations centre — running locally on your device.**

CyberForge watches the websites your browsers visit in real time, detects phishing and
malicious pages with machine learning **and** an autonomous AI agent, and lets you block,
protect or investigate them in one click — all while your data stays on your machine.

![Threat Overview](screenshots/threat-overview.png)

</div>

---

## ✨ What it does

| | |
|---|---|
| 🔎 **Real‑time scanning** | Continuously scans the page you're actually viewing (active‑tab aware), even across multiple browsers, reading history straight from the on‑disk databases — no extension required. |
| 🧠 **Agentic AI** | An autonomous Agent Core reasons through each threat step‑by‑step and streams its thinking live; a DeepSeek‑powered assistant answers questions grounded in your local security memory. |
| 🎯 **Deep phishing detection** | Blends backend ML, URL + page‑content heuristics, an allow‑list of trusted domains, and a DeepSeek confirmation pass — and even **solves free‑host anti‑bot (`aes.js`) challenges** to see the page a normal scanner can't. |
| 🚨 **Always‑on alerts** | When a credential‑harvesting site is confirmed, an always‑on‑top popup appears **over your browser even when CyberForge is minimized**, with one‑click Block / Protect / Allow. |
| 🌍 **Live threat globe** | A real, interactive 3‑D globe of worldwide attacks streamed from AlienVault OTX — and the agent learns from it into memory. |
| 📊 **AI reports** | Generate a detailed, LaTeX‑styled PDF security report for the last 8h / 24h / 7d / 30d, written by DeepSeek from your real scans, history, intel and actions. |
| 🔒 **Real enforcement** | Block, protect or allow sites for real via the OS hosts file; manage your blocked / protected / allowed lists from Security Functions. |
| 🗃️ **Local‑first memory** | A local vector memory stores every scan, intel pulse, report and action so the assistant and reports recall your whole history — nothing is uploaded unless you choose to sync. |

> CyberForge is **local‑first**: scans, browser intelligence, memory and reports live on your
> device. There is no silent cloud harvesting.

---

## 🖼️ Screenshots

> Drop your screenshots into [`screenshots/`](screenshots/) using the filenames below and they'll
> render here. (See [Adding screenshots](#-adding-screenshots).)

### Threat Globe — live worldwide attacks (OTX)
![Threat Globe](screenshots/threat-globe.png)

### Agent Core — autonomous reasoning + terminal
![Agent Core](screenshots/agent-core.png)

### AI Assistant — DeepSeek, grounded in your memory
![AI Assistant](screenshots/ai-assistant.png)

### Reports — AI‑written, LaTeX‑styled PDF
![Reports](screenshots/reports.png)

### Security Functions — real block / protect / allow
![Security Functions](screenshots/security-functions.png)

### Real‑time threat alert (pops over the browser, even minimized)
![Threat Alert](screenshots/threat-alert.png)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Desktop app  (desktop/)         Tauri 2 · Rust + HTML/JS    │
│  • real-time active-tab scanner   • Agent Core / floating     │
│  • local vector memory            agent · threat globe        │
│  • hosts-file block/protect       • AI assistant · reports    │
│  • always-on-top threat alerts    • settings · sandbox        │
└───────────────┬───────────────────────────┬─────────────────┘
                │ Rust (reqwest, keychain)   │ DeepSeek via HF
                ▼                            ▼
┌───────────────────────────┐   ┌──────────────────────────────┐
│  Backend (backend/)        │   │  ML services (ml-services/)   │
│  Node/Express on Heroku    │   │  Python · phishing URL, DGA,  │
│  auth · threats · agents   │   │  IOC scan, enrichment         │
└───────────────────────────┘   └──────────────────────────────┘
        Mobile companion (mobile-app/) · Expo React Native + VPN capture
```

- **`desktop/`** — the flagship: a Tauri 2 app (Rust backend in `src-tauri/`, static UI in `ui/`).
- **`backend/`** — Node/Express API (auth, threat intelligence, the agent orchestrator).
- **`ml-services/`** — Python ML microservices (phishing/URL classification, DGA, IOC).
- **`mobile-app/`** — Expo React‑Native client with on‑device VPN capture + backend sync.
- **`phishing-test-sites/`** — an authorized phishing‑**simulation** lab for demonstrating detection.

---

## 🧪 How detection works

1. **Active‑tab awareness** — the scanner reads the OS foreground window to know the page you're
   actually looking at, then scans it (priority queue, never interrupts a running scan).
2. **Allow‑list** — popular, known‑good domains (Google, GitHub, Microsoft, dev.to, …) are forced
   clean so trusted sites never false‑positive.
3. **Backend + ML** — the orchestrator runs URL classification, IOC extraction and threat‑intel
   enrichment.
4. **Local reinforcement** — URL heuristics (free/abused hosting, risky TLDs, brand tokens) +
   page‑content heuristics (credential forms, brand sign‑ins, lure phrases) + a **DeepSeek**
   confirmation pass. Free‑host **anti‑bot interstitials are solved** (a from‑scratch AES‑128) so
   the scanner sees the real page.
5. **Verdict + action** — scores are blended; a confirmed phishing/malware verdict raises an
   always‑on‑top alert and offers Block / Protect / Allow, and the result is written to memory.

---

## 🚀 Getting started

### Desktop app (primary)

```bash
cd desktop
npm install
npm run dev      # live dev build
# or
npm run build    # production installers — see desktop/BUILD.md
```

Full per‑OS build, signing, first‑run and uninstall details are in **`desktop/BUILD.md`**.

### Backend + ML (optional, for cloud features)

```bash
cd backend && npm install && npm run dev
cd ml-services && pip install -r requirements.txt && python main.py
```

The desktop app works on its own (local detection, memory, hosts‑file enforcement); the backend
adds cloud threat‑intel and cross‑device sync. Connect the AI assistant by pasting a Hugging Face
token in **Settings → AI & Models** (stored locally, never committed).

---

## 🛠️ Tech stack

- **Desktop:** Tauri 2, Rust (reqwest, rusqlite, keyring, sysinfo), vanilla HTML/CSS/JS, d3‑geo.
- **AI:** DeepSeek‑V3 via Hugging Face Inference Providers; backend ML microservices.
- **Backend:** Node.js / Express (Heroku).
- **ML:** Python (URL/phishing classification, DGA detection, IOC scanning).
- **Mobile:** Expo / React Native (TypeScript).
- **Intel:** AlienVault OTX.

---

## 📂 Project structure

```
desktop/            Tauri desktop app (src-tauri = Rust, ui = frontend)
backend/            Node/Express API
ml-services/        Python ML microservices
mobile-app/         Expo React Native client
phishing-test-sites/ Authorized phishing-simulation lab (detection demos)
docs/               Documentation
```

---

## 📸 Adding screenshots

The README expects images in **`screenshots/`** with these names:
`threat-overview.png`, `threat-globe.png`, `agent-core.png`, `ai-assistant.png`,
`reports.png`, `security-functions.png`, `threat-alert.png`.

Copy your capture‑folder images into `screenshots/` using those names (or open an issue / tell
the maintainer the folder path and they'll be wired in).

---

## 🔐 Responsible use

The `phishing-test-sites/` directory contains **educational simulation** pages used to demonstrate
CyberForge's detection. They carry a visible "simulation" banner, capture only to the operator's
own store, and end on an educational debrief. Use them only on infrastructure you control, for
authorized demonstrations.

---

<div align="center">

**CyberForge — security that thinks, so you don't have to worry.**

</div>
