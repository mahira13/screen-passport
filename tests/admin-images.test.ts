// The photo actions are server actions, callable by anyone with a POST: without the admin cookie
// they must refuse before touching the database.
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookie = { value: undefined as string | undefined };
const db = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (cookie.value ? { value: cookie.value } : undefined) }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => db() }));

const { fetchImages, findAnotherImage, moveCollection, pinCollection, setImageStatus, unpinCollection } = await import("@/app/admin/locations/actions");

describe("photo and featured admin actions", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "secret";
    db.mockReset();
  });

  it.each([
    ["approve", () => setImageStatus(1, "approved")],
    ["reject", () => setImageStatus(1, "rejected")],
    ["find another", () => findAnotherImage(1)],
    ["find photos", () => fetchImages()],
    ["pin", () => pinCollection("cold-war-berlin")],
    ["unpin", () => unpinCollection("cold-war-berlin")],
    ["move", () => moveCollection("cold-war-berlin", "up")],
  ])("%s refuses without a valid admin cookie", async (_n, call) => {
    cookie.value = undefined;
    await expect(call()).rejects.toThrow("Not signed in");
    cookie.value = "forged";
    await expect(call()).rejects.toThrow("Not signed in");
    expect(db).not.toHaveBeenCalled();
  });
});
