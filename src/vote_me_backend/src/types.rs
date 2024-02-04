use std::collections::{BTreeMap, HashMap};

use candid::{CandidType, Deserialize, Principal};
use ic_cdk::println;
use ic_cdk_timers::TimerId;

use crate::{
    close_committee_proposal, close_presidential_elections, create_user_propose, demote_user,
    errors::ContractError, promote_user, register_new_entry_identities,
};

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct Config {
    pub committee_threshold: u16,
    pub max_committee_size: u64,
    pub committee_proposals_duration: u64,
    pub user_proposals_duration: u64,
    pub presidential_elections_threshold: u16,
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

#[derive(CandidType, Deserialize, Clone, PartialEq, Debug)]
pub enum VoteState {
    Open,
    Accepted,
    Rejected,
    Unresolved,
    Cancelled,
}

pub struct PresidentialElectionsPropose {
    pub id: usize,
    _timer_id: TimerId,
    pub creator: Principal,
    pub proposal_content: Vec<String>,
    pub created_at: u64,
    pub state: VoteState,
    pub votes_yes: Vec<u64>,
    pub voters: Vec<Principal>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct PresidentialElectionsProposeCandidType {
    pub id: usize,
    pub creator: Principal,
    pub proposal_content: Vec<String>,
    pub created_at: u64,
    pub state: VoteState,
    pub votes_yes: Vec<u64>,
    pub voters: Vec<Principal>,
}

impl PresidentialElectionsProposeCandidType {
    pub fn new(vote: &PresidentialElectionsPropose) -> Self {
        Self {
            id: vote.id,
            creator: vote.creator,
            created_at: vote.created_at,
            state: vote.state.clone(),
            votes_yes: vote.votes_yes.clone(),
            voters: vote.voters.clone(),
            proposal_content: vote.proposal_content.clone(),
        }
    }
}

pub struct PresidentialElectionsProposals(Vec<PresidentialElectionsPropose>);

impl PresidentialElectionsProposals {
    pub fn default() -> Self {
        Self(Vec::default())
    }

    fn next_id(&self) -> usize {
        self.0.len()
    }

    pub fn get(&self) -> Vec<PresidentialElectionsProposeCandidType> {
        self.0
            .iter()
            .map(|vote| PresidentialElectionsProposeCandidType::new(vote))
            .collect()
    }

    pub fn create_proposal(
        &mut self,
        config: Config,
        creator: Principal,
        proposal_content: &Vec<String>,
    ) {
        let id = self.next_id();

        let interval = std::time::Duration::from_nanos(config.committee_proposals_duration);
        let _timer_id = ic_cdk_timers::set_timer(interval, move || {
            close_presidential_elections(id);
        });

        let votes: Vec<u64> = proposal_content.iter().map(|_| 0).collect();

        self.0.push(PresidentialElectionsPropose {
            id: self.next_id(),
            creator,
            _timer_id,
            proposal_content: proposal_content.clone(),
            created_at: ic_cdk::api::time(),
            state: VoteState::Open,
            votes_yes: votes,
            voters: Vec::default(),
        })
    }

    pub fn close_proposal(
        &mut self,
        config: Config,
        id: usize,
        users_count: usize,
    ) -> Result<(), String> {
        let (creator, new_propose) = {
            let propose = self
                .0
                .get_mut(id)
                .ok_or(ContractError::ProposeNotFound.to_string())?;

            if ic_cdk::api::time() <= propose.created_at + config.committee_proposals_duration {
                return Err(ContractError::ProposeInProgress.to_string());
            }

            if propose.proposal_content.len() <= 2 {
                let mut content = propose.votes_yes.iter();
                let first_item = content.next();
                let second_item = content.next();

                if (propose.proposal_content.len() == 1)
                    || (propose.proposal_content.len() == 2 && first_item != second_item)
                {
                    propose.state = VoteState::Accepted;
                    return Ok(());
                }
                propose.state = VoteState::Unresolved;
                return Ok(());
            }

            let max_yes = *propose.votes_yes.iter().max().unwrap_or(&0) as usize;
            let percent_of_yes_votes = ((max_yes * 100_00) / users_count) as u16;

            if percent_of_yes_votes >= config.presidential_elections_threshold {
                propose.state = VoteState::Accepted;
                println!("Presidential vote with id: {:?} has been {:?}. This vote received {:?} percent of the votes", propose.id, propose.state, percent_of_yes_votes);
                return Ok(());
            }

            let mut sorted_votes: Vec<_> = propose.votes_yes.iter().enumerate().collect();
            sorted_votes.sort_by(|(_, votes), (_, next_votes)| next_votes.cmp(votes));

            let indexes_of_two_latest: Vec<_> = sorted_votes
                .iter()
                .take(2)
                .map(|(index, _)| {
                    propose
                        .proposal_content
                        .get(*index)
                        .expect("Propose do not exist!?")
                        .clone()
                })
                .collect();

            propose.state = VoteState::Unresolved;
            println!("Presidential vote with id: {:?} has been {:?}. This vote received {:?} percent of the votes", propose.id, propose.state, percent_of_yes_votes);

            (propose.creator, indexes_of_two_latest)
        };
        self.create_proposal(config, creator, &new_propose);

        Ok(())
    }

    pub fn vote(
        &mut self,
        voter: Principal,
        propose_id: usize,
        candidate_index: &usize,
    ) -> Result<(), String> {
        let propose = self
            .0
            .iter_mut()
            .find(|propose| propose.id == propose_id)
            .ok_or(ContractError::ProposeNotFound.to_string())?;

        if propose.state != VoteState::Open {
            return Err(ContractError::VoteNotOpen.to_string());
        }
        if propose.voters.contains(&voter) {
            return Err(ContractError::UserAlreadyVoted.to_string());
        }

        let votes = propose
            .votes_yes
            .get_mut(candidate_index.clone())
            .ok_or(ContractError::CandidatesNotFound.to_string())?;
        *votes += 1;

        propose.voters.push(voter);

        Ok(())
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub struct SejmList {
    reporting: String,
    candidates: HashMap<u32, String>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct SenateEntry {
    reporting: String,
    candidate: String,
}

#[derive(CandidType, Deserialize, Clone)]
pub enum UserProposeVote {
    PresidentialElections(usize),
    ElectionsToSejm(BTreeMap<u32, SejmList>),
    ElectionsToSenate(Vec<SenateEntry>),
    Referendum(Vec<String>),
}

#[derive(CandidType, Deserialize, Clone)]
pub enum UserPropose {
    PresidentialElections(Vec<String>),
    ElectionsToSejm(BTreeMap<u32, SejmList>),
    ElectionsToSenate(Vec<SenateEntry>),
    Referendum(Vec<String>),
}

impl UserPropose {
    pub fn is_valid(&self) -> bool {
        match &self {
            UserPropose::PresidentialElections(candidates) => candidates.len() > 0,
            UserPropose::ElectionsToSejm(candidates) => candidates.len() > 0,
            UserPropose::ElectionsToSenate(entries) => entries.len() > 0,
            UserPropose::Referendum(entries) => entries.len() > 0,
        }
    }
}

#[derive(CandidType, Deserialize, Clone)]
pub enum CommitteeActions {
    RegisterNewEntryIdentities(Vec<Principal>),
    PromoteUser(Principal),
    DemoteUser(Principal),
    CancelPropose(usize),
    CreateUserPropose(UserPropose),
}

impl CommitteeActions {
    pub fn validate(self) -> Result<Self, String> {
        let is_valid = match &self {
            CommitteeActions::RegisterNewEntryIdentities(principals) => principals.len() > 0,
            CommitteeActions::PromoteUser(user) => user != &Principal::anonymous(),
            CommitteeActions::DemoteUser(user) => user != &Principal::anonymous(),
            CommitteeActions::CreateUserPropose(propose) => propose.is_valid(),
            CommitteeActions::CancelPropose(_) => true,
        };

        if !is_valid {
            return Err(ContractError::InvalidAction.to_string());
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
            voters: vote.voters.clone(),
        }
    }
}

#[derive(Clone)]
pub struct CommitteePropose {
    id: usize,
    creator: Principal,
    action: CommitteeActions,
    _timer_id: TimerId,
    created_at: u64,
    state: VoteState,
    votes_yes: u64,
    voters: Vec<Principal>,
}

#[derive(Clone)]
pub struct CommitteeProposals(Vec<CommitteePropose>);

impl CommitteeProposals {
    pub fn default() -> Self {
        Self(Vec::default())
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

    fn execute_proposal(_propose: &mut CommitteePropose) -> Result<(), String> {
        Ok(match &_propose.action {
            CommitteeActions::RegisterNewEntryIdentities(identities) => {
                register_new_entry_identities(identities)
            }
            CommitteeActions::PromoteUser(user) => promote_user(user)?,
            CommitteeActions::DemoteUser(user) => demote_user(user)?,
            CommitteeActions::CancelPropose(_) => todo!(),
            CommitteeActions::CreateUserPropose(propose) => {
                create_user_propose(propose, _propose.creator)?
            }
        })
    }

    pub fn close_proposal(
        &mut self,
        config: Config,
        id: usize,
        committee_size: usize,
    ) -> Result<(), String> {
        let propose = self
            .0
            .get_mut(id)
            .ok_or(ContractError::ProposeNotFound.to_string())?;

        if ic_cdk::api::time() <= propose.created_at + config.committee_proposals_duration {
            return Err(ContractError::ProposeInProgress.to_string());
        }

        let max_yes = propose.votes_yes as usize;
        let percent_of_yes_votes = ((max_yes * 100_00) / committee_size) as u16;

        if percent_of_yes_votes >= config.presidential_elections_threshold {
            propose.state = VoteState::Accepted;
            println!("Committee vote with id: {:?} has been {:?}. This vote received {:?} percent of the votes", propose.id, propose.state, percent_of_yes_votes);
            return Self::execute_proposal(propose);
        }

        propose.state = VoteState::Rejected;
        println!("Committee vote with id: {:?} has been {:?}. This vote received {:?} percent of the votes", propose.id, propose.state, percent_of_yes_votes);
        Ok(())
    }

    pub fn create_proposal(
        &mut self,
        config: Config,
        creator: Principal,
        action: CommitteeActions,
    ) -> usize {
        let id = self.next_id();

        let interval = std::time::Duration::from_nanos(config.committee_proposals_duration);
        let _timer_id = ic_cdk_timers::set_timer(interval, move || {
            close_committee_proposal(id);
        });

        self.0.push(CommitteePropose {
            id,
            creator,
            action,
            _timer_id,
            created_at: ic_cdk::api::time(),
            state: VoteState::Open,
            votes_yes: 0,
            voters: Vec::default(),
        });

        id
    }

    pub fn vote(&mut self, voter: Principal, propose_id: usize) -> Result<(), String> {
        let propose = self
            .0
            .iter_mut()
            .find(|propose| propose.id == propose_id)
            .ok_or(ContractError::ProposeNotFound.to_string())?;

        if propose.state != VoteState::Open {
            return Err(ContractError::VoteNotOpen.to_string());
        }
        if propose.voters.contains(&voter) {
            return Err(ContractError::UserAlreadyVoted.to_string());
        }

        propose.votes_yes += 1;
        propose.voters.push(voter);

        Ok(())
    }
}
