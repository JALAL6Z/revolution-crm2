import { describe, expect, it } from "vitest";
import { autoMap, parseCSV, toNumber } from "./csv";

describe("parseCSV", () => {
  it("parses semicolon separated files with quoted separators", () => {
    const parsed = parseCSV('Entreprise;Email;Note\n"ACME; Paris";hello@example.com;"4,8"');

    expect(parsed.headers).toEqual(["Entreprise", "Email", "Note"]);
    expect(parsed.rows).toEqual([
      { Entreprise: "ACME; Paris", Email: "hello@example.com", Note: "4,8" },
    ]);
  });

  it("supports escaped quotes", () => {
    const parsed = parseCSV('name,notes\n"ACME ""Pro""","Lead chaud"');

    expect(parsed.rows[0]).toEqual({ name: 'ACME "Pro"', notes: "Lead chaud" });
  });
});

describe("autoMap", () => {
  it("maps common French and English headers", () => {
    const mapping = autoMap(["Raison sociale", "Téléphone", "Site web", "Code postal", "Chiffre affaires"]);

    expect(mapping.name).toBe("Raison sociale");
    expect(mapping.phone).toBe("Téléphone");
    expect(mapping.website).toBe("Site web");
    expect(mapping.zip).toBe("Code postal");
    expect(mapping.revenue_estimate).toBe("Chiffre affaires");
  });
});

describe("toNumber", () => {
  it("normalizes currency-like values", () => {
    expect(toNumber("1 250,50 €")).toBe(1250.5);
    expect(toNumber("")).toBe(0);
    expect(toNumber(null)).toBeNull();
  });
});
