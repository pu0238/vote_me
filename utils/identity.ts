import { keccak256, toUtf8Bytes, getBytes } from "ethers";
import { Ed25519KeyIdentity } from "@dfinity/identity";

export function getEntryUserIdentity(
  pesel: string,
  idNumber: string,
  pin: string,
  externalFactor: string,
) {
  const combinatedSecrets =
    keccak256(toUtf8Bytes(pin)) +
    keccak256(toUtf8Bytes(idNumber)) +
    keccak256(toUtf8Bytes(pesel)) +
    keccak256(toUtf8Bytes(externalFactor)) 
    
  return Ed25519KeyIdentity.generate(
    getBytes(keccak256(toUtf8Bytes(combinatedSecrets)))
  );
}

export function getUserIdentity(
  login: string,
  password: string,
  externalFactor: string,
  salt?: string
) {
  const saltHash = salt ? keccak256(toUtf8Bytes(salt)) : "";

  const combinatedSecrets =
    keccak256(toUtf8Bytes(externalFactor)) +
    keccak256(toUtf8Bytes(password)) +
    keccak256(toUtf8Bytes(login)) +
    saltHash;
    
  return Ed25519KeyIdentity.generate(
    getBytes(keccak256(toUtf8Bytes(combinatedSecrets)))
  );
}