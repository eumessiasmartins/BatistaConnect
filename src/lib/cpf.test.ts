import { describe, expect, it } from "vitest";
import { cpfToEmail, formatCpf, isValidCpf } from "./cpf";

describe("cpf", () => {
  it("accepts the superadmin CPF", () => {
    expect(isValidCpf("95932844787")).toBe(true);
  });
  it("rejects invalid CPF", () => {
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("95932844780")).toBe(false);
  });
  it("maps formatted CPF to the login e-mail", () => {
    expect(cpfToEmail("959.328.447-87")).toBe("95932844787@cpf.intranet");
    expect(formatCpf("95932844787")).toBe("959.328.447-87");
  });
});
