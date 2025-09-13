/**
 * MITRE ATT&CK Service
 * Handles MITRE ATT&CK framework integration and mapping
 */

const { v4: uuidv4 } = require('uuid');

class MITREAttackService {
    constructor() {
        this.techniques = this.initializeTechniques();
        this.tactics = this.initializeTactics();
    }

    async getTechniques(options = {}) {
        let filteredTechniques = [...this.techniques];

        if (options.tactic) {
            filteredTechniques = filteredTechniques.filter(tech => 
                tech.tactics.includes(options.tactic)
            );
        }

        if (options.platform) {
            filteredTechniques = filteredTechniques.filter(tech => 
                tech.platforms.includes(options.platform)
            );
        }

        if (options.searchTerm) {
            const term = options.searchTerm.toLowerCase();
            filteredTechniques = filteredTechniques.filter(tech => 
                tech.name.toLowerCase().includes(term) ||
                tech.description.toLowerCase().includes(term)
            );
        }

        // Add detection rules if requested
        if (options.includeDetection) {
            filteredTechniques = filteredTechniques.map(tech => ({
                ...tech,
                detectionRules: this.generateDetectionRules(tech.id)
            }));
        }

        return filteredTechniques;
    }

    async mapToMITRE(options = {}) {
        const { huntResults, confidence } = options;
        const mappings = [];

        for (const result of huntResults) {
            const mapping = this.analyzeForMITRE(result, confidence);
            if (mapping) {
                mappings.push(mapping);
            }
        }

        const report = options.generateReport ? this.generateMITREReport(mappings) : null;

        return {
            mappings: mappings,
            totalMappings: mappings.length,
            uniqueTechniques: [...new Set(mappings.map(m => m.techniqueId))].length,
            uniqueTactics: [...new Set(mappings.flatMap(m => m.tactics))].length,
            report: report
        };
    }

    analyzeForMITRE(huntResult, minConfidence = 0.5) {
        // Simple pattern matching for demonstration
        const patterns = {
            'powershell': { technique: 'T1059.001', tactics: ['Execution'], confidence: 0.8 },
            'cmd': { technique: 'T1059.003', tactics: ['Execution'], confidence: 0.7 },
            'wmi': { technique: 'T1047', tactics: ['Execution'], confidence: 0.9 },
            'registry': { technique: 'T1112', tactics: ['Defense Evasion'], confidence: 0.6 },
            'scheduled task': { technique: 'T1053.005', tactics: ['Execution', 'Persistence'], confidence: 0.8 },
            'service': { technique: 'T1543.003', tactics: ['Persistence', 'Privilege Escalation'], confidence: 0.7 }
        };

        const content = (huntResult.description || huntResult.title || '').toLowerCase();
        
        for (const [pattern, mapping] of Object.entries(patterns)) {
            if (content.includes(pattern) && mapping.confidence >= minConfidence) {
                const technique = this.techniques.find(t => t.id === mapping.technique);
                
                return {
                    huntResultId: huntResult.id,
                    techniqueId: mapping.technique,
                    techniqueName: technique ? technique.name : 'Unknown',
                    tactics: mapping.tactics,
                    confidence: mapping.confidence,
                    evidence: content,
                    timestamp: new Date(),
                    context: options.includeContext ? this.generateContext(mapping.technique) : null
                };
            }
        }

        return null;
    }

    generateDetectionRules(techniqueId) {
        const rules = {
            'T1059.001': [
                {
                    type: 'Sigma',
                    rule: 'title: PowerShell Execution\ndetection:\n  selection:\n    Image|endswith: \'\\powershell.exe\'\n  condition: selection'
                },
                {
                    type: 'Elastic',
                    rule: 'process.name:"powershell.exe" AND process.command_line:*'
                }
            ],
            'T1059.003': [
                {
                    type: 'Sigma',
                    rule: 'title: Command Line Execution\ndetection:\n  selection:\n    Image|endswith: \'\\cmd.exe\'\n  condition: selection'
                }
            ]
        };

        return rules[techniqueId] || [];
    }

    generateContext(techniqueId) {
        const contexts = {
            'T1059.001': {
                description: 'PowerShell is often used by attackers for various malicious activities',
                commonUseCases: ['Script execution', 'Fileless attacks', 'Memory injection'],
                mitigations: ['Application control', 'PowerShell logging', 'Script block logging']
            },
            'T1059.003': {
                description: 'Command line interfaces provide access to system functionality',
                commonUseCases: ['System discovery', 'File operations', 'Network commands'],
                mitigations: ['Process monitoring', 'Command line logging', 'Behavioral analysis']
            }
        };

        return contexts[techniqueId] || null;
    }

    generateMITREReport(mappings) {
        const tacticCounts = {};
        const techniqueCounts = {};

        mappings.forEach(mapping => {
            mapping.tactics.forEach(tactic => {
                tacticCounts[tactic] = (tacticCounts[tactic] || 0) + 1;
            });
            techniqueCounts[mapping.techniqueId] = (techniqueCounts[mapping.techniqueId] || 0) + 1;
        });

        return {
            summary: {
                totalMappings: mappings.length,
                uniqueTechniques: Object.keys(techniqueCounts).length,
                uniqueTactics: Object.keys(tacticCounts).length,
                averageConfidence: mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
            },
            tacticBreakdown: tacticCounts,
            techniqueBreakdown: techniqueCounts,
            topTechniques: Object.entries(techniqueCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([technique, count]) => ({
                    technique,
                    count,
                    name: this.techniques.find(t => t.id === technique)?.name || 'Unknown'
                })),
            generatedAt: new Date()
        };
    }

    initializeTechniques() {
        return [
            {
                id: 'T1059.001',
                name: 'PowerShell',
                description: 'Adversaries may abuse PowerShell commands and scripts for execution.',
                tactics: ['Execution'],
                platforms: ['Windows'],
                dataSourcesRequired: ['Process monitoring', 'PowerShell logs'],
                mitigations: ['M1042', 'M1049', 'M1038']
            },
            {
                id: 'T1059.003',
                name: 'Windows Command Shell',
                description: 'Adversaries may abuse the Windows command shell for execution.',
                tactics: ['Execution'],
                platforms: ['Windows'],
                dataSourcesRequired: ['Process monitoring', 'Command line logging'],
                mitigations: ['M1038']
            },
            {
                id: 'T1047',
                name: 'Windows Management Instrumentation',
                description: 'Adversaries may abuse Windows Management Instrumentation (WMI) to execute malicious commands and payloads.',
                tactics: ['Execution'],
                platforms: ['Windows'],
                dataSourcesRequired: ['WMI Objects', 'Process monitoring'],
                mitigations: ['M1040', 'M1018']
            },
            {
                id: 'T1112',
                name: 'Modify Registry',
                description: 'Adversaries may interact with the Windows Registry to hide configuration information.',
                tactics: ['Defense Evasion'],
                platforms: ['Windows'],
                dataSourcesRequired: ['Windows Registry', 'Process monitoring'],
                mitigations: ['M1024']
            },
            {
                id: 'T1053.005',
                name: 'Scheduled Task',
                description: 'Adversaries may abuse the Windows Task Scheduler to perform task scheduling for initial or recurring execution.',
                tactics: ['Execution', 'Persistence', 'Privilege Escalation'],
                platforms: ['Windows'],
                dataSourcesRequired: ['Process monitoring', 'File monitoring'],
                mitigations: ['M1026', 'M1018']
            },
            {
                id: 'T1543.003',
                name: 'Windows Service',
                description: 'Adversaries may create or modify Windows services to repeatedly execute malicious payloads.',
                tactics: ['Persistence', 'Privilege Escalation'],
                platforms: ['Windows'],
                dataSourcesRequired: ['Process monitoring', 'Services'],
                mitigations: ['M1040']
            }
        ];
    }

    initializeTactics() {
        return [
            {
                id: 'TA0001',
                name: 'Initial Access',
                description: 'The adversary is trying to get into your network.'
            },
            {
                id: 'TA0002',
                name: 'Execution',
                description: 'The adversary is trying to run malicious code.'
            },
            {
                id: 'TA0003',
                name: 'Persistence',
                description: 'The adversary is trying to maintain their foothold.'
            },
            {
                id: 'TA0004',
                name: 'Privilege Escalation',
                description: 'The adversary is trying to gain higher-level permissions.'
            },
            {
                id: 'TA0005',
                name: 'Defense Evasion',
                description: 'The adversary is trying to avoid being detected.'
            },
            {
                id: 'TA0006',
                name: 'Credential Access',
                description: 'The adversary is trying to steal account names and passwords.'
            },
            {
                id: 'TA0007',
                name: 'Discovery',
                description: 'The adversary is trying to figure out your environment.'
            },
            {
                id: 'TA0008',
                name: 'Lateral Movement',
                description: 'The adversary is trying to move through your environment.'
            },
            {
                id: 'TA0009',
                name: 'Collection',
                description: 'The adversary is trying to gather data of interest.'
            },
            {
                id: 'TA0010',
                name: 'Exfiltration',
                description: 'The adversary is trying to steal data.'
            },
            {
                id: 'TA0011',
                name: 'Command and Control',
                description: 'The adversary is trying to communicate with compromised systems.'
            },
            {
                id: 'TA0040',
                name: 'Impact',
                description: 'The adversary is trying to manipulate, interrupt, or destroy your systems and data.'
            }
        ];
    }
}

module.exports = MITREAttackService;