const { createDecipheriv } = require("crypto");

const ENCRYPTION_KEY_HEX = "a4bc2b12715480d311dfb6990c93a735d3e6aff560e7c0e52ed51b285539de12";
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");

function decryptSecret(encoded) {
  const parts = encoded.split(":");
  if (parts.length !== 3) return encoded;
  const [ivHex, authTagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

const encryptedKey =
  "726a70a1252a6f459797e941:c90df4cb5c1815378956183a22933230:037e8797f25f63fc9c0765d18b4b4ac0cc312a3dc3d9d2547b4cabd1a443a827ec1c90aa9264b247c71202fa20d3d9ebb4bdabc225";
const decryptedKey = decryptSecret(encryptedKey);
console.log("Decrypted API Key:", decryptedKey);

// Let's test calling the Python service directly via Node.js fetch
async function run() {
  const res = await fetch("http://localhost:11435/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Hello",
      model: "gemini/gemini-2.5-flash",
      endpoint_url: "http://localhost:11435",
      api_key: decryptedKey,
    }),
  });

  console.log("Response Status:", res.status);
  const text = await res.text();
  console.log("Response Body:", text);
}

run().catch(console.error);
