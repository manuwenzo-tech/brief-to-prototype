import { z } from "zod";

const id = z.string().regex(/^[a-z0-9-]{1,44}$/);
const title = z.string().trim().min(1).max(70);
const detail = z.string().trim().min(1).max(240);

export const screenSchema = z.object({
  id,
  title,
  detail,
  requirementIds: z.array(id).min(1).max(12),
  options: z.array(title).max(6),
  actions: z.array(z.object({ label: title, target: id })).max(4),
});
export const projectSchema = z.object({
  title,
  requirements: z.array(z.object({ id, title, detail })).min(1).max(12),
  screens: z.array(screenSchema).min(1).max(10),
}).superRefine(({ requirements, screens }, context) => {
  const requirementIds = new Set(requirements.map((requirement) => requirement.id));
  const screenIds = new Set(screens.map((screen) => screen.id));
  if (requirementIds.size !== requirements.length || screenIds.size !== screens.length) {
    context.addIssue({ code: "custom", message: "Screen and requirement IDs must be unique." });
  }
  const visited = new Set<string>();
  const byId = new Map(screens.map((screen) => [screen.id, screen]));
  const queue = [screens[0]?.id].filter(Boolean);
  for (const key of queue) {
    if (visited.has(key)) continue;
    visited.add(key);
    queue.push(...(byId.get(key)?.actions.map((action) => action.target) ?? []));
  }
  if (screens.some((screen) => !visited.has(screen.id)
    || screen.actions.some((action) => !screenIds.has(action.target))
    || screen.requirementIds.some((key) => !requirementIds.has(key)))) {
    context.addIssue({ code: "custom", message: "Every screen must be reachable and all references must resolve." });
  }
});
export const questionsSchema = z.object({ questions: z.array(detail).min(1).max(4) });
export type Project = z.infer<typeof projectSchema>;
export type Screen = z.infer<typeof screenSchema>;

export const sampleBrief = "Build a salon booking app where customers can choose a service, pick an available time and confirm their booking.";
const change = { id: "reschedule", title: "Allow rescheduling", detail: "Let customers pick a new time after confirming a booking." };
export const sampleProject: Project = {
  title: "Salon booking",
  requirements: [
    { id: "service", title: "Choose a service", detail: "Customers select the service they want to book." },
    { id: "time", title: "Pick a time", detail: "Customers choose one available appointment time." },
    { id: "confirm", title: "Confirm booking", detail: "Customers see a confirmation after making their choices." },
  ],
  screens: [
    { id: "service", title: "Choose service", detail: "What would you like to book?", requirementIds: ["service"], options: ["Haircut", "Blow-dry", "Consultation"], actions: [{ label: "Continue", target: "time" }] },
    { id: "time", title: "Pick a time", detail: "Choose an available appointment slot.", requirementIds: ["time"], options: ["10:00 AM", "11:30 AM", "2:00 PM"], actions: [{ label: "Confirm booking", target: "confirm" }] },
    { id: "confirm", title: "Confirm booking", detail: "You’re booked! Here’s a summary of your appointment.", requirementIds: ["confirm"], options: [], actions: [] },
  ],
};

export const sampleRevision: Project = {
  ...sampleProject,
  requirements: [...sampleProject.requirements, change],
  screens: [
    sampleProject.screens[0],
    { ...sampleProject.screens[1], requirementIds: ["time", "reschedule"] },
    { ...sampleProject.screens[2], requirementIds: ["confirm", "reschedule"], actions: [{ label: "Reschedule", target: "reschedule" }] },
    { id: "reschedule", title: "Reschedule", detail: "Pick another time to update your booking.", requirementIds: ["time", "reschedule"], options: ["Friday 10:00 AM", "Friday 2:00 PM", "Saturday 11:30 AM"], actions: [{ label: "Save new time", target: "confirm" }] },
  ],
};

export function diffScreens(before: Project, after: Project) {
  const beforeById = new Map(before.screens.map((screen) => [screen.id, screen]));
  const afterIds = new Set(after.screens.map((screen) => screen.id));
  const requirements = new Map(before.requirements.map((requirement) => [requirement.id, requirement]));
  const changedRequirements = new Set(after.requirements.filter((requirement) =>
    JSON.stringify(requirements.get(requirement.id)) !== JSON.stringify(requirement),
  ).map((requirement) => requirement.id));
  const changes = after.screens.flatMap((screen) => {
    const original = beforeById.get(screen.id);
    if (!original) return [{ id: screen.id, title: screen.title, kind: "Added" }];
    if (JSON.stringify(original) !== JSON.stringify(screen) || screen.requirementIds.some((key) => changedRequirements.has(key))) {
      return [{ id: screen.id, title: screen.title, kind: "Updated" }];
    }
    return [];
  });
  return [...changes, ...before.screens.filter((screen) => !afterIds.has(screen.id)).map((screen) => ({ id: screen.id, title: screen.title, kind: "Removed" }))];
}
