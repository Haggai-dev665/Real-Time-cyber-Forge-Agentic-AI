"""
Observation Loop - Continuous Browser & System Observation
The core observation engine that makes the agent "alive" and proactive.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json

logger = logging.getLogger(__name__)


class ObservationType(Enum):
    """Types of observations the agent can make"""
    PAGE_VISIT = "page_visit"
    HTTP_REQUEST = "http_request"
    HTTP_RESPONSE = "http_response"
    FORM_SUBMISSION = "form_submission"
    DOWNLOAD = "download"
    SCRIPT_EXECUTION = "script_execution"
    API_CALL = "api_call"
    COOKIE_CHANGE = "cookie_change"
    STORAGE_CHANGE = "storage_change"
    CREDENTIAL_ENTRY = "credential_entry"
    REDIRECT = "redirect"
    POPUP = "popup"
    WEBSOCKET = "websocket"


@dataclass
class Observation:
    """An observation made by the agent"""
    id: str
    type: ObservationType
    timestamp: datetime
    source: str  # browser, extension, proxy, etc.
    data: Dict[str, Any]
    risk_score: float = 0.0  # 0.0 to 1.0
    analyzed: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'type': self.type.value,
            'timestamp': self.timestamp.isoformat(),
            'source': self.source,
            'data': self.data,
            'risk_score': self.risk_score,
            'analyzed': self.analyzed,
        }


class RiskAssessor:
    """Quick risk assessment for observations"""
    
    def __init__(self):
        # Suspicious patterns
        self.suspicious_domains = [
            'bit.ly', 'tinyurl', 'goo.gl', 't.co',  # URL shorteners
            'pastebin.com', 'hastebin.com',          # Paste sites
            'temp-mail', 'guerrillamail',            # Temp email
        ]
        
        self.high_risk_patterns = [
            r'login', r'signin', r'password', r'credential',
            r'bank', r'payment', r'credit', r'debit',
            r'verify', r'confirm', r'suspend', r'urgent',
            r'account', r'update.*info', r'security.*alert',
        ]
        
        self.suspicious_file_types = [
            '.exe', '.msi', '.bat', '.cmd', '.ps1', '.vbs',
            '.scr', '.pif', '.application', '.jar', '.js',
        ]
        
        self.dangerous_headers = [
            'x-content-type-options',  # Missing = risky
            'x-frame-options',         # Missing = clickjacking
            'strict-transport-security',  # Missing = downgrade
        ]
    
    def assess_url(self, url: str) -> tuple[float, List[str]]:
        """Assess risk of a URL"""
        import re
        
        risk = 0.0
        reasons = []
        url_lower = url.lower()
        
        # Check for suspicious domains
        for domain in self.suspicious_domains:
            if domain in url_lower:
                risk += 0.3
                reasons.append(f"URL shortener/suspicious domain: {domain}")
        
        # Check for high-risk patterns
        for pattern in self.high_risk_patterns:
            if re.search(pattern, url_lower):
                risk += 0.2
                reasons.append(f"High-risk pattern: {pattern}")
        
        # HTTP instead of HTTPS
        if url.startswith('http://'):
            risk += 0.3
            reasons.append("Insecure HTTP connection")
        
        # Long query strings (potential data exfiltration)
        if '?' in url and len(url.split('?')[1]) > 500:
            risk += 0.2
            reasons.append("Unusually long query string")
        
        # IP address instead of domain
        if re.match(r'https?://\d+\.\d+\.\d+\.\d+', url):
            risk += 0.4
            reasons.append("IP address instead of domain name")
        
        # Homograph attacks (mixed scripts)
        if any(ord(c) > 127 for c in url):
            risk += 0.5
            reasons.append("Non-ASCII characters (possible homograph attack)")
        
        return min(risk, 1.0), reasons
    
    def assess_download(self, filename: str, url: str, size: int) -> tuple[float, List[str]]:
        """Assess risk of a download"""
        risk = 0.0
        reasons = []
        filename_lower = filename.lower()
        
        # Check file extension
        for ext in self.suspicious_file_types:
            if filename_lower.endswith(ext):
                risk += 0.6
                reasons.append(f"Executable file type: {ext}")
        
        # Check for double extensions
        if filename.count('.') > 1:
            risk += 0.3
            reasons.append("Double file extension detected")
        
        # Very small executables (often malware)
        if any(filename_lower.endswith(ext) for ext in ['.exe', '.msi']) and size < 10000:
            risk += 0.4
            reasons.append("Suspiciously small executable")
        
        # Assess the download URL
        url_risk, url_reasons = self.assess_url(url)
        risk += url_risk * 0.5
        reasons.extend(url_reasons)
        
        return min(risk, 1.0), reasons
    
    def assess_form(self, form_data: Dict[str, Any]) -> tuple[float, List[str]]:
        """Assess risk of a form submission"""
        risk = 0.0
        reasons = []
        
        # Check for credential fields
        sensitive_fields = ['password', 'pass', 'pwd', 'ssn', 'social', 
                          'credit', 'card', 'cvv', 'pin', 'secret']
        
        for field_name in form_data.get('fields', []):
            field_lower = field_name.lower()
            for sensitive in sensitive_fields:
                if sensitive in field_lower:
                    risk += 0.3
                    reasons.append(f"Sensitive field detected: {field_name}")
        
        # Check form action URL
        action = form_data.get('action', '')
        if action:
            url_risk, url_reasons = self.assess_url(action)
            risk += url_risk * 0.7
            reasons.extend(url_reasons)
        
        # Cross-origin form submission
        if form_data.get('cross_origin'):
            risk += 0.4
            reasons.append("Cross-origin form submission")
        
        return min(risk, 1.0), reasons


class ObservationLoop:
    """
    Continuous observation loop that watches browser activity
    and triggers analysis/actions based on what it sees.
    
    This is the "always-on" component that makes the agent feel alive.
    """
    
    def __init__(self, state_manager=None, analyzer=None, action_executor=None):
        from .agent_state import agent_state
        
        self.state = state_manager or agent_state
        self.analyzer = analyzer
        self.action_executor = action_executor
        
        # Risk assessment
        self.risk_assessor = RiskAssessor()
        
        # Observation queue
        self.observation_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        
        # Running state
        self._running = False
        self._tasks: List[asyncio.Task] = []
        
        # Thresholds
        self.risk_threshold_alert = 0.6    # Alert user
        self.risk_threshold_block = 0.85   # Auto-block (if enabled)
        self.risk_threshold_investigate = 0.4  # Deeper investigation
        
        # Settings
        self.auto_block_enabled = False  # Requires user opt-in
        self.continuous_learning = True
        
        # Statistics
        self.stats = {
            'observations_processed': 0,
            'high_risk_detected': 0,
            'auto_blocked': 0,
            'alerts_raised': 0,
        }
        
        logger.info("👁️ Observation Loop initialized")
    
    async def start(self):
        """Start the observation loop"""
        if self._running:
            return
        
        self._running = True
        
        # Start processing loop
        self._tasks.append(asyncio.create_task(self._process_observations()))
        self._tasks.append(asyncio.create_task(self._periodic_assessment()))
        
        await self.state.set_status(
            self.state.status.__class__.MONITORING,
            "Observation loop started"
        )
        
        logger.info("👁️ Observation loop started")
    
    async def stop(self):
        """Stop the observation loop"""
        self._running = False
        
        for task in self._tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
        self._tasks.clear()
        logger.info("👁️ Observation loop stopped")
    
    async def observe(self, obs_type: ObservationType, source: str, data: Dict[str, Any]) -> str:
        """
        Record an observation. This is called by browser monitors, extensions, etc.
        Returns the observation ID.
        """
        import uuid
        
        obs_id = str(uuid.uuid4())[:12]
        
        observation = Observation(
            id=obs_id,
            type=obs_type,
            timestamp=datetime.utcnow(),
            source=source,
            data=data,
        )
        
        # Quick initial risk assessment
        observation.risk_score = await self._quick_assess(observation)
        
        # Queue for processing
        try:
            self.observation_queue.put_nowait(observation)
        except asyncio.QueueFull:
            # Drop oldest if queue is full
            try:
                self.observation_queue.get_nowait()
                self.observation_queue.put_nowait(observation)
            except:
                pass
        
        # Log observation
        await self.state.log_observation(obs_type.value, {
            'id': obs_id,
            'risk_score': observation.risk_score,
            'source': source,
        })
        
        return obs_id
    
    async def _quick_assess(self, obs: Observation) -> float:
        """Quick risk assessment for initial triage"""
        risk = 0.0
        
        if obs.type == ObservationType.PAGE_VISIT:
            url = obs.data.get('url', '')
            risk, _ = self.risk_assessor.assess_url(url)
            
        elif obs.type == ObservationType.DOWNLOAD:
            risk, _ = self.risk_assessor.assess_download(
                obs.data.get('filename', ''),
                obs.data.get('url', ''),
                obs.data.get('size', 0)
            )
            
        elif obs.type == ObservationType.FORM_SUBMISSION:
            risk, _ = self.risk_assessor.assess_form(obs.data)
            
        elif obs.type == ObservationType.HTTP_REQUEST:
            url = obs.data.get('url', '')
            risk, _ = self.risk_assessor.assess_url(url)
            
        elif obs.type == ObservationType.SCRIPT_EXECUTION:
            # Scripts get base risk score
            risk = 0.2
            if obs.data.get('inline'):
                risk += 0.1
            if obs.data.get('eval'):
                risk += 0.3
        
        return risk
    
    async def _process_observations(self):
        """Main observation processing loop"""
        while self._running:
            try:
                # Get next observation (with timeout)
                try:
                    obs = await asyncio.wait_for(
                        self.observation_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                self.stats['observations_processed'] += 1
                
                # High-risk: immediate action
                if obs.risk_score >= self.risk_threshold_block:
                    await self._handle_high_risk(obs)
                    
                # Medium-risk: investigate
                elif obs.risk_score >= self.risk_threshold_investigate:
                    await self._handle_medium_risk(obs)
                    
                # Low-risk: just log
                else:
                    await self._handle_low_risk(obs)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Observation processing error: {e}")
                await asyncio.sleep(0.1)
    
    async def _handle_high_risk(self, obs: Observation):
        """Handle high-risk observation"""
        self.stats['high_risk_detected'] += 1
        
        # Generate detailed assessment
        details = await self._detailed_assessment(obs)
        
        # Auto-block if enabled and very high risk
        if self.auto_block_enabled and obs.risk_score >= self.risk_threshold_block:
            await self._execute_block(obs, details)
            self.stats['auto_blocked'] += 1
        
        # Always raise alert for high risk
        await self.state.raise_alert(
            severity='critical',
            title=f"High-Risk {obs.type.value.replace('_', ' ').title()} Detected",
            description=details.get('summary', 'Suspicious activity detected'),
            source=obs.source,
            data={
                'observation_id': obs.id,
                'risk_score': obs.risk_score,
                'reasons': details.get('reasons', []),
                'recommendation': details.get('recommendation'),
            }
        )
        self.stats['alerts_raised'] += 1
        
        logger.warning(f"🚨 High-risk observation: {obs.type.value} (score: {obs.risk_score:.2f})")
    
    async def _handle_medium_risk(self, obs: Observation):
        """Handle medium-risk observation - investigate further"""
        details = await self._detailed_assessment(obs)
        
        # Queue for deeper investigation if analyzer available
        if self.analyzer:
            await self.analyzer.queue_investigation(obs, details)
        
        # Raise warning if above alert threshold
        if obs.risk_score >= self.risk_threshold_alert:
            await self.state.raise_alert(
                severity='warning',
                title=f"Suspicious {obs.type.value.replace('_', ' ').title()}",
                description=details.get('summary', 'Potentially suspicious activity'),
                source=obs.source,
                data={
                    'observation_id': obs.id,
                    'risk_score': obs.risk_score,
                }
            )
            self.stats['alerts_raised'] += 1
    
    async def _handle_low_risk(self, obs: Observation):
        """Handle low-risk observation - just log"""
        # Store in memory for pattern learning
        if self.continuous_learning:
            await self._store_for_learning(obs)
    
    async def _detailed_assessment(self, obs: Observation) -> Dict[str, Any]:
        """Perform detailed risk assessment"""
        result = {
            'reasons': [],
            'summary': '',
            'recommendation': '',
        }
        
        if obs.type == ObservationType.PAGE_VISIT:
            url = obs.data.get('url', '')
            _, reasons = self.risk_assessor.assess_url(url)
            result['reasons'] = reasons
            result['summary'] = f"Visit to {url[:50]}... flagged for: {', '.join(reasons[:3])}"
            result['recommendation'] = "Review this site before entering any information"
            
        elif obs.type == ObservationType.DOWNLOAD:
            filename = obs.data.get('filename', '')
            url = obs.data.get('url', '')
            _, reasons = self.risk_assessor.assess_download(filename, url, obs.data.get('size', 0))
            result['reasons'] = reasons
            result['summary'] = f"Download of {filename} flagged for: {', '.join(reasons[:3])}"
            result['recommendation'] = "Scan this file before opening"
            
        elif obs.type == ObservationType.FORM_SUBMISSION:
            _, reasons = self.risk_assessor.assess_form(obs.data)
            result['reasons'] = reasons
            result['summary'] = f"Form submission flagged for: {', '.join(reasons[:3])}"
            result['recommendation'] = "Verify the website's authenticity before submitting"
            
        return result
    
    async def _execute_block(self, obs: Observation, details: Dict[str, Any]):
        """Execute blocking action"""
        if self.action_executor:
            await self.action_executor.block(obs, reason=details.get('summary', 'High risk'))
        
        logger.info(f"🛑 Blocked: {obs.type.value} - {obs.data.get('url', obs.id)[:50]}")
    
    async def _store_for_learning(self, obs: Observation):
        """Store observation for pattern learning"""
        # This would integrate with the AgentMemory
        pass
    
    async def _periodic_assessment(self):
        """Periodic assessment of browsing patterns"""
        while self._running:
            try:
                await asyncio.sleep(300)  # Every 5 minutes
                
                # Analyze recent patterns
                # This is where we'd look for anomalies across multiple observations
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Periodic assessment error: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get observation loop statistics"""
        return {
            **self.stats,
            'queue_size': self.observation_queue.qsize(),
            'running': self._running,
        }


# Global instance
observation_loop = ObservationLoop()
