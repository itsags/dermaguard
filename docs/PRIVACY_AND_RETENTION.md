# Privacy and retention

DermaGuard stores private cases, observations, profile metadata, and private image objects under authenticated ownership rules. The browser never receives the Supabase service-role key.

Users can delete observations and cases from the UI; associated photo objects are removed before the database row is deleted. Record export contains written records and photo paths, not photo bytes. Avoid putting names, faces, or other identifiers into test images.

Before production, define a jurisdiction-specific retention period, account deletion process, backup deletion behavior, access logging, incident response, and user-facing privacy notice.
