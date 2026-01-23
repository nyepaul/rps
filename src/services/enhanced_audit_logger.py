"""Enhanced audit logging service with comprehensive data collection."""
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from flask import request, has_request_context, session
from flask_login import current_user
from src.database.connection import db
import re
from user_agents import parse as parse_user_agent
from src.services.ip_intelligence import ip_intelligence
import socket
import dns.resolver
import dns.reversename

# Geolocation cache to prevent hitting rate limits
# Cache structure: {ip_address: {'data': {...}, 'timestamp': datetime}}
_geo_cache = {}
_GEO_CACHE_TTL = timedelta(hours=24)  # Cache for 24 hours

# DNS resolution cache to prevent repeated lookups
_dns_cache = {}
_DNS_CACHE_TTL = timedelta(hours=12)  # Cache for 12 hours


class AuditConfig:
    """Configuration for audit logging - what to collect and display."""

    # Default configuration
    DEFAULT_CONFIG = {
        'enabled': True,
        'collect': {
            'ip_address': True,  # Uses CF-Connecting-IP when behind Cloudflare
            'user_agent': True,
            'geo_location': True,  # Enhanced with CF-IPCountry when available
            'request_method': True,
            'request_endpoint': True,
            'request_headers': False,  # Privacy: off by default (CF metadata stored regardless)
            'request_body_size': True,
            'response_status': True,
            'session_id': True,
            'referrer': True,
            'device_info': True,
            'browser_info': True,
            'os_info': True,
            'login_attempts': True,
            'failed_actions': True,
            'cloudflare_metadata': True,  # CF-Ray, CF-IPCountry, CF-Cache-Status, etc.
            'browser_fingerprint': True,  # Language, encoding, screen size, timezone
            'risk_scoring': True,  # Security risk assessment (bot detection, automation tools)
            'session_metadata': True,  # Session age, size, authentication state
            'ip_intelligence': True,  # IP analysis, VPN/proxy detection, reverse DNS
            'client_hints': True,  # Sec-CH-UA headers for detailed browser info
            'response_timing': True,  # Response time/latency measurement
            'client_fingerprint': True,  # Canvas, WebGL, audio fingerprints from client
            'session_analytics': True,  # Engagement score, scroll depth, clicks
            'performance_metrics': True,  # Page load timing, resource counts
            'reverse_dns': True,  # Reverse DNS hostname lookup for IP addresses
            'asn_lookup': True,  # Autonomous System Number and ISP information
            'http_protocol': True,  # HTTP/1.1 vs HTTP/2 detection
            'tls_info': True,  # TLS/SSL connection information if available
            'network_metadata': True  # Additional TCP/IP connection details
        },
        'display': {
            'ip_address': True,
            'user_agent': True,
            'geo_location': True,
            'request_method': True,
            'request_endpoint': True,
            'request_headers': False,  # Privacy: off by default
            'request_body_size': True,
            'response_status': True,
            'session_id': False,  # Privacy: hide by default in UI
            'referrer': True,
            'device_info': True,
            'browser_info': True,
            'os_info': True,
            'login_attempts': True,
            'failed_actions': True,
            'cloudflare_metadata': True,  # Show CF-Ray, CF-IPCountry, etc.
            'browser_fingerprint': True,  # Show language, screen size, etc.
            'risk_scoring': True,  # Show risk assessment
            'session_metadata': True,  # Show session details
            'ip_intelligence': True,  # Show IP analysis, VPN detection
            'client_hints': True,  # Show Sec-CH-UA data
            'response_timing': True,  # Show response latency
            'client_fingerprint': True,  # Show canvas/WebGL/audio fingerprints
            'session_analytics': True,  # Show engagement metrics
            'performance_metrics': True,  # Show page load metrics
            'reverse_dns': True,  # Show reverse DNS hostname
            'asn_lookup': True,  # Show ASN and ISP data
            'http_protocol': True,  # Show HTTP protocol version
            'tls_info': True,  # Show TLS/SSL info
            'network_metadata': True  # Show network connection details
        },
        'retention_days': 90,
        'log_read_operations': False,  # Can generate lots of logs
        'sensitive_endpoints': [
            '/api/auth/login',
            '/api/auth/register',
            '/api/profiles',
            '/api/admin'
        ]
    }

    @staticmethod
    def get_config() -> Dict[str, Any]:
        """Get current audit configuration from database or default."""
        try:
            row = db.execute_one(
                'SELECT config_data FROM audit_config WHERE id = 1'
            )
            if row and row['config_data']:
                return json.loads(row['config_data'])
        except Exception:
            pass
        return AuditConfig.DEFAULT_CONFIG.copy()

    @staticmethod
    def set_config(config: Dict[str, Any]):
        """Save audit configuration to database."""
        config_json = json.dumps(config)
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO audit_config (id, config_data, updated_at)
                VALUES (1, ?, ?)
            ''', (config_json, datetime.now().isoformat()))
            conn.commit()


class EnhancedAuditLogger:
    """Enhanced audit logger with comprehensive data collection."""

    @staticmethod
    def _get_geo_location(ip_address: str) -> Optional[Dict[str, str]]:
        """
        Get geographic location from IP address using ip-api.com.

        Results are cached for 24 hours to prevent hitting rate limits
        and improve performance.
        """
        if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1']:
            return {'city': 'Local', 'region': 'Local', 'country': 'Local', 'timezone': 'Local'}

        # Check cache first
        if ip_address in _geo_cache:
            cached = _geo_cache[ip_address]
            age = datetime.now() - cached['timestamp']
            if age < _GEO_CACHE_TTL:
                return cached['data']
            else:
                # Cache expired, remove it
                del _geo_cache[ip_address]

        try:
            import requests
            # Using ip-api.com free tier (no API key required)
            # Free tier limit: 45 requests/minute
            # Added lat/lon for map visualization
            response = requests.get(
                f'http://ip-api.com/json/{ip_address}?fields=status,country,countryCode,region,regionName,city,timezone,lat,lon',
                timeout=2
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    geo_data = {
                        'country': data.get('country', 'Unknown'),
                        'country_code': data.get('countryCode', 'XX'),
                        'region': data.get('regionName', 'Unknown'),
                        'city': data.get('city', 'Unknown'),
                        'timezone': data.get('timezone', 'Unknown'),
                        'lat': data.get('lat'),
                        'lon': data.get('lon')
                    }
                    # Cache the result
                    _geo_cache[ip_address] = {
                        'data': geo_data,
                        'timestamp': datetime.now()
                    }
                    return geo_data
        except Exception as e:
            print(f"Geo-location lookup failed: {e}")

        return None

    @staticmethod
    def _get_reverse_dns(ip_address: str) -> Optional[str]:
        """
        Perform reverse DNS lookup to get hostname from IP address.
        Results are cached for 12 hours to improve performance.
        """
        if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1']:
            return 'localhost'

        # Check cache first
        if ip_address in _dns_cache:
            cached = _dns_cache[ip_address]
            age = datetime.now() - cached['timestamp']
            if age < _DNS_CACHE_TTL:
                return cached['data']
            else:
                del _dns_cache[ip_address]

        try:
            # Try reverse DNS lookup using dnspython
            addr = dns.reversename.from_address(ip_address)
            hostname = str(dns.resolver.resolve(addr, 'PTR')[0])
            # Remove trailing dot if present
            hostname = hostname.rstrip('.')

            # Cache the result
            _dns_cache[ip_address] = {
                'data': hostname,
                'timestamp': datetime.now()
            }
            return hostname
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.Timeout):
            # No PTR record found or timeout
            pass
        except Exception as e:
            print(f"Reverse DNS lookup failed for {ip_address}: {e}")

        # Fallback to socket.gethostbyaddr with short timeout
        try:
            hostname, _, _ = socket.gethostbyaddr(ip_address)
            _dns_cache[ip_address] = {
                'data': hostname,
                'timestamp': datetime.now()
            }
            return hostname
        except (socket.herror, socket.gaierror, socket.timeout):
            pass

        return None

    @staticmethod
    def _get_asn_info(ip_address: str) -> Optional[Dict[str, Any]]:
        """
        Get ASN (Autonomous System Number) and ISP information for an IP address.
        This provides network ownership and routing information.

        Note: Requires ASN database file which may not be available.
        Falls back gracefully if database is not present.
        """
        if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1']:
            return {'asn': 'Local', 'isp': 'Local Network', 'network': 'Local'}

        try:
            # Try using ip-api.com which provides ASN data for free
            import requests
            response = requests.get(
                f'http://ip-api.com/json/{ip_address}?fields=status,as,isp,org,asname',
                timeout=2
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    asn_data = {
                        'as': data.get('as', 'Unknown'),  # e.g., "AS15169 Google LLC"
                        'isp': data.get('isp', 'Unknown'),
                        'org': data.get('org', 'Unknown'),
                        'asname': data.get('asname', 'Unknown')
                    }

                    # Extract ASN number from 'as' field (e.g., "AS15169" -> 15169)
                    as_field = data.get('as', '')
                    if as_field and as_field.startswith('AS'):
                        try:
                            asn_data['asn_number'] = int(as_field.split()[0][2:])
                        except (ValueError, IndexError):
                            pass

                    return asn_data
        except Exception as e:
            print(f"ASN lookup failed for {ip_address}: {e}")

        return None

    @staticmethod
    def _get_http_protocol() -> str:
        """
        Detect HTTP protocol version (HTTP/1.0, HTTP/1.1, HTTP/2, HTTP/3).
        """
        if not has_request_context():
            return 'Unknown'

        # Check SERVER_PROTOCOL from WSGI environ
        if request.environ:
            protocol = request.environ.get('SERVER_PROTOCOL', 'HTTP/1.1')

            # Check for HTTP/2 indicators
            # Some proxies/load balancers set custom headers
            if request.headers.get('X-HTTP2-Connection'):
                return 'HTTP/2'

            # Check wsgi.input_terminated which is set for HTTP/2
            if request.environ.get('wsgi.input_terminated'):
                return 'HTTP/2'

            return protocol

        return 'Unknown'

    @staticmethod
    def _get_network_metadata() -> Dict[str, Any]:
        """
        Extract additional network and connection metadata from the request.
        """
        if not has_request_context():
            return {}

        metadata = {}

        # Request timing (if available)
        if hasattr(request, '_start_time'):
            metadata['request_start_time'] = request._start_time

        # Connection information from WSGI environ
        if request.environ:
            # Remote address and port
            metadata['remote_addr'] = request.environ.get('REMOTE_ADDR')
            metadata['remote_port'] = request.environ.get('REMOTE_PORT')

            # Server information
            metadata['server_name'] = request.environ.get('SERVER_NAME')
            metadata['server_port'] = request.environ.get('SERVER_PORT')
            metadata['server_software'] = request.environ.get('SERVER_SOFTWARE')

            # Request method and protocol
            metadata['request_method'] = request.environ.get('REQUEST_METHOD')
            metadata['server_protocol'] = request.environ.get('SERVER_PROTOCOL')

            # WSGI URL scheme (http/https)
            metadata['url_scheme'] = request.environ.get('wsgi.url_scheme')

            # Content length and type
            metadata['content_length'] = request.environ.get('CONTENT_LENGTH')
            metadata['content_type'] = request.environ.get('CONTENT_TYPE')

            # Query string
            metadata['query_string'] = request.environ.get('QUERY_STRING')

            # Path info
            metadata['path_info'] = request.environ.get('PATH_INFO')
            metadata['script_name'] = request.environ.get('SCRIPT_NAME')

            # HTTP version
            metadata['http_version'] = EnhancedAuditLogger._get_http_protocol()

        # Check if connection is via proxy/load balancer
        proxy_headers = [
            'X-Forwarded-For',
            'X-Forwarded-Proto',
            'X-Forwarded-Host',
            'X-Real-IP',
            'Via',
            'Forwarded'
        ]
        proxy_info = {}
        for header in proxy_headers:
            value = request.headers.get(header)
            if value:
                proxy_info[header] = value

        if proxy_info:
            metadata['proxy_headers'] = proxy_info
            metadata['behind_proxy'] = True
        else:
            metadata['behind_proxy'] = False

        # TLS/SSL information (if available)
        if request.is_secure:
            metadata['is_secure'] = True
            metadata['tls_enabled'] = True

            # Some WSGI servers provide TLS version info
            tls_version = request.environ.get('SSL_PROTOCOL')
            if tls_version:
                metadata['tls_version'] = tls_version

            # SSL cipher suite
            ssl_cipher = request.environ.get('SSL_CIPHER')
            if ssl_cipher:
                metadata['ssl_cipher'] = ssl_cipher
        else:
            metadata['is_secure'] = False
            metadata['tls_enabled'] = False

        # Connection header (keep-alive vs close)
        connection_header = request.headers.get('Connection', '')
        if connection_header:
            metadata['connection_type'] = connection_header.lower()
            metadata['keep_alive'] = 'keep-alive' in connection_header.lower()

        # Upgrade-Insecure-Requests header
        upgrade_insecure = request.headers.get('Upgrade-Insecure-Requests')
        if upgrade_insecure:
            metadata['upgrade_insecure_requests'] = upgrade_insecure == '1'

        return metadata

    @staticmethod
    def _parse_device_info(user_agent_string: str) -> Dict[str, str]:
        """Parse user agent string to extract device, browser, and OS info."""
        try:
            ua = parse_user_agent(user_agent_string)
            return {
                'browser': ua.browser.family,
                'browser_version': ua.browser.version_string,
                'os': ua.os.family,
                'os_version': ua.os.version_string,
                'device': ua.device.family,
                'device_brand': ua.device.brand or 'Unknown',
                'device_model': ua.device.model or 'Unknown',
                'is_mobile': ua.is_mobile,
                'is_tablet': ua.is_tablet,
                'is_pc': ua.is_pc,
                'is_bot': ua.is_bot
            }
        except Exception as e:
            print(f"User agent parsing failed: {e}")
            return {
                'browser': 'Unknown',
                'os': 'Unknown',
                'device': 'Unknown'
            }

    @staticmethod
    def _get_real_client_ip() -> str:
        """
        Get the real client IP address, checking Cloudflare headers first.

        When behind Cloudflare (or other proxies), request.remote_addr returns
        the proxy IP, not the real client IP. Cloudflare provides the real IP
        in the CF-Connecting-IP header.
        """
        if not has_request_context():
            return 'Unknown'

        # Priority order for IP detection:
        # 1. CF-Connecting-IP (Cloudflare's real client IP)
        # 2. X-Forwarded-For (standard proxy header, use first IP)
        # 3. X-Real-IP (alternative proxy header)
        # 4. request.remote_addr (fallback, may be proxy IP)

        # Check Cloudflare header first
        cf_ip = request.headers.get('CF-Connecting-IP')
        if cf_ip:
            return cf_ip

        # Check X-Forwarded-For (may contain chain of IPs, use the first one)
        x_forwarded_for = request.headers.get('X-Forwarded-For')
        if x_forwarded_for:
            # Take the first IP in the chain (original client)
            return x_forwarded_for.split(',')[0].strip()

        # Check X-Real-IP
        x_real_ip = request.headers.get('X-Real-IP')
        if x_real_ip:
            return x_real_ip

        # Fallback to remote_addr (may be proxy IP if behind reverse proxy)
        return request.remote_addr or 'Unknown'

    @staticmethod
    def _get_cloudflare_metadata() -> Optional[Dict[str, str]]:
        """
        Extract Cloudflare-specific metadata from request headers.

        Returns dict with Cloudflare metadata if headers are present, None otherwise.
        Cloudflare provides valuable tracking data in custom headers.
        """
        if not has_request_context():
            return None

        cf_metadata = {}

        # CF-Ray: Unique request identifier for Cloudflare support/debugging
        cf_ray = request.headers.get('CF-Ray')
        if cf_ray:
            cf_metadata['cf_ray'] = cf_ray

        # CF-IPCountry: Two-letter country code of client
        cf_country = request.headers.get('CF-IPCountry')
        if cf_country:
            cf_metadata['cf_country'] = cf_country

        # CF-Visitor: JSON with scheme info (http/https)
        cf_visitor = request.headers.get('CF-Visitor')
        if cf_visitor:
            try:
                import json as json_lib
                visitor_data = json_lib.loads(cf_visitor)
                cf_metadata['cf_scheme'] = visitor_data.get('scheme', 'unknown')
            except:
                cf_metadata['cf_visitor'] = cf_visitor

        # CF-Connecting-IP: Real client IP (already captured separately)
        cf_ip = request.headers.get('CF-Connecting-IP')
        if cf_ip:
            cf_metadata['cf_connecting_ip'] = cf_ip

        # CF-Request-ID: Cloudflare internal request ID
        cf_request_id = request.headers.get('CF-Request-ID')
        if cf_request_id:
            cf_metadata['cf_request_id'] = cf_request_id

        # CF-Cache-Status: Cache hit/miss status
        cf_cache_status = request.headers.get('CF-Cache-Status')
        if cf_cache_status:
            cf_metadata['cf_cache_status'] = cf_cache_status

        # CDN-Loop: Cloudflare edge location identifier
        cdn_loop = request.headers.get('CDN-Loop')
        if cdn_loop:
            cf_metadata['cdn_loop'] = cdn_loop

        return cf_metadata if cf_metadata else None

    @staticmethod
    def _get_browser_fingerprint() -> Dict[str, Any]:
        """
        Generate browser fingerprint for tracking and security.
        Combines multiple attributes to uniquely identify a browser/device.
        """
        if not has_request_context():
            return {}

        fingerprint = {}

        # User Agent
        ua_string = request.headers.get('User-Agent', '')
        if ua_string:
            fingerprint['user_agent_hash'] = hash(ua_string) % 1000000  # Shorter hash for storage

        # Language preferences (can indicate location/settings)
        accept_language = request.headers.get('Accept-Language', '')
        if accept_language:
            # Parse primary language
            primary_lang = accept_language.split(',')[0].strip() if accept_language else 'unknown'
            fingerprint['primary_language'] = primary_lang
            # Store all languages
            fingerprint['all_languages'] = [lang.split(';')[0].strip() for lang in accept_language.split(',')[:5]]

        # Encoding preferences
        accept_encoding = request.headers.get('Accept-Encoding', '')
        fingerprint['supports_compression'] = 'gzip' in accept_encoding or 'br' in accept_encoding
        fingerprint['accept_encoding'] = accept_encoding[:100] if accept_encoding else None

        # Connection type hints
        connection = request.headers.get('Connection', '')
        fingerprint['connection_type'] = connection if connection else 'unknown'

        # DNT (Do Not Track) header
        dnt = request.headers.get('DNT', '0')
        fingerprint['dnt_enabled'] = dnt == '1'

        # GPC (Global Privacy Control) header
        gpc = request.headers.get('Sec-GPC', '0')
        fingerprint['gpc_enabled'] = gpc == '1'

        # Screen hints from client (if available in custom headers)
        screen_width = request.headers.get('X-Screen-Width')
        screen_height = request.headers.get('X-Screen-Height')
        if screen_width and screen_height:
            fingerprint['screen_resolution'] = f"{screen_width}x{screen_height}"
            fingerprint['screen_width'] = int(screen_width) if screen_width.isdigit() else None
            fingerprint['screen_height'] = int(screen_height) if screen_height.isdigit() else None

        # Timezone offset (if available in custom headers)
        tz_offset = request.headers.get('X-Timezone-Offset')
        if tz_offset:
            fingerprint['timezone_offset'] = tz_offset
            # Convert to hours for readability
            try:
                offset_minutes = int(tz_offset)
                fingerprint['timezone_offset_hours'] = offset_minutes / -60  # Positive for UTC+
            except ValueError:
                pass

        # Viewport size (if available)
        viewport_width = request.headers.get('X-Viewport-Width')
        viewport_height = request.headers.get('X-Viewport-Height')
        if viewport_width and viewport_height:
            fingerprint['viewport_size'] = f"{viewport_width}x{viewport_height}"
            fingerprint['viewport_width'] = int(viewport_width) if viewport_width.isdigit() else None
            fingerprint['viewport_height'] = int(viewport_height) if viewport_height.isdigit() else None

        # Color depth (if available)
        color_depth = request.headers.get('X-Color-Depth')
        if color_depth:
            fingerprint['color_depth'] = int(color_depth) if color_depth.isdigit() else None

        # Device pixel ratio (if available)
        pixel_ratio = request.headers.get('X-Device-Pixel-Ratio')
        if pixel_ratio:
            try:
                fingerprint['device_pixel_ratio'] = float(pixel_ratio)
            except ValueError:
                pass

        # Sec-CH-UA Client Hints (modern browsers)
        sec_ch_ua = request.headers.get('Sec-CH-UA')
        if sec_ch_ua:
            fingerprint['client_hints_ua'] = sec_ch_ua[:200]

        sec_ch_ua_mobile = request.headers.get('Sec-CH-UA-Mobile')
        if sec_ch_ua_mobile:
            fingerprint['client_hints_mobile'] = sec_ch_ua_mobile == '?1'

        sec_ch_ua_platform = request.headers.get('Sec-CH-UA-Platform')
        if sec_ch_ua_platform:
            fingerprint['client_hints_platform'] = sec_ch_ua_platform.strip('"')

        sec_ch_ua_arch = request.headers.get('Sec-CH-UA-Arch')
        if sec_ch_ua_arch:
            fingerprint['client_hints_arch'] = sec_ch_ua_arch.strip('"')

        sec_ch_ua_bitness = request.headers.get('Sec-CH-UA-Bitness')
        if sec_ch_ua_bitness:
            fingerprint['client_hints_bitness'] = sec_ch_ua_bitness.strip('"')

        sec_ch_ua_model = request.headers.get('Sec-CH-UA-Model')
        if sec_ch_ua_model:
            fingerprint['client_hints_model'] = sec_ch_ua_model.strip('"')

        # Sec-Fetch headers (request context)
        sec_fetch_site = request.headers.get('Sec-Fetch-Site')
        if sec_fetch_site:
            fingerprint['sec_fetch_site'] = sec_fetch_site

        sec_fetch_mode = request.headers.get('Sec-Fetch-Mode')
        if sec_fetch_mode:
            fingerprint['sec_fetch_mode'] = sec_fetch_mode

        sec_fetch_dest = request.headers.get('Sec-Fetch-Dest')
        if sec_fetch_dest:
            fingerprint['sec_fetch_dest'] = sec_fetch_dest

        sec_fetch_user = request.headers.get('Sec-Fetch-User')
        if sec_fetch_user:
            fingerprint['sec_fetch_user'] = sec_fetch_user == '?1'

        # Accept header (content type preferences)
        accept = request.headers.get('Accept')
        if accept:
            fingerprint['accept_types'] = accept[:200]

        # Cache control hints
        cache_control = request.headers.get('Cache-Control')
        if cache_control:
            fingerprint['cache_control'] = cache_control[:100]

        # Priority hints
        priority = request.headers.get('Priority')
        if priority:
            fingerprint['priority'] = priority

        return fingerprint

    @staticmethod
    def _calculate_risk_score(ip_address: str, user_agent: str, device_info: Dict) -> Dict[str, Any]:
        """
        Calculate basic risk indicators for the request.
        Returns dict with risk score and factors.
        """
        risk_indicators = {
            'score': 0,  # 0-100 scale
            'factors': []
        }

        # Check for bot
        if device_info.get('is_bot'):
            risk_indicators['score'] += 30
            risk_indicators['factors'].append('bot_detected')

        # Check for missing/suspicious user agent
        if not user_agent or len(user_agent) < 10:
            risk_indicators['score'] += 20
            risk_indicators['factors'].append('suspicious_user_agent')

        # Check for localhost/internal IP
        if ip_address in ['127.0.0.1', 'localhost', '::1'] or ip_address.startswith('192.168.') or ip_address.startswith('10.'):
            # Internal IPs are lower risk in some contexts
            risk_indicators['factors'].append('internal_network')

        # Check for Tor exit nodes (common IPs)
        # This is a simplified check - production would use a Tor exit node list
        if any(indicator in user_agent.lower() for indicator in ['tor', 'onion']):
            risk_indicators['score'] += 40
            risk_indicators['factors'].append('tor_browser')

        # Check for automation tools
        automation_keywords = ['selenium', 'puppeteer', 'phantom', 'headless', 'crawler', 'spider', 'bot']
        if any(keyword in user_agent.lower() for keyword in automation_keywords):
            risk_indicators['score'] += 25
            risk_indicators['factors'].append('automation_tool')

        # Cap score at 100
        risk_indicators['score'] = min(risk_indicators['score'], 100)

        # Assign risk level
        if risk_indicators['score'] >= 70:
            risk_indicators['level'] = 'high'
        elif risk_indicators['score'] >= 40:
            risk_indicators['level'] = 'medium'
        else:
            risk_indicators['level'] = 'low'

        return risk_indicators

    @staticmethod
    def _get_session_metadata() -> Dict[str, Any]:
        """Extract detailed session information."""
        if not has_request_context() or not session:
            return {}

        metadata = {}

        # Session age (if _created timestamp exists)
        if '_created' in session:
            try:
                created_at = datetime.fromisoformat(session['_created'])
                age_seconds = (datetime.now() - created_at).total_seconds()
                metadata['session_age_seconds'] = int(age_seconds)
                metadata['session_age_minutes'] = round(age_seconds / 60, 2)
            except Exception:
                pass

        # Session data size (approximate)
        try:
            session_data_size = len(str(dict(session)))
            metadata['session_size_bytes'] = session_data_size
        except Exception:
            pass

        # User authentication state
        if current_user and current_user.is_authenticated:
            metadata['authenticated'] = True
            metadata['user_id'] = current_user.id
            metadata['username'] = getattr(current_user, 'username', 'unknown')
            metadata['is_admin'] = getattr(current_user, 'is_admin', False)
        else:
            metadata['authenticated'] = False

        return metadata

    @staticmethod
    def _get_request_info() -> Dict[str, Any]:
        """Extract comprehensive request information."""
        if not has_request_context():
            return {}

        info = {
            'method': request.method,
            'endpoint': request.endpoint,
            'path': request.path,
            'query_string': request.query_string.decode('utf-8'),
            'referrer': request.referrer or 'Direct',
            'content_length': request.content_length or 0,
            'is_secure': request.is_secure,
            'scheme': request.scheme,
            'content_type': request.content_type or 'unknown',
            'host': request.host,
            'url': request.url,
            'base_url': request.base_url,
        }

        # Session ID (first 8 chars for privacy)
        if session:
            try:
                sid = session.get('_id', 'N/A')
                info['session_id'] = sid[:8] if sid != 'N/A' else 'N/A'
            except Exception:
                info['session_id'] = 'N/A'

        # Selected headers (be careful with privacy)
        info['headers'] = {
            'accept': request.headers.get('Accept', 'N/A'),
            'accept_language': request.headers.get('Accept-Language', 'N/A'),
            'accept_encoding': request.headers.get('Accept-Encoding', 'N/A'),
            'origin': request.headers.get('Origin', 'N/A'),
            'dnt': request.headers.get('DNT', 'N/A'),
            'sec_gpc': request.headers.get('Sec-GPC', 'N/A'),
            'sec_fetch_site': request.headers.get('Sec-Fetch-Site', 'N/A'),
            'sec_fetch_mode': request.headers.get('Sec-Fetch-Mode', 'N/A'),
            'sec_fetch_dest': request.headers.get('Sec-Fetch-Dest', 'N/A'),
            'sec_fetch_user': request.headers.get('Sec-Fetch-User', 'N/A'),
        }

        # Client hints (modern browsers)
        client_hints = {}
        sec_ch_headers = [
            ('Sec-CH-UA', 'ua'),
            ('Sec-CH-UA-Mobile', 'mobile'),
            ('Sec-CH-UA-Platform', 'platform'),
            ('Sec-CH-UA-Arch', 'arch'),
            ('Sec-CH-UA-Bitness', 'bitness'),
            ('Sec-CH-UA-Model', 'model'),
            ('Sec-CH-UA-Platform-Version', 'platform_version'),
            ('Sec-CH-UA-Full-Version-List', 'full_version_list'),
            ('Sec-CH-Prefers-Color-Scheme', 'color_scheme'),
            ('Sec-CH-Prefers-Reduced-Motion', 'reduced_motion'),
        ]
        for header, key in sec_ch_headers:
            value = request.headers.get(header)
            if value:
                client_hints[key] = value.strip('"') if value.startswith('"') else value
        if client_hints:
            info['client_hints'] = client_hints

        # Custom client headers (from our activity tracker)
        client_info = {}
        custom_headers = [
            ('X-Screen-Width', 'screen_width'),
            ('X-Screen-Height', 'screen_height'),
            ('X-Viewport-Width', 'viewport_width'),
            ('X-Viewport-Height', 'viewport_height'),
            ('X-Timezone-Offset', 'timezone_offset'),
            ('X-Color-Depth', 'color_depth'),
            ('X-Device-Pixel-Ratio', 'device_pixel_ratio'),
        ]
        for header, key in custom_headers:
            value = request.headers.get(header)
            if value:
                client_info[key] = value
        if client_info:
            info['client_info'] = client_info

        # Request timing hints
        if request.environ:
            info['protocol'] = request.environ.get('SERVER_PROTOCOL', 'unknown')
            info['server_name'] = request.environ.get('SERVER_NAME')
            info['server_port'] = request.environ.get('SERVER_PORT')
            info['remote_port'] = request.environ.get('REMOTE_PORT')
            info['wsgi_url_scheme'] = request.environ.get('wsgi.url_scheme')

        # Request timing (if available from before_request)
        if hasattr(request, '_start_time'):
            info['request_start_time'] = request._start_time

        return info

    @staticmethod
    def log(
        action: str,
        table_name: str = None,
        record_id: Optional[int] = None,
        user_id: Optional[int] = None,
        details: Optional[str] = None,
        status_code: Optional[int] = None,
        error_message: Optional[str] = None
    ):
        """
        Log an audit event with comprehensive data collection.

        Args:
            action: Type of action (CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, etc.)
            table_name: Name of the table affected (if applicable)
            record_id: ID of the record affected (if applicable)
            user_id: ID of the user performing the action
            details: Additional details about the action (string or dict)
            status_code: HTTP status code of the response
            error_message: Error message if action failed
        """
        config = AuditConfig.get_config()

        # Check if logging is enabled
        if not config.get('enabled', True):
            return

        # Get user_id from current_user if not provided
        if user_id is None and has_request_context():
            try:
                if current_user and current_user.is_authenticated:
                    user_id = current_user.id
            except Exception:
                pass

        # Initialize audit data
        audit_data = {
            'action': action,
            'table_name': table_name,
            'record_id': record_id,
            'user_id': user_id,
            'details': details if isinstance(details, str) else json.dumps(details) if details else None,
            'status_code': status_code,
            'error_message': error_message,
            'created_at': datetime.now().isoformat()
        }

        if not has_request_context():
            # No request context, just save basic info
            EnhancedAuditLogger._save_audit_log(audit_data)
            return

        collect_config = config.get('collect', {})

        # Collect real client IP address (checks Cloudflare headers)
        if collect_config.get('ip_address', True):
            audit_data['ip_address'] = EnhancedAuditLogger._get_real_client_ip()

        # Collect Cloudflare metadata
        cf_metadata = EnhancedAuditLogger._get_cloudflare_metadata()

        # Collect user agent
        user_agent_string = request.headers.get('User-Agent', '')
        device_info = {}
        if collect_config.get('user_agent', True):
            audit_data['user_agent'] = user_agent_string[:500]  # Limit length

            # Parse device info from user agent
            if collect_config.get('device_info', True) or collect_config.get('browser_info', True):
                device_info = EnhancedAuditLogger._parse_device_info(user_agent_string)
                audit_data['device_info'] = json.dumps(device_info)

        # Collect geo location
        if collect_config.get('geo_location', True) and audit_data.get('ip_address'):
            geo_data = EnhancedAuditLogger._get_geo_location(audit_data['ip_address'])

            # Enhance with Cloudflare country data if available
            if geo_data and cf_metadata and 'cf_country' in cf_metadata:
                geo_data['cf_country_code'] = cf_metadata['cf_country']

            if geo_data:
                audit_data['geo_location'] = json.dumps(geo_data)

        # Perform IP intelligence analysis
        if collect_config.get('ip_intelligence', True) and audit_data.get('ip_address'):
            ip_analysis = ip_intelligence.analyze_ip(audit_data['ip_address'])
            vpn_detection = ip_intelligence.detect_vpn_proxy(
                audit_data['ip_address'],
                user_agent_string
            )

            # Store IP intelligence in details
            ip_intel_data = {
                'ip_analysis': ip_analysis,
                'vpn_detection': vpn_detection
            }

            # Perform reverse DNS lookup
            if collect_config.get('reverse_dns', True):
                reverse_dns = EnhancedAuditLogger._get_reverse_dns(audit_data['ip_address'])
                if reverse_dns:
                    ip_intel_data['reverse_dns'] = reverse_dns
                    ip_intel_data['hostname'] = reverse_dns

            # Perform ASN lookup
            if collect_config.get('asn_lookup', True):
                asn_info = EnhancedAuditLogger._get_asn_info(audit_data['ip_address'])
                if asn_info:
                    ip_intel_data['asn'] = asn_info

            # Add to details
            if audit_data.get('details'):
                try:
                    details_dict = json.loads(audit_data['details']) if isinstance(audit_data['details'], str) else {}
                    details_dict['ip_intelligence'] = ip_intel_data
                    audit_data['details'] = json.dumps(details_dict)
                except:
                    pass
            else:
                audit_data['details'] = json.dumps({'ip_intelligence': ip_intel_data})

        # Collect network metadata
        if collect_config.get('network_metadata', True):
            network_meta = EnhancedAuditLogger._get_network_metadata()
            if network_meta:
                # Store in details
                if audit_data.get('details'):
                    try:
                        details_dict = json.loads(audit_data['details']) if isinstance(audit_data['details'], str) else {}
                        details_dict['network'] = network_meta
                        audit_data['details'] = json.dumps(details_dict)
                    except:
                        pass
                else:
                    audit_data['details'] = json.dumps({'network': network_meta})

        # Collect request information
        if collect_config.get('request_method', True) or collect_config.get('request_endpoint', True):
            request_info = EnhancedAuditLogger._get_request_info()
            audit_data['request_method'] = request_info.get('method')
            audit_data['request_endpoint'] = request_info.get('path')
            audit_data['request_query'] = request_info.get('query_string')

            if collect_config.get('referrer', True):
                audit_data['referrer'] = request_info.get('referrer')

            if collect_config.get('request_body_size', True):
                audit_data['request_size'] = request_info.get('content_length', 0)

            if collect_config.get('session_id', True):
                audit_data['session_id'] = request_info.get('session_id')

            if collect_config.get('request_headers', False):
                headers_data = request_info.get('headers', {})
                # Always include Cloudflare metadata in headers (even if request_headers is off)
                # This ensures we capture CF-Ray, CF-IPCountry, etc.
                if cf_metadata:
                    headers_data['cloudflare'] = cf_metadata
                audit_data['request_headers'] = json.dumps(headers_data)
            elif cf_metadata:
                # If request_headers collection is off but we have CF data,
                # store CF metadata separately
                audit_data['request_headers'] = json.dumps({'cloudflare': cf_metadata})

        # Collect browser fingerprint for tracking and security
        if collect_config.get('browser_fingerprint', True):
            fingerprint = EnhancedAuditLogger._get_browser_fingerprint()
            if fingerprint:
                # Store in device_info if it exists, otherwise create new field
                if audit_data.get('device_info'):
                    try:
                        existing_device_info = json.loads(audit_data['device_info'])
                        existing_device_info['fingerprint'] = fingerprint
                        audit_data['device_info'] = json.dumps(existing_device_info)
                    except:
                        pass
                else:
                    audit_data['device_info'] = json.dumps({'fingerprint': fingerprint})

                # Extract key fingerprint values into dedicated columns for indexing
                if fingerprint.get('screen_width'):
                    audit_data['screen_width'] = fingerprint['screen_width']
                if fingerprint.get('screen_height'):
                    audit_data['screen_height'] = fingerprint['screen_height']
                if fingerprint.get('viewport_width'):
                    audit_data['viewport_width'] = fingerprint['viewport_width']
                if fingerprint.get('viewport_height'):
                    audit_data['viewport_height'] = fingerprint['viewport_height']
                if fingerprint.get('timezone_offset'):
                    try:
                        audit_data['timezone_offset'] = int(fingerprint['timezone_offset'])
                    except (ValueError, TypeError):
                        pass
                if fingerprint.get('device_pixel_ratio'):
                    audit_data['device_pixel_ratio'] = fingerprint['device_pixel_ratio']

        # Calculate risk score for security monitoring
        if collect_config.get('risk_scoring', True):
            ip_address = audit_data.get('ip_address', '')
            risk_data = EnhancedAuditLogger._calculate_risk_score(ip_address, user_agent_string, device_info)
            if risk_data:
                # Store risk data in details if it exists
                if audit_data.get('details'):
                    try:
                        details_dict = json.loads(audit_data['details']) if isinstance(audit_data['details'], str) else {}
                        details_dict['risk_assessment'] = risk_data
                        audit_data['details'] = json.dumps(details_dict)
                    except:
                        pass

        # Collect detailed session metadata
        if collect_config.get('session_metadata', True):
            session_meta = EnhancedAuditLogger._get_session_metadata()
            if session_meta:
                # Store in details
                if audit_data.get('details'):
                    try:
                        details_dict = json.loads(audit_data['details']) if isinstance(audit_data['details'], str) else {}
                        details_dict['session_metadata'] = session_meta
                        audit_data['details'] = json.dumps(details_dict)
                    except:
                        # If details is a string and can't be parsed, wrap it
                        details_dict = {
                            'original_details': audit_data['details'],
                            'session_metadata': session_meta
                        }
                        audit_data['details'] = json.dumps(details_dict)
                else:
                    audit_data['details'] = json.dumps({'session_metadata': session_meta})

        # Save to database
        EnhancedAuditLogger._save_audit_log(audit_data)

    @staticmethod
    def _save_audit_log(audit_data: Dict[str, Any]):
        """Save audit log entry to database."""
        try:
            with db.get_connection() as conn:
                cursor = conn.cursor()

                # Build dynamic SQL based on available fields
                fields = list(audit_data.keys())
                placeholders = ', '.join(['?' for _ in fields])
                field_names = ', '.join(fields)

                cursor.execute(f'''
                    INSERT INTO enhanced_audit_log ({field_names})
                    VALUES ({placeholders})
                ''', tuple(audit_data.values()))

                conn.commit()
        except Exception as e:
            # Don't let audit logging failures break the application
            print(f"Enhanced audit logging failed: {e}")

    @staticmethod
    def log_login_attempt(username: str, success: bool, ip_address: str = None, error_message: str = None):
        """Log a login attempt (success or failure)."""
        EnhancedAuditLogger.log(
            action='LOGIN_ATTEMPT',
            table_name='users',
            details=json.dumps({
                'username': username,
                'success': success
            }),
            status_code=200 if success else 401,
            error_message=error_message
        )

    @staticmethod
    def log_create(table_name: str, record_id: int, user_id: Optional[int] = None, details: Optional[str] = None):
        """Log a CREATE operation."""
        EnhancedAuditLogger.log('CREATE', table_name, record_id, user_id, details, status_code=201)

    @staticmethod
    def log_read(table_name: str, record_id: Optional[int] = None, user_id: Optional[int] = None, details: Optional[str] = None):
        """Log a READ operation."""
        config = AuditConfig.get_config()
        if not config.get('log_read_operations', False):
            return  # Skip READ operations if not configured
        EnhancedAuditLogger.log('READ', table_name, record_id, user_id, details, status_code=200)

    @staticmethod
    def log_update(table_name: str, record_id: int, user_id: Optional[int] = None, details: Optional[str] = None):
        """Log an UPDATE operation."""
        EnhancedAuditLogger.log('UPDATE', table_name, record_id, user_id, details, status_code=200)

    @staticmethod
    def log_delete(table_name: str, record_id: int, user_id: Optional[int] = None, details: Optional[str] = None):
        """Log a DELETE operation."""
        EnhancedAuditLogger.log('DELETE', table_name, record_id, user_id, details, status_code=200)

    @staticmethod
    def log_admin_action(action: str, details: Optional[Dict] = None, user_id: Optional[int] = None):
        """Log an admin action."""
        EnhancedAuditLogger.log(
            action=f'ADMIN_{action}',
            table_name='admin',
            user_id=user_id,
            details=details,
            status_code=200
        )

    @staticmethod
    def log_data_change(
        action: str,
        table_name: str,
        record_id: int,
        old_data: Optional[Dict] = None,
        new_data: Optional[Dict] = None,
        user_id: Optional[int] = None
    ):
        """
        Log a data change operation with before/after snapshots.

        Args:
            action: CREATE, UPDATE, or DELETE
            table_name: Name of the table
            record_id: ID of the record
            old_data: Data before the change (for UPDATE/DELETE)
            new_data: Data after the change (for CREATE/UPDATE)
            user_id: User making the change
        """
        details = {
            'change_tracking': {
                'old_data': old_data,
                'new_data': new_data
            }
        }

        # Calculate what changed
        if old_data and new_data:
            changes = {}
            all_keys = set(old_data.keys()) | set(new_data.keys())
            for key in all_keys:
                old_val = old_data.get(key)
                new_val = new_data.get(key)
                if old_val != new_val:
                    changes[key] = {
                        'old': old_val,
                        'new': new_val
                    }
            details['change_tracking']['changed_fields'] = changes
            details['change_tracking']['num_fields_changed'] = len(changes)

        EnhancedAuditLogger.log(
            action=action,
            table_name=table_name,
            record_id=record_id,
            user_id=user_id,
            details=details,
            status_code=200
        )

    @staticmethod
    def log_performance(
        action: str,
        duration_ms: float,
        details: Optional[Dict] = None,
        status_code: int = 200
    ):
        """
        Log performance metrics for an operation.

        Args:
            action: Name of the operation
            duration_ms: Duration in milliseconds
            details: Additional context
            status_code: HTTP status code
        """
        perf_details = {
            'performance': {
                'duration_ms': round(duration_ms, 2),
                'duration_seconds': round(duration_ms / 1000, 3)
            }
        }

        # Classify performance
        if duration_ms < 100:
            perf_details['performance']['classification'] = 'fast'
        elif duration_ms < 500:
            perf_details['performance']['classification'] = 'normal'
        elif duration_ms < 2000:
            perf_details['performance']['classification'] = 'slow'
        else:
            perf_details['performance']['classification'] = 'very_slow'

        # Merge with existing details
        if details:
            perf_details.update(details)

        EnhancedAuditLogger.log(
            action=action,
            details=perf_details,
            status_code=status_code
        )

    @staticmethod
    def detect_suspicious_patterns(user_id: Optional[int] = None, ip_address: Optional[str] = None, minutes: int = 5):
        """
        Detect suspicious patterns in recent audit logs.
        Returns list of detected patterns.

        Args:
            user_id: Filter by user ID
            ip_address: Filter by IP address
            minutes: Look back window in minutes
        """
        cutoff = (datetime.now() - timedelta(minutes=minutes)).isoformat()
        patterns = []

        # Query recent logs
        query = 'SELECT * FROM enhanced_audit_log WHERE created_at >= ?'
        params = [cutoff]

        if user_id:
            query += ' AND user_id = ?'
            params.append(user_id)

        if ip_address:
            query += ' AND ip_address = ?'
            params.append(ip_address)

        logs = db.execute(query, tuple(params))
        log_list = [dict(row) for row in logs]

        # Pattern 1: High frequency of failed logins
        failed_logins = [log for log in log_list if log['action'] == 'LOGIN_ATTEMPT' and log.get('status_code') == 401]
        if len(failed_logins) >= 5:
            patterns.append({
                'type': 'brute_force_attempt',
                'severity': 'high',
                'count': len(failed_logins),
                'description': f'{len(failed_logins)} failed login attempts in {minutes} minutes'
            })

        # Pattern 2: Rapid API calls (possible scraping/automation)
        if len(log_list) >= 100:
            patterns.append({
                'type': 'high_frequency_requests',
                'severity': 'medium',
                'count': len(log_list),
                'description': f'{len(log_list)} requests in {minutes} minutes'
            })

        # Pattern 3: Multiple failed actions
        failed_actions = [log for log in log_list if log.get('status_code', 200) >= 400]
        if len(failed_actions) >= 10:
            patterns.append({
                'type': 'repeated_failures',
                'severity': 'medium',
                'count': len(failed_actions),
                'description': f'{len(failed_actions)} failed actions in {minutes} minutes'
            })

        # Pattern 4: Access to many different endpoints (reconnaissance)
        unique_endpoints = set(log.get('request_endpoint') for log in log_list if log.get('request_endpoint'))
        if len(unique_endpoints) >= 20:
            patterns.append({
                'type': 'endpoint_scanning',
                'severity': 'high',
                'count': len(unique_endpoints),
                'description': f'Access to {len(unique_endpoints)} different endpoints in {minutes} minutes'
            })

        return patterns

    @staticmethod
    def analyze_fingerprint_data(fingerprint_data: Dict, ip_geolocation: Dict = None) -> Dict[str, Any]:
        """
        Analyze browser fingerprint data for anomalies and security insights.

        Returns dict with:
        - consistency_score: 0-100 (higher is more consistent/trustworthy)
        - anomalies: List of detected anomalies
        - device_profile: Summary of device characteristics
        - location_mismatch: Timezone/language vs IP location mismatch analysis
        """
        analysis = {
            'consistency_score': 100,
            'anomalies': [],
            'device_profile': {},
            'risk_factors': []
        }

        if not fingerprint_data:
            return analysis

        # Analyze basic info
        basic = fingerprint_data.get('basic', {})

        # Check for missing/suspicious user agent
        if not basic.get('user_agent') or len(basic.get('user_agent', '')) < 10:
            analysis['anomalies'].append('missing_or_suspicious_user_agent')
            analysis['consistency_score'] -= 20

        # Check for automation indicators
        if basic.get('webdriver'):
            analysis['anomalies'].append('webdriver_detected')
            analysis['risk_factors'].append('automation')
            analysis['consistency_score'] -= 30

        # Check headless browser indicators
        if basic.get('product_sub') == '20030107':  # Headless Chrome indicator
            analysis['anomalies'].append('headless_browser_indicator')
            analysis['risk_factors'].append('automation')
            analysis['consistency_score'] -= 25

        # Analyze screen info
        screen = fingerprint_data.get('screen', {})
        if screen:
            # Unusual screen resolutions (potential emulation)
            width = screen.get('width', 0)
            height = screen.get('height', 0)
            if width == height:  # Square screens are uncommon
                analysis['anomalies'].append('unusual_screen_resolution')
                analysis['consistency_score'] -= 10

            # Check for common emulator resolutions
            emulator_resolutions = [(360, 640), (375, 667), (414, 896), (1920, 1080)]
            if (width, height) in emulator_resolutions:
                # Common resolutions, but could indicate emulation
                analysis['device_profile']['likely_emulated'] = True

        # Analyze capabilities
        capabilities = fingerprint_data.get('capabilities', {})
        if capabilities:
            # Check for impossible combinations
            if capabilities.get('touch_support') and not basic.get('max_touch_points'):
                analysis['anomalies'].append('touch_capability_mismatch')
                analysis['consistency_score'] -= 15

        # Analyze timezone and location consistency
        if ip_geolocation:
            timezone_info = fingerprint_data.get('timezone', {})
            mismatch = ip_intelligence.analyze_ip_location_mismatch(
                ip_geolocation,
                timezone_info.get('timezone'),
                basic.get('language')
            )

            if mismatch.get('has_mismatch'):
                analysis['location_mismatch'] = mismatch
                analysis['consistency_score'] -= mismatch.get('confidence', 0) // 2
                analysis['risk_factors'].append('location_mismatch')

        # Device profile summary
        analysis['device_profile'] = {
            'platform': basic.get('platform'),
            'hardware_concurrency': basic.get('hardware_concurrency'),
            'device_memory': basic.get('device_memory'),
            'screen_resolution': f"{screen.get('width')}x{screen.get('height')}",
            'color_depth': screen.get('color_depth'),
            'touch_capable': basic.get('max_touch_points', 0) > 0,
            'webgl_vendor': fingerprint_data.get('webgl', {}).get('vendor'),
            'canvas_hash': fingerprint_data.get('canvas', {}).get('hash'),
            'composite_fingerprint': fingerprint_data.get('composite_fingerprint')
        }

        # Overall risk assessment
        if analysis['consistency_score'] < 50:
            analysis['risk_level'] = 'high'
        elif analysis['consistency_score'] < 70:
            analysis['risk_level'] = 'medium'
        else:
            analysis['risk_level'] = 'low'

        return analysis

    @staticmethod
    def get_logs(
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        table_name: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        ip_address: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
        sort_by: str = 'created_at',
        sort_direction: str = 'desc'
    ):
        """
        Retrieve audit logs with comprehensive filtering.

        Returns both the logs and total count for pagination.

        Args:
            sort_by: Column to sort by (default: created_at)
            sort_direction: Sort direction 'asc' or 'desc' (default: desc)
        """
        config = AuditConfig.get_config()
        display_config = config.get('display', {})

        # Build query with JOIN to get username
        query = '''
            SELECT
                eal.*,
                u.username
            FROM enhanced_audit_log eal
            LEFT JOIN users u ON eal.user_id = u.id
            WHERE 1=1
        '''
        count_query = 'SELECT COUNT(*) as total FROM enhanced_audit_log WHERE 1=1'
        params = []

        if user_id is not None:
            # Handle special case for filtering NULL user_id (unauthenticated users)
            if user_id == 'null':
                query += ' AND user_id IS NULL'
                count_query += ' AND user_id IS NULL'
            else:
                query += ' AND user_id = ?'
                count_query += ' AND user_id = ?'
                params.append(user_id)

        if action is not None:
            query += ' AND action = ?'
            count_query += ' AND action = ?'
            params.append(action)

        if table_name is not None:
            query += ' AND table_name = ?'
            count_query += ' AND table_name = ?'
            params.append(table_name)

        if start_date is not None:
            query += ' AND created_at >= ?'
            count_query += ' AND created_at >= ?'
            params.append(start_date)

        if end_date is not None:
            query += ' AND created_at <= ?'
            count_query += ' AND created_at <= ?'
            params.append(end_date)

        if ip_address is not None:
            query += ' AND ip_address = ?'
            count_query += ' AND ip_address = ?'
            params.append(ip_address)

        # Get total count
        count_result = db.execute_one(count_query, tuple(params))
        total_count = count_result['total'] if count_result else 0

        # Whitelist allowed sort columns to prevent SQL injection
        # Include all columns from enhanced_audit_log table plus username from JOIN
        allowed_sort_columns = [
            'id', 'created_at', 'action', 'table_name', 'record_id',
            'user_id', 'username', 'details', 'status_code', 'error_message',
            'ip_address', 'user_agent', 'geo_location', 'device_info',
            'request_method', 'request_endpoint', 'request_query',
            'request_size', 'referrer', 'session_id', 'request_headers'
        ]
        if sort_by not in allowed_sort_columns:
            sort_by = 'created_at'

        # Validate sort direction
        sort_direction = 'ASC' if sort_direction.lower() == 'asc' else 'DESC'

        # Get paginated results with dynamic sorting
        # Handle username from JOIN separately (u.username vs eal.column)
        if sort_by == 'username':
            query += f' ORDER BY u.{sort_by} {sort_direction} LIMIT ? OFFSET ?'
        else:
            query += f' ORDER BY eal.{sort_by} {sort_direction} LIMIT ? OFFSET ?'
        params.extend([limit, offset])

        rows = db.execute(query, tuple(params))
        logs = [dict(row) for row in rows]

        # Filter fields based on display configuration
        filtered_logs = []
        for log in logs:
            filtered_log = {
                'id': log.get('id'),
                'action': log.get('action'),
                'table_name': log.get('table_name'),
                'record_id': log.get('record_id'),
                'user_id': log.get('user_id'),
                'username': log.get('username'),  # Include username from JOIN
                'created_at': log.get('created_at'),
                'status_code': log.get('status_code'),
                'error_message': log.get('error_message')
            }

            # Add fields based on display configuration
            if display_config.get('ip_address', True):
                filtered_log['ip_address'] = log.get('ip_address')

            if display_config.get('user_agent', True):
                filtered_log['user_agent'] = log.get('user_agent')

            if display_config.get('geo_location', True):
                geo_str = log.get('geo_location')
                if geo_str:
                    try:
                        filtered_log['geo_location'] = json.loads(geo_str)
                    except:
                        pass

            if display_config.get('device_info', True):
                device_str = log.get('device_info')
                if device_str:
                    try:
                        filtered_log['device_info'] = json.loads(device_str)
                    except:
                        pass

            if display_config.get('request_method', True):
                filtered_log['request_method'] = log.get('request_method')

            if display_config.get('request_endpoint', True):
                filtered_log['request_endpoint'] = log.get('request_endpoint')

            # Always include request_query for transparency
            filtered_log['request_query'] = log.get('request_query')

            if display_config.get('referrer', True):
                filtered_log['referrer'] = log.get('referrer')

            if display_config.get('session_id', True):
                filtered_log['session_id'] = log.get('session_id')

            # Include request size if available
            if display_config.get('request_body_size', True):
                filtered_log['request_size'] = log.get('request_size')

            # Extract Cloudflare metadata from request_headers if enabled
            if display_config.get('cloudflare_metadata', True):
                headers_str = log.get('request_headers')
                if headers_str:
                    try:
                        headers_data = json.loads(headers_str)
                        cf_data = headers_data.get('cloudflare')
                        if cf_data:
                            filtered_log['cloudflare'] = cf_data
                    except:
                        pass

            # Always include details
            details_str = log.get('details')
            if details_str:
                try:
                    filtered_log['details'] = json.loads(details_str)
                except:
                    filtered_log['details'] = details_str

            filtered_logs.append(filtered_log)

        return {
            'logs': filtered_logs,
            'total': total_count,
            'limit': limit,
            'offset': offset
        }

    @staticmethod
    def get_statistics(days: int = 30):
        """Get audit log statistics for the admin dashboard."""
        cutoff_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff_date = (cutoff_date - timedelta(days=days)).isoformat()

        stats = {}

        # Total logs
        result = db.execute_one('SELECT COUNT(*) as count FROM enhanced_audit_log WHERE created_at >= ?', (cutoff_date,))
        stats['total_logs'] = result['count'] if result else 0

        # Logs by action
        rows = db.execute(
            'SELECT action, COUNT(*) as count FROM enhanced_audit_log WHERE created_at >= ? GROUP BY action ORDER BY count DESC',
            (cutoff_date,)
        )
        stats['by_action'] = {row['action']: row['count'] for row in rows}

        # Logs by user
        rows = db.execute(
            'SELECT user_id, COUNT(*) as count FROM enhanced_audit_log WHERE created_at >= ? AND user_id IS NOT NULL GROUP BY user_id ORDER BY count DESC LIMIT 10',
            (cutoff_date,)
        )
        stats['by_user'] = {row['user_id']: row['count'] for row in rows}

        # Failed actions
        result = db.execute_one(
            'SELECT COUNT(*) as count FROM enhanced_audit_log WHERE created_at >= ? AND (status_code >= 400 OR error_message IS NOT NULL)',
            (cutoff_date,)
        )
        stats['failed_actions'] = result['count'] if result else 0

        # Unique IPs
        result = db.execute_one(
            'SELECT COUNT(DISTINCT ip_address) as count FROM enhanced_audit_log WHERE created_at >= ?',
            (cutoff_date,)
        )
        stats['unique_ips'] = result['count'] if result else 0

        # Top countries
        rows = db.execute(
            '''SELECT geo_location, COUNT(*) as count
               FROM enhanced_audit_log
               WHERE created_at >= ? AND geo_location IS NOT NULL
               GROUP BY geo_location
               ORDER BY count DESC LIMIT 10''',
            (cutoff_date,)
        )

        country_counts = {}
        for row in rows:
            try:
                geo = json.loads(row['geo_location'])
                country = geo.get('country', 'Unknown')
                country_counts[country] = country_counts.get(country, 0) + row['count']
            except:
                pass
        stats['by_country'] = country_counts

        return stats

    @staticmethod
    def get_unique_ip_locations():
        """Get all unique IP addresses with geolocation data for mapping."""
        rows = db.execute(
            '''SELECT ip_address, geo_location, COUNT(*) as access_count
               FROM enhanced_audit_log
               WHERE geo_location IS NOT NULL
               AND ip_address IS NOT NULL
               GROUP BY ip_address, geo_location
               ORDER BY access_count DESC'''
        )

        unique_locations = []
        for row in rows:
            try:
                geo = json.loads(row['geo_location'])
                # Only include if we have valid coordinates
                if geo.get('lat') and geo.get('lon'):
                    unique_locations.append({
                        'ip': row['ip_address'],
                        'lat': geo.get('lat'),
                        'lon': geo.get('lon'),
                        'city': geo.get('city', 'Unknown'),
                        'region': geo.get('region', 'Unknown'),
                        'country': geo.get('country', 'Unknown'),
                        'count': row['access_count']
                    })
            except (json.JSONDecodeError, TypeError):
                pass

        return unique_locations


# Global enhanced audit logger instance
enhanced_audit_logger = EnhancedAuditLogger()
