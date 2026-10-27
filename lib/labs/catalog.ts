import type { LabDefinition } from "./contracts";

export const engineeringCareer = {
  id: "software-engineer",
  name: "Software Engineer",
  description: "A workspace for demonstrating engineering decisions, implementation, and communication.",
  skills: ["Problem solving", "Code quality", "Debugging", "Testing", "Technical communication", "Engineering judgment"],
};

// This fixture exercises the lab engine. It is not an agreed hiring assessment.
export const workspaceWalkthrough: LabDefinition = {
  id: "engineering-workspace",
  version: "walkthrough-1",
  careerId: engineeringCareer.id,
  title: "Explore your engineering workspace",
  description: "Try the tools, save your work, and submit an evidence package before real career scenarios are added.",
  brief: "Welcome to your Career Lab. This walkthrough introduces the workspace you will use for future engineering challenges. Inspect the resources, describe an approach, add a code example, and explain how you would verify your work. There is no score, time limit, or hiring decision attached to this walkthrough.",
  mode: "walkthrough",
  estimatedMinutes: 5,
  skills: ["Engineering judgment", "Code quality", "Testing", "Technical communication"],
  artifacts: [
    { id: "readme", title: "Workspace guide", kind: "document", content: "Your lab provides a brief, reference artifacts, tasks, and review criteria. Responses save in this browser. Review all tasks before submission. Submitted work becomes read-only; start a new attempt to make changes. Export a JSON evidence package to keep a portable copy." },
    { id: "reference", title: "Reference snippet · TypeScript", kind: "code", content: "export function normalizeLabel(value: string): string {\n  return value.trim();\n}\n\n// Reference material for the walkthrough.\n// Code entered in the workspace is saved as text, not executed." },
  ],
  tasks: [
    { id: "approach", title: "Describe your approach", kind: "text", instructions: "Describe how you normally approach an unfamiliar engineering task. Include how you clarify requirements and identify missing information.", minLength: 40, maxLength: 6000 },
    { id: "implementation", title: "Add an implementation", kind: "code", instructions: "Write or paste a small TypeScript example you would like to include in your evidence. You can use the reference snippet as a starting point. This editor stores code; it does not run it.", minLength: 20, maxLength: 20000 },
    { id: "verification", title: "Explain your verification", kind: "text", instructions: "Explain what you would test and how you would communicate the result to a teammate. Mention an edge case or limitation.", minLength: 40, maxLength: 6000 },
  ],
  rubric: [
    { skill: "Engineering judgment", criteria: "Explain assumptions, clarify requirements, and make decisions visible." },
    { skill: "Code quality", criteria: "Provide readable implementation evidence with an understandable intent." },
    { skill: "Testing", criteria: "Describe useful checks, edge cases, and expected results." },
    { skill: "Technical communication", criteria: "Explain what changed, why, and any remaining limitations." },
  ],
};

export const labs = [workspaceWalkthrough];
export function getLab(id: string) { return labs.find(lab => lab.id === id); }
