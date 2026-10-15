// This journey covers exactly three member tasks: first chapter, profile, leaderboard.
export type WalkthroughStep =
  | "start"
  | "work"
  | "chapter"
  | "specialty"
  | "save"
  | "profile"
  | "leaderboard"
  | "finish"
  | "done";
export type WalkthroughAction =
  | "registration-opened"
  | "work-selected"
  | "chapter-entered"
  | "specialty-selected"
  | "registration-succeeded"
  | "profile-opened"
  | "leaderboard-opened"
  | "dismiss";
const registrationSteps: WalkthroughStep[] = [
  "start",
  "work",
  "chapter",
  "specialty",
  "save",
];
export function walkthroughKey(owner: string) {
  return `cookies:onboarding:v2:${encodeURIComponent(owner)}`;
}
export function walkthroughCheckpoint(step: WalkthroughStep): WalkthroughStep {
  // A registration form is temporary. After reopening, point to its entry again.
  return registrationSteps.includes(step)
    ? "start"
    : step === "finish"
      ? "done"
      : step;
}
export function readWalkthrough(raw: string | null): WalkthroughStep {
  return raw === "profile" || raw === "leaderboard" || raw === "done"
    ? raw
    : "start";
}
export function walkthroughNext(
  step: WalkthroughStep,
  action: WalkthroughAction,
): WalkthroughStep {
  if (step === "done") return step;
  if (action === "dismiss") return "done";
  if (action === "registration-opened" && registrationSteps.includes(step))
    return "work";
  if (action === "work-selected" && registrationSteps.includes(step))
    return "chapter";
  if (action === "chapter-entered" && step === "chapter") return "specialty";
  if (
    action === "specialty-selected" &&
    (step === "specialty" || step === "chapter")
  )
    return "save";
  if (action === "registration-succeeded" && registrationSteps.includes(step))
    return "profile";
  if (action === "profile-opened" && step === "profile") return "leaderboard";
  if (action === "leaderboard-opened" && step === "leaderboard")
    return "finish";
  return step;
}
export function walkthroughMatches(
  current: WalkthroughStep | null,
  target: WalkthroughStep,
) {
  // Returning from an unfinished form keeps the starting button discoverable.
  return (
    current === target ||
    (target === "start" &&
      current !== null &&
      registrationSteps.includes(current))
  );
}
