// Additive migration: existing invitations, reports and sessions stay intact.
export const candidateDDL = `
CREATE TABLE IF NOT EXISTS proofskill_candidate (
 id text PRIMARY KEY, owner_id text NOT NULL, name text NOT NULL, email text NOT NULL,
 position text NOT NULL DEFAULT '', decision text NOT NULL DEFAULT 'pending-review'
 CHECK(decision IN ('pending-review','selected','rejected','deferred','follow-up-required')),
 revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,email)
);
CREATE INDEX IF NOT EXISTS proofskill_candidate_owner ON proofskill_candidate(owner_id);
CREATE TABLE IF NOT EXISTS proofskill_candidate_assignment (
 id text PRIMARY KEY, candidate_id text NOT NULL REFERENCES proofskill_candidate(id),
 assessment_id text NOT NULL REFERENCES proofskill_hiring_assessment(id),
 invite_id text NOT NULL UNIQUE REFERENCES proofskill_hiring_invite(id), invite_request_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proofskill_candidate_assignment_candidate ON proofskill_candidate_assignment(candidate_id);
INSERT INTO proofskill_candidate(id,owner_id,name,email,position,created_at,updated_at)
 SELECT gen_random_uuid()::text,owner_id,candidate_name,email,position,created_at,created_at FROM (
 SELECT DISTINCT ON(a.owner_id,lower(trim(i.payload->>'candidateEmail')))
 a.owner_id,i.payload->>'candidateName' AS candidate_name,
 lower(trim(i.payload->>'candidateEmail')) AS email,
 a.payload->'blueprint'->>'title' AS position,
 (i.payload->>'createdAt')::timestamptz AS created_at
 FROM proofskill_hiring_invite i JOIN proofskill_hiring_assessment a ON a.id=i.assessment_id
 WHERE COALESCE((i.payload->>'demo')::boolean,false)=false
 ORDER BY a.owner_id,lower(trim(i.payload->>'candidateEmail')),i.payload->>'createdAt'
 ) existing ON CONFLICT(owner_id,email) DO NOTHING;
INSERT INTO proofskill_candidate_assignment(id,candidate_id,assessment_id,invite_id,invite_request_id,created_at)
 SELECT gen_random_uuid()::text,c.id,a.id,i.id,
 (SELECT r.request_id FROM proofskill_hiring_request r WHERE r.owner_id=a.owner_id AND r.operation='invite' AND r.payload->>'id'=i.id LIMIT 1),
 (i.payload->>'createdAt')::timestamptz
 FROM proofskill_hiring_invite i JOIN proofskill_hiring_assessment a ON a.id=i.assessment_id
 JOIN proofskill_candidate c ON c.owner_id=a.owner_id AND c.email=lower(trim(i.payload->>'candidateEmail'))
 WHERE COALESCE((i.payload->>'demo')::boolean,false)=false
 ON CONFLICT(invite_id) DO NOTHING;
`;
