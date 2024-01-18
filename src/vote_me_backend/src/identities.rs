use candid::Principal;

use crate::types::User;

pub struct Users(Vec<User>);

impl Users {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn push(&mut self, user: User) {
        self.0.push(user)
    }

    pub fn is_in_committee(&self, identity: Principal) -> Result<bool, String> {
        Ok(self
            .get_user_by_identity(identity)
            .ok_or("User not found".to_string())?
            .is_in_committee())
    }

    pub fn get_mut_user_by_identity(&mut self, caller: Principal) -> Option<&mut User> {
        self.0
            .iter_mut()
            .find(|user| user.get_user_identity() == Some(caller))
    }

    fn get_user_by_identity(&self, identity: Principal) -> Option<&User> {
        self.0.iter().find(|user| {
            user.get_user_identity()
                .is_some_and(|iter_identity| iter_identity == identity)
        })
    }

    pub fn activate_user(
        &mut self,
        caller: Principal,
        identity: Principal,
        identity_seed: String,
    ) -> Result<(), String> {
        if let Some(user) = self
            .0
            .iter_mut()
            .find(|user| user.get_user_entry_identity() == caller)
        {
            user.activate(identity, identity_seed);
            Ok(())
        } else {
            Err("User not found".to_string())
        }
    }

    pub fn get_seed_by_entry_identity(&self, identity: Principal) -> Result<String, String> {
        let user = self
            .0
            .iter()
            .find(|user| user.get_user_entry_identity() == identity)
            .ok_or("User do not exist".to_string())?;

        Ok(user
            .get_user_seed()
            .ok_or("User do not exist".to_string())?
            .to_string())
    }
}
