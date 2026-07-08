/**
 * @freelayer/ai — local AI adapter interfaces. NO AI CODE, BY POLICY.
 *
 * Implementation is blocked by the AI implementation gate (docs/LOCAL_AI.md,
 * Gate I, ADR-0007). No runtime dependencies, no external APIs, no
 * embeddings, no summaries, no document Q&A, no semantic search, no cache,
 * no model downloader.
 *
 * Standing rules encoded here: AI is disabled by default and unavailable in
 * Ghost/Bunker; outputs are suggestions until human-confirmed; no cross-room
 * context; AI caches inherit the strictest source policy.
 */

import type { PolicyDecision } from "@freelayer/privacy";

/** Tasks local AI may eventually perform (docs/LOCAL_AI.md goals). */
export type AITask =
  | "room_summary"
  | "task_extraction"
  | "decision_extraction"
  | "document_qa"
  | "semantic_search"
  | "privacy_risk_explanation";

/**
 * AI-specific decision wrapper: the base PolicyDecision must carry the
 * "localAI" capability. The AI Privacy Guard (Gate I) will own this check.
 */
export interface AIPolicyDecision {
  readonly base: PolicyDecision;
  readonly roomScopeOnly: true;
}

export interface AIRequest {
  readonly task: AITask;
  /** Single-room scope — cross-room context is forbidden without a future ADR. */
  readonly roomScope: string;
}

/** Provenance travels with every output — outputs are labeled, never anonymous. */
export interface AIProvenance {
  readonly modelId: string;
  readonly sourceRoom: string;
  readonly createdAtLocalMs: number;
  readonly aiGenerated: true;
}

/** Outputs are suggestions. `humanConfirmed` is literally false at creation. */
export interface AIOutput {
  readonly provenance: AIProvenance;
  readonly suggestion: string;
  readonly humanConfirmed: false;
}

/** Cache rule is a single-value type: there is exactly one lawful behavior (ADR-0005). */
export type AICachePolicy = "inherit_strictest_source";

/** Adapter over a future local runtime (llama.cpp-class, ONNX, …). Gate I research. */
export interface AIModelAdapter {
  readonly modelId: string;
  infer(request: AIRequest, decision: AIPolicyDecision): Promise<AIOutput>;
}

export interface AIProvider {
  run(request: AIRequest, decision: AIPolicyDecision): Promise<AIOutput>;
}

const AI_DISABLED = "Local AI is disabled by default and not implemented yet.";

/** The only provider that exists today. Always rejects. */
export class DisabledAIProvider implements AIProvider {
  run(_request: AIRequest, _decision: AIPolicyDecision): Promise<AIOutput> {
    return Promise.reject(new Error(AI_DISABLED));
  }
}
