const fs = require('fs');
const content = `# CHAPTER 3: MATERIALS AND METHODS

## 3.1 Introduction

This chapter explains the materials and methods used to build and evaluate the CyberForge system. It is divided into several sections. Section 3.2 shows the system architecture and explains each part. Section 3.3 describes how a typical user interacts with the system. Section 3.4 provides a class diagram of the core logic. Section 3.5 lists the hardware and software used. Finally, the rest of the chapter covers how the system was developed, how the AI agents operate together, and how the results were measured.

All diagrams are drawn using Mermaid, making them easy to view in GitHub or Obsidian.

## 3.2 System Architecture

CyberForge has five main layers:
1. **User Layer**: The user interacts with an Electron desktop app.
2. **Backend Layer**: A Node.js server hosted on Heroku orchestrates the tasks.
3. **AI/ML Layer**: A Python server on Hugging Face runs machine learning models.
4. **Agent Layer**: Specialized AI agents work together to analyze data.
5. **External Services Layer**: Services like Appwrite (database), Redis, and OTX are used.

### 3.2.1 Architecture Diagram

\`\`\`mermaid
flowchart TB
    subgraph "Layer 1 — User & Clients"
        BROWSER[Web Browser<br/>Chrome / Firefox / Edge]
        DESKTOP[Electron Desktop Client<br/>renderer + main process]
    end

    subgraph "Layer 2 — Backend<br/>Node.js / Express on Heroku"
        ORCH[Agent Orchestrator]
        ROUTES[REST API Routes]
        MLPROXY[ML Service Proxy]
        SANDBOX[Sandbox Analysis Service]
        MEMORY[Memory Service]
        APPSVC[Appwrite Service Adapter]
    end

    subgraph "Layer 3 — Inference<br/>Python FastAPI on HF Space"
        FASTAPI[FastAPI Gateway]
        TXLOADER[Transformer Model Loader]
        BERT[(URL Phishing BERT)]
        DGA[DGA Detector]
        LLMCHAIN[LLM Chain<br/>Gemini → Mistral]
    end

    subgraph "Layer 4 — Specialist Agents"
        A1[URL Classifier]
        A2[DGA Detector]
        A3[Web Scraper]
        A4[Memory Reader]
        A5[IOC Extractor]
        A6[Behavioural Analyser]
        A7[MITRE Mapper]
        A8[Threat Intel]
        AREP[Reporter]
    end

    subgraph "Layer 5 — External Services"
        APPWRITE[(Appwrite Cloud)]
        REDIS[(Redis Cache)]
        OTX[(AlienVault OTX)]
        SCRAPER[(WebScrapper.live API)]
        GEMINI[(Google Gemini API)]
    end

    BROWSER -.URL change.-> DESKTOP
    DESKTOP -->|"POST /api/orchestrator/analyze"| ROUTES
    ROUTES --> ORCH
    ORCH --> A1 & A2 & A3 & A4
    A1 --> MLPROXY
    A2 --> MLPROXY
    MLPROXY --> FASTAPI
    FASTAPI --> TXLOADER
    TXLOADER --> BERT
    TXLOADER --> DGA
    A3 --> SCRAPER
    A4 --> MEMORY
    MEMORY --> REDIS
    ORCH --> A5 & A6 & A7
    A5 --> SANDBOX
    A6 --> SANDBOX
    A7 --> SANDBOX
    ORCH --> A8
    A8 --> OTX
    ORCH --> AREP
    AREP --> FASTAPI
    FASTAPI --> LLMCHAIN
    LLMCHAIN --> GEMINI
    AREP --> APPSVC
    APPSVC --> APPWRITE
    AREP -->|report| DESKTOP
\`\`\`

### 3.2.2 Component Description

- **Desktop Client:** An Electron app that monitors what website the user visits and sends the website URL to the backend.
- **Backend:** A Node.js server that receives URLs, runs the agents, and stores the results. Let's call it the Orchestrator.
- **FastAPI Gateway:** A Python AI server hosted on Hugging Face that runs machine learning. It uses Gemini for detailed reports.
- **Specialist Agents:** There are 8 separate logic paths (agents) that handle different tasks: URL Classifier, DGA Detector, Web Scraper, Memory Reader, IOC Extractor, Behavioural Analyser, MITRE Mapper, and Threat Intel.
- **External Services:** Databases and APIs such as Appwrite for storage, and AlienVault OTX for threat checking.

## 3.3 Use Case: Analyzing a Website

### 3.3.1 Use Case Diagram

\`\`\`mermaid
graph LR
    USER((User))
    UC1([Open a URL in browser])
    UC2([Receive feedback])
    UC3([Inspect detailed report])
    DESKTOP((Desktop Client))
    ORCH((Orchestrator))
    APP((Appwrite Database))

    USER --- UC1
    USER --- UC2
    USER --- UC3

    UC1 -.triggers.-> DESKTOP
    DESKTOP -.notifies.-> ORCH
    ORCH -.persists.-> APP
    UC2 --- DESKTOP
    UC3 --- DESKTOP
\`\`\`

### 3.3.2 Main Success Scenario

1. The user visits a new website.
2. The desktop app sees the URL and sends it to the backend.
3. The backend runs 4 initial agents: URL Classifier, DGA Detector, Web Scraper, and Memory Reader.
4. Once initial data is gathered, 3 more agents run: IOC Extractor, Behavioural Analyser, and MITRE Mapper.
5. The Threat Intel agent checks the data against known databases.
6. The Reporter agent creates a final score and generates an explanation using Gemini AI.
7. The result is saved to the Appwrite database.
8. The desktop app shows a warning to the user if the website is bad.

## 3.4 Class Diagram

Below is the class diagram showing how the backend software is structured.

### 3.4.1 Class Structure

\`\`\`mermaid
classDiagram
    class AgentOrchestrator {
        +analyze(url, sessionId, userId)
    }

    class BaseAgent {
        <<abstract>>
        +execute(ctx)
    }

    class URLClassifierAgent
    class DGADetectorAgent
    class WebScraperAgent
    class MemoryAgent
    class IOCExtractorAgent
    class BehaviouralAgent
    class MITREMapperAgent
    class ThreatIntelAgent
    class ReporterAgent

    AgentOrchestrator o-- BaseAgent : runs
    BaseAgent <|-- URLClassifierAgent
    BaseAgent <|-- DGADetectorAgent
    BaseAgent <|-- WebScraperAgent
    BaseAgent <|-- MemoryAgent
    BaseAgent <|-- IOCExtractorAgent
    BaseAgent <|-- BehaviouralAgent
    BaseAgent <|-- MITREMapperAgent
    BaseAgent <|-- ThreatIntelAgent
    BaseAgent <|-- ReporterAgent
\`\`\`

## 3.5 Materials

### Hardware and Software
- **Operating System:** macOS for development, Heroku for the backend server, Hugging Face for the Python AI models.
- **Languages:** Node.js, Electron (javascript/typescript) and Python.
- **Key Services:** Appwrite (Database), Redis (Caching), AlienVault OTX (Threat intel), Google Gemini AI.

## 3.6 Methodology

### 3.6.1 Development Approach
We built CyberForge over several iterations. First, we got the servers running. Next, we created a simple pipeline. Then, we expanded this into 8 distinct agents and added AI text generation. Every stage was tested before adding the next.

### 3.6.2 Calibration
The risk scoring logic was fine-tuned by testing it on a mix of safe sites (like Google) and known malicious sites. The weights and alerts were adjusted until the system accurately caught the bad sites without annoying the user with false alarms.

## 3.7 The Eight-Agent Pipeline

The tasks are broken down into stages:

### Stage 1
- **URL Classifier:** Uses an AI model to detect if the URL looks like phishing.
- **DGA Detector:** Checks if the domain name looks randomly generated by malware.
- **Web Scraper:** Downloads the website content.
- **Memory Reader:** Checks if this website was analyzed recently.

### Stage 2 & 3
- **IOC Extractor:** Finds bad IP addresses or links in the scraped content.
- **Behavioural Analyser:** Checks for dangerous javascript or network requests.
- **MITRE Mapper:** Maps bad behavior to known hacking strategies.
- **Threat Intel:** Confirms findings with external security servers.

Finally, the **Reporter Agent** aggregates all this data and writes the final risk summary.
`;
fs.writeFileSync('thesis/chapter_3_materials_and_methods.md', content);
