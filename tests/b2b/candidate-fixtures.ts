import type { Candidate } from "../../lib/candidates/contracts";
import { assessment, date } from "./fixtures";
export const candidate: Candidate = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Demo Alex",
  email: "alex@example.test",
  position: "Marketing Analyst",
  decision: "pending-review",
  revision: 0,
  createdAt: date,
  updatedAt: date,
  assignments: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      assessmentId: assessment.id,
      assessmentVersion: 1,
      title: assessment.blueprint.roleTitle,
      progress: "completed",
      createdAt: date,
      startedAt: date,
      completedAt: date,
      lastActivity: date,
      reportId: "r1",
      invitePath: null,
    },
  ],
};
export const secondCandidate: Candidate = {
  ...candidate,
  id: "33333333-3333-4333-8333-333333333333",
  name: "Demo Sam",
  email: "sam@example.test",
  decision: "follow-up-required",
  assignments: [],
};
