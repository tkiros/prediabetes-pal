import { describe, expect, it } from "vitest";

import {
  EXPECTED_ROUTES,
  STRATUM_TARGETS,
  validateClosure,
  validateEngineeringPacket
} from "../../../scripts/validate-dietitian-review.mjs";

function reviewer(id: string, credentials: string[]) {
  return {
    id,
    name: `External reviewer ${id}`,
    credentials,
    credentialRegistry: `registry-record-${id}`,
    credentialVerifiedAt: "2026-07-12",
    conflictDisclosure: "No conflict declared.",
    signedAt: "2026-07-12"
  };
}

function completePanel() {
  const reviewers = [
    reviewer("reviewer-a", ["RDN", "CDCES"]),
    reviewer("reviewer-b", ["RDN"]),
    reviewer("reviewer-c", ["RDN"])
  ];
  const caseReviews: unknown[] = [];
  let ordinal = 0;

  for (const [stratum, count] of Object.entries(STRATUM_TARGETS)) {
    for (let index = 0; index < count; index += 1) {
      ordinal += 1;
      const caseId = `case-${String(ordinal).padStart(3, "0")}`;
      for (const reviewerRecord of reviewers) {
        caseReviews.push({
          caseId,
          stratum,
          reviewerId: reviewerRecord.id,
          acceptableRisks: ["MODERATE"],
          dangerousOutputs: [],
          requiredClinicalRoute: null,
          minimumClarification: null,
          rationale: "Independent reviewer rationale.",
          sourceIds: ["reviewer-source"],
          adjustmentSafe: true,
          adjustmentFeasible: true,
          generic: false,
          nonShaming: true,
          confidence: "high",
          comments: null
        });
      }
    }
  }

  return {
    reviewers,
    caseReviews,
    clinicalCopyApprovals: EXPECTED_ROUTES.map((route) => ({
      route,
      status: "approved",
      reviewerId: "reviewer-a",
      signedAt: "2026-07-12"
    })),
    carbForwardOntologyApproval: {
      status: "approved",
      reviewerId: "reviewer-a",
      signedAt: "2026-07-12"
    },
    panelVotes: reviewers.map((reviewerRecord) => ({
      reviewerId: reviewerRecord.id,
      vote: "approve",
      signedAt: "2026-07-12"
    })),
    adjudicationLog: [],
    summary: {
      dangerousFalseReassurance: 0,
      medicalRoutingRate: 1,
      directionAgreement: 0.85,
      safeFeasibleAdjustmentRate: 0.9,
      genericRate: 0.14,
      nonShamingRate: 0.95,
      harmfulEatingDisorderResponses: 0,
      subgroupGatesPassed: true
    }
  };
}

describe("dietitian review closure gate", () => {
  it("validates the checked-in engineering packet without pretending it is signed", () => {
    const result = validateEngineeringPacket(process.cwd());
    expect(result.errors).toEqual([]);
    expect(result.summary.clinicalCases).toBeGreaterThanOrEqual(40);
    expect(result.summary.clinicalApprovalStatus).toBe("pending_external_panel");
  });

  it("fails closed on the unsigned placeholder", () => {
    const result = validateClosure(
      {
        reviewers: [],
        caseReviews: [],
        clinicalCopyApprovals: [],
        carbForwardOntologyApproval: null,
        panelVotes: [],
        summary: {}
      },
      { clinicalApprovalStatus: "pending_external_panel" }
    );

    expect(result.errors.length).toBeGreaterThan(10);
    expect(result.errors.join("\n")).toMatch(/240 unique reviewed cases/);
    expect(result.errors.join("\n")).toMatch(/RDN\/CDCES approval/);
  });

  it("accepts only a complete three-reviewer, 240-case, all-gates-pass artifact", () => {
    const result = validateClosure(completePanel(), {
      clinicalApprovalStatus: "approved_external_panel"
    });

    expect(result.errors).toEqual([]);
    expect(result.summary).toEqual({
      reviewers: 3,
      uniqueCases: 240,
      reviewRows: 720
    });
  });

  it("does not convert a conditional panel vote into approval", () => {
    const panel = completePanel();
    panel.panelVotes[0].vote = "approve_with_conditions";

    const result = validateClosure(panel, {
      clinicalApprovalStatus: "approved_external_panel"
    });

    expect(result.errors.join("\n")).toMatch(/unconditional signed approve/);
  });
});
