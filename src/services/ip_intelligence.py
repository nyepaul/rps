"""
IP Intelligence Service
Advanced IP address analysis and threat detection
"""

import socket
import re
from typing import Dict, Optional, Any
import ipaddress


class IPIntelligence:
    """Advanced IP address intelligence and threat detection."""

    # Known VPN/Proxy IP ranges (simplified - production would use comprehensive databases)
    VPN_ASN_RANGES = [
        'AS13335',  # Cloudflare
        'AS14061',  # DigitalOcean
        'AS16509',  # Amazon AWS
        'AS20473',  # Choopa (Vultr)
        'AS24940',  # Hetzner
        'AS36352',  # ColoCrossing
        'AS47583',  # Hostinger
        'AS62041',  # Plesk
    ]

    # Common hosting providers
    HOSTING_KEYWORDS = [
        'amazon', 'aws', 'azure', 'google', 'digitalocean', 'linode',
        'vultr', 'ovh', 'hetzner', 'rackspace', 'cloudflare', 'fastly'
    ]

    # Known malicious indicators
    MALICIOUS_KEYWORDS = [
        'tor', 'proxy', 'vpn', 'anonymous', 'privacy', 'hide'
    ]

    @staticmethod
    def analyze_ip(ip_address: str) -> Dict[str, Any]:
        """
        Comprehensive IP address analysis.

        Returns dict with:
        - type: IPv4 or IPv6
        - is_private: Private IP address
        - is_reserved: Reserved IP address
        - is_loopback: Loopback address
        - is_multicast: Multicast address
        - reverse_dns: Reverse DNS lookup
        - asn_info: ASN information (if available)
        - risk_indicators: List of risk factors
        - risk_score: 0-100 risk score
        """
        result = {
            'ip': ip_address,
            'risk_indicators': [],
            'risk_score': 0
        }

        try:
            ip_obj = ipaddress.ip_address(ip_address)

            # Basic IP properties
            result['type'] = 'IPv6' if ip_obj.version == 6 else 'IPv4'
            result['is_private'] = ip_obj.is_private
            result['is_reserved'] = ip_obj.is_reserved
            result['is_loopback'] = ip_obj.is_loopback
            result['is_multicast'] = ip_obj.is_multicast
            result['is_global'] = ip_obj.is_global

            # Reverse DNS lookup
            result['reverse_dns'] = IPIntelligence.reverse_dns_lookup(ip_address)

            # Analyze reverse DNS for indicators
            if result['reverse_dns']:
                rdns_lower = result['reverse_dns'].lower()

                # Check for hosting providers
                if any(keyword in rdns_lower for keyword in IPIntelligence.HOSTING_KEYWORDS):
                    result['risk_indicators'].append('hosting_provider')
                    result['risk_score'] += 15
                    result['is_hosting'] = True

                # Check for malicious keywords
                if any(keyword in rdns_lower for keyword in IPIntelligence.MALICIOUS_KEYWORDS):
                    result['risk_indicators'].append('suspicious_hostname')
                    result['risk_score'] += 30
                    result['is_suspicious'] = True

            # Additional checks for private/reserved IPs
            if result['is_private']:
                result['risk_indicators'].append('private_ip')

            if result['is_reserved']:
                result['risk_indicators'].append('reserved_ip')
                result['risk_score'] += 10

            # Risk classification
            if result['risk_score'] >= 60:
                result['risk_level'] = 'high'
            elif result['risk_score'] >= 30:
                result['risk_level'] = 'medium'
            else:
                result['risk_level'] = 'low'

        except ValueError as e:
            result['error'] = f'Invalid IP address: {str(e)}'
            result['risk_score'] = 100
            result['risk_level'] = 'high'

        return result

    @staticmethod
    def reverse_dns_lookup(ip_address: str) -> Optional[str]:
        """
        Perform reverse DNS lookup.

        Returns hostname if found, None otherwise.
        """
        try:
            hostname = socket.gethostbyaddr(ip_address)[0]
            return hostname
        except (socket.herror, socket.gaierror, socket.timeout):
            return None

    @staticmethod
    def is_tor_exit_node(ip_address: str) -> bool:
        """
        Check if IP is a known Tor exit node.

        Note: This is a simplified check. Production would query
        Tor exit node lists or use external APIs.
        """
        # Simplified check - would need comprehensive Tor exit node database
        reverse_dns = IPIntelligence.reverse_dns_lookup(ip_address)
        if reverse_dns:
            return 'tor' in reverse_dns.lower()
        return False

    @staticmethod
    def detect_vpn_proxy(ip_address: str, user_agent: str = None) -> Dict[str, Any]:
        """
        Detect if connection is from VPN/Proxy.

        Returns dict with:
        - is_vpn: Boolean
        - is_proxy: Boolean
        - confidence: 0-100 confidence score
        - indicators: List of detection indicators
        """
        result = {
            'is_vpn': False,
            'is_proxy': False,
            'confidence': 0,
            'indicators': []
        }

        # Check reverse DNS
        reverse_dns = IPIntelligence.reverse_dns_lookup(ip_address)
        if reverse_dns:
            rdns_lower = reverse_dns.lower()

            # VPN indicators in hostname
            vpn_keywords = ['vpn', 'proxy', 'tunnel', 'hide', 'anonymous', 'privacy']
            if any(keyword in rdns_lower for keyword in vpn_keywords):
                result['is_vpn'] = True
                result['confidence'] += 40
                result['indicators'].append('vpn_in_hostname')

            # Hosting provider indicators
            if any(provider in rdns_lower for provider in IPIntelligence.HOSTING_KEYWORDS):
                result['confidence'] += 20
                result['indicators'].append('hosting_provider')

        # Check if Tor exit node
        if IPIntelligence.is_tor_exit_node(ip_address):
            result['is_proxy'] = True
            result['is_vpn'] = True
            result['confidence'] += 50
            result['indicators'].append('tor_exit_node')

        # User agent analysis
        if user_agent:
            ua_lower = user_agent.lower()
            if 'tor' in ua_lower or 'onion' in ua_lower:
                result['is_vpn'] = True
                result['confidence'] += 30
                result['indicators'].append('tor_user_agent')

        # Cap confidence at 100
        result['confidence'] = min(result['confidence'], 100)

        # Set risk level
        if result['confidence'] >= 70:
            result['risk_level'] = 'high'
        elif result['confidence'] >= 40:
            result['risk_level'] = 'medium'
        else:
            result['risk_level'] = 'low'

        return result

    @staticmethod
    def analyze_ip_location_mismatch(
        ip_geolocation: Dict,
        browser_timezone: str = None,
        browser_language: str = None
    ) -> Dict[str, Any]:
        """
        Detect mismatches between IP location and browser settings.

        Indicates potential VPN/proxy use or location spoofing.
        """
        mismatches = {
            'has_mismatch': False,
            'indicators': [],
            'confidence': 0
        }

        if not ip_geolocation:
            return mismatches

        ip_country = ip_geolocation.get('country_code', '').upper()

        # Timezone mismatch
        if browser_timezone:
            # Common timezone to country mappings (simplified)
            timezone_countries = {
                'America/New_York': 'US',
                'America/Chicago': 'US',
                'America/Denver': 'US',
                'America/Los_Angeles': 'US',
                'Europe/London': 'GB',
                'Europe/Paris': 'FR',
                'Europe/Berlin': 'DE',
                'Asia/Tokyo': 'JP',
                'Asia/Shanghai': 'CN',
                'Australia/Sydney': 'AU'
            }

            expected_country = timezone_countries.get(browser_timezone)
            if expected_country and expected_country != ip_country:
                mismatches['has_mismatch'] = True
                mismatches['indicators'].append('timezone_country_mismatch')
                mismatches['confidence'] += 30

        # Language mismatch
        if browser_language:
            # Extract primary language code
            lang_code = browser_language.split('-')[0].upper()

            # Common language to country mappings (simplified)
            language_countries = {
                'EN': ['US', 'GB', 'CA', 'AU', 'NZ'],
                'ES': ['ES', 'MX', 'AR', 'CO'],
                'FR': ['FR', 'CA', 'BE'],
                'DE': ['DE', 'AT', 'CH'],
                'JA': ['JP'],
                'ZH': ['CN', 'TW', 'HK']
            }

            expected_countries = language_countries.get(lang_code, [])
            if expected_countries and ip_country not in expected_countries:
                mismatches['has_mismatch'] = True
                mismatches['indicators'].append('language_country_mismatch')
                mismatches['confidence'] += 20

        # Risk assessment
        if mismatches['confidence'] >= 40:
            mismatches['risk_level'] = 'high'
        elif mismatches['confidence'] >= 20:
            mismatches['risk_level'] = 'medium'
        else:
            mismatches['risk_level'] = 'low'

        return mismatches

    @staticmethod
    def get_ip_reputation(ip_address: str) -> Dict[str, Any]:
        """
        Get IP reputation score.

        In production, this would query:
        - AbuseIPDB
        - VirusTotal
        - IPVoid
        - StopForumSpam
        - ProjectHoneypot

        For now, returns basic reputation analysis.
        """
        reputation = {
            'score': 50,  # Neutral score
            'sources_checked': 0,
            'blacklisted': False,
            'whitelisted': False,
            'reports': []
        }

        # Check if private/internal IP
        try:
            ip_obj = ipaddress.ip_address(ip_address)
            if ip_obj.is_private or ip_obj.is_loopback:
                reputation['whitelisted'] = True
                reputation['score'] = 100
                reputation['reports'].append('Internal/Private IP - Trusted')
        except ValueError:
            reputation['score'] = 0
            reputation['blacklisted'] = True
            reputation['reports'].append('Invalid IP address format')

        return reputation


# Global instance
ip_intelligence = IPIntelligence()
