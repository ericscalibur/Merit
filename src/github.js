const core = require('@actions/core');
const github = require('@actions/github');

function getOctokit() {
  const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
  return github.getOctokit(token);
}

async function getPRComments(owner, repo, prNumber) {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  return data;
}

async function getUserBio(username) {
  const octokit = getOctokit();
  const { data } = await octokit.rest.users.getByUsername({ username });
  return data.bio || '';
}

async function getIssueLabels(owner, repo, issueNumber) {
  const octokit = getOctokit();
  const { data } = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return data.map(l => l.name);
}

async function removeLabelFromIssue(owner, repo, issueNumber, label) {
  const octokit = getOctokit();
  await octokit.rest.issues.removeLabel({
    owner,
    repo,
    issue_number: issueNumber,
    name: label,
  });
}

async function postComment(owner, repo, prNumber, body) {
  const octokit = getOctokit();
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

module.exports = { getPRComments, getUserBio, getIssueLabels, removeLabelFromIssue, postComment };
