# LLM Functionality Guide

## Overview

The Retirement & Wealth Planning System (RPS) is designed to function both **with** and **without** LLM (Large Language Model) API access. This document explains the differences in functionality and how the application adapts to the availability of LLM services.

---

## Table of Contents

1. [Core Functionality (No LLM Required)](#core-functionality-no-llm-required)
2. [LLM-Enhanced Functionality](#llm-enhanced-functionality)
3. [LLM Configuration](#llm-configuration)
4. [Graceful Degradation](#graceful-degradation)
5. [Feature Comparison Matrix](#feature-comparison-matrix)
6. [Performance Considerations](#performance-considerations)
7. [Cost Considerations](#cost-considerations)

---

## Core Functionality (No LLM Required)

The application provides comprehensive retirement planning capabilities **without** requiring any LLM API keys. All core financial calculations and planning features work independently.

### ✅ Fully Functional Without LLM

#### 1. **Profile & Data Management**
- Create unlimited retirement planning profiles
- Manage personal information (age, retirement date, spouse, children)
- Support for multiple profiles per user
- Profile comparison and scenario modeling

#### 2. **Asset Management**
- **Retirement Accounts:** 401(k), 403(b), IRAs (Traditional, Roth, SEP, SIMPLE)
- **Taxable Accounts:** Brokerage, Savings, Checking, CDs, Money Market
- **Real Estate:** Primary residence, rental properties, vacation homes, commercial, land
- **Income Streams:** Pensions, annuities
- **Other Assets:** Business interests, HSAs, trusts, collectibles, cryptocurrency

**Features:**
- Add, edit, delete assets
- Asset allocation tracking (stocks/bonds/cash percentages)
- Real estate mortgage balance tracking
- Equity calculations
- Asset descriptions with contextual information
- CSV import/export
- AI-powered image upload (asset extraction from screenshots)

#### 3. **Income & Budget Planning**
- **Income Tracking:**
  - Salary (primary + spouse)
  - Rental income
  - Business income
  - Social Security benefits (primary + spouse)
  - Pension benefits
  - Investment income
  - Custom income streams with start/end dates

- **Expense Tracking:**
  - Housing costs
  - Healthcare expenses
  - Daily living expenses
  - Travel & entertainment
  - Custom expense categories
  - Future expense planning

#### 4. **Retirement Scenarios**
- Create multiple scenarios per profile
- Customize assumptions:
  - Retirement age
  - Life expectancy
  - Stock/bond return rates
  - Inflation rates
  - Social Security claiming age
  - Tax assumptions
  - Healthcare cost projections
  - Market volatility

#### 5. **Monte Carlo Simulation**
- **Runs entirely locally** - no LLM required
- Statistical retirement planning analysis
- Probability of success calculations
- Portfolio sustainability modeling
- 1,000 - 10,000 simulation runs (configurable)
- **Market Profile Options:**
  - Historical averages
  - Conservative scenarios
  - Balanced approaches
  - Aggressive growth
  - Bear market scenarios
  - Bull market scenarios
  - Historical period simulations (Dot-com, Great Recession, etc.)
  - Sector-specific projections

#### 6. **Withdrawal Strategy**
- Account withdrawal sequencing
- Tax-efficient withdrawal planning
- Required Minimum Distribution (RMD) calculations
- Roth conversion analysis
- Tax bracket management

#### 7. **Analysis & Visualizations**
- Net worth projections over time
- Portfolio balance projections
- Spending analysis
- Success probability charts
- Scenario comparisons
- Detailed breakdowns by account type

#### 8. **Reports & Exports**
- Generate PDF reports
- Export data to CSV
- Scenario comparison reports
- Portfolio summaries
- All generated locally

#### 9. **Action Items**
- Manual action item creation
- Task tracking
- Priority management
- Due date tracking
- Completion status

#### 10. **Security & Administration** (Admin Users)
- User management
- Audit log viewing
- System configuration
- Logging configuration
- Security monitoring

---

## LLM-Enhanced Functionality

When LLM API keys (Claude or Gemini) are configured, the application gains powerful AI-assisted features.

### 🤖 Enhanced with LLM APIs

#### 1. **AI Financial Advisor**

**Without LLM:** Not available - tab shows message to configure API keys

**With LLM:** Full conversational AI advisor capabilities

- **Natural language conversations** about your retirement plan
- **Personalized financial advice** based on your specific profile data
- **Complex question answering:**
  - "Should I retire at 60 or 65?"
  - "How much can I safely spend in retirement?"
  - "What's my optimal Social Security claiming strategy?"
  - "Should I do Roth conversions?"
  - "How should I adjust my asset allocation?"

- **Context-aware responses:**
  - AI has access to your complete profile data
  - Understands your assets, income, expenses
  - Considers your retirement timeline
  - Factors in your risk tolerance

- **Scenario exploration:**
  - "What if I sell my rental property?"
  - "How does early retirement affect my plan?"
  - "What happens if the market crashes?"

- **Conversation history:**
  - Multi-turn conversations
  - Follow-up questions understood
  - Previous context remembered within session

**Example Conversations:**

```
User: "Should I retire at 60 or wait until 65?"

AI (with your data): "Based on your current assets of $1.2M and
annual expenses of $75,000, retiring at 60 would reduce your
success probability from 94% to 78%. Here's why:

1. Social Security: Claiming at 60 means reduced benefits (about
   30% less than FRA)
2. Portfolio sustainability: 5 extra years of withdrawals with
   fewer years of growth
3. Healthcare: You'd need 5 years of coverage before Medicare

I'd recommend working 2 more years to 62, which improves your
success rate to 89% while still allowing earlier retirement..."
```

#### 2. **Automated Action Items**

**Without LLM:** Manual action item creation only

**With LLM:** AI-generated personalized action items

- **Automatic generation** based on your profile analysis
- **Prioritized recommendations** (high/medium/low)
- **Specific, actionable tasks:**
  - "Review 401(k) allocation - currently 90% stocks at age 55"
  - "Schedule Roth conversion consultation for 2024 tax planning"
  - "Increase emergency fund to 6 months expenses ($45,000)"
  - "Research Medicare supplement plans (3 years until eligibility)"

- **Due date suggestions** based on urgency
- **Rationale provided** for each recommendation
- **Update automatically** as your profile changes

#### 3. **AI-Powered Asset Extraction**

**Without LLM:** Manual asset entry only

**With LLM:** Upload screenshots/images for automatic data extraction

- **Image upload** of:
  - Brokerage statements
  - Bank account summaries
  - Property valuations
  - Investment account screenshots

- **Automatic extraction** of:
  - Account names
  - Account values
  - Asset types
  - Allocation information

- **Smart parsing:**
  - Recognizes different statement formats
  - Handles various financial institutions
  - Extracts relevant data accurately

- **Review before import:**
  - AI shows extracted data
  - You can edit before saving
  - Merge with existing assets

#### 4. **Natural Language Troubleshooting**

**Without LLM:** Error messages only

**With LLM:** Conversational error resolution

- Ask questions about errors or warnings
- Get explanations of simulation results
- Understand why certain recommendations are made
- Clarification of financial concepts

---

## LLM Configuration

### How to Configure LLM APIs

1. **Navigate to Settings** (top-right ⚙️ icon)
2. **Click "🔐 API Keys" tab**
3. **Enter your API key(s):**
   - **Claude:** Get from [console.anthropic.com](https://console.anthropic.com/)
   - **Gemini:** Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

4. **Test connection** (optional but recommended)
5. **Save**

### Security

- **Encrypted storage:** All API keys encrypted with AES-256-GCM
- **Profile-specific:** Different profiles can use different API keys
- **User-specific:** Your keys never accessible to other users
- **No logging:** Keys never appear in logs or error messages

### Which LLM to Use?

**Claude (Anthropic):**
- Excellent reasoning capabilities
- Strong financial analysis
- Good at nuanced advice
- Longer context window
- Generally more expensive

**Gemini (Google):**
- Fast response times
- Good general knowledge
- More economical
- Good for routine questions
- Free tier available

**Recommendation:** Configure both and test which works better for your needs. You can switch between them or use one as fallback.

---

## Graceful Degradation

The application handles missing LLM APIs gracefully:

### UI Behavior

**AI Advisor Tab (without LLM):**
```
┌─────────────────────────────────────┐
│   🤖 AI Financial Advisor           │
│                                     │
│   ⚠️ No API Key Configured          │
│                                     │
│   To use the AI Advisor, configure │
│   an API key in Settings.          │
│                                     │
│   [ Configure Now ]                 │
└─────────────────────────────────────┘
```

**AI Advisor Tab (with LLM):**
```
┌─────────────────────────────────────┐
│   🤖 AI Financial Advisor           │
│                                     │
│   💬 Chat with your AI advisor      │
│                                     │
│   User: Should I retire at 60?      │
│                                     │
│   AI: Based on your $1.2M in...    │
│                                     │
│   [ Type your question... ] [Send] │
└─────────────────────────────────────┘
```

**Action Items (without LLM):**
- Manual "Add Action Item" button works normally
- No "Generate AI Recommendations" button shown

**Action Items (with LLM):**
- Manual "Add Action Item" button available
- "Generate AI Recommendations" button adds AI-generated tasks

**Asset Upload (without LLM):**
- Manual entry works normally
- CSV import works normally
- Image upload shows "LLM required for AI extraction"

**Asset Upload (with LLM):**
- All manual entry methods work
- CSV import works
- Image upload enables AI extraction

### Fallback Behavior

1. **API Key Missing:** User sees configuration prompt
2. **API Call Fails:** Error message + fallback to manual entry
3. **Rate Limit Hit:** Temporary message + retry suggestion
4. **API Key Invalid:** Prompt to reconfigure
5. **Network Error:** Offline message + cached responses (if available)

---

## Feature Comparison Matrix

| Feature | Without LLM | With LLM API |
|---------|-------------|--------------|
| **Profile Management** | ✅ Full | ✅ Full |
| **Asset Management** | ✅ Full | ✅ Full |
| **Income & Budget** | ✅ Full | ✅ Full |
| **Retirement Scenarios** | ✅ Full | ✅ Full |
| **Monte Carlo Simulation** | ✅ Full (Local) | ✅ Full (Local) |
| **Withdrawal Strategy** | ✅ Full | ✅ Full |
| **Analysis & Charts** | ✅ Full | ✅ Full |
| **PDF Reports** | ✅ Full | ✅ Full |
| **CSV Import/Export** | ✅ Full | ✅ Full |
| **AI Financial Advisor** | ❌ Not Available | ✅ Full Conversational AI |
| **AI Action Items** | ⚠️ Manual Only | ✅ Auto-Generated + Manual |
| **AI Asset Extraction** | ⚠️ Manual/CSV Only | ✅ Image Upload + Manual |
| **Natural Language Help** | ❌ Not Available | ✅ Contextual Assistance |
| **Scenario Suggestions** | ❌ Not Available | ✅ AI Recommendations |
| **Complex Q&A** | ❌ Not Available | ✅ Deep Analysis |
| **Admin Features** | ✅ Full | ✅ Full |
| **Security** | ✅ Full | ✅ Full |

---

## Performance Considerations

### Without LLM

**Advantages:**
- ✅ **Zero latency** for AI features (they're off)
- ✅ **Zero cost** - no API usage fees
- ✅ **Complete offline capability** (after initial load)
- ✅ **Predictable performance** - no API rate limits
- ✅ **No external dependencies**

**Disadvantages:**
- ❌ No conversational advisor
- ❌ Manual action item creation
- ❌ Manual asset data entry only
- ❌ No AI-powered insights

### With LLM

**Advantages:**
- ✅ **Intelligent advice** and recommendations
- ✅ **Time-saving** automation (action items, asset extraction)
- ✅ **Complex analysis** beyond rules-based systems
- ✅ **Natural language** interaction

**Disadvantages:**
- ⚠️ **API latency** (1-5 seconds per request)
- ⚠️ **Cost** (varies by usage)
- ⚠️ **Rate limits** (depends on API tier)
- ⚠️ **Requires internet** for LLM features

### Optimization

The application is optimized to minimize LLM API calls:

1. **Caching:** Responses cached where appropriate
2. **Lazy Loading:** AI features only initialize when accessed
3. **Local First:** Core calculations always local
4. **Streaming:** Real-time response streaming for better UX
5. **Fallbacks:** Graceful degradation when APIs unavailable

---

## Cost Considerations

### Claude (Anthropic)

**Pricing (as of 2025):**
- Haiku: $0.25 per 1M input tokens, $1.25 per 1M output tokens
- Sonnet: $3.00 per 1M input tokens, $15.00 per 1M output tokens
- Opus: $15.00 per 1M input tokens, $75.00 per 1M output tokens

**Typical Usage:**
- **AI Advisor conversation:** 500-2000 tokens per exchange
- **Action item generation:** 1000-3000 tokens
- **Asset extraction:** 500-1500 tokens per image

**Estimated Monthly Cost (Moderate Use):**
- 20 advisor conversations: $0.05 - $0.50
- 4 action item generations: $0.01 - $0.10
- 10 asset extractions: $0.02 - $0.15
- **Total:** $0.08 - $0.75/month

### Gemini (Google)

**Pricing (as of 2025):**
- Gemini Pro: Free tier available (60 requests/minute)
- Gemini Pro (paid): $0.50 per 1M tokens

**Typical Usage:**
- Similar token counts to Claude
- Free tier covers most individual users

**Estimated Monthly Cost (Moderate Use):**
- Free tier: $0.00 (up to limits)
- Paid tier: $0.03 - $0.30/month

### Cost Control

**Strategies to minimize costs:**

1. **Use Free Tier:** Gemini free tier covers most personal use
2. **Configure One Provider:** Don't need both
3. **Action Items:** Generate once per profile update
4. **Advisor:** Use for complex questions, not simple lookups
5. **Asset Extraction:** Use for bulk imports, not single assets
6. **Profile-Specific:** Each profile can use different keys (or none)

---

## Recommendations

### For Most Users

**Start Without LLM:**
1. Create your profile
2. Input your assets
3. Run scenarios
4. Review results

**Add LLM When Needed:**
- Complex planning questions arise
- Want AI-generated action items
- Need to import many assets from images
- Desire conversational advisor experience

### For Power Users

**Configure LLM from Start:**
- Time savings on action items worth the cost
- Complex scenarios benefit from AI analysis
- Large asset portfolios easier with image extraction
- Ongoing financial questions benefit from advisor

### For Maximum Privacy

**Use Without LLM:**
- All data stays local
- No external API calls
- Complete data sovereignty
- Core functionality unaffected

---

## Summary

### Core Philosophy

The Retirement & Wealth Planning System is designed to be:

1. **Functional First:** All essential planning features work without LLMs
2. **LLM Enhanced:** AI features add convenience and intelligence, not dependency
3. **User Choice:** You decide if/when to enable LLM features
4. **Graceful Degradation:** Missing LLM APIs don't break functionality
5. **Cost Effective:** Free core features, optional AI enhancements

### Key Takeaways

✅ **Without LLM:**
- Fully functional retirement planning tool
- All calculations, scenarios, and analysis work
- Complete asset, income, and budget management
- PDF reports and exports available
- Zero cost, zero latency, complete privacy

✅ **With LLM:**
- Adds conversational AI advisor
- Automated action item generation
- Image-based asset extraction
- Natural language assistance
- Moderate cost ($0-$1/month typical)

### Decision Guide

**Choose Without LLM if:**
- You prefer manual control over all data entry
- Privacy is paramount (no external API calls)
- You're comfortable with traditional financial planning tools
- You want zero ongoing costs

**Choose With LLM if:**
- You want conversational financial advice
- Time-saving automation is valuable
- You have complex questions requiring AI reasoning
- You're comfortable with minimal costs ($0-$1/month)

**You Can Always:**
- Start without LLM and add it later
- Remove LLM access and continue using the app
- Use different LLMs for different profiles
- Switch between providers at any time

---

**Last Updated:** 2025-01-15
**Version:** 2.0
