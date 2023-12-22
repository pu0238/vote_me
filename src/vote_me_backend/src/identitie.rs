use candid::Principal;

use crate::types::User;

pub struct Users(pub Vec<User>);

impl Users {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    pub fn is_in_committee(&self, caller: Principal) -> bool {
        self.0.iter().any(|user| {
            user.identity.is_some_and(|identity| identity == caller) && user.is_in_committee()
        })
    }

    pub fn get_user_by_entry_identity(&self, caller: Principal) -> Option<&User> {
        self.0.iter().find(|user| user.entry_identity == caller)
    }

    fn get_user_by_identity(&self, caller: Principal) -> Option<&User> {
        self.0
            .iter()
            .find(|user| user.identity.is_some_and(|identity| identity == caller))
    }

    pub fn activate_user(&mut self, caller: Principal, identity: Principal, identity_seed: String) {
        if let Some(user) = self.0.iter_mut().find(|user| user.entry_identity == caller) {
            user.activate(identity, identity_seed)
        } else {
            panic!("User not found")
        }
    }
}
