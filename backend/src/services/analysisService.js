const axios = require('axios');

class AnalysisService {
  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    this.threatDatabase = new Set([
      'malware.example.com',
      'phishing-site.com',
      'suspicious-domain.net',
      'fake-bank.org'
    ]);
  }

  async analyzePageData(pageData) {
    try {
      const analysis = {
        url: pageData.url,
        timestamp: pageData.timestamp,
        riskLevel: 'low',
        hasThreats: false,
        threats: [],
        securityScore: 100,
        recommendations: []
      };

      // Basic security checks
      await this.performBasicSecurityChecks(analysis, pageData);
      
      // Domain reputation check
      await this.checkDomainReputation(analysis, pageData);
      
      // URL pattern analysis
      await this.analyzeUrlPatterns(analysis, pageData);
      
      // Protocol security check
      await this.checkProtocolSecurity(analysis, pageData);

      // Try AI analysis if service is available
      try {
        const aiAnalysis = await this.performAIAnalysis(pageData);
        analysis.aiInsights = aiAnalysis;
      } catch (error) {
        console.log('AI analysis not available:', error.message);
      }

      // Calculate final risk level
      analysis.riskLevel = this.calculateRiskLevel(analysis.securityScore);
      
      return analysis;
    } catch (error) {
      console.error('Error in page analysis:', error);
      return {
        url: pageData.url,
        timestamp: pageData.timestamp,
        error: 'Analysis failed',
        riskLevel: 'unknown'
      };
    }
  }

  async performBasicSecurityChecks(analysis, pageData) {
    const url = new URL(pageData.url);
    
    // Check for HTTPS
    if (url.protocol !== 'https:' && !url.hostname.includes('localhost')) {
      analysis.threats.push({
        type: 'insecure_protocol',
        severity: 'medium',
        description: 'Page loaded over insecure HTTP protocol',
        recommendation: 'Always use HTTPS for secure communication'
      });
      analysis.securityScore -= 20;
      analysis.hasThreats = true;
    }

    // Check for suspicious ports
    const suspiciousPorts = ['8080', '8888', '3000', '4444', '1337'];
    if (suspiciousPorts.includes(url.port)) {
      analysis.threats.push({
        type: 'suspicious_port',
        severity: 'low',
        description: `Unusual port ${url.port} detected`,
        recommendation: 'Verify the legitimacy of this service'
      });
      analysis.securityScore -= 10;
    }

    // Check URL length (very long URLs can be suspicious)
    if (pageData.url.length > 1000) {
      analysis.threats.push({
        type: 'suspicious_url_length',
        severity: 'medium',
        description: 'Unusually long URL detected',
        recommendation: 'Be cautious of extremely long URLs'
      });
      analysis.securityScore -= 15;
      analysis.hasThreats = true;
    }
  }

  async checkDomainReputation(analysis, pageData) {
    const url = new URL(pageData.url);
    const domain = url.hostname;

    // Check against known threat database
    if (this.threatDatabase.has(domain)) {
      analysis.threats.push({
        type: 'known_malicious_domain',
        severity: 'high',
        description: `Domain ${domain} is known to be malicious`,
        recommendation: 'Avoid this website and report it'
      });
      analysis.securityScore -= 50;
      analysis.hasThreats = true;
    }

    // Check for suspicious domain patterns
    const suspiciousPatterns = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
      /[a-z]+-[a-z]+-[a-z]+\.(tk|ml|ga|cf)/, // Suspicious TLDs with patterns
      /(secure|bank|pay|login).*(verification|update|confirm)/, // Phishing patterns
      /[0-9]{10,}/, // Long number sequences
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(domain)) {
        analysis.threats.push({
          type: 'suspicious_domain_pattern',
          severity: 'medium',
          description: 'Domain matches suspicious patterns',
          recommendation: 'Verify domain legitimacy before proceeding'
        });
        analysis.securityScore -= 25;
        analysis.hasThreats = true;
        break;
      }
    }

    // Check for typosquatting (simplified check)
    const legitimateDomains = ['google.com', 'facebook.com', 'amazon.com', 'paypal.com'];
    for (const legitDomain of legitimateDomains) {
      if (this.isTyposquatting(domain, legitDomain)) {
        analysis.threats.push({
          type: 'potential_typosquatting',
          severity: 'high',
          description: `Domain may be impersonating ${legitDomain}`,
          recommendation: 'Double-check the correct spelling of the domain'
        });
        analysis.securityScore -= 40;
        analysis.hasThreats = true;
      }
    }
  }

  async analyzeUrlPatterns(analysis, pageData) {
    const url = pageData.url;
    
    // Check for suspicious URL patterns
    const suspiciousPatterns = [
      { pattern: /bit\.ly|tinyurl|goo\.gl|t\.co/, type: 'url_shortener', severity: 'low' },
      { pattern: /download.*\.exe|\.scr|\.bat|\.cmd/, type: 'suspicious_download', severity: 'high' },
      { pattern: /login.*verify|update.*account|suspended.*account/, type: 'phishing_keywords', severity: 'high' },
      { pattern: /[a-z0-9]{20,}/, type: 'random_string', severity: 'medium' }
    ];

    for (const { pattern, type, severity } of suspiciousPatterns) {
      if (pattern.test(url)) {
        analysis.threats.push({
          type: type,
          severity: severity,
          description: `Suspicious URL pattern detected: ${type.replace('_', ' ')}`,
          recommendation: 'Exercise caution when visiting this URL'
        });
        
        const scoreReduction = severity === 'high' ? 30 : severity === 'medium' ? 20 : 10;
        analysis.securityScore -= scoreReduction;
        
        if (severity === 'high' || severity === 'medium') {
          analysis.hasThreats = true;
        }
      }
    }
  }

  async checkProtocolSecurity(analysis, pageData) {
    const url = new URL(pageData.url);
    
    // Check for dangerous protocols
    const dangerousProtocols = ['ftp:', 'file:', 'javascript:', 'data:'];
    if (dangerousProtocols.includes(url.protocol)) {
      analysis.threats.push({
        type: 'dangerous_protocol',
        severity: 'high',
        description: `Potentially dangerous protocol: ${url.protocol}`,
        recommendation: 'Avoid clicking links with unusual protocols'
      });
      analysis.securityScore -= 35;
      analysis.hasThreats = true;
    }
  }

  async performAIAnalysis(pageData) {
    try {
      const response = await axios.post(`${this.aiServiceUrl}/analyze-url`, {
        url: pageData.url,
        context: 'security_analysis',
        timestamp: pageData.timestamp
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`AI analysis service unavailable: ${error.message}`);
    }
  }

  calculateRiskLevel(securityScore) {
    if (securityScore >= 80) return 'low';
    if (securityScore >= 60) return 'medium';
    return 'high';
  }

  isTyposquatting(domain, legitimateDomain) {
    // Simple Levenshtein distance check for typosquatting
    const distance = this.levenshteinDistance(domain, legitimateDomain);
    const threshold = Math.min(legitimateDomain.length * 0.3, 3);
    return distance <= threshold && domain !== legitimateDomain;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

const analysisService = new AnalysisService();

async function analyzePageData(pageData) {
  return analysisService.analyzePageData(pageData);
}

module.exports = { analyzePageData, AnalysisService };