# CHAPTER 2: LITERATURE REVIEW

## 2.1 Introduction

This chapter surveys the body of research and engineering practice that informs the design of CyberForge. The chapter is organised around eight thematic clusters that together cover the intellectual surface of the project: (i) the evolution of web threats and the inadequacy of signature-based defence; (ii) the rise of machine learning, and in particular deep-learning, methods in cyber-security; (iii) URL- and DGA-specific detection literature; (iv) information-extraction techniques for indicators of compromise; (v) the MITRE ATT&CK framework as a shared analytic vocabulary; (vi) the multi-agent-systems paradigm and its recent re-instantiation through large language models; (vii) the role of language models themselves in security tooling, including the question of fallback and explanation; and (viii) prior work on cross-platform, federated, and synchronised threat intelligence. The chapter closes with a synthesis of the gaps that the present study addresses.

The intent of the chapter is not merely encyclopaedic. Each section is written to expose a specific design decision in CyberForge and to defend that decision against the alternatives that were considered. Citations are confined to peer-reviewed conference and journal publications, foundational textbooks, and well-established technical reports; transient commercial white papers are referenced only where they constitute a documented precedent for an architectural choice.

## 2.2 Evolution of Web Threats

The earliest body of academic work on web-based attacks concentrated on server-side vulnerabilities — SQL injection, cross-site scripting (XSS), cross-site request forgery (CSRF), and remote file inclusion. Although those attack classes remain operationally significant, the centre of gravity of consumer-facing web threats has shifted in the past fifteen years toward attacks that target the *browser* and *the user* directly. Provos, McNamee, Mavrommatis, Wang and Modadugu (2007), in their influential paper "The Ghost in the Browser," documented the rise of drive-by-download attacks in which a legitimate page is silently modified to deliver an exploit chain to vulnerable browsers. Their large-scale crawl found that 1.3 % of the pages they sampled engaged in drive-by behaviour, and the authors argued — presciently — that the future of malicious web activity would be characterised by short-lived domains, polymorphic JavaScript, and infrastructure designed specifically to evade signature-based scanning.

The intervening fifteen years have validated that prediction. Khonji, Iraqi and Jones (2013) provide a comprehensive literature survey of phishing detection covering more than seventy publications, observing that the most successful approaches combine lexical features of the URL, content features of the rendered page, and reputation features drawn from external feeds — but also noting that no single approach achieves both high recall and low false-positive rate when evaluated on heterogeneous datasets. More recently, the increasing prevalence of free domain registrars (notably the `.tk`, `.gq`, `.ml`, `.cf` and `.xyz` zones) and the wide availability of phishing kits sold as a service have driven the cost of mounting a phishing campaign close to zero. Anderson and Roth (2018), in introducing the EMBER static-PE-malware benchmark, similarly noted that the half-life of malware family signatures has continued to shrink, making per-sample classification increasingly important relative to per-family classification.

The implication for system design is that web-threat detection cannot rely on any single signal. A modern detector must combine string-level analysis of the URL, behavioural inspection of the page (DOM, network requests, JavaScript activity), reputation lookups in third-party feeds, and longitudinal context drawn from past observations of the same domain or actor. The eight-agent decomposition adopted by CyberForge is a direct response to this multi-signal requirement.

## 2.3 Machine Learning in Cybersecurity

### 2.3.1 Foundational scepticism

Any review of machine learning in cyber-security must begin with the foundational critique of Sommer and Paxson (2010). Their paper, "Outside the Closed World," argued that the success of machine learning in domains such as natural-language processing and computer vision had not — at the time of writing — translated to comparable success in network intrusion detection, and identified the principal reasons: the cost of misclassification asymmetry, the lack of representative ground-truth data, the high variability of legitimate network behaviour, and the difficulty of converting model output into actionable artefacts for analysts. Although the specific landscape has changed considerably in the intervening years, the structural critique remains relevant; in particular, the requirements that model output be *interpretable* and that systems be designed for *cost-asymmetric* misclassification continue to inform the design of any production deployment.

### 2.3.2 Surveys of applied machine learning

Buczak and Guven (2016) provide a systematic review of the application of classical machine-learning methods — decision trees, support-vector machines, random forests, hidden Markov models, and clustering techniques — to intrusion detection. Their summary is mixed: in controlled benchmark conditions, ensemble methods such as random forests routinely achieve accuracy above 95 %, but the gap between benchmark performance and operational performance remains pronounced. They identify three contributors to this gap: (i) concept drift, in which the statistical properties of normal traffic change over time; (ii) class imbalance, in which malicious samples are vastly outnumbered by benign ones; and (iii) the absence of labelled adversarial examples. Their recommendations — that systems combine multiple classifiers, that they be re-trained on operational data, and that they expose calibrated probability outputs — are directly reflected in CyberForge's design.

### 2.3.3 Deep learning and Transformers

The publication of Vaswani et al.'s "Attention Is All You Need" (2017) and the subsequent introduction of BERT (Devlin et al., 2019) shifted the deep-learning research community from convolutional and recurrent architectures toward self-attention-based Transformers. While the original BERT was trained on a general English corpus (BookCorpus plus the English Wikipedia), the *pre-training-and-fine-tuning* paradigm proved remarkably adaptable to specialised domains. Domain-adapted BERT variants for biomedicine (BioBERT), law (LegalBERT), source code (CodeBERT), and security applications now form a substantial sub-literature.

For URL classification specifically, several authors have demonstrated that a Transformer model can outperform handcrafted feature engineering. Le, Pham, Sahoo and Hoi (2018) introduced URLNet, a character- and word-level convolutional architecture that achieves state-of-the-art performance on the URL-classification task at the time of publication; subsequent work has shown that BERT-style models, fine-tuned on phishing- and malware-URL corpora, achieve further marginal improvements at the cost of higher inference latency. CyberForge consumes the publicly available `elftsdmr/malware-url-detect` model hosted on Hugging Face, which is itself a fine-tune of `bert-base-multilingual-cased`; the design decision to use an off-the-shelf, externally validated model rather than to train one in-house was made for two reasons: (i) the open-weight model is independently reproducible by any reader of this thesis, and (ii) the principal scientific contribution of the present study is the *orchestration* of multiple analyses, not the training of a single classifier.

## 2.4 Phishing Detection Approaches

Phishing detection is one of the oldest and most heavily studied sub-problems in web security. The literature can usefully be organised into three generations.

The **first generation**, exemplified by Mohammad, Thabtah and McCluskey (2014), used rule-based or rule-augmented classifiers over hand-engineered features of the URL string and the rendered page: the length of the URL, the presence of the `@` symbol, the use of an IP literal in place of a hostname, the count of special characters, the age of the registered domain, the presence of an iframe, and so on. These approaches achieved respectable accuracy on the datasets of the day, but they suffered from feature obsolescence: as soon as a feature became part of a deployed detector, attackers adapted their kits to avoid it.

The **second generation** adopted machine-learning classifiers that consumed either the same hand-engineered features or, in some cases, the raw URL string itself. Sahingoz et al. (2019), evaluating seven machine-learning algorithms on a phishing dataset, reported that the random-forest classifier reached 97.98 % accuracy on lexical features alone. Their work is representative of a broad consensus that, for URL-only classification, ensemble tree methods are competitive with deep-learning methods when feature engineering is well-done.

The **third generation**, of which the model used by CyberForge is an example, dispenses with feature engineering entirely. A Transformer-based classifier consumes the URL as a sequence of tokens or characters and learns its own representation. The trade-off is that the resulting model is larger, slower at inference time, and harder to interpret than a tree-based classifier, but it is also more robust to the kinds of cosmetic adversarial modifications that defeat lexical features.

The choice in CyberForge to combine a Transformer-based URL classifier with a heuristic feature-engineering layer (the local `cyberforgeMLService` used as a fall-back when the Transformer service is unreachable) is intentionally hybrid: it captures the robustness of the third generation while preserving an offline analytic capability inherited from the second.

## 2.5 Domain Generation Algorithms (DGA)

The seminal work on DGA-based botnets is Antonakakis, Perdisci, Nadji et al. (2012), which presented the first large-scale measurement study of DGA traffic in the wild and proposed a detection methodology built on clustering DNS query patterns. Their work established two findings that remain foundational. First, DGA-generated domains exhibit characteristic statistical properties that distinguish them from human-chosen domain names: high Shannon entropy of the character distribution, low ratio of vowels to consonants, an over-representation of consonant clusters, and a tendency to mix digits into the second-level domain. Second, the detection of an individual DGA-generated domain is far less informative than the detection of a *family* of DGA-generated domains sharing a common generation algorithm — a fact that motivated subsequent generations of clustering-based detectors.

Successor work, including Yu, Pan, Hu and Wang (2018), demonstrated that character-level convolutional networks could outperform statistical methods on per-domain classification. More recent work has proposed Transformer-based detectors. CyberForge's design reflects a pragmatic choice: an externally hosted Transformer-based DGA model was investigated and rejected during the implementation phase, because the only readily available open-weight model (`YangYang-Research/dga-detection`) did not expose a `model_type` field compatible with the standard `transformers.pipeline()` loader on Hugging Face. The system was therefore implemented with a Shannon-entropy-and-character-pattern heuristic that retains the spirit of Antonakakis et al.'s statistical approach. The heuristic combines four signals — Shannon entropy, vowel ratio, digit ratio, and longest consonant run — into a single score that has been calibrated empirically against a hand-curated list of legitimate and DGA domains. The interface exposed to the rest of the system is identical to what a Transformer model would expose, so the heuristic may be replaced by a learned model at any time without further refactoring.

## 2.6 Indicators of Compromise (IOC) Extraction

The concept of an "indicator of compromise" predates the formal academic literature; it emerged from industry practice in the mid-2000s as a way of communicating concrete forensic artefacts — IP addresses, domain names, file hashes, registry keys — between incident-response teams. The MITRE-developed STIX (Structured Threat Information eXpression) standard and its companion TAXII transport protocol provided the first widely adopted machine-readable format for sharing IOCs. Academic work on IOC extraction *from natural-language threat reports* has subsequently grown into a small sub-literature; representative recent contributions use named-entity recognition or generative language models to lift IOCs from PDF reports and blog posts.

For the specific case of extracting IOCs from page content captured by a web scraper, the dominant practical technique remains regular-expression pattern matching, augmented with light validation. CyberForge uses ten regular-expression patterns, covering IPv4 and IPv6 addresses, URLs, fully qualified domain names, e-mail addresses, MD5/SHA-1/SHA-256 hashes, Bitcoin addresses, and CVE identifiers. The choice of regular expressions over learned extraction is justified by three considerations: (i) the false-positive cost of an erroneously extracted "IOC" is low — at worst it triggers a fruitless OTX lookup — whereas the false-negative cost of missing an obvious IOC is high; (ii) the regular-expression approach is deterministic and reviewable, supporting the explainability requirement articulated in Chapter 1; and (iii) the patterns are independently auditable by a security analyst without ML expertise.

The use of severity grading — distinguishing private from public IP addresses, suspicious from generic TLDs — and the application of false-positive filters (excluding domain literals such as `w3.org` or `example.com` that appear in benign contexts) follows the practical patterns used by mature commercial tools such as IBM Resilient and Splunk Phantom.

## 2.7 The MITRE ATT&CK Framework

MITRE ATT&CK (Strom et al., 2018) is a globally accessible knowledge base of adversary tactics, techniques, and procedures (TTPs), curated from real-world incident observations and organised hierarchically into fourteen tactics (Initial Access, Execution, Persistence, …, Impact) and several hundred techniques and sub-techniques. Its principal value lies in providing a *shared analytic vocabulary*: a finding from one analyst, expressed as a MITRE technique identifier, is directly interpretable by another analyst, by a SOAR playbook, or by an automated detection engine.

For the purposes of CyberForge, MITRE ATT&CK plays two roles. First, it provides a structured target vocabulary into which the unstructured findings produced by the LLM and by the behavioural analyser can be mapped — converting prose like "the page contains a credential-harvesting form" into the more precise identifier `T1056 (Input Capture)`. Second, the curated technique list provides a basis for *attack-chain visualisation*: the sandbox UI renders techniques in tactic-phase order (Initial Access → Execution → … → Impact), giving the analyst an immediate visual representation of how far through the kill chain a particular threat has progressed.

The implementation in CyberForge uses a curated catalogue of twenty technique-detection signals, each consisting of a regular-expression pattern, a technique identifier, a tactic, and a baseline confidence value. This catalogue is deliberately small in this initial version of the system; the literature on automated MITRE-ATT&CK mapping (notably the recently published TRAM tool from MITRE itself) describes more sophisticated approaches based on supervised classification of textual evidence into the ATT&CK ontology, and represents a natural direction for future work.

## 2.8 Multi-Agent Systems and Agentic AI

### 2.8.1 The classical multi-agent paradigm

The multi-agent-systems (MAS) paradigm has a long history in artificial intelligence research, with foundational textbook treatments by Wooldridge (2009) and Shoham and Leyton-Brown (2008). In the classical formulation, an *agent* is an autonomous computational entity that perceives an environment, deliberates, and acts to achieve a goal. A *multi-agent system* is a collection of such agents that coordinate, cooperate, or compete to accomplish a task that exceeds the capability of any individual. The classical literature is rich in theoretical results on communication protocols (FIPA-ACL), coordination mechanisms (contract-net, auction-based), and trust modelling.

For cyber-security specifically, multi-agent system designs have been proposed since at least the late 1990s, generally in the form of distributed intrusion-detection systems in which a population of agents monitor sensors and gossip suspicions. These designs were never widely deployed in industry, largely because their coordination overhead exceeded the value of the additional detection coverage.

### 2.8.2 The agentic-AI revival

A revival of the multi-agent paradigm has taken place in the past three years, driven by the maturation of large language models. Recent work has demonstrated that an LLM can play the role of a *planner* that decomposes a task into sub-tasks, dispatches each sub-task to a specialised agent (which may itself be an LLM with a specific prompt or a deterministic tool), and aggregates the results. The ReAct framework of Yao et al. (2023) formalised a *Reasoning + Acting* loop in which the agent alternates between articulating its reasoning, calling an external tool, observing the tool's output, and revising its reasoning. The Generative Agents work of Park et al. (2023) extended the paradigm into a simulated society of agents with persistent memory and reflective behaviour.

The relevance to security is that an analyst's verdict on a suspicious URL is itself naturally decomposable in the ReAct style: *I think this might be a phishing page (reason), let me check the URL against the BERT classifier (act), the classifier says malicious with 99 % confidence (observe), I should also extract IOCs (act), three suspicious domains are present (observe), I should look them up in OTX (act), one is known to OTX threat-intel (observe), my verdict is malicious (reason)*. CyberForge implements this pattern with explicit specialist agents, each playing the role of one *act* step, and a Reporter agent that plays the role of the *reason* step that consolidates the findings.

### 2.8.3 Coordination patterns

The literature on multi-agent coordination distinguishes between *sequential pipelines*, in which agents are arranged in a strict order; *parallel ensembles*, in which all agents run concurrently against the same input; and *directed acyclic graphs* (DAGs), in which agents are arranged in stages with explicit data dependencies. CyberForge adopts the DAG model. Three considerations motivate the choice. First, some agents (URL classifier, DGA detector) operate on the URL string alone and have no dependency on the page content; running them in parallel with the web scraper minimises end-to-end latency. Second, some agents (IOC extractor, behavioural analyser, MITRE mapper) consume the scraper's output and must therefore wait for it; running them in parallel with each other once the scraper has completed is the natural compromise. Third, the threat-intelligence agent must wait for the IOC extractor, since it consumes the latter's output. The DAG with three stages — described in detail in Chapter 3 — is the smallest schedule that respects all dependencies while maximising parallelism.

## 2.9 Large Language Models in Security

The integration of large language models into security tooling is a rapidly developing area. The 2020 publication of GPT-3 (Brown et al., 2020) demonstrated that a sufficiently large general-purpose language model can perform a wide range of tasks, including question answering, summarisation, and rudimentary code generation, on the basis of few-shot or zero-shot prompting alone. Subsequent work, notably the chain-of-thought prompting technique of Wei et al. (2022), showed that prompting an LLM to reason step-by-step improves performance on tasks requiring multi-step inference — a finding directly relevant to the production of explanatory verdicts in security.

The application of LLMs to security tasks has so far concentrated on three areas: code-vulnerability detection (where Pearce et al., 2022, conducted an early evaluation of GitHub Copilot's tendency to suggest insecure code patterns), incident-report summarisation, and conversational threat analysis. CyberForge participates in the last of these: the LLM is invoked to produce a one-paragraph narrative explanation of each verdict, situating the structured findings (verdict, IOCs, MITRE chain) in natural language understandable to a non-expert user.

The principal architectural innovation in CyberForge's use of LLMs is the *fallback chain*. Production deployments routinely encounter periods of LLM unavailability — quota exhaustion, billing issues, regional outages, rate limiting. The fallback chain implemented in CyberForge orders three providers: Google Gemini (the primary provider, by virtue of its generous free tier and high-quality responses), Mistral-7B-Instruct via the Hugging Face Inference API (the secondary provider, open-weight and free), and finally a deterministic template that constructs a narrative from the structured findings without LLM assistance. The chain is invoked transparently to the rest of the system, with a per-provider timeout and a header in the response indicating which provider was actually used. This architecture is itself a small contribution: a search of the published literature did not surface a comparable open implementation of a multi-provider LLM fallback in a security context.

## 2.10 Sandboxing and Behavioural Analysis

The classic sandboxing literature is concerned with *dynamic* analysis of executable code: running a sample in an isolated virtual machine, recording system calls, network traffic, and file-system modifications, and comparing the recorded behaviour against signatures of known malicious activity. The widely cited CWSandbox of Willems, Holz and Freiling (2007) and the open-source Cuckoo Sandbox represent this tradition.

For web-content analysis, the term *sandbox* is used in two related but distinct senses. The first is the analyst's worktable: a UI in which the analyst can submit a URL or file and inspect the resulting structured report. The second is the dynamic-execution chamber: a headless browser or virtual machine in which the URL is fetched and rendered while behaviour is observed. CyberForge implements the first sense in its `Sandbox` screen — a worktable in which verdict, IOCs, MITRE chain, behavioural timeline, and ML breakdown are surfaced — and stops short of the second. The reasons for this scope decision were articulated in §1.6: hosting a headless-browser detonation chamber requires Docker or virtualisation primitives that the Heroku PaaS does not expose. The architecture is, however, designed to admit a future detonation chamber: the Sandbox UI and the orchestrator output format would not need to change if dynamic-analysis findings were added to the report. A future research extension might integrate a remote sandbox API such as Hybrid Analysis, Joe Sandbox, or Any.run.

## 2.11 Threat Intelligence Platforms

Threat intelligence — the systematic collection, processing, and dissemination of information about adversaries and their infrastructure — is now a mature commercial industry, with providers ranging from large platforms (Recorded Future, Mandiant) to free community projects. The most relevant of the community projects for the present work is AlienVault Open Threat Exchange (OTX), which provides a free API for looking up indicators against a continuously updated stream of community-contributed "pulses". OTX is the threat-intelligence source used by CyberForge's Threat Intel agent. Each IOC extracted by the IOC Extractor agent is submitted to the OTX `indicator/{type}` endpoint, and any matching pulses are included in the consolidated report.

The choice of OTX over other free options (VirusTotal's free API, AbuseIPDB) is pragmatic: OTX's terms of service permit the kind of automated, server-side lookup that CyberForge performs at high frequency; its rate limits are generous; and its pulse data is already structured in a way that maps directly to CyberForge's IOC schema. A production deployment would likely consume multiple threat-intelligence feeds in parallel.

## 2.12 Cross-Platform Security Architectures

The final theme in the literature relevant to CyberForge is the cross-platform synchronisation of security state. The dominant industrial pattern is the so-called *XDR* (eXtended Detection and Response) architecture, in which telemetry from endpoints, network sensors, cloud workloads, and email gateways is consolidated into a single back-end. Academic study of XDR is still relatively sparse, but the operational lessons reported by practitioners — the difficulty of normalising heterogeneous telemetry, the need for a shared analytic ontology, the importance of bi-directional control to allow remediation from the central plane — directly inform the design of CyberForge's Appwrite-backed persistence layer and its WebSocket-based push channel to the desktop client.

CyberForge does not attempt to be an XDR. Its scope, as articulated in §1.6, is limited to web-threat analysis. But its synchronisation pattern — a single back-end record per scan, accessible from desktop, dashboard, and (in a planned future extension) mobile — is the same pattern that underpins XDR design.

## 2.13 Identified Research Gaps

The literature reviewed above is rich, but several gaps motivate the present study.

**Gap 1: Open, multi-agent reference implementations.** The agentic-AI revival in the wake of large language models has produced a profusion of frameworks (LangChain, AutoGPT, CrewAI, etc.) but very few openly available reference implementations that apply the paradigm to a *security* use case end-to-end. CyberForge provides one such reference, with all components implemented in open source and deployed on freely accessible platforms.

**Gap 2: LLM fallback in production security tooling.** The published literature treats LLMs as either monolithic or fully interchangeable. The practical engineering reality of building a deployed system requires an explicit fallback ordering and a budget for each provider. CyberForge implements and documents such a chain.

**Gap 3: False-positive reduction through ensemble verdict logic.** Most published work on URL or content classification reports F1 score or accuracy on a single test set, with little attention to the user-perceived false-positive rate that determines whether a tool is operationally useful. CyberForge's verdict-aggregation logic, which combines a blended score (60 % average + 40 % maximum) with a model-consensus requirement and an IOC/MITRE escalation rule, is an attempt to engineer for low false-positive rate explicitly. The reduction observed during development — from one hundred per cent of test URLs flagged as at least medium-risk under the previous heuristic, to a typical false-positive rate near zero on common benign URLs — illustrates the practical value of the approach.

**Gap 4: Memory-aware threat analysis.** Existing URL-classification systems treat each URL as an independent observation. The literature on agent memory (Park et al., 2023) suggests that retaining cross-visit context can change verdicts in useful ways — for example, raising the suspicion level on a domain that has been visited three times in twenty-four hours after producing a medium-risk verdict on the previous two visits. CyberForge implements such a memory layer, with a tiered storage model spanning in-process, Redis-cached, and vector-indexed tiers.

**Gap 5: Accessible, replicable academic deployment.** Much published security research is conducted with private datasets and on private infrastructure, making replication and follow-up work difficult. The deployment described in this thesis runs on PaaS and serverless platforms with free tiers, making the system a candidate substrate for follow-up student research.

These five gaps shape the materials and methods discussed in Chapter 3.

---

### References cited in this chapter

Anderson, H. S., & Roth, P. (2018). EMBER: An open dataset for training static PE malware machine learning models. *arXiv preprint arXiv:1804.04637*.

Antonakakis, M., Perdisci, R., Nadji, Y., Vasiloglou, N., Abu-Nimeh, S., Lee, W., & Dagon, D. (2012). From throw-away traffic to bots: Detecting the rise of DGA-based malware. *Proceedings of the 21st USENIX Security Symposium*.

Brown, T. B., Mann, B., Ryder, N., Subbiah, M., Kaplan, J., Dhariwal, P., et al. (2020). Language models are few-shot learners. *Advances in Neural Information Processing Systems 33*.

Buczak, A. L., & Guven, E. (2016). A survey of data mining and machine learning methods for cyber security intrusion detection. *IEEE Communications Surveys & Tutorials*, 18(2), 1153–1176.

Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding. *Proceedings of NAACL-HLT 2019*, 4171–4186.

Khonji, M., Iraqi, Y., & Jones, A. (2013). Phishing detection: A literature survey. *IEEE Communications Surveys & Tutorials*, 15(4), 2091–2121.

Le, H., Pham, Q., Sahoo, D., & Hoi, S. C. H. (2018). URLNet: Learning a URL representation with deep learning for malicious URL detection. *arXiv preprint arXiv:1802.03162*.

Mohammad, R. M., Thabtah, F., & McCluskey, L. (2014). Intelligent rule-based phishing websites classification. *IET Information Security*, 8(3), 153–160.

Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative Agents: Interactive Simulacra of Human Behavior. *Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology (UIST)*.

Pearce, H., Ahmad, B., Tan, B., Dolan-Gavitt, B., & Karri, R. (2022). Asleep at the keyboard? Assessing the security of GitHub Copilot's code contributions. *2022 IEEE Symposium on Security and Privacy*, 754–768.

Provos, N., McNamee, D., Mavrommatis, P., Wang, K., & Modadugu, N. (2007). The Ghost in the Browser: Analysis of Web-based Malware. *Proceedings of the First USENIX Workshop on Hot Topics in Understanding Botnets (HotBots)*.

Russell, S., & Norvig, P. (2020). *Artificial Intelligence: A Modern Approach* (4th ed.). Pearson.

Sahingoz, O. K., Buber, E., Demir, O., & Diri, B. (2019). Machine learning based phishing detection from URLs. *Expert Systems with Applications*, 117, 345–357.

Shoham, Y., & Leyton-Brown, K. (2008). *Multiagent Systems: Algorithmic, Game-Theoretic, and Logical Foundations*. Cambridge University Press.

Sommer, R., & Paxson, V. (2010). Outside the closed world: On using machine learning for network intrusion detection. *Proceedings of the 31st IEEE Symposium on Security and Privacy*.

Strom, B. E., Applebaum, A., Miller, D. P., Nickels, K. C., Pennington, A. G., & Thomas, C. B. (2018). *MITRE ATT&CK: Design and Philosophy*. MITRE Technical Report.

Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is all you need. *Advances in Neural Information Processing Systems 30*.

Wei, J., Wang, X., Schuurmans, D., Bosma, M., Chi, E., Le, Q., & Zhou, D. (2022). Chain-of-thought prompting elicits reasoning in large language models. *Advances in Neural Information Processing Systems 35*.

Willems, C., Holz, T., & Freiling, F. (2007). Toward automated dynamic malware analysis using CWSandbox. *IEEE Security & Privacy*, 5(2), 32–39.

Wooldridge, M. (2009). *An Introduction to MultiAgent Systems* (2nd ed.). John Wiley & Sons.

Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2023). ReAct: Synergizing reasoning and acting in language models. *Proceedings of the 11th International Conference on Learning Representations (ICLR)*.

Yu, B., Pan, J., Hu, J., Nascimento, A., & De Cock, M. (2018). Character level based detection of DGA domain names. *Proceedings of the 2018 International Joint Conference on Neural Networks (IJCNN)*.
