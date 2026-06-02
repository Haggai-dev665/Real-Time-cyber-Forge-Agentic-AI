# Real-Time Cyber Forge Agentic AI for Continuous Web Security Monitoring: A Systems and Methods Dissertation Draft

## Abstract
This dissertation presents the design, implementation analysis, and evaluation framework for a multi-layer cybersecurity platform called Real-Time Cyber Forge Agentic AI. The platform integrates a desktop telemetry layer, a Node.js orchestration backend, Python-based ML/AI services, and a cloud control plane for identity, persistence, and operational governance. The study is positioned within the growing demand for continuous, near-real-time threat detection in hybrid user environments where browser-mediated activity is a dominant attack surface. 

The research combines system-level software engineering inquiry with applied cybersecurity risk analysis. The literature review critically appraises the state of practice in continuous monitoring, zero trust, incident response, application security verification, and ML-assisted threat detection. Materials and methods are based on a deep code and architecture audit of the platform, standards mapping to recognized frameworks, and risk-focused interpretation of implementation decisions. Results show a technically cohesive architecture with meaningful strengths in modularity, operational visibility, and pipeline integration, while revealing high-impact security hardening gaps in route protection, secret handling, and privacy-by-design controls.

The thesis concludes that the platform is a credible applied research artifact for agentic cybersecurity operations, but that production-grade deployment requires a structured hardening roadmap: mandatory authentication and authorization enforcement, model and data governance, stronger cryptographic and key management practices, and rigorous verification protocols aligned with OWASP, NIST, and ATT&CK-informed detection engineering. Recommendations and future research directions are provided, including adversarial robustness testing, policy-driven autonomous response, and empirical benchmarking under realistic SOC workloads.

Keywords: cybersecurity, agentic AI, real-time monitoring, threat detection, zero trust, FastAPI, Tauri, Appwrite, Gemini, OWASP, NIST.

---

## Chapter 1: Introduction

### 1.1 Background to the Study and System Architecture
In recent years, the nature of cyber threats has shifted profoundly towards the application and user-session layers, where traditional perimeter-based security measures often fall short of providing continuous, adaptive protection. Against this backdrop, this research details the development, validation, and implementation of the "Real-Time Cyber Forge Agentic AI," a production-grade cybersecurity platform explicitly designed to intercept, analyze, and mitigate browser-based threats dynamically and autonomously. The foundational premise of this system is to evaluate every Uniform Resource Locator (URL) navigated by the user in real-time, operating with zero fallbacks and no offline demo modes; every single detection incorporates live probabilistic inference and deterministic systemic controls.

Unlike isolated endpoint detection tools or static web filters, the Cyber Forge platform is engineered to operate seamlessly across a sophisticated four-tier architecture. At the local perimeter, the system relies on a native macOS desktop telemetry engine built in Rust utilizing the Tauri v2 framework. This desktop application actively monitors user web activity by employing operating-system-level scripting, specifically `osascript` polling, to detect browser events across a wide array of browsers including Chrome, Safari, Firefox, Edge, Brave, and Arc. Once a URL navigation is intercepted, the Rust backend communicates over secure Inter-Process Communication (IPC) channels to a robust Node.js orchestration backend deployed on Heroku. This Express-driven control plane coordinates external data augmentation via the `webscrapper.live` API, ensuring that raw URLs are transformed into rich, analyzable data structures before they are evaluated for risk.

Crucially, this project is a direct response to the operational friction observed in modern Security Operations Centers (SOCs), where analysts are often overwhelmed by disjointed alerts and false positives. To solve this, the orchestrating Node.js backend routes the parsed web data to a highly specialized Machine Learning pipeline hosted entirely on Hugging Face Spaces. This Python and FastAPI-based microservice environment houses four independent deterministic Machine Learning classification models natively tailored to identify distinct threat categories: phishing, malware, anomalies, and web attacks. The scores from these discrete models are then synthesized and passed to an agentic reasoning engine powered by the Google Gemini 2.5 Flash API. The Gemini integration is not merely a conversational add-on; it actively reasons over the ML prediction vectors, autonomously assigning qualitative risk scores, producing natural-language threat assessments, and generating immediate actionable recommendations. This continuously learning, intelligent protective layer is then streamed directly back to a floating graphical agent interface, rendered via an Electron-style web view bounded by Tauri, placing critical security intelligence at the immediate edge of the user's workflow.

### 1.2 Statement of the Problem
The central problem addressed by this project is the critical gap in low-latency, highly accurate web-threat triage capabilities at the individual user-session level, particularly the challenge of orchestrating complex artificial intelligence services in near real-time without degrading endpoint performance. While the overarching cybersecurity community often discusses theoretical frameworks, the practical exigencies of building the Real-Time Cyber Forge system highlighted immense technical hurdles in data pipeline engineering. The implementation of the desktop application had to carefully balance the intensive demands of continuous system polling across multiple active browser tabs against the stringent memory and privacy constraints inherent to a native macOS environment. 

Furthermore, the routing of intercepted telemetric data through external APIs and into a centralized cloud orchestration layer poses significant latency and boundary enforcement challenges. The primary problem space encompasses the intricate integration of a vastly diverse technological stack. It requires securing Rust-authenticated system commands, establishing secure HTTP endpoints in a FastAPI wrapper over a Python machine learning deployment, and maintaining stateful persistence using an Appwrite Cloud v1.8.1 database instance. The system operates continuously to provide immediate, actionable threat intelligence, meaning that network instability, API rate limits, and concurrent thread management must be algorithmically handled by the central agent framework. Consequently, this study aggressively maps the engineering journey and technical validation required to harmonize these discrete technologies into an elegant, fault-tolerant, and autonomous cybersecurity sentinel, transitioning from pure academic discourse to bare-metal system architecture.

### 1.3 Research Objectives and Guiding Questions
The primary line of inquiry guiding this platform's development focuses on how a multi-layered agentic AI cybersecurity application can be effectively architected, deployed, and operationalized to guarantee continuous browser-focused threat monitoring while adhering to strict security engineering requirements. This research pivots away from internet-sourced generalizations by relentlessly interrogating the project's specific operational codebase. The core objective is to unpack the precise data flows that shepherd a user's web interaction through a Rust-based interception system, up into a cloud integration layer, through a complex Hugging Face-hosted machine learning inference engine, and back into the user’s local interface as a structured alert.

Specific objectives driving this architectural dissertation include an exhaustive mapping of the end-to-end system workflow, capturing the nuances of the asynchronous task queues and evidence storage mechanisms housed within the Appwrite database. The research seeks to critically evaluate how the platform operationalizes browser telemetry, juxtaposing the deterministic classification properties of its four Python ML models against the probabilistic, deep-reasoning capabilities of the Gemini 2.5 LLM. Furthermore, this study intends to document the tangible technical risks associated with the current codebase—such as unauthorized route access potentials, IPC payload vulnerabilities, and API secret exposures—while defining a concrete, source-level roadmap to advance the platform toward rigorous, production-grade security standards.

### 1.4 Significance, Scope, and Limitations of the Implementation
The true significance of the Real-Time Cyber Forge Agentic AI project is rooted in its uncompromising commitment to a live, end-to-end operational philosophy. All classifications processed by the system utilize the authentic machine learning endpoints and live large language models, stripping away the artificial, hard-coded safety nets often characteristic of academic demonstration wares. The platform acts as a tangible, living blueprint for software developers and security researchers attempting to bridge the gap between traditional full-stack web engineering—such as React and Node.js architectures—and cutting-edge operational AI pipelines. By demonstrating exactly how a decentralized application translates a local browser event into an AI-mitigated network security event, the project provides immense practical value to the field of automated threat hunting.

The scope of this thesis inherently revolves around a deep source-level architectural and implementation analysis of the Cyber Forge repository itself. The investigation is delimited to the interactions between the backend logic, the desktop Tauri application footprint, the remote Hugging Face machine learning microservices, and the user-facing integrations. However, the study acknowledges specific limitations native to the current development cycle. The evaluation relies primarily on static architectural tracing and functional system testing rather than continuous, enterprise-scale adversarial penetration testing. Since external service behaviors—such as the inner compilation dynamics of the Gemini inferences or Hugging Face server throttling—are extrapolated from client-side integration metrics, the performance claims documented are bounded by currently observable implementation traces rather than prolonged longitudinal deployment within an active Security Operations Center.

---

## Chapter 2: Literature Review

### 1.1 Introduction to the Literature Review
This chapter appraises literature and authoritative guidance relevant to the defined objectives: platform architecture, continuous monitoring, secure software verification, AI safety, and operational response. The review emphasizes practical relevance, quality of source, and identified controversy/gaps.

### 1.2 Conceptual Foundations

#### 1.2.1 Cybersecurity Risk Management and CSF 2.0
NIST CSF 2.0 defines a high-level taxonomy of cybersecurity outcomes intended for organizations of varying size and maturity (NIST, 2024a, 2024b). Its outcome-oriented orientation is useful in evaluating Cyber Forge because the platform spans govern-identify-detect-respond themes. Literature and guidance increasingly recommend cross-mapping controls and practices rather than framework monoculture, supporting interoperability in mixed technical estates.

#### 1.2.2 Incident Response as a Risk Lifecycle Function
NIST SP 800-61r3 reframes incident handling within broader risk management, emphasizing preparedness, coordination, and integration with organizational processes (Nelson et al., 2025). This aligns with platform requirements where alerting, evidence storage, and analyst workflows must be traceable and repeatable.

#### 1.2.3 Zero Trust Architecture
NIST SP 800-207 defines zero trust as a shift from implicit network trust to continuous verification based on identities, assets, and policy decisions (Rose et al., 2020). For endpoint-browser telemetry platforms, zero trust implications include strict API auth boundaries, context-aware authorization, and minimization of privileged pathways.

### 1.3 Web Application and API Security Literature

#### 1.3.1 OWASP Top 10 and Persistent AppSec Risk Categories
OWASP Top 10 continues to document recurring web security weaknesses and consensus risk areas in modern systems (OWASP, 2021). Categories particularly relevant to this platform include:
1. A01 Broken Access Control.
2. A05 Security Misconfiguration.
3. A07 Identification and Authentication Failures.
4. A09 Security Logging and Monitoring Failures.

These categories are directly applicable to route-level access enforcement, service configuration, and telemetry integrity.

#### 1.3.2 Verification Standards and Security Requirements Engineering
OWASP ASVS provides testable security requirements to normalize verification rigor and improve comparability across implementations (OWASP Foundation, 2025). ASVS requirement structuring supports practical traceability from architecture decisions to verification evidence, which is useful for this platform’s hardening roadmap.

### 1.4 Threat Intelligence and ATT&CK-Informed Detection Engineering
MITRE ATT&CK is widely used as a knowledge base of adversary tactics and techniques. The official ATT&CK STIX datasets support machine-readable operationalization, allowing detection logic and analytics pipelines to align with shared threat semantics (MITRE ATT&CK, 2025). In practice, ATT&CK-informed mapping can improve alert explainability and prioritization in multi-source pipelines.

### 1.5 AI and ML in Cybersecurity Operations

#### 1.5.1 Ensemble and Multi-Stage Inference Patterns
Contemporary applied cybersecurity systems often combine deterministic feature engineering, model ensembles, and LLM summarization/explanation layers. This staged architecture supports practical trade-offs: deterministic preprocessing for guardrails, ML for pattern classification, and LLMs for natural-language synthesis.

#### 1.5.2 LLM Safety and Factuality Controls
Google’s Gemini API guidance emphasizes iterative risk assessment, safety settings, testing, and monitoring, with explicit recognition that model outputs can be harmful or inaccurate without safeguards (Google, 2026). This literature is highly relevant where LLM outputs may influence operational decisions.

#### 1.5.3 Model Ecosystem and MLOps Interoperability
Hugging Face documentation highlights ecosystem interoperability for model definition, inference, and training workflows (Hugging Face, 2026). This supports architectures where local experimentation, cloud deployment, and model lifecycle transitions are expected.

### 1.6 Platform and Framework Literature for System Construction

#### 1.6.1 Desktop Security Architecture with Tauri
Tauri’s trust boundary model separates WebView code and privileged core code, mediated by explicit IPC capabilities and command controls (Tauri Contributors, 2025a, 2025b). This is directly relevant to endpoint security tools where browser-facing UI must not inherit unrestricted system privileges.

#### 1.6.2 API Engineering with FastAPI
FastAPI documentation emphasizes standards alignment (OpenAPI/JSON Schema), validation, and auto-documented APIs, which can improve correctness and maintainability in ML service surfaces (FastAPI Team, 2026).

#### 1.6.3 Control Plane and Data Layer with Appwrite
Appwrite provides managed authentication, database, and permission models that can serve as a centralized control plane in multi-client systems (Appwrite Team, 2026a, 2026b).

#### 1.6.4 Observability and Tracing
Datadog APM terminology and tracing concepts underline the importance of distributed traces, service/resource decomposition, and context propagation for diagnosing complex pipelines (Datadog, 2026).

### 1.7 Identified Controversies and Gaps

#### 1.7.1 AI Explainability versus Deterministic Security Guarantees
A recurring controversy is the balance between LLM-driven interpretability and deterministic safety constraints. Explanatory strength does not inherently guarantee control correctness.

#### 1.7.2 Privacy Trade-offs in Endpoint Telemetry
Literature and standards encourage security monitoring but require proportionality, data minimization, and governance. Browser URL collection may expose sensitive tokens or personal data if not sanitized.

#### 1.7.3 Standards Conformance Gap in Real Implementations
Many projects claim standards alignment at a conceptual level while diverging at route-level controls, configuration hygiene, and access boundary enforcement. This gap is central to the present study.

### 1.8 Literature Review Synthesis
The literature supports the feasibility and value of integrated, multi-layer cybersecurity platforms, but also shows that operational trustworthiness depends on rigorous implementation details: boundary control, verification discipline, privacy-by-design, and measurable observability. These findings justify the study objectives and motivate the methods in Chapter 2.

---

## Chapter 3: Materials and Methods

### 2.1 Research Framework and Design

#### 2.1.1 Study Design
This research uses an applied systems case-study design with source-level technical analysis. The artifact under study is a multi-component software system. The design combines:
1. Architecture reconstruction.
2. Static implementation analysis.
3. Standards-informed control mapping.
4. Risk and gap assessment.

#### 2.1.2 Epistemic Position
The method is pragmatic and engineering-oriented: truth claims are grounded in inspectable code, explicit configuration, and reproducible architecture traces.

### 2.2 Study Site and System Boundaries
The study site is the project repository for Real-Time Cyber Forge Agentic AI, including:
1. Backend services in Node.js/Express.
2. ML services in Python/FastAPI.
3. Desktop app stack with Tauri and browser-monitoring logic.
4. Mobile companion app code.
5. Deployment and orchestration files.

### 2.3 Materials

#### 2.3.1 Primary Materials
1. Source code and configuration files across backend, ML, and desktop modules.
2. Environment templates and deployment descriptors.
3. Existing project documentation and architecture notes.

#### 2.3.2 External Reference Materials
Authoritative standards and technical documentation were used for triangulation:
1. NIST CSF 2.0, NIST SP 800-207, NIST SP 800-61r3, NIST SP 800-53r5.
2. OWASP Top 10:2021 and OWASP ASVS 5.0.
3. MITRE ATT&CK and ATT&CK STIX data resources.
4. Tauri, FastAPI, Appwrite, Datadog, Gemini API, and Hugging Face documentation.

### 2.4 Procedures

#### 2.4.1 Architecture Extraction Procedure
1. Enumerate service modules and route entry points.
2. Trace API call chains for key workflows.
3. Identify trust boundaries and cross-layer IPC or HTTP bridges.
4. Build layer-specific and end-to-end data-flow narratives.

#### 2.4.2 Security and Control Assessment Procedure
1. Inspect middleware, auth patterns, and route protections.
2. Inspect secret handling and environment defaults.
3. Inspect telemetry persistence and data minimization behavior.
4. Map findings to OWASP and NIST categories.

#### 2.4.3 AI/ML Pipeline Assessment Procedure
1. Identify model endpoint integration and payload structure.
2. Validate fallback behavior and failure propagation strategy.
3. Assess LLM safety settings and response post-processing logic.
4. Examine reproducibility assets: requirements, datasets, and training scripts.

### 2.5 Data and Variables

#### 2.5.1 Observational Units
1. Files and symbols implementing critical security and pipeline behavior.
2. Endpoint definitions and middleware chains.
3. Configuration values and defaults.

#### 2.5.2 Analytical Variables
1. Access-control presence or absence.
2. Boundary strictness (desktop IPC and backend API trust assumptions).
3. Secret quality and key management pattern.
4. Privacy exposure of stored telemetry fields.
5. Observability depth and traceability features.

### 2.6 Statistical and Analytical Methods
This chapter uses mixed qualitative-quantitative technical analysis. The primary mode is qualitative interpretive coding of implementation evidence, with quantitative summaries where meaningful (for example, prevalence of protected versus unprotected route groups and risk-severity buckets). No inferential population statistics are claimed in this draft due case-study scope.

### 2.7 Ethical Considerations and Special Precautions
1. No destructive testing was conducted on live external systems.
2. Analysis was limited to authorized project artifacts.
3. Sensitive values found in environment templates are treated as security findings, not reproduced as operational secrets.
4. Recommendations emphasize responsible disclosure and remediation prioritization.

### 2.8 Methodological Limitations
1. Static analysis cannot fully substitute dynamic adversarial validation.
2. Third-party service internals were not independently audited.
3. Some claims in project documentation may not perfectly match current code state.

---

## Chapter 4: Results and Discussion

### 3.1 Results Overview
The implemented system demonstrates a coherent multi-layer architecture with practical threat-monitoring capabilities. Core strengths are evident in modular service separation, real-time event handling, and integrated ML/LLM risk interpretation. However, significant hardening deficits were identified in security control enforcement and privacy safeguards.

### 3.2 Architectural Results

#### 3.2.1 Layered System Composition
The codebase confirms a four-tier architecture:
1. Endpoint/Desktop telemetry layer.
2. Backend orchestration/API layer.
3. ML/LLM analysis layer.
4. Control-plane persistence and identity layer.

This structure is consistent with design goals for modularity and service specialization.

#### 3.2.2 Real-Time URL Monitoring and Scan Pipeline
Results confirm an operational URL monitoring workflow in desktop logic with periodic polling and de-duplication. The backend scan endpoint orchestrates scraping-derived context, ML scoring, and LLM explanation synthesis. This achieves functional end-to-end pipeline behavior with actionable response payloads.

#### 3.2.3 Observability and Operational State Tracking
The backend initializes tracing and metrics pipelines with Datadog instrumentation and health routes, supporting runtime visibility. This improves operational introspection and incident diagnostics.

### 3.3 Security Results

#### 3.3.1 Access Control Findings
Critical finding: key backend route groups process security-sensitive operations without mandatory authenticated context in all paths. This introduces privilege boundary weaknesses and risks unauthorized control invocation.

Interpretation against literature:
1. Aligns with OWASP A01 concerns on broken access control (OWASP, 2021).
2. Contradicts zero trust assumptions requiring explicit per-request trust evaluation (Rose et al., 2020).

#### 3.3.2 Secret and Configuration Hygiene Findings
Environment templates include weak or placeholder secret patterns and mixed model-name defaults. Secret quality controls are not consistently enforced in runtime startup validation.

Interpretation:
1. Increases exploitability window if defaults are carried to deployment.
2. Reflects common misconfiguration vectors under OWASP A05 (OWASP, 2021).

#### 3.3.3 Privacy and Data Minimization Findings
Browser-derived URLs and related telemetry are persisted for analysis and intelligence use. Sanitization and minimization controls are not comprehensively demonstrated in current implementation flows.

Interpretation:
1. Security benefits are clear for traceability and context.
2. Privacy risk rises if URLs carry identifiers, tokens, or personal context.
3. Stronger minimization and retention policy controls are required.

### 3.4 AI/ML Results

#### 3.4.1 Inference Chain Characteristics
The ML service client and orchestrated payload design confirm a two-stage approach:
1. Structured ML classification path.
2. LLM explanation path for analyst-oriented interpretation.

This architecture improves interpretability while maintaining deterministic pre-processing context.

#### 3.4.2 Safety and Fallback Behavior
ML and LLM handling includes fallback logic in some internal layers, but policy consistency across services requires improvement. LLM outputs are post-processed into risk fields and recommendations, yet robust output validation and adversarial prompt defense controls are incomplete.

Interpretation with literature:
1. Matches Gemini guidance on iterative safety testing necessity (Google, 2026).
2. Demonstrates partial but not full safety lifecycle integration.

### 3.5 Standards Mapping Results

#### 3.5.1 Alignment Areas
1. CSF-aligned detection and response intent is evident.
2. Incident-centric event handling and alerting pathways exist.
3. Observability instrumentation supports operational monitoring.

#### 3.5.2 Divergence Areas
1. Route-level access controls are inconsistently enforced.
2. Privacy-by-design implementation is under-specified.
3. Verification artifacts are not yet mapped comprehensively to ASVS requirement IDs.

### 3.6 Discussion

#### 3.6.1 What the Results Mean for the Research Questions
1. RQ1 and RQ2: Architecture and pipeline are implemented with meaningful real-time capabilities.
2. RQ3: Partial standards alignment exists, but tactical security controls lag strategic intent.
3. RQ4: Highest risks are access-control gaps, secret hygiene, and telemetry privacy exposure.
4. RQ5: A hardening roadmap is both feasible and urgent.

#### 3.6.2 Relation to Prior Studies and Standards
The platform follows modern architectural trends: service decomposition, API-based orchestration, and AI-assisted triage. However, as literature repeatedly shows, system safety is dominated by implementation discipline rather than conceptual architecture alone.

#### 3.6.3 Technical Limitations and Interpretive Boundaries
1. No full adversarial red-team campaign was executed in this draft.
2. Production workload scaling behavior was not benchmarked experimentally.
3. Model quality metrics across datasets were not independently replicated end-to-end.

### 3.7 Prioritized Findings Summary

#### 3.7.1 Critical
1. Access-control inconsistency in sensitive backend routes.
2. Secret and configuration risk if non-production defaults persist.

#### 3.7.2 High
1. Telemetry privacy exposure risk.
2. Incomplete uniform policy guardrails for AI output handling.

#### 3.7.3 Medium
1. Incomplete traceability from control objectives to formal verification tests.
2. Inconsistent documentation-to-code parity in some claims.

---

## Chapter 5: Conclusion, Recommendations, and Perspectives

### 4.1 Conclusion
Real-Time Cyber Forge Agentic AI is a substantial and credible applied cybersecurity system that demonstrates practical integration of endpoint telemetry, backend orchestration, ML scoring, and LLM-supported explanation. The architecture supports continuous web-risk monitoring and operationally useful analyst context generation.

However, the dissertation finds that security maturity is currently constrained by implementation-level trust boundary gaps, especially in access control enforcement and privacy-preserving telemetry processing. Therefore, the project is best characterized as functionally advanced but security-hardening incomplete.

### 4.2 Recommendations

#### 4.2.1 Security Engineering Recommendations
1. Enforce mandatory authentication and authorization middleware on all sensitive route groups.
2. Introduce policy-as-code checks for route protection regression prevention in CI.
3. Enforce startup-time secret quality validation and disable weak defaults.
4. Add WebSocket authentication with token validation and scoped channel authorization.

#### 4.2.2 Privacy and Data Governance Recommendations
1. Implement URL sanitization and token/query-parameter stripping before persistence.
2. Define retention classes and deletion schedules for telemetry artifacts.
3. Add role-based access and audit trails for sensitive telemetry retrieval.

#### 4.2.3 AI/ML Assurance Recommendations
1. Add adversarial prompt and jailbreak test suites for explanation endpoints.
2. Constrain output schema with strict validators and confidence thresholds.
3. Implement model and prompt versioning with reproducibility metadata.
4. Add safety acceptance criteria before deployment promotion.

#### 4.2.4 Verification and Compliance Recommendations
1. Map controls and tests to OWASP ASVS requirement identifiers.
2. Produce CSF 2.0 profile mappings and maturity target profile.
3. Map detection rules to ATT&CK techniques for explainable triage.
4. Add periodic architecture-threat modeling cycles.

### 4.3 Perspectives and Further Research
1. Quantitative benchmarking under SOC-like load and adversarial traffic.
2. Comparative study of deterministic-only versus hybrid ML+LLM triage outcomes.
3. Federated or privacy-enhancing telemetry methods for endpoint security.
4. Autonomous policy-driven containment strategies with human-in-the-loop safeguards.
5. Formal verification approaches for critical auth and authorization invariants.

---

## References (APA Style)

Appwrite Team. (2026a). Authentication. Appwrite Documentation. https://appwrite.io/docs/products/auth

Appwrite Team. (2026b). Databases. Appwrite Documentation. https://appwrite.io/docs/products/databases

Datadog. (2026). APM terms and concepts. Datadog Documentation. https://docs.datadoghq.com/tracing/glossary/

FastAPI Team. (2026). Features. FastAPI Documentation. https://fastapi.tiangolo.com/features/

Google. (2026). Safety and factuality guidance. Gemini API Documentation. https://ai.google.dev/gemini-api/docs/safety-guidance

Hugging Face. (2026). Transformers documentation. https://huggingface.co/docs/transformers/index

Joint Task Force. (2020). Security and privacy controls for information systems and organizations (NIST SP 800-53 Rev. 5). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-53r5

MITRE ATT&CK. (2025). ATT&CK STIX data. GitHub. https://github.com/mitre-attack/attack-stix-data

Nelson, A., Rekhi, S., Souppaya, M., & Scarfone, K. (2025). Incident response recommendations and considerations for cybersecurity risk management: A CSF 2.0 community profile (NIST SP 800-61 Rev. 3). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-61r3

NIST. (2024a). Cybersecurity framework 2.0 resource center. National Institute of Standards and Technology. https://www.nist.gov/cyberframework

NIST. (2024b). The NIST cybersecurity framework (CSF) 2.0 (NIST CSWP 29). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.CSWP.29

OWASP. (2021). OWASP Top 10:2021. OWASP Foundation. https://owasp.org/Top10/2021/

OWASP Foundation. (2025). OWASP Application Security Verification Standard (ASVS) v5.0.0. https://owasp.org/www-project-application-security-verification-standard/

Rose, S., Borchert, O., Mitchell, S., & Connelly, S. (2020). Zero trust architecture (NIST SP 800-207). National Institute of Standards and Technology. https://doi.org/10.6028/NIST.SP.800-207

Tauri Contributors. (2025a). Security. Tauri Documentation. https://tauri.app/security/

Tauri Contributors. (2025b). What is Tauri? Tauri Documentation. https://tauri.app/start/

---

## Appendix A: Codebase-Evidence Mapping (Selected)

### A.1 Backend and Middleware Evidence
1. Backend server setup, middleware, and route binding were analyzed from [backend/src/server.js](backend/src/server.js).
2. Agent control and scan-related endpoint behavior were analyzed from [backend/src/routes/agentRoutes.js](backend/src/routes/agentRoutes.js).
3. ML service orchestration and fallback assumptions were analyzed from [backend/src/services/mlServiceClient.js](backend/src/services/mlServiceClient.js).

### A.2 ML Service Evidence
1. FastAPI startup lifecycle and service registration were analyzed from [ml-services/main.py](ml-services/main.py).
2. Gemini safety configuration and output parsing behaviors were analyzed from [ml-services/app/services/gemini_service.py](ml-services/app/services/gemini_service.py).
3. Dependency stack and compatibility constraints were analyzed from [ml-services/requirements.txt](ml-services/requirements.txt).

### A.3 Desktop Monitoring Evidence
1. Browser URL polling and platform-specific query logic were analyzed from [desktop-app/src-tauri/src/system/url_monitor.rs](desktop-app/src-tauri/src/system/url_monitor.rs).
2. Desktop orchestration, health sync, and URL scan task creation were analyzed from [desktop-app/src/renderer/cyberforge-app.js](desktop-app/src/renderer/cyberforge-app.js).

### A.4 Deployment and Environment Evidence
1. Local multi-service orchestration was analyzed from [docker-compose.yml](docker-compose.yml).
2. Environment and secret handling assumptions were analyzed from [backend/.env.example](backend/.env.example).
3. ML settings defaults were analyzed from [ml-services/app/core/config.py](ml-services/app/core/config.py).

---

## Appendix B: Suggested Expansion Plan to Reach 130-150 Printed Pages

To extend this draft to full dissertation length while preserving quality:
1. Add a full empirical benchmarking chapter with dataset splits, confusion matrices, precision-recall curves, and latency distributions.
2. Add a dedicated threat modeling chapter using STRIDE/LINDDUN per subsystem.
3. Add a validation chapter with red-team scenario tables and reproducible test scripts.
4. Add appendices for endpoint inventory, route auth matrix, and ASVS traceability matrix.
5. Add interview/survey-based practitioner validation of analyst usefulness and workflow fit.
