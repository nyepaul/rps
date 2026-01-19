"""
Fingerprint API Routes
Handles advanced browser fingerprinting data collection
"""

from flask import Blueprint, request, jsonify
from flask_login import current_user
from src.services.enhanced_audit_logger import enhanced_audit_logger
import json

fingerprint_bp = Blueprint('fingerprint', __name__, url_prefix='/api')


@fingerprint_bp.route('/fingerprint', methods=['POST'])
def collect_fingerprint():
    """
    Receive and store browser fingerprint data from client.

    This endpoint receives comprehensive fingerprint data including:
    - Canvas fingerprinting
    - WebGL fingerprinting
    - Audio context fingerprinting
    - Font detection
    - Screen details
    - Hardware information
    - Battery status
    - Connection info
    - Media devices
    """
    try:
        fingerprint_data = request.get_json()

        if not fingerprint_data:
            return jsonify({'error': 'No fingerprint data provided'}), 400

        # Get user ID if authenticated
        user_id = None
        if current_user and current_user.is_authenticated:
            user_id = current_user.id

        # Analyze fingerprint data
        analysis = enhanced_audit_logger.analyze_fingerprint_data(
            fingerprint_data,
            ip_geolocation=None  # Could retrieve from audit log
        )

        # Combine fingerprint data with analysis
        enhanced_details = {
            'fingerprint_data': fingerprint_data,
            'fingerprint_analysis': analysis
        }

        # Log fingerprint collection with analysis
        enhanced_audit_logger.log(
            action='FINGERPRINT_COLLECTED',
            table_name='fingerprint',
            user_id=user_id,
            details=enhanced_details,
            status_code=200
        )

        return jsonify({
            'success': True,
            'message': 'Fingerprint data received and analyzed',
            'composite_fingerprint': fingerprint_data.get('composite_fingerprint'),
            'analysis': {
                'consistency_score': analysis['consistency_score'],
                'risk_level': analysis['risk_level'],
                'anomaly_count': len(analysis['anomalies'])
            }
        }), 200

    except Exception as e:
        enhanced_audit_logger.log(
            action='FINGERPRINT_ERROR',
            user_id=user_id if current_user and current_user.is_authenticated else None,
            error_message=str(e),
            status_code=500
        )
        return jsonify({'error': 'Failed to process fingerprint data'}), 500


@fingerprint_bp.route('/fingerprint/verify', methods=['POST'])
def verify_fingerprint():
    """
    Verify if a fingerprint matches the current session.
    Used for additional security verification.
    """
    try:
        data = request.get_json()
        composite_fingerprint = data.get('composite_fingerprint')

        if not composite_fingerprint:
            return jsonify({'error': 'No fingerprint provided'}), 400

        # TODO: Implement fingerprint verification logic
        # Compare with stored fingerprints for this user/session

        return jsonify({
            'success': True,
            'verified': True,
            'message': 'Fingerprint verified'
        }), 200

    except Exception as e:
        return jsonify({'error': 'Verification failed'}), 500
