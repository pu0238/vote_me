use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("Anonymous principal not allowed to make calls.")]
    AnonymousCaller,

    #[error("User not found.")]
    UserNotFound,

    #[error("User do not belongs to committee.")]
    NotInCommittee,

    #[error("Config is not set.")]
    ConfigNotSet,

    #[error("Propose not found.")]
    ProposeNotFound,

    #[error("Vote is not open.")]
    VoteNotOpen,

    #[error("User already voted.")]
    UserAlreadyVoted,

    #[error("Invalid action.")]
    InvalidAction,

    #[error("Propose is still in progress.")]
    ProposeInProgress,

    #[error("The canister is already initialized.")]
    AlreadyInitialized,

    #[error("Threshold is lower then min threshold length (committee_size / 2) + 1.")]
    ThresholdToLow,

    #[error("Candidates do not found.")]
    CandidatesNotFound,

    #[error("Invalid percentage.")]
    InvalidPercentage,
}
