# Story 9.3: Domain & DNS Configuration (Namecheap)

Status: Ready for Dev
Solo Dev: Yes
Epic: 9 - Production Deployment & Infrastructure
Depends On: Story 9.2 (Cloud Run service must exist)

## Story

**As a** solo developer,
**I want** to configure contextor.co to point to Cloud Run,
**So that** users access the app via a branded domain with SSL.

## Acceptance Criteria

1. **Given** the contextor.co domain in Namecheap
   **When** I configure DNS records
   **Then** the following records are set:
   - `A` record for `@` -> Cloud Run IP (or CNAME to Cloud Run domain)
   - `CNAME` record for `www` -> Cloud Run domain
   - `CNAME` record for `api` -> Cloud Run domain (if separate service)

2. **Given** Cloud Run domain mapping
   **When** I map `contextor.co` to the Cloud Run service
   **Then** Cloud Run provisions an SSL certificate automatically
   **And** HTTPS is enforced for all traffic
   **And** HTTP redirects to HTTPS

3. **Given** DNS propagation
   **When** I verify the setup
   **Then** `https://contextor.co` loads the application
   **And** `https://www.contextor.co` redirects to `https://contextor.co`
   **And** SSL certificate shows valid

4. **Given** Namecheap API credentials
   **When** I configure API access
   **Then** I have: API User, API Key, Whitelisted IP
   **And** credentials are stored securely in GitHub Secrets

## Tasks / Subtasks

- [ ] **Task 1: Verify domain ownership in Namecheap** (AC: #1)
  - [ ] Log into Namecheap dashboard
  - [ ] Verify contextor.co is in your domain list
  - [ ] Check domain is not expired
  - [ ] Note current DNS settings (backup)

- [ ] **Task 2: Map custom domain in Cloud Run** (AC: #2)
  - [ ] In Google Cloud Console, go to Cloud Run
  - [ ] Select `contextor-web` service
  - [ ] Go to "Manage Custom Domains" or run:
    ```bash
    gcloud run domain-mappings create \
      --service contextor-web \
      --domain contextor.co \
      --region us-central1
    ```
  - [ ] Note the DNS records Cloud Run requires
  - [ ] Cloud Run will show required A/AAAA records or CNAME

- [ ] **Task 3: Configure DNS in Namecheap** (AC: #1)
  - [ ] Go to Domain List > contextor.co > Advanced DNS
  - [ ] Delete existing A/CNAME records for @ and www (if any)
  - [ ] Add records as specified by Cloud Run:

    **Option A: If Cloud Run provides IP addresses:**
    | Type | Host | Value | TTL |
    |------|------|-------|-----|
    | A | @ | <Cloud Run IP 1> | Automatic |
    | A | @ | <Cloud Run IP 2> | Automatic |
    | AAAA | @ | <Cloud Run IPv6 1> | Automatic |
    | AAAA | @ | <Cloud Run IPv6 2> | Automatic |
    | CNAME | www | contextor.co. | Automatic |

    **Option B: If using CNAME (subdomains only):**
    | Type | Host | Value | TTL |
    |------|------|-------|-----|
    | CNAME | www | ghs.googlehosted.com. | Automatic |

- [ ] **Task 4: Wait for DNS propagation** (AC: #3)
  - [ ] DNS changes can take 1-48 hours (usually 15-30 minutes)
  - [ ] Check propagation: https://dnschecker.org/#A/contextor.co
  - [ ] Verify with: `dig contextor.co`
  - [ ] Test: `curl -I https://contextor.co` (may fail until SSL ready)

- [ ] **Task 5: Verify SSL certificate provisioning** (AC: #2)
  - [ ] Cloud Run automatically provisions Let's Encrypt certificate
  - [ ] Check domain mapping status in Cloud Run console
  - [ ] Wait for status to show "Certificate provisioned"
  - [ ] This can take 15-30 minutes after DNS propagates

- [ ] **Task 6: Test domain access** (AC: #3)
  - [ ] Open https://contextor.co in browser
  - [ ] Verify app loads correctly
  - [ ] Check SSL certificate (click padlock icon):
    - [ ] Issued by: Let's Encrypt or Google Trust Services
    - [ ] Valid for: contextor.co
  - [ ] Test http://contextor.co redirects to https
  - [ ] Test https://www.contextor.co redirects to https://contextor.co

- [ ] **Task 7: Set up Namecheap API access (optional)** (AC: #4)
  - [ ] Go to Profile > Tools > API Access
  - [ ] Enable API Access (if not enabled)
  - [ ] Whitelist your IP address (or GitHub Actions IP ranges)
  - [ ] Note API credentials:
    - [ ] API User (your Namecheap username)
    - [ ] API Key
  - [ ] Store in GitHub Secrets for future automation:
    - [ ] `NAMECHEAP_API_USER`
    - [ ] `NAMECHEAP_API_KEY`

- [ ] **Task 8: Update Supabase Auth URLs** (AC: #3)
  - [ ] Go to Supabase Dashboard > Authentication > Settings
  - [ ] Update Site URL to `https://contextor.co`
  - [ ] Update Redirect URLs to include:
    - [ ] `https://contextor.co/**`
    - [ ] `https://www.contextor.co/**`
  - [ ] Test OAuth flow with Google

## Dev Notes

### Cloud Run Domain Mapping Commands

```bash
# Create domain mapping
gcloud run domain-mappings create \
  --service contextor-web \
  --domain contextor.co \
  --region us-central1

# Check mapping status
gcloud run domain-mappings describe \
  --domain contextor.co \
  --region us-central1

# List all mappings
gcloud run domain-mappings list --region us-central1

# Delete mapping (if needed)
gcloud run domain-mappings delete \
  --domain contextor.co \
  --region us-central1
```

### DNS Verification Commands

```bash
# Check A records
dig contextor.co A +short

# Check AAAA records
dig contextor.co AAAA +short

# Check CNAME records
dig www.contextor.co CNAME +short

# Full DNS query
dig contextor.co ANY

# Test HTTPS
curl -I https://contextor.co
```

### Namecheap API (for future automation)

The API can be used to programmatically update DNS records. Useful for:
- Adding subdomains automatically
- Updating records in CI/CD
- Managing multiple environments

API Documentation: https://www.namecheap.com/support/api/

Example API call (Node.js):
```javascript
// This is for future reference, not needed for initial setup
const params = new URLSearchParams({
  ApiUser: process.env.NAMECHEAP_API_USER,
  ApiKey: process.env.NAMECHEAP_API_KEY,
  UserName: process.env.NAMECHEAP_API_USER,
  ClientIp: 'your-ip',
  Command: 'namecheap.domains.dns.getHosts',
  SLD: 'contextor',
  TLD: 'co'
});
```

### Troubleshooting

**SSL certificate not provisioning:**
- Ensure DNS is pointing to Cloud Run correctly
- Wait up to 24 hours (usually faster)
- Check domain mapping status in Cloud Run console
- Verify no CAA records blocking Let's Encrypt

**Domain not resolving:**
- Check DNS propagation: https://dnschecker.org
- Verify records are correct in Namecheap
- Wait for TTL to expire (check current TTL)
- Try flushing local DNS: `sudo dscacheutil -flushcache` (macOS)

**www subdomain not working:**
- Ensure CNAME record points to correct target
- Cloud Run may need separate mapping for www
- Add www domain mapping if needed:
  ```bash
  gcloud run domain-mappings create \
    --service contextor-web \
    --domain www.contextor.co \
    --region us-central1
  ```

### Cost Considerations

- Cloud Run custom domains: **Free**
- SSL certificates: **Free** (Let's Encrypt via Cloud Run)
- Namecheap domain renewal: ~$30/year for .co
- DNS hosting: **Free** with Namecheap

## Dependencies

- Story 9.2: Cloud Run service deployed
- contextor.co domain registered in Namecheap
- Story 9.1: Supabase Auth URLs need updating after domain is live

## Definition of Done

- [ ] Domain mapping created in Cloud Run
- [ ] DNS records configured in Namecheap
- [ ] DNS propagation complete
- [ ] SSL certificate provisioned and valid
- [ ] https://contextor.co loads the app
- [ ] http redirects to https
- [ ] www redirects to non-www
- [ ] Supabase Auth URLs updated
- [ ] (Optional) Namecheap API credentials stored
