# Merit ⚡

**Reward open source contributors with instant Bitcoin the moment their PR is merged.**

Merit is a GitHub Action that sends Lightning payments to contributors automatically — no server, no platform account, no intermediary. It runs entirely inside GitHub's own infrastructure.

---

## How it works

**Discretionary zap** — a maintainer sees unexpected value in a contribution and chooses to reward it:

1. Contributor submits a PR with a Lightning address in the body (or set in their GitHub bio)
2. Maintainer reviews — types `⚡ 10000` in a PR comment
3. Maintainer merges
4. Merit pays 10,000 sats instantly and posts a public confirmation comment

**Bounty** — pre-committed reward for scoped work:

1. Maintainer adds a `bounty: 5000` label to a GitHub Issue
2. Contributor submits a PR with `Closes #42` in the body
3. PR is merged — Merit pays 5,000 sats automatically and removes the label

Both flows leave a permanent public record on the PR. That's your audit trail.

---

## Setup (~5 minutes)

**1. Get a Lightning wallet with NWC support**

[Alby](https://getalby.com) is the easiest option. Create an account, then go to **Settings → Wallet → Connect** to get your NWC connection string (`nostr+walletconnect://...`).

**2. Add the workflow file**

Create `.github/workflows/merit.yml` in your repo:

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

**3. Add your NWC connection string as a secret**

Go to **Settings → Secrets and variables → Actions → New repository secret**

Name: `NWC_CONNECTION_STRING`
Value: your `nostr+walletconnect://...` string

**4. Done.** Merit runs on every future merged PR.

---

## Contributors: how to receive payment

Add your Lightning address to your **GitHub bio** or include it in your **PR body**:

```
⚡ you@getalby.com
```

Any Lightning address works — [Alby](https://getalby.com), [Strike](https://strike.me), [Wallet of Satoshi](https://walletofsatoshi.com), self-hosted, etc. Takes about 2 minutes to set up.

If no Lightning address is found when your PR is merged, Merit will post a comment telling you there's a payment waiting.

---

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `nwc-connection-string` | Yes | — | `nostr+walletconnect://...` stored as a GitHub Secret |
| `github-token` | No | `GITHUB_TOKEN` | GitHub token for API calls |
| `treasury-lightning-address` | No | — | Your Lightning address, surfaced in confirmation comments so sponsors can fund the treasury |
| `trigger-keywords` | No | `⚡,zap,merit,tip` | Keywords that trigger a discretionary zap |
| `authorized-roles` | No | `OWNER,MEMBER,COLLABORATOR` | GitHub roles allowed to trigger zaps |

---

## Zap triggers

Any of these in a PR comment (from an authorized role) will trigger a payment:

```
⚡ 10000
zap 10000
merit 10000
tip 10000
```

The number is the amount in sats. The maintainer sets it.

---

## Bounties

Add a label in the format `bounty: <sats>` to any issue:

```
bounty: 5000
```

When a PR that closes the issue is merged, Merit pays automatically. One PR can close multiple bounty issues — all bounties pay out.

---

## Security

Only comments from users with `OWNER`, `MEMBER`, or `COLLABORATOR` association on the repo can trigger zap payments. This prevents contributors from triggering payments on their own PRs. Configurable via the `authorized-roles` input.

---

## Trust model

The treasury is the maintainer's Lightning wallet — not a smart contract. There is no cryptographic enforcement that donated sats go to contributors.

Transparency comes from GitHub PR comments: every payment is publicly recorded, tied to a specific PR, and permanently visible in the repo's history. That's the audit trail. Donors choose who to trust.

---

## Philosophy

Merit is earned, not purchased.

The best contributions often come from directions the maintainer never anticipated. Discretionary zaps reward that. Bounties exist too, but they limit scope to what the maintainer already imagined.

Monetary reward is an incentive, not the point. Contributors should build things they believe in. Merit zaps are recognition that lands as a pleasant surprise, not a wage.
