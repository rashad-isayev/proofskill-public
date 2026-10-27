export const hiringDDL = `
CREATE TABLE IF NOT EXISTS proofskill_hiring_request (owner_id text NOT NULL, request_id text NOT NULL, operation text NOT NULL, input_hash text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(owner_id,request_id));
CREATE TABLE IF NOT EXISTS proofskill_hiring_assessment (id text PRIMARY KEY,owner_id text NOT NULL,lineage_id text NOT NULL,version integer NOT NULL,payload jsonb NOT NULL,UNIQUE(lineage_id,version));
CREATE INDEX IF NOT EXISTS proofskill_hiring_assessment_owner ON proofskill_hiring_assessment(owner_id);
CREATE TABLE IF NOT EXISTS proofskill_hiring_invite (id text PRIMARY KEY,assessment_id text NOT NULL REFERENCES proofskill_hiring_assessment(id),token_hash text NOT NULL UNIQUE,payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS proofskill_hiring_session (id text PRIMARY KEY,invite_id text NOT NULL UNIQUE REFERENCES proofskill_hiring_invite(id),payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS proofskill_hiring_report (id text PRIMARY KEY,session_id text NOT NULL UNIQUE REFERENCES proofskill_hiring_session(id),assessment_id text NOT NULL REFERENCES proofskill_hiring_assessment(id),payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS proofskill_hiring_invite_assessment ON proofskill_hiring_invite(assessment_id);
CREATE INDEX IF NOT EXISTS proofskill_hiring_report_assessment ON proofskill_hiring_report(assessment_id);
CREATE TABLE IF NOT EXISTS proofskill_monitoring_state (
 invite_id text PRIMARY KEY REFERENCES proofskill_hiring_invite(id) ON DELETE CASCADE,
 policy_version integer NOT NULL, consent boolean NOT NULL DEFAULT false,
 consent_at timestamptz, ready_until timestamptz,
 warnings integer NOT NULL DEFAULT 0 CHECK(warnings BETWEEN 0 AND 3),
 disqualified boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS proofskill_monitoring_event (
 invite_id text NOT NULL REFERENCES proofskill_hiring_invite(id) ON DELETE CASCADE,
 id uuid NOT NULL, kind text NOT NULL, occurred_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(invite_id,id)
);
CREATE TABLE IF NOT EXISTS proofskill_monitoring_consent (
 id bigserial PRIMARY KEY, invite_id text NOT NULL REFERENCES proofskill_hiring_invite(id) ON DELETE CASCADE,
 policy_version integer NOT NULL, accepted boolean NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS proofskill_ai_budget (
 bucket text NOT NULL, window_start timestamptz NOT NULL,
 calls integer NOT NULL CHECK(calls>0), PRIMARY KEY(bucket,window_start)
);
CREATE INDEX IF NOT EXISTS proofskill_ai_budget_window ON proofskill_ai_budget(window_start);
CREATE TABLE IF NOT EXISTS proofskill_ai_lease (
 id uuid PRIMARY KEY, group_key text NOT NULL, scope_key text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS proofskill_ai_lease_expiry ON proofskill_ai_lease(group_key,expires_at);
`;
