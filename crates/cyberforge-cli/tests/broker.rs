//! `cyberforge broker status | hold` against this user's real broker lock.
//! If a CyberForge program already owns this computer's state (the desktop app
//! is running), the test says so and does nothing: `hold` never takes the lock
//! from a running owner, and this test does not either.

use serde_json::Value;
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

fn run(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_cyberforge")).args(args).output().expect("the binary runs")
}

fn json(output: &Output) -> Value {
    serde_json::from_str(String::from_utf8_lossy(&output.stdout).trim()).expect("JSON on stdout")
}

#[test]
fn the_cli_holds_the_lock_explicitly_and_never_takes_it_from_an_owner() {
    let before = run(&["--json", "broker", "status"]);
    if json(&before)["data"]["state"] == "attached" {
        eprintln!("skipped: a CyberForge program already owns this computer's state");
        return;
    }
    assert_eq!(before.status.code(), Some(4), "nothing owns it: exit 4");

    let holder = Command::new(env!("CARGO_BIN_EXE_cyberforge"))
        .args(["--json", "broker", "hold", "--for", "4"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let started = Instant::now();
    let attached = loop {
        let status = json(&run(&["--json", "broker", "status"]));
        if status["data"]["state"] == "attached" {
            break status;
        }
        assert!(started.elapsed() < Duration::from_secs(3), "the holder answers the broker");
        std::thread::sleep(Duration::from_millis(100));
    };
    assert_eq!(attached["data"]["owner"], "cli");
    assert_eq!(attached["data"]["pid"], holder.id());
    assert_eq!(attached["data"]["owns"], serde_json::json!([]), "it runs nothing on the state");

    let second = run(&["--json", "broker", "hold", "--for", "1"]);
    assert_eq!(second.status.code(), Some(7), "a second holder is refused, not given the lock");
    assert_eq!(json(&second)["error"]["code"], "HELD_BY_ANOTHER");
    assert!(json(&second)["error"]["message"].as_str().unwrap().contains(&format!("cli (process {})", holder.id())));

    let done = holder.wait_with_output().unwrap();
    assert_eq!(done.status.code(), Some(0), "released after --for");
    assert_eq!(json(&done)["data"]["interrupted"], false);
    let after = run(&["--json", "broker", "status"]);
    assert_eq!(after.status.code(), Some(4));
    assert_eq!(json(&after)["data"]["state"], "not_running", "the lock went with the holder");
}
