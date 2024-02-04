import { expect, should, use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { getEntryUserIdentity, getUserIdentity } from "../utils/identity";
import { deploy, getVoteMeBackend } from "../utils/vote_me_backend";
import { randomBytes, hexlify } from "ethers";
import { aes_gcm_encrypt, aes_gcm_decrypt } from "../utils/cryptoHelpers";
import {
  CommitteeActions,
  CommitteeProposeCandidType as CommitteePropose,
  Config,
  PresidentialElectionsProposeCandidType,
} from "../src/declarations/vote_me_backend/vote_me_backend.did";

should();
use(chaiAsPromised);

(BigInt.prototype as any).toJSON = function (): number {
  return this.toString();
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Configure ICP

describe("Vote me", () => {
  // User 1
  const user1Pesel = "11111111111";
  const user1IdNumber = "ZZD111111";
  const user1Pin = "1111";
  const user1ExternalFactor = "hello123";

  const user1Login = "login";
  const user1Password = "password";

  const user1seed = hexlify(randomBytes(32)).slice(2);

  const entryIdentity = getEntryUserIdentity(
    user1Pesel,
    user1IdNumber,
    user1Pin,
    user1ExternalFactor
  );
  const identity = getUserIdentity(
    user1Login,
    user1Password,
    user1ExternalFactor,
    user1seed
  );
  const identityPrincipal = identity.getPrincipal();
  const entryIdentityPrincipal = entryIdentity.getPrincipal();

  // User 2
  const user2Pesel = "11111111111";
  const user2IdNumber = "ZZD111111";
  const user2Pin = "9999";
  const user2ExternalFactor = "hello123";

  const user2Login = "login";
  const user2Password = "password";

  const user2seed = hexlify(randomBytes(32)).slice(2);

  const entryIdentitySecondUser = getEntryUserIdentity(
    user2Pesel,
    user2IdNumber,
    user2Pin,
    user2ExternalFactor
  );
  const identitySecondUser = getUserIdentity(
    user2Login,
    user2Password,
    user2ExternalFactor,
    user2seed
  );
  const entryIdentitySecondUserPrincipal =
    entryIdentitySecondUser.getPrincipal();
  const identitySecondUserPrincipal = identitySecondUser.getPrincipal();

  // Should depend on: https://sip.lex.pl/akty-prawne/dzu-dziennik-ustaw/kodeks-wyborczy-17679859/dz-2-roz-7
  // Time in nano seconds
  const config: Config = {
    // 5 people in voting districts of up to 100 people,
    // 7 people in voting districts from 101 to 300 people,
    // 9 people in voting districts from 301 to 500 people,
    // 11 people in voting districts with more than 500 people
    max_committee_size: 5n,

    // Recommended: 24n * 60n * 60n * 1000n * 1_000n * 1_000n,
    user_proposals_duration: 5n * 1_000n * 1_000n * 1_000n,

    // Recommended: 30n * 60n * 1_000n * 1_000n * 1_000n,
    committee_proposals_duration: 5n * 1_000n * 1_000n * 1_000n,

    // Recommended: 50_01 (50.01%)
    presidential_elections_threshold: 50_01,

    // Recommended: 50_01 (50.01%)
    committee_threshold: 50_01,
  };

  console.table({
    identityPrincipal: identityPrincipal.toText(),
    entryIdentityPrincipal: entryIdentityPrincipal.toText(),
    entryIdentitySecondUserPrincipal: entryIdentitySecondUserPrincipal.toText(),
    identitySecondUserPrincipal: identitySecondUserPrincipal.toText(),
  });

  beforeEach(() => {
    deploy(config, [entryIdentityPrincipal]);
  });

  describe("Account activation", () => {
    it("User can activate existing account", async () => {
      const encryptedSeed = await aes_gcm_encrypt(
        identity.getKeyPair().publicKey,
        user1seed
      );

      await expect(
        getVoteMeBackend(entryIdentity).activate_user(
          identityPrincipal,
          encryptedSeed
        )
      ).to.be.fulfilled;
    });

    it("User can not activate account", async () => {
      const entryIdentity = getEntryUserIdentity(
        user1Pesel,
        user1IdNumber,
        "9999",
        user1ExternalFactor
      );

      const encryptedSeed = await aes_gcm_encrypt(
        identity.getKeyPair().publicKey,
        user1seed
      );

      await expect(
        getVoteMeBackend(entryIdentity).activate_user(
          identityPrincipal,
          encryptedSeed
        )
      ).to.be.rejectedWith("User not found");
    });

    it("User get own encrypted salt", async () => {
      const keyPair = identity.getKeyPair();
      const encryptedSeed = await aes_gcm_encrypt(keyPair.publicKey, user1seed);

      await getVoteMeBackend(entryIdentity).activate_user(
        identityPrincipal,
        encryptedSeed
      );

      await expect(
        getVoteMeBackend(entryIdentity).get_salt()
      ).to.be.eventually.eq(encryptedSeed);

      aes_gcm_decrypt(encryptedSeed, keyPair.secretKey);
    });

    it("User salt is eq decrypted salt", async () => {
      const encryptedSeed = await aes_gcm_encrypt(
        identity.getKeyPair().publicKey,
        user1seed
      );

      await getVoteMeBackend(entryIdentity).activate_user(
        identityPrincipal,
        encryptedSeed
      );

      const salt = await getVoteMeBackend(entryIdentity).get_salt();

      identity.getKeyPair();
      salt;
    });
  });

  describe("Committee can use CommitteeActions", () => {
    describe("Committee 'register entry' identities", () => {
      it("Committee can 'register entry' without identities", async () => {
        const encryptedSeed = await aes_gcm_encrypt(
          identity.getKeyPair().publicKey,
          user1seed
        );
        await getVoteMeBackend(entryIdentity).activate_user(
          identityPrincipal,
          encryptedSeed
        );

        const registerNewEntryIdentities = {
          RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
        };
        const proposeId = await getVoteMeBackend(
          identity
        ).committee_create_propose(registerNewEntryIdentities);

        await expect(
          getVoteMeBackend(identity).committee_vote_on_propose(proposeId)
        ).to.be.fulfilled;

        await getVoteMeBackend()
          .get_committee_proposals()
          .then((_proposals: CommitteePropose[]) => {
            const proposals = _proposals.map((propose) => {
              const { created_at, ...rest } = propose;
              return rest;
            });

            expect(proposals).to.be.deep.eq([
              {
                id: 0n,
                creator: identityPrincipal,
                action: registerNewEntryIdentities,
                voters: [identityPrincipal],
                state: { Open: null },
                votes_yes: 1n,
              },
            ]);
          });

        await sleep(
          Number(config.committee_proposals_duration / 1_000n / 1_000n)
        );
        await getVoteMeBackend()
          .get_committee_proposals()
          .then((_proposals: CommitteePropose[]) => {
            const proposals = _proposals.map((propose) => {
              const { created_at, ...rest } = propose;
              return rest;
            });

            expect(proposals).to.be.deep.eq([
              {
                id: 0n,
                creator: identityPrincipal,
                action: registerNewEntryIdentities,
                voters: [identityPrincipal],
                state: { Accepted: null },
                votes_yes: 1n,
              },
            ]);
          });
        await getVoteMeBackend(entryIdentitySecondUser).activate_user(
          identitySecondUserPrincipal,
          encryptedSeed
        );

        await expect(
          getVoteMeBackend(identitySecondUser).user_belongs_to_committee()
        ).to.eventually.be.eq(false);
      });
      it("Committee can not 'register entry' identities", async () => {
        const encryptedSeed = await aes_gcm_encrypt(
          identity.getKeyPair().publicKey,
          user1seed
        );
        await getVoteMeBackend(entryIdentity).activate_user(
          identityPrincipal,
          encryptedSeed
        );

        const registerNewEntryIdentities = {
          RegisterNewEntryIdentities: [],
        };

        await expect(
          getVoteMeBackend(identity).committee_create_propose(
            registerNewEntryIdentities
          )
        ).to.be.rejectedWith("Invalid action.");
      });
    });
    describe("Committee propose 'promote' user", () => {
      it("Committee can propose 'promote' user", async () => {
        const encryptedSeed = await aes_gcm_encrypt(
          identity.getKeyPair().publicKey,
          user1seed
        );
        await getVoteMeBackend(entryIdentity).activate_user(
          identityPrincipal,
          encryptedSeed
        );

        const encryptedSeed2 = await aes_gcm_encrypt(
          identitySecondUser.getKeyPair().publicKey,
          user1seed
        );

        const registerNewEntryIdentities = {
          RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
        };
        const registerPropose = await getVoteMeBackend(
          identity
        ).committee_create_propose(registerNewEntryIdentities);
        await expect(
          getVoteMeBackend(identity).committee_vote_on_propose(registerPropose)
        ).to.be.fulfilled;
        await sleep(
          Number(config.committee_proposals_duration / 1_000n / 1_000n)
        );
        await getVoteMeBackend(entryIdentitySecondUser).activate_user(
          identitySecondUserPrincipal,
          encryptedSeed2
        );

        const promoteUser = {
          PromoteUser: identitySecondUserPrincipal,
        };
        const proposeId = await getVoteMeBackend(
          identity
        ).committee_create_propose(promoteUser);

        await expect(
          getVoteMeBackend(identity).committee_vote_on_propose(proposeId)
        ).to.be.fulfilled;

        await getVoteMeBackend()
          .get_committee_proposals()
          .then((_proposals: CommitteePropose[]) => {
            const proposals = _proposals.map((propose) => {
              const { created_at, ...rest } = propose;
              return rest;
            });

            expect(proposals).to.be.deep.eq([
              {
                id: 0n,
                creator: identityPrincipal,
                action: registerNewEntryIdentities,
                voters: [identityPrincipal],
                state: { Accepted: null },
                votes_yes: 1n,
              },
              {
                id: 1n,
                creator: identityPrincipal,
                action: promoteUser,
                voters: [identityPrincipal],
                state: { Open: null },
                votes_yes: 1n,
              },
            ]);
          });

        await sleep(
          Number(config.committee_proposals_duration / 1_000n / 1_00n)
        );
        await getVoteMeBackend()
          .get_committee_proposals()
          .then((_proposals: CommitteePropose[]) => {
            const proposals = _proposals.map((propose) => {
              const { created_at, ...rest } = propose;
              return rest;
            });

            expect(proposals).to.be.deep.eq([
              {
                id: 0n,
                creator: identityPrincipal,
                action: registerNewEntryIdentities,
                voters: [identityPrincipal],
                state: { Accepted: null },
                votes_yes: 1n,
              },
              {
                id: 1n,
                creator: identityPrincipal,
                action: promoteUser,
                voters: [identityPrincipal],
                state: { Accepted: null },
                votes_yes: 1n,
              },
            ]);
          });

        await expect(
          getVoteMeBackend(identitySecondUser).user_belongs_to_committee()
        ).to.eventually.be.eq(true);
      });

      it("User can not vote on 'promote' user propose", async () => {
        const encryptedSeed = await aes_gcm_encrypt(
          identity.getKeyPair().publicKey,
          user1seed
        );
        await getVoteMeBackend(entryIdentity).activate_user(
          identityPrincipal,
          encryptedSeed
        );

        const encryptedSeed2 = await aes_gcm_encrypt(
          identitySecondUser.getKeyPair().publicKey,
          user1seed
        );

        const registerNewEntryIdentities = {
          RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
        };
        const registerPropose = await getVoteMeBackend(
          identity
        ).committee_create_propose(registerNewEntryIdentities);
        await expect(
          getVoteMeBackend(identity).committee_vote_on_propose(registerPropose)
        ).to.be.fulfilled;
        await sleep(
          Number(config.committee_proposals_duration / 1_000n / 1_000n)
        );
        await getVoteMeBackend(entryIdentitySecondUser).activate_user(
          identitySecondUserPrincipal,
          encryptedSeed2
        );

        const promoteUser = {
          PromoteUser: identityPrincipal,
        };
        const proposeId = await getVoteMeBackend(
          identity
        ).committee_create_propose(promoteUser);

        await expect(
          getVoteMeBackend(identitySecondUser).committee_vote_on_propose(
            proposeId
          )
        ).to.be.rejectedWith("User do not belongs to committee");

        await expect(
          getVoteMeBackend(identitySecondUser).user_belongs_to_committee()
        ).to.eventually.be.eq(false);
      });
    });

    describe("Committee propose 'demote' user", () => {
      it("Committee can propose 'demote' user", async () => {
        const encryptedSeed = await aes_gcm_encrypt(
          identity.getKeyPair().publicKey,
          user1seed
        );
        await getVoteMeBackend(entryIdentity).activate_user(
          identityPrincipal,
          encryptedSeed
        );

        const encryptedSeed2 = await aes_gcm_encrypt(
          identitySecondUser.getKeyPair().publicKey,
          user1seed
        );

        const registerNewEntryIdentities = {
          RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
        };
        const registerPropose = await getVoteMeBackend(
          identity
        ).committee_create_propose(registerNewEntryIdentities);
        await expect(
          getVoteMeBackend(identity).committee_vote_on_propose(registerPropose)
        ).to.be.fulfilled;
        await sleep(
          Number(config.committee_proposals_duration / 1_000n / 1_000n)
        );
        await getVoteMeBackend(entryIdentitySecondUser).activate_user(
          identitySecondUserPrincipal,
          encryptedSeed2
        );

        const demoteUser = {
          DemoteUser: identitySecondUserPrincipal,
        };
        const proposeId = await getVoteMeBackend(
          identity
        ).committee_create_propose(demoteUser);

        await expect(
          getVoteMeBackend(identity).committee_vote_on_propose(proposeId)
        ).to.be.fulfilled;

        await getVoteMeBackend()
          .get_committee_proposals()
          .then((_proposals: CommitteePropose[]) => {
            const proposals = _proposals.map((propose) => {
              const { created_at, ...rest } = propose;
              return rest;
            });

            expect(proposals).to.be.deep.eq([
              {
                id: 0n,
                creator: identityPrincipal,
                action: registerNewEntryIdentities,
                voters: [identityPrincipal],
                state: { Accepted: null },
                votes_yes: 1n,
              },
              {
                id: 1n,
                creator: identityPrincipal,
                action: demoteUser,
                voters: [identityPrincipal],
                state: { Open: null },
                votes_yes: 1n,
              },
            ]);
          });

        await sleep(
          Number(config.committee_proposals_duration / 1_000n / 1_000n)
        );
        await getVoteMeBackend()
          .get_committee_proposals()
          .then((_proposals: CommitteePropose[]) => {
            const proposals = _proposals.map((propose) => {
              const { created_at, ...rest } = propose;
              return rest;
            });

            expect(proposals).to.be.deep.eq([
              {
                id: 0n,
                creator: identityPrincipal,
                action: registerNewEntryIdentities,
                voters: [identityPrincipal],
                state: { Accepted: null },
                votes_yes: 1n,
              },
              {
                id: 1n,
                creator: identityPrincipal,
                action: demoteUser,
                voters: [identityPrincipal],
                state: { Accepted: null },
                votes_yes: 1n,
              },
            ]);
          });

        await expect(
          getVoteMeBackend(identitySecondUser).user_belongs_to_committee()
        ).to.eventually.be.eq(false);
      });

      it("User can not vote on 'demote' user propose", async () => {
        const encryptedSeed = await aes_gcm_encrypt(
          identity.getKeyPair().publicKey,
          user1seed
        );
        await getVoteMeBackend(entryIdentity).activate_user(
          identityPrincipal,
          encryptedSeed
        );

        const encryptedSeed2 = await aes_gcm_encrypt(
          identitySecondUser.getKeyPair().publicKey,
          user1seed
        );

        const registerNewEntryIdentities = {
          RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
        };
        const registerPropose = await getVoteMeBackend(
          identity
        ).committee_create_propose(registerNewEntryIdentities);
        await expect(
          getVoteMeBackend(identity).committee_vote_on_propose(registerPropose)
        ).to.be.fulfilled;
        await sleep(
          Number(config.committee_proposals_duration / 1_000n / 1_000n)
        );
        await getVoteMeBackend(entryIdentitySecondUser).activate_user(
          identitySecondUserPrincipal,
          encryptedSeed2
        );

        const demoteUser = {
          DemoteUser: identitySecondUserPrincipal,
        };
        const proposeId = await getVoteMeBackend(
          identity
        ).committee_create_propose(demoteUser);

        await expect(
          getVoteMeBackend(identitySecondUser).committee_vote_on_propose(
            proposeId
          )
        ).to.be.rejectedWith("User do not belongs to committee");
        await expect(
          getVoteMeBackend(identitySecondUser).user_belongs_to_committee()
        ).to.eventually.be.eq(false);
      });
    });

    describe("Committee create user proposal", () => {
      describe("CreateUserPropose", () => {
        it("Committee can create 'presidential elections'", async () => {
          const encryptedSeed = await aes_gcm_encrypt(
            identity.getKeyPair().publicKey,
            user1seed
          );
          await getVoteMeBackend(entryIdentity).activate_user(
            identityPrincipal,
            encryptedSeed
          );

          const encryptedSeed2 = await aes_gcm_encrypt(
            identitySecondUser.getKeyPair().publicKey,
            user1seed
          );

          const registerNewEntryIdentities = {
            RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
          };
          const registerPropose = await getVoteMeBackend(
            identity
          ).committee_create_propose(registerNewEntryIdentities);
          await expect(
            getVoteMeBackend(identity).committee_vote_on_propose(
              registerPropose
            )
          ).to.be.fulfilled;
          await sleep(
            Number(config.committee_proposals_duration / 1_000n / 1_000n)
          );
          await getVoteMeBackend(entryIdentitySecondUser).activate_user(
            identitySecondUserPrincipal,
            encryptedSeed2
          );

          const createUserPropose: CommitteeActions = {
            CreateUserPropose: {
              PresidentialElections: ["Jan Kowalski"],
            },
          };
          const proposeId = await getVoteMeBackend(
            identity
          ).committee_create_propose(createUserPropose);

          await expect(
            getVoteMeBackend(identity).committee_vote_on_propose(proposeId)
          ).to.be.fulfilled;

          await getVoteMeBackend()
            .get_committee_proposals()
            .then((_proposals: CommitteePropose[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  action: registerNewEntryIdentities,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
                {
                  id: 1n,
                  creator: identityPrincipal,
                  action: createUserPropose,
                  voters: [identityPrincipal],
                  state: { Open: null },
                  votes_yes: 1n,
                },
              ]);
            });

          await sleep(
            Number(config.committee_proposals_duration / 1_000n / 1_000n)
          );
          await getVoteMeBackend()
            .get_committee_proposals()
            .then((_proposals: CommitteePropose[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  action: registerNewEntryIdentities,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
                {
                  id: 1n,
                  creator: identityPrincipal,
                  action: createUserPropose,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
              ]);
            });

          getVoteMeBackend(identitySecondUser)
            .get_presidential_elections()
            .then((_proposals: PresidentialElectionsProposeCandidType[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  voters: [],
                  state: { Open: null },

                  votes_yes: [],
                  vote_content: createUserPropose.CreateUserPropose,
                },
              ]);
            });
        });

        it("User can vote on 'presidential elections' and winner is over a threshold", async () => {
          const encryptedSeed = await aes_gcm_encrypt(
            identity.getKeyPair().publicKey,
            user1seed
          );
          await getVoteMeBackend(entryIdentity).activate_user(
            identityPrincipal,
            encryptedSeed
          );

          const encryptedSeed2 = await aes_gcm_encrypt(
            identitySecondUser.getKeyPair().publicKey,
            user1seed
          );

          const registerNewEntryIdentities = {
            RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
          };
          const registerPropose = await getVoteMeBackend(
            identity
          ).committee_create_propose(registerNewEntryIdentities);
          await expect(
            getVoteMeBackend(identity).committee_vote_on_propose(
              registerPropose
            )
          ).to.be.fulfilled;
          await sleep(
            Number(config.committee_proposals_duration / 1_000n / 1_000n)
          );
          await getVoteMeBackend(entryIdentitySecondUser).activate_user(
            identitySecondUserPrincipal,
            encryptedSeed2
          );

          const createUserPropose: CommitteeActions = {
            CreateUserPropose: {
              PresidentialElections: ["Jan Kowalski"],
            },
          };
          const proposeId = await getVoteMeBackend(
            identity
          ).committee_create_propose(createUserPropose);

          await expect(
            getVoteMeBackend(identity).committee_vote_on_propose(proposeId)
          ).to.be.fulfilled;

          await getVoteMeBackend()
            .get_committee_proposals()
            .then((_proposals: CommitteePropose[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  action: registerNewEntryIdentities,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
                {
                  id: 1n,
                  creator: identityPrincipal,
                  action: createUserPropose,
                  voters: [identityPrincipal],
                  state: { Open: null },
                  votes_yes: 1n,
                },
              ]);
            });

          await sleep(
            Number(config.committee_proposals_duration / 1_000n / 1_000n)
          );
          await getVoteMeBackend()
            .get_committee_proposals()
            .then((_proposals: CommitteePropose[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  action: registerNewEntryIdentities,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
                {
                  id: 1n,
                  creator: identityPrincipal,
                  action: createUserPropose,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
              ]);
            });

          await getVoteMeBackend(identitySecondUser)
            .get_presidential_elections()
            .then((_proposals: PresidentialElectionsProposeCandidType[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(JSON.stringify(proposals)).to.be.eq(
                JSON.stringify([
                  {
                    id: 0n,
                    creator: identityPrincipal,
                    voters: [],
                    state: { Open: null },
                    votes_yes: { "0": "0" },
                    proposal_content:
                      createUserPropose.CreateUserPropose[
                        "PresidentialElections"
                      ],
                  },
                ])
              );
            });

          await getVoteMeBackend(identitySecondUser).vote_on_propose(
            {
              PresidentialElections: 0n,
            },
            0n
          );

          await sleep(Number(config.user_proposals_duration / 1_000n / 1_000n));

          await getVoteMeBackend(identitySecondUser)
            .get_presidential_elections()
            .then((_proposals: PresidentialElectionsProposeCandidType[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(JSON.stringify(proposals)).to.be.eq(
                JSON.stringify([
                  {
                    id: 0n,
                    creator: identityPrincipal,
                    voters: [identitySecondUserPrincipal],
                    state: { Accepted: null },
                    votes_yes: { "0": 1n },
                    proposal_content:
                      createUserPropose.CreateUserPropose[
                        "PresidentialElections"
                      ],
                  },
                ])
              );
            });
        });

        it("User can vote on 'presidential elections'. When there is no winner it is Unresolved (< 2)", async () => {
          const encryptedSeed = await aes_gcm_encrypt(
            identity.getKeyPair().publicKey,
            user1seed
          );
          await getVoteMeBackend(entryIdentity).activate_user(
            identityPrincipal,
            encryptedSeed
          );

          const encryptedSeed2 = await aes_gcm_encrypt(
            identitySecondUser.getKeyPair().publicKey,
            user1seed
          );

          const registerNewEntryIdentities = {
            RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
          };
          const registerPropose = await getVoteMeBackend(
            identity
          ).committee_create_propose(registerNewEntryIdentities);
          await expect(
            getVoteMeBackend(identity).committee_vote_on_propose(
              registerPropose
            )
          ).to.be.fulfilled;
          await sleep(
            Number(config.committee_proposals_duration / 1_000n / 1_000n)
          );
          await getVoteMeBackend(entryIdentitySecondUser).activate_user(
            identitySecondUserPrincipal,
            encryptedSeed2
          );

          const createUserPropose: CommitteeActions = {
            CreateUserPropose: {
              PresidentialElections: ["Jan Kowalski", "Mariusz Broda"],
            },
          };
          const proposeId = await getVoteMeBackend(
            identity
          ).committee_create_propose(createUserPropose);

          await expect(
            getVoteMeBackend(identity).committee_vote_on_propose(proposeId)
          ).to.be.fulfilled;

          await getVoteMeBackend()
            .get_committee_proposals()
            .then((_proposals: CommitteePropose[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  action: registerNewEntryIdentities,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
                {
                  id: 1n,
                  creator: identityPrincipal,
                  action: createUserPropose,
                  voters: [identityPrincipal],
                  state: { Open: null },
                  votes_yes: 1n,
                },
              ]);
            });

          await sleep(
            Number(config.committee_proposals_duration / 1_000n / 1_000n)
          );
          await getVoteMeBackend()
            .get_committee_proposals()
            .then((_proposals: CommitteePropose[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  action: registerNewEntryIdentities,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
                {
                  id: 1n,
                  creator: identityPrincipal,
                  action: createUserPropose,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
              ]);
            });

          await getVoteMeBackend(identitySecondUser)
            .get_presidential_elections()
            .then((_proposals: PresidentialElectionsProposeCandidType[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(JSON.stringify(proposals)).to.be.eq(
                JSON.stringify([
                  {
                    id: 0n,
                    creator: identityPrincipal,
                    voters: [],
                    state: { Open: null },
                    votes_yes: { "0": 0n, "1": 0n },
                    proposal_content:
                      createUserPropose.CreateUserPropose[
                        "PresidentialElections"
                      ],
                  },
                ])
              );
            });

          await sleep(Number(config.user_proposals_duration / 1_000n / 1_000n));

          await getVoteMeBackend(identitySecondUser)
            .get_presidential_elections()
            .then((_proposals: PresidentialElectionsProposeCandidType[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(JSON.stringify(proposals)).to.be.eq(
                JSON.stringify([
                  {
                    id: 0n,
                    creator: identityPrincipal,
                    voters: [],
                    state: { Unresolved: null },
                    votes_yes: { "0": 0n, "1": 0n },
                    proposal_content:
                      createUserPropose.CreateUserPropose[
                        "PresidentialElections"
                      ],
                  },
                ])
              );
            });
        });

        it("User can vote on 'presidential elections'. When there is no winner, create new vote (> 2)", async () => {
          const encryptedSeed = await aes_gcm_encrypt(
            identity.getKeyPair().publicKey,
            user1seed
          );
          await getVoteMeBackend(entryIdentity).activate_user(
            identityPrincipal,
            encryptedSeed
          );

          const encryptedSeed2 = await aes_gcm_encrypt(
            identitySecondUser.getKeyPair().publicKey,
            user1seed
          );

          const registerNewEntryIdentities = {
            RegisterNewEntryIdentities: [entryIdentitySecondUserPrincipal],
          };
          const registerPropose = await getVoteMeBackend(
            identity
          ).committee_create_propose(registerNewEntryIdentities);
          await expect(
            getVoteMeBackend(identity).committee_vote_on_propose(
              registerPropose
            )
          ).to.be.fulfilled;
          await sleep(
            Number(config.committee_proposals_duration / 1_000n / 1_000n)
          );
          await getVoteMeBackend(entryIdentitySecondUser).activate_user(
            identitySecondUserPrincipal,
            encryptedSeed2
          );

          const createUserPropose: CommitteeActions = {
            CreateUserPropose: {
              PresidentialElections: [
                "Jan Kowalski",
                "Mariusz Broda",
                "Andrzej Kłoda",
              ],
            },
          };
          const proposeId = await getVoteMeBackend(
            identity
          ).committee_create_propose(createUserPropose);

          await expect(
            getVoteMeBackend(identity).committee_vote_on_propose(proposeId)
          ).to.be.fulfilled;

          await getVoteMeBackend()
            .get_committee_proposals()
            .then((_proposals: CommitteePropose[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  action: registerNewEntryIdentities,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
                {
                  id: 1n,
                  creator: identityPrincipal,
                  action: createUserPropose,
                  voters: [identityPrincipal],
                  state: { Open: null },
                  votes_yes: 1n,
                },
              ]);
            });

          await sleep(
            Number(config.committee_proposals_duration / 1_000n / 1_000n)
          );
          await getVoteMeBackend()
            .get_committee_proposals()
            .then((_proposals: CommitteePropose[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(proposals).to.be.deep.eq([
                {
                  id: 0n,
                  creator: identityPrincipal,
                  action: registerNewEntryIdentities,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
                {
                  id: 1n,
                  creator: identityPrincipal,
                  action: createUserPropose,
                  voters: [identityPrincipal],
                  state: { Accepted: null },
                  votes_yes: 1n,
                },
              ]);
            });

          await getVoteMeBackend(identitySecondUser)
            .get_presidential_elections()
            .then((_proposals: PresidentialElectionsProposeCandidType[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(JSON.stringify(proposals, null, 2)).to.be.eq(
                JSON.stringify(
                  [
                    {
                      id: 0n,
                      creator: identityPrincipal,
                      voters: [],
                      state: { Open: null },
                      votes_yes: { "0": 0n, "1": 0n, "2": 0n },
                      proposal_content:
                        createUserPropose.CreateUserPropose[
                          "PresidentialElections"
                        ],
                    },
                  ],
                  null,
                  2
                )
              );
            });

          await sleep(Number(config.user_proposals_duration / 1_000n / 1_000n));

          await getVoteMeBackend(identitySecondUser)
            .get_presidential_elections()
            .then((_proposals: PresidentialElectionsProposeCandidType[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(JSON.stringify(proposals, null, 2)).to.be.eq(
                JSON.stringify(
                  [
                    {
                      id: 0n,
                      creator: identityPrincipal,
                      voters: [],
                      state: { Unresolved: null },
                      votes_yes: { "0": 0n, "1": 0n, "2": 0n },
                      proposal_content:
                        createUserPropose.CreateUserPropose[
                          "PresidentialElections"
                        ],
                    },
                    {
                      id: 1n,
                      creator: identityPrincipal,
                      voters: [],
                      state: { Open: null },
                      votes_yes: { "0": 0n, "1": 0n },
                      proposal_content: [
                        createUserPropose.CreateUserPropose[
                          "PresidentialElections"
                        ][0],
                        createUserPropose.CreateUserPropose[
                          "PresidentialElections"
                        ][1],
                      ],
                    },
                  ],
                  null,
                  2
                )
              );
            });

          await getVoteMeBackend(identitySecondUser)
            .get_presidential_elections()
            .then((_proposals: PresidentialElectionsProposeCandidType[]) => {
              const proposals = _proposals.map((propose) => {
                const { created_at, ...rest } = propose;
                return rest;
              });

              expect(JSON.stringify(proposals, null, 2)).to.be.eq(
                JSON.stringify(
                  [
                    {
                      id: 0n,
                      creator: identityPrincipal,
                      voters: [],
                      state: { Unresolved: null },
                      votes_yes: { "0": 0n, "1": 0n, "2": 0n },
                      proposal_content:
                        createUserPropose.CreateUserPropose[
                          "PresidentialElections"
                        ],
                    },
                    {
                      id: 1n,
                      creator: identityPrincipal,
                      voters: [],
                      state: { Open: null },
                      votes_yes: { "0": 0n, "1": 0n },
                      proposal_content: [
                        createUserPropose.CreateUserPropose[
                          "PresidentialElections"
                        ][0],
                        createUserPropose.CreateUserPropose[
                          "PresidentialElections"
                        ][1],
                      ],
                    },
                  ],
                  null,
                  2
                )
              );
            });
        });
      });
    });
  });
});
