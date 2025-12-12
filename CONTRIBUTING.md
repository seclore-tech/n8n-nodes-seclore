# Contributing

## Workflow

A **feature branch workflow** is followed for this repository. All development work is done on ticket branches that are merged directly into the `main` branch.

## Pre-requisite

- Verify that you have local git setup as mentioned in **[this guide](https://repo.seclore.com/common/user_guides/src/branch/main/docs/coding_processes.md#setting-up-base-machine)**
- A JIRA ticket should be created for the work you plan to contribute

## Contribution Process

### Branch Structure

- **`main`**: Production-ready code. This branch should always be stable and deployable. All ticket branches are created from and merged into this branch.

### Branch Naming Convention

Create branches using the following naming structure:

- **Format**: `ticket/<JIRA_TICKET_ID>`

Examples:
- `ticket/PS-378`
- `ticket/PS-379`

### Step-by-Step Contribution Process

1. **Create a branch from `main`**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b ticket/<JIRA_TICKET_ID>
   ```

2. **Follow standard development process**:
   - Effort Estimates
   - Design Documentation (if required)
   - Test Cases
   - Code Implementation (following project coding standards)

3. **Raise a Pull Request**
   - Create a PR **from your ticket branch into the `main` branch**
   - PR title format: `(<JIRA_TICKET_ID>) <short description>`
   - Add relevant documentation links in the PR description
   - Update the PR link in the JIRA ticket comments

4. **Code Review**
   - Address review comments
   - Ensure all CI checks pass
   - Get required approvals

5. **Merge to Main**
   - Upon PR approval, **squash and merge** the ticket branch into `main`
   - Delete the ticket branch after successful merge

---