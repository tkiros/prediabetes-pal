/**
 * Task 3.3 — the 2-day pre-charge email. Transparency IS the feature: the
 * subject and body state the exact charge date and amount, and the body
 * carries a one-tap cancel link (no retention screens). Copy is tracked in
 * docs/safety/copy-ledger.md (`precharge-email`) and scanned by the
 * claims-boundary audit via COPY_FILES.
 */
/**
 * W-18 — the dunning email. A declined card used to ride Stripe's ~3-week
 * retry schedule in silence: premium stayed on, no revenue arrived, and the
 * first the user heard of it was the subscription vanishing. Same contract as
 * the pre-charge email — say exactly what happened, exactly when access ends,
 * and give one link that fixes it. No retention screens, no guilt.
 */
export function paymentFailedEmailText(
  appUrl: string,
  accessEndsText: string
): { subject: string; text: string } {
  return {
    subject: "Your Prediabetes Pal payment didn't go through",
    text: [
      "Your card was declined, so this month's payment didn't go through.",
      "",
      `Your access stays on until ${accessEndsText} while you sort it out. After that it pauses — nothing is deleted, and your history is waiting whenever you come back.`,
      "",
      `Update your card here: ${appUrl}/account`,
      "",
      "If you'd rather stop, you don't need to do anything at all.",
      "",
      "— Prediabetes Pal"
    ].join("\n")
  };
}

export function prechargeEmailText(
  appUrl: string,
  amountDisplay: string,
  chargeDateText: string,
  cancelToken: string
): { subject: string; text: string } {
  const cancelUrl = `${appUrl}/api/billing/cancel?token=${cancelToken}`;
  return {
    subject: "Your Prediabetes Pal trial ends in about 2 days",
    text: [
      "A heads-up, as promised:",
      "",
      `Your free week ends on ${chargeDateText}. If you do nothing, your card will be charged ${amountDisplay} starting that day.`,
      "",
      "Want to keep going? You don't need to do anything.",
      "",
      `Want to stop? One tap, no questions, no retention screens: ${cancelUrl}`,
      "",
      "You can also cancel any time from your account page:",
      `${appUrl}/account`,
      "",
      "— Prediabetes Pal"
    ].join("\n")
  };
}
