//! The local broker (plan-update-v2.md §4.1): one program per operating-system
//! user owns this computer's CyberForge state, and others ask it.
//!
//! On Windows the broker is a named pipe whose name includes the user's SID.
//! **Holding its first instance is the ownership lock**: while one program
//! holds it, another cannot create it, and it disappears when the owner exits,
//! so a crash never leaves a stale lock. The owner of the pipe alone runs the
//! enrolled-device loop, the device outbox and hosts-file changes.
//!
//! Identity is the OS user, checked at both ends, never a process name:
//! - the pipe's access list grants only the creating user, and remote clients
//!   are refused;
//! - the owner checks that each client process runs as the same user;
//! - a client checks that the pipe's server process runs as the same user, so
//!   a pipe created first by another account is not trusted.
//!
//! Protocol: one JSON object per line. A request is
//! `{"v":1,"id":"…","op":"broker.status"}`; the answer is
//! `{"v":1,"id":"…","ok":true,"data":{…}}` or `{"v":1,"id":"…","ok":false,"error":{"code","message"}}`.
//! Only `broker.status` is served for now: every other operation needs a client
//! grant, which arrives with the MCP server (V2-03).
//!
//! On macOS and Linux the lock is an advisory `flock` on `broker.lock`, and the
//! broker a Unix socket `broker.sock`, both in a folder only this user can
//! enter (`$XDG_RUNTIME_DIR/cyberforge-<uid>`, else the user's temporary
//! folder; made 0700, and refused unless it is a real folder of this user that
//! no one else can enter). The kernel releases the lock when the owner exits; a
//! socket file it left is removed by the next owner. Each end checks the other
//! end's user ID through the socket's peer credentials. These are compiled for
//! Linux and macOS but have not been run there yet.
//!
//! Other platforms have no broker: [`claim`] answers `Unsupported`, and the
//! desktop keeps its previous behaviour there.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const PROTOCOL_VERSION: u64 = 1;
/// The longest request line accepted, in bytes.
pub const MAX_REQUEST_BYTES: usize = 64 * 1024;

/// What the owner tells a client about itself.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct OwnerInfo {
    /// `desktop` or `cli`.
    pub owner: String,
    pub version: String,
    pub pid: u32,
    /// Seconds since the Unix epoch.
    pub started_at: u64,
    /// The state this owner alone changes, e.g. `device_loop`, `outbox`, `hosts_file`.
    pub owns: Vec<String>,
}

/// The answer to a request line.
pub fn answer(info: &OwnerInfo, line: &str) -> Value {
    let request: Value = match serde_json::from_str(line) {
        Ok(Value::Object(map)) => Value::Object(map),
        _ => return json!({ "v": PROTOCOL_VERSION, "id": null, "ok": false, "error": { "code": "BAD_REQUEST", "message": "a request is one JSON object per line" } }),
    };
    let id = request.get("id").filter(|v| v.is_string()).cloned().unwrap_or(Value::Null);
    let fail = |code: &str, message: &str| json!({ "v": PROTOCOL_VERSION, "id": id, "ok": false, "error": { "code": code, "message": message } });
    if request.get("v").and_then(Value::as_u64) != Some(PROTOCOL_VERSION) {
        return fail("UNSUPPORTED_VERSION", "this broker speaks protocol version 1");
    }
    let Some(op) = request.get("op").and_then(Value::as_str) else {
        return fail("BAD_REQUEST", "a request names an op");
    };
    match crate::operations::find(op) {
        Some(found) if found.surfaces.contains(&crate::operations::Surface::Broker) && op == "broker.status" => {
            json!({ "v": PROTOCOL_VERSION, "id": id, "ok": true, "data": info })
        }
        Some(_) => fail("NOT_GRANTED", "this operation is not offered through the broker without a client grant"),
        None => fail("UNKNOWN_OPERATION", "no such operation"),
    }
}

/// Serve one connected client of this user: one request per line, one answer
/// per line, until it hangs up, sends a line over the limit, or is idle 30 s.
#[cfg(any(windows, unix))]
async fn converse<S: tokio::io::AsyncRead + tokio::io::AsyncWrite>(stream: S, info: &OwnerInfo) {
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
    let (read, mut write) = tokio::io::split(stream);
    let mut lines = BufReader::new(read.take(MAX_REQUEST_BYTES as u64 * 16));
    let mut line = String::new();
    loop {
        line.clear();
        let read = tokio::time::timeout(std::time::Duration::from_secs(30), (&mut lines).take(MAX_REQUEST_BYTES as u64 + 1).read_line(&mut line)).await;
        match read {
            Ok(Ok(0)) | Err(_) | Ok(Err(_)) => return,
            Ok(Ok(_)) if line.len() > MAX_REQUEST_BYTES || !line.ends_with('\n') => {
                let reply = json!({ "v": PROTOCOL_VERSION, "id": null, "ok": false, "error": { "code": "TOO_LARGE", "message": "request line too long" } });
                let _ = write.write_all(format!("{}\n", reply).as_bytes()).await;
                return;
            }
            Ok(Ok(_)) => {
                let reply = answer(info, line.trim_end());
                if write.write_all(format!("{}\n", reply).as_bytes()).await.is_err() {
                    return;
                }
            }
        }
    }
}

/// Ask a connected, already identified owner for its status.
#[cfg(any(windows, unix))]
async fn ask_status<S: tokio::io::AsyncRead + tokio::io::AsyncWrite>(stream: S) -> Result<OwnerInfo, String> {
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
    let (read, mut write) = tokio::io::split(stream);
    let request = json!({ "v": PROTOCOL_VERSION, "id": "status", "op": "broker.status" });
    write.write_all(format!("{}\n", request).as_bytes()).await.map_err(|e| e.to_string())?;
    let mut line = String::new();
    BufReader::new(read).take(MAX_REQUEST_BYTES as u64).read_line(&mut line).await.map_err(|e| e.to_string())?;
    let reply: Value = serde_json::from_str(line.trim()).map_err(|_| "the broker's answer is not JSON".to_string())?;
    if reply.get("ok") != Some(&Value::Bool(true)) {
        return Err(format!("the broker refused: {}", reply.pointer("/error/code").and_then(Value::as_str).unwrap_or("unknown")));
    }
    serde_json::from_value::<OwnerInfo>(reply.get("data").cloned().unwrap_or(Value::Null)).map_err(|_| "the broker's answer is incomplete".to_string())
}

/// The result of trying to become the owner.
pub enum Claim {
    /// This process owns the state; run `Owner::serve` to answer clients.
    Owner(Owner),
    /// Another process of this user owns it.
    HeldByAnother,
    /// This platform has no broker yet.
    Unsupported(String),
    /// The broker could not be created for another reason.
    Failed(String),
}

#[derive(Debug, PartialEq)]
pub enum QueryError {
    /// No owner is running.
    NotRunning,
    /// Something answers on the broker's name but not as this user.
    Untrusted(String),
    /// This platform has no broker yet.
    Unsupported(String),
    Failed(String),
}

#[cfg(windows)]
pub use self::pipe::{claim, claim_at, default_name, query, query_at, Owner};

#[cfg(unix)]
pub use self::socket::{claim, claim_in, default_dir, query, query_in, Owner};

#[cfg(not(any(windows, unix)))]
pub use self::other::{claim, query, Owner};

#[cfg(not(any(windows, unix)))]
mod other {
    use super::*;

    pub struct Owner;

    impl Owner {
        pub async fn serve(self) {}
    }

    pub fn claim(_info: OwnerInfo) -> Claim {
        Claim::Unsupported("the local broker is available on Windows, macOS and Linux only".into())
    }

    pub async fn query(_timeout: std::time::Duration) -> Result<OwnerInfo, QueryError> {
        Err(QueryError::Unsupported("the local broker is available on Windows, macOS and Linux only".into()))
    }
}

#[cfg(unix)]
mod socket {
    use super::*;
    use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt, PermissionsExt};
    use std::os::unix::io::AsRawFd;
    use std::path::{Path, PathBuf};
    use std::time::Duration;
    use tokio::net::{UnixListener, UnixStream};

    fn uid() -> u32 {
        unsafe { libc::geteuid() }
    }

    /// `$XDG_RUNTIME_DIR/cyberforge-<uid>`, else the same in `$TMPDIR` or `/tmp`.
    pub fn default_dir() -> PathBuf {
        std::env::var_os("XDG_RUNTIME_DIR")
            .or_else(|| std::env::var_os("TMPDIR"))
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join(format!("cyberforge-{}", uid()))
    }

    /// Made 0700 when missing. Refused unless it is a real folder (not a link)
    /// of this user that no one else can enter.
    fn private_dir(dir: &Path) -> Result<(), String> {
        match std::fs::DirBuilder::new().mode(0o700).create(dir) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(format!("the broker folder could not be made: {e}")),
        }
        let meta = std::fs::symlink_metadata(dir).map_err(|e| e.to_string())?;
        if !meta.is_dir() || meta.uid() != uid() || meta.mode() & 0o077 != 0 {
            return Err(format!("{} is not a private folder of this user; the broker does not use it", dir.display()));
        }
        Ok(())
    }

    pub struct Owner {
        listener: UnixListener,
        info: OwnerInfo,
        /// Held for as long as this owner exists; the kernel releases it on exit.
        lock: std::fs::File,
    }

    /// Try to become the owner. Must be called inside a Tokio runtime.
    pub fn claim(info: OwnerInfo) -> Claim {
        claim_in(&default_dir(), info)
    }

    pub fn claim_in(dir: &Path, info: OwnerInfo) -> Claim {
        if let Err(error) = private_dir(dir) {
            return Claim::Failed(error);
        }
        let lock = match std::fs::OpenOptions::new().create(true).truncate(false).write(true).mode(0o600).open(dir.join("broker.lock")) {
            Ok(file) => file,
            Err(error) => return Claim::Failed(error.to_string()),
        };
        if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            let error = std::io::Error::last_os_error();
            return if error.raw_os_error() == Some(libc::EWOULDBLOCK) { Claim::HeldByAnother } else { Claim::Failed(error.to_string()) };
        }
        // The lock is ours, so a socket file still there was left by an owner that exited.
        let path = dir.join("broker.sock");
        let _ = std::fs::remove_file(&path);
        let listener = match UnixListener::bind(&path) {
            Ok(listener) => listener,
            Err(error) => return Claim::Failed(error.to_string()),
        };
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
        Claim::Owner(Owner { listener, info, lock })
    }

    impl Owner {
        /// Answer clients of this user until the process exits.
        pub async fn serve(self) {
            let Owner { listener, info, lock } = self;
            let _held = lock;
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                    continue;
                };
                if !stream.peer_cred().map(|c| c.uid() == uid()).unwrap_or(false) {
                    continue;
                }
                let info = info.clone();
                tokio::spawn(async move { converse(stream, &info).await });
            }
        }
    }

    /// Ask the owner, if one is running, about itself.
    pub async fn query(timeout: Duration) -> Result<OwnerInfo, QueryError> {
        query_in(&default_dir(), timeout).await
    }

    pub async fn query_in(dir: &Path, timeout: Duration) -> Result<OwnerInfo, QueryError> {
        let stream = match tokio::time::timeout(timeout, UnixStream::connect(dir.join("broker.sock"))).await {
            Ok(Ok(stream)) => stream,
            Ok(Err(e)) if matches!(e.kind(), std::io::ErrorKind::NotFound | std::io::ErrorKind::ConnectionRefused) => return Err(QueryError::NotRunning),
            Ok(Err(e)) => return Err(QueryError::Failed(e.to_string())),
            Err(_) => return Err(QueryError::Failed("the broker did not answer in time".into())),
        };
        match stream.peer_cred() {
            Ok(cred) if cred.uid() == uid() => {}
            Ok(_) => return Err(QueryError::Untrusted("the broker's server runs as another user".into())),
            Err(e) => return Err(QueryError::Untrusted(format!("the broker's server could not be identified: {}", e))),
        }
        match tokio::time::timeout(timeout, ask_status(stream)).await {
            Ok(result) => result.map_err(QueryError::Failed),
            Err(_) => Err(QueryError::Failed("the broker did not answer in time".into())),
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        fn info(owner: &str) -> OwnerInfo {
            OwnerInfo { owner: owner.into(), version: "test".into(), pid: std::process::id(), started_at: 1, owns: vec!["device_loop".into()] }
        }

        fn test_dir(tag: &str) -> PathBuf {
            let dir = std::env::temp_dir().join(format!("cf-broker-{}-{}", tag, std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            dir
        }

        #[tokio::test]
        async fn one_owner_at_a_time_and_clients_get_its_status() {
            let dir = test_dir("own");
            let Claim::Owner(owner) = claim_in(&dir, info("desktop")) else { panic!("the first claim owns") };
            assert_eq!(std::fs::metadata(&dir).unwrap().mode() & 0o777, 0o700);
            assert!(matches!(claim_in(&dir, info("cli")), Claim::HeldByAnother), "a second claim does not");
            let serving = tokio::spawn(owner.serve());
            for _ in 0..3 {
                assert_eq!(query_in(&dir, Duration::from_secs(5)).await.unwrap(), info("desktop"));
            }
            serving.abort();
            let _ = serving.await;
            assert_eq!(query_in(&dir, Duration::from_secs(2)).await, Err(QueryError::NotRunning), "the lock goes with its owner");
            assert!(matches!(claim_in(&dir, info("cli")), Claim::Owner(_)), "and the stale socket is replaced");
            let _ = std::fs::remove_dir_all(dir);
        }

        #[test]
        fn a_folder_others_can_enter_is_refused() {
            let dir = test_dir("open");
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();
            assert!(matches!(claim_in(&dir, info("desktop")), Claim::Failed(_)));
            let _ = std::fs::remove_dir_all(dir);
        }
    }
}

#[cfg(windows)]
mod pipe {
    use super::*;
    use std::ffi::c_void;
    use std::os::windows::io::AsRawHandle;
    use std::time::Duration;
    use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeServer, ServerOptions};
    use ::windows::core::{PCWSTR, PWSTR};
    use ::windows::Win32::Foundation::{CloseHandle, LocalFree, ERROR_ACCESS_DENIED, ERROR_FILE_NOT_FOUND, ERROR_PIPE_BUSY, HANDLE, HLOCAL};
    use ::windows::Win32::Security::Authorization::{ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1};
    use ::windows::Win32::Security::{GetTokenInformation, TokenUser, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY, TOKEN_USER};
    use ::windows::Win32::System::Pipes::{GetNamedPipeClientProcessId, GetNamedPipeServerProcessId};
    use ::windows::Win32::System::Threading::{GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION};

    /// The SID of the user a process runs as, e.g. `S-1-5-21-…`.
    fn sid_of(process: HANDLE) -> Result<String, String> {
        unsafe {
            let mut token = HANDLE::default();
            OpenProcessToken(process, TOKEN_QUERY, &mut token).map_err(|e| e.message())?;
            let mut needed = 0u32;
            let _ = GetTokenInformation(token, TokenUser, None, 0, &mut needed);
            let mut buffer = vec![0u8; needed.max(1) as usize];
            let read = GetTokenInformation(token, TokenUser, Some(buffer.as_mut_ptr() as *mut c_void), needed, &mut needed);
            let _ = CloseHandle(token);
            read.map_err(|e| e.message())?;
            let user = &*(buffer.as_ptr() as *const TOKEN_USER);
            let mut text = PWSTR::null();
            ConvertSidToStringSidW(user.User.Sid, &mut text).map_err(|e| e.message())?;
            let sid = text.to_string().map_err(|e| e.to_string());
            let _ = LocalFree(Some(HLOCAL(text.0 as *mut c_void)));
            sid
        }
    }

    fn current_user_sid() -> Result<String, String> {
        sid_of(unsafe { GetCurrentProcess() })
    }

    fn sid_of_pid(pid: u32) -> Result<String, String> {
        unsafe {
            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).map_err(|e| e.message())?;
            let sid = sid_of(process);
            let _ = CloseHandle(process);
            sid
        }
    }

    /// `\\.\pipe\cyberforge-broker-<user SID>`.
    pub fn default_name() -> Result<String, String> {
        Ok(format!(r"\\.\pipe\cyberforge-broker-{}", current_user_sid()?))
    }

    fn create(name: &str, sid: &str, first: bool) -> std::io::Result<NamedPipeServer> {
        // Protected access list: full access for this user only.
        let sddl: Vec<u16> = format!("D:P(A;;GA;;;{})", sid).encode_utf16().chain(Some(0)).collect();
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(PCWSTR(sddl.as_ptr()), SDDL_REVISION_1, &mut descriptor, None)
                .map_err(|e| std::io::Error::other(e.message()))?;
        }
        let mut attributes = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: descriptor.0,
            bInheritHandle: false.into(),
        };
        let mut options = ServerOptions::new();
        options.first_pipe_instance(first).reject_remote_clients(true);
        let created = unsafe { options.create_with_security_attributes_raw(name, &mut attributes as *mut _ as *mut c_void) };
        unsafe {
            let _ = LocalFree(Some(HLOCAL(descriptor.0)));
        }
        created
    }

    pub struct Owner {
        name: String,
        sid: String,
        info: OwnerInfo,
        first: NamedPipeServer,
    }

    /// Try to become the owner. Must be called inside a Tokio runtime.
    pub fn claim(info: OwnerInfo) -> Claim {
        match default_name() {
            Ok(name) => claim_at(&name, info),
            Err(error) => Claim::Failed(error),
        }
    }

    pub fn claim_at(name: &str, info: OwnerInfo) -> Claim {
        let sid = match current_user_sid() {
            Ok(sid) => sid,
            Err(error) => return Claim::Failed(error),
        };
        match create(name, &sid, true) {
            Ok(first) => Claim::Owner(Owner { name: name.to_string(), sid, info, first }),
            Err(error) if error.raw_os_error() == Some(ERROR_ACCESS_DENIED.0 as i32) => Claim::HeldByAnother,
            Err(error) => Claim::Failed(error.to_string()),
        }
    }

    impl Owner {
        /// Answer clients until the process exits. A new instance is created
        /// before each connected one is handled, so the name stays held.
        pub async fn serve(self) {
            let Owner { name, sid, info, first } = self;
            let mut listening = first;
            loop {
                if listening.connect().await.is_err() {
                    // A client that left before being served; reuse a fresh instance.
                    match create(&name, &sid, false) {
                        Ok(next) => listening = next,
                        Err(_) => tokio::time::sleep(Duration::from_millis(200)).await,
                    }
                    continue;
                }
                let next = loop {
                    match create(&name, &sid, false) {
                        Ok(next) => break next,
                        Err(_) => tokio::time::sleep(Duration::from_millis(200)).await,
                    }
                };
                let connected = std::mem::replace(&mut listening, next);
                let (sid, info) = (sid.clone(), info.clone());
                tokio::spawn(async move { handle(connected, &sid, &info).await });
            }
        }
    }

    async fn handle(pipe: NamedPipeServer, sid: &str, info: &OwnerInfo) {
        let mut pid = 0u32;
        let raw = HANDLE(pipe.as_raw_handle() as *mut c_void);
        let same_user = unsafe { GetNamedPipeClientProcessId(raw, &mut pid) }.is_ok()
            && sid_of_pid(pid).map(|client| client == sid).unwrap_or(false);
        if !same_user {
            return;
        }
        converse(pipe, info).await;
    }

    /// Ask the owner, if one is running, about itself.
    pub async fn query(timeout: Duration) -> Result<OwnerInfo, QueryError> {
        let name = default_name().map_err(QueryError::Failed)?;
        query_at(&name, timeout).await
    }

    pub async fn query_at(name: &str, timeout: Duration) -> Result<OwnerInfo, QueryError> {
        let sid = current_user_sid().map_err(QueryError::Failed)?;
        let deadline = tokio::time::Instant::now() + timeout;
        let pipe = loop {
            match ClientOptions::new().open(name) {
                Ok(pipe) => break pipe,
                Err(e) if e.raw_os_error() == Some(ERROR_FILE_NOT_FOUND.0 as i32) => return Err(QueryError::NotRunning),
                Err(e) if e.raw_os_error() == Some(ERROR_PIPE_BUSY.0 as i32) && tokio::time::Instant::now() < deadline => {
                    tokio::time::sleep(Duration::from_millis(50)).await
                }
                Err(e) => return Err(QueryError::Failed(e.to_string())),
            }
        };
        let mut pid = 0u32;
        let raw = HANDLE(pipe.as_raw_handle() as *mut c_void);
        unsafe { GetNamedPipeServerProcessId(raw, &mut pid) }.map_err(|e| QueryError::Failed(e.message()))?;
        match sid_of_pid(pid) {
            Ok(server) if server == sid => {}
            Ok(_) => return Err(QueryError::Untrusted("the broker's server runs as another user".into())),
            Err(e) => return Err(QueryError::Untrusted(format!("the broker's server could not be identified: {}", e))),
        }
        let exchange = ask_status(pipe);
        match tokio::time::timeout_at(deadline, exchange).await {
            Ok(result) => result.map_err(QueryError::Failed),
            Err(_) => Err(QueryError::Failed("the broker did not answer in time".into())),
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        fn info(owner: &str) -> OwnerInfo {
            OwnerInfo { owner: owner.into(), version: "test".into(), pid: std::process::id(), started_at: 1, owns: vec!["device_loop".into()] }
        }

        fn test_name(tag: &str) -> String {
            format!(r"\\.\pipe\cyberforge-broker-test-{}-{}-{}", tag, std::process::id(), current_user_sid().unwrap())
        }

        #[test]
        fn this_process_runs_as_the_current_user() {
            let sid = current_user_sid().unwrap();
            assert!(sid.starts_with("S-1-"), "{sid}");
            assert_eq!(sid_of_pid(std::process::id()).unwrap(), sid);
            assert!(default_name().unwrap().ends_with(&sid));
        }

        #[tokio::test]
        async fn one_owner_at_a_time_and_clients_get_its_status() {
            let name = test_name("own");
            let Claim::Owner(owner) = claim_at(&name, info("desktop")) else { panic!("the first claim owns") };
            assert!(matches!(claim_at(&name, info("cli")), Claim::HeldByAnother), "a second claim does not");
            let serving = tokio::spawn(owner.serve());
            for _ in 0..3 {
                assert_eq!(query_at(&name, Duration::from_secs(5)).await.unwrap(), info("desktop"));
            }
            serving.abort();
            let _ = serving.await;
            tokio::time::sleep(Duration::from_millis(100)).await;
            assert_eq!(query_at(&name, Duration::from_secs(2)).await, Err(QueryError::NotRunning), "the lock goes with its owner");
            assert!(matches!(claim_at(&name, info("cli")), Claim::Owner(_)), "and can be claimed again");
        }

        #[tokio::test]
        async fn nothing_running_is_not_running() {
            assert_eq!(query_at(&test_name("none"), Duration::from_secs(1)).await, Err(QueryError::NotRunning));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info() -> OwnerInfo {
        OwnerInfo { owner: "desktop".into(), version: "1.0.0".into(), pid: 7, started_at: 1, owns: vec!["device_loop".into()] }
    }

    #[test]
    fn status_is_answered_and_everything_else_refused() {
        let ok = answer(&info(), r#"{"v":1,"id":"a","op":"broker.status"}"#);
        assert_eq!(ok["ok"], true);
        assert_eq!(ok["id"], "a");
        assert_eq!(ok["data"]["owner"], "desktop");
        assert_eq!(answer(&info(), r#"{"v":1,"id":"b","op":"auth.login"}"#)["error"]["code"], "NOT_GRANTED");
        assert_eq!(answer(&info(), r#"{"v":1,"id":"c","op":"rm -rf"}"#)["error"]["code"], "UNKNOWN_OPERATION");
        assert_eq!(answer(&info(), r#"{"v":2,"op":"broker.status"}"#)["error"]["code"], "UNSUPPORTED_VERSION");
        assert_eq!(answer(&info(), "not json")["error"]["code"], "BAD_REQUEST");
        assert_eq!(answer(&info(), r#"{"v":1}"#)["error"]["code"], "BAD_REQUEST");
        assert_eq!(answer(&info(), r#"{"v":1,"id":{"x":1},"op":"broker.status"}"#)["id"], Value::Null, "only a string ID is echoed");
    }
}
