use std::cell::RefCell;

use candid::Principal;
use ic_cdk::println;
use identities::Users;
use types::{CommitteeProposeCandidType, Proposals};

use crate::{
    helpers::caller,
    types::{CommitteeActions, CommitteeProposals, Config, Role, User},
};

mod errors;
mod helpers;
mod identities;
mod types;

thread_local! {
    static CONFIG: RefCell<Option<Config>> = RefCell::new(None);
    static USERS: RefCell<Users> = RefCell::new(Users::new());
    static PROPOSALS: RefCell<Proposals> = RefCell::new(Proposals::new());
    static COMMITTEE_PROPOSALS: RefCell<CommitteeProposals> = RefCell::new(CommitteeProposals::new());
}

#[ic_cdk::init]
fn init(config: Config, entry_identities: Vec<Principal>) {
    let users_count = USERS.with(|users| users.borrow().len());

    assert!(users_count == 0, "The canister is already initialized");

    let committee_size = entry_identities.len() as u64;
    let min_threshold = (committee_size / 2) + 1;
    assert!(
        config.threshold <= min_threshold,
        "Threshold is lower then min threshold length (committee_size / 2) + 1"
    );

    CONFIG.with(|config_ref| *config_ref.borrow_mut() = Some(config));

    USERS.with(|users| {
        entry_identities.iter().for_each(|entry_identity| {
            users
                .borrow_mut()
                .push(User::new_with_role(entry_identity, Role::Committee))
        })
    });

    println!(
        "Registered early identity as a committee member: {:?}",
        entry_identities
    );
}

// Committee actions

#[ic_cdk::update(guard = "committee_guard")]
fn committee_create_propose(_propose: CommitteeActions) -> usize {
    let caller = caller().unwrap();
    let propose = _propose.validate().unwrap();

    let config = CONFIG.with(|config| config.borrow().clone());

    assert!(config.is_some(), "Config is not set");

    COMMITTEE_PROPOSALS.with(|committee_proposals| {
        committee_proposals
            .borrow_mut()
            .create_vote(config.unwrap(), caller, propose)
    })
}

#[ic_cdk::update(guard = "committee_guard")]
fn committee_vote_on_propose(vote_id: usize, vote: bool) {
    let caller = caller().unwrap();

    COMMITTEE_PROPOSALS
        .with(|committee_proposals| committee_proposals.borrow_mut().vote(caller, vote_id, vote))
        .unwrap();
}

#[ic_cdk::query]
fn get_committee_proposals() -> Vec<CommitteeProposeCandidType> {
    COMMITTEE_PROPOSALS.with(|committee_proposals| committee_proposals.borrow().get().clone())
}

#[ic_cdk::query]
fn user_belongs_to_committee() -> bool {
    let caller = caller().unwrap();

    USERS
        .with(|users| users.borrow().is_in_committee(caller))
        .unwrap()
}

#[ic_cdk::query]
fn get_salt() -> String {
    let entry_identity = caller().unwrap();
    USERS
        .with(|users| users.borrow().get_seed_by_entry_identity(entry_identity))
        .unwrap()
}

// User actions

#[ic_cdk::update]
fn activate_user(identity: Principal, identity_seed: String) {
    let caller = caller().unwrap();

    USERS
        .with(|users| {
            users
                .borrow_mut()
                .activate_user(caller, identity, identity_seed)
        })
        .unwrap()
}

// TODO: get_proposals
// TODO: vote_at

// System actions

fn committee_guard() -> Result<(), String> {
    let caller = caller().unwrap();

    if !USERS.with(|users| users.borrow().is_in_committee(caller))? {
        return Err("User do not belongs to committee".to_string());
    }

    Ok(())
}

fn close_vote(id: usize) {
    let config = CONFIG.with(|config| config.borrow().clone());

    assert!(config.is_some(), "Config is not set");

    COMMITTEE_PROPOSALS
        .with(|committee_proposals| {
            committee_proposals
                .borrow_mut()
                .close_vote(config.unwrap(), id)
        })
        .unwrap();
}

fn register_new_entry_identities(entry_identities: &Vec<Principal>) {
    USERS.with(|users| {
        entry_identities
            .iter()
            .for_each(|entry_identity| users.borrow_mut().push(User::new(entry_identity)))
    });
}

fn promote_user(user_entry_identity: &Principal) -> Result<(), String> {
    USERS.with(|users| {
        let mut users = users.borrow_mut();
        let user = users
            .get_mut_user_by_identity(*user_entry_identity)
            .ok_or("User do not exist".to_string())?;
        user.promote();
        Ok(())
    })
}

fn demote_user(user_entry_identity: &Principal) -> Result<(), String> {
    USERS.with(|users| {
        let mut users = users.borrow_mut();
        let user = users
            .get_mut_user_by_identity(*user_entry_identity)
            .ok_or("User do not exist".to_string())?;
        user.demote();
        Ok(())
    })
}

// TODO: ADD PROPOSE CANCELLATION
//
// fn cancel_propose(id: &usize) -> Result<(), String>{
//     USERS.with(|users| {
//         let mut users = users.borrow_mut();
//         let user = users.get_mut_user_by_entry_identity(*user_entry_identity).ok_or("User do not exist".to_string())?;
//         user.demote();
//         Ok(())
//     })
// }

ic_cdk::export_candid!();
