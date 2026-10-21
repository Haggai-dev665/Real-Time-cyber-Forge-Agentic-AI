//! CyberForge's shared native services (V2-01).
//!
//! The desktop app, the `cyberforge` CLI and (later) the MCP server use these
//! instead of keeping their own copies, so a backend origin, a credential or an
//! HTTP failure means the same thing in each of them.
//!
//! - [`origin`]: which backends may be used, and their canonical form.
//! - [`operations`]: the registry of what can be asked from outside the window.
//! - [`broker`]: the one program per user that owns this computer's state.
//! - [`credentials`]: the operating system's credential store, and where each
//!   app keeps its non-secret files.
//! - [`privacy`]: the user's collection and sending choices, and their file.
//! - [`device`]: the device messages the backend checks, and `device.json`.
//! - [`profile`]: named CLI profiles, each bound to one origin and one
//!   credential-store entry.
//! - [`http`]: one way to build a client and to report HTTP failures.
//! - [`redact`]: credentials removed from an address before it is kept or sent.
//! - [`session`]: signing a profile in and out; the token stays in the
//!   credential store.
//! - [`ops`]: the server operations every surface shares (Engine status, URL analysis).
//! - [`grants`]: the AI clients approved for MCP, and what each may do.
//! - [`status`]: the read-only health check behind `cyberforge status`.

pub mod broker;
pub mod credentials;
pub mod device;
pub mod grants;
pub mod http;
pub mod operations;
pub mod ops;
pub mod origin;
pub mod privacy;
pub mod profile;
pub mod redact;
pub mod session;
pub mod status;
pub mod text;
