"""Enhanced audit logging service with comprehensive data collection."""
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from flask import request, has_request_context, session
from flask_login import current_user
from src.database.connection import db
import re
from user_agents import parse as parse_user_agent


class AuditConfig:
    """Configuration for audit logging - what to collect and display."""

    # Default configuration
    DEFAULT_CONFIG = {
        'enabled': True,
        'collect': {
            'ip_address': True,
            'user_agent': True,
            'geo_location': True,
            'request_method': True,
            'request_endpoint': True,
            'request_headers': False,  # Privacy: off by default
            'request_body_size': True,
            'response_status': True,
            'session_id': True,
            'referrer': True,
            'device_info': True,
            'browser_info': True,
            'os_info': True,
            'login_attempts': True,
            'failed_actions': True
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
            'failed_actions': True
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
        """Get geographic location from IP address using ip-api.com."""
        if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1']:
            return {'city': 'Local', 'region': 'Local', 'country': 'Local', 'timezone': 'Local'}

        try:
            import requests
            # Using ip-api.com free tier (no API key required)
            response = requests.get(
                f'http://ip-api.com/json/{ip_address}?fields=status,country,countryCode,region,regionName,city,timezone',
                timeout=2
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    return {
                        'country': data.get('country', 'Unknown'),
                        'country_code': data.get('countryCode', 'XX'),
                        'region': data.get('regionName', 'Unknown'),
                        'city': data.get('city', 'Unknown'),
                        'timezone': data.get('timezone', 'Unknown')
                    }
        except Exception as e:
            print(f"Geo-location lookup failed: {e}")

        return None

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
        }

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

        # Collect IP address
        if collect_config.get('ip_address', True):
            audit_data['ip_address'] = request.remote_addr

        # Collect user agent
        if collect_config.get('user_agent', True):
            user_agent_string = request.headers.get('User-Agent', '')
            audit_data['user_agent'] = user_agent_string[:500]  # Limit length

            # Parse device info from user agent
            if collect_config.get('device_info', True) or collect_config.get('browser_info', True):
                device_info = EnhancedAuditLogger._parse_device_info(user_agent_string)
                audit_data['device_info'] = json.dumps(device_info)

        # Collect geo location
        if collect_config.get('geo_location', True) and audit_data.get('ip_address'):
            geo_data = EnhancedAuditLogger._get_geo_location(audit_data['ip_address'])
            if geo_data:
                audit_data['geo_location'] = json.dumps(geo_data)

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
                audit_data['request_headers'] = json.dumps(request_info.get('headers', {}))

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
    def get_logs(
        user_id: Optional[int] = None,
        action: Optional[str] = None,
        table_name: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        ip_address: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ):
        """
        Retrieve audit logs with comprehensive filtering.

        Returns both the logs and total count for pagination.
        """
        config = AuditConfig.get_config()
        display_config = config.get('display', {})

        # Build query
        query = 'SELECT * FROM enhanced_audit_log WHERE 1=1'
        count_query = 'SELECT COUNT(*) as total FROM enhanced_audit_log WHERE 1=1'
        params = []

        if user_id is not None:
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

        # Get paginated results
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
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

            if display_config.get('referrer', True):
                filtered_log['referrer'] = log.get('referrer')

            if display_config.get('session_id', True):
                filtered_log['session_id'] = log.get('session_id')

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


# Global enhanced audit logger instance
enhanced_audit_logger = EnhancedAuditLogger()
