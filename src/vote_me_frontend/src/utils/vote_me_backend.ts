import type { ActorSubclass, Identity } from "@dfinity/agent";
import { createActor } from "../../../declarations/vote_me_backend";
import type { _SERVICE } from "../../../declarations/vote_me_backend/vote_me_backend.did";

export function getVoteMeBackend(identity?: Identity): ActorSubclass<_SERVICE> {
  const host =
    process.env.DFX_NETWORK === "local" ? "http://localhost:4943" : undefined;

  return createActor(process.env.VOTE_ME_BACKEND_CANISTER_ID ?? "", {
    agentOptions: { host, identity },
  });
}
