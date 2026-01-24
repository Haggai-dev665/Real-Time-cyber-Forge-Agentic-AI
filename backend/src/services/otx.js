const axios = require('axios');
const EventEmitter = require('events');

class OTXService extends EventEmitter {
    constructor() {
        super();
        this.apiKey = process.env.OTX_API_KEY || 'e80a674c5bab3cd2f9acaebf9eedabe7c82735443b6c986a2b9e3791488c928d';
        this.baseURL = 'https://otx.alienvault.com/api/v1';
        this.pollingInterval = null;
        this.lastPulseTimestamp = null;
    }

    /**
     * Fetch subscribed threat pulses
     */
    async getSubscribedPulses(page = 1, limit = 10) {
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
            // Simulate origin/destination pairs
            // In real scenario, you'd parse actual network flow data
            const event = {
                id: `${pulse.id}_${index}`,
                timestamp: new Date(location.created).getTime(),
                origin: {
                    ip: location.ip,
                    country: 'Unknown', // Would need geo lookup
                    lat: Math.random() * 180 - 90, // Placeholder
                    lon: Math.random() * 360 - 180  // Placeholder
                },
                destination: {
                    ip: 'Target Network',
                    country: 'US', // Your network
                    lat: 37.7749,
                    lon: -122.4194
                },
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
            console.error('Error fetching recent threats:', error.message);
            return [];
        }
    }
}

module.exports = new OTXService();
