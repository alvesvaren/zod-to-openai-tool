import { describe, expect, it } from "vitest";
import { deepRemoveKey } from "./utils.js";

describe("deepRemoveKey()", () => {
  it("should remove a key from a nested object", () => {
    const obj = {
      a: {
        b: {
          c: "c",
          d: "d",
        },
      },
    };

    const result = deepRemoveKey(obj, "c");
    expect(result).toEqual({
      a: {
        b: {
          d: "d",
        },
      },
    });
  });
  it("should remove multiple identical keys from a nested object", () => {
    const obj = {
      a: {
        c: {
          c: {
            c: "c",
            d: "d",
          },
        },
        b: {
          c: "c",
          d: "d",
        },
      },
    };

    const result = deepRemoveKey(obj, "c");
    expect(result).toEqual({
      a: {
        b: {
          d: "d",
        },
      },
    });
  });
  it("should keep arrays as arrays", () => {
    const obj = {
      a: {
        b: {
          c: ["c", "d"],
        },
      },
    };

    const result = deepRemoveKey(obj, "d");
    expect(result).toEqual({
      a: {
        b: {
          c: ["c", "d"],
        },
      },
    });
  });
});
