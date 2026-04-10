Ship the current branch as a pull request.

Goal:
Prepare a safe commit and PR flow for the current branch.
Do not skip validation steps.

Instructions:
1. Review the current branch, git status, and git diff first.
2. If the current branch is `main` or `master`, stop and report that shipping must happen from a feature branch.
3. If there are no meaningful changes, stop and report that there is nothing to ship.
4. Run the required quality gates before any commit:
    - `npm run typecheck`
    - `npm run lint`
    - `npm run test`
5. If any quality gate fails, stop immediately and report:
    - which command failed
    - the important error summary
    - what needs to be fixed before shipping
6. Summarize the current changes:
    - changed files
    - change summary
    - QA / regression review
    - test status
    - risks or items needing confirmation
7. Suggest 3 commit message options in a consistent project style.
8. Choose the best commit message unless the user has already provided one.
9. Stage changes and create a commit.
10. Push the current branch to origin.
11. Create a pull request with `gh pr create`.
12. Return the final shipping summary.

Pull request body should include:
- Summary
- What changed
- Validation
- Risks / follow-up

Validation rules:
- Do not commit if typecheck, lint, or test failed.
- Do not push directly to `main` or `master`.
- Do not create a PR without first reviewing the diff.
- Keep the PR title aligned with the selected commit message.

Output format:
- Branch name
- Changed files
- Change summary
- QA / regression review
- Test status
- Risks or items needing confirmation
- Selected commit message
- PR title
- PR summary
- Final result
