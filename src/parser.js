function parseZapTrigger(comments, authorizedRoles, triggerKeywords) {
  const keywords = triggerKeywords.split(',').map(k => k.trim());
  const roles = authorizedRoles.split(',').map(r => r.trim().toUpperCase());

  for (const comment of comments) {
    if (!roles.includes((comment.author_association || '').toUpperCase())) continue;

    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${escaped}\\s*(\\d+)`, 'i');
      const match = comment.body.match(regex);
      if (match) {
        return {
          amount: parseInt(match[1], 10),
          triggeredBy: comment.user.login,
          commentId: comment.id,
        };
      }
    }
  }
  return null;
}

function parseClosingIssues(prBody) {
  const regex = /(close[sd]?|fix(e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  const issues = [];
  let match;
  while ((match = regex.exec(prBody)) !== null) {
    issues.push(parseInt(match[3], 10));
  }
  return [...new Set(issues)];
}

function parseLightningAddress(text) {
  if (!text) return null;
  const patterns = [
    /⚡\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    /lightning:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    /lnaddr:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

module.exports = { parseZapTrigger, parseClosingIssues, parseLightningAddress };
