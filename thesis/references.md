# REFERENCES

This consolidated list gathers every source cited in the thesis (Chapters 1–2)
together with the software, platforms, models, datasets, and services on which
the CyberForge system was built. Section A lists academic and technical
publications in APA style, alphabetically by author. Section B lists the tools
and online resources used in the implementation.

---

## A. Academic and Technical References

Anderson, H. S., & Roth, P. (2018). EMBER: An open dataset for training static PE malware machine learning models. *arXiv preprint arXiv:1804.04637*.

Antonakakis, M., Perdisci, R., Nadji, Y., Vasiloglou, N., Abu-Nimeh, S., Lee, W., & Dagon, D. (2012). From throw-away traffic to bots: Detecting the rise of DGA-based malware. *Proceedings of the 21st USENIX Security Symposium*.

Apruzzese, G., Anderson, H. S., Dambra, S., Freeman, D., Pierazzi, F., & Roundy, K. (2023). "Real Attackers Don't Compute Gradients": Bridging the gap between adversarial ML research and practice. *IEEE Conference on Secure and Trustworthy Machine Learning (SaTML)*.

Brown, T. B., Mann, B., Ryder, N., Subbiah, M., Kaplan, J., Dhariwal, P., et al. (2020). Language models are few-shot learners. *Advances in Neural Information Processing Systems 33 (NeurIPS 2020)*.

Buczak, A. L., & Guven, E. (2016). A survey of data mining and machine learning methods for cyber security intrusion detection. *IEEE Communications Surveys & Tutorials*, 18(2), 1153–1176.

Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of deep bidirectional transformers for language understanding. *Proceedings of NAACL-HLT 2019*, 4171–4186.

Khonji, M., Iraqi, Y., & Jones, A. (2013). Phishing detection: A literature survey. *IEEE Communications Surveys & Tutorials*, 15(4), 2091–2121.

Le, H., Pham, Q., Sahoo, D., & Hoi, S. C. H. (2018). URLNet: Learning a URL representation with deep learning for malicious URL detection. *arXiv preprint arXiv:1802.03162*.

Mohammad, R. M., Thabtah, F., & McCluskey, L. (2014). Intelligent rule-based phishing websites classification. *IET Information Security*, 8(3), 153–160.

Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents: Interactive simulacra of human behavior. *Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology (UIST)*.

Pearce, H., Ahmad, B., Tan, B., Dolan-Gavitt, B., & Karri, R. (2022). Asleep at the keyboard? Assessing the security of GitHub Copilot's code contributions. *2022 IEEE Symposium on Security and Privacy (S&P)*, 754–768.

Provos, N., McNamee, D., Mavrommatis, P., Wang, K., & Modadugu, N. (2007). The ghost in the browser: Analysis of web-based malware. *Proceedings of the First USENIX Workshop on Hot Topics in Understanding Botnets (HotBots)*.

Russell, S., & Norvig, P. (2020). *Artificial intelligence: A modern approach* (4th ed.). Pearson.

Sahingoz, O. K., Buber, E., Demir, O., & Diri, B. (2019). Machine learning based phishing detection from URLs. *Expert Systems with Applications*, 117, 345–357.

Shoham, Y., & Leyton-Brown, K. (2008). *Multiagent systems: Algorithmic, game-theoretic, and logical foundations*. Cambridge University Press.

Sommer, R., & Paxson, V. (2010). Outside the closed world: On using machine learning for network intrusion detection. *Proceedings of the 31st IEEE Symposium on Security and Privacy (S&P)*.

Strom, B. E., Applebaum, A., Miller, D. P., Nickels, K. C., Pennington, A. G., & Thomas, C. B. (2018). *MITRE ATT&CK: Design and philosophy*. MITRE Technical Report.

Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is all you need. *Advances in Neural Information Processing Systems 30 (NeurIPS 2017)*.

Wei, J., Wang, X., Schuurmans, D., Bosma, M., Chi, E., Le, Q., & Zhou, D. (2022). Chain-of-thought prompting elicits reasoning in large language models. *Advances in Neural Information Processing Systems 35 (NeurIPS 2022)*.

Willems, C., Holz, T., & Freiling, F. (2007). Toward automated dynamic malware analysis using CWSandbox. *IEEE Security & Privacy*, 5(2), 32–39.

Wooldridge, M. (2009). *An introduction to multiagent systems* (2nd ed.). John Wiley & Sons.

Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2023). ReAct: Synergizing reasoning and acting in language models. *Proceedings of the 11th International Conference on Learning Representations (ICLR)*.

Yu, B., Pan, J., Hu, J., Nascimento, A., & De Cock, M. (2018). Character level based detection of DGA domain names. *Proceedings of the 2018 International Joint Conference on Neural Networks (IJCNN)*.

---

## B. Software, Frameworks, Platforms, Models, and Services

The following tools and online resources were used to build, train, deploy, and
operate CyberForge. Each entry gives the role it plays in the system.

### B.1 Machine-Learning Models and Datasets

- **elftsdmr/malware-url-detect** — The pretrained URL-phishing classifier used by the URL Classifier agent; a fine-tune of `bert-base-multilingual-cased`. Hugging Face Hub. https://huggingface.co/elftsdmr/malware-url-detect
- **bert-base-multilingual-cased** — Base Transformer model underlying the URL classifier (Devlin et al., 2019). https://huggingface.co/bert-base-multilingual-cased
- **Mistral-7B-Instruct** — Open-weight large language model used as the secondary provider in the LLM fallback chain, via the Hugging Face Inference API. Mistral AI. https://mistral.ai
- **Google Gemini** — Primary large language model for narrative generation. Google DeepMind. https://ai.google.dev
- **DeepSeek** — Large language model powering the desktop AI security assistant (`ml_security_chat`), accessed through Hugging Face Inference Providers. https://www.deepseek.com
- **EMBER dataset** — Open static-PE malware benchmark referenced in the literature review (Anderson & Roth, 2018). https://github.com/elastic/ember
- **MITRE ATT&CK** — Adversary tactics-and-techniques knowledge base used by the MITRE Mapper agent (Strom et al., 2018). https://attack.mitre.org

### B.2 Backend, Inference, and Persistence Platforms

- **Heroku** — Platform-as-a-Service hosting the Node.js / Express backend (app `cyberforge`). https://www.heroku.com
- **Hugging Face Spaces / Hub / Inference API** — Hosts the Python FastAPI inference gateway and serves remote model inference. https://huggingface.co
- **Appwrite Cloud** — Backend-as-a-service for authentication, document storage (users, agents, tasks, alerts, browser-intelligence, network captures). https://appwrite.io
- **Redis** — Low-latency session/result cache in the memory layer. https://redis.io
- **Pinecone** — Managed vector database for similarity search over historical observations. https://www.pinecone.io
- **ChromaDB** — Local-first vector store used as the Pinecone fallback. https://www.trychroma.com
- **AlienVault Open Threat Exchange (OTX)** — Community threat-intelligence feed queried by the Threat-Intel Enricher agent. https://otx.alienvault.com
- **WebScrapper.live** — External DOM / network / header capture service used by the Web Scraper agent.

### B.3 Languages, Frameworks, and Libraries

- **Node.js** and **Express** — Runtime and web framework for the orchestrator/backend. https://nodejs.org · https://expressjs.com
- **Python** and **FastAPI** — Language and framework for the Hugging Face inference gateway. https://www.python.org · https://fastapi.tiangolo.com
- **Tauri** (Rust) and **Electron** — Desktop client shell and renderer. https://tauri.app · https://www.electronjs.org
- **React Native** and **Expo (SDK 54)** — Cross-platform mobile client and toolchain (expo-router). https://reactnative.dev · https://expo.dev
- **scikit-learn** — Classical ML library backing the local heuristic ML service. https://scikit-learn.org
- **Hugging Face Transformers** — Library used to load and run the Transformer pipelines. https://huggingface.co/docs/transformers
- **SQLite** (via `rusqlite`) — Reads local browser-history databases in the desktop client. https://www.sqlite.org
- **sysinfo** (Rust) — On-device system/telemetry and browser detection. https://crates.io/crates/sysinfo
- **Bouncy Castle** — X.509 certificate authority for the mobile VPN's on-device TLS interception. https://www.bouncycastle.org
- **Graphviz** — Renders the thesis architecture and class diagrams. https://graphviz.org

### B.4 Standards and Protocols

- **MITRE ATT&CK** — Shared analytic vocabulary of tactics, techniques, and procedures. https://attack.mitre.org
- **STIX / TAXII** — Structured Threat Information eXpression and its transport protocol, the machine-readable standard for sharing indicators of compromise. https://oasis-open.github.io/cti-documentation
- **CVE (Common Vulnerabilities and Exposures)** — Identifier scheme extracted by the IOC Extractor agent. https://www.cve.org
