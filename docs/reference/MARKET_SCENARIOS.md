# Market Scenario Profiles

This document describes all available market assumption profiles and preset market period scenarios used for Monte Carlo retirement simulations.

## Overview

Market profiles define the mathematical assumptions (mean return and volatility) for different asset classes. These assumptions are used by the Monte Carlo engine to generate thousands of possible future trajectories for your portfolio.

---

## 📊 Market Assumption Profiles

These profiles define the long-term expected behavior of stocks, bonds, cash, and other assets.

### Base Scenarios

**Historical Average** (Default)
- Based on long-term historical market data (60/40 mix).
- **Stocks**: 10% mean, 18% volatility
- **Bonds**: 4% mean, 6% volatility
- **Inflation**: 3% mean, 1% volatility

**Modern Diversified**
- Multi-asset class portfolio including REITs and Gold.
- **Assumptions**: Reduced stock returns (9%) but with explicit 10% REIT and 10% Gold allocations.

**Conservative**
- Lower risk, more stable returns.
- **Stocks**: 7% mean, 14% volatility
- **Bonds**: 4% mean, 5% volatility
- **Inflation**: 2.5% mean, 1% volatility

**Balanced**
- Moderate risk and returns, well-diversified.
- **Stocks**: 9% mean, 16% volatility
- **Bonds**: 4% mean, 6% volatility

**Aggressive Growth**
- Higher risk, higher expected returns.
- **Stocks**: 12% mean, 20% volatility
- **Bonds**: 4% mean, 6% volatility

---

### 📉 Stress Tests (Bear/Crisis)

**Bear Market**
- Negative returns (-20% to -40% decline).
- **Stocks**: -5% mean, 25% volatility.

**Recession**
- Economic contraction with low returns.
- **Stocks**: 2% mean, 22% volatility.

**Stagflation**
- High inflation (6%) with low growth (4%).
- Includes 10% Gold allocation as a hedge.

**2008 Financial Crisis**
- Models actual 2008 conditions.
- **Stocks**: -22% mean, 35% volatility.
- Near-zero inflation (0.1%).

---

### 📈 Optimistic Scenarios (Bull)

**Bull Market**
- Sustained upward trend with strong gains.
- **Stocks**: 18% mean, 14% volatility.

**Post-COVID Recovery**
- Models 2020-2021 conditions.
- **Stocks**: 16% mean, 20% volatility.
- Elevated inflation (4.5%).

**Roaring 20s Boom**
- Strong sustained economic boom.
- **Stocks**: 14% mean, 16% volatility.

---

### 🌍 Alternative & Sector Focus

**Digital Assets (Aggressive)**
- Growth portfolio with **5% Crypto allocation**.
- **Crypto**: 35% mean, 70% volatility (high risk/reward).

**Emerging Markets**
- High growth potential with high volatility.
- **Stocks**: 13% mean, 26% volatility.

**Dividend Aristocrats**
- Income stability with blue chip dividends.
- **Stocks**: 9% mean, 14% volatility (lower risk).

**Technology Sector**
- Aggressive tech/AI sector focus.
- **Stocks**: 15% mean, 24% volatility.

---

## ⏱️ Preset Market Period Scenarios

Beyond simple averages, RPS supports **Timeline** and **Cycle** scenarios to model **Sequence of Returns Risk**.

### 1. Early Retirement Crash (Timeline)
- **Years 1-3**: Great Recession (-30% stocks)
- **Years 4-8**: Post-COVID Recovery (+16% stocks)
- **Years 9+**: Historical Averages
- *Use case: Testing if your plan survives a major crash immediately after you stop working.*

### 2. Realistic Market Cycles (Cycle)
- **7 Years**: Bull Market
- **2 Years**: Recession
- **3 Years**: Post-COVID Recovery
- *Pattern repeats indefinitely.*

### 3. Lost Decade (Timeline)
- **Years 1-5**: Dot-com Bust (-15% stocks)
- **Years 6-10**: Great Recession (-30% stocks)
- **Years 11+**: Normalization
- *Use case: Testing resilience against prolonged flat/down markets.*

### 4. Lucky Start (Timeline)
- **Years 1-10**: Sustained Bull Market (+18% stocks)
- **Years 11+**: Historical Averages
- *Use case: Seeing how a strong start secures a legacy.*

---

## Technical Implementation

- **Vectorized Math**: Returns are generated using log-normal distributions for accuracy.
- **Monthly Compounding**: All simulations calculate growth on a monthly basis.
- **Tax Drag**: Returns are adjusted for tax implications in taxable accounts.
- **Rebalancing**: Portfolios are rebalanced annually to maintain the target stock/bond/cash mix.

**Last Updated:** 2026-02-27
**Version:** 3.10.4
