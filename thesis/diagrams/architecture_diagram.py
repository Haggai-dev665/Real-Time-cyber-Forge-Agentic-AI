"""
CyberForge System Architecture — Diagram-as-Code
=================================================

Generates the Chapter-3 architecture diagram using mingrammer/diagrams
(https://diagrams.mingrammer.com) on top of Graphviz.

Usage
-----
    pip install diagrams
    brew install graphviz          # or apt install graphviz
    python architecture_diagram.py
    # → produces cyberforge_architecture.png in the current directory

The output mirrors the layered, numbered-pipeline style of a typical
AWS reference architecture: actors on the left, the CyberForge cloud
in the centre with numbered flow steps, external services on the right.
"""

from diagrams import Diagram, Cluster, Edge

# Actors & devices
from diagrams.generic.device  import Mobile, Tablet
from diagrams.generic.os      import Windows
from diagrams.onprem.client   import User, Client

# Runtime / programming
from diagrams.programming.language import Nodejs, Python, JavaScript
from diagrams.programming.framework import React, Fastapi

# Compute & containers
from diagrams.onprem.container import Docker
from diagrams.onprem.compute   import Server

# Data stores
from diagrams.onprem.inmemory  import Redis
from diagrams.onprem.database  import Mongodb
from diagrams.onprem.queue     import Kafka

# Network
from diagrams.onprem.network   import Internet, Nginx

# ML / AI / Vector
from diagrams.onprem.mlops     import Mlflow      # generic ML-ops icon
from diagrams.onprem.analytics import Spark       # used as "Reporter" stand-in

# SaaS / third-party
from diagrams.saas.chat        import Slack
from diagrams.saas.identity    import Auth0

# Generic fallbacks (high quality glyphs)
from diagrams.generic.storage  import Storage
from diagrams.generic.compute  import Rack
from diagrams.generic.network  import Firewall, Subnet

# ─────────────────────────────────────────────────────────────────────────────
# Diagram styling
# ─────────────────────────────────────────────────────────────────────────────
GRAPH_ATTR = {
    "fontsize":   "20",
    "fontname":   "Helvetica-Bold",
    "splines":    "spline",
    "pad":        "0.6",
    "ranksep":    "1.4",
    "nodesep":    "0.6",
    "bgcolor":    "white",
    "concentrate": "false",
    "compound":   "true",
}
NODE_ATTR = {
    "fontsize": "13",
    "fontname": "Helvetica",
}
EDGE_ATTR = {
    "fontsize": "11",
    "fontname": "Helvetica",
    "color":    "#444444",
}

# Numbered step style — bright pipeline arrows like the AWS reference
def step(n, label=""):
    """Coloured, numbered edge for the main pipeline path."""
    return Edge(
        label=f" {n}  {label}".strip(),
        color="#E67E22",
        style="bold",
        penwidth="2.5",
        fontcolor="#C0392B",
        fontsize="14",
        fontname="Helvetica-Bold",
    )

# Plain edge style for secondary calls
def call(label=""):
    return Edge(label=label, color="#7F8C8D", style="dashed", fontsize="10")

# Persistence edge style
def persist(label=""):
    return Edge(label=label, color="#27AE60", style="bold", fontsize="11", fontcolor="#1E8449")

# ─────────────────────────────────────────────────────────────────────────────
# The diagram
# ─────────────────────────────────────────────────────────────────────────────
with Diagram(
    "CyberForge — Multi-Platform Agentic AI Architecture",
    filename="cyberforge_architecture",
    direction="LR",
    show=False,
    outformat="png",
    graph_attr=GRAPH_ATTR,
    node_attr=NODE_ATTR,
    edge_attr=EDGE_ATTR,
):
    # ── LEFT COLUMN: actors & user devices ──────────────────────────────
    with Cluster("Actors", graph_attr={"bgcolor": "#F4F6F7", "style": "rounded", "fontsize": "14", "fontname": "Helvetica-Bold"}):
        user     = User("End User")
        analyst  = Client("Security Analyst")

    with Cluster("User Channels", graph_attr={"bgcolor": "#FDF2E9", "style": "rounded", "fontsize": "14", "fontname": "Helvetica-Bold"}):
        web      = Internet("Web Browser")
        desktop  = Windows("Electron Desktop")
        mobile   = Mobile("Mobile (RN)")
        tablet   = Tablet("Tablet")

    # ── CENTRE COLUMN: CyberForge cloud  ────────────────────────────────
    with Cluster(
        "CyberForge Cloud  ·  Heroku PaaS + HuggingFace Spaces",
        graph_attr={"bgcolor": "#EAF2F8", "style": "rounded", "fontsize": "16", "fontname": "Helvetica-Bold", "color": "#2874A6", "penwidth": "2"},
    ):
        # Entry point
        with Cluster("API Gateway", graph_attr={"bgcolor": "#D6EAF8", "style": "rounded"}):
            gateway   = Nginx("Express API\n/api/orchestrator")
            authz     = Auth0("Auth / JWT")

        # Orchestrator
        with Cluster("Agent Orchestrator  ·  DAG Executor", graph_attr={"bgcolor": "#FCF3CF", "style": "rounded", "fontsize": "13", "fontname": "Helvetica-Bold"}):
            orchestrator = Nodejs("Orchestrator\n(node)")

        # Stage 1 — parallel
        with Cluster("Stage 1  ·  parallel", graph_attr={"bgcolor": "#FADBD8", "style": "rounded"}):
            a_url   = JavaScript("1) URL\nClassifier")
            a_dga   = JavaScript("2) DGA\nDetector")
            a_scrap = JavaScript("3) Web\nScraper")
            a_mem   = JavaScript("4) Memory\nReader")

        # Stage 2 — parallel after scraper
        with Cluster("Stage 2  ·  parallel", graph_attr={"bgcolor": "#D5F5E3", "style": "rounded"}):
            a_ioc   = JavaScript("5) IOC\nExtractor")
            a_behav = JavaScript("6) Behavioural\nAnalyser")
            a_mitre = JavaScript("7) MITRE\nMapper")

        # Stage 3 — enrichment
        with Cluster("Stage 3", graph_attr={"bgcolor": "#E8DAEF", "style": "rounded"}):
            a_intel = JavaScript("8) Threat-Intel\nEnricher")

        # Reporter
        with Cluster("Reporter  ·  aggregator", graph_attr={"bgcolor": "#FDEBD0", "style": "rounded"}):
            reporter = Spark("Reporter\nAgent")

        # Memory layer
        with Cluster("Memory Layer", graph_attr={"bgcolor": "#FDF2E9", "style": "rounded"}):
            redis   = Redis("Redis\nSession Cache")
            vec     = Storage("Pinecone / Chroma\nEmbeddings")
            domain  = Mongodb("Domain History\n(in-process Map)")

        # HuggingFace inference
        with Cluster("HuggingFace Space  ·  FastAPI", graph_attr={"bgcolor": "#D4E6F1", "style": "rounded"}):
            fastapi = Fastapi("FastAPI\nGateway")
            bert    = Mlflow("BERT\nelftsdmr/malware-url-detect")
            dga_m   = Mlflow("DGA Heuristic\n(Shannon entropy)")
            llm_chain = Python("LLM Chain\nGemini → Mistral → heuristic")

    # ── RIGHT COLUMN: external services / sinks  ────────────────────────
    with Cluster("External Services", graph_attr={"bgcolor": "#F2F4F4", "style": "rounded", "fontsize": "14", "fontname": "Helvetica-Bold"}):
        otx        = Firewall("AlienVault OTX\nThreat-Intel")
        scraper    = Subnet("WebScrapper.live\nDOM / Net / Headers")
        gemini     = Rack("Google\nGemini API")
        hf_api     = Rack("HF Inference API\nMistral-7B")

    with Cluster("Persistence", graph_attr={"bgcolor": "#FADBD8", "style": "rounded", "fontsize": "14", "fontname": "Helvetica-Bold"}):
        appwrite   = Mongodb("Appwrite Cloud\nalerts · tasks · users")
        pdfgen     = Storage("PDF Reports\n(pdfkit)")

    with Cluster("Notifications", graph_attr={"bgcolor": "#D5F5E3", "style": "rounded", "fontsize": "14", "fontname": "Helvetica-Bold"}):
        toast      = Slack("Real-Time\nToast / WS Push")

    # ── EDGES — actors to channels ───────────────────────────────────────
    user    >> Edge(color="#5D6D7E", style="bold") >> web
    user    >> Edge(color="#5D6D7E", style="bold") >> desktop
    user    >> Edge(color="#5D6D7E", style="bold") >> mobile
    analyst >> Edge(color="#5D6D7E") >> desktop
    user    >> Edge(color="#5D6D7E", style="dashed") >> tablet

    # ── NUMBERED PIPELINE — the main flow  ───────────────────────────────
    desktop      >> step(1, "URL change\n(every 5 s)") >> gateway
    gateway      >> call("authenticate") >> authz
    gateway      >> step(2, "dispatch") >> orchestrator

    # Stage 1 fan-out
    orchestrator >> step(3, "Stage 1\nfan-out") >> a_url
    orchestrator >> Edge(color="#E67E22", style="bold", penwidth="2") >> a_dga
    orchestrator >> Edge(color="#E67E22", style="bold", penwidth="2") >> a_scrap
    orchestrator >> Edge(color="#E67E22", style="bold", penwidth="2") >> a_mem

    # Stage 1 calls out to external resources
    a_url   >> step(4, "BERT") >> fastapi
    a_dga   >> Edge(color="#7F8C8D", style="dashed") >> fastapi
    a_scrap >> step(5, "scrape") >> scraper
    a_mem   >> call("read") >> redis
    a_mem   >> call() >> domain
    a_mem   >> call() >> vec

    fastapi >> call() >> bert
    fastapi >> call() >> dga_m

    # Stage 2 fan-out
    orchestrator >> step(6, "Stage 2\non scraped DOM") >> a_ioc
    orchestrator >> Edge(color="#E67E22", style="bold", penwidth="2") >> a_behav
    orchestrator >> Edge(color="#E67E22", style="bold", penwidth="2") >> a_mitre

    # Stage 3
    a_ioc        >> step(7, "extracted IOCs") >> a_intel
    a_intel      >> step(8, "enrich") >> otx

    # Reporter aggregates
    a_url   >> Edge(color="#27AE60") >> reporter
    a_dga   >> Edge(color="#27AE60") >> reporter
    a_scrap >> Edge(color="#27AE60") >> reporter
    a_mem   >> Edge(color="#27AE60") >> reporter
    a_ioc   >> Edge(color="#27AE60") >> reporter
    a_behav >> Edge(color="#27AE60") >> reporter
    a_mitre >> Edge(color="#27AE60") >> reporter
    a_intel >> Edge(color="#27AE60") >> reporter

    # Reporter → LLM chain
    reporter >> step(9, "narrative") >> llm_chain
    llm_chain >> call("primary") >> gemini
    llm_chain >> call("fallback") >> hf_api

    # Reporter → persistence
    reporter >> persist("create alert") >> appwrite
    reporter >> persist("PDF") >> pdfgen
    reporter >> persist("update memory") >> redis
    reporter >> persist() >> domain

    # Reporter → user channels
    reporter >> Edge(color="#2980B9", style="bold", penwidth="2", label=" report") >> toast
    toast    >> Edge(color="#2980B9", style="bold") >> desktop
    toast    >> Edge(color="#2980B9", style="bold") >> mobile

print("✅  cyberforge_architecture.png generated")
