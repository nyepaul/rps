"""Client-side event tracking routes for granular user activity logging."""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from src.services.enhanced_audit_logger import enhanced_audit_logger
from src.extensions import limiter
from datetime import datetime

events_bp = Blueprint('events', __name__, url_prefix='/api/events')


@events_bp.route('/click', methods=['POST'])
@login_required
@limiter.limit("60 per minute")
def log_click():
    """
    Log a user click event from the frontend.

    Request body:
        element_type: Type of element clicked (button, link, tab, etc.)
        element_id: ID of the element (if available)
        element_text: Text content of the element (truncated)
        element_class: CSS classes of the element
        page: Current page/tab name
        target_url: URL if it's a link (optional)
        timestamp: Client-side timestamp
        x: Click X coordinate
        y: Click Y coordinate
    """
    try:
        data = request.json or {}

        # Extract and sanitize click data
        element_type = str(data.get('element_type', 'unknown'))[:50]
        element_id = str(data.get('element_id', ''))[:100]
        element_text = str(data.get('element_text', ''))[:100]  # Truncate text
        element_class = str(data.get('element_class', ''))[:200]
        page = str(data.get('page', ''))[:100]
        target_url = str(data.get('target_url', ''))[:500]
        client_timestamp = data.get('timestamp')
        x = data.get('x')
        y = data.get('y')

        enhanced_audit_logger.log(
            action='UI_CLICK',
            details={
                'element_type': element_type,
                'element_id': element_id,
                'element_text': element_text,
                'element_class': element_class,
                'page': page,
                'target_url': target_url if target_url else None,
                'client_timestamp': client_timestamp,
                'coordinates': {'x': x, 'y': y} if x is not None and y is not None else None
            },
            status_code=200
        )

        return jsonify({'status': 'logged'}), 200

    except Exception as e:
        # Don't fail the request if logging fails
        print(f"Click logging error: {e}")
        return jsonify({'status': 'error'}), 200


@events_bp.route('/batch', methods=['POST'])
@login_required
@limiter.limit("30 per minute")
def log_batch():
    """
    Log a batch of user events from the frontend.
    More efficient than individual requests for high-frequency events.

    Request body:
        events: Array of event objects, each containing:
            type: Event type (click, scroll, focus, etc.)
            data: Event-specific data
            timestamp: Client-side timestamp
    """
    try:
        data = request.json or {}
        events = data.get('events', [])

        if not isinstance(events, list):
            return jsonify({'error': 'events must be an array'}), 400

        # Limit batch size to prevent abuse
        events = events[:50]

        logged_count = 0
        for event in events:
            if not isinstance(event, dict):
                continue

            event_type = str(event.get('type', 'unknown'))[:50]
            event_data = event.get('data', {})
            client_timestamp = event.get('timestamp')

            # Map event type to action
            action_map = {
                'click': 'UI_CLICK',
                'rightclick': 'UI_RIGHT_CLICK',
                'dblclick': 'UI_DOUBLE_CLICK',
                'hover': 'UI_HOVER',
                'mousemove': 'UI_MOUSE_MOVE',
                'navigation': 'UI_NAVIGATION',
                'tab_switch': 'UI_TAB_SWITCH',
                'modal_open': 'UI_MODAL_OPEN',
                'modal_close': 'UI_MODAL_CLOSE',
                'form_submit': 'UI_FORM_SUBMIT',
                'search': 'UI_SEARCH',
                'filter': 'UI_FILTER',
                'sort': 'UI_SORT',
                'expand': 'UI_EXPAND',
                'collapse': 'UI_COLLAPSE',
                'scroll': 'UI_SCROLL',
                'focus': 'UI_FOCUS',
                'blur': 'UI_BLUR',
                'select': 'UI_SELECT',
                'copy': 'UI_COPY',
                'download': 'UI_DOWNLOAD',
                'print': 'UI_PRINT',
            }

            action = action_map.get(event_type, f'UI_{event_type.upper()}')

            # Sanitize event data
            sanitized_data = {}
            for key, value in event_data.items():
                if isinstance(value, str):
                    sanitized_data[key] = value[:200]
                elif isinstance(value, (int, float, bool, type(None))):
                    sanitized_data[key] = value
                elif isinstance(value, dict):
                    sanitized_data[key] = {k: str(v)[:100] for k, v in list(value.items())[:10]}

            sanitized_data['client_timestamp'] = client_timestamp

            enhanced_audit_logger.log(
                action=action,
                details=sanitized_data,
                status_code=200
            )
            logged_count += 1

        return jsonify({
            'status': 'logged',
            'count': logged_count
        }), 200

    except Exception as e:
        print(f"Batch logging error: {e}")
        return jsonify({'status': 'error'}), 200


@events_bp.route('/page-view', methods=['POST'])
@login_required
@limiter.limit("30 per minute")
def log_page_view():
    """
    Log a page/tab view event.

    Request body:
        page: Page or tab name
        profile_name: Current profile (if applicable)
        referrer: Previous page/tab
        timestamp: Client-side timestamp
    """
    try:
        data = request.json or {}

        page = str(data.get('page', ''))[:100]
        profile_name = str(data.get('profile_name', ''))[:100]
        referrer = str(data.get('referrer', ''))[:100]
        client_timestamp = data.get('timestamp')

        enhanced_audit_logger.log(
            action='UI_PAGE_VIEW',
            details={
                'page': page,
                'profile_name': profile_name if profile_name else None,
                'referrer': referrer if referrer else None,
                'client_timestamp': client_timestamp
            },
            status_code=200
        )

        return jsonify({'status': 'logged'}), 200

    except Exception as e:
        print(f"Page view logging error: {e}")
        return jsonify({'status': 'error'}), 200


@events_bp.route('/session', methods=['POST'])
@login_required
@limiter.limit("10 per minute")
def log_session_event():
    """
    Log session-level events (session start, end, idle, resume).

    Request body:
        event: Event type (start, end, idle, resume, visibility_hidden, visibility_visible)
        duration: Session duration in seconds (for end event)
        idle_time: Time spent idle (for idle event)
        timestamp: Client-side timestamp
    """
    try:
        data = request.json or {}

        event = str(data.get('event', ''))[:50]
        duration = data.get('duration')
        idle_time = data.get('idle_time')
        client_timestamp = data.get('timestamp')

        valid_events = ['start', 'end', 'idle', 'resume', 'visibility_hidden', 'visibility_visible']
        if event not in valid_events:
            event = 'unknown'

        enhanced_audit_logger.log(
            action=f'SESSION_{event.upper()}',
            details={
                'duration_seconds': duration,
                'idle_seconds': idle_time,
                'client_timestamp': client_timestamp
            },
            status_code=200
        )

        return jsonify({'status': 'logged'}), 200

    except Exception as e:
        print(f"Session logging error: {e}")
        return jsonify({'status': 'error'}), 200


@events_bp.route('/error', methods=['POST'])
@login_required
@limiter.limit("20 per minute")
def log_client_error():
    """
    Log client-side JavaScript errors.

    Request body:
        message: Error message
        source: Source file
        line: Line number
        column: Column number
        stack: Stack trace (truncated)
        page: Current page
        timestamp: Client-side timestamp
    """
    try:
        data = request.json or {}

        message = str(data.get('message', ''))[:500]
        source = str(data.get('source', ''))[:200]
        line = data.get('line')
        column = data.get('column')
        stack = str(data.get('stack', ''))[:2000]
        page = str(data.get('page', ''))[:100]
        client_timestamp = data.get('timestamp')

        enhanced_audit_logger.log(
            action='CLIENT_ERROR',
            details={
                'message': message,
                'source': source,
                'line': line,
                'column': column,
                'stack': stack,
                'page': page,
                'client_timestamp': client_timestamp
            },
            status_code=200
        )

        return jsonify({'status': 'logged'}), 200

    except Exception as e:
        print(f"Error logging error: {e}")
        return jsonify({'status': 'error'}), 200
