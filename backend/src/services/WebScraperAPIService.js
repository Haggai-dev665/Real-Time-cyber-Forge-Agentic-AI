/**
 * Web Scraper API Service
 * Integrates with webscrapper.live API for real-time website security analysis
 */

const axios = require('axios');

class WebScraperAPIService {
    constructor() {
        this.apiUrl = process.env.WEBSCRAPER_API_URL || 'http://webscrapper.live/api/scrape';
        this.apiKey = process.env.WEBSCRAPER_API_KEY || '';
        if (!this.apiKey) {
            console.warn('⚠️ WEBSCRAPER_API_KEY not set — web scraper will fail. Set it as an env var.');
        }
        this.timeout = 60000; // 60 seconds - scraping can take time
        
        this.axiosInstance = axios.create({
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            }
        });
    }

    /**
     * Scrape a website and get comprehensive security data
     * @param {string} url - The URL to scrape
     * @returns {Promise<Object>} - Scraped data including security report
     */
    async scrapeWebsite(url) {
        try {
            console.log(`🌐 Scraping website: ${url}`);
            
            const response = await this.axiosInstance.post(this.apiUrl, {
                url: url
            });

            const data = response.data;
            
            console.log(`✅ Website scraped successfully: ${url}`);
            console.log(`   - Network requests: ${data.network_requests?.length || 0}`);
            console.log(`   - Console logs: ${data.console_logs?.length || 0}`);
            console.log(`   - Security issues: ${data.security_report?.missing_security_headers?.length || 0} missing headers`);

            return {
                success: true,
                data: {
                    url: url,
                    html_content: data.html || data.content || '',
                    console_logs: data.console_logs || [],
                    network_requests: data.network_requests || [],
                    security_report: data.security_report || {},
                    performance_metrics: data.performance_metrics || {},
                    response_headers: data.response_headers || {},
                    scraped_at: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error(`❌ Website scraping failed for ${url}:`, error.message);
            return {
                success: false,
                error: error.response?.data?.error || error.message,
                url: url
            };
        }
    }

    /**
     * Format scraped data for AI analysis
     * Creates a comprehensive security context from scraped data
     * @param {Object} scrapedData - The data returned from scrapeWebsite
     * @returns {Object} - Formatted context for AI analysis
     */
    formatForAIAnalysis(scrapedData) {
        if (!scrapedData.success || !scrapedData.data) {
            return {
                error: scrapedData.error || 'Scraping failed',
                url: scrapedData.url
            };
        }

        const data = scrapedData.data;
        const securityReport = data.security_report || {};
        const performanceMetrics = data.performance_metrics || {};
        const networkRequests = data.network_requests || [];

        // Analyze network requests for security concerns
        const externalDomains = this.extractExternalDomains(networkRequests, data.url);
        const suspiciousRequests = this.findSuspiciousRequests(networkRequests);
        const thirdPartyScripts = this.countThirdPartyScripts(networkRequests);

        // Analyze console logs for errors/warnings
        const consoleErrors = (data.console_logs || []).filter(log => log.level === 'error');
        const consoleWarnings = (data.console_logs || []).filter(log => log.level === 'warning');

        // Build security summary
        const securitySummary = {
            is_https: securityReport.is_https ?? false,
            has_mixed_content: securityReport.mixed_content ?? false,
            missing_security_headers: securityReport.missing_security_headers || [],
            has_insecure_cookies: securityReport.insecure_cookies ?? false,
            external_domains_count: externalDomains.length,
            suspicious_requests_count: suspiciousRequests.length,
            third_party_scripts_count: thirdPartyScripts,
            console_errors_count: consoleErrors.length,
            console_warnings_count: consoleWarnings.length
        };

        // Calculate risk score (0-100)
        const riskScore = this.calculateRiskScore(securitySummary);

        return {
            url: data.url,
            scraped_at: data.scraped_at,
            
            // Security Analysis
            security_summary: securitySummary,
            risk_score: riskScore,
            risk_level: this.getRiskLevel(riskScore),
            
            // Detailed findings
            missing_headers: securityReport.missing_security_headers || [],
            external_domains: externalDomains.slice(0, 20), // Top 20
            suspicious_requests: suspiciousRequests.slice(0, 10), // Top 10
            
            // Performance
            performance: {
                total_load_time_ms: performanceMetrics.total_load_time_ms,
                dom_ready_time_ms: performanceMetrics.dom_ready_time_ms,
                first_paint_ms: performanceMetrics.first_paint_ms,
                total_requests: performanceMetrics.total_requests || networkRequests.length,
                total_size_kb: performanceMetrics.total_size_kb
            },
            
            // Console issues
            console_issues: {
                errors: consoleErrors.slice(0, 5).map(e => e.message),
                warnings: consoleWarnings.slice(0, 5).map(w => w.message)
            },
            
            // Request summary
            network_summary: {
                total_requests: networkRequests.length,
                by_type: this.categorizeRequests(networkRequests),
                failed_requests: networkRequests.filter(r => r.status >= 400).length
            },

            // Raw HTML length for context
            html_size_bytes: (data.html_content || '').length
        };
    }

    /**
     * Extract external domains from network requests
     */
    extractExternalDomains(networkRequests, baseUrl) {
        const baseDomain = this.extractDomain(baseUrl);
        const domains = new Set();

        networkRequests.forEach(req => {
            try {
                const reqDomain = this.extractDomain(req.url);
                if (reqDomain && reqDomain !== baseDomain) {
                    domains.add(reqDomain);
                }
            } catch (e) {
                // Invalid URL, skip
            }
        });

        return Array.from(domains);
    }

    /**
     * Find suspicious network requests
     */
    findSuspiciousRequests(networkRequests) {
        const suspicious = [];
        const suspiciousPatterns = [
            /tracking|tracker|analytics|pixel/i,
            /\.ru\/|\.cn\/|\.tk\//i,  // Potentially suspicious TLDs
            /data:text\/javascript/i,
            /eval|document\.write/i,
            /crypto|miner|coinhive/i
        ];

        networkRequests.forEach(req => {
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(req.url)) {
                    suspicious.push({
                        url: req.url,
                        reason: pattern.toString(),
                        status: req.status
                    });
                    break;
                }
            }
        });

        return suspicious;
    }

    /**
     * Count third-party scripts
     */
    countThirdPartyScripts(networkRequests) {
        return networkRequests.filter(req => 
            req.contentType === 'script' || 
            (req.url && req.url.includes('.js'))
        ).length;
    }

    /**
     * Categorize requests by type
     */
    categorizeRequests(networkRequests) {
        const categories = {};
        networkRequests.forEach(req => {
            const type = req.contentType || 'other';
            categories[type] = (categories[type] || 0) + 1;
        });
        return categories;
    }

    /**
     * Extract domain from URL
     */
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return null;
        }
    }

    /**
     * Calculate security risk score
     */
    calculateRiskScore(summary) {
        let score = 0;

        // HTTPS
        if (!summary.is_https) score += 30;

        // Mixed content
        if (summary.has_mixed_content) score += 15;

        // Missing security headers (5 points each, max 25)
        score += Math.min((summary.missing_security_headers?.length || 0) * 5, 25);

        // Insecure cookies
        if (summary.has_insecure_cookies) score += 10;

        // Too many external domains
        if (summary.external_domains_count > 20) score += 10;
        else if (summary.external_domains_count > 10) score += 5;

        // Suspicious requests
        score += Math.min(summary.suspicious_requests_count * 5, 15);

        // Console errors
        if (summary.console_errors_count > 5) score += 5;

        return Math.min(score, 100);
    }

    /**
     * Get risk level from score
     */
    getRiskLevel(score) {
        if (score >= 70) return 'critical';
        if (score >= 50) return 'high';
        if (score >= 30) return 'medium';
        if (score >= 10) return 'low';
        return 'minimal';
    }

    /**
     * Generate AI prompt context from scraped data
     * This creates a formatted string for the AI to analyze
     */
    generateAIContext(analysisData) {
        const lines = [
            `=== WEBSITE SECURITY SCAN RESULTS ===`,
            `URL: ${analysisData.url}`,
            `Scanned at: ${analysisData.scraped_at}`,
            ``,
            `📊 RISK ASSESSMENT:`,
            `- Risk Score: ${analysisData.risk_score}/100 (${analysisData.risk_level.toUpperCase()})`,
            `- HTTPS: ${analysisData.security_summary.is_https ? 'Yes ✅' : 'No ❌'}`,
            `- Mixed Content: ${analysisData.security_summary.has_mixed_content ? 'Yes ⚠️' : 'No ✅'}`,
            `- Insecure Cookies: ${analysisData.security_summary.has_insecure_cookies ? 'Yes ⚠️' : 'No ✅'}`,
            ``
        ];

        if (analysisData.missing_headers && analysisData.missing_headers.length > 0) {
            lines.push(`🔒 MISSING SECURITY HEADERS:`);
            analysisData.missing_headers.forEach(header => {
                lines.push(`- ${header}`);
            });
            lines.push(``);
        }

        lines.push(`🌐 NETWORK ANALYSIS:`);
        lines.push(`- Total Requests: ${analysisData.network_summary.total_requests}`);
        lines.push(`- Failed Requests: ${analysisData.network_summary.failed_requests}`);
        lines.push(`- External Domains: ${analysisData.security_summary.external_domains_count}`);
        lines.push(`- Third-Party Scripts: ${analysisData.security_summary.third_party_scripts_count}`);
        lines.push(``);

        if (analysisData.suspicious_requests && analysisData.suspicious_requests.length > 0) {
            lines.push(`⚠️ SUSPICIOUS REQUESTS DETECTED:`);
            analysisData.suspicious_requests.slice(0, 5).forEach(req => {
                lines.push(`- ${req.url.substring(0, 80)}...`);
            });
            lines.push(``);
        }

        if (analysisData.console_issues.errors.length > 0) {
            lines.push(`❌ CONSOLE ERRORS:`);
            analysisData.console_issues.errors.slice(0, 3).forEach(err => {
                lines.push(`- ${err.substring(0, 100)}`);
            });
            lines.push(``);
        }

        lines.push(`⚡ PERFORMANCE:`);
        lines.push(`- Load Time: ${analysisData.performance.total_load_time_ms}ms`);
        lines.push(`- DOM Ready: ${analysisData.performance.dom_ready_time_ms}ms`);
        lines.push(`- Page Size: ${analysisData.performance.total_size_kb}KB`);

        return lines.join('\n');
    }
}

// Singleton instance
const webScraperAPIService = new WebScraperAPIService();

module.exports = { WebScraperAPIService, webScraperAPIService };
