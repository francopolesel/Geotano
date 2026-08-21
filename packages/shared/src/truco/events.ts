// ---------------------------------------------------------------------------
// Truco Argentino — public event log (D4)
// ---------------------------------------------------------------------------
// The discriminated union itself lives in types.ts so TrucoState.history can
// be declared without an upward edge. This façade is the semantic home for
// event vocabulary consumed by UI call-feedback and backend push reasons.

export type {
  AnswerKind,
  AwardReason,
  BetKind,
  EnvidoCall,
  TrucoCall,
  TrucoEvent,
} from './types.js';
