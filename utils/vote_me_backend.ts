import { ActorSubclass, Identity } from "@dfinity/agent";
import { Config, _SERVICE } from "../src/declarations/vote_me_backend/vote_me_backend.did";
import { canisterId, createActor } from "../src/declarations/vote_me_backend";
import { execSync } from "child_process";
import { Principal } from "@dfinity/principal";

const host =
  process.env.DFX_NETWORK === "local" ? "http://localhost:4943" : undefined;

export const getVoteMeBackend = (identity?: Identity) => {
  return createActor(canisterId, {
    agentOptions: { fetch, host, identity },
  });
};

export const deploy = (config: Config, entryIdentities: Principal[], silent = true) => {
  const principals = entryIdentities.map(
    (entryIdentity) => `principal "${entryIdentity}";\n`
  );
  const command = `
  dfx deploy vote_me_backend --argument '(
    record { 
      committee_threshold=${config.committee_threshold}:nat16; 
      max_committee_size=${config.max_committee_size}:nat64;
      committee_proposals_duration=${config.committee_proposals_duration}:nat64;
      user_proposals_duration=${config.user_proposals_duration}:nat64;
      presidential_elections_threshold=${config.presidential_elections_threshold}:nat16;
    },
    vec {
          ${principals}
    }
)' --mode reinstall --yes`;

  execSync(command, { stdio: silent ? "ignore" : "inherit" });
};
