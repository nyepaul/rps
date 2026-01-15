# Market Scenario Profiles

This document describes all available market assumption profiles that can be used for Monte Carlo retirement simulations.

## How to Use

1. Open **Settings** (gear icon in top right)
2. Under "Monte Carlo Analysis", select a **Market Assumptions Profile**
3. The profile will be applied to all three portfolio allocations (Conservative 30%, Moderate 60%, Aggressive 80% stocks)
4. Run analysis from the Analysis tab to see results

## Available Profiles

### 📊 Base Scenarios

**Historical Average** (Default)
- Based on long-term historical market data
- Stock Return: 10% mean, 18% volatility
- Bond Return: 4% mean, 6% volatility
- Inflation: 3% mean, 1% volatility

**Conservative**
- Lower risk, more stable returns
- Stock Return: 8% mean, 15% volatility
- Bond Return: 4% mean, 5% volatility
- Inflation: 2.5% mean, 1% volatility

**Balanced**
- Moderate risk and returns, well-diversified
- Stock Return: 10% mean, 16% volatility
- Bond Return: 4% mean, 6% volatility
- Inflation: 3% mean, 1% volatility

**Aggressive Growth**
- Higher risk, higher expected returns
- Stock Return: 13% mean, 20% volatility
- Bond Return: 4% mean, 6% volatility
- Inflation: 3% mean, 1% volatility

### 📉 Bear/Crisis Scenarios

**Bear Market**
- Negative returns (-20% to -40% decline)
- Stock Return: -5% mean, 25% volatility
- Useful for stress testing

**Recession**
- Economic contraction with low returns
- Stock Return: 2% mean, 22% volatility
- Bond Return: 4% mean (flight to safety)

**Stagflation**
- High inflation with low growth (1970s-style)
- Stock Return: 4% mean, 20% volatility
- Inflation: 5% mean (high)

**2008 Financial Crisis**
- Models actual 2008 conditions
- Stock Return: -22% mean, 35% volatility
- S&P 500 lost 37% in 2008
- Near-deflationary conditions

### 📈 Bull/Optimistic Scenarios

**Bull Market**
- Sustained upward trend with strong gains
- Stock Return: 18% mean, 14% volatility
- Lower volatility in uptrend

**Post-COVID Recovery**
- Models 2020-2021 recovery conditions
- Stock Return: 16% mean, 20% volatility
- Elevated inflation: 4.5% mean

**Roaring 20s Boom**
- Strong sustained economic boom
- Stock Return: 14% mean, 16% volatility
- Balanced growth scenario

### 🎯 Historical Periods

**Dot-com Boom (1997-1999)**
- Late 90s tech bubble gains
- Stock Return: 25% mean, 30% volatility
- Extreme optimism and high volatility

**Dot-com Bust (2000-2002)**
- Tech bubble crash period
- Stock Return: -15% mean, 32% volatility
- Flight to quality in bonds

**Great Recession (2008-2009)**
- Financial crisis with unprecedented volatility
- Stock Return: -30% mean, 38% volatility
- Most severe modern crisis scenario
- Slight deflation: -0.4% inflation

**2010s Bull Run**
- 2010-2019 sustained bull market
- Stock Return: 14% mean, 15% volatility
- Low inflation decade: 1.8% mean

### 🌍 Global & Alternative

**Emerging Markets**
- High growth potential with high volatility
- Stock Return: 13% mean, 26% volatility
- Higher inflation: 4% mean

**International Diversified**
- Global diversification outside US
- Stock Return: 9.5% mean, 19% volatility
- Slightly lower than US returns

**Inflation Hedge**
- Gold/commodities for inflation protection
- Stock Return: 8% mean, 16% volatility (reduced by hedge)
- Lower but more stable returns

**REIT Focus**
- Real estate investment trust exposure
- Stock Return: 10% mean, 20% volatility
- REITs historical average

### 💰 Income & Stability

**Dividend Aristocrats**
- Income stability with blue chip dividends
- Stock Return: 9% mean, 14% volatility (very low)
- Focus on dividend-paying stable companies

**Bond Heavy (30/70)**
- Capital preservation focus
- Only 30% stock allocation in conservative scenario
- Lower volatility overall

### 🏭 Sector-Specific

**Technology Sector**
- Aggressive tech/AI sector focus
- Stock Return: 15% mean, 24% volatility
- Higher growth, higher risk

**Healthcare Sector**
- Defensive healthcare sector focus
- Stock Return: 11.5% mean, 16% volatility
- Moderate-stable growth

**Financial Sector**
- Cyclical financial sector exposure
- Stock Return: 10.5% mean, 23% volatility
- Rate-sensitive, higher volatility

**Energy Sector**
- Volatile energy and commodity exposure
- Stock Return: 9% mean, 25% volatility
- Commodity correlation, inflation sensitive

## Technical Notes

- All scenarios apply across three portfolio allocations:
  - **Conservative**: 30% stocks / 70% bonds
  - **Moderate**: 60% stocks / 40% bonds
  - **Aggressive**: 80% stocks / 20% bonds

- Returns are blended based on allocation:
  - Portfolio Return = (Stock % × Stock Return) + (Bond % × Bond Return)

- Volatility increases risk of sequence-of-returns problems in early retirement

- Historical scenarios are educational and don't predict future performance

## Recommendations

- Start with **Historical Average** for baseline planning
- Use **2008 Financial Crisis** or **Great Recession** to stress test
- Compare **Conservative** vs **Aggressive** to understand risk/reward tradeoff
- Try **Dot-com Bust** or **Bear Market** to see impact of early retirement downturn
- Use **Post-COVID** if you believe inflation will remain elevated
