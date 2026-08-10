import { SUPPORT_EMAIL } from "../../pal/contact";
/** Email copy in one place so webhook/sweep/admin never drift apart. */

export function intakeEmailText(
  appUrl: string,
  token: string
): { subject: string; text: string } {
  return {
    subject: "Your Pantry Review is paid for — let's set it up",
    text: [
      "Thanks — your Pantry Review is paid for.",
      "",
      "Set it up here (sign-in takes one tap, no password):",
      `${appUrl}/pantry/claim?token=${token}`,
      "",
      "You'll add photos of your pantry or typical meals, confirm what we",
      "saw, and get your report by email within 7 days.",
      "",
      `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`
    ].join("\n")
  };
}

export function reportEmailText(
  appUrl: string,
  orderId: string
): { subject: string; text: string } {
  return {
    subject: "Your Pantry Review is ready",
    text: [
      "Your Pantry Review is ready — starting with what you can enjoy freely.",
      "",
      `Read it here: ${appUrl}/report/${orderId}`,
      "",
      "It stays in your account, and the page prints cleanly if you want a",
      'paper copy ("Save as PDF").',
      "",
      `Questions? Reply to this email or write to ${SUPPORT_EMAIL}.`
    ].join("\n")
  };
}
