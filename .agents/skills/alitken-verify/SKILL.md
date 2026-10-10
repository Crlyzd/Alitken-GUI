---
name: alitken-verify
description: >-
  Use this skill to verify code changes in Alitken by running frontend type checking (tsc)
  and backend Rust compilation checks (cargo check).
---

# Alitken Verification Playbook

This skill verifies the integrity of both frontend TypeScript and backend Rust code without launching a full release build.

---

## 1. Prerequisites (Frontend Dependencies)
Ensure node modules are present before compiling:
```powershell
npm install
```

## 2. Frontend Type Check (TypeScript)

Run from the workspace root:
```powershell
npm run build
```
*(This triggers `tsc && vite build` as defined in `package.json`).*

---

## 2. Frontend Production Bundle Check (Vite)

Run from the workspace root:
```powershell
npm run build
```
**Success criteria**: Vite bundles `dist/` successfully with all assets resolved.

---

## 3. Backend Rust Compilation Check (Cargo)

Run from the workspace root targeting `src-tauri`:
```powershell
cargo check --manifest-path src-tauri/Cargo.toml
```
**Success criteria**: Cargo reports `Finished dev [unoptimized + debuginfo]` with 0 errors.

---

## 4. Full Verification Sequence

To run all checks in one command:
```powershell
npx tsc --noEmit && cargo check --manifest-path src-tauri/Cargo.toml
```
