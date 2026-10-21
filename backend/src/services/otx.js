const axios = require('axios');
const EventEmitter = require('events');

class OTXService extends EventEmitter {
    constructor() {
        super();
        // The key comes from the environment and from nowhere else. A working key
        // used to be written on this line as a fallback, in a public repository:
        // that key is disclosed and has to be replaced in the OTX account.
        this.apiKey = (process.env.OTX_API_KEY || '').trim();
        this.baseURL = 'https://otx.alienvault.com/api/v1';
        this.pollingInterval = null;
        this.lastPulseTimestamp = null;
    }

    /** Refuse to call OTX without a key, with an error callers can recognise. */
    requireKey() {
        if (this.apiKey) return;
        const error = new Error('OTX is not configured: OTX_API_KEY is not set');
        error.code = 'OTX_NOT_CONFIGURED';
        throw error;
    }

    /**
     * Fetch subscribed threat pulses
     */
    async getSubscribedPulses(page = 1, limit = 10) {
        this.requireKey();
        try {
            const response = await axios.get(`${this.baseURL}/pulses/subscribed`, {
                params: { page, limit },
                headers: {
                    'X-OTX-API-KEY': this.apiKey,
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching OTX pulses:', error.message);
            throw error;
        }
    }

    /**
     * Search for specific threats
     */
    async searchPulses(query, limit = 20) {
        this.requireKey();
        try {
            const response = await axios.get(`${this.baseURL}/search/pulses`, {
                params: { q: query, limit },
                headers: {
                    'X-OTX-API-KEY': this.apiKey,
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error searching OTX pulses:', error.message);
            throw error;
        }
    }

    /**
     * Get indicator details (IP, domain, hash)
     */
    async getIndicatorDetails(type, indicator) {
        this.requireKey();
        try {
            const response = await axios.get(`${this.baseURL}/indicators/${type}/${indicator}/general`, {
                headers: {
                    'X-OTX-API-KEY': this.apiKey,
                    'Accept': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching indicator ${indicator}:`, error.message);
            throw error;
        }
    }

    /**
     * Extract geo locations from threat data
     */
    extractThreatLocations(pulse) {
        const locations = [];
        
        if (!pulse || !pulse.indicators) {
            return locations;
        }

        // Extract IP-based threats with geo data
        pulse.indicators.forEach(indicator => {
            if (indicator.type === 'IPv4' || indicator.type === 'IPv6') {
                // Parse geo data from indicator if available
                const location = {
                    ip: indicator.indicator,
                    type: indicator.type,
                    threat: pulse.name || 'Unknown Threat',
                    description: indicator.description || pulse.description || '',
                    adversary: pulse.adversary || 'Unknown',
                    malware: pulse.malware_families || [],
                    tags: pulse.tags || [],
                    created: indicator.created || pulse.created,
                    severity: this.calculateSeverity(pulse)
                };
                locations.push(location);
            }
        });

        return locations;
    }

    /**
     * Calculate threat severity based on pulse data
     */
    calculateSeverity(pulse) {
        let score = 0;
        
        // Check adversary
        if (pulse.adversary) score += 3;
        
        // Check malware families
        if (pulse.malware_families && pulse.malware_families.length > 0) {
            score += pulse.malware_families.length * 2;
        }
        
        // Check attack IDs (MITRE ATT&CK)
        if (pulse.attack_ids && pulse.attack_ids.length > 0) {
            score += pulse.attack_ids.length;
        }
        
        // Check targeted countries/industries
        if (pulse.targeted_countries && pulse.targeted_countries.length > 0) {
            score += 2;
        }
        
        // Normalize to high/medium/low
        if (score >= 8) return 'high';
        if (score >= 4) return 'medium';
        return 'low';
    }

    /**
     * Transform pulse data to threat events for visualization
     */
    transformPulseToThreatEvents(pulse) {
        const events = [];
        const locations = this.extractThreatLocations(pulse);
        
        locations.forEach((location, index) => {
            // An indicator says where a threat was seen from, not where it went.
            // No location lookup is done, so the coordinates are null, and no
            // destination is given: there is no flow data to take one from.
            // (Random coordinates and a fixed "your network" used to stand here.)
            const event = {
                id: `${pulse.id}_${index}`,
                timestamp: new Date(location.created).getTime(),
                origin: {
                    ip: location.ip,
                    country: null,
                    lat: null,
                    lon: null
                },
                destination: null,
                threat: location.threat,
                adversary: location.adversary,
                malware: location.malware,
                severity: location.severity,
                tags: location.tags,
                description: location.description
            };
            events.push(event);
        });
        
        return events;
    }

    /**
     * Start polling for new threats
     */
    startPolling(intervalMs = 30000) {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        if (!this.apiKey) {
            console.warn('OTX polling not started: OTX_API_KEY is not set');
            return false;
        }

        console.log(`Starting OTX threat polling every ${intervalMs / 1000} seconds`);

        this.pollingInterval = setInterval(async () => {
            try {
                const data = await this.getSubscribedPulses(1, 10);
                
                if (data && data.results) {
                    // Filter for new pulses since last check
                    const newPulses = data.results.filter(pulse => {
                        if (!this.lastPulseTimestamp) return true;
                        const pulseTime = new Date(pulse.modified || pulse.created).getTime();
                        return pulseTime > this.lastPulseTimestamp;
                    });

                    if (newPulses.length > 0) {
                        console.log(`Found ${newPulses.length} new threat pulses`);
                        
                        // Update timestamp
                        const latestPulse = newPulses[0];
                        this.lastPulseTimestamp = new Date(latestPulse.modified || latestPulse.created).getTime();
                        
                        // Transform and emit threat events
                        newPulses.forEach(pulse => {
                            const events = this.transformPulseToThreatEvents(pulse);
                            events.forEach(event => {
                                this.emit('threat', event);
                            });
                        });
                    }
                }
            } catch (error) {
                console.error('Error polling OTX threats:', error.message);
            }
        }, intervalMs);
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('Stopped OTX threat polling');
        }
    }

    /**
     * Get recent threat events for initial load
     */
    async getRecentThreats(limit = 50) {
        try {
            const data = await this.getSubscribedPulses(1, limit);
            const allEvents = [];
            
            if (data && data.results) {
                data.results.forEach(pulse => {
                    const events = this.transformPulseToThreatEvents(pulse);
                    allEvents.push(...events);
                });
            }
            
            return allEvents;
        } catch (error) {
            // A failed read is reported as a failure. It used to be returned as an
            // empty list, which reads as "no threats".
            console.error('Error fetching recent threats:', error.message);
            throw error;
        }
    }
}

module.exports = new OTXService();
