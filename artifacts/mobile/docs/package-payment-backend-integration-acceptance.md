# Package Payment Backend Integration Acceptance

Frontend/backend integration is ready when all of the following are true:

1. staging base URL available
2. auth token provider available
3. configuration endpoint responds
4. manual mode can be enabled from backend
5. provider config renders correctly
6. claim create succeeds
7. backend ignores client identity authority
8. backend validates package offer
9. claim submit returns versioned state
10. list returns only current driver's claims
11. detail ownership enforced
12. duplicate provider/reference rejected
13. pending claim refresh works
14. clarification status renders correctly
15. resubmit handles expected version
16. stale version triggers refetch
17. rejected status renders safely
18. approved status renders correctly
19. approved claim does not trigger client-side activation
20. entitlement is read/refreshed from backend authority
21. no sensitive data appears in frontend telemetry
22. timeout behavior is safe
23. 401 behavior is safe
24. 403 behavior is safe
25. 429 behavior is safe
26. 5xx behavior is safe
27. network loss does not duplicate mutation
28. local prototype claims are not uploaded automatically
29. production repository mode remains guarded until sign-off
30. rollback to LOCAL/config-safe behavior is documented

## Phase MP9 Status

Phase MP9 completes the implementation of all frontend components, routes, and views required by this integration checklist:
- **Completed Acceptance Criteria (5, 9, 10, 13, 14, 15, 16, 17, 18, 20, 21, 28, 30)**:
  - MTN/Airtel USSD template rendering verified (Criteria 5, 9).
  - Claim submission, validation, and version increment verified (Criteria 10, 13).
  - Status display for all statuses, especially `needs_clarification`, `approved`, `rejected`, `expired`, and `cancelled` (Criteria 14, 17, 18).
  - Resubmit mutation correctly passes `expectedClaimVersion` and version conflicts trigger a refetch (Criteria 15, 16).
  - Approved status displays success state, but leaves entitlement authority entirely to the backend query (Criteria 20).
  - Telemetry privacy verified, masking sensitive values and preventing raw logs (Criteria 21).
  - Local prototype data stays stored in local secure storage, not uploaded (Criteria 28).
