---
description: Chain Architect (Planning) -> User Approval -> Orchestrator (Coding Specialist -> Code Reviewer) for feature and refactor requests, using global workflows and AGENTS.md.
---

When the user types `/proceed <request>` (or when planning and executing a feature/refactor), orchestrate the development process strictly following the global workflows in `C:\Users\kalek\.gemini\config\global_workflows\` and `.agents/AGENTS.md`.

Users may invoke this full sequence via `/proceed <request>`, or independently call `/architect <request>` for planning followed by `/orchestrator` (or plan approval) for execution.

---

### Phase 1: Planning with the Architect (`@architect` / `/architect`)

1. Act as the **Architect** (`@architect`).
2. Deeply study the codebase, consult `skills/alitken-expert/SKILL.md`, and **MANDATORILY read [history.md](file:///e:/Default/DEVS/Alitken/Alitken-GUI/history.md)** to inspect past mistakes, anti-patterns, and project evolution.
3. Produce a structured `implementation_plan.md` in the **system artifacts directory** (`<appDataDir>\brain\<conversation-id>\implementation_plan.md`).
   - **Plan Constraints**:
     - Follow the standard coding rules: **KISS, YAGNI, DRY**.
     - Ensure the plan avoids all anti-patterns documented in `history.md`.
     - Enforce functional modularity (single-responsibility components and custom hooks).
     - Proactively plan component decomposition to respect **strict line ceilings** (max 250–300 lines for frontend components/hooks, max 300–400 lines for Rust modules, max 50–60 lines for functions).
   - **NEVER** write implementation plans, scratch scripts, or temporary notes into the project root (`/`) or `.agents/`. (Only official `history.md` lives in root).
4. **Halt Execution**: Present a concise summary in chat with a clickable link to the plan artifact and explicitly ask the user for review and approval. Do NOT proceed to coding until the user approves.
   - If the user provides feedback or edits the plan, re-engage as the Architect to refine the plan artifact, then ask for approval again.

---

### Phase 2: Plan Approval & Coordination with the Orchestrator (`@orchestrator` / `/orchestrator`)

Once the user approves the plan (by saying "approved", clicking proceed on the plan artifact, or invoking `/orchestrator`), the **Orchestrator** takes control of execution:

1. **Deconstruct & Delegate**:
   - The Orchestrator breaks down the approved `implementation_plan.md` into atomic subtasks.
   - For each subtask, the Orchestrator hands off clear instructions to the **Coding Specialist** (`@coding-specialist` / `/coding-specialist`), providing necessary context, scope boundaries, and line ceiling constraints.

2. **Execute**:
   - The **Coding Specialist** implements the changes incrementally adhering strictly to KISS, YAGNI, DRY, and line ceilings.
   - Decomposes any files approaching 250–300 lines into sub-components or custom hooks.
   - **Logs the Gist of Changes**: Appends a concise summary of the code modifications into `history.md` under the current version / milestone section.
   - Returns completed changes and flags any assumptions or conflicts.

3. **Review & Audit**:
   - The Orchestrator routes the modified code and context to the **Code Reviewer** (`@code-reviewer` / `/code-reviewer`).
   - The Code Reviewer audits against the approved plan, security standards, KISS, YAGNI, DRY, functional modularity, line ceiling compliance, and verifies `history.md` has been updated with the change gist and contains no repeated mistakes.

4. **Remediation Loop**:
   - If the Code Reviewer identifies Critical Findings or line ceiling violations, the Orchestrator routes remediation instructions back to the Coding Specialist.
   - Repeats until no Critical Findings remain.

5. **Synthesis & Handoff**:
   - The Orchestrator summarizes all completed actions, notes any resolved items, and presents the final delivery summary to the user.
   - **Mistake Registration**: If at any point the user expresses negative feedback (*"don't do this"*, *"this isn't like what I expected"*, *"I never told you to do this"*), immediately record the incident under `[MISTAKE]` in `history.md`.
