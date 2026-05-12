# CHAPTER 1: INTRODUCTION

## 1.1 Background to the Study

The volume, sophistication, and economic impact of cyber-attacks have grown almost monotonically since the early 2000s, with the World Wide Web emerging as the single largest threat surface for both individuals and organisations. The expansion of cloud services, the ubiquity of consumer browsers, and the proliferation of single-page web applications have moved the perimeter of the modern enterprise away from the network firewall and onto the rendering engine of the end-user's browser tab. Within this shifting landscape, phishing, drive-by downloads, credential harvesting kits, malicious advertising, and supply-chain compromises consistently rank among the highest-impact and most-prevalent classes of incident reported by national CERTs and industry threat-intelligence groups. Traditional signature-based defences, modelled on the antivirus paradigm of the 1990s, are increasingly unable to keep pace with adversaries who routinely generate novel domains, polymorphic payloads, and short-lived infrastructure precisely to evade hash- and rule-based detection (Sommer & Paxson, 2010).

The cyber-security research community responded to this acceleration first with statistical machine learning and, more recently, with deep learning. Buczak and Guven (2016) survey more than a hundred publications applying classical machine-learning methods to intrusion detection, malware classification, and phishing identification, and observe that while results in controlled laboratory settings are encouraging, real-world deployment remains constrained by problems of label noise, distribution shift, and explainability. Le et al. (2018) demonstrated with their URLNet architecture that character-level and word-level convolutional networks could substantially out-perform handcrafted feature engineering for malicious URL detection, and Sahingoz et al. (2019) showed similar gains for phishing detection on the basis of URL string features alone. The introduction of the Transformer architecture by Vaswani et al. (2017) and the subsequent pre-training paradigm popularised by BERT (Devlin et al., 2019) made it routine to repurpose large language models for security tasks, including URL classification, log triage, and source-code vulnerability detection. The publication of large open-weight models on community platforms such as Hugging Face has made these capabilities available to small research teams and independent practitioners for the first time.

In parallel with the rise of deep learning, a second shift has been taking place in the way artificial intelligence systems are deployed. Where early machine-learning systems were typically monolithic classifiers wrapped in a single API endpoint, the current generation of systems is more often a collaboration between specialised software *agents* that each have a narrow role, an internal state, and the ability to invoke external tools (Russell & Norvig, 2020; Wooldridge, 2009). Recent work on large-language-model agents — including the ReAct framework (Yao et al., 2023) and the generative-agent simulations of Park et al. (2023) — has demonstrated that decomposing a complex reasoning task into a graph of cooperating agents, each backed by a focused prompt and a defined toolset, can produce verdicts that are both more accurate and more auditable than a single end-to-end model. Within the security domain specifically, this *agentic* perspective is appealing because the analyst's decision process is already naturally decomposable: a human analyst evaluating a suspicious URL will consult reputation feeds, parse the page DOM, look up indicators of compromise (IOCs), map observed behaviours to a known framework such as MITRE ATT&CK (Strom et al., 2018), and only then formulate a verdict.

A third trend, also relevant to the present work, is the move away from single-platform tooling. The modern user is rarely confined to one device — the same person browses on a desktop, consumes content on a phone, and may be administering cloud services from a laptop terminal — yet the threat-intelligence services that protect them are usually siloed by platform and by vendor. Cross-platform synchronisation of verdicts, indicators, and policy is now widely regarded as a basic requirement for any serious deployment (Apruzzese et al., 2023, referencing operational lessons from large enterprise SOC environments), but is rarely available in tooling accessible to research teams or to academic projects.

The present study, **CyberForge**, was conceived against this backdrop. CyberForge is a multi-platform agentic-AI cyber-security ecosystem developed as the subject of this thesis. It comprises an Electron-based desktop client, a Node.js / Express back-end deployed to a Heroku PaaS instance, a Python FastAPI service hosted on Hugging Face Spaces that wraps both scikit-learn classifiers and Transformer pipelines, and an Appwrite back-end-as-a-service that provides authentication and persistence. The principal scientific contribution of the system is an *eight-agent orchestrator* that decomposes the analysis of a single browsed URL into eight specialised agents — a Transformer-based URL classifier, a Shannon-entropy domain-generation-algorithm (DGA) detector, a web scraper that captures the request/response cycle, a memory agent, an indicator-of-compromise extractor, a behavioural-pattern analyser, a MITRE-ATT&CK mapper, and a threat-intelligence enricher — arranged in a three-stage directed acyclic graph (DAG) and orchestrated by a dedicated reporter agent. A persistent memory layer, backed by Redis for low-latency caching and Pinecone (with ChromaDB as a fallback) for similarity search over historical observations, enables the system to retain context across browsing sessions. A fallback chain — Google Gemini → Mistral-7B-Instruct via the Hugging Face Inference API → a deterministic heuristic — preserves the analytic narrative even when commercial LLM access is unavailable. The complete system has been deployed and live tested against real URLs throughout the development cycle.

## 1.2 Statement of the Problem

Despite the considerable academic literature on machine learning for cyber-security and despite the commercial maturity of products such as Endpoint Detection and Response (EDR) platforms, three persistent problems continue to constrain the practical utility of AI-based threat detection for ordinary users and for small organisations.

**First**, single-model approaches to URL and content classification are prone to high false-positive rates. Early empirical work in the present project found that a hand-tuned heuristic risk-score formula was systematically returning a "medium" risk verdict for every URL evaluated — including benign sites such as `google.com` and `github.com` — because of an additive baseline offset of `+0.5` in the score-normalisation step. That defect is illustrative of a broader phenomenon: models trained on synthetic or imbalanced data tend to inherit biases that are not detectable until deployment, and the consequence is a fatigue-inducing volume of alerts that desensitises users to genuine threats (Sommer & Paxson, 2010).

**Second**, the *explainability* gap between an AI-generated verdict and the reasoning a security analyst would use to justify that verdict is rarely closed in current tooling. A single classifier might output a probability that a URL is malicious, but it cannot, on its own, enumerate the indicators of compromise present on the page, map observed JavaScript activity to a MITRE technique, or correlate the domain with prior threat-intelligence reports. The analyst, or the end-user, is therefore left with a number rather than a narrative.

**Third**, there is no widely deployed open architecture that fans a single browser event out across a fleet of specialised analysers, persists the consolidated result, learns from prior visits, and surfaces the result on the user's desktop and on their mobile device simultaneously. Commercial Security Orchestration, Automation and Response (SOAR) platforms approach this requirement at the enterprise scale, but they are inaccessible, in both price and complexity, to the academic-research and small-team contexts in which this thesis is situated.

CyberForge has been built to address these three problems concurrently: it replaces the monolithic classifier with an eight-agent ensemble, it generates a structured analytic report in which each agent's contribution is independently auditable, and it synchronises that report across the desktop client, the cloud back-end, and the persistent memory store.

## 1.3 Research Questions

### 1.3.1 General Research Question

How can a multi-agent artificial-intelligence system, organised as a directed acyclic graph of specialised analysers, be designed and implemented to provide real-time, explainable, cross-platform threat intelligence on the URLs and web resources a user encounters while browsing?

### 1.3.2 Specific Research Questions

1. How can the analytic task of evaluating a single browsed URL be decomposed into a set of cooperating specialist agents, and what is the minimum useful agent set required to produce a defensible verdict?
2. How can a Transformer-based URL classifier, a behavioural-pattern analyser, an IOC extractor, a MITRE-ATT&CK mapper, and a threat-intelligence enricher be integrated within a single pipeline so that their findings reinforce, rather than contradict, one another?
3. What aggregation strategy minimises false-positive rates while still ensuring that a single high-confidence malicious indicator triggers escalation?
4. How can a memory layer carry context across browsing sessions to enable longitudinal observations such as "this domain has been visited three times this week, with two prior medium-risk verdicts"?
5. How can a fallback chain of language models — proprietary, open-weight, and deterministic — preserve the system's narrative-explanation capability under conditions of variable LLM availability?
6. How can the consolidated analytic verdict be persisted in a back-end-as-a-service so that the same evidence is available from desktop, mobile, and dashboard contexts?

## 1.4 Objectives of the Study

### 1.4.1 General Objective

To design, implement, deploy, and empirically evaluate a multi-platform agentic-AI cyber-security ecosystem in which an eight-agent orchestrator performs real-time, explainable analysis of every URL a user encounters while browsing, with results persisted in a cloud back-end and surfaced concurrently on the user's desktop client.

### 1.4.2 Specific Objectives

1. To design a three-stage DAG-based multi-agent orchestrator and implement it as a Node.js service.
2. To integrate, by way of a Python FastAPI gateway, a pretrained BERT-based URL classifier (`elftsdmr/malware-url-detect`), an entropy-based DGA detector, and a Mistral-7B Large Language Model accessed through the Hugging Face Inference API.
3. To design and implement an evidence-locker pipeline that performs IOC extraction from page content using ten regular-expression patterns, maps detected signals to MITRE-ATT&CK techniques using a curated 20-technique signal catalogue, and persists the consolidated record to Appwrite.
4. To design and implement a fallback chain of language models, ordered as Google Gemini → Mistral-7B via Hugging Face Inference API → deterministic heuristic, so that explanatory narrative is preserved under variable LLM availability.
5. To design and implement a memory layer that combines an in-process domain history map, a Redis-backed cache, and an optional Pinecone or ChromaDB vector store, and to use that layer to influence subsequent verdicts.
6. To design an Electron-based desktop client that triggers the orchestrator on every browser-detected URL change, visualises per-agent status in a floating panel, and renders the consolidated report in a dedicated dashboard screen.

## 1.5 Significance of the Study

The significance of this study is threefold.

**Academically**, the project contributes a concrete reference implementation of a multi-agent web-threat-analysis system that combines techniques from machine learning (Transformer-based classification), heuristic engineering (entropy-based DGA detection), information retrieval (regular-expression-based IOC extraction), and threat-intelligence enrichment (OTX integration). The system is organised in such a way that any one component may be replaced independently, providing a substrate for future comparative studies. It also makes available, as an open codebase, a working example of how language-model fallback chains may be engineered for security applications — a question that has received attention in commentary but has been treated only sparingly in the peer-reviewed literature.

**Practically**, the system corrects a class of false-positive defects that are widespread in heuristic risk-scoring systems. During development, a single change to the scoring formula reduced the false-positive rate on a curated test set of common benign URLs from one hundred per cent (every URL flagged as at least "medium" risk) to zero per cent, while preserving the system's ability to detect known phishing patterns with 99.83 % confidence on the Transformer URL classifier.

**Industrially**, the chosen technology stack — Heroku PaaS, Hugging Face Spaces, Appwrite back-end-as-a-service — is accessible to small research teams and independent practitioners. The deployment described in Chapter 3 has been demonstrated to run within the constraints of free-tier and student-tier offerings, lowering the barrier to entry for student-led security research.

## 1.6 Scope of the Study

The scope of this study is bounded as follows.

The system addresses **web-based threats** — phishing URLs, malicious domains, suspicious page content, and behavioural indicators observable from the user's perspective — and does *not* address binary malware detonation, kernel-level rootkit detection, lateral-movement detection within an internal network, or any class of attack that requires privileged access to network infrastructure or to operating-system internals. The sandbox component performs *static* analysis only; it does not execute uploaded files in an isolated virtual machine.

The system relies on **English-language datasets and threat-intelligence feeds**. The MITRE-ATT&CK technique catalogue is consumed in English; the threat-intelligence enrichment relies on AlienVault OTX, which publishes pulses in English; and the LLM components have been evaluated only with English-language prompts.

The deployment described is bounded to **publicly accessible PaaS and serverless platforms** — specifically Heroku for the back-end, Hugging Face Spaces for the model gateway, and Appwrite Cloud for persistence. The system has not been adapted for air-gapped or on-premises operation.

Finally, this thesis evaluates the system in terms of **architectural correctness, false-positive reduction on a curated test corpus, and end-to-end latency**. Comparative benchmarking against commercial EDR products is outside the scope of this work.

## 1.7 Definition of Key Terms

- **Agent (software).** An autonomous computational unit that perceives an input, executes a task using its tools and internal state, and produces a structured output. In this thesis, an agent is a JavaScript class implementing a single specialised analytic function within the eight-agent orchestrator (Wooldridge, 2009).
- **Agentic AI.** A class of artificial-intelligence system in which one or more specialised agents cooperate, possibly under the direction of a coordinator, to accomplish a task that none of them could complete alone (Russell & Norvig, 2020; Yao et al., 2023).
- **Appwrite.** An open-source back-end-as-a-service platform providing authentication, document storage, and serverless functions. CyberForge uses Appwrite Cloud for user accounts, agent registration, scan-task persistence, and alert storage.
- **BERT.** *Bidirectional Encoder Representations from Transformers* — a pretrained Transformer architecture for natural-language understanding (Devlin et al., 2019). In CyberForge, a domain-adapted BERT model is used to classify URL strings.
- **DAG (Directed Acyclic Graph).** A graph in which edges have direction and no cycle exists. Used in this thesis to describe the orchestrator's stage structure, in which each stage may depend on outputs of an earlier stage.
- **DGA (Domain Generation Algorithm).** A class of algorithms used by malware families to generate large numbers of pseudo-random domain names for command-and-control rendezvous (Antonakakis et al., 2012).
- **Evidence Locker.** A persistent store of analytic records produced by the orchestrator. In CyberForge it consists of an in-process ring buffer mirrored to the Appwrite `alerts` collection.
- **HuggingFace Spaces.** A Platform-as-a-Service offering for hosting machine-learning demonstrations and APIs, accessed by CyberForge for both model inference (locally loaded Transformer pipelines) and remote inference (the Hugging Face Inference API).
- **IOC (Indicator of Compromise).** A piece of forensic data that suggests the presence of a security incident — for example an IP address, a domain, a file hash, or a CVE identifier.
- **LLM (Large Language Model).** A neural network with billions of parameters trained on large text corpora and capable of generating natural-language responses to prompts (Brown et al., 2020).
- **MITRE ATT&CK.** A globally accessible knowledge base of adversary tactics and techniques based on real-world observations, maintained by the MITRE Corporation (Strom et al., 2018).
- **Orchestrator.** In CyberForge, the back-end service responsible for dispatching agents through the three-stage DAG, aggregating their outputs, escalating verdicts, and persisting the consolidated report.
- **OTX (Open Threat Exchange).** AlienVault's open threat-intelligence sharing platform, used by CyberForge as a source of reputation lookups for extracted IOCs.
- **Sandbox.** In a security context, an isolated environment for analysing potentially malicious content. In CyberForge, the term refers to the user-facing screen at which static analytic results — verdict, IOCs, MITRE chain, behavioural timeline — are surfaced.
- **Transformer.** The neural-network architecture introduced by Vaswani et al. (2017), foundational to BERT and to subsequent generations of language model.
- **Vector Database.** A specialised database optimised for high-dimensional similarity search over learned embeddings (Pinecone and ChromaDB are used in this work).

## 1.8 Arrangement of Chapters

This thesis is organised into six chapters.

**Chapter 1 (the present chapter)** introduces the problem, articulates the research questions and objectives, and establishes the scope of the work.

**Chapter 2** surveys the relevant literature, including the evolution of web threats, the role of machine learning in intrusion detection, the specific contribution of Transformer-based models to URL classification, the state of the art in DGA detection, the MITRE-ATT&CK framework, multi-agent systems, the integration of large language models into security pipelines, and prior work on cross-platform security architectures. The chapter closes with an explicit statement of the research gaps that the present study addresses.

**Chapter 3** documents the materials and methods used in the study. It presents the overall system architecture, an annotated use-case description of the canonical "user browses a URL" interaction, a class diagram of the orchestrator subsystem, the experimental setup, and the chosen evaluation methodology. Each subsystem — the Electron client, the Express back-end, the FastAPI/Hugging Face Spaces gateway, the Appwrite persistence layer, the Redis cache, and the (optional) vector store — is described in sufficient detail to allow replication.

**Chapter 4** presents the implementation in detail, walking through the orchestrator, the memory layer, the eight specialist agents, the LLM fallback chain, and the desktop and mobile clients.

**Chapter 5** reports the results of the experimental evaluation, including measurements of end-to-end latency, false-positive rate on the curated test corpus, agent-level latency breakdown, and qualitative comparisons against representative commercial alternatives.

**Chapter 6** discusses the implications of the results, identifies limitations, and proposes directions for future work, including dynamic file detonation, federated cross-tenant threat sharing, and the integration of reinforcement learning into the verdict-escalation logic.

---

### References cited in this chapter

Apruzzese, G., Anderson, H. S., Dambra, S., Freeman, D., Pierazzi, F., & Roundy, K. (2023). "Real Attackers Don't Compute Gradients": Bridging the Gap Between Adversarial ML Research and Practice. *IEEE Conference on Secure and Trustworthy Machine Learning*.

Antonakakis, M., Perdisci, R., Nadji, Y., Vasiloglou, N., Abu-Nimeh, S., Lee, W., & Dagon, D. (2012). From throw-away traffic to bots: Detecting the rise of DGA-based malware. *Proceedings of the 21st USENIX Security Symposium*.

Brown, T. B., Mann, B., Ryder, N., Subbiah, M., Kaplan, J., Dhariwal, P., et al. (2020). Language models are few-shot learners. *Advances in Neural Information Processing Systems 33*.

Buczak, A. L., & Guven, E. (2016). A survey of data mining and machine learning methods for cyber security intrusion detection. *IEEE Communications Surveys & Tutorials*, 18(2), 1153–1176.

Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding. *Proceedings of NAACL-HLT 2019*, 4171–4186.

Le, H., Pham, Q., Sahoo, D., & Hoi, S. C. H. (2018). URLNet: Learning a URL representation with deep learning for malicious URL detection. *arXiv preprint arXiv:1802.03162*.

Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative Agents: Interactive Simulacra of Human Behavior. *Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology (UIST)*.

Russell, S., & Norvig, P. (2020). *Artificial Intelligence: A Modern Approach* (4th ed.). Pearson.

Sahingoz, O. K., Buber, E., Demir, O., & Diri, B. (2019). Machine learning based phishing detection from URLs. *Expert Systems with Applications*, 117, 345–357.

Sommer, R., & Paxson, V. (2010). Outside the closed world: On using machine learning for network intrusion detection. *Proceedings of the 31st IEEE Symposium on Security and Privacy*.

Strom, B. E., Applebaum, A., Miller, D. P., Nickels, K. C., Pennington, A. G., & Thomas, C. B. (2018). *MITRE ATT&CK: Design and Philosophy*. MITRE Technical Report.

Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is all you need. *Advances in Neural Information Processing Systems 30*.

Wooldridge, M. (2009). *An Introduction to MultiAgent Systems* (2nd ed.). John Wiley & Sons.

Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2023). ReAct: Synergizing reasoning and acting in language models. *Proceedings of the 11th International Conference on Learning Representations (ICLR)*.
