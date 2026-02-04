from flask import request, jsonify, abort

def validate_json_content(req):
    if not req.is_json:
        abort(400, description="Content-Type must be application/json")
    try:
        data = req.get_json()
    except Exception:
        abort(400, description="Request body is not valid JSON")
    return data

def validate_numeric_field(value, field_name, min_val=None, max_val=None):
    try:
        num_value = float(value)
        if min_val is not None and num_value < min_val:
            return False, f"{field_name} must be at least {min_val}"
        if max_val is not None and num_value > max_val:
            return False, f"{field_name} must be at most {max_val}"
        return True, num_value
    except (ValueError, TypeError):
        return False, f"{field_name} must be a number"

def validate_dict_field(value, field_name):
    if not isinstance(value, dict):
        return False, f"{field_name} must be a dictionary"
    return True, value

def validate_positive_number(value, field_name, allow_zero=False):
    is_valid, num_value = validate_numeric_field(value, field_name)
    if not is_valid:
        return False, num_value # num_value here contains the error message
    
    if not allow_zero and num_value <= 0:
        return False, f"{field_name} must be a positive number"
    elif allow_zero and num_value < 0:
        return False, f"{field_name} cannot be negative"
        
    return True, num_value
