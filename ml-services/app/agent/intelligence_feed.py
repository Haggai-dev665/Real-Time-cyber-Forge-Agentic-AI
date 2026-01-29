"""
Real-Time Intelligence Feed
Generates AI-explained security events for the live intelligence feed UI.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
import json

logger = logging.getLogger(__name__)


class EventSeverity(Enum):
    """Event severity levels"""
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class IntelligenceEvent:
    """A security-relevant event for the intelligence feed"""
    id: str
    severity: EventSeverity
    title: str
    explanation: str  # AI-generated explanation of why this matters
    timestamp: datetime
    source: str
    category: str  # phishing, malware, tracking, credential, etc.
    confidence: float  # 0.0 to 1.0
    data: Dict[str, Any] = field(default_factory=dict)
    actions: List[Dict[str, str]] = field(default_factory=list)  # Suggested actions
    dismissed: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'severity': self.severity.value,
            'title': self.title,
            'explanation': self.explanation,
            'timestamp': self.timestamp.isoformat(),
            'source': self.source,
            'category': self.category,
            'confidence': self.confidence,
            'data': self.data,
            'actions': self.actions,
            'dismissed': self.dismissed,
        }


class ExplanationGenerator:
    """Generates human-readable explanations for security events"""
    
    def __init__(self):
        # Template-based explanations for common scenarios
        self.templates = {
            'suspicious_domain': {
                'template': "This domain ({domain}) shows characteristics of {threat_type}. {reasons}",
                'actions': [
                    {'id': 'block', 'label': 'Block this domain'},
                    {'id': 'investigate', 'label': 'Investigate further'},
                    {'id': 'dismiss', 'label': 'Dismiss'},
                ]
            },
            'insecure_connection': {
                'template': "This site uses HTTP instead of HTTPS, meaning your data is transmitted in plain text. Anyone on the same network could intercept your information.",
                'actions': [
                    {'id': 'warn', 'label': 'Show warning'},
                    {'id': 'block', 'label': 'Block insecure sites'},
                    {'id': 'dismiss', 'label': 'Allow anyway'},
                ]
            },
            'credential_form': {
                'template': "A login form was detected on {url}. {analysis} This could be legitimate or a phishing attempt.",
                'actions': [
                    {'id': 'verify', 'label': 'Verify site authenticity'},
                    {'id': 'block', 'label': 'Block this site'},
                    {'id': 'allow', 'label': 'Continue'},
                ]
            },
            'suspicious_download': {
                'template': "The file {filename} ({file_type}) from {source} has been flagged. {reasons}",
                'actions': [
                    {'id': 'quarantine', 'label': 'Quarantine file'},
                    {'id': 'scan', 'label': 'Deep scan'},
                    {'id': 'delete', 'label': 'Delete'},
                    {'id': 'allow', 'label': 'Allow'},
                ]
            },
            'tracking_detected': {
                'template': "Fingerprinting or tracking scripts detected from {source}. These scripts can identify you across websites without cookies.",
                'actions': [
                    {'id': 'block_tracker', 'label': 'Block tracker'},
                    {'id': 'report', 'label': 'Add to report'},
                    {'id': 'dismiss', 'label': 'Dismiss'},
                ]
            },
            'api_anomaly': {
                'template': "Unusual API activity detected: {description}. This may indicate {implication}.",
                'actions': [
                    {'id': 'investigate', 'label': 'Investigate'},
                    {'id': 'block', 'label': 'Block API'},
                    {'id': 'dismiss', 'label': 'Dismiss'},
                ]
            },
        }
    
    def generate(
        self,
        event_type: str,
        data: Dict[str, Any],
        risk_reasons: List[str] = None,
    ) -> tuple[str, List[Dict[str, str]]]:
        """Generate explanation and actions for an event"""
        template_data = self.templates.get(event_type, {})
        template = template_data.get('template', 'Security event detected: {description}')
        actions = template_data.get('actions', [{'id': 'dismiss', 'label': 'Dismiss'}])
        
        # Build context for template
        context = {**data}
        if risk_reasons:
            context['reasons'] = '. '.join(risk_reasons[:3])
        
        # Fill template
        try:
            explanation = template.format(**context)
        except KeyError:
            explanation = f"Security event: {event_type}"
        
        return explanation, actions
    
    async def generate_with_ai(
        self,
        event_type: str,
        data: Dict[str, Any],
        gemini_service=None,
    ) -> tuple[str, List[Dict[str, str]]]:
        """Generate explanation using AI for complex scenarios"""
        if not gemini_service:
            return self.generate(event_type, data)
        
        try:
            prompt = f"""You are a security analyst assistant. Explain this security event to a non-technical user in 1-2 sentences:

Event Type: {event_type}
Data: {json.dumps(data, indent=2)}

Be specific about:
1. What happened
2. Why it matters (potential risk)
3. Keep it concise and actionable

Response (plain text, no markdown):"""
            
            response = await gemini_service.generate(prompt)
            explanation = response.strip()
            
            # Get default actions for this type
            _, actions = self.generate(event_type, data)
            
            return explanation, actions
            
        except Exception as e:
            logger.error(f"AI explanation error: {e}")
            return self.generate(event_type, data)


class IntelligenceFeed:
    """
    Real-time intelligence feed that surfaces actionable security events.
    Minimizes noise, only shows what matters.
    """
    
    def __init__(self, gemini_service=None):
        self.gemini = gemini_service
        self.explainer = ExplanationGenerator()
        
        # Event storage
        self.events: deque = deque(maxlen=500)
        self.dismissed_ids: set = set()
        
        # Event listeners for real-time streaming
        self._listeners: List[Callable] = []
        
        # Deduplication
        self._recent_hashes: deque = deque(maxlen=100)
        
        # Rate limiting for feed events
        self._event_timestamps: deque = deque(maxlen=50)
        self._min_interval = 1.0  # Minimum seconds between events
        
        # Categories
        self.categories = {
            'phishing': 'Phishing & Fraud',
            'malware': 'Malware & Downloads',
            'tracking': 'Tracking & Privacy',
            'credential': 'Credential Security',
            'network': 'Network Security',
            'data': 'Data Exposure',
            'anomaly': 'Anomalous Behavior',
        }
        
        logger.info("📡 Intelligence Feed initialized")
    
    async def publish(
        self,
        severity: EventSeverity,
        title: str,
        category: str,
        source: str,
        data: Dict[str, Any],
        confidence: float = 0.8,
        risk_reasons: List[str] = None,
        use_ai: bool = False,
    ) -> Optional[IntelligenceEvent]:
        """Publish an event to the intelligence feed"""
        import uuid
        import hashlib
        
        # Rate limiting
        now = datetime.utcnow()
        if self._event_timestamps:
            elapsed = (now - self._event_timestamps[-1]).total_seconds()
            if elapsed < self._min_interval and severity != EventSeverity.CRITICAL:
                await asyncio.sleep(self._min_interval - elapsed)
        
        # Deduplication
        event_hash = hashlib.md5(
            f"{title}{category}{data.get('url', '')}{data.get('domain', '')}".encode()
        ).hexdigest()[:12]
        
        if event_hash in self._recent_hashes:
            return None
        
        self._recent_hashes.append(event_hash)
        
        # Generate explanation
        event_type = self._categorize_event(category, data)
        if use_ai and self.gemini:
            explanation, actions = await self.explainer.generate_with_ai(
                event_type, data, self.gemini
            )
        else:
            explanation, actions = self.explainer.generate(event_type, data, risk_reasons)
        
        # Create event
        event = IntelligenceEvent(
            id=str(uuid.uuid4())[:8],
            severity=severity,
            title=title,
            explanation=explanation,
            timestamp=now,
            source=source,
            category=category,
            confidence=confidence,
            data=data,
            actions=actions,
        )
        
        # Store
        self.events.append(event)
        self._event_timestamps.append(now)
        
        # Notify listeners
        await self._notify(event)
        
        logger.info(f"📡 Intelligence event: [{severity.value}] {title}")
        
        return event
    
    def _categorize_event(self, category: str, data: Dict[str, Any]) -> str:
        """Map category and data to event type for explanation template"""
        if category == 'phishing':
            if data.get('has_form'):
                return 'credential_form'
            return 'suspicious_domain'
        
        elif category == 'malware':
            if data.get('filename'):
                return 'suspicious_download'
            return 'suspicious_domain'
        
        elif category == 'tracking':
            return 'tracking_detected'
        
        elif category == 'credential':
            return 'credential_form'
        
        elif category == 'network':
            if data.get('protocol') == 'http':
                return 'insecure_connection'
            return 'api_anomaly'
        
        elif category == 'anomaly':
            return 'api_anomaly'
        
        return 'suspicious_domain'
    
    def subscribe(self, callback: Callable):
        """Subscribe to real-time events"""
        self._listeners.append(callback)
    
    def unsubscribe(self, callback: Callable):
        """Unsubscribe from events"""
        self._listeners = [cb for cb in self._listeners if cb != callback]
    
    async def _notify(self, event: IntelligenceEvent):
        """Notify all listeners of new event"""
        for callback in self._listeners:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(event.to_dict())
                else:
                    callback(event.to_dict())
            except Exception as e:
                logger.error(f"Feed listener error: {e}")
    
    def dismiss(self, event_id: str):
        """Dismiss an event"""
        self.dismissed_ids.add(event_id)
        for event in self.events:
            if event.id == event_id:
                event.dismissed = True
                break
    
    def get_events(
        self,
        limit: int = 50,
        severity: Optional[EventSeverity] = None,
        category: Optional[str] = None,
        include_dismissed: bool = False,
    ) -> List[Dict[str, Any]]:
        """Get recent events with optional filtering"""
        events = list(self.events)
        
        # Filter
        if not include_dismissed:
            events = [e for e in events if not e.dismissed]
        
        if severity:
            events = [e for e in events if e.severity == severity]
        
        if category:
            events = [e for e in events if e.category == category]
        
        # Sort by timestamp descending
        events.sort(key=lambda e: e.timestamp, reverse=True)
        
        return [e.to_dict() for e in events[:limit]]
    
    def get_summary(self) -> Dict[str, Any]:
        """Get feed summary"""
        active_events = [e for e in self.events if not e.dismissed]
        
        by_severity = {}
        by_category = {}
        
        for event in active_events:
            severity = event.severity.value
            by_severity[severity] = by_severity.get(severity, 0) + 1
            
            category = event.category
            by_category[category] = by_category.get(category, 0) + 1
        
        return {
            'total_events': len(self.events),
            'active_events': len(active_events),
            'by_severity': by_severity,
            'by_category': by_category,
            'latest_event': self.events[-1].to_dict() if self.events else None,
        }
    
    async def stream(self):
        """Async generator for streaming events"""
        queue = asyncio.Queue()
        
        async def on_event(event):
            await queue.put(event)
        
        self.subscribe(on_event)
        
        try:
            while True:
                event = await queue.get()
                yield event
        finally:
            self.unsubscribe(on_event)


# Global instance
intelligence_feed = IntelligenceFeed()
