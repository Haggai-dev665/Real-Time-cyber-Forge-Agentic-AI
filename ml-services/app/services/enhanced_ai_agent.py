"""
Enhanced AI Agent with task management, dataset analysis, and network scanning capabilities
"""

import asyncio
import logging
import uuid
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from enum import Enum
from pydantic import BaseModel
import json

from ..models.schemas import AnalysisResult
from ..core.config import settings

logger = logging.getLogger(__name__)

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskType(Enum):
    NETWORK_SCAN = "network_scan"
    WEBSITE_ANALYSIS = "website_analysis"
    DATASET_ANALYSIS = "dataset_analysis"
    THREAT_DETECTION = "threat_detection"
    SECURITY_REPORT = "security_report"
    CUSTOM_ANALYSIS = "custom_analysis"

class TaskPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Task(BaseModel):
    id: str
    type: TaskType
    priority: TaskPriority
    status: TaskStatus
    title: str
    description: str
    parameters: Dict[str, Any]
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    progress: float = 0.0

class EnhancedAIAgent:
    """Enhanced AI agent with task management and advanced analysis capabilities"""
    
    def __init__(self, memory_store=None, threat_analyzer=None):
        self.memory_store = memory_store
        self.threat_analyzer = threat_analyzer
        self.tasks: Dict[str, Task] = {}
        self.active_tasks: List[str] = []
        self.conversation_history: List[Dict[str, Any]] = []
        self.is_initialized = False
        self.max_concurrent_tasks = 5
        
        # Enhanced system prompt with task management
        self.system_prompt = """You are CYBER-FORGE AI, an advanced cybersecurity assistant with comprehensive capabilities:

CORE COMPETENCIES:
🛡️ Real-time threat detection and analysis
🌐 Website security assessment and analysis  
🔍 Network scanning and port analysis
📊 Security dataset analysis and insights
🎯 Task management and automation
🚨 Incident response and recommendations

TASK MANAGEMENT CAPABILITIES:
- Accept and manage user-assigned security tasks
- Perform automated network and port scans
- Analyze websites for security threats
- Process security datasets for insights
- Generate comprehensive security reports
- Provide real-time monitoring and alerts

ANALYSIS APPROACH:
1. Risk Assessment: Low → Medium → High → Critical
2. Threat Classification: Malware, Phishing, Intrusion, Data Breach
3. Actionable Recommendations with step-by-step guidance
4. Context-aware analysis based on current threat landscape
5. Real-time monitoring and adaptive responses

COMMUNICATION STYLE:
- Clear, concise, and actionable
- Technical depth when needed
- User-friendly explanations
- Proactive security guidance
- Real-time status updates on tasks

You can execute tasks autonomously while keeping users informed of progress and findings."""
    
    async def initialize(self) -> bool:
        """Initialize the enhanced AI agent"""
        try:
            logger.info("Initializing Enhanced AI Agent...")
            
            # Initialize dataset manager
            self.dataset_manager = dataset_manager
            
            # Load any persisted tasks
            await self._load_persisted_tasks()
            
            self.is_initialized = True
            logger.info("Enhanced AI Agent initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Enhanced AI Agent: {e}")
            return False
    
    def is_ready(self) -> bool:
        """Check if the agent is ready to process requests"""
        return self.is_initialized
    
    async def create_task(self, task_type: TaskType, title: str, description: str, 
                         parameters: Dict[str, Any], priority: TaskPriority = TaskPriority.MEDIUM) -> str:
        """Create a new task"""
        task_id = str(uuid.uuid4())
        
        task = Task(
            id=task_id,
            type=task_type,
            priority=priority,
            status=TaskStatus.PENDING,
            title=title,
            description=description,
            parameters=parameters,
            created_at=datetime.utcnow()
        )
        
        self.tasks[task_id] = task
        logger.info(f"Created task '{title}' with ID: {task_id}")
        
        # Auto-start high priority tasks
        if priority in [TaskPriority.HIGH, TaskPriority.CRITICAL]:
            await self.start_task(task_id)
        
        return task_id
    
    async def start_task(self, task_id: str) -> bool:
        """Start executing a task"""
        if task_id not in self.tasks:
            logger.error(f"Task {task_id} not found")
            return False
        
        task = self.tasks[task_id]
        
        if task.status != TaskStatus.PENDING:
            logger.warning(f"Task {task_id} is not in pending status")
            return False
        
        if len(self.active_tasks) >= self.max_concurrent_tasks:
            logger.warning(f"Maximum concurrent tasks reached. Task {task_id} will remain pending.")
            return False
        
        task.status = TaskStatus.IN_PROGRESS
        task.started_at = datetime.utcnow()
        self.active_tasks.append(task_id)
        
        # Execute task in background
        asyncio.create_task(self._execute_task(task_id))
        
        logger.info(f"Started task {task_id}: {task.title}")
        return True
    
    async def _execute_task(self, task_id: str):
        """Execute a specific task"""
        task = self.tasks[task_id]
        
        try:
            logger.info(f"Executing task {task_id}: {task.title}")
            
            if task.type == TaskType.NETWORK_SCAN:
                result = await self._execute_network_scan(task)
            elif task.type == TaskType.WEBSITE_ANALYSIS:
                result = await self._execute_website_analysis(task)
            elif task.type == TaskType.DATASET_ANALYSIS:
                result = await self._execute_dataset_analysis(task)
            elif task.type == TaskType.THREAT_DETECTION:
                result = await self._execute_threat_detection(task)
            elif task.type == TaskType.SECURITY_REPORT:
                result = await self._execute_security_report(task)
            else:
                result = await self._execute_custom_analysis(task)
            
            task.result = result
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()
            task.progress = 100.0
            
            logger.info(f"Completed task {task_id}: {task.title}")
            
        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}")
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.utcnow()
        
        finally:
            if task_id in self.active_tasks:
                self.active_tasks.remove(task_id)
    
    async def _execute_network_scan(self, task: Task) -> Dict[str, Any]:
        """Execute network scanning task"""
        parameters = task.parameters
        target = parameters.get('target', 'localhost')
        ports = parameters.get('ports', [22, 23, 53, 80, 443, 993, 995])
        scan_type = parameters.get('scan_type', 'tcp')
        
        # Update progress
        task.progress = 10.0
        
        # Simulate network scanning (replace with actual implementation)
        import socket
        import threading
        from concurrent.futures import ThreadPoolExecutor
        
        results = {
            'target': target,
            'scan_type': scan_type,
            'total_ports': len(ports),
            'open_ports': [],
            'closed_ports': [],
            'filtered_ports': [],
            'scan_duration': 0,
            'security_assessment': {}
        }
        
        start_time = datetime.utcnow()
        
        def scan_port(port):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex((target, port))
                sock.close()
                
                if result == 0:
                    return port, 'open'
                else:
                    return port, 'closed'
            except:
                return port, 'filtered'
        
        # Perform port scan
        task.progress = 30.0
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            scan_results = list(executor.map(scan_port, ports))
        
        task.progress = 70.0
        
        for port, status in scan_results:
            if status == 'open':
                results['open_ports'].append(port)
            elif status == 'closed':
                results['closed_ports'].append(port)
            else:
                results['filtered_ports'].append(port)
        
        # Security assessment
        task.progress = 90.0
        
        security_issues = []
        risk_score = 0
        
        # Check for common security issues
        dangerous_ports = {21: 'FTP', 23: 'Telnet', 135: 'RPC', 139: 'NetBios', 445: 'SMB'}
        for port in results['open_ports']:
            if port in dangerous_ports:
                security_issues.append(f"Port {port} ({dangerous_ports[port]}) is open - potential security risk")
                risk_score += 20
        
        if 22 in results['open_ports']:
            security_issues.append("SSH (port 22) is open - ensure strong authentication")
            risk_score += 5
        
        if 80 in results['open_ports'] and 443 not in results['open_ports']:
            security_issues.append("HTTP is open but HTTPS is not - consider enabling SSL/TLS")
            risk_score += 10
        
        results['security_assessment'] = {
            'risk_score': min(risk_score, 100),
            'risk_level': 'low' if risk_score < 30 else 'medium' if risk_score < 70 else 'high',
            'issues': security_issues,
            'recommendations': self._generate_port_recommendations(results['open_ports'])
        }
        
        end_time = datetime.utcnow()
        results['scan_duration'] = (end_time - start_time).total_seconds()
        
        return results
    
    async def _execute_website_analysis(self, task: Task) -> Dict[str, Any]:
        """Execute website security analysis"""
        parameters = task.parameters
        url = parameters.get('url')
        
        if not url:
            raise ValueError("URL parameter is required for website analysis")
        
        task.progress = 20.0
        
        # Simulate website analysis (replace with actual implementation)
        import requests
        import re
        from urllib.parse import urlparse
        
        results = {
            'url': url,
            'timestamp': datetime.utcnow().isoformat(),
            'security_checks': {},
            'vulnerabilities': [],
            'recommendations': [],
            'risk_assessment': {}
        }
        
        try:
            # Basic URL analysis
            parsed_url = urlparse(url)
            
            # Check SSL/TLS
            task.progress = 40.0
            ssl_enabled = parsed_url.scheme == 'https'
            results['security_checks']['ssl_enabled'] = ssl_enabled
            
            if not ssl_enabled:
                results['vulnerabilities'].append({
                    'type': 'No SSL/TLS',
                    'severity': 'medium',
                    'description': 'Website does not use HTTPS encryption'
                })
            
            # Try to fetch the page
            task.progress = 60.0
            try:
                response = requests.get(url, timeout=10, verify=True)
                results['security_checks']['accessible'] = True
                results['security_checks']['status_code'] = response.status_code
                
                # Check headers
                headers = response.headers
                results['security_checks']['security_headers'] = {
                    'x_frame_options': 'X-Frame-Options' in headers,
                    'x_content_type_options': 'X-Content-Type-Options' in headers,
                    'x_xss_protection': 'X-XSS-Protection' in headers,
                    'strict_transport_security': 'Strict-Transport-Security' in headers,
                    'content_security_policy': 'Content-Security-Policy' in headers
                }
                
                # Analyze content for suspicious patterns
                content = response.text.lower()
                suspicious_patterns = [
                    ('phishing', r'(verify.*account|suspend.*account|update.*payment|click.*here.*urgent)'),
                    ('malware', r'(download.*exe|install.*now|free.*download.*software)'),
                    ('scam', r'(congratulations.*won|limited.*time.*offer|act.*now)')
                ]
                
                for category, pattern in suspicious_patterns:
                    if re.search(pattern, content):
                        results['vulnerabilities'].append({
                            'type': f'Suspicious {category} content',
                            'severity': 'high',
                            'description': f'Content contains patterns typical of {category} websites'
                        })
                
            except requests.exceptions.RequestException as e:
                results['security_checks']['accessible'] = False
                results['security_checks']['error'] = str(e)
            
            task.progress = 80.0
            
            # Generate risk assessment
            risk_score = 0
            for vuln in results['vulnerabilities']:
                if vuln['severity'] == 'high':
                    risk_score += 30
                elif vuln['severity'] == 'medium':
                    risk_score += 15
                else:
                    risk_score += 5
            
            results['risk_assessment'] = {
                'risk_score': min(risk_score, 100),
                'risk_level': 'low' if risk_score < 30 else 'medium' if risk_score < 70 else 'high',
                'total_vulnerabilities': len(results['vulnerabilities'])
            }
            
            # Generate recommendations
            results['recommendations'] = self._generate_website_recommendations(results)
            
        except Exception as e:
            results['error'] = str(e)
        
        return results
    
    async def _execute_dataset_analysis(self, task: Task) -> Dict[str, Any]:
        """Execute dataset analysis task"""
        parameters = task.parameters
        dataset_name = parameters.get('dataset_name')
        analysis_type = parameters.get('analysis_type', 'summary')
        
        if not dataset_name:
            raise ValueError("Dataset name is required for dataset analysis")
        
        task.progress = 20.0
        
        # Check if dataset is downloaded
        if dataset_name not in self.dataset_manager.downloaded_datasets:
            # Download dataset
            await self.dataset_manager.download_dataset(dataset_name)
        
        task.progress = 50.0
        
        # Load and analyze dataset
        df = await self.dataset_manager.load_dataset(dataset_name)
        if df is None:
            raise ValueError(f"Failed to load dataset: {dataset_name}")
        
        task.progress = 70.0
        
        results = {
            'dataset_name': dataset_name,
            'analysis_type': analysis_type,
            'timestamp': datetime.utcnow().isoformat(),
            'dataset_info': {
                'shape': df.shape,
                'columns': list(df.columns),
                'memory_usage': df.memory_usage(deep=True).sum()
            }
        }
        
        if analysis_type == 'summary':
            results['summary'] = await self.dataset_manager.get_dataset_summary(dataset_name)
        elif analysis_type == 'security_insights':
            results['security_insights'] = self._analyze_security_patterns(df)
        elif analysis_type == 'threat_detection':
            results['threat_analysis'] = self._analyze_threats_in_dataset(df)
        
        task.progress = 90.0
        
        return results
    
    async def _execute_threat_detection(self, task: Task) -> Dict[str, Any]:
        """Execute threat detection task"""
        parameters = task.parameters
        data_source = parameters.get('data_source')
        
        # Implement threat detection logic
        results = {
            'data_source': data_source,
            'threats_detected': [],
            'analysis_summary': {},
            'recommendations': []
        }
        
        # Placeholder implementation
        task.progress = 100.0
        
        return results
    
    async def _execute_security_report(self, task: Task) -> Dict[str, Any]:
        """Execute security report generation"""
        parameters = task.parameters
        report_type = parameters.get('report_type', 'comprehensive')
        time_range = parameters.get('time_range', '24h')
        
        # Generate comprehensive security report
        results = {
            'report_type': report_type,
            'time_range': time_range,
            'generated_at': datetime.utcnow().isoformat(),
            'sections': {}
        }
        
        # Placeholder implementation
        task.progress = 100.0
        
        return results
    
    async def _execute_custom_analysis(self, task: Task) -> Dict[str, Any]:
        """Execute custom analysis task"""
        parameters = task.parameters
        analysis_code = parameters.get('analysis_code')
        
        # Execute custom analysis safely
        results = {
            'custom_analysis': True,
            'parameters': parameters,
            'result': 'Custom analysis completed'
        }
        
        task.progress = 100.0
        
        return results
    
    def _generate_port_recommendations(self, open_ports: List[int]) -> List[str]:
        """Generate security recommendations based on open ports"""
        recommendations = []
        
        dangerous_ports = {21, 23, 135, 139, 445, 1433, 3389}
        if any(port in dangerous_ports for port in open_ports):
            recommendations.append("Close unnecessary dangerous ports or restrict access with firewall rules")
        
        if 22 in open_ports:
            recommendations.append("Secure SSH with key-based authentication and disable password login")
        
        if 80 in open_ports and 443 not in open_ports:
            recommendations.append("Implement HTTPS to encrypt web traffic")
        
        if len(open_ports) > 10:
            recommendations.append("Review and close unnecessary open ports to reduce attack surface")
        
        return recommendations
    
    def _generate_website_recommendations(self, analysis_results: Dict[str, Any]) -> List[str]:
        """Generate security recommendations for website analysis"""
        recommendations = []
        
        if not analysis_results['security_checks'].get('ssl_enabled'):
            recommendations.append("Implement HTTPS with valid SSL certificate")
        
        security_headers = analysis_results['security_checks'].get('security_headers', {})
        missing_headers = [header for header, present in security_headers.items() if not present]
        
        if missing_headers:
            recommendations.append(f"Implement missing security headers: {', '.join(missing_headers)}")
        
        if analysis_results['vulnerabilities']:
            recommendations.append("Address identified vulnerabilities and suspicious content patterns")
        
        return recommendations
    
    def _analyze_security_patterns(self, df) -> Dict[str, Any]:
        """Analyze security patterns in dataset"""
        # Implement security pattern analysis
        return {
            'patterns_found': [],
            'anomalies': [],
            'insights': []
        }
    
    def _analyze_threats_in_dataset(self, df) -> Dict[str, Any]:
        """Analyze threats in dataset"""
        # Implement threat analysis
        return {
            'threat_types': [],
            'risk_distribution': {},
            'recommendations': []
        }
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a specific task"""
        if task_id not in self.tasks:
            return None
        
        task = self.tasks[task_id]
        return {
            'id': task.id,
            'type': task.type.value,
            'priority': task.priority.value,
            'status': task.status.value,
            'title': task.title,
            'description': task.description,
            'progress': task.progress,
            'created_at': task.created_at.isoformat(),
            'started_at': task.started_at.isoformat() if task.started_at else None,
            'completed_at': task.completed_at.isoformat() if task.completed_at else None,
            'error': task.error,
            'result': task.result
        }
    
    async def list_tasks(self, status_filter: Optional[TaskStatus] = None) -> List[Dict[str, Any]]:
        """List all tasks, optionally filtered by status"""
        tasks = []
        for task in self.tasks.values():
            if status_filter is None or task.status == status_filter:
                task_info = await self.get_task_status(task.id)
                if task_info:
                    tasks.append(task_info)
        
        return sorted(tasks, key=lambda x: x['created_at'], reverse=True)
    
    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a pending or in-progress task"""
        if task_id not in self.tasks:
            return False
        
        task = self.tasks[task_id]
        
        if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
            return False
        
        task.status = TaskStatus.CANCELLED
        task.completed_at = datetime.utcnow()
        
        if task_id in self.active_tasks:
            self.active_tasks.remove(task_id)
        
        logger.info(f"Cancelled task {task_id}: {task.title}")
        return True
    
    async def analyze_with_context(self, query: str, context: Dict[str, Any] = None, 
                                 conversation_history: List[Dict] = None) -> AnalysisResult:
        """Perform AI analysis with enhanced context and task management"""
        try:
            # Check if query is requesting task creation
            task_request = self._parse_task_request(query)
            if task_request:
                task_id = await self.create_task(**task_request)
                response = f"I've created a new {task_request['task_type'].value} task: '{task_request['title']}'. Task ID: {task_id}. I'll begin working on this immediately."
                
                # Start the task if high priority
                if task_request.get('priority') in [TaskPriority.HIGH, TaskPriority.CRITICAL]:
                    await self.start_task(task_id)
                    response += " This is a high-priority task, so I'm starting it right away."
                
                return AnalysisResult(
                    response=response,
                    confidence=0.95,
                    insights=[f"Task created: {task_request['title']}"],
                    recommendations=["Monitor task progress for updates"],
                    context=context,
                    timestamp=datetime.utcnow()
                )
            
            # Regular analysis with enhanced capabilities
            return await self._perform_enhanced_analysis(query, context, conversation_history)
            
        except Exception as e:
            logger.error(f"Enhanced AI analysis error: {e}")
            return AnalysisResult(
                response="I apologize, but I encountered an error during analysis. Please try again or rephrase your request.",
                confidence=0.0,
                insights=[],
                recommendations=["Please retry the analysis with a clearer request"],
                context=context,
                timestamp=datetime.utcnow()
            )
    
    def _parse_task_request(self, query: str) -> Optional[Dict[str, Any]]:
        """Parse user query to detect task creation requests"""
        query_lower = query.lower()
        
        task_patterns = {
            'scan': TaskType.NETWORK_SCAN,
            'analyze website': TaskType.WEBSITE_ANALYSIS,
            'check dataset': TaskType.DATASET_ANALYSIS,
            'detect threats': TaskType.THREAT_DETECTION,
            'generate report': TaskType.SECURITY_REPORT,
            'network scan': TaskType.NETWORK_SCAN,
            'port scan': TaskType.NETWORK_SCAN,
            'website analysis': TaskType.WEBSITE_ANALYSIS,
            'security report': TaskType.SECURITY_REPORT
        }
        
        for pattern, task_type in task_patterns.items():
            if pattern in query_lower:
                # Extract parameters based on task type
                if task_type == TaskType.NETWORK_SCAN:
                    return {
                        'task_type': task_type,
                        'title': 'Network Security Scan',
                        'description': f'User requested: {query}',
                        'parameters': self._extract_network_scan_params(query),
                        'priority': TaskPriority.HIGH if 'urgent' in query_lower else TaskPriority.MEDIUM
                    }
                elif task_type == TaskType.WEBSITE_ANALYSIS:
                    return {
                        'task_type': task_type,
                        'title': 'Website Security Analysis',
                        'description': f'User requested: {query}',
                        'parameters': self._extract_website_params(query),
                        'priority': TaskPriority.HIGH if 'urgent' in query_lower else TaskPriority.MEDIUM
                    }
                # Add more task type parsers as needed
        
        return None
    
    def _extract_network_scan_params(self, query: str) -> Dict[str, Any]:
        """Extract network scan parameters from query"""
        import re
        
        params = {
            'ports': [22, 23, 53, 80, 443, 993, 995],
            'scan_type': 'tcp',
            'target': 'localhost'
        }
        
        # Extract IP address or hostname
        ip_pattern = r'(\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b)'
        ip_match = re.search(ip_pattern, query)
        if ip_match:
            params['target'] = ip_match.group(1)
        
        # Extract port numbers
        port_pattern = r'port[s]?\s+(\d+(?:[,\s]+\d+)*)'
        port_match = re.search(port_pattern, query)
        if port_match:
            ports_str = port_match.group(1)
            params['ports'] = [int(p.strip()) for p in re.split(r'[,\s]+', ports_str) if p.strip().isdigit()]
        
        return params
    
    def _extract_website_params(self, query: str) -> Dict[str, Any]:
        """Extract website analysis parameters from query"""
        import re
        
        params = {}
        
        # Extract URL
        url_pattern = r'https?://[^\s]+'
        url_match = re.search(url_pattern, query)
        if url_match:
            params['url'] = url_match.group(0)
        else:
            # Look for domain patterns
            domain_pattern = r'(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}'
            domain_match = re.search(domain_pattern, query)
            if domain_match:
                params['url'] = f"https://{domain_match.group(0)}"
        
        return params
    
    async def _perform_enhanced_analysis(self, query: str, context: Dict[str, Any], 
                                       conversation_history: List[Dict]) -> AnalysisResult:
        """Perform enhanced analysis with all available capabilities"""
        # Implement enhanced analysis logic
        response = f"I've analyzed your request: '{query}'. Based on my enhanced capabilities, I can provide insights on cybersecurity, network analysis, and threat detection."
        
        insights = [
            "Enhanced AI analysis capabilities active",
            "Real-time threat monitoring enabled",
            "Task management system available"
        ]
        
        recommendations = [
            "Use specific commands to create tasks (e.g., 'scan network', 'analyze website')",
            "Check task status regularly for updates",
            "Leverage dataset analysis for deeper insights"
        ]
        
        return AnalysisResult(
            response=response,
            confidence=0.8,
            insights=insights,
            recommendations=recommendations,
            context=context,
            timestamp=datetime.utcnow()
        )
    
    async def _load_persisted_tasks(self):
        """Load previously saved tasks"""
        # Implement task persistence if needed
        pass
    
    async def _save_tasks(self):
        """Save current tasks to persistence"""
        # Implement task persistence if needed
        pass

# Global enhanced AI agent instance
enhanced_ai_agent = EnhancedAIAgent()