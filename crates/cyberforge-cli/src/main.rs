//! `cyberforge`: the CyberForge command-line interface.
//!
//! V2-01 so far: `version`, `status`, `auth`, `profile`, `config`, `broker`,
//! `models`, `scan` and `mcp`, on the shared core. Later slices add the command families in plan-update-v2.md
//! §6.1; none is listed before it works. Output and exit codes: see `out.rs`.

mod auth;
mod broker;
mod mcp;
mod models;
mod out;
mod profiles;
mod render;
mod scan;

use clap::{Parser, Subcommand, ValueEnum};
use cyberforge_core::credentials::{app_config_dir, KeyringStore};
use cyberforge_core::profile::{Profile, ProfileError, ProfileStore};
use cyberforge_core::status::{self, Backend};
use out::{emit, exit, Outcome, SCHEMA};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

/// The CLI's own config directory and credential-store service. Separate from
/// the desktop app's (`com.cyberforge.console`): a CLI session is not the
/// desktop's session (plan §4.2).
const APP_ID: &str = "com.cyberforge.cli";
const USER_AGENT: &str = concat!("cyberforge-cli/", env!("CARGO_PKG_VERSION"));

#[derive(Parser)]
#[command(name = "cyberforge", version, about = "CyberForge from the terminal", long_about = None)]
struct Cli {
    /// Profile to use (default: the current profile, or CYBERFORGE_PROFILE).
    #[arg(long, global = true, value_name = "NAME")]
    profile: Option<String>,
    /// Print one JSON envelope instead of text.
    #[arg(long, global = true)]
    json: bool,
    /// Network timeout for each request, in seconds.
    #[arg(long, global = true, value_name = "SECONDS", default_value_t = 15,
          value_parser = clap::value_parser!(u64).range(1..=300))]
    timeout: u64,
    /// Do not colour output. (Output is not coloured yet; accepted for scripts.)
    #[arg(long, global = true)]
    no_color: bool,
    /// Never prompt; fail instead when input is missing.
    #[arg(long, global = true)]
    non_interactive: bool,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Show the CLI's version, output schema and platform.
    Version,
    /// Check the backend, the credential store, the session and the desktop broker.
    /// Writes nothing.
    Status,
    /// Sign the profile in or out, or check its session.
    #[command(subcommand)]
    Auth(AuthCommand),
    /// List profiles, or choose the current one.
    #[command(subcommand)]
    Profile(ProfileCommand),
    /// Read or change the selected profile's settings.
    #[command(subcommand)]
    Config(ConfigCommand),
    /// Which program owns this computer's CyberForge state, or hold it from here.
    #[command(subcommand)]
    Broker(BrokerCommand),
    /// The ML service's detectors and models: kind, readiness and limits.
    #[command(subcommand)]
    Models(ModelsCommand),
    /// Analyse an address with the ML service, through the backend.
    #[command(subcommand)]
    Scan(ScanCommand),
    /// Let an approved AI client use CyberForge through MCP.
    #[command(subcommand)]
    Mcp(McpCommand),
}

#[derive(Subcommand)]
enum McpCommand {
    /// Run the MCP server for one approved client. Started by the AI client, not by
    /// hand: standard output carries only protocol messages, diagnostics go to stderr.
    Serve {
        /// Speak MCP over standard input and output (the only transport).
        #[arg(long, required = true)]
        stdio: bool,
        /// The client's grant, from `cyberforge mcp grant create`.
        #[arg(long, value_name = "ID")]
        grant: String,
    },
    /// Approve, list or revoke AI clients.
    #[command(subcommand)]
    Grant(GrantCommand),
    /// Print the configuration to paste into an approved client. It holds no secret.
    Config {
        /// The client's grant.
        #[arg(long, value_name = "ID")]
        grant: String,
    },
}

#[derive(Subcommand)]
enum GrantCommand {
    /// Approve an AI client for the selected profile's signed-in account. It gets
    /// the read-only tools; --allow scan.url also lets it send addresses for analysis.
    Create {
        /// The client's name, as you will recognise it later.
        #[arg(long)]
        name: String,
        /// Also allow an operation that sends data you choose (only scan.url).
        #[arg(long, value_name = "OPERATION", value_parser = ["scan.url"])]
        allow: Vec<String>,
        /// Days until the approval expires.
        #[arg(long, default_value_t = 90, value_parser = clap::value_parser!(u64).range(1..=365))]
        days: u64,
    },
    /// List approved clients and whether each approval is active, expired or revoked.
    List,
    /// Withdraw a client's approval. Its next call is refused.
    Revoke { id: String },
}

#[derive(Subcommand)]
enum ScanCommand {
    /// Analyse one URL. Credentials are removed from it before it is sent. The
    /// verdict (threat, benign or unknown) is data: exit 0 unless --fail-on matches.
    Url {
        /// The address, http:// or https://.
        url: String,
        /// Exit 1 when the verdict is this, for scripts and CI.
        #[arg(long, value_enum, value_name = "VERDICT")]
        fail_on: Option<scan::FailOn>,
    },
}

#[derive(Subcommand)]
enum ModelsCommand {
    /// What the ML service can do now, as the backend reports it. Needs a signed-in profile.
    Status,
}

#[derive(Subcommand)]
enum BrokerCommand {
    /// Which CyberForge program owns this computer's state, and what it runs.
    Status,
    /// Take this computer's CyberForge state and hold it, running nothing on it,
    /// until Ctrl+C or --for elapses. Fails if another program owns it.
    Hold {
        /// Release after this many seconds.
        #[arg(long = "for", value_name = "SECONDS", value_parser = clap::value_parser!(u64).range(1..=86_400))]
        seconds: Option<u64>,
    },
}

#[derive(Subcommand)]
enum AuthCommand {
    /// Sign in with email and password. The password is read hidden from the
    /// terminal, or from standard input with --password-stdin; never from an argument.
    Login {
        /// The account's email (asked for in a terminal when omitted).
        #[arg(long)]
        email: Option<String>,
        /// Read the password from the first line of standard input.
        #[arg(long)]
        password_stdin: bool,
    },
    /// Whether the profile is signed in and the backend accepts the session.
    Status,
    /// Remove the profile's session from this computer and tell the backend.
    Logout,
}

#[derive(Subcommand)]
enum ProfileCommand {
    /// List profiles, their backends and whether each keeps a session.
    List,
    /// Make a profile the current one.
    Use { name: String },
}

#[derive(Subcommand)]
enum ConfigCommand {
    /// Show the selected profile's settings.
    List,
    /// Show one setting of the selected profile.
    Get { key: ConfigKey },
    /// Change one setting of the selected profile, creating the profile if needed.
    /// Changing the origin removes the session kept for the old one.
    Set { key: ConfigKey, value: String },
}

#[derive(Clone, Copy, ValueEnum)]
enum ConfigKey {
    /// The backend, https://host[:port] (http:// only to localhost).
    Origin,
}

/// What every command needs: where the profiles are, which one was asked for,
/// and how to reach the network and the credential store.
pub struct Ctx {
    dir: Option<PathBuf>,
    requested: Option<String>,
    timeout: u64,
    pub non_interactive: bool,
}

impl Ctx {
    fn from(cli: &Cli) -> Ctx {
        let dir = std::env::var_os("CYBERFORGE_CONFIG_DIR")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .or_else(|| app_config_dir(APP_ID));
        let requested = cli.profile.clone().or_else(|| std::env::var("CYBERFORGE_PROFILE").ok().filter(|s| !s.is_empty()));
        Ctx { dir, requested, timeout: cli.timeout, non_interactive: cli.non_interactive }
    }

    pub fn profiles(&self, command: &'static str) -> Result<ProfileStore, Outcome> {
        match &self.dir {
            Some(dir) => Ok(ProfileStore::in_dir(dir)),
            None => Err(Outcome::failed(command, exit::FAILURE, "NO_CONFIG_DIR", "No configuration directory could be found for this user.")),
        }
    }

    /// The CLI's configuration directory, where profiles and MCP grants are kept.
    pub fn dir(&self, command: &'static str) -> Result<PathBuf, Outcome> {
        self.dir.clone().ok_or_else(|| Outcome::failed(command, exit::FAILURE, "NO_CONFIG_DIR", "No configuration directory could be found for this user."))
    }

    pub fn requested(&self) -> Option<&str> {
        self.requested.as_deref()
    }

    /// The selected profile, or the outcome that explains why there is none.
    pub fn profile(&self, command: &'static str) -> Result<Profile, Outcome> {
        self.profiles(command)?.resolve(self.requested()).map_err(|e| profile_failure(command, e))
    }

    pub fn client(&self) -> reqwest::Client {
        cyberforge_core::http::client(USER_AGENT, Duration::from_secs(self.timeout))
    }

    pub fn store(&self) -> KeyringStore {
        KeyringStore::new(APP_ID)
    }
}

pub fn profile_failure(command: &'static str, error: ProfileError) -> Outcome {
    match error {
        ProfileError::Usage(message) => Outcome::failed(command, exit::USAGE, "PROFILE", message),
        ProfileError::File(message) => Outcome::failed(command, exit::FAILURE, "PROFILE_FILE", message),
    }
}

fn version() -> Outcome {
    let data = json!({
        "version": env!("CARGO_PKG_VERSION"),
        "schema": SCHEMA,
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    });
    let text = format!(
        "cyberforge {}\noutput schema {}\nplatform {}-{}",
        env!("CARGO_PKG_VERSION"), SCHEMA, std::env::consts::OS, std::env::consts::ARCH
    );
    Outcome::done("version", data, text)
}

async fn status(ctx: &Ctx) -> Outcome {
    let profile = match ctx.profile("status") {
        Ok(profile) => profile,
        Err(outcome) => return outcome,
    };
    let report = status::check(&profile, &ctx.store(), &ctx.client()).await;
    let code = match report.backend {
        Backend::Reachable { .. } => exit::OK,
        Backend::Unhealthy { .. } | Backend::Unreachable { .. } => exit::UNAVAILABLE,
    };
    let warnings = report.warnings();
    let text = render::status(&report);
    let data = serde_json::to_value(&report).unwrap_or(Value::Null);
    Outcome { command: "status", code, data, error: None, warnings, text }
}

fn main() -> ExitCode {
    let cli = match Cli::try_parse() {
        Ok(cli) => cli,
        Err(error) => {
            use clap::error::ErrorKind;
            if matches!(error.kind(), ErrorKind::DisplayHelp | ErrorKind::DisplayVersion | ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand) {
                let _ = error.print();
                let code = if error.kind() == ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand { exit::USAGE } else { exit::OK };
                return ExitCode::from(code);
            }
            if std::env::args().any(|a| a == "--json") {
                let message = error.render().to_string();
                emit(&Outcome::failed("usage", exit::USAGE, "USAGE", message.lines().next().unwrap_or("invalid usage")), true);
            } else {
                let _ = error.print();
            }
            return ExitCode::from(exit::USAGE);
        }
    };
    let runtime = match tokio::runtime::Builder::new_current_thread().enable_all().build() {
        Ok(runtime) => runtime,
        Err(error) => {
            emit(&Outcome::failed("startup", exit::FAILURE, "RUNTIME", error.to_string()), cli.json);
            return ExitCode::from(exit::FAILURE);
        }
    };
    let ctx = Ctx::from(&cli);
    // The MCP server owns standard output for the protocol: no envelope after it.
    if let Command::Mcp(McpCommand::Serve { grant, .. }) = &cli.command {
        return ExitCode::from(runtime.block_on(mcp::serve(&ctx, grant, cli.timeout)));
    }
    let outcome = match &cli.command {
        Command::Version => version(),
        Command::Status => runtime.block_on(status(&ctx)),
        Command::Auth(AuthCommand::Login { email, password_stdin }) => {
            runtime.block_on(auth::login(&ctx, email.as_deref(), *password_stdin))
        }
        Command::Auth(AuthCommand::Status) => runtime.block_on(auth::status(&ctx)),
        Command::Auth(AuthCommand::Logout) => runtime.block_on(auth::logout(&ctx)),
        Command::Profile(ProfileCommand::List) => profiles::list(&ctx),
        Command::Profile(ProfileCommand::Use { name }) => profiles::use_profile(&ctx, name),
        Command::Config(ConfigCommand::List) | Command::Config(ConfigCommand::Get { key: ConfigKey::Origin }) => {
            profiles::config_origin(&ctx, matches!(cli.command, Command::Config(ConfigCommand::List)))
        }
        Command::Config(ConfigCommand::Set { key: ConfigKey::Origin, value }) => profiles::set_origin(&ctx, value),
        Command::Broker(BrokerCommand::Status) => runtime.block_on(broker::status()),
        Command::Broker(BrokerCommand::Hold { seconds }) => runtime.block_on(broker::hold(*seconds, cli.json)),
        Command::Models(ModelsCommand::Status) => runtime.block_on(models::status(&ctx)),
        Command::Scan(ScanCommand::Url { url, fail_on }) => runtime.block_on(scan::url(&ctx, url, *fail_on)),
        Command::Mcp(McpCommand::Serve { .. }) => unreachable!("served above"),
        Command::Mcp(McpCommand::Grant(GrantCommand::Create { name, allow, days })) => runtime.block_on(mcp::grant_create(&ctx, name, allow, *days)),
        Command::Mcp(McpCommand::Grant(GrantCommand::List)) => mcp::grant_list(&ctx),
        Command::Mcp(McpCommand::Grant(GrantCommand::Revoke { id })) => mcp::grant_revoke(&ctx, id),
        Command::Mcp(McpCommand::Config { grant }) => mcp::config(&ctx, grant),
    };
    emit(&outcome, cli.json);
    ExitCode::from(outcome.code)
}

#[cfg(test)]
mod tests {
    use super::Cli;
    use clap::CommandFactory;
    use cyberforge_core::operations::{for_surface, Surface};

    /// `auth login` → `auth.login`, for every runnable command.
    fn leaves(command: &clap::Command, prefix: &str, out: &mut Vec<String>) {
        for sub in command.get_subcommands().filter(|s| s.get_name() != "help") {
            let id = if prefix.is_empty() { sub.get_name().to_string() } else { format!("{}.{}", prefix, sub.get_name()) };
            if sub.has_subcommands() {
                leaves(sub, &id, out);
            } else {
                out.push(id);
            }
        }
    }

    #[test]
    fn the_cli_offers_exactly_the_registry_operations_for_the_cli() {
        let mut commands = Vec::new();
        leaves(&Cli::command(), "", &mut commands);
        commands.sort();
        let mut registered: Vec<String> = for_surface(Surface::Cli).map(|op| op.id.to_string()).collect();
        registered.sort();
        assert_eq!(commands, registered);
    }

    #[test]
    fn the_command_line_definition_is_valid() {
        Cli::command().debug_assert();
    }
}
