/**
 * IOC Analysis Service
 * Handles Indicator of Compromise analysis and enrichment
 */

const { v4: uuidv4 } = require('uuid');

class IOCAnalysisService {
    constructor() {
        this.iocDatabase = new Map();
    }

    async analyzeIOC(config) {
        const { ioc, type, sources } = config;
        const analysisId = uuidv4();
        
        // Detect IOC type if auto
        const detectedType = type === 'auto' ? this.detectIOCType(ioc) : type;
        
        // Mock analysis results
        const analysis = {
            id: analysisId,
            ioc: ioc,
            type: detectedType,
            threatLevel: this.calculateThreatLevel(),
            sources: sources.map(source => ({
                name: source,
                malicious: Math.random() > 0.8,
                details: `Analysis result from ${source}`,
                confidence: Math.random()
            })),
            recommendations: this.generateRecommendations(detectedType),
            timestamp: new Date(),
            metadata: {
                firstSeen: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                lastSeen: new Date(),
                occurrences: Math.floor(Math.random() * 100) + 1
            }
        };

        return analysis;
    }

    async getIOCs(options = {}) {
        // Generate mock IOCs
        const mockIOCs = [
            {
                id: uuidv4(),
                value: '192.168.1.100',
                type: 'ip',
                severity: 'high',
                confidence: 0.95,
                detected: true,
                firstSeen: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                sources: ['internal', 'virustotal']
            },
            {
                id: uuidv4(),
                value: 'malicious.example.com',
                type: 'domain',
                severity: 'medium',
                confidence: 0.75,
                detected: false,
                firstSeen: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                sources: ['threatcrowd', 'alienvault']
            },
            {
                id: uuidv4(),
                value: 'a1b2c3d4e5f6789012345678901234567890abcd',
                type: 'hash',
                severity: 'critical',
                confidence: 0.98,
                detected: true,
                firstSeen: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                sources: ['virustotal', 'hybrid-analysis']
            }
        ];

        let filteredIOCs = mockIOCs;

        if (options.type) {
            filteredIOCs = filteredIOCs.filter(ioc => ioc.type === options.type);
        }
        
        if (options.severity) {
            filteredIOCs = filteredIOCs.filter(ioc => ioc.severity === options.severity);
        }
        
        if (options.confidence !== null) {
            filteredIOCs = filteredIOCs.filter(ioc => ioc.confidence >= options.confidence);
        }
        
        if (options.detected !== null) {
            filteredIOCs = filteredIOCs.filter(ioc => ioc.detected === options.detected);
        }

        const startIndex = (options.page - 1) * options.limit;
        const endIndex = startIndex + options.limit;
        
        return {
            data: filteredIOCs.slice(startIndex, endIndex),
            page: options.page,
            totalPages: Math.ceil(filteredIOCs.length / options.limit),
            count: filteredIOCs.length
        };
    }

    detectIOCType(ioc) {
        // IP address
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ioc)) {
            return 'ip';
        }
        
        // Domain
        if (/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(ioc)) {
            return 'domain';
        }
        
        // URL
        if (/^https?:\/\//.test(ioc)) {
            return 'url';
        }
        
        // Email
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ioc)) {
            return 'email';
        }
        
        // Hash (MD5, SHA1, SHA256)
        if (/^[a-fA-F0-9]{32}$/.test(ioc) || /^[a-fA-F0-9]{40}$/.test(ioc) || /^[a-fA-F0-9]{64}$/.test(ioc)) {
            return 'hash';
        }
        
        return 'unknown';
    }

    calculateThreatLevel() {
        const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        return levels[Math.floor(Math.random() * levels.length)];
    }

    generateRecommendations(type) {
        const recommendations = {
            ip: [
                'Block IP address at network perimeter',
                'Check for internal communications with this IP',
                'Monitor for lateral movement from affected systems'
            ],
            domain: [
                'Block domain at DNS level',
                'Check for DNS queries to this domain',
                'Investigate any connections to this domain'
            ],
            hash: [
                'Search for file with this hash on all systems',
                'Update antivirus signatures',
                'Quarantine any instances found'
            ],
            email: [
                'Block sender at email gateway',
                'Check for similar phishing attempts',
                'Train users on phishing awareness'
            ],
            url: [
                'Block URL at web proxy',
                'Check web logs for access attempts',
                'Investigate any successful connections'
            ]
        };

        return recommendations[type] || ['Monitor for suspicious activity'];
    }
}

module.exports = IOCAnalysisService;