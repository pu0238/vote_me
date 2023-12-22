use std::cell::RefCell;

use candid::Principal;
use ic_cdk::println;
use identitie::Users;
use types::Votes;

use crate::{
    helpers::caller,
    types::{Role, User},
};

mod helpers;
mod identitie;
mod types;

thread_local! {
    static USERS: RefCell<Users> = RefCell::new(Users::new());
    static VOTES: RefCell<Votes> = RefCell::new(Votes::new());
}

#[ic_cdk::init]
fn init(entry_identities: Vec<Principal>) {
    let users_count = USERS.with(|users| users.borrow().0.len());
    if users_count != 0 {
        panic!("The canister is already initialized")
    }

    USERS.with(|users| {
        entry_identities.iter().for_each(|entry_identity| {
            users
                .borrow_mut()
                .0
                .push(User::new_with_role(entry_identity, Role::Committee))
        })
    });

    println!(
        "Registered early identity as a committee member: {:?}",
        entry_identities
    );
}

// Committee actions

#[ic_cdk::update]
fn register_new_entry_identities(entry_identities: Vec<Principal>) {
    assert!(
        user_belongs_to_committee(),
        "Caller do not belongs to committee"
    );

    USERS.with(|users| {
        entry_identities
            .iter()
            .for_each(|entry_identity| users.borrow_mut().0.push(User::new(entry_identity)))
    });
}

#[ic_cdk::update]
fn create_vote() {
    assert!(
        user_belongs_to_committee(),
        "Caller do not belongs to committee"
    );
}

// User actions

#[ic_cdk::update]
fn activate_user(identity: Principal, identity_seed: String) {
    let caller = caller();

    USERS.with(|users| {
        users
            .borrow_mut()
            .activate_user(caller, identity, identity_seed)
    });
}


#[ic_cdk::query]
fn user_belongs_to_committee() -> bool {
    let caller = caller();

    USERS.with(|users| users.borrow().is_in_committee(caller))
}

// System actions

ic_cdk::export_candid!();
