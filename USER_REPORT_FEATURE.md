# User Report Feature

## Overview
A new **User Activity Report** feature has been added to the Admin tab, providing comprehensive activity insights for any user in the system.

## Location
**Admin Tab → Users Sub-tab**

Each user row now includes a blue **📊 (chart)** button in the Actions column to view their activity report.

## What's Included in the Report

### User Information
- Username, Email, User ID
- Account status (Active/Inactive, Admin/User/Super Admin)
- Account created date
- Last login date

### Activity Summary
- **Total Actions**: Total number of audit log entries
- **Days Active**: Days since first activity
- **Days Since Last Activity**: Days since most recent action

### Content Overview
- **Profiles**: Number of retirement profiles created
- **Scenarios**: Number of Monte Carlo scenarios run
- **Conversations**: Number of AI advisor conversations
- **Messages**: Total conversation messages sent
- **Action Items**: Number of action items created
- **Feedback Submissions**: Number of feedback items submitted
- **Action Items by Status**: Breakdown by status (pending/completed/etc.)

### Recent Activity
- Last 20 actions with timestamps, action types, endpoints, and HTTP status codes
- Scrollable table view

### Top Actions
- Top 10 most frequently performed actions with counts

### Profiles List
- Complete list of user's profiles with IDs and creation dates

### Recent Scenarios
- Last 10 scenarios created with names, IDs, and dates

## Technical Implementation

### Backend
**File**: `src/routes/admin.py`
**Endpoint**: `GET /api/admin/users/<user_id>/report`
**Permission**: Admin required
**Action Logged**: `VIEW_USER_REPORT`

The endpoint queries multiple tables:
- `users` - User account info
- `profile` - User profiles
- `scenarios` - Monte Carlo scenarios
- `conversations` - AI advisor messages
- `action_items` - User action items
- `enhanced_audit_log` - Activity tracking
- `feedback` - User feedback

### Frontend
**File**: `src/static/js/components/admin/user-report.js`
**Component**: Modal dialog displaying comprehensive report

**Modified**: `src/static/js/components/admin/user-management.js`
- Added report button to user table
- Added event handler to trigger report modal

## Usage

1. Navigate to **Admin Tab** (requires admin privileges)
2. Click on **👥 Users** sub-tab
3. Find the user you want to analyze
4. Click the **📊** button in the Actions column
5. View the comprehensive activity report in the modal
6. Click the **×** or click outside the modal to close

## Use Cases

1. **User Onboarding Analysis**: See if new users are successfully using features
2. **Activity Monitoring**: Identify active vs. inactive users
3. **Support Troubleshooting**: Understand user's system usage when helping with issues
4. **Usage Analytics**: Track which features users engage with most
5. **Compliance Auditing**: Review user activity history for audit purposes

## Example
To view activity for user `bmillis` (User ID 5):
- The report would show minimal activity (only registration)
- No profiles, scenarios, or other content created
- Useful for identifying dormant accounts

## Security
- Requires admin authentication
- All report views are logged in the audit log
- No sensitive encrypted data is exposed (profile data remains encrypted)
