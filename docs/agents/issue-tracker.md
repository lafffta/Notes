# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub issues in `lafffta/Notes`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue:** `gh issue create --title "..." --body "..."`.
- **Read an issue:** `gh issue view <number> --comments`, including its labels.
- **List issues:** `gh issue list --state open --json number,title,body,labels,comments`, with suitable label and state filters.
- **Comment on an issue:** `gh issue comment <number> --body "..."`.
- **Apply or remove labels:** `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- **Close an issue:** `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`; `gh` does this automatically when run inside the clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** Set this to `yes` if the repository later treats external pull requests as feature requests; `/triage` reads this flag.

If changed to `yes`, run pull requests through the same labels and states as issues using the `gh pr` equivalents. For external-request triage, keep authors whose association is `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`, and exclude `OWNER`, `MEMBER`, and `COLLABORATOR`.

GitHub shares one number space across issues and pull requests. Resolve an ambiguous `#42` with `gh pr view 42`, falling back to `gh issue view 42`.

## Skill operations

- When a skill says **publish to the issue tracker**, create a GitHub issue.
- When a skill says **fetch the relevant ticket**, run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The map is one issue with child issues as decision tickets.

- **Map:** Create one issue labelled `wayfinder:map`; its body contains Notes, Decisions-so-far, and Fog sections.
- **Child ticket:** Link an issue to the map as a GitHub sub-issue. If sub-issues are unavailable, add the child to a task list in the map and put `Part of #<map>` at the top of the child body. Label it `wayfinder:<type>`, where type is `research`, `prototype`, `grilling`, or `task`.
- **Blocking:** Prefer GitHub's native issue dependencies. Use the blocker's numeric database ID, not its issue number or node ID. If dependencies are unavailable, put `Blocked by: #<n>, #<n>` at the top of the child body.
- **Frontier query:** List the map's open children, discard tickets with open blockers or an assignee, and take the first remaining ticket in map order.
- **Claim:** Run `gh issue edit <number> --add-assignee @me`. This is the session's first write.
- **Resolve:** Comment with the answer, close the ticket, and add a context pointer and link to the map's Decisions-so-far section.
