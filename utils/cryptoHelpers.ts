import { PublicKey } from "@dfinity/agent";

// The function encrypts data with the note-id-specific secretKey.
export async function aes_gcm_encrypt(publicKey: PublicKey, data: string) {
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

export async function aes_gcm_decrypt(
  encrypted_data: string,
  secretKey: ArrayBuffer
) {
  const key = await crypto.subtle.importKey(
    "raw",
    secretKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
  if (encrypted_data.length < 13) {
    throw new Error("wrong encoding, too short to contain iv");
  }
  const iv_decoded = encrypted_data.slice(0, 12);
  const cipher_decoded = encrypted_data.slice(12);
  const iv_encoded = Uint8Array.from(
    [...iv_decoded].map((ch) => ch.charCodeAt(0))
  ).buffer;
  const ciphertext_encoded = Uint8Array.from(
    [...cipher_decoded].map((ch) => ch.charCodeAt(0))
  ).buffer;

  let decrypted_data_encoded = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv_encoded,
    },
    key,
    ciphertext_encoded
  );
  const decrypted_data_decoded = String.fromCharCode(
    ...new Uint8Array(decrypted_data_encoded)
  );
  return decrypted_data_decoded;
}
