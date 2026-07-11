import { describe, it, expect, afterEach } from "vitest";
import { BaseRepository } from "./base-repository";

interface Widget {
  _id?: string;
  environment?: string;
  name: string;
  count: number;
}

class WidgetRepository extends BaseRepository<Widget> {
  protected collectionName = "widgets_test";
}

const originalEnv = process.env.APP_ENV_PROFILE;
afterEach(() => {
  if (originalEnv === undefined) delete process.env.APP_ENV_PROFILE;
  else process.env.APP_ENV_PROFILE = originalEnv;
});

describe("BaseRepository environment scoping", () => {
  it("insertOne stamps the active profile's environment", async () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const repo = new WidgetRepository();
    const inserted = await repo.insertOne({ name: "gizmo", count: 1 });
    expect(inserted.environment).toBe("test");
  });

  it("findOne only returns documents from the active environment", async () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const repo = new WidgetRepository();
    await repo.insertOne({ name: "gizmo-test", count: 1 });

    process.env.APP_ENV_PROFILE = "mainnet";
    const mainnetRepo = new WidgetRepository();
    await mainnetRepo.insertOne({ name: "gizmo-main", count: 1 });

    const foundOnMain = await mainnetRepo.findOne({ name: "gizmo-test" });
    expect(foundOnMain).toBeNull();

    const foundOnMainOwn = await mainnetRepo.findOne({ name: "gizmo-main" });
    expect(foundOnMainOwn?.name).toBe("gizmo-main");
  });

  it("find is scoped even when the caller passes no filter", async () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const repo = new WidgetRepository();
    await repo.insertOne({ name: "a", count: 1 });
    await repo.insertOne({ name: "b", count: 2 });

    process.env.APP_ENV_PROFILE = "mainnet";
    const mainnetRepo = new WidgetRepository();
    await mainnetRepo.insertOne({ name: "c", count: 3 });

    const testnetResults = await repo.find({});
    expect(testnetResults.map((w) => w.name).sort()).toEqual(["a", "b"]);
  });

  it("updateOne cannot cross environments", async () => {
    process.env.APP_ENV_PROFILE = "testnet";
    const repo = new WidgetRepository();
    await repo.insertOne({ name: "shared-name", count: 1 });

    process.env.APP_ENV_PROFILE = "mainnet";
    const mainnetRepo = new WidgetRepository();
    await mainnetRepo.insertOne({ name: "shared-name", count: 100 });
    await mainnetRepo.updateOne({ name: "shared-name" }, { count: 999 });

    process.env.APP_ENV_PROFILE = "testnet";
    const testnetAfter = await repo.findOne({ name: "shared-name" });
    expect(testnetAfter?.count).toBe(1); // untouched by the mainnet update
  });
});
