#QueueSmart Team Development Guide

This guide explains how to set up QueueSmart, use `npm`, and work with Git/GitHub as a team.

The goal is to make sure everyone can contribute without accidentally deleting someone else's work or breaking the `main` branch.

## 1. Tools You Need

Before working on QueueSmart, make sure you have:

- Git
- Node.js
- npm
- Visual Studio Code
- A GitHub account

Check your installations:

```bash
node -v
npm -v
git --version
```

## 2. First-Time Setup

You only need to do this once.

Clone the repository:

```bash
git clone https://github.com/DDominguez29/QueueSmart.git
cd QueueSmart
code .
```

Then install the project dependencies:

```bash
npm install
```

The `node_modules` folder is intentionally not stored on GitHub. `npm install` recreates it from `package.json` and `package-lock.json`.

## 3. Running QueueSmart

Start the development server:

```bash
npm run dev
```

Vite will show a local address such as:

```text
http://localhost:5173/
```

Open that address in your browser.

To stop the server, press:

```text
Ctrl + C
```

## 4. Useful npm Commands

Install dependencies:

```bash
npm install
```

Start the project:

```bash
npm run dev
```

Install a new package:

```bash
npm install package-name
```

Example:

```bash
npm install react-router-dom
```

Check the code with ESLint:

```bash
npm run lint
```

Test that the project builds:

```bash
npm run build
```

Before an important Pull Request, run:

```bash
npm run lint
npm run build
```

## 5. Important npm Rule

Never manually upload `node_modules` to GitHub.

Each developer should run:

```bash
npm install
```

to install dependencies on their own computer.

# Git/GitHub Team Workflow

The `main` branch should contain the stable version of QueueSmart.

Team members should normally work on feature branches instead of coding directly on `main`.

Example:

```text
main
│
├── feature/login-register
├── feature/user-dashboard
├── feature/join-queue
├── feature/queue-status
├── feature/admin-dashboard
└── feature/service-management
```

The normal workflow is:

```text
main
 ↓
create feature branch
 ↓
write code
 ↓
commit
 ↓
push branch
 ↓
Pull Request
 ↓
review
 ↓
merge into main
```

## 6. Before Starting New Work

Always start from the latest `main`:

```bash
git switch main
git pull
```

Then create a branch for your task:

```bash
git switch -c feature/my-feature
```

Example:

```bash
git switch -c feature/user-dashboard
```

Check your current branch:

```bash
git branch
```

The branch with `*` beside it is your current branch.

## 7. While Working

See what files have changed:

```bash
git status
```

When you are ready to save a checkpoint:

```bash
git add .
git commit -m "Describe what you changed"
```

Good commit messages:

```text
Create login and registration pages
Add queue status card
Implement service form validation
Add admin queue management table
Fix user navigation
```

Avoid vague messages such as:

```text
stuff
changes
update
final
work
```

Clear commits are important because the TA may check GitHub history to verify individual contributions.

## 8. Push Your Branch

The first time you push a new branch:

```bash
git push -u origin feature/my-feature
```

Example:

```bash
git push -u origin feature/user-dashboard
```

After the first push, you can normally use:

```bash
git push
```

## 9. Create a Pull Request

After pushing your branch:

1. Open the QueueSmart repository on GitHub.
2. Click **Compare & pull request**.
3. Make sure the base branch is `main`.
4. Make sure the compare branch is your feature branch.
5. Add a clear title and short description.
6. Create the Pull Request.

Example:

```text
base: main
compare: feature/user-dashboard
```

It is best if another teammate quickly reviews the Pull Request before it is merged.

Check:

- Does the application still run?
- Does the feature work?
- Were existing features accidentally changed or deleted?
- Are there obvious errors?
- Did `npm run lint` and `npm run build` succeed?

## 10. After Your Pull Request Is Merged

Update your local `main`:

```bash
git switch main
git pull
```

When you begin another feature:

```bash
git switch main
git pull
git switch -c feature/new-feature
```

## 11. Everyday Workflow

This is the main workflow to remember.

Before coding:

```bash
git switch main
git pull
git switch -c feature/my-feature
```

After coding:

```bash
git status
git add .
git commit -m "Describe what you changed"
git push -u origin feature/my-feature
```

Then create a Pull Request on GitHub.

After it is merged:

```bash
git switch main
git pull
```

## 12. What the Main Git Commands Mean

### `git pull`

Downloads the latest changes from GitHub to your computer.

```text
GitHub → Your Computer
```

### `git push`

Uploads your commits from your computer to GitHub.

```text
Your Computer → GitHub
```

### `git add .`

Tells Git which changed files should be included in the next commit.

It does not upload anything.

### `git commit`

Creates a saved checkpoint in Git history.

Example:

```bash
git commit -m "Add registration form validation"
```

Think of the process like this:

```text
Change Files
     ↓
git add
     ↓
git commit
     ↓
git push
     ↓
GitHub
```

## 13. If Someone Else Updates the Project

Before starting new work:

```bash
git switch main
git pull
```

If a teammate added a new npm package, also run:

```bash
npm install
```

If `npm run dev` suddenly fails after pulling, try:

```bash
npm install
npm run dev
```

## 14. Merge Conflicts

A merge conflict can happen when two people modify the same part of the same file.

VS Code may show options such as:

```text
Accept Current Change
Accept Incoming Change
Accept Both Changes
```

Do not randomly choose one.

Read both versions and decide what code should remain. If you are unsure, talk with the teammate who edited the same file.

After resolving the conflict:

```bash
git add .
```

Then finish the commit or merge as Git instructs.

## 15. Things to Avoid

Do not work on large features directly on `main`.

Do not use:

```bash
git push --force
```

unless the team specifically agrees and you understand exactly why it is needed.

Do not delete someone else's code just because you do not understand it. Ask first.

Do not commit `node_modules`.

Do not wait several days and make one giant commit if you can make smaller meaningful commits instead.

## 16. Branch Naming

For new features:

```text
feature/feature-name
```

Examples:

```text
feature/login-register
feature/user-dashboard
feature/join-queue
feature/queue-status
feature/history
feature/notifications
feature/admin-dashboard
feature/service-management
feature/queue-management
```

For bug fixes:

```text
fix/problem-name
```

Example:

```text
fix/login-validation
```

## 17. QueueSmart Team Rules

1. Do not develop major features directly on `main`.
2. Run `git pull` before starting new work.
3. Create a branch for each feature.
4. Make clear commits under your own GitHub account.
5. Push your branch regularly.
6. Use Pull Requests to merge features.
7. Run `npm run lint` before important Pull Requests.
8. Run `npm run build` before merging major changes.
9. Do not commit `node_modules`.
10. Do not use `git push --force`.
11. Communicate before changing another person's feature.
12. Make sure everyone contributes meaningful code because GitHub history will show individual contributions.

# Quick Cheat Sheet

## Start working

```bash
git switch main
git pull
git switch -c feature/my-feature
npm install
npm run dev
```

## Save and upload your work

```bash
git status
git add .
git commit -m "Describe my work"
git push -u origin feature/my-feature
```

Then create a Pull Request on GitHub.

## After the Pull Request is merged

```bash
git switch main
git pull
```

## npm commands

```bash
npm install
npm run dev
npm run lint
npm run build
```
