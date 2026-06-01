# Historical Walkthrough: AI Mail Orchestration

This file is retained as a historical summary of the transition from the older AI plan flow to the current server-orchestrated review flow.

## Historical notes

- The system moved away from a single megprompt plan contract.
- The code now uses a shared overlay host with task scopes and server-side interpret / resolve / review / validate / apply stages.
- The mail flow was the first concrete scope for that transition.

## Superseded details

The older implementation notes about step lists, trace viewers, and plan wrapper behavior are superseded by the current docs in:

- `10_ai_architecture.md`
- `10.1_ai_modules.md`
- `10.2_hybrid_ai_shell_adr.md`
- `10_mail.md`
