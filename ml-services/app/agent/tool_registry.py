"""
Tool Registry & Executor - Dynamic Tool Selection and Execution
Production-ready tool management for autonomous agent operations.
"""

import asyncio
import logging
import inspect
from typing import Dict, List, Any, Optional, Callable, Union, Type
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
import json

logger = logging.getLogger(__name__)


class ToolCategory(Enum):
    """Categories of tools"""
    ANALYSIS = "analysis"
    NETWORK = "network"
    SECURITY = "security"
    DATA = "data"
    AUTOMATION = "automation"
    REPORTING = "reporting"
    MONITORING = "monitoring"
    INTEGRATION = "integration"
    UTILITY = "utility"


class ToolStatus(Enum):
    """Tool operational status"""
    AVAILABLE = "available"
    BUSY = "busy"
    DISABLED = "disabled"
    ERROR = "error"


@dataclass
class ToolParameter:
    """Describes a tool parameter"""
    name: str
    type: str
    description: str
    required: bool = True
    default: Any = None
    choices: Optional[List[Any]] = None


@dataclass
class ToolResult:
    """Result from tool execution"""
    success: bool
    data: Any
    error: Optional[str] = None
    execution_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'success': self.success,
            'data': self.data,
            'error': self.error,
            'execution_time': self.execution_time,
            'metadata': self.metadata,
        }


class Tool(ABC):
    """Base class for all tools"""
    
    name: str = "base_tool"
    description: str = "Base tool class"
    category: ToolCategory = ToolCategory.UTILITY
    version: str = "1.0.0"
    
    def __init__(self):
        self.status = ToolStatus.AVAILABLE
        self.execution_count = 0
        self.total_execution_time = 0.0
        self.last_execution: Optional[datetime] = None
        self.last_error: Optional[str] = None
    
    @abstractmethod
    def get_parameters(self) -> List[ToolParameter]:
        """Get tool parameters description"""
        pass
    
    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult:
        """Execute the tool"""
        pass
    
    def validate_parameters(self, **kwargs) -> tuple[bool, Optional[str]]:
        """Validate input parameters"""
        params = self.get_parameters()
        
        for param in params:
            if param.required and param.name not in kwargs:
                if param.default is None:
                    return False, f"Missing required parameter: {param.name}"
            
            if param.name in kwargs and param.choices:
                if kwargs[param.name] not in param.choices:
                    return False, f"Invalid value for {param.name}. Must be one of: {param.choices}"
        
        return True, None
    
    def get_schema(self) -> Dict[str, Any]:
        """Get tool schema for LLM function calling"""
        params = self.get_parameters()
        
        properties = {}
        required = []
        
        for param in params:
            prop = {
                'type': param.type,
                'description': param.description,
            }
            if param.choices:
                prop['enum'] = param.choices
            if param.default is not None:
                prop['default'] = param.default
            
            properties[param.name] = prop
            
            if param.required:
                required.append(param.name)
        
        return {
            'name': self.name,
            'description': self.description,
            'parameters': {
                'type': 'object',
                'properties': properties,
                'required': required,
            }
        }
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert tool info to dictionary"""
        return {
            'name': self.name,
            'description': self.description,
            'category': self.category.value,
            'version': self.version,
            'status': self.status.value,
            'execution_count': self.execution_count,
            'avg_execution_time': (
                self.total_execution_time / self.execution_count
                if self.execution_count > 0 else 0
            ),
            'parameters': [
                {
                    'name': p.name,
                    'type': p.type,
                    'description': p.description,
                    'required': p.required,
                }
                for p in self.get_parameters()
            ],
        }


# =========================================
# BUILT-IN TOOLS
# =========================================

class NetworkScanTool(Tool):
    """Network scanning tool"""
    
    name = "network_scan"
    description = "Scan network for open ports and services"
    category = ToolCategory.NETWORK
    
    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("target", "string", "Target IP or hostname", required=True),
            ToolParameter("ports", "array", "List of ports to scan", required=False, default=[22, 80, 443]),
            ToolParameter("timeout", "number", "Scan timeout in seconds", required=False, default=5),
        ]
    
    async def execute(self, **kwargs) -> ToolResult:
        import socket
        from concurrent.futures import ThreadPoolExecutor
        
        start_time = datetime.utcnow()
        
        target = kwargs.get('target', 'localhost')
        ports = kwargs.get('ports', [22, 80, 443, 993, 995])
        timeout = kwargs.get('timeout', 5)
        
        try:
            def scan_port(port):
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(timeout)
                    result = sock.connect_ex((target, port))
                    sock.close()
                    return port, 'open' if result == 0 else 'closed'
                except:
                    return port, 'filtered'
            
            results = {'target': target, 'open_ports': [], 'closed_ports': [], 'filtered_ports': []}
            
            with ThreadPoolExecutor(max_workers=10) as executor:
                scan_results = list(executor.map(scan_port, ports))
            
            for port, status in scan_results:
                if status == 'open':
                    results['open_ports'].append(port)
                elif status == 'closed':
                    results['closed_ports'].append(port)
                else:
                    results['filtered_ports'].append(port)
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ToolResult(
                success=True,
                data=results,
                execution_time=execution_time,
                metadata={'ports_scanned': len(ports)},
            )
            
        except Exception as e:
            return ToolResult(
                success=False,
                data=None,
                error=str(e),
                execution_time=(datetime.utcnow() - start_time).total_seconds(),
            )


class WebsiteAnalysisTool(Tool):
    """Website security analysis tool"""
    
    name = "website_analysis"
    description = "Analyze website for security issues"
    category = ToolCategory.SECURITY
    
    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("url", "string", "Website URL to analyze", required=True),
            ToolParameter("check_ssl", "boolean", "Check SSL certificate", required=False, default=True),
            ToolParameter("check_headers", "boolean", "Check security headers", required=False, default=True),
        ]
    
    async def execute(self, **kwargs) -> ToolResult:
        import httpx
        import ssl
        from urllib.parse import urlparse
        
        start_time = datetime.utcnow()
        
        url = kwargs.get('url', '')
        check_ssl = kwargs.get('check_ssl', True)
        check_headers = kwargs.get('check_headers', True)
        
        try:
            results = {
                'url': url,
                'ssl': {},
                'headers': {},
                'security_issues': [],
                'risk_score': 0,
            }
            
            # Make request
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                response = await client.get(url)
            
            # Check SSL
            if check_ssl:
                parsed = urlparse(url)
                if parsed.scheme == 'https':
                    results['ssl']['valid'] = True
                    results['ssl']['using_https'] = True
                else:
                    results['ssl']['valid'] = False
                    results['ssl']['using_https'] = False
                    results['security_issues'].append('Not using HTTPS')
                    results['risk_score'] += 30
            
            # Check headers
            if check_headers:
                security_headers = {
                    'Strict-Transport-Security': 'HSTS',
                    'Content-Security-Policy': 'CSP',
                    'X-Frame-Options': 'Clickjacking Protection',
                    'X-Content-Type-Options': 'MIME Sniffing Protection',
                    'X-XSS-Protection': 'XSS Protection',
                }
                
                for header, name in security_headers.items():
                    if header.lower() in [h.lower() for h in response.headers]:
                        results['headers'][header] = 'present'
                    else:
                        results['headers'][header] = 'missing'
                        results['security_issues'].append(f'Missing {name} header')
                        results['risk_score'] += 10
            
            results['risk_level'] = (
                'low' if results['risk_score'] < 30 else
                'medium' if results['risk_score'] < 60 else
                'high'
            )
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ToolResult(
                success=True,
                data=results,
                execution_time=execution_time,
            )
            
        except Exception as e:
            return ToolResult(
                success=False,
                data=None,
                error=str(e),
                execution_time=(datetime.utcnow() - start_time).total_seconds(),
            )


class ThreatDetectionTool(Tool):
    """Threat detection and analysis tool"""
    
    name = "threat_detection"
    description = "Detect and analyze security threats"
    category = ToolCategory.SECURITY
    
    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("data", "string", "Data to analyze for threats", required=True),
            ToolParameter("threat_types", "array", "Types of threats to check", required=False),
        ]
    
    async def execute(self, **kwargs) -> ToolResult:
        start_time = datetime.utcnow()
        
        data = kwargs.get('data', '')
        threat_types = kwargs.get('threat_types', ['malware', 'phishing', 'intrusion'])
        
        try:
            # Simple pattern-based detection (would use ML models in production)
            threats_found = []
            
            suspicious_patterns = {
                'sql_injection': ['SELECT', 'UNION', 'DROP TABLE', "' OR '1'='1"],
                'xss': ['<script>', 'javascript:', 'onerror=', 'onclick='],
                'command_injection': ['; rm -rf', '&& cat /etc/', '| nc '],
                'path_traversal': ['../', '..\\', '%2e%2e%2f'],
            }
            
            for threat_type, patterns in suspicious_patterns.items():
                for pattern in patterns:
                    if pattern.lower() in data.lower():
                        threats_found.append({
                            'type': threat_type,
                            'pattern': pattern,
                            'severity': 'high',
                        })
            
            results = {
                'threats_found': len(threats_found),
                'threats': threats_found,
                'risk_level': 'high' if threats_found else 'low',
                'scanned_at': datetime.utcnow().isoformat(),
            }
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ToolResult(
                success=True,
                data=results,
                execution_time=execution_time,
            )
            
        except Exception as e:
            return ToolResult(
                success=False,
                data=None,
                error=str(e),
                execution_time=(datetime.utcnow() - start_time).total_seconds(),
            )


class DataAnalysisTool(Tool):
    """Data analysis and processing tool"""
    
    name = "data_analysis"
    description = "Analyze and process data"
    category = ToolCategory.DATA
    
    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("data", "object", "Data to analyze", required=True),
            ToolParameter("analysis_type", "string", "Type of analysis", required=False, 
                         default="summary", choices=["summary", "statistics", "patterns"]),
        ]
    
    async def execute(self, **kwargs) -> ToolResult:
        start_time = datetime.utcnow()
        
        data = kwargs.get('data', {})
        analysis_type = kwargs.get('analysis_type', 'summary')
        
        try:
            results = {
                'analysis_type': analysis_type,
                'timestamp': datetime.utcnow().isoformat(),
            }
            
            if analysis_type == 'summary':
                results['summary'] = {
                    'type': type(data).__name__,
                    'size': len(data) if hasattr(data, '__len__') else 1,
                }
            elif analysis_type == 'statistics':
                if isinstance(data, (list, tuple)) and all(isinstance(x, (int, float)) for x in data):
                    results['statistics'] = {
                        'count': len(data),
                        'min': min(data),
                        'max': max(data),
                        'avg': sum(data) / len(data) if data else 0,
                    }
            elif analysis_type == 'patterns':
                results['patterns'] = {'detected': False}
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ToolResult(
                success=True,
                data=results,
                execution_time=execution_time,
            )
            
        except Exception as e:
            return ToolResult(
                success=False,
                data=None,
                error=str(e),
                execution_time=(datetime.utcnow() - start_time).total_seconds(),
            )


class ReportGeneratorTool(Tool):
    """Security report generation tool"""
    
    name = "report_generator"
    description = "Generate security analysis reports"
    category = ToolCategory.REPORTING
    
    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("title", "string", "Report title", required=True),
            ToolParameter("data", "object", "Data to include in report", required=True),
            ToolParameter("format", "string", "Report format", required=False, 
                         default="json", choices=["json", "text", "markdown"]),
        ]
    
    async def execute(self, **kwargs) -> ToolResult:
        start_time = datetime.utcnow()
        
        title = kwargs.get('title', 'Security Report')
        data = kwargs.get('data', {})
        format_type = kwargs.get('format', 'json')
        
        try:
            report = {
                'title': title,
                'generated_at': datetime.utcnow().isoformat(),
                'data': data,
            }
            
            if format_type == 'json':
                output = json.dumps(report, indent=2, default=str)
            elif format_type == 'text':
                output = f"=== {title} ===\n"
                output += f"Generated: {report['generated_at']}\n\n"
                output += json.dumps(data, indent=2, default=str)
            elif format_type == 'markdown':
                output = f"# {title}\n\n"
                output += f"*Generated: {report['generated_at']}*\n\n"
                output += "```json\n" + json.dumps(data, indent=2, default=str) + "\n```"
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ToolResult(
                success=True,
                data={'report': output, 'format': format_type},
                execution_time=execution_time,
            )
            
        except Exception as e:
            return ToolResult(
                success=False,
                data=None,
                error=str(e),
                execution_time=(datetime.utcnow() - start_time).total_seconds(),
            )


class SystemMonitorTool(Tool):
    """System monitoring tool"""
    
    name = "system_monitor"
    description = "Monitor system resources and health"
    category = ToolCategory.MONITORING
    
    def get_parameters(self) -> List[ToolParameter]:
        return [
            ToolParameter("metrics", "array", "Metrics to collect", required=False,
                         default=["cpu", "memory", "disk"]),
        ]
    
    async def execute(self, **kwargs) -> ToolResult:
        import os
        
        start_time = datetime.utcnow()
        
        metrics = kwargs.get('metrics', ['cpu', 'memory', 'disk'])
        
        try:
            results = {
                'timestamp': datetime.utcnow().isoformat(),
                'metrics': {},
            }
            
            # Basic system info without psutil dependency
            if 'cpu' in metrics:
                results['metrics']['cpu'] = {
                    'count': os.cpu_count(),
                    'status': 'available',
                }
            
            if 'memory' in metrics:
                results['metrics']['memory'] = {
                    'status': 'available',
                }
            
            if 'disk' in metrics:
                try:
                    statvfs = os.statvfs('/')
                    total = statvfs.f_blocks * statvfs.f_frsize
                    free = statvfs.f_bfree * statvfs.f_frsize
                    used = total - free
                    results['metrics']['disk'] = {
                        'total_gb': round(total / (1024**3), 2),
                        'used_gb': round(used / (1024**3), 2),
                        'free_gb': round(free / (1024**3), 2),
                        'usage_percent': round((used / total) * 100, 2),
                    }
                except:
                    results['metrics']['disk'] = {'status': 'unavailable'}
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ToolResult(
                success=True,
                data=results,
                execution_time=execution_time,
            )
            
        except Exception as e:
            return ToolResult(
                success=False,
                data=None,
                error=str(e),
                execution_time=(datetime.utcnow() - start_time).total_seconds(),
            )


# =========================================
# TOOL REGISTRY
# =========================================

class ToolRegistry:
    """
    Tool Registry - Manages tool registration and execution
    
    Features:
    - Dynamic tool registration
    - Tool discovery and selection
    - Execution tracking
    - Rate limiting
    """
    
    def __init__(self):
        self.tools: Dict[str, Tool] = {}
        self.tool_categories: Dict[ToolCategory, List[str]] = {}
        self.execution_history: List[Dict[str, Any]] = []
        self._is_initialized = False
        
        logger.info("🔧 Tool Registry initialized")
    
    async def initialize(self):
        """Initialize registry with built-in tools"""
        # Register built-in tools
        built_in_tools = [
            NetworkScanTool(),
            WebsiteAnalysisTool(),
            ThreatDetectionTool(),
            DataAnalysisTool(),
            ReportGeneratorTool(),
            SystemMonitorTool(),
        ]
        
        for tool in built_in_tools:
            self.register(tool)
        
        self._is_initialized = True
        logger.info(f"✅ Tool Registry initialized with {len(self.tools)} tools")
    
    def is_ready(self) -> bool:
        """Check if registry is ready"""
        return self._is_initialized
    
    def register(self, tool: Tool):
        """Register a tool"""
        self.tools[tool.name] = tool
        
        # Index by category
        if tool.category not in self.tool_categories:
            self.tool_categories[tool.category] = []
        self.tool_categories[tool.category].append(tool.name)
        
        logger.info(f"📦 Registered tool: {tool.name} ({tool.category.value})")
    
    def unregister(self, tool_name: str):
        """Unregister a tool"""
        if tool_name in self.tools:
            tool = self.tools[tool_name]
            del self.tools[tool_name]
            
            if tool.category in self.tool_categories:
                self.tool_categories[tool.category] = [
                    n for n in self.tool_categories[tool.category]
                    if n != tool_name
                ]
            
            logger.info(f"🗑️ Unregistered tool: {tool_name}")
    
    def get_tool(self, name: str) -> Optional[Tool]:
        """Get a tool by name"""
        return self.tools.get(name)
    
    def get_tool_for_task(self, task_type: str) -> Optional[Tool]:
        """Get appropriate tool for a task type"""
        # Map task types to tool names
        task_tool_map = {
            'network_scan': 'network_scan',
            'website_analysis': 'website_analysis',
            'threat_detection': 'threat_detection',
            'data_analysis': 'data_analysis',
            'reporting': 'report_generator',
            'monitoring': 'system_monitor',
        }
        
        tool_name = task_tool_map.get(task_type)
        return self.tools.get(tool_name)
    
    def get_tools_by_category(self, category: ToolCategory) -> List[Tool]:
        """Get all tools in a category"""
        tool_names = self.tool_categories.get(category, [])
        return [self.tools[name] for name in tool_names if name in self.tools]
    
    def list_tools(self) -> List[Dict[str, Any]]:
        """List all registered tools"""
        return [tool.to_dict() for tool in self.tools.values()]
    
    def get_schemas(self) -> List[Dict[str, Any]]:
        """Get all tool schemas for LLM function calling"""
        return [tool.get_schema() for tool in self.tools.values()]
    
    async def execute(self, tool_name: str, **kwargs) -> ToolResult:
        """Execute a tool by name"""
        tool = self.tools.get(tool_name)
        
        if not tool:
            return ToolResult(
                success=False,
                data=None,
                error=f"Tool not found: {tool_name}",
            )
        
        if tool.status == ToolStatus.DISABLED:
            return ToolResult(
                success=False,
                data=None,
                error=f"Tool is disabled: {tool_name}",
            )
        
        # Validate parameters
        valid, error = tool.validate_parameters(**kwargs)
        if not valid:
            return ToolResult(
                success=False,
                data=None,
                error=error,
            )
        
        # Execute
        tool.status = ToolStatus.BUSY
        try:
            result = await tool.execute(**kwargs)
            
            # Update tool stats
            tool.execution_count += 1
            tool.total_execution_time += result.execution_time
            tool.last_execution = datetime.utcnow()
            
            if not result.success:
                tool.last_error = result.error
            
            # Record history
            self.execution_history.append({
                'tool': tool_name,
                'success': result.success,
                'execution_time': result.execution_time,
                'timestamp': datetime.utcnow().isoformat(),
            })
            
            # Limit history size
            if len(self.execution_history) > 1000:
                self.execution_history = self.execution_history[-500:]
            
            return result
            
        finally:
            tool.status = ToolStatus.AVAILABLE
    
    def get_status(self) -> Dict[str, Any]:
        """Get registry status"""
        return {
            'is_initialized': self._is_initialized,
            'total_tools': len(self.tools),
            'categories': {
                cat.value: len(tools)
                for cat, tools in self.tool_categories.items()
            },
            'execution_count': len(self.execution_history),
            'tools': self.list_tools(),
        }
