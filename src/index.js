const core = require('@actions/core');
const github = require('@actions/github');
const { getPRComments, getUserBio, getIssueLabels, removeLabelFromIssue, postComment } = require('./github');
const { sendPayment } = require('./lightning');
const { parseZapTrigger, parseClosingIssues, parseLightningAddress } = require('./parser');

async function resolveContributorLightningAddress(prBody, contributorLogin) {
  const fromPR = parseLightningAddress(prBody);
  if (fromPR) return fromPR;

  const bio = await getUserBio(contributorLogin);
  const fromBio = parseLightningAddress(bio);
  if (fromBio) return fromBio;

  return null;
}

async function run() {
  const { owner, repo } = github.context.repo;
  const pr = github.context.payload.pull_request;

  if (!pr || !pr.merged) {
    core.info('Not a merged PR — skipping.');
    return;
  }

  const prNumber = pr.number;
  const contributorLogin = pr.user.login;
  const prBody = pr.body || '';

  const nwcConnectionString = core.getInput('nwc-connection-string', { required: true });
  const treasuryAddress = core.getInput('treasury-lightning-address');
  const triggerKeywords = core.getInput('trigger-keywords') || '⚡,zap,merit,tip';
  const authorizedRoles = core.getInput('authorized-roles') || 'OWNER,MEMBER,COLLABORATOR';

  core.info(`Processing merged PR #${prNumber} by @${contributorLogin}`);

  const comments = await getPRComments(owner, repo, prNumber);

  // Discretionary zap
  const zapTrigger = parseZapTrigger(comments, authorizedRoles, triggerKeywords);
  if (zapTrigger) {
    core.info(`Zap trigger found: ${zapTrigger.amount} sats by @${zapTrigger.triggeredBy}`);
  }

  // Bounties
  const closingIssues = parseClosingIssues(prBody);
  const bounties = [];
  for (const issueNumber of closingIssues) {
    const labels = await getIssueLabels(owner, repo, issueNumber);
    const bountyLabel = labels.find(l => /^bounty:\s*\d+$/i.test(l));
    if (bountyLabel) {
      const amount = parseInt(bountyLabel.replace(/^bounty:\s*/i, ''), 10);
      bounties.push({ issueNumber, amount, label: bountyLabel });
      core.info(`Bounty found: ${amount} sats for issue #${issueNumber}`);
    }
  }

  if (!zapTrigger && bounties.length === 0) {
    core.info('No zap trigger or bounties found — nothing to pay.');
    return;
  }

  const lightningAddress = await resolveContributorLightningAddress(prBody, contributorLogin);

  if (!lightningAddress) {
    const pending = [];
    if (zapTrigger) pending.push(`${zapTrigger.amount.toLocaleString()} sats (discretionary zap)`);
    for (const b of bounties) pending.push(`${b.amount.toLocaleString()} sats (bounty for #${b.issueNumber})`);

    await postComment(owner, repo, prNumber,
      `⚡ @${contributorLogin} — you have a Merit payment waiting!\n\n` +
      `**Pending:** ${pending.join(', ')}\n\n` +
      `Add a Lightning address to your GitHub bio or reply with:\n` +
      `\`claim: your@lightning.address\``
    );
    core.info('No Lightning address found — posted unclaimed zap comment.');
    return;
  }

  const fundingLine = treasuryAddress
    ? `\n\n*Want to fund more contributions to this project? ⚡ \`${treasuryAddress}\`*`
    : '';
  let failed = false;

  // Pay discretionary zap
  if (zapTrigger) {
    try {
      await sendPayment(nwcConnectionString, lightningAddress, zapTrigger.amount);
      await postComment(owner, repo, prNumber,
        `⚡ Zapped **${zapTrigger.amount.toLocaleString()} sats** to @${contributorLogin}${fundingLine}`
      );
      core.info(`Zap paid: ${zapTrigger.amount} sats to ${lightningAddress}`);
    } catch (err) {
      core.error(`Zap payment failed: ${err.message}`);
      await postComment(owner, repo, prNumber,
        `⚡ Merit tried to zap @${contributorLogin} **${zapTrigger.amount.toLocaleString()} sats** but the payment failed.\n\n` +
        `**Error:** ${err.message}\n\n` +
        `To pay manually, send to: \`${lightningAddress}\``
      );
      failed = true;
    }
  }

  // Pay bounties
  for (const bounty of bounties) {
    try {
      await sendPayment(nwcConnectionString, lightningAddress, bounty.amount);
      await postComment(owner, repo, prNumber,
        `⚡ Paid **${bounty.amount.toLocaleString()} sats** bounty to @${contributorLogin} for closing #${bounty.issueNumber}${fundingLine}`
      );
      await removeLabelFromIssue(owner, repo, bounty.issueNumber, bounty.label);
      core.info(`Bounty paid: ${bounty.amount} sats for issue #${bounty.issueNumber}`);
    } catch (err) {
      core.error(`Bounty payment for #${bounty.issueNumber} failed: ${err.message}`);
      await postComment(owner, repo, prNumber,
        `⚡ Merit tried to pay the **${bounty.amount.toLocaleString()} sats** bounty for #${bounty.issueNumber} to @${contributorLogin} but the payment failed.\n\n` +
        `**Error:** ${err.message}\n\n` +
        `To pay manually, send to: \`${lightningAddress}\``
      );
      failed = true;
    }
  }

  if (failed) core.setFailed('One or more Merit payments failed — see comments on the PR for details.');
}

run().catch(err => core.setFailed(err.message));
