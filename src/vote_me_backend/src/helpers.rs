use candid::Principal;

use crate::errors::ContractError;

pub fn caller() -> Result<Principal, String> {
    let caller = ic_cdk::caller();
    // The anonymous principal is not allowed to interact with the
    // encrypted notes canister.
    if caller == Principal::anonymous() {
        return Err(ContractError::AnonymousCaller.to_string());
    }
    Ok(caller)
}
