# Security Specification for Sky Party

## Data Invariants
- Events must have a title, date, and isActive status.
- Config document 'settings' must exist for the site to function correctly.
- Admin access is required for updating site config and creating/editing events. (For this demo, we may allow open access if the user hasn't set up Auth, but the prompt implies they want it "connected to their project").

## The Dirty Dozen Payloads (Rejection Criteria)
1. **Identity Spoofing**: Trying to set `authorId` to someone else (if we had it).
2. **Schema Break**: Sending an event without a `title`.
3. **Type Poisoning**: Sending `price` as a string instead of a number.
4. **ID Injection**: Creating a document with a 1MB ID.
5. **Ghost Fields**: Adding `isAdmin: true` to a user profile (if we had users).
6. **Immutable Break**: Trying to change `createdAt` on an event.
7. **Negative Price**: Setting `price` to -100.
8. **Massive String**: Setting `description` to 2MB.
9. **Client Timestamp**: Providing a `createdAt` from the client instead of `request.time`.
10. **State Leak**: Accessing a private collection (if we had one).
11. **Config Overwrite**: Deleting the `settings` document.
12. **Future Event**: (Wait, date is a string in this case, but we could enforce regex).

## Test Runner (Mental or Scripted)
The following rules will ensure all these fail.
