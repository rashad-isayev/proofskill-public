export const recordingDDL = `
CREATE TABLE IF NOT EXISTS proofskill_recording (
 id uuid PRIMARY KEY, session_id text NOT NULL REFERENCES proofskill_hiring_session(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, source text NOT NULL CHECK(source IN ('camera','screen')),
 mime text NOT NULL, status text NOT NULL DEFAULT 'recording' CHECK(status IN ('recording','complete','interrupted')),
 consent_at timestamptz NOT NULL DEFAULT now(), consent_notice text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 finalized_at timestamptz, UNIQUE(session_id,request_id)
);
CREATE TABLE IF NOT EXISTS proofskill_recording_chunk (
 recording_id uuid NOT NULL REFERENCES proofskill_recording(id) ON DELETE CASCADE,
 sequence integer NOT NULL CHECK(sequence>=0 AND sequence<300),
 bytes integer NOT NULL CHECK(bytes>0 AND bytes<=8388608), sha256 text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(recording_id,sequence)
);
CREATE TABLE IF NOT EXISTS proofskill_recording_access (
 id bigserial PRIMARY KEY, recording_id uuid NOT NULL REFERENCES proofskill_recording(id) ON DELETE CASCADE,
 owner_id text NOT NULL, accessed_at timestamptz NOT NULL DEFAULT now()
);
`;
