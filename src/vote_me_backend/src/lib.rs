use std::cell::RefCell;

use candid::Principal;
use errors::ContractError;
use ic_cdk::println;
use identities::Users;
use types::{
    CommitteeProposeCandidType, PresidentialElectionsProposeCandidType, UserPropose,
    UserProposeVote,
};

use crate::{
    helpers::caller,
    types::{
        CommitteeActions, CommitteeProposals, Config, PresidentialElectionsProposals, Role, User,
    },
};

mod errors;
mod helpers;
mod identities;
mod types;

thread_local! {
    static CONFIG: RefCell<Option<Config>> = RefCell::new(None);
    static USERS: RefCell<Users> = RefCell::new(Users::default());
    //static PROPOSALS: RefCell<Proposals> = RefCell::new(Proposals::default());
    static COMMITTEE_PROPOSALS: RefCell<CommitteeProposals> =
        RefCell::new(CommitteeProposals::default());
    static PRESIDENTIAL_ELECTIONS: RefCell<PresidentialElectionsProposals> =
        RefCell::new(PresidentialElectionsProposals::default());
    //ELECTIONS_TO_SEJM
    //ELECTIONS_TO_SENATE
    //REFERENDUM

}

#[ic_cdk::init]
fn init(config: Config, entry_identities: Vec<Principal>) {
    let users_count = USERS.with(|users| users.borrow().len());

    assert!(users_count == 0, "{}", ContractError::AlreadyInitialized);
    assert!(
        config.committee_threshold <= 100_00,
        "{}",
        ContractError::ThresholdToLow
    );
    assert!(
        config.presidential_elections_threshold <= 100_00,
        "{}",
        ContractError::InvalidPercentage
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
            .iter()
            .map(|identitie| identitie.to_string())
            .collect::<Vec<_>>()
    );
}

// Committee actions

#[ic_cdk::update(guard = "committee_guard")]
fn committee_create_propose(_propose: CommitteeActions) -> usize {
    let caller = caller().unwrap();
    let propose = _propose.validate().unwrap();

    let config = CONFIG
        .with(|config| config.borrow().clone())
        .ok_or(ContractError::ConfigNotSet)
        .unwrap();

    COMMITTEE_PROPOSALS.with(|committee_proposals| {
        committee_proposals
            .borrow_mut()
            .create_proposal(config, caller, propose)
    })
}

#[ic_cdk::update(guard = "committee_guard")]
fn committee_vote_on_propose(propose_id: usize) {
    let caller = caller().unwrap();

    COMMITTEE_PROPOSALS
        .with(|committee_proposals| committee_proposals.borrow_mut().vote(caller, propose_id))
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

#[ic_cdk::update(guard = "committee_guard")]
fn committee_create_user_propose(_propose: CommitteeActions) -> usize {
    let caller = caller().unwrap();
    let propose = _propose.validate().unwrap();

    let config = CONFIG
        .with(|config| config.borrow().clone())
        .ok_or(ContractError::ConfigNotSet)
        .unwrap();

    COMMITTEE_PROPOSALS.with(|committee_proposals| {
        committee_proposals
            .borrow_mut()
            .create_proposal(config, caller, propose)
    })
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

#[ic_cdk::query]
fn get_presidential_elections() -> Vec<PresidentialElectionsProposeCandidType> {
    PRESIDENTIAL_ELECTIONS.with(|proposals| proposals.borrow().get().clone())
}

#[ic_cdk::update]
fn vote_on_propose(propose: UserProposeVote, propose_id: usize) {
    let caller = caller().unwrap();

    match propose {
        UserProposeVote::PresidentialElections(candidate_index) => PRESIDENTIAL_ELECTIONS
            .with(|committee_proposals| {
                committee_proposals
                    .borrow_mut()
                    .vote(caller, propose_id, &candidate_index)
            })
            .unwrap(),
        UserProposeVote::ElectionsToSejm(_) => todo!(),
        UserProposeVote::ElectionsToSenate(_) => todo!(),
        UserProposeVote::Referendum(_) => todo!(),
    }
}

// TODO: get_proposals
// TODO: vote_at

// System actions

fn committee_guard() -> Result<(), String> {
    let caller = caller().unwrap();

    if !USERS.with(|users| users.borrow().is_in_committee(caller))? {
        return Err(ContractError::NotInCommittee.to_string());
    }

    Ok(())
}

fn close_committee_proposal(id: usize) {
    let config = CONFIG
        .with(|config| config.borrow().clone())
        .ok_or(ContractError::ConfigNotSet)
        .unwrap();
    //let committee_size = USERS.with(|users| users.borrow().len());
    let committee_size = USERS.with(|users| users.borrow().get_committee_size());

    COMMITTEE_PROPOSALS
        .with(|committee_proposals| {
            committee_proposals
                .borrow_mut()
                .close_proposal(config, id, committee_size)
        })
        .unwrap();
}

fn close_presidential_elections(id: usize) {
    let config = CONFIG
        .with(|config| config.borrow().clone())
        .ok_or(ContractError::ConfigNotSet)
        .unwrap();
    let users_count = USERS.with(|users| users.borrow().len());

    PRESIDENTIAL_ELECTIONS
        .with(|presidential_elections| {
            presidential_elections
                .borrow_mut()
                .close_proposal(config, id, users_count)
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
            .ok_or(ContractError::ProposeNotFound.to_string())?;
        user.promote();
        Ok(())
    })
}

fn demote_user(user_entry_identity: &Principal) -> Result<(), String> {
    USERS.with(|users| {
        let mut users = users.borrow_mut();
        let user = users
            .get_mut_user_by_identity(*user_entry_identity)
            .ok_or(ContractError::ProposeNotFound.to_string())?;
        user.demote();
        Ok(())
    })
}

fn create_user_propose(propose: &UserPropose, creator: Principal) -> Result<(), String> {
    let config = CONFIG
        .with(|config| config.borrow().clone())
        .ok_or(ContractError::ConfigNotSet)
        .unwrap();

    match propose {
        UserPropose::PresidentialElections(proposal_content) => {
            PRESIDENTIAL_ELECTIONS.with(|propose| {
                propose
                    .borrow_mut()
                    .create_proposal(config, creator, &proposal_content)
            })
        }
        UserPropose::ElectionsToSejm(_) => todo!(),
        UserPropose::ElectionsToSenate(_) => todo!(),
        UserPropose::Referendum(_) => todo!(),
    };
    Ok(())
}

ic_cdk::export_candid!();
