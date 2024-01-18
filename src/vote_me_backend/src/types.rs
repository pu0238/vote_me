use candid::{CandidType, Deserialize, Principal};
use ic_cdk_timers::TimerId;

use crate::{close_vote, demote_user, promote_user, register_new_entry_identities};

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct Config {
    pub threshold: u64,
    pub max_committee_size: u64,
    pub committee_proposals_duration: u64,
    pub user_proposals_duration: u64,
}

#[derive(PartialEq, Clone, Copy)]
pub enum Role {
    Committee,
    User,
}

#[derive(Clone)]
pub struct User {
    // Entry data provided by Committee used to register a user
    entry_identity: Principal,
    // Identity of the user
    identity: Option<Principal>,
    // Seed used to generate the identity
    identity_seed: Option<String>,
    role: Role,
}

impl User {
    pub fn new(entry_identity: &Principal) -> Self {
        Self {
            entry_identity: *entry_identity,
            identity: None,
            identity_seed: None,
            role: Role::User,
        }
    }

    pub fn promote(&mut self) {
        self.role = Role::Committee
    }

    pub fn demote(&mut self) {
        self.role = Role::User
    }

    pub fn new_with_role(entry_identity: &Principal, role: Role) -> Self {
        Self {
            entry_identity: *entry_identity,
            identity: None,
            identity_seed: None,
            role,
        }
    }

    pub fn get_user_identity(&self) -> Option<Principal> {
        self.identity
    }

    pub fn get_user_entry_identity(&self) -> Principal {
        self.entry_identity
    }

    pub fn get_user_seed(&self) -> Option<&String> {
        self.identity_seed.as_ref()
    }

    pub fn activate(&mut self, identity: Principal, identity_seed: String) {
        self.identity = Some(identity);
        self.identity_seed = Some(identity_seed);
    }

    pub fn is_in_committee(&self) -> bool {
        self.role == Role::Committee
    }
}

#[derive(CandidType, Deserialize, Clone, PartialEq)]
pub enum VoteState {
    Open,
    Accepted,
    Rejected,
    Unresolved,
    Cancelled,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct VoteContent {
    pub title: String,
    pub description: String,
}

pub struct Propose {
    pub id: u64,
    pub creator: Principal,
    pub vote_content: VoteContent,
    pub created_at: u64,
    pub state: VoteState,
    pub votes_yes: u64,
    pub votes_no: u64,
    pub voters: Vec<Principal>,
}

pub struct Proposals(pub Vec<Propose>);

impl Proposals {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    fn next_id(&self) -> u64 {
        self.0.len() as u64
    }

    pub fn create_vote(&mut self, creator: Principal, vote_content: VoteContent) {
        self.0.push(Propose {
            id: self.next_id(),
            creator,
            vote_content,
            created_at: ic_cdk::api::time(),
            state: VoteState::Open,
            votes_yes: 0,
            votes_no: 0,
            voters: Vec::new(),
        })
    }

    pub fn vote(
        &mut self,
        voter: Principal,
        propose_id: u64,
        user_vote: bool,
    ) -> Result<(), String> {
        let propose = match self.0.iter_mut().find(|propose| propose.id == propose_id) {
            Some(_propose) => Ok(_propose),
            None => Err("Propose not found".to_string()),
        }?;

        if propose.state != VoteState::Open {
            return Err("Vote is not open".to_string());
        }
        if propose.voters.contains(&voter) {
            return Err("User already voted".to_string());
        }

        if user_vote {
            propose.votes_yes += 1;
        } else {
            propose.votes_no += 1;
        }
        propose.voters.push(voter);

        Ok(())
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub enum CommitteeActions {
    RegisterNewEntryIdentities(Vec<Principal>),
    PromoteUser(Principal),
    DemoteUser(Principal),
    CancelPropose(usize),
}

impl CommitteeActions {
    pub fn validate(self) -> Result<CommitteeActions, String> {
        let is_valid = match &self {
            CommitteeActions::RegisterNewEntryIdentities(principals) => principals.len() > 0,
            CommitteeActions::PromoteUser(user) => user != &Principal::anonymous(),
            CommitteeActions::DemoteUser(user) => user != &Principal::anonymous(),
            CommitteeActions::CancelPropose(_) => true,
        };

        if !is_valid {
            return Err("Invalid CommitteeAction".to_string());
        }

        Ok(self)
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct CommitteeProposeCandidType {
    id: usize,
    creator: Principal,
    action: CommitteeActions,
    created_at: u64,
    state: VoteState,
    votes_yes: u64,
    votes_no: u64,
    voters: Vec<Principal>,
}

impl CommitteeProposeCandidType {
    pub fn new(vote: &CommitteePropose) -> Self {
        Self {
            id: vote.id,
            creator: vote.creator,
            action: vote.action.clone(),
            created_at: vote.created_at,
            state: vote.state.clone(),
            votes_yes: vote.votes_yes,
            votes_no: vote.votes_no,
            voters: vote.voters.clone(),
        }
    }
}

#[derive(Clone)]
pub struct CommitteePropose {
    id: usize,
    creator: Principal,
    action: CommitteeActions,
    timer_id: TimerId,
    created_at: u64,
    state: VoteState,
    votes_yes: u64,
    votes_no: u64,
    voters: Vec<Principal>,
}

#[derive(Clone)]
pub struct CommitteeProposals(Vec<CommitteePropose>);

impl CommitteeProposals {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    pub fn get(&self) -> Vec<CommitteeProposeCandidType> {
        self.0
            .iter()
            .map(|vote| CommitteeProposeCandidType::new(vote))
            .collect()
    }

    fn next_id(&self) -> usize {
        self.0.len()
    }

    fn execute_vote(propose: &mut CommitteePropose) -> Result<(), String> {
        Ok(match &propose.action {
            CommitteeActions::RegisterNewEntryIdentities(identities) => {
                register_new_entry_identities(identities)
            }

            CommitteeActions::PromoteUser(user) => promote_user(user)?,
            CommitteeActions::DemoteUser(user) => demote_user(user)?,
            CommitteeActions::CancelPropose(id) => todo!(),
        })
    }

    pub fn close_vote(&mut self, config: Config, id: usize) -> Result<(), String> {
        let propose = self
            .0
            .get_mut(id)
            .ok_or("Can not found propose".to_string())?;

        if ic_cdk::api::time() <= propose.created_at + config.committee_proposals_duration {
            return Err("Propose is still in progress".to_string());
        }

        if propose.votes_no >= config.threshold {
            propose.state = VoteState::Rejected;
        } else if propose.votes_yes >= config.threshold {
            if Ok(()) == Self::execute_vote(propose) {
                propose.state = VoteState::Accepted;
            } else {
                propose.state = VoteState::Rejected;
            }
        } else {
            propose.state = VoteState::Unresolved;
        }

        Ok(())
    }

    pub fn create_vote(
        &mut self,
        config: Config,
        creator: Principal,
        action: CommitteeActions,
    ) -> usize {
        let id = self.next_id();

        let interval = std::time::Duration::from_nanos(config.committee_proposals_duration);
        let timer_id = ic_cdk_timers::set_timer(interval, move || {
            close_vote(id);
        });

        self.0.push(CommitteePropose {
            id,
            creator,
            action,
            timer_id,
            created_at: ic_cdk::api::time(),
            state: VoteState::Open,
            votes_yes: 0,
            votes_no: 0,
            voters: Vec::new(),
        });

        id
    }

    pub fn vote(
        &mut self,
        voter: Principal,
        propose_id: usize,
        user_vote: bool,
    ) -> Result<(), String> {
        let propose = match self.0.iter_mut().find(|propose| propose.id == propose_id) {
            Some(_propose) => Ok(_propose),
            None => Err("Propose not found".to_string()),
        }?;

        if propose.state != VoteState::Open {
            return Err("Vote is not open".to_string());
        }
        if propose.voters.contains(&voter) {
            return Err("User already voted".to_string());
        }

        if user_vote {
            propose.votes_yes += 1;
        } else {
            propose.votes_no += 1;
        }
        propose.voters.push(voter);

        Ok(())
    }
}
