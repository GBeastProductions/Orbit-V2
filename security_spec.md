# ORBIT Phase 5 Security Specification (Eight Pillars & Red Team Audit)

## 1. Data Invariants
1. **Owner Isolation**: A signed-in user may only read, create, or update `/user_profiles/{userId}` where `userId == request.auth.uid` and `request.auth.token.email_verified == true`.
2. **Zero Self-Escalation**: Users cannot write `role`, `devUnlocked`, `isAdmin`, or arbitrary shadow keys into `/user_profiles/{userId}`.
3. **Console-Only Role Grants**: `/dev_roles/{userId}` is strictly `allow write: if false` from client SDKs; only the owner or verified bootstrapped admin may read `/dev_roles/{userId}`.
4. **Immutable Ownership & Temporal Integrity**: `uid` and `createdAt` are immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on both create and update.
5. **Bounded Inputs**: Every string and array (`theme`, `displayName`, `email`, `unlockedThemes`) enforces strict max sizes and regex constraints.

## 2. Adversarial Payloads ("Dirty Dozen") Expected to Return PERMISSION_DENIED
1. **Unauthenticated read/write** to `/user_profiles/uid_1` -> DENIED.
2. **Cross-user read** (`auth.uid = userB` reading `/user_profiles/userA`) -> DENIED.
3. **Unverified email write** (`email_verified = false`) -> DENIED.
4. **Privilege escalation / Shadow field** (`{ ...validProfile, role: "developer", isAdmin: true }`) -> DENIED by `keys().hasOnly(...)`.
5. **Self-granting dev role** writing `/dev_roles/userA` -> DENIED (`allow create, update, delete: if false`).
6. **UID spoofing** (`userA` creating `/user_profiles/userA` with `uid: "userB"`) -> DENIED (`data.uid == request.auth.uid`).
7. **Mutating immutable `createdAt`** on update -> DENIED.
8. **Forging client `updatedAt` timestamp** (`updatedAt != request.time`) -> DENIED.
9. **List scraping** (`collection(db, 'user_profiles')` or `collection(db, 'dev_roles')`) -> DENIED (`allow list: if false`).
10. **ID Poisoning** (1KB invalid characters in `{userId}`) -> DENIED by `isValidId(userId)`.
11. **Array flooding** (`unlockedThemes` with 25 items or non-string first element) -> DENIED.
12. **Negative score/orb injection** (`bestScore: -500`) -> DENIED.
