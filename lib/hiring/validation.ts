import { HiringError } from "./error";
import {
  BlueprintSchema,
  type Blueprint,
  type Session,
  type TurnResult,
  type Evaluation,
} from "@/lib/hiring/internal-contracts";
export function validateBlueprint(value: unknown): Blueprint {
  const b = BlueprintSchema.parse(value);
  const ids = b.competencies.map((c) => c.id);
  if (
    new Set(ids).size !== ids.length ||
    Math.abs(b.competencies.reduce((sum, c) => sum + c.weight, 0) - 1) >
      0.000001
  )
    throw new HiringError(
      "Competency IDs must be unique and weights must sum to 1.",
      400,
    );
  if (new Set(b.families.map((f) => f.id)).size !== b.families.length)
    throw new HiringError("Scenario families must have unique IDs.", 400);
  const difficulty = JSON.stringify(b.families[0].difficulty);
  for (const f of b.families) {
    if (
      JSON.stringify(f.difficulty) !== difficulty ||
      ids.some((id) => !f.competencyIds.includes(id))
    )
      throw new HiringError(
        "Every family must target the same competencies and difficulty parameters.",
        400,
      );
    if (!Object.keys(f.ranges).length || Object.keys(f.ranges).length > 24)
      throw new HiringError(
        "Define between one and twenty-four base metric ranges.",
        400,
      );
    if (
      Object.keys(f.ranges).sort().join("|") !==
      Object.keys(b.families[0].ranges).sort().join("|")
    )
      throw new HiringError(
        "Comparable families must use the same metric names.",
        400,
      );
    for (const range of Object.values(f.ranges))
      if (range[0] > range[1])
        throw new HiringError("Invalid metric range.", 400);
  }
  return b;
}
const round = (n: number) => Math.round(n * 100) / 100;
export function computeMetrics(
  visitors: number,
  orders: number,
  spend: number,
  orderValue: number,
) {
  if (
    !Number.isInteger(visitors) ||
    !Number.isInteger(orders) ||
    visitors <= 0 ||
    orders <= 0 ||
    orders > visitors ||
    spend <= 0 ||
    orderValue <= 0
  )
    throw new HiringError("Invalid metric inputs.", 400);
  const revenue = orders * orderValue;
  return {
    visitors,
    orders,
    spend,
    orderValue,
    revenue,
    cvr: round((orders / visitors) * 100),
    cac: round(spend / orders),
    roas: round(revenue / spend),
    contribution: round(revenue - spend),
  };
}
export function validateMetrics<T extends Record<string, number>>(f: T) {
  const expected = computeMetrics(f.visitors, f.orders, f.spend, f.orderValue);
  if (
    Object.keys(expected).some(
      (k) => expected[k as keyof typeof expected] !== f[k as keyof typeof f],
    )
  )
    throw new HiringError("Derived metrics do not match base inputs.", 400);
  return f;
}
export function deriveScenarioMetrics(
  base: Record<string, number>,
): Record<string, number> {
  if (Object.values(base).some((v) => !Number.isFinite(v) || v < 0))
    throw new HiringError("Metrics must be finite and nonnegative.", 400);
  const facts = { ...base };
  if (facts.visitors !== undefined && facts.orders !== undefined) {
    if (facts.visitors <= 0 || facts.orders > facts.visitors)
      throw new HiringError("Orders must fit the visitor population.", 400);
    facts.cvr = round((facts.orders / facts.visitors) * 100);
  }
  if (facts.orders !== undefined && facts.orderValue !== undefined)
    facts.revenue = round(facts.orders * facts.orderValue);
  if (facts.spend !== undefined && facts.orders !== undefined) {
    if (facts.orders <= 0)
      throw new HiringError("Cannot calculate CAC without orders.", 400);
    facts.cac = round(facts.spend / facts.orders);
  }
  if (facts.revenue !== undefined && facts.spend !== undefined) {
    if (facts.spend <= 0)
      throw new HiringError("Cannot calculate ROAS without spend.", 400);
    facts.roas = round(facts.revenue / facts.spend);
    facts.contribution = round(facts.revenue - facts.spend);
  }
  if (facts.revenue !== undefined && facts.cost !== undefined) {
    if (facts.revenue <= 0)
      throw new HiringError("Cannot calculate margin without revenue.", 400);
    facts.margin = round(((facts.revenue - facts.cost) / facts.revenue) * 100);
  }
  for (const k of ["cvr", "revenue", "cac", "roas", "contribution", "margin"])
    if (k in base && facts[k] !== base[k])
      throw new HiringError(
        "Derived metrics must match their base values.",
        400,
      );
  return facts;
}
export function seededNumbers(
  seed: string,
  family: Blueprint["families"][number],
) {
  let state = 2166136261;
  for (const c of seed)
    state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  const choose = (range: readonly number[]) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return range[0] + (state % (range[1] - range[0] + 1));
  };
  const base: Record<string, number> = {};
  for (const [key, range] of Object.entries(family.ranges)) {
    base[key] =
      Number.isInteger(range[0]) && Number.isInteger(range[1])
        ? choose(range)
        : Math.min(
            range[1],
            Math.max(
              range[0],
              Math.round(
                (range[0] +
                  (choose([0, 1000000]) / 1000000) * (range[1] - range[0])) *
                  1000000,
              ) / 1000000,
            ),
          );
  }
  if (
    ["visitors", "conversionBps", "spend", "orderValue"].every((k) => k in base)
  ) {
    return {
      ...base,
      ...validateMetrics(
        computeMetrics(
          base.visitors,
          Math.max(1, Math.floor((base.visitors * base.conversionBps) / 10000)),
          base.spend,
          base.orderValue,
        ),
      ),
    };
  }
  return deriveScenarioMetrics(base);
}
export function familyIndex(seed: string, count: number) {
  return (
    [...seed].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % count
  );
}
export function candidateSafe(session: Session) {
  return {
    id: session.id,
    status: session.status,
    draft: session.draft,
    turns: session.turns,
    maxTurns: 6,
    startedAt: session.startedAt,
    deadline: session.deadline,
    completedAt: session.completedAt,
    demo: session.demo,
    world: {
      company: session.world.company,
      role: session.world.role,
      context: session.world.context,
      facts: session.world.facts,
      events: session.world.events,
      tools: session.world.tools,
    },
    messages: session.messages,
    revealedInfo: session.revealedInfo,
    revealedDates: session.revealedDates ?? [],
    eventMetadata: session.world.eventMetadata ?? [],
  };
}
export type CandidateSession = ReturnType<typeof candidateSafe>;
// Treat grouped thousands as one numeric literal, rather than unrelated fragments.
function numericLiterals(text: string) {
  return (text.match(/-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g) ?? []).map(
    (token) => Number(token.replaceAll(",", "")),
  );
}
export function validateTurn(result: TurnResult, s: Session) {
  if (
    s.messages.some(
      (m) =>
        m.role === "manager" &&
        m.text.trim().toLowerCase() === result.reply.trim().toLowerCase(),
    )
  )
    throw new HiringError("Do not repeat a previous manager message.", 400);
  if (
    /(?:your score|you scored|hire this candidate|reject this candidate|rubric level|system prompt)/i.test(
      result.reply,
    )
  )
    throw new HiringError(
      "Candidate-facing replies cannot disclose scoring or private instructions.",
      400,
    );
  // Defense in depth: reject verbatim private rubric material even if a model
  // invents or an untrusted message supplies it. Context isolation is the main boundary.
  const publicText = [
    result.reply,
    ...(result.revealedInfo ?? []).map((info) => info.title),
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ");
  for (const competency of s.blueprint.competencies)
    for (const anchor of Object.values(competency.rubric)) {
      const privateText = anchor.toLowerCase().replace(/\s+/g, " ").trim();
      if (privateText.length >= 24 && publicText.includes(privateText))
        throw new HiringError(
          "Public text contains private assessment material.",
          400,
        );
    }
  const allowedNumbers = new Set(
    Object.values({ ...s.world.facts, ...s.world.hiddenFacts }).filter(
      (v): v is number => typeof v === "number",
    ),
  );
  for (let i = 0; i <= 6; i++) allowedNumbers.add(i);
  for (const m of s.messages.filter((m) => m.role === "candidate"))
    for (const value of numericLiterals(m.text)) allowedNumbers.add(value);
  for (const value of numericLiterals(result.reply))
    if (!allowedNumbers.has(value))
      throw new HiringError(
        "Manager reply contains an unsupported number.",
        400,
      );
  return validateTurnSelection(result, s);
}
export function validateTurnSelection<
  T extends Pick<
    TurnResult,
    "evidence" | "nextObjective" | "revealedInfo" | "newEvents"
  >,
>(result: T, s: Session): T {
  const candidates = s.messages.filter((m) => m.role === "candidate");
  for (const e of result.evidence)
    if (
      !s.blueprint.competencies.some((c) => c.id === e.competencyId) ||
      !candidates.some((m) => m.text.includes(e.quote))
    )
      throw new HiringError("Evidence must quote the candidate verbatim.", 400);
  if (!s.blueprint.competencies.some((c) => c.id === result.nextObjective))
    throw new HiringError("Unknown objective.", 400);
  const facts = { ...s.world.facts, ...s.world.hiddenFacts };
  for (const info of result.revealedInfo ?? [])
    for (const [key, val] of Object.entries(info.data))
      if (facts[key] !== val || key.startsWith("event_"))
        throw new HiringError(
          "Revealed facts must match stored keys and values.",
          400,
        );
  // Consequences are immutable, pre-established world facts; model cannot rewrite them.
  const allowed = Object.entries(s.world.hiddenFacts)
    .filter(([key]) => key.startsWith("event_"))
    .map(([, v]) => v);
  for (const event of result.newEvents ?? [])
    if (!allowed.includes(event) || s.world.events.includes(event))
      throw new HiringError(
        "Event must be an unused stored complication.",
        400,
      );
  return result;
}
export function shouldEnd(s: Session) {
  return (
    s.turns >= 6 ||
    Date.now() >= Date.parse(s.deadline) ||
    (s.turns >= 4 &&
      s.blueprint.competencies.every((c) =>
        s.evidence.some((e) => e.competencyId === c.id),
      ))
  );
}
export function validateEvaluation(e: Evaluation, s: Session) {
  const ids = s.blueprint.competencies.map((c) => c.id);
  if (
    e.ratings.length !== ids.length ||
    new Set(e.ratings.map((r) => r.competencyId)).size !== ids.length
  )
    throw new HiringError(
      "Evaluation must cover each locked competency once.",
      400,
    );
  for (const r of e.ratings) {
    if (!ids.includes(r.competencyId))
      throw new HiringError("Unknown competency.", 400);
    const evidence = s.evidence.filter(
      (x) => x.competencyId === r.competencyId,
    );
    for (const q of r.quotes)
      if (
        !evidence.some((x) => x.quote === q) ||
        !s.messages.some((m) => m.role === "candidate" && m.text.includes(q))
      )
        throw new HiringError(
          "Evaluation quote was not collected for this competency.",
          400,
        );
    if (!evidence.length || !r.quotes.length) {
      r.score = null;
      r.sufficiency = "insufficient";
      r.quotes = [];
    }
    if (r.score === null) r.sufficiency = "insufficient";
    else if (r.sufficiency === "insufficient")
      throw new HiringError("Scored evidence cannot be insufficient.", 400);
  }
  return e;
}
export function weightedScore(e: Evaluation, b: Blueprint) {
  let total = 0,
    covered = 0;
  for (const c of b.competencies) {
    const r = e.ratings.find((r) => r.competencyId === c.id);
    if (r?.score != null) {
      covered += c.weight;
      total += r.score * c.weight;
    }
  }
  return {
    overallScore: covered ? round(total / covered) : null,
    coverage: round(covered * 100),
    untestedCompetencies: b.competencies
      .filter(
        (c) => e.ratings.find((r) => r.competencyId === c.id)?.score == null,
      )
      .map((c) => c.id),
  };
}
