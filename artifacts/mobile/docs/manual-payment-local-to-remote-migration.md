# Manual Payment Local-to-Remote Migration

Local manual payment claims are a prototype artifact.

They may exist in AsyncStorage from MP5.

They are not trusted payment records.

## Classification

- `local_only_prototype`: current local claim created and managed entirely on-device
- `legacy_local_untrusted`: old local prototype data kept for history after remote authority is enabled
- `remote_backed`: future backend-authoritative claim

## Migration Rule

Local prototype claims must not automatically upload when remote package-payment authority becomes available.

Recommended policy:

- keep legacy local claims as historical data
- label them as untrusted local prototype records
- do not convert them into pending-review backend claims automatically
- do not activate packages or grant credits from legacy local claims
- do not merge local and remote claims as if they were the same authority source

## Backend Cutover

When the backend is ready:

- new claims should be created through the backend repository path
- backend claims should be authoritative for status, review, approval, and activation
- the frontend should treat local prototype data as separate from remote claims

## Duplicate Display Prevention

If local and remote claims coexist, the UI should not present them as the same record.
The read model should carry source authority so the UI can separate prototype history from backend records.
