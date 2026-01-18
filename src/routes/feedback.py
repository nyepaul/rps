"""Feedback routes for user comments, feature requests, and bug reports."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional
from src.auth.admin_required import admin_required
from src.auth.super_admin_required import super_admin_required
from src.database.connection import db
from src.extensions import limiter
import html
import json
from datetime import datetime
from user_agents import parse as parse_user_agent

feedback_bp = Blueprint('feedback', __name__, url_prefix='/api/feedback')


class FeedbackSchema(BaseModel):
    """Schema for feedback submission."""
    type: str
    content: str
    browser_info: Optional[dict] = None
    system_info: Optional[dict] = None

    @validator('type')
    def validate_type(cls, v):
        if v not in ['comment', 'feature', 'bug']:
            raise ValueError('Type must be one of: comment, feature, bug')
        return v

    @validator('content')
    def validate_content(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Content cannot be empty')
        if len(v) > 10000:
            raise ValueError('Content must be less than 10,000 characters')
        return v.strip()


def get_client_ip():
    """
    Get the real client IP address, accounting for proxies like Cloudflare.

    Checks headers in order of priority:
    1. CF-Connecting-IP (Cloudflare)
    2. X-Real-IP (nginx)
    3. X-Forwarded-For (standard proxy header)
    4. request.remote_addr (direct connection)
    """
    # Cloudflare's connecting IP (most reliable when behind CF)
    if 'CF-Connecting-IP' in request.headers:
        return request.headers.get('CF-Connecting-IP')

    # X-Real-IP from reverse proxy
    if 'X-Real-IP' in request.headers:
        return request.headers.get('X-Real-IP')

    # X-Forwarded-For (can be a comma-separated list)
    if 'X-Forwarded-For' in request.headers:
        # Take the first IP in the list (original client)
        forwarded_for = request.headers.get('X-Forwarded-For')
        return forwarded_for.split(',')[0].strip()

    # Fallback to direct connection IP
    return request.remote_addr


def parse_browser_info(user_agent_string: str) -> dict:
    """Parse user agent string to extract browser and OS info."""
    try:
        ua = parse_user_agent(user_agent_string)
        return {
            'browser': ua.browser.family,
            'browser_version': ua.browser.version_string,
            'os': ua.os.family,
            'os_version': ua.os.version_string,
            'device': ua.device.family,
            'is_mobile': ua.is_mobile,
            'is_tablet': ua.is_tablet,
            'is_pc': ua.is_pc
        }
    except Exception:
        return {
            'browser': 'Unknown',
            'os': 'Unknown',
            'device': 'Unknown'
        }


@feedback_bp.route('', methods=['POST'])
@login_required
@limiter.limit("10 per hour")
def submit_feedback():
    """
    Submit user feedback (comment, feature request, or bug report).

    Request body:
        type: 'comment', 'feature', or 'bug'
        content: Feedback text (max 10,000 chars)
        browser_info: Optional dict with screen_resolution, viewport_size, timezone, language
        system_info: Optional dict with additional client-side info
    """
    try:
        data = FeedbackSchema(**request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # Sanitize content to prevent XSS
    sanitized_content = html.escape(data.content)

    # Get client IP (accounting for Cloudflare)
    ip_address = get_client_ip()

    # Get user agent and parse it
    user_agent_string = request.headers.get('User-Agent', '')
    parsed_ua = parse_browser_info(user_agent_string)

    # Get additional browser info from client
    browser_info = data.browser_info or {}

    # Get session ID (first 8 chars for privacy)
    session_id = None
    try:
        from flask import session
        sid = session.get('_id', None)
        session_id = sid[:8] if sid else None
    except Exception:
        pass

    # Prepare data for database
    feedback_data = {
        'user_id': current_user.id,
        'type': data.type,
        'content': sanitized_content,
        'ip_address': ip_address,
        'user_agent': user_agent_string[:500],  # Limit length
        'browser_name': parsed_ua.get('browser'),
        'browser_version': parsed_ua.get('browser_version'),
        'os_name': parsed_ua.get('os'),
        'os_version': parsed_ua.get('os_version'),
        'device_type': parsed_ua.get('device'),
        'screen_resolution': browser_info.get('screen_resolution'),
        'viewport_size': browser_info.get('viewport_size'),
        'timezone': browser_info.get('timezone'),
        'language': browser_info.get('language'),
        'referrer': request.referrer,
        'current_url': browser_info.get('current_url'),
        'session_id': session_id,
        'created_at': datetime.now().isoformat()
    }

    # Store additional system info if provided
    if data.system_info:
        feedback_data['admin_notes'] = json.dumps({
            'system_info': data.system_info,
            'request_headers': {
                'CF-Ray': request.headers.get('CF-Ray'),
                'CF-IPCountry': request.headers.get('CF-IPCountry'),
                'Accept-Language': request.headers.get('Accept-Language')
            }
        })

    # Save to database - metadata and content in separate tables
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Insert feedback metadata (without content)
            cursor.execute('''
                INSERT INTO feedback (
                    user_id, type, ip_address, user_agent,
                    browser_name, browser_version, os_name, os_version,
                    device_type, screen_resolution, viewport_size,
                    timezone, language, referrer, current_url,
                    session_id, admin_notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                feedback_data['user_id'],
                feedback_data['type'],
                feedback_data['ip_address'],
                feedback_data['user_agent'],
                feedback_data['browser_name'],
                feedback_data['browser_version'],
                feedback_data['os_name'],
                feedback_data['os_version'],
                feedback_data['device_type'],
                feedback_data['screen_resolution'],
                feedback_data['viewport_size'],
                feedback_data['timezone'],
                feedback_data['language'],
                feedback_data['referrer'],
                feedback_data['current_url'],
                feedback_data['session_id'],
                feedback_data.get('admin_notes'),
                feedback_data['created_at']
            ))
            feedback_id = cursor.lastrowid

            # Insert content separately (only accessible to super admin)
            cursor.execute('''
                INSERT INTO feedback_content (feedback_id, content, created_at)
                VALUES (?, ?, ?)
            ''', (feedback_id, sanitized_content, feedback_data['created_at']))

            conn.commit()

        return jsonify({
            'success': True,
            'message': 'Thank you for your feedback!',
            'feedback_id': feedback_id
        }), 201

    except Exception as e:
        print(f"Error saving feedback: {e}")
        return jsonify({'error': 'Failed to save feedback'}), 500


@feedback_bp.route('', methods=['GET'])
@login_required
@admin_required
def get_all_feedback():
    """
    Get all feedback submissions (admin only).

    Query parameters:
        type: Filter by type (comment, feature, bug)
        status: Filter by status (pending, reviewed, resolved, closed)
        user_id: Filter by user ID
        limit: Number of records (default: 100, max: 500)
        offset: Pagination offset (default: 0)
    """
    # Get query parameters
    feedback_type = request.args.get('type')
    status = request.args.get('status')
    user_id = request.args.get('user_id')
    limit = min(int(request.args.get('limit', 100)), 500)
    offset = int(request.args.get('offset', 0))

    # Build query
    query = 'SELECT * FROM feedback WHERE 1=1'
    params = []

    if feedback_type:
        query += ' AND type = ?'
        params.append(feedback_type)

    if status:
        query += ' AND status = ?'
        params.append(status)

    if user_id:
        query += ' AND user_id = ?'
        params.append(user_id)

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.extend([limit, offset])

    # Execute query
    try:
        rows = db.execute(query, tuple(params))

        # Get total count
        count_query = 'SELECT COUNT(*) as count FROM feedback WHERE 1=1'
        count_params = []
        if feedback_type:
            count_query += ' AND type = ?'
            count_params.append(feedback_type)
        if status:
            count_query += ' AND status = ?'
            count_params.append(status)
        if user_id:
            count_query += ' AND user_id = ?'
            count_params.append(user_id)

        total_count = db.execute_one(count_query, tuple(count_params))['count']

        # Convert rows to list of dicts
        feedback_list = [dict(row) for row in rows]

        return jsonify({
            'feedback': feedback_list,
            'total': total_count,
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        print(f"Error fetching feedback: {e}")
        return jsonify({'error': 'Failed to fetch feedback'}), 500


@feedback_bp.route('/<int:feedback_id>', methods=['PATCH'])
@login_required
@admin_required
def update_feedback_status(feedback_id: int):
    """
    Update feedback status or add admin notes (admin only).

    Request body:
        status: New status (pending, reviewed, resolved, closed)
        admin_notes: Admin notes/comments
    """
    data = request.json

    # Build update query
    updates = []
    params = []

    if 'status' in data:
        if data['status'] not in ['pending', 'reviewed', 'resolved', 'closed']:
            return jsonify({'error': 'Invalid status'}), 400
        updates.append('status = ?')
        params.append(data['status'])

    if 'admin_notes' in data:
        # Sanitize admin notes
        notes = html.escape(data['admin_notes'][:5000])  # Max 5000 chars
        updates.append('admin_notes = ?')
        params.append(notes)

    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400

    updates.append('updated_at = ?')
    params.append(datetime.now().isoformat())
    params.append(feedback_id)

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            query = f"UPDATE feedback SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({'error': 'Feedback not found'}), 404

        return jsonify({
            'success': True,
            'message': 'Feedback updated successfully'
        }), 200

    except Exception as e:
        print(f"Error updating feedback: {e}")
        return jsonify({'error': 'Failed to update feedback'}), 500


@feedback_bp.route('/<int:feedback_id>/content', methods=['GET'])
@login_required
@super_admin_required
def get_feedback_content(feedback_id: int):
    """
    Get feedback content (super admin only).

    This returns the actual content of the feedback, which is stored
    separately and only accessible to super admins for security.
    """
    try:
        row = db.execute_one(
            'SELECT content, created_at FROM feedback_content WHERE feedback_id = ?',
            (feedback_id,)
        )

        if not row:
            return jsonify({'error': 'Content not found'}), 404

        return jsonify({
            'feedback_id': feedback_id,
            'content': row['content'],
            'created_at': row['created_at']
        }), 200

    except Exception as e:
        print(f"Error fetching feedback content: {e}")
        return jsonify({'error': 'Failed to fetch content'}), 500


@feedback_bp.route('/<int:feedback_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_feedback(feedback_id: int):
    """Delete feedback (admin only). Content is cascade deleted automatically."""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM feedback WHERE id = ?', (feedback_id,))
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({'error': 'Feedback not found'}), 404

        return jsonify({
            'success': True,
            'message': 'Feedback deleted successfully'
        }), 200

    except Exception as e:
        print(f"Error deleting feedback: {e}")
        return jsonify({'error': 'Failed to delete feedback'}), 500


@feedback_bp.route('/my', methods=['GET'])
@login_required
def get_my_feedback():
    """
    Get current user's feedback submissions.

    Query parameters:
        type: Filter by type (comment, feature, bug)
        status: Filter by status (pending, reviewed, resolved, closed)
        limit: Number of records (default: 50, max: 100)
        offset: Pagination offset (default: 0)
    """
    feedback_type = request.args.get('type')
    status = request.args.get('status')
    limit = min(int(request.args.get('limit', 50)), 100)
    offset = int(request.args.get('offset', 0))

    # Build query for current user only - join with content table
    query = '''
        SELECT f.*, fc.content
        FROM feedback f
        LEFT JOIN feedback_content fc ON f.id = fc.feedback_id
        WHERE f.user_id = ?
    '''
    params = [current_user.id]

    if feedback_type:
        query += ' AND f.type = ?'
        params.append(feedback_type)

    if status:
        query += ' AND f.status = ?'
        params.append(status)

    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?'
    params.extend([limit, offset])

    try:
        rows = db.execute(query, tuple(params))

        # Get total count
        count_query = 'SELECT COUNT(*) as count FROM feedback WHERE user_id = ?'
        count_params = [current_user.id]
        if feedback_type:
            count_query += ' AND type = ?'
            count_params.append(feedback_type)
        if status:
            count_query += ' AND status = ?'
            count_params.append(status)

        total_count = db.execute_one(count_query, tuple(count_params))['count']

        feedback_list = [dict(row) for row in rows]

        return jsonify({
            'feedback': feedback_list,
            'total': total_count,
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        print(f"Error fetching user feedback: {e}")
        return jsonify({'error': 'Failed to fetch feedback'}), 500


@feedback_bp.route('/my/<int:feedback_id>', methods=['PATCH'])
@login_required
def update_my_feedback(feedback_id: int):
    """
    Update own feedback content (user can only edit content, not status).

    Request body:
        content: Updated feedback text
    """
    data = request.json

    if 'content' not in data:
        return jsonify({'error': 'Content is required'}), 400

    content = data['content'].strip()
    if not content:
        return jsonify({'error': 'Content cannot be empty'}), 400

    if len(content) > 10000:
        return jsonify({'error': 'Content too long (max 10,000 characters)'}), 400

    # Sanitize content
    sanitized_content = html.escape(content)

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # First verify the feedback belongs to the user
            cursor.execute('SELECT user_id FROM feedback WHERE id = ?', (feedback_id,))
            row = cursor.fetchone()
            if not row:
                return jsonify({'error': 'Feedback not found'}), 404
            if row[0] != current_user.id:
                return jsonify({'error': 'Access denied'}), 403

            # Update content in feedback_content table
            cursor.execute('''
                UPDATE feedback_content
                SET content = ?
                WHERE feedback_id = ?
            ''', (sanitized_content, feedback_id))

            # Update timestamp in feedback table
            cursor.execute('''
                UPDATE feedback
                SET updated_at = ?
                WHERE id = ?
            ''', (datetime.now().isoformat(), feedback_id))

            conn.commit()

        return jsonify({
            'success': True,
            'message': 'Feedback updated successfully'
        }), 200

    except Exception as e:
        print(f"Error updating user feedback: {e}")
        return jsonify({'error': 'Failed to update feedback'}), 500


@feedback_bp.route('/my/<int:feedback_id>', methods=['DELETE'])
@login_required
def delete_my_feedback(feedback_id: int):
    """Delete own feedback."""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            # Only allow deleting own feedback
            cursor.execute('DELETE FROM feedback WHERE id = ? AND user_id = ?',
                          (feedback_id, current_user.id))
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({'error': 'Feedback not found or access denied'}), 404

        return jsonify({
            'success': True,
            'message': 'Feedback deleted successfully'
        }), 200

    except Exception as e:
        print(f"Error deleting user feedback: {e}")
        return jsonify({'error': 'Failed to delete feedback'}), 500
