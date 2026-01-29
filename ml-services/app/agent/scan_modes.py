"""
Scan Modes - Adaptive scanning strategies for different contexts
Quick, Deep, Stealth, and Forensic modes with automatic selection.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ScanMode(Enum):
    """Available scan modes"""
    QUICK = "quick"       # ⚡ Low overhead, continuous background
    DEEP = "deep"         # 🧠 Full AI behavior + pattern analysis  
    STEALTH = "stealth"   # 🥷 Low footprint, slow probing
    FORENSIC = "forensic" # 🔬 Maximum logging & traceability


@dataclass
class ScanModeConfig:
    """Configuration for a scan mode"""
    mode: ScanMode
    name: str
    description: str
    icon: str
    
    # Timing
    observation_interval_ms: int
    analysis_depth: int  # 1-10 scale
    parallel_tasks: int
    
    # Features
    ai_analysis: bool
    pattern_matching: bool
    behavioral_analysis: bool
    full_page_scan: bool
    script_analysis: bool
    api_inspection: bool
    
    # Logging
    log_level: str  # debug, info, warning
    store_raw_data: bool
    detailed_traces: bool
    
    # Resource limits
    max_memory_mb: int
    max_cpu_percent: int
    network_throttle_kbps: Optional[int]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'mode': self.mode.value,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'observation_interval_ms': self.observation_interval_ms,
            'analysis_depth': self.analysis_depth,
            'parallel_tasks': self.parallel_tasks,
            'ai_analysis': self.ai_analysis,
            'pattern_matching': self.pattern_matching,
            'behavioral_analysis': self.behavioral_analysis,
            'full_page_scan': self.full_page_scan,
            'script_analysis': self.script_analysis,
            'api_inspection': self.api_inspection,
            'log_level': self.log_level,
            'store_raw_data': self.store_raw_data,
            'detailed_traces': self.detailed_traces,
            'max_memory_mb': self.max_memory_mb,
            'max_cpu_percent': self.max_cpu_percent,
            'network_throttle_kbps': self.network_throttle_kbps,
        }


# Predefined scan mode configurations
SCAN_MODES = {
    ScanMode.QUICK: ScanModeConfig(
        mode=ScanMode.QUICK,
        name="Quick Scan",
        description="Low overhead continuous monitoring. Minimal resource usage.",
        icon="⚡",
        observation_interval_ms=500,
        analysis_depth=3,
        parallel_tasks=2,
        ai_analysis=False,
        pattern_matching=True,
        behavioral_analysis=False,
        full_page_scan=False,
        script_analysis=False,
        api_inspection=False,
        log_level="warning",
        store_raw_data=False,
        detailed_traces=False,
        max_memory_mb=100,
        max_cpu_percent=5,
        network_throttle_kbps=None,
    ),
    
    ScanMode.DEEP: ScanModeConfig(
        mode=ScanMode.DEEP,
        name="Deep Scan",
        description="Full AI-powered analysis with behavior and pattern detection.",
        icon="🧠",
        observation_interval_ms=100,
        analysis_depth=8,
        parallel_tasks=4,
        ai_analysis=True,
        pattern_matching=True,
        behavioral_analysis=True,
        full_page_scan=True,
        script_analysis=True,
        api_inspection=True,
        log_level="info",
        store_raw_data=True,
        detailed_traces=True,
        max_memory_mb=500,
        max_cpu_percent=25,
        network_throttle_kbps=None,
    ),
    
    ScanMode.STEALTH: ScanModeConfig(
        mode=ScanMode.STEALTH,
        name="Stealth Mode",
        description="Low footprint monitoring. Minimal detection signature.",
        icon="🥷",
        observation_interval_ms=2000,
        analysis_depth=5,
        parallel_tasks=1,
        ai_analysis=True,
        pattern_matching=True,
        behavioral_analysis=True,
        full_page_scan=False,
        script_analysis=False,
        api_inspection=False,
        log_level="warning",
        store_raw_data=False,
        detailed_traces=False,
        max_memory_mb=75,
        max_cpu_percent=3,
        network_throttle_kbps=50,
    ),
    
    ScanMode.FORENSIC: ScanModeConfig(
        mode=ScanMode.FORENSIC,
        name="Forensic Mode",
        description="Maximum logging and traceability. Full evidence collection.",
        icon="🔬",
        observation_interval_ms=50,
        analysis_depth=10,
        parallel_tasks=6,
        ai_analysis=True,
        pattern_matching=True,
        behavioral_analysis=True,
        full_page_scan=True,
        script_analysis=True,
        api_inspection=True,
        log_level="debug",
        store_raw_data=True,
        detailed_traces=True,
        max_memory_mb=1000,
        max_cpu_percent=50,
        network_throttle_kbps=None,
    ),
}


@dataclass
class RiskContext:
    """Context used for automatic mode selection"""
    current_risk_level: float  # 0.0 to 1.0
    recent_threats: int
    active_investigation: bool
    user_on_sensitive_site: bool
    system_load: float  # 0.0 to 1.0
    battery_saver_mode: bool
    network_metered: bool
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'current_risk_level': self.current_risk_level,
            'recent_threats': self.recent_threats,
            'active_investigation': self.active_investigation,
            'user_on_sensitive_site': self.user_on_sensitive_site,
            'system_load': self.system_load,
            'battery_saver_mode': self.battery_saver_mode,
            'network_metered': self.network_metered,
        }


class ScanModeManager:
    """
    Manages scan modes and provides automatic mode selection based on context.
    """
    
    def __init__(self, state_manager=None):
        from .agent_state import agent_state
        
        self.state = state_manager or agent_state
        
        # Current mode
        self.current_mode = ScanMode.QUICK
        self.auto_mode_enabled = True
        
        # Mode history
        self.mode_history: List[Dict[str, Any]] = []
        
        # Context tracking
        self.risk_context = RiskContext(
            current_risk_level=0.0,
            recent_threats=0,
            active_investigation=False,
            user_on_sensitive_site=False,
            system_load=0.0,
            battery_saver_mode=False,
            network_metered=False,
        )
        
        logger.info("🔍 Scan Mode Manager initialized")
    
    def get_mode(self) -> ScanMode:
        """Get current scan mode"""
        return self.current_mode
    
    def get_mode_config(self, mode: ScanMode = None) -> ScanModeConfig:
        """Get configuration for a mode"""
        mode = mode or self.current_mode
        return SCAN_MODES[mode]
    
    def get_all_modes(self) -> Dict[str, Dict[str, Any]]:
        """Get all available modes"""
        return {
            mode.value: config.to_dict()
            for mode, config in SCAN_MODES.items()
        }
    
    async def set_mode(self, mode: ScanMode, reason: str = "Manual selection"):
        """Set scan mode"""
        old_mode = self.current_mode
        self.current_mode = mode
        
        # Record history
        self.mode_history.append({
            'from': old_mode.value,
            'to': mode.value,
            'reason': reason,
            'timestamp': datetime.utcnow().isoformat(),
        })
        
        # Keep history bounded
        if len(self.mode_history) > 100:
            self.mode_history = self.mode_history[-50:]
        
        # Update state manager
        await self.state.set_scan_mode(
            self.state.scan_mode.__class__(mode.value),
            reason
        )
        
        logger.info(f"🔍 Scan mode changed: {old_mode.value} → {mode.value} ({reason})")
    
    async def update_context(
        self,
        risk_level: float = None,
        threats: int = None,
        investigating: bool = None,
        sensitive_site: bool = None,
        system_load: float = None,
        battery_saver: bool = None,
        metered_network: bool = None,
    ):
        """Update risk context"""
        if risk_level is not None:
            self.risk_context.current_risk_level = risk_level
        if threats is not None:
            self.risk_context.recent_threats = threats
        if investigating is not None:
            self.risk_context.active_investigation = investigating
        if sensitive_site is not None:
            self.risk_context.user_on_sensitive_site = sensitive_site
        if system_load is not None:
            self.risk_context.system_load = system_load
        if battery_saver is not None:
            self.risk_context.battery_saver_mode = battery_saver
        if metered_network is not None:
            self.risk_context.network_metered = metered_network
        
        # Auto-adjust mode if enabled
        if self.auto_mode_enabled:
            await self._auto_select_mode()
    
    async def _auto_select_mode(self):
        """Automatically select the best mode based on context"""
        ctx = self.risk_context
        
        # Decision logic
        new_mode = None
        reason = ""
        
        # Forensic: Active investigation takes priority
        if ctx.active_investigation:
            new_mode = ScanMode.FORENSIC
            reason = "Active investigation requires maximum logging"
        
        # Deep: High risk or recent threats
        elif ctx.current_risk_level >= 0.7 or ctx.recent_threats >= 3:
            new_mode = ScanMode.DEEP
            reason = f"Elevated risk level ({ctx.current_risk_level:.1%}) or recent threats ({ctx.recent_threats})"
        
        # Deep: Sensitive site
        elif ctx.user_on_sensitive_site:
            new_mode = ScanMode.DEEP
            reason = "User on sensitive site (banking, login, etc.)"
        
        # Stealth: Resource constrained
        elif ctx.battery_saver_mode or ctx.network_metered or ctx.system_load > 0.8:
            new_mode = ScanMode.STEALTH
            reason = "Resource constraints (battery/network/CPU)"
        
        # Quick: Default for normal operation
        else:
            new_mode = ScanMode.QUICK
            reason = "Normal operation"
        
        # Only change if different
        if new_mode and new_mode != self.current_mode:
            await self.set_mode(new_mode, f"Auto: {reason}")
    
    def recommend_mode(self) -> tuple[ScanMode, str]:
        """Recommend a scan mode based on current context"""
        ctx = self.risk_context
        
        if ctx.active_investigation:
            return ScanMode.FORENSIC, "Investigation in progress - forensic mode recommended for evidence collection"
        
        if ctx.current_risk_level >= 0.7:
            return ScanMode.DEEP, f"High risk level ({ctx.current_risk_level:.0%}) detected - deep scan recommended"
        
        if ctx.user_on_sensitive_site:
            return ScanMode.DEEP, "You're on a sensitive site - deep scan recommended for maximum protection"
        
        if ctx.battery_saver_mode:
            return ScanMode.STEALTH, "Battery saver active - stealth mode recommended to conserve power"
        
        return ScanMode.QUICK, "Normal conditions - quick scan provides good protection with low overhead"
    
    def get_status(self) -> Dict[str, Any]:
        """Get scan mode status"""
        recommended, recommendation_reason = self.recommend_mode()
        
        return {
            'current_mode': self.current_mode.value,
            'current_config': self.get_mode_config().to_dict(),
            'auto_mode_enabled': self.auto_mode_enabled,
            'recommended_mode': recommended.value,
            'recommendation_reason': recommendation_reason,
            'context': self.risk_context.to_dict(),
            'recent_changes': self.mode_history[-5:] if self.mode_history else [],
        }
    
    def enable_auto_mode(self):
        """Enable automatic mode selection"""
        self.auto_mode_enabled = True
        logger.info("🤖 Auto mode selection enabled")
    
    def disable_auto_mode(self):
        """Disable automatic mode selection"""
        self.auto_mode_enabled = False
        logger.info("✋ Auto mode selection disabled")


# Global instance
scan_mode_manager = ScanModeManager()
