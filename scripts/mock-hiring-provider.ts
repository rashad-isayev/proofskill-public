// Browser-test provider only. Never imported by runtime routes or used as an AI fallback.
import { createServer } from "node:http";
import { demoBlueprint } from "../tests/fixtures/hiring-data";
import type { Session } from "../lib/hiring/internal-contracts";
createServer(async (req, res) => {
  if (req.url === "/health") {
    res.end("ok");
    return;
  }
  let text = "";
  for await (const chunk of req) text += chunk;
  try {
    const input = JSON.parse(text);
    const name = JSON.parse(input.messages[1].content).operation;
    const data = JSON.parse(input.messages[1].content).untrustedTaskData;
    if (
      ["turn_analysis", "manager_reply"].includes(name) &&
      data.history.at(-1).text.includes("FORCE_FAILURE")
    ) {
      res.writeHead(503);
      res.end("{}");
      return;
    }
    let output: unknown;
    if (name === "blueprint")
      output = {
        ...demoBlueprint,
        title: data.title,
        seniority: data.seniority,
        description: data.description,
        durationMinutes: data.durationMinutes,
      };
    else if (name === "scenario")
      output = {
        company:
          "Fixture Company " +
          [...data.seed]
            .map((c: string) =>
              /\d/.test(c) ? String.fromCharCode(65 + Number(c)) : c,
            )
            .join(""),
        context:
          "A fictional business is investigating its current campaign performance. Review the available data before proposing an intervention.",
        opening:
          "Please inspect the business facts and propose your first action.",
        hiddenInformation: Array.from(
          {
            length: (data.family as { difficulty: { hiddenFacts: number } })
              .difficulty.hiddenFacts,
          },
          (_, i) =>
            i === 0
              ? "Analytics tracking needs reconciliation before interpreting causality."
              : "Acquisition channel mix changed during the observation window.",
        ),
        complications: Array.from(
          {
            length: (data.family as { difficulty: { complications: number } })
              .difficulty.complications,
          },
          (_, i) =>
            i === 0
              ? "Finance requests a plan using the current budget before approving additional spend."
              : "The product team needs a prioritized investigation before allocating engineering time.",
        ),
      };
    else if (name === "turn_analysis") {
      const latest = data.history
        .filter((m: Session["messages"][number]) => m.role === "candidate")
        .at(-1);
      const turn = latest.turn;
      output = {
        revealedKeys: latest.text.toLowerCase().includes("investigat")
          ? ["investigation_1"]
          : [],
        eventKeys: turn === 2 ? ["event_1"] : [],
        evidence: [
          {
            competencyId: data.competencies[(turn - 1) % 4].id,
            quote: latest.text,
            note: "Fixture evidence for browser integration testing.",
          },
        ],
        nextObjective: data.competencies[turn % 4].id,
      };
    } else if (name === "manager_reply") {
      const latest = data.history
        .filter((m: Session["messages"][number]) => m.role === "candidate")
        .at(-1);
      output = {
        reply:
          (latest.text.includes("budget")
            ? "What evidence supports increasing spend before investigating the cause?"
            : "What diagnostic information would distinguish your hypothesis from an alternative?") +
          " Consider your " +
          ["first", "second", "third", "fourth", "fifth", "sixth"][
            latest.turn - 1
          ] +
          " decision.",
      };
    } else if (name === "evaluation")
      output = {
        ratings: data.rubric.map(
          (c: Session["blueprint"]["competencies"][number]) => ({
            competencyId: c.id,
            score: data.evidence.some(
              (e: Session["evidence"][number]) => e.competencyId === c.id,
            )
              ? 3
              : null,
            quotes: data.evidence
              .filter(
                (e: Session["evidence"][number]) => e.competencyId === c.id,
              )
              .map((e: Session["evidence"][number]) => e.quote),
            sufficiency: data.evidence.some(
              (e: Session["evidence"][number]) => e.competencyId === c.id,
            )
              ? "supported"
              : "insufficient",
            rationale: "Fixture-only assessment; not a live AI judgment.",
          }),
        ),
        strengths: ["Explains a decision"],
        weaknesses: [],
        reasoningMistakes: [],
        contradictions: [],
        followUpTopics: ["Ask for a measurement plan"],
        uncertainty: "high",
      };
    else throw new Error("Unknown operation");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(output) } }],
      }),
    );
  } catch {
    res.writeHead(400);
    res.end("{}");
  }
}).listen(4105, "127.0.0.1");
