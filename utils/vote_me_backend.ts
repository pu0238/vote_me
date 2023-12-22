import { ActorSubclass, Identity } from "@dfinity/agent";
import { _SERVICE } from "../src/declarations/vote_me_backend/vote_me_backend.did";
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

export const deploy = (entryIdentities: Principal[], silent = true) => {
  const principals = entryIdentities.map(
    (entryIdentity) => `
    principal "${entryIdentity}";
  `
  );
  const command = `
  dfx deploy vote_me_backend --argument '(
    vec {
          ${principals}
    }
)' --mode reinstall --yes`;

  execSync(command, { stdio: silent ? "ignore" : "inherit" });
};
