# Email Security Configuration & Audit (January 2026)

## Overview
This document details the security configuration for the Email Service implemented in v3.9.151 (Jan 26, 2026). The system uses a local Postfix relay with a robust fallback mechanism.

## 1. Architecture

### Mail Transport Agent (MTA)
- **Service:** Postfix (local)
- **Interface:** Loopback only (`127.0.0.1`)
- **Port:** 25
- **Relay Restrictions:** `permit_mynetworks` (Localhost only)
- **Authorization:** SPF/DMARC records configured on `pan2.app` to authorize the server IP (`46.110.80.107`).

### Application Integration
- **Primary Method:** SMTP via `Flask-Mail` to `127.0.0.1:25`.
- **Fallback Method:** Direct execution of `/usr/sbin/sendmail` binary.
    - **Rationale:** The local Postfix instance is configured with `smtpd_tls_wrappermode=yes` which interferes with standard unencrypted SMTP connections from Flask. The binary fallback bypasses the network stack and injects mail directly into the queue.

## 2. Security Controls

### Injection Prevention
- **Header Injection:** Email construction uses python's `email.mime` library which handles header encoding and sanitization.
- **Command Injection:** The fallback mechanism uses `subprocess.Popen` with a fixed argument list (`['/usr/sbin/sendmail', '-t']`). User input is passed strictly as standard input (stdin) content, never as shell arguments.

### Enumeration Protection
- **Generic Responses:** The Password Reset endpoint returns a uniform "If the account exists..." message regardless of whether the user or email was found.
- **Rate Limiting:** Limited to **3 requests per hour** to prevent timing attacks or massive spam generation.

### Open Relay Prevention
- Postfix is bound strictly to `inet_interfaces = 127.0.0.1`.
- `mynetworks` is restricted to loopback addresses.
- External access to port 25 is blocked by firewall (UFW/Cloud provider) and the bind address itself.

## 3. Configuration

```python
# src/config.py
MAIL_SERVER = '127.0.0.1'  # Localhost only
MAIL_PORT = 25
MAIL_USE_TLS = False       # TLS handled by MTA if relaying, not needed for localhost
MAIL_DEFAULT_SENDER = 'rps@pan2.app'
```

## 4. Verification
- **SPF:** `v=spf1 ip4:46.110.80.107 ~all` (Cloudflare)
- **DMARC:** `v=DMARC1; p=none; ...` (Monitoring mode)
- **Functionality:** Verified via test scripts sending to external Gmail accounts.
