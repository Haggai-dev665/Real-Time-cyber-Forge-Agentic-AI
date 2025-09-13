/**
 * Threat Intelligence Service
 * Handles threat intelligence analysis and processing
 */

const { v4: uuidv4 } = require('uuid');

class ThreatIntelligenceService {
    constructor() {
        this.threatData = [];
    }

    async analyzeScrapedData(data) {
        const threats = [];
        
        // Analyze emails for suspicious patterns
        if (data.emails && data.emails.length > 0) {
            for (const email of data.emails) {
                if (this.isEmailSuspicious(email)) {
                    threats.push({
                        type: 'suspicious_email',
                        value: email,
                        severity: 'medium',
                        confidence: 0.7,
                        description: 'Email pattern matches known threat indicators'
                    });
                }
            }
        }

        // Analyze domains
        if (data.all_links && data.all_links.length > 0) {
            for (const link of data.all_links) {
                if (this.isDomainSuspicious(link)) {
                    threats.push({
                        type: 'suspicious_domain',
                        value: link,
                        severity: 'high',
                        confidence: 0.8,
                        description: 'Domain matches known malicious patterns'
                    });
                }
            }
        }

        return { threats };
    }

    isEmailSuspicious(email) {
        const suspiciousPatterns = [
            /temp.*mail/i,
            /disposable/i,
            /guerrilla/i,
            /mailinator/i
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(email));
    }

    isDomainSuspicious(domain) {
        const suspiciousPatterns = [
            /bit\.ly/i,
            /tinyurl/i,
            /suspicious/i,
            /malware/i,
            /phishing/i
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(domain));
    }
}

module.exports = ThreatIntelligenceService;