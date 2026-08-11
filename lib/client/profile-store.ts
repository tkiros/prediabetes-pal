/**
 * Guest profile (plan P3): the onboarding A1C + completion stamp, on-device.
 * Server profiles (4A) supersede this for signed-in users; guests keep it.
 */

export type GuestProfile = {
  a1c: number;
  onboardedAt: string; // ISO
};

const STORAGE_KEY = "pal.profile.v1";

export const profileStore = {
  get(): GuestProfile | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof (parsed as GuestProfile).a1c === "number" &&
        typeof (parsed as GuestProfile).onboardedAt === "string"
      ) {
        return parsed as GuestProfile;
      }

      return null;
    } catch {
      return null;
    }
  },

  set(profile: GuestProfile): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // storage unavailable: onboarding still works, it just won't persist
    }
  },

  clear(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
};
