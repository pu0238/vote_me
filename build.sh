#!/usr/bin/env bash

set -e
CANISTERS="$1"

function generate_did() {
  local canister=$1
  canister_root="src/$canister"

  cargo build --manifest-path="$canister_root/Cargo.toml" \
      --target wasm32-unknown-unknown \
      --release --package "$canister"

  # See https://crates.io/crates/candid-extractor
  candid-extractor "target/wasm32-unknown-unknown/release/$canister.wasm" > "$canister_root/$canister.did"

  ic-wasm "target/wasm32-unknown-unknown/release/$canister.wasm" \
    -o "target/wasm32-unknown-unknown/release/$canister.wasm" \
    metadata candid:service -v public -f "$canister_root/$canister.did"

ic-wasm "target/wasm32-unknown-unknown/release/$canister.wasm" \
    -o "target/wasm32-unknown-unknown/release/$canister-opt.wasm" \
    shrink

    gzip -f "target/wasm32-unknown-unknown/release/$canister-opt.wasm" 
}

# The list of canisters of your project
# Those shoudl use ic_cdk >= v0.11.0
#

for canister in $(echo $CANISTERS | sed "s/,/ /g")
do
    generate_did "$canister"
done

dfx generate