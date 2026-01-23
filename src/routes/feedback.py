"""Feedback routes for user comments, feature requests, and bug reports."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from pydantic import BaseModel, validator
from typing import Optional
from src.auth.admin_required import admin_required
from src.auth.super_admin_required import super_admin_required
from src.database.connection import db
from src.extensions import limiter
from src.services.enhanced_audit_logger import enhanced_audit_logger
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

        enhanced_audit_logger.log(
            action='SUBMIT_FEEDBACK',
            table_name='feedback',
            record_id=feedback_id,
            details={
                'type': data.type,
                'content_length': len(data.content)
            },
            status_code=201
        )
        return jsonify({
            'success': True,
            'message': 'Thank you for your feedback!',
            'feedback_id': feedback_id
        }), 201

    except Exception as e:
        print(f"Error saving feedback: {e}")
        enhanced_audit_logger.log(
            action='SUBMIT_FEEDBACK_ERROR',
            details={'type': data.type if 'data' in dir() else None, 'error': str(e)},
            status_code=500
        )
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

    # Build query with reply count
    query = '''
        SELECT f.*,
            (SELECT COUNT(*) FROM feedback_replies WHERE feedback_id = f.id) as reply_count
        FROM feedback f
        WHERE 1=1
    '''
    params = []

    if feedback_type:
        query += ' AND f.type = ?'
        params.append(feedback_type)

    if status:
        query += ' AND f.status = ?'
        params.append(status)

    if user_id:
        query += ' AND f.user_id = ?'
        params.append(user_id)

    query += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?'
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

    # Build query for current user only - join with content table and add reply count
    query = '''
        SELECT f.*, fc.content,
            (SELECT COUNT(*) FROM feedback_replies WHERE feedback_id = f.id AND is_private = 0) as reply_count
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

        enhanced_audit_logger.log(
            action='VIEW_MY_FEEDBACK',
            details={
                'feedback_count': len(feedback_list),
                'total': total_count
            },
            status_code=200
        )
        return jsonify({
            'feedback': feedback_list,
            'total': total_count,
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        print(f"Error fetching user feedback: {e}")
        enhanced_audit_logger.log(
            action='VIEW_MY_FEEDBACK_ERROR',
            details={'error': str(e)},
            status_code=500
        )
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

        enhanced_audit_logger.log(
            action='UPDATE_MY_FEEDBACK',
            table_name='feedback',
            record_id=feedback_id,
            details={'content_length': len(content)},
            status_code=200
        )
        return jsonify({
            'success': True,
            'message': 'Feedback updated successfully'
        }), 200

    except Exception as e:
        print(f"Error updating user feedback: {e}")
        enhanced_audit_logger.log(
            action='UPDATE_MY_FEEDBACK_ERROR',
            details={'feedback_id': feedback_id, 'error': str(e)},
            status_code=500
        )
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
                enhanced_audit_logger.log(
                    action='DELETE_MY_FEEDBACK_NOT_FOUND',
                    details={'feedback_id': feedback_id},
                    status_code=404
                )
                return jsonify({'error': 'Feedback not found or access denied'}), 404

        enhanced_audit_logger.log(
            action='DELETE_MY_FEEDBACK',
            table_name='feedback',
            record_id=feedback_id,
            details={},
            status_code=200
        )
        return jsonify({
            'success': True,
            'message': 'Feedback deleted successfully'
        }), 200

    except Exception as e:
        print(f"Error deleting user feedback: {e}")
        enhanced_audit_logger.log(
            action='DELETE_MY_FEEDBACK_ERROR',
            details={'feedback_id': feedback_id, 'error': str(e)},
            status_code=500
        )
        return jsonify({'error': 'Failed to delete feedback'}), 500


@feedback_bp.route('/<int:feedback_id>/replies', methods=['POST'])
@login_required
def add_reply(feedback_id: int):
    """
    Add reply to feedback (User or Admin).

    Request body:
        reply_text: The reply message
        is_private: Boolean (Admin only)
    """
    data = request.json

    if 'reply_text' not in data:
        return jsonify({'error': 'reply_text is required'}), 400

    reply_text = data['reply_text'].strip()
    if not reply_text:
        return jsonify({'error': 'Reply text cannot be empty'}), 400

    if len(reply_text) > 5000:
        return jsonify({'error': 'Reply too long (max 5,000 characters)'}), 400

    # Sanitize reply text
    sanitized_reply = html.escape(reply_text)

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Verify feedback exists and check status
            cursor.execute('SELECT user_id, status FROM feedback WHERE id = ?', (feedback_id,))
            feedback_row = cursor.fetchone()
            if not feedback_row:
                return jsonify({'error': 'Feedback not found'}), 404
            
            owner_id = feedback_row[0]
            status = feedback_row[1]

            # Check permissions: Must be Admin or Owner
            is_admin = getattr(current_user, 'is_admin', False)
            if not is_admin and current_user.id != owner_id:
                return jsonify({'error': 'Access denied'}), 403

            # Check if closed
            if status == 'closed' and not is_admin:
                return jsonify({'error': 'Cannot reply to closed feedback'}), 400

            # Determine privacy (Users cannot make private notes)
            is_private = data.get('is_private', False)
            if not is_admin:
                is_private = False

            # Insert reply
            # We use 'admin_id' column to store the replier's ID (legacy naming)
            cursor.execute('''
                INSERT INTO feedback_replies (feedback_id, admin_id, reply_text, is_private, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (feedback_id, current_user.id, sanitized_reply, 1 if is_private else 0, datetime.now().isoformat()))

            reply_id = cursor.lastrowid

            # Update feedback timestamps
            # If user replied, maybe update status to 'pending' if it was 'reviewed'? 
            # For now, just update timestamps.
            cursor.execute('''
                UPDATE feedback
                SET last_reply_at = ?, updated_at = ?
                WHERE id = ?
            ''', (datetime.now().isoformat(), datetime.now().isoformat(), feedback_id))

            conn.commit()

            return jsonify({
                'success': True,
                'message': 'Reply added successfully',
                'reply_id': reply_id
            }), 201

    except Exception as e:
        print(f"Error adding reply: {e}")
        return jsonify({'error': 'Failed to add reply'}), 500


@feedback_bp.route('/<int:feedback_id>/replies', methods=['GET'])
@login_required
def get_replies(feedback_id: int):
    """
    Get replies for a feedback item.

    Users can see:
    - Their own feedback's public replies

    Admins can see:
    - All replies (both public and private)
    """
    try:
        # Check if user owns this feedback or is admin
        feedback_row = db.execute_one('SELECT user_id FROM feedback WHERE id = ?', (feedback_id,))
        if not feedback_row:
            return jsonify({'error': 'Feedback not found'}), 404

        is_owner = feedback_row['user_id'] == current_user.id
        is_admin = getattr(current_user, 'is_admin', False)

        if not is_owner and not is_admin:
            return jsonify({'error': 'Access denied'}), 403

        # Build query based on permissions
        if is_admin:
            # Admins see all replies
            query = '''
                SELECT fr.*, u.username as admin_username
                FROM feedback_replies fr
                LEFT JOIN users u ON fr.admin_id = u.id
                WHERE fr.feedback_id = ?
                ORDER BY fr.created_at ASC
            '''
        else:
            # Users only see public replies
            query = '''
                SELECT fr.*, u.username as admin_username
                FROM feedback_replies fr
                LEFT JOIN users u ON fr.admin_id = u.id
                WHERE fr.feedback_id = ? AND fr.is_private = 0
                ORDER BY fr.created_at ASC
            '''

        rows = db.execute(query, (feedback_id,))
        replies = [dict(row) for row in rows]

        return jsonify({
            'replies': replies,
            'total': len(replies)
        }), 200

    except Exception as e:
        print(f"Error fetching replies: {e}")
        return jsonify({'error': 'Failed to fetch replies'}), 500


@feedback_bp.route('/replies/<int:reply_id>', methods=['PATCH'])
@login_required
@admin_required
def update_reply(reply_id: int):
    """
    Update a reply (admin only).

    Request body:
        reply_text: Updated reply text
        is_private: Updated privacy setting
    """
    data = request.json

    updates = []
    params = []

    if 'reply_text' in data:
        reply_text = data['reply_text'].strip()
        if not reply_text:
            return jsonify({'error': 'Reply text cannot be empty'}), 400
        if len(reply_text) > 5000:
            return jsonify({'error': 'Reply too long (max 5,000 characters)'}), 400

        sanitized_reply = html.escape(reply_text)
        updates.append('reply_text = ?')
        params.append(sanitized_reply)

    if 'is_private' in data:
        updates.append('is_private = ?')
        params.append(1 if data['is_private'] else 0)

    if not updates:
        return jsonify({'error': 'No valid fields to update'}), 400

    updates.append('updated_at = ?')
    params.append(datetime.now().isoformat())
    params.append(reply_id)

    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            query = f"UPDATE feedback_replies SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({'error': 'Reply not found'}), 404

            return jsonify({
                'success': True,
                'message': 'Reply updated successfully'
            }), 200

    except Exception as e:
        print(f"Error updating reply: {e}")
        return jsonify({'error': 'Failed to update reply'}), 500


@feedback_bp.route('/replies/<int:reply_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_reply(reply_id: int):
    """Delete a reply (admin only)."""
    try:
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM feedback_replies WHERE id = ?', (reply_id,))
            conn.commit()

            if cursor.rowcount == 0:
                return jsonify({'error': 'Reply not found'}), 404

            return jsonify({
                'success': True,
                'message': 'Reply deleted successfully'
            }), 200

    except Exception as e:
        print(f"Error deleting reply: {e}")
        return jsonify({'error': 'Failed to delete reply'}), 500


@feedback_bp.route('/my/<int:feedback_id>/thread', methods=['GET'])
@login_required
def get_my_feedback_thread(feedback_id: int):
    """
    Get full feedback thread with replies (user's own feedback only).

    Returns:
        - Feedback details
        - Content
        - Public admin replies (chronological)
    """
    try:
        # Verify ownership
        feedback_row = db.execute_one('''
            SELECT f.*, fc.content, u.username as user_username
            FROM feedback f
            LEFT JOIN feedback_content fc ON f.id = fc.feedback_id
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.id = ? AND f.user_id = ?
        ''', (feedback_id, current_user.id))

        if not feedback_row:
            return jsonify({'error': 'Feedback not found or access denied'}), 404

        feedback = dict(feedback_row)

        # Get public replies
        replies_rows = db.execute('''
            SELECT fr.*, u.username as admin_username
            FROM feedback_replies fr
            LEFT JOIN users u ON fr.admin_id = u.id
            WHERE fr.feedback_id = ? AND fr.is_private = 0
            ORDER BY fr.created_at ASC
        ''', (feedback_id,))

        feedback['replies'] = [dict(row) for row in replies_rows]
        feedback['reply_count'] = len(feedback['replies'])
        feedback['has_unread_replies'] = len(feedback['replies']) > 0  # Simple version

        return jsonify(feedback), 200

    except Exception as e:
        print(f"Error fetching feedback thread: {e}")
        return jsonify({'error': 'Failed to fetch feedback thread'}), 500


@feedback_bp.route('/<int:feedback_id>/thread', methods=['GET'])
@login_required
@admin_required
def get_feedback_thread_admin(feedback_id: int):
    """
    Get full feedback thread with ALL replies including private notes (admin only).

    Returns:
        - Feedback details
        - Content
        - All admin replies (both public and private)
    """
    try:
        # Get feedback with content
        feedback_row = db.execute_one('''
            SELECT f.*, fc.content, u.username as user_username, u.email as user_email
            FROM feedback f
            LEFT JOIN feedback_content fc ON f.id = fc.feedback_id
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.id = ?
        ''', (feedback_id,))

        if not feedback_row:
            return jsonify({'error': 'Feedback not found'}), 404

        feedback = dict(feedback_row)

        # Get all replies (including private)
        replies_rows = db.execute('''
            SELECT fr.*, u.username as admin_username
            FROM feedback_replies fr
            LEFT JOIN users u ON fr.admin_id = u.id
            WHERE fr.feedback_id = ?
            ORDER BY fr.created_at ASC
        ''', (feedback_id,))

        feedback['replies'] = [dict(row) for row in replies_rows]
        feedback['reply_count'] = len(feedback['replies'])
        feedback['public_reply_count'] = sum(1 for r in feedback['replies'] if not r['is_private'])
        feedback['private_note_count'] = sum(1 for r in feedback['replies'] if r['is_private'])

        return jsonify(feedback), 200

    except Exception as e:
        print(f"Error fetching feedback thread: {e}")
        return jsonify({'error': 'Failed to fetch feedback thread'}), 500
