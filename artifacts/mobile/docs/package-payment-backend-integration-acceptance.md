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
