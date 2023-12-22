import { expect, should, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { getEntryUserIdentity, getUserIdentity } from "../utils/identity";
import { deploy, getVoteMeBackend } from "../utils/vote_me_backend";
import { randomBytes, hexlify } from "ethers";
import { encryptWithNoteKey } from "../utils/cryptoHelpers"

should();
use(chaiAsPromised);

// Configure ICP

describe("SignIn", () => {
  const userPesel = "11111111111";
  const userIdNumber = "ZZD111111";
  const userPin = "1111";
  const userExternalFactor = "hello123";

  const userLogin = "login";
  const userPassword = "password";

  const seed = hexlify(randomBytes(32)).slice(2);

  const entryIdentity = getEntryUserIdentity(
    userPesel,
    userIdNumber,
    userPin,
    userExternalFactor
  );
  const identity = getUserIdentity(
    userLogin,
    userPassword,
    userExternalFactor,
    seed
  );

  const identityPrincipal =  identity.getPrincipal()
  const entryIdentityPrincipal =  entryIdentity.getPrincipal()


  console.table({
    identityPrincipal: identityPrincipal.toText(),
    entryIdentityPrincipal: entryIdentityPrincipal.toText(),
  });

  beforeEach(() => {
    deploy([entryIdentityPrincipal]);
  })

  it("User can activate account", async () => {
    const encryptedSeed = await encryptWithNoteKey(identity.getKeyPair().publicKey, seed);

    await expect(getVoteMeBackend(entryIdentity).activate_user(
      identityPrincipal,
      encryptedSeed
    )).to.be.fulfilled
  });
});
