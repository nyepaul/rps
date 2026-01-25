# Gemini AI Integration Guide

This document covers the Google Gemini integration for the RPS retirement planning system.

## Overview

RPS supports Google Gemini as an AI provider for strategic retirement advice. The system uses Gemini's API for:
- Profile analysis and recommendations
- Self-assessment against best practices
- Interactive advisor chat

## Setup

### API Key Configuration
```bash
./bin/setup-api-keys
```

Or manually:
```bash
export GEMINI_API_KEY="your-key-here"
```

Add to `~/.zshrc` or `~/.bashrc` for persistence.

## Model Configuration

The system uses automatic model fallback:

| Priority | Model | Use Case |
|----------|-------|----------|
| 1 | `gemini-2.0-flash` | Primary - fast responses |
| 2 | `gemini-1.5-flash` | Fallback |

## API Integration

### Endpoint
```
POST /api/advisor/chat
POST /api/perform-self-assessment
```

### Request Format
```json
{
  "message": "Should I delay Social Security?",
  "profile_name": "main"
}
```

### Response Format
```json
{
  "response": "Based on your profile...",
  "action_data": {
    "social_security_age_p1": 70
  }
}
```

## Features

### Self-Assessment
Analyzes the user's profile against 11 skill files in `skills/`:
- retirement-planning-SKILL.md
- tax-strategy-SKILL.md
- estate-legal-SKILL.md
- And more...

### Quick Apply
When Gemini returns `action_data`, the frontend shows a "Quick Apply" button to update profile parameters.

### Context Injection
Each AI request includes:
- Current profile data
- Latest analysis results (success rate, projections)
- Relevant skill documents
- Active action items

## Usage

1. **Start the server**: `./bin/start`
2. **Open**: http://127.0.0.1:5137
3. **Load profile**: Profile & Data tab
4. **Get advice**: Analysis tab → "AI Recommendations"

## Troubleshooting

### "API key not configured"
Run `./bin/setup-api-keys` and restart the server.

### "Model not available"
The system will automatically try fallback models.

### Rate limiting
Gemini has rate limits. Wait and retry, or use Claude as an alternative.

## Security

- API keys stored as environment variables (not in database)
- Keys never logged or transmitted to frontend
- All AI requests go through the Flask backend

## Version

**RPS Version**: 3.9.x
**Last Updated**: January 2026
