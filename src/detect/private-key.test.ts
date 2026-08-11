import { describe, expect, test } from "vitest";
import { detectPrivateKey } from "./private-key.js";

// Synthetic base64 filler, not a real key.
const OPENSSH_BLOCK = [
  "-----BEGIN OPENSSH PRIVATE KEY-----",
  "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW",
  "QyNTUxOQAAACBn4mUvA9K1Qw7cX2eR8tYb5oJ6hL3dS0fG1kZ9pM4nTA",
  "-----END OPENSSH PRIVATE KEY-----"
].join("\n");

describe("detectPrivateKey", () => {
  test("one finding per block, excerpt is the header only", () => {
    const text = `read file id_ed25519:\n${OPENSSH_BLOCK}\ndone`;
    const findings = detectPrivateKey(text);
    expect(findings).toHaveLength(1);
    const f = findings[0]!;
    expect(f.category).toBe("private-key");
    expect(f.severity).toBe("critical");
    expect(f.excerpt).toBe("-----BEGIN OPENSSH PRIVATE KEY-----");
    expect(f.excerpt).not.toContain("b3Blbn");
    expect(f.start).toBe(text.indexOf("-----BEGIN"));
    expect(f.end).toBe(text.indexOf("KEY-----\ndone") + "KEY-----".length);
  });

  test("covers RSA and encrypted variants", () => {
    const rsa = "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKj34GkxFhD\n-----END RSA PRIVATE KEY-----";
    const enc = "-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFHDBOBgkqhkiG9w0BBQ0w\n-----END ENCRYPTED PRIVATE KEY-----";
    expect(detectPrivateKey(rsa)).toHaveLength(1);
    expect(detectPrivateKey(enc)).toHaveLength(1);
  });

  test("a truncated block with no END line still fires", () => {
    const truncated = "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIIrs0eKzTzp";
    const findings = detectPrivateKey(truncated);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.end).toBe(truncated.length);
  });

  test("two blocks yield two findings", () => {
    const text = `${OPENSSH_BLOCK}\n\n${OPENSSH_BLOCK}`;
    expect(detectPrivateKey(text)).toHaveLength(2);
  });

  test("public keys and certificates do not fire", () => {
    const pub = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZI\n-----END PUBLIC KEY-----";
    const cert = "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJC1\n-----END CERTIFICATE-----";
    expect(detectPrivateKey(pub)).toHaveLength(0);
    expect(detectPrivateKey(cert)).toHaveLength(0);
  });
});
