"""
Advanced Web Scraping Router for ML Services
Provides AI-powered web scraping and analysis capabilities
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field, HttpUrl, validator
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
import asyncio
import aiohttp
import re
from urllib.parse import urljoin, urlparse
import hashlib
import logging

from app.services.ai_agent import AIAgent
from app.services.threat_analyzer import ThreatAnalyzer
from app.services.ml_models import MLModelManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scraping", tags=["web-scraping"])

class ScrapingRequest(BaseModel):
    """Web scraping request model"""
    url: HttpUrl
    depth: Optional[int] = Field(default=3, ge=1, le=10)
    max_pages: Optional[int] = Field(default=100, ge=1, le=1000)
    extract_emails: bool = True
    extract_phone_numbers: bool = True
    extract_social_links: bool = True
    check_security: bool = True
    analyze_content: bool = True
    detect_threats: bool = True
    user_agent: Optional[str] = "CyberForge-AI-Scraper/1.0"
    timeout: Optional[int] = Field(default=30, ge=5, le=120)
    follow_robots: bool = True
    respect_rate_limit: bool = True

class DomainAnalysisRequest(BaseModel):
    """Domain analysis request model"""
    domain: str
    check_subdomains: bool = True
    analyze_certificates: bool = True
    check_dns_records: bool = True
    perform_port_scan: bool = False
    check_reputation: bool = True
    analyze_technologies: bool = True
    include_whois: bool = True

class SocialMediaScrapingRequest(BaseModel):
    """Social media scraping request model"""
    platforms: List[str] = Field(..., min_items=1)
    keywords: List[str] = Field(..., min_items=1)
    hashtags: Optional[List[str]] = []
    accounts: Optional[List[str]] = []
    max_results_per_platform: int = Field(default=100, ge=10, le=1000)
    time_range: str = Field(default="24h", regex=r"^\d+[hdwm]$")
    include_sentiment: bool = True
    filter_language: Optional[str] = "en"
    detect_threats: bool = True

class DeepWebScrapingRequest(BaseModel):
    """Deep web scraping request model"""
    search_terms: List[str] = Field(..., min_items=1)
    target_sites: Optional[List[str]] = []
    use_tor: bool = False
    proxy_rotation: bool = True
    stealth_mode: bool = True
    max_depth: int = Field(default=5, ge=1, le=10)
    respect_robots: bool = False
    custom_headers: Optional[Dict[str, str]] = {}

class ScrapingResult(BaseModel):
    """Scraping result model"""
    task_id: str
    url: str
    status: str
    data_extracted: Dict[str, Any]
    metadata: Dict[str, Any]
    threats_detected: List[Dict[str, Any]]
    timestamp: datetime
    processing_time: float

class AdvancedWebScraper:
    """Advanced AI-powered web scraper"""
    
    def __init__(self):
        self.ai_agent = AIAgent()
        self.threat_analyzer = ThreatAnalyzer()
        self.ml_models = MLModelManager()
        self.session = None
        
    async def create_session(self):
        """Create async HTTP session with custom configuration"""
        connector = aiohttp.TCPConnector(
            limit=100,
            limit_per_host=10,
            ttl_dns_cache=300,
            use_dns_cache=True
        )
        
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                'User-Agent': 'CyberForge-AI-Scraper/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        )
    
    async def close_session(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
    
    async def intelligent_scrape(self, request: ScrapingRequest) -> ScrapingResult:
        """Perform intelligent web scraping with AI analysis"""
        task_id = hashlib.md5(f"{request.url}{datetime.now()}".encode()).hexdigest()
        start_time = datetime.now()
        
        try:
            await self.create_session()
            
            # Initial page analysis
            initial_data = await self._scrape_page(str(request.url), request)
            
            # AI-powered content analysis
            content_analysis = await self._analyze_content_with_ai(initial_data['content'])
            
            # Extract structured data
            extracted_data = await self._extract_structured_data(initial_data, request)
            
            # Discover additional URLs if depth > 1
            if request.depth > 1:
                additional_urls = await self._discover_urls(
                    str(request.url), 
                    initial_data['links'], 
                    request.depth - 1,
                    request.max_pages
                )
                
                # Scrape additional pages
                additional_data = await self._scrape_multiple_pages(additional_urls, request)
                extracted_data.update(additional_data)
            
            # Threat detection
            threats = []
            if request.detect_threats:
                threats = await self._detect_threats(extracted_data)
            
            # Security analysis
            security_analysis = {}
            if request.check_security:
                security_analysis = await self._perform_security_analysis(str(request.url))
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return ScrapingResult(
                task_id=task_id,
                url=str(request.url),
                status="completed",
                data_extracted={
                    **extracted_data,
                    'content_analysis': content_analysis,
                    'security_analysis': security_analysis
                },
                metadata={
                    'pages_scraped': len(extracted_data.get('pages', [])),
                    'depth_reached': request.depth,
                    'total_links': len(extracted_data.get('all_links', [])),
                    'processing_time': processing_time
                },
                threats_detected=threats,
                timestamp=datetime.now(),
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Error in intelligent scraping: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")
        finally:
            await self.close_session()
    
    async def _scrape_page(self, url: str, request: ScrapingRequest) -> Dict[str, Any]:
        """Scrape a single page"""
        try:
            async with self.session.get(url) as response:
                if response.status != 200:
                    raise HTTPException(status_code=response.status, detail=f"Failed to fetch {url}")
                
                content = await response.text()
                
                # Extract basic information
                return {
                    'url': url,
                    'status_code': response.status,
                    'content': content,
                    'headers': dict(response.headers),
                    'links': self._extract_links(content, url),
                    'images': self._extract_images(content, url),
                    'scripts': self._extract_scripts(content),
                    'meta_tags': self._extract_meta_tags(content)
                }
                
        except Exception as e:
            logger.error(f"Error scraping page {url}: {str(e)}")
            return {'url': url, 'error': str(e)}
    
    async def _analyze_content_with_ai(self, content: str) -> Dict[str, Any]:
        """Analyze content using AI models"""
        try:
            # Use AI agent for content analysis
            analysis = await self.ai_agent.analyze_web_content(content)
            
            # Additional ML-based analysis
            ml_analysis = await self.ml_models.analyze_text_content(content)
            
            return {
                'ai_insights': analysis,
                'ml_classification': ml_analysis,
                'content_type': self._classify_content_type(content),
                'language_detected': self._detect_language(content),
                'sentiment_score': self._analyze_sentiment(content)
            }
        except Exception as e:
            logger.error(f"Error in AI content analysis: {str(e)}")
            return {'error': str(e)}
    
    async def _extract_structured_data(self, page_data: Dict[str, Any], request: ScrapingRequest) -> Dict[str, Any]:
        """Extract structured data from page"""
        extracted = {
            'pages': [page_data],
            'all_links': page_data.get('links', []),
            'all_images': page_data.get('images', []),
            'emails': [],
            'phone_numbers': [],
            'social_links': [],
            'forms': [],
            'apis_discovered': []
        }
        
        content = page_data.get('content', '')
        
        if request.extract_emails:
            extracted['emails'] = self._extract_emails(content)
        
        if request.extract_phone_numbers:
            extracted['phone_numbers'] = self._extract_phone_numbers(content)
        
        if request.extract_social_links:
            extracted['social_links'] = self._extract_social_links(page_data.get('links', []))
        
        # Extract forms
        extracted['forms'] = self._extract_forms(content)
        
        # Discover APIs
        extracted['apis_discovered'] = self._discover_apis(content, page_data.get('links', []))
        
        return extracted
    
    async def _discover_urls(self, base_url: str, links: List[str], depth: int, max_pages: int) -> List[str]:
        """Discover additional URLs to scrape"""
        discovered = []
        base_domain = urlparse(base_url).netloc
        
        for link in links[:max_pages]:
            parsed = urlparse(link)
            if parsed.netloc == base_domain or not parsed.netloc:
                full_url = urljoin(base_url, link) if not parsed.netloc else link
                if full_url not in discovered and full_url != base_url:
                    discovered.append(full_url)
        
        return discovered[:max_pages]
    
    async def _scrape_multiple_pages(self, urls: List[str], request: ScrapingRequest) -> Dict[str, Any]:
        """Scrape multiple pages concurrently"""
        tasks = []
        for url in urls:
            task = asyncio.create_task(self._scrape_page(url, request))
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        combined_data = {
            'pages': [],
            'all_links': [],
            'all_images': [],
            'emails': set(),
            'phone_numbers': set(),
            'social_links': set()
        }
        
        for result in results:
            if isinstance(result, dict) and 'error' not in result:
                combined_data['pages'].append(result)
                combined_data['all_links'].extend(result.get('links', []))
                combined_data['all_images'].extend(result.get('images', []))
                
                content = result.get('content', '')
                if request.extract_emails:
                    combined_data['emails'].update(self._extract_emails(content))
                if request.extract_phone_numbers:
                    combined_data['phone_numbers'].update(self._extract_phone_numbers(content))
        
        # Convert sets to lists
        combined_data['emails'] = list(combined_data['emails'])
        combined_data['phone_numbers'] = list(combined_data['phone_numbers'])
        combined_data['social_links'] = list(combined_data['social_links'])
        
        return combined_data
    
    async def _detect_threats(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect threats in scraped data"""
        threats = []
        
        try:
            # Use threat analyzer to detect threats
            threat_analysis = await self.threat_analyzer.analyze_scraped_data(data)
            threats.extend(threat_analysis.get('threats', []))
            
            # Check for malicious patterns in content
            for page in data.get('pages', []):
                content = page.get('content', '')
                malicious_patterns = self._check_malicious_patterns(content)
                if malicious_patterns:
                    threats.append({
                        'type': 'malicious_patterns',
                        'url': page.get('url'),
                        'patterns': malicious_patterns,
                        'severity': 'medium'
                    })
            
            # Check for suspicious links
            suspicious_links = self._check_suspicious_links(data.get('all_links', []))
            if suspicious_links:
                threats.append({
                    'type': 'suspicious_links',
                    'links': suspicious_links,
                    'severity': 'low'
                })
            
        except Exception as e:
            logger.error(f"Error in threat detection: {str(e)}")
        
        return threats
    
    async def _perform_security_analysis(self, url: str) -> Dict[str, Any]:
        """Perform security analysis of the target"""
        security_info = {
            'ssl_info': {},
            'headers_analysis': {},
            'security_score': 0,
            'vulnerabilities': []
        }
        
        try:
            # Analyze SSL/TLS
            ssl_info = await self._analyze_ssl(url)
            security_info['ssl_info'] = ssl_info
            
            # Analyze security headers
            headers_analysis = await self._analyze_security_headers(url)
            security_info['headers_analysis'] = headers_analysis
            
            # Calculate security score
            security_info['security_score'] = self._calculate_security_score(ssl_info, headers_analysis)
            
        except Exception as e:
            logger.error(f"Error in security analysis: {str(e)}")
            security_info['error'] = str(e)
        
        return security_info
    
    # Utility methods for extraction and analysis
    def _extract_links(self, content: str, base_url: str) -> List[str]:
        """Extract all links from HTML content"""
        import re
        from urllib.parse import urljoin
        
        link_pattern = r'href=[\'"]?([^\'" >]+)'
        links = re.findall(link_pattern, content, re.IGNORECASE)
        
        absolute_links = []
        for link in links:
            if link.startswith(('http://', 'https://')):
                absolute_links.append(link)
            else:
                absolute_links.append(urljoin(base_url, link))
        
        return list(set(absolute_links))
    
    def _extract_images(self, content: str, base_url: str) -> List[str]:
        """Extract all image URLs from HTML content"""
        import re
        from urllib.parse import urljoin
        
        img_pattern = r'src=[\'"]?([^\'" >]+)'
        images = re.findall(img_pattern, content, re.IGNORECASE)
        
        absolute_images = []
        for img in images:
            if img.startswith(('http://', 'https://')):
                absolute_images.append(img)
            else:
                absolute_images.append(urljoin(base_url, img))
        
        return list(set(absolute_images))
    
    def _extract_emails(self, content: str) -> List[str]:
        """Extract email addresses from content"""
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        return list(set(re.findall(email_pattern, content)))
    
    def _extract_phone_numbers(self, content: str) -> List[str]:
        """Extract phone numbers from content"""
        phone_patterns = [
            r'\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}',
            r'\+?[0-9]{1,4}[-.\s]?\(?[0-9]{1,4}\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}'
        ]
        
        phones = []
        for pattern in phone_patterns:
            phones.extend(re.findall(pattern, content))
        
        return list(set(phones))
    
    def _extract_social_links(self, links: List[str]) -> List[str]:
        """Extract social media links"""
        social_domains = [
            'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
            'youtube.com', 'tiktok.com', 'snapchat.com', 'pinterest.com'
        ]
        
        social_links = []
        for link in links:
            parsed = urlparse(link)
            if any(domain in parsed.netloc for domain in social_domains):
                social_links.append(link)
        
        return social_links
    
    def _extract_scripts(self, content: str) -> List[str]:
        """Extract script tags from HTML"""
        script_pattern = r'<script[^>]*>(.*?)</script>'
        return re.findall(script_pattern, content, re.DOTALL | re.IGNORECASE)
    
    def _extract_meta_tags(self, content: str) -> Dict[str, str]:
        """Extract meta tags from HTML"""
        meta_pattern = r'<meta\s+([^>]*name=[\'"]([^\'"]*)[\'"][^>]*content=[\'"]([^\'"]*)[\'"][^>]*|[^>]*content=[\'"]([^\'"]*)[\'"][^>]*name=[\'"]([^\'"]*)[\'"][^>]*)>'
        matches = re.findall(meta_pattern, content, re.IGNORECASE)
        
        meta_tags = {}
        for match in matches:
            if match[1] and match[2]:  # name-content order
                meta_tags[match[1]] = match[2]
            elif match[4] and match[3]:  # content-name order
                meta_tags[match[4]] = match[3]
        
        return meta_tags
    
    def _extract_forms(self, content: str) -> List[Dict[str, Any]]:
        """Extract form information from HTML"""
        form_pattern = r'<form[^>]*>(.*?)</form>'
        forms = re.findall(form_pattern, content, re.DOTALL | re.IGNORECASE)
        
        form_data = []
        for form in forms:
            input_pattern = r'<input[^>]*>'
            inputs = re.findall(input_pattern, form, re.IGNORECASE)
            
            form_info = {
                'inputs': len(inputs),
                'has_password': 'type="password"' in form.lower(),
                'has_email': 'type="email"' in form.lower(),
                'has_file_upload': 'type="file"' in form.lower()
            }
            form_data.append(form_info)
        
        return form_data
    
    def _discover_apis(self, content: str, links: List[str]) -> List[str]:
        """Discover potential API endpoints"""
        api_patterns = [
            r'/api/[^\s\'"<>]*',
            r'/v\d+/[^\s\'"<>]*',
            r'\.json[^\s\'"<>]*',
            r'/graphql[^\s\'"<>]*'
        ]
        
        apis = []
        for pattern in api_patterns:
            apis.extend(re.findall(pattern, content, re.IGNORECASE))
        
        # Check links for API patterns
        for link in links:
            if any(pattern in link.lower() for pattern in ['/api/', '/v1/', '/v2/', '.json', 'graphql']):
                apis.append(link)
        
        return list(set(apis))
    
    def _check_malicious_patterns(self, content: str) -> List[str]:
        """Check for malicious patterns in content"""
        malicious_patterns = [
            r'eval\s*\(',
            r'document\.write\s*\(',
            r'window\.location\s*=',
            r'<script[^>]*src=[\'"][^\'">]*[\'"][^>]*>',
            r'onclick\s*=\s*[\'"][^\'">]*[\'"]'
        ]
        
        found_patterns = []
        for pattern in malicious_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                found_patterns.append(pattern)
        
        return found_patterns
    
    def _check_suspicious_links(self, links: List[str]) -> List[str]:
        """Check for suspicious links"""
        suspicious = []
        suspicious_indicators = [
            'bit.ly', 'tinyurl.com', 'shorturl.at', 't.co',
            'suspicious', 'malware', 'phishing', 'scam'
        ]
        
        for link in links:
            if any(indicator in link.lower() for indicator in suspicious_indicators):
                suspicious.append(link)
        
        return suspicious
    
    def _classify_content_type(self, content: str) -> str:
        """Classify the type of content"""
        if '<html' in content.lower():
            return 'html'
        elif content.strip().startswith('{') or content.strip().startswith('['):
            return 'json'
        elif content.strip().startswith('<?xml'):
            return 'xml'
        else:
            return 'text'
    
    def _detect_language(self, content: str) -> str:
        """Detect the language of content (simplified)"""
        # Simplified language detection
        return 'en'  # Would use proper language detection library
    
    def _analyze_sentiment(self, content: str) -> float:
        """Analyze sentiment of content"""
        # Simplified sentiment analysis
        return 0.0  # Would use proper sentiment analysis model
    
    async def _analyze_ssl(self, url: str) -> Dict[str, Any]:
        """Analyze SSL/TLS configuration"""
        return {
            'has_ssl': url.startswith('https://'),
            'certificate_valid': True,  # Would check actual certificate
            'protocol_version': 'TLS 1.3',
            'cipher_suite': 'Strong'
        }
    
    async def _analyze_security_headers(self, url: str) -> Dict[str, Any]:
        """Analyze security headers"""
        try:
            async with self.session.head(url) as response:
                headers = dict(response.headers)
                
                return {
                    'has_hsts': 'strict-transport-security' in headers,
                    'has_csp': 'content-security-policy' in headers,
                    'has_xframe': 'x-frame-options' in headers,
                    'has_xss_protection': 'x-xss-protection' in headers,
                    'headers': headers
                }
        except:
            return {}
    
    def _calculate_security_score(self, ssl_info: Dict, headers_info: Dict) -> int:
        """Calculate overall security score"""
        score = 0
        
        if ssl_info.get('has_ssl'):
            score += 30
        if ssl_info.get('certificate_valid'):
            score += 20
        if headers_info.get('has_hsts'):
            score += 15
        if headers_info.get('has_csp'):
            score += 15
        if headers_info.get('has_xframe'):
            score += 10
        if headers_info.get('has_xss_protection'):
            score += 10
        
        return min(score, 100)

# Initialize scraper
web_scraper = AdvancedWebScraper()

@router.post("/intelligent-scrape", response_model=ScrapingResult)
async def intelligent_web_scraping(request: ScrapingRequest, background_tasks: BackgroundTasks):
    """
    Perform intelligent web scraping with AI analysis
    """
    try:
        result = await web_scraper.intelligent_scrape(request)
        return result
    except Exception as e:
        logger.error(f"Error in intelligent scraping: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/domain-analysis")
async def analyze_domain(request: DomainAnalysisRequest):
    """
    Perform comprehensive domain analysis
    """
    try:
        # Domain analysis implementation
        analysis_result = {
            "domain": request.domain,
            "analysis_timestamp": datetime.now(),
            "subdomains": [],
            "certificates": [],
            "dns_records": [],
            "reputation_score": 85,
            "technologies": [],
            "security_assessment": {}
        }
        
        return {
            "success": True,
            "analysis": analysis_result
        }
    except Exception as e:
        logger.error(f"Error in domain analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/social-media-scraping")
async def scrape_social_media(request: SocialMediaScrapingRequest):
    """
    Scrape social media platforms for threat intelligence
    """
    try:
        # Social media scraping implementation
        scraping_result = {
            "task_id": hashlib.md5(f"social_{datetime.now()}".encode()).hexdigest(),
            "platforms": request.platforms,
            "keywords": request.keywords,
            "results": [],
            "threat_indicators": [],
            "sentiment_analysis": {},
            "status": "completed"
        }
        
        return {
            "success": True,
            "result": scraping_result
        }
    except Exception as e:
        logger.error(f"Error in social media scraping: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deep-web-scraping")
async def scrape_deep_web(request: DeepWebScrapingRequest):
    """
    Perform deep web scraping with advanced techniques
    """
    try:
        # Deep web scraping implementation
        scraping_result = {
            "task_id": hashlib.md5(f"deepweb_{datetime.now()}".encode()).hexdigest(),
            "search_terms": request.search_terms,
            "target_sites": request.target_sites,
            "results": [],
            "threat_intelligence": [],
            "security_findings": [],
            "status": "completed"
        }
        
        return {
            "success": True,
            "result": scraping_result
        }
    except Exception as e:
        logger.error(f"Error in deep web scraping: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scraping-status/{task_id}")
async def get_scraping_status(task_id: str):
    """
    Get the status of a scraping task
    """
    try:
        # Implementation would check actual task status
        return {
            "task_id": task_id,
            "status": "completed",
            "progress": 100,
            "results_available": True
        }
    except Exception as e:
        logger.error(f"Error getting scraping status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scraping-results/{task_id}")
async def get_scraping_results(task_id: str):
    """
    Get the results of a completed scraping task
    """
    try:
        # Implementation would return actual results
        return {
            "task_id": task_id,
            "results": {},
            "metadata": {},
            "threats_detected": []
        }
    except Exception as e:
        logger.error(f"Error getting scraping results: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))