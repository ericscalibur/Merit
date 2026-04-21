# Merit — Full Technical Spec

## The Vision

Anyone with a computer and an AI assistant can fork a repo, improve it, submit a PR,
and earn Bitcoin if their work is merged. No permission needed, no pre-approval,
no platform account — just code and a Lightning address.

Merit is a GitHub Action that rewards open source contributors with instant Bitcoin
(Lightning) payments at the moment a PR is merged. It runs entirely inside GitHub's
own infrastructure. The creator ships it once and never touches a server again.

---

## Philosophy

**Merit is earned, not purchased.**

The primary flow is discretionary: a maintainer sees unexpected value in a contribution
and chooses to reward it. This preserves the creative, exploratory spirit of open source
— the best contributions often come from directions the maintainer never anticipated.
Bounties exist too, but they're a secondary flow. Bounties limit scope to the
maintainer's existing vision. Discretionary zaps reward vision the maintainer didn't have.

Monetary reward is an incentive, not the point. Contributors should build things they
believe in. Merit zaps are recognition that lands as a pleasant surprise, not a wage.

---

## Who It's For

| Role | What they do | What they need |
|---|---|---|
| **Contributor** | Forks a repo, uses Claude (or equivalent) to improve it, submits a PR | A Lightning address (2-minute setup via Alby, Strike, etc.) |
| **Maintainer** | Reviews PRs, merges good ones, optionally types a zap trigger | A Lightning wallet with NWC support + one workflow file added to their repo |
| **Sponsor** | Funds a project they depend on or believe in | A Lightning wallet — send directly to maintainer's published address |

---

## System Components

### Component 1: `ericscalibur/merit` (the GitHub Action)
The action itself. Published to GitHub Marketplace. Runs inside GitHub's infrastructure
on every PR merge. No server, no hosting, no ops — ever.

### Component 2: Discovery Directory (GitHub Pages)
A static site listing repos using Merit + their open bounties.
Updated daily by a scheduled GitHub Action. Free, zero ops.

### Component 3: The Treasury (a Lightning wallet, not a smart contract)
Maintainers publish a Lightning address so sponsors can fund development.
Transparency comes from the public PR comment audit trail, not cryptographic enforcement.
**Honest positioning: transparent by convention, not by cryptography.**

---

## The Flows

### Flow 1: Discretionary Zap (the soul of Merit)

```
Contributor sees potential in a repo → forks it → uses Claude to improve it
         ↓
Submits PR
         ↓
Maintainer reviews — surprised by the quality or direction
         ↓
Maintainer posts "⚡ 10000" in a PR comment (or "merit 10000" / "zap 10000")
         ↓
Maintainer merges
         ↓
GitHub fires pull_request[closed] → Merit action runs
         ↓
Action scans PR comments for zap trigger
Verifies commenter is OWNER / MEMBER / COLLABORATOR (critical security check)
         ↓
Resolves contributor Lightning address:
  1. Scan PR body for "⚡ user@domain.com" or "lightning: user@domain.com"
  2. GET /users/{contributor} → parse GitHub bio
  3. If not found → post "unclaimed zap" comment, log as unresolved
         ↓
LNURL-pay lookup → fetch invoice for exact amount
         ↓
Pay invoice via NWC
         ↓
Post public comment on merged PR:
"⚡ Zapped 10,000 sats to @contributor — funded by the Merit treasury: tips@maintainer.com"
```

### Flow 2: Bounty (pre-committed, scoped work)

```
Maintainer creates GitHub Issue label: "bounty: 5000"
Applies label to issue — visible to any contributor browsing the repo
         ↓
Contributor submits PR with "Closes #42" in body
         ↓
PR is merged → Merit action runs
         ↓
Action parses PR body for closing keywords + issue numbers
Checks each referenced issue for bounty labels via GitHub API
         ↓
Pays bounty amount to contributor (same Lightning resolution flow)
         ↓
Posts confirmation comment, removes bounty label from issue (marks as claimed)
```

### Flow 3: Treasury / Sponsorship

```
Maintainer sets treasury-lightning-address in workflow file (visible to all)
         ↓
Sponsor sees address in README badge, in zap confirmation comments,
or on the Merit discovery directory site
         ↓
Sponsor sends sats directly to that Lightning address — no intermediary
         ↓
Sats accumulate in maintainer's NWC wallet
         ↓
Every zap confirmation comment publicly records what was paid, to whom, for what PR
PR comment history = the audit trail
```

---

## Workflow File (What Maintainers Add)

```yaml
name: Merit
on:
  pull_request:
    types: [closed]

permissions:
  pull-requests: write
  issues: write

jobs:
  merit:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: ericscalibur/merit@v1
        with:
          nwc-connection-string: ${{ secrets.NWC_CONNECTION_STRING }}
          treasury-lightning-address: "tips@yourdomain.com"  # optional
```

**Maintainer onboarding (total: ~5 minutes):**
1. Get a Lightning wallet with NWC support (Alby: 2 min)
2. Add this workflow file to `.github/workflows/merit.yml`
3. Add `NWC_CONNECTION_STRING` to repo Secrets
4. Done — Merit runs on every future merged PR

---

## Action Inputs

| Input | Required | Description |
|---|---|---|
| `nwc-connection-string` | Yes | `nostr+walletconnect://...` stored as GitHub Secret |
| `github-token` | No | Defaults to `GITHUB_TOKEN` |
| `treasury-lightning-address` | No | Surfaced in confirmation comments |
| `trigger-keywords` | No | Default: `⚡,zap,merit,tip` |
| `authorized-roles` | No | Default: `OWNER,MEMBER,COLLABORATOR` |

---

## Obstacles & Resolutions

### OBSTACLE 1: Anyone Can Trigger a Zap (Critical Security)
**Problem:** If any commenter can trigger a zap, a contributor types `⚡ 100000`
on their own PR and drains the wallet.

**Solution:** GitHub provides `author_association` on every comment:
`OWNER`, `MEMBER`, `COLLABORATOR`, `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, `NONE`

Action only accepts zap triggers from `OWNER`, `MEMBER`, or `COLLABORATOR` by default.
Configurable via `authorized-roles` input.

**Implementation:** Filter by `author_association` before parsing for zap triggers.

---

### OBSTACLE 2: Lightning is NOT Trustless
**Problem:** The "treasury" is just the maintainer's Lightning wallet.
There is no smart contract, no escrow, no cryptographic enforcement that donated sats
go to contributors. The maintainer could spend them elsewhere.

**Reality:** The transparency comes from GitHub PR comments — public, tamper-evident,
tied to specific merged PRs. Anyone can read the history and verify disbursements.
But they cannot verify the wallet balance or rule out off-chain spending.

**Decision:** Be upfront in docs. Frame it as "public audit trail" not "on-chain enforcement."
Don't oversell. The trust model is social, backed by the immutable PR record.

---

### OBSTACLE 3: Contributor Has No Lightning Address
**Problem:** PR author has no Lightning address in bio or PR body.

**V1 solution:** Post a comment on the merged PR:
> "⚡ @maintainer wants to send you 10,000 sats! Add a Lightning address to your
> GitHub bio or reply with `claim: your@lightning.address` to receive it."

Log as unresolved. Sats stay in maintainer's wallet until claimed (or never).
This is also a natural Lightning onboarding moment — contributor discovers it
because they're about to receive money.

**V2 solution:** A second workflow triggered on `issue_comment` created. Scans for
`claim: user@domain.com` replies on PRs with unresolved zaps, then pays automatically.

---

### OBSTACLE 4: NWC Payment Failures
**Problem:** Wallet offline, insufficient balance, NWC relay unreachable,
LNURL endpoint down, invoice expired.

**Solution:**
- 3 retries with exponential backoff (2s, 4s, 8s) for network errors
- On final failure: post PR comment explaining the error + how to pay manually
- Action exits non-zero (shows as failed in GitHub Actions UI)
- Error messages distinguish failure types (insufficient funds / network / bad address)

---

### OBSTACLE 5: LNURL-pay Edge Cases
**The full flow:**
1. Parse Lightning address → `user@domain.com`
2. `GET https://domain.com/.well-known/lnurlp/user`
3. Parse `minSendable` / `maxSendable` (millisats)
4. Verify zap amount is within range
5. `GET {callback}?amount={millisats}`
6. Receive BOLT11 invoice
7. Pay via NWC

**Edge cases:**
- Amount below `minSendable`: fail with message ("minimum for this address is X sats")
- Amount above `maxSendable`: fail with message
- Domain unreachable: retry 3x, then fail gracefully
- Invalid LNURL-pay response: fail with parse error
- Invoice amount doesn't match requested: fail (never pay wrong amount)

---

### OBSTACLE 6: Bounty + Discretionary on Same PR
**Decision:** Pay both. They're different recognitions.
- Bounty = you solved a known problem
- Discretionary zap = the quality or direction surprised me

**Guard:** One bounty per issue, one discretionary per PR. No double-paying either.

---

### OBSTACLE 7: PR Closes Multiple Bounty Issues
**Decision:** Pay all bounties. Each issue is an independent commitment.
One PR solving three bounty issues pays three bounties.

---

### OBSTACLE 8: Parsing "Closes #N" from PR Body
GitHub closing keywords: `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`,
`resolve`, `resolves`, `resolved` + `#N`.

**Regex:** `/(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#(\d+)/gi`

**V1 scope:** Same-repo issues only. Cross-repo (`owner/repo#N`) deferred to V2.

---

### OBSTACLE 9: Action Must Be Bundled
**Problem:** GitHub Actions JS actions cannot run `npm install` at runtime.
All dependencies must be in `dist/`.

**Solution:** Bundle with `@vercel/ncc`:
```bash
npx ncc build src/index.js -o dist
```
A release GitHub Action auto-bundles and tags on every push to main.

---

### OBSTACLE 10: Action Versioning
Maintainers pin to `@v1`. Standard convention:
- `v1` tag force-updated to always point to latest `v1.x.x`
- `v1.0.0` tags are immutable
- Breaking changes ship as `v2`
(Same pattern as `actions/checkout@v4`)

---

### OBSTACLE 11: Discovery — How Contributors Find Merit Repos
**Problem:** Contributors with Claude need to find which repos have Merit enabled
and what bounties are open.

**Solutions (layered):**
1. **GitHub code search today:** `path:.github/workflows ericscalibur/merit`
2. **README badge:** maintainers add a static badge linking to the directory
3. **Discovery directory** (GitHub Pages, V2):
   - Daily Action: `GET /search/code?q=ericscalibur/merit` → find all adopting repos
   - For each repo: read issue labels to surface open bounties
   - Generate static HTML + JSON — free, zero ops forever

---

### OBSTACLE 12: Single-Person Repos / Maintainer Zapping Themselves
Not our problem to police. It's their wallet, their repo, their money.
The public audit trail handles accountability. Donors choose who to trust.

---

### OBSTACLE 13: GitHub Actions Permissions
```yaml
permissions:
  pull-requests: write   # post confirmation comment
  issues: write          # remove bounty label after payment
```
`GITHUB_TOKEN` with these permissions is sufficient. No PAT needed.

---

## Project Structure

```
merit/                         (this repo)
├── action.yml                 # action metadata + inputs
├── package.json
├── src/
│   ├── index.js               # entry point, orchestrates the flow
│   ├── github.js              # GitHub API (comments, issues, user bio)
│   ├── lightning.js           # LNURL-pay resolution + NWC payment
│   └── parser.js              # comment trigger + PR body parsing
└── dist/
    └── index.js               # bundled (committed — what GitHub actually runs)
```

---

## Key Dependencies

```json
{
  "@getalby/sdk": "^3.0.0",      // NWC client
  "@actions/core": "^1.10.0",    // action inputs/outputs/logging
  "@actions/github": "^6.0.0",   // GitHub API (Octokit)
  "axios": "^1.6.0"              // LNURL HTTP calls
}
```

Dev:
```json
{
  "@vercel/ncc": "^0.38.0"       // bundler
}
```

---

## V1 Scope

- [ ] Discretionary zap via PR comment trigger (maintainer-only, role-checked)
- [ ] Lightning address resolution (PR body → GitHub bio → unresolved)
- [ ] LNURL-pay flow (with min/max validation)
- [ ] NWC payment via @getalby/sdk
- [ ] Bounty via GitHub Issue labels (`bounty: N` format)
- [ ] Multi-issue bounty payout on single PR
- [ ] Confirmation comment on merged PR (with treasury address if set)
- [ ] Failure comment with error details + manual payment instructions
- [ ] Unresolved zap comment when no Lightning address found
- [ ] Bundled dist + semver release workflow

## V2 Scope

- [ ] Auto-claim flow (`claim: user@lightning.address` in PR comment)
- [ ] Discovery directory site (GitHub Pages)
- [ ] README badge
- [ ] Cross-repo issue closes
- [ ] Per-repo payment stats

---

## What Gets Shipped vs. What Runs Forever Without You

| Thing | Who runs it | Your involvement after ship |
|---|---|---|
| Merit action code | GitHub Actions (Microsoft's servers) | Zero — push updates only if you want |
| NWC wallet | Each maintainer | Zero |
| Payment execution | GitHub Actions | Zero |
| PR audit trail | GitHub | Zero |
| LNURL resolution | Contributor's wallet provider | Zero |

You publish the action. GitHub runs it free, forever, for every repo that adopts it.
You are a software author, not a service provider. Zero liability surface.
