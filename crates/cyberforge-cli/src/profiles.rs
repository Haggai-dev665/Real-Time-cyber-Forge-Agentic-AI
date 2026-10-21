//! `cyberforge profile list | use` and `cyberforge config list | get | set`.
//!
//! A profile binds a name to one backend origin. Changing a profile's origin
//! removes the session kept for the old origin, so a token is never carried to
//! another backend (plan-update-v2.md §4.2).

use crate::out::{exit, Outcome};
use crate::{profile_failure, Ctx};
use cyberforge_core::origin::Origin;
use cyberforge_core::profile::{Profile, ProfileError};
use cyberforge_core::session;
use serde_json::json;

pub fn list(ctx: &Ctx) -> Outcome {
    const CMD: &str = "profile list";
    let store = match ctx.profiles(CMD) {
        Ok(store) => store,
        Err(outcome) => return outcome,
    };
    let (current, profiles) = match store.list() {
        Ok(found) => found,
        Err(error) => return profile_failure(CMD, error),
    };
    let secrets = ctx.store();
    let rows: Vec<_> = profiles
        .iter()
        .map(|p| {
            let session = match session::token(&secrets, p) {
                Ok(Some(_)) => "kept",
                Ok(None) => "none",
                Err(_) => "unknown",
            };
            (p, session)
        })
        .collect();
    let text = rows
        .iter()
        .map(|(p, session)| format!("{} {:<16} {:<48} session: {}", if p.name == current { "*" } else { " " }, p.name, p.origin.as_str(), session))
        .collect::<Vec<_>>()
        .join("\n");
    let data = json!({
        "current": current,
        "profiles": rows.iter().map(|(p, session)| json!({ "name": p.name, "origin": p.origin, "current": p.name == current, "session": session })).collect::<Vec<_>>(),
    });
    Outcome::done(CMD, data, text)
}

pub fn use_profile(ctx: &Ctx, name: &str) -> Outcome {
    const CMD: &str = "profile use";
    let store = match ctx.profiles(CMD) {
        Ok(store) => store,
        Err(outcome) => return outcome,
    };
    match store.use_profile(name) {
        Ok(profile) => Outcome::done(
            CMD,
            json!({ "current": profile.name, "origin": profile.origin }),
            format!("Now using profile {} ({}).", profile.name, profile.origin),
        ),
        Err(error) => profile_failure(CMD, error),
    }
}

pub fn config_origin(ctx: &Ctx, list: bool) -> Outcome {
    let command = if list { "config list" } else { "config get" };
    match ctx.profile(command) {
        Ok(profile) => Outcome::done(
            command,
            json!({ "profile": profile.name, "origin": profile.origin }),
            if list { format!("profile  {}\norigin   {}", profile.name, profile.origin) } else { profile.origin.to_string() },
        ),
        Err(outcome) => outcome,
    }
}

pub fn set_origin(ctx: &Ctx, value: &str) -> Outcome {
    const CMD: &str = "config set";
    let store = match ctx.profiles(CMD) {
        Ok(store) => store,
        Err(outcome) => return outcome,
    };
    let origin = match Origin::parse(value) {
        Ok(origin) => origin,
        Err(rule) => return Outcome::failed(CMD, exit::USAGE, "ORIGIN_INVALID", rule),
    };
    let name = ctx.requested().map(str::to_string);
    let previous = match store.resolve(name.as_deref()) {
        Ok(profile) => Some(profile),
        // Setting the origin of a profile that does not exist yet creates it.
        Err(ProfileError::Usage(_)) if name.as_deref().is_some_and(cyberforge_core::profile::valid_name) => None,
        Err(error) => return profile_failure(CMD, error),
    };
    let name = previous.as_ref().map(|p| p.name.clone()).or(name).unwrap_or_else(|| "default".into());
    let profile = Profile { name, origin };
    let mut previous_session_removed = false;
    if let Some(old) = previous.as_ref().filter(|old| old.origin != profile.origin) {
        match session::forget(&ctx.store(), old) {
            Ok(had) => previous_session_removed = had,
            Err(error) => {
                return Outcome::failed(
                    CMD,
                    exit::FAILURE,
                    "STORE_UNAVAILABLE",
                    format!("The origin was not changed: the session kept for the old origin could not be removed ({}).", error),
                )
            }
        }
    }
    if let Err(error) = store.save(&profile, false) {
        return profile_failure(CMD, error);
    }
    let mut text = format!("Profile {} now uses {}.", profile.name, profile.origin);
    if previous_session_removed {
        text.push_str(" The session kept for the previous origin was removed; sign in again.");
    }
    Outcome::done(
        CMD,
        json!({
            "profile": profile.name,
            "key": "origin",
            "value": profile.origin,
            "previous": previous.map(|p| p.origin),
            "previous_session_removed": previous_session_removed,
        }),
        text,
    )
}
