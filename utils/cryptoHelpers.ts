import { PublicKey } from "@dfinity/agent";

// The function encrypts data with the note-id-specific secretKey.
export async function encryptWithNoteKey(publicKey: PublicKey, data: string) {
  const rawKey = publicKey.rawKey;
  if (!rawKey) throw new Error("Can not get raw key");

  const key = await crypto.subtle.importKey(
    "raw",
    rawKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const encodedData = new TextEncoder().encode(data);
  // The iv must never be reused with a given key.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherData = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encodedData
  );

  const decodedIv = String.fromCharCode(...new Uint8Array(iv));
  const decodedCipherData = String.fromCharCode(...new Uint8Array(cipherData));
  return decodedIv + decodedCipherData;
}
