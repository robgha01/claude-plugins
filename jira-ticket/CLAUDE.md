## Jira Ticket Auto-Trigger

When any user message contains a Jira ticket ID pattern (`[A-Z]+-[0-9]+`, e.g., `SBEPAY-1234`, `PAY-56`, `PLAT-999`), invoke the `jira-ticket` skill before doing anything else.

Skip only if the Jira ID is clearly a reference rather than a task start — for example, "fix the CSS the same way we did in SBEPAY-752" where context makes clear you are not starting work on that ticket.

The Jira ID format is the discriminator. No magic phrase is required.