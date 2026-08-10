export type A1CBand =
  | "below_prediabetes_range"
  | "prediabetes_57_59"
  | "prediabetes_60_62"
  | "prediabetes_63_64"
  | "diabetes_range_out_of_scope";

export type A1CRoute =
  | {
      kind: "out_of_scope";
      responseKind: "out_of_scope_below";
      band: "below_prediabetes_range";
      conservativeLevel: null;
    }
  | {
      kind: "in_scope";
      responseKind: "in_scope";
      band: "prediabetes_57_59";
      conservativeLevel: "standard";
    }
  | {
      kind: "in_scope";
      responseKind: "in_scope";
      band: "prediabetes_60_62";
      conservativeLevel: "elevated";
    }
  | {
      kind: "in_scope";
      responseKind: "in_scope";
      band: "prediabetes_63_64";
      conservativeLevel: "high";
    }
  | {
      kind: "out_of_scope";
      responseKind: "out_of_scope_high";
      band: "diabetes_range_out_of_scope";
      conservativeLevel: null;
    };

export function routeA1C(a1c: number): A1CRoute {
  if (a1c < 5.7) {
    return {
      kind: "out_of_scope",
      responseKind: "out_of_scope_below",
      band: "below_prediabetes_range",
      conservativeLevel: null
    };
  }

  if (a1c < 6.0) {
    return {
      kind: "in_scope",
      responseKind: "in_scope",
      band: "prediabetes_57_59",
      conservativeLevel: "standard"
    };
  }

  if (a1c < 6.3) {
    return {
      kind: "in_scope",
      responseKind: "in_scope",
      band: "prediabetes_60_62",
      conservativeLevel: "elevated"
    };
  }

  if (a1c < 6.5) {
    return {
      kind: "in_scope",
      responseKind: "in_scope",
      band: "prediabetes_63_64",
      conservativeLevel: "high"
    };
  }

  return {
    kind: "out_of_scope",
    responseKind: "out_of_scope_high",
    band: "diabetes_range_out_of_scope",
    conservativeLevel: null
  };
}
