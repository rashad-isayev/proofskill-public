export type LabTask = {
  id: string;
  title: string;
  instructions: string;
  kind: "text" | "code";
  starter?: string;
  minLength: number;
  maxLength: number;
};

export type LabDefinition = {
  id: string;
  version: string;
  careerId: string;
  title: string;
  description: string;
  brief: string;
  mode: "walkthrough" | "assessment";
  estimatedMinutes: number;
  skills: string[];
  artifacts: { id: string; title: string; content: string; kind: "document" | "code" }[];
  tasks: LabTask[];
  rubric: { skill: string; criteria: string }[];
};

export type LabAttempt = {
  schemaVersion: 1;
  id: string;
  labId: string;
  labVersion: string;
  applicationId?: string;
  status: "draft" | "submitted";
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  responses: Record<string, string>;
};

export function taskErrors(lab: LabDefinition, responses: Record<string, string>) {
  return Object.fromEntries(lab.tasks.flatMap(task => {
    const value = responses[task.id] ?? "";
    if (value.trim().length < task.minLength) return [[task.id, `Write at least ${task.minLength} characters.`]];
    if (value.length > task.maxLength) return [[task.id, `Keep your response within ${task.maxLength} characters.`]];
    return [];
  }));
}

export function createAttempt(lab: LabDefinition): LabAttempt {
  const now = new Date().toISOString();
  return { schemaVersion: 1, id: crypto.randomUUID(), labId: lab.id, labVersion: lab.version, status: "draft", createdAt: now, updatedAt: now, responses: Object.fromEntries(lab.tasks.map(task => [task.id, task.starter ?? ""])) };
}

export function submitAttempt(lab: LabDefinition, attempt: LabAttempt): LabAttempt {
  if (attempt.labId !== lab.id || attempt.labVersion !== lab.version) throw new Error("This attempt uses a different lab version.");
  if (attempt.status !== "draft") throw new Error("This attempt has already been submitted.");
  if (Object.keys(taskErrors(lab, attempt.responses)).length) throw new Error("Complete every task before submitting.");
  const now = new Date().toISOString();
  return { ...attempt, status: "submitted", updatedAt: now, submittedAt: now };
}

export function isLabAttempt(value: unknown): value is LabAttempt {
  if (!value || typeof value !== "object") return false;
  const a = value as Partial<LabAttempt>;
  return a.schemaVersion === 1 && typeof a.id === "string" && typeof a.labId === "string" && typeof a.labVersion === "string" &&
    (a.status === "draft" || a.status === "submitted") && typeof a.createdAt === "string" && !Number.isNaN(Date.parse(a.createdAt)) &&
    typeof a.updatedAt === "string" && !Number.isNaN(Date.parse(a.updatedAt)) &&
    (a.applicationId === undefined || typeof a.applicationId === "string") &&
    (a.status !== "submitted" || (typeof a.submittedAt === "string" && !Number.isNaN(Date.parse(a.submittedAt)))) &&
    !!a.responses && typeof a.responses === "object" && !Array.isArray(a.responses) && Object.values(a.responses).every(v => typeof v === "string" && v.length <= 20000);
}
