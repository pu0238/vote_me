use candid::Principal;

#[derive(PartialEq)]
pub enum Role {
    Committee,
    User,
}

pub struct User {
    // Entry data provided by Committee used to register a user
    pub entry_identity: Principal,
    // Identity of the user
    pub identity: Option<Principal>,
    // Seed used to generate the identity
    pub identity_seed: Option<String>,
    pub role: Role,
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

    pub fn new_with_role(entry_identity: &Principal, role: Role) -> Self {
        Self {
            entry_identity: *entry_identity,
            identity: None,
            identity_seed: None,
            role,
        }
    }

    pub fn activate(&mut self, identity: Principal, identity_seed: String) {
        self.identity = Some(identity);
        self.identity_seed = Some(identity_seed);
    }

    pub fn is_in_committee(&self) -> bool {
        self.role == Role::Committee
    }
}

pub struct Vote {
    pub creator: Principal,
    pub title: String,
    pub description: String,
    pub accpted_at: Option<u64>,
}

pub struct Votes(pub Vec<Vote>);

impl Votes {
    pub fn new() -> Self {
        Self(Vec::new())
    }
}