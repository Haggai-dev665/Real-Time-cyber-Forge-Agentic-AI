// Process checker — determines whether browser processes are currently running.
// Uses the `sysinfo` crate to inspect process lists without elevated privileges.

use sysinfo::System;

/// Check if any process matching the given name fragments is running.
/// Returns true if at least one matching process is found.
pub fn is_process_running(name_fragments: &[&str]) -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for process in sys.processes().values() {
        let pname = process.name().to_string_lossy().to_lowercase();
        for fragment in name_fragments {
            if pname.contains(&fragment.to_lowercase()) {
                return true;
            }
        }
    }
    false
}

/// Return the count of matching processes.
pub fn count_running_processes(name_fragments: &[&str]) -> usize {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut count = 0;
    for process in sys.processes().values() {
        let pname = process.name().to_string_lossy().to_lowercase();
        for fragment in name_fragments {
            if pname.contains(&fragment.to_lowercase()) {
                count += 1;
                break;
            }
        }
    }
    count
}
