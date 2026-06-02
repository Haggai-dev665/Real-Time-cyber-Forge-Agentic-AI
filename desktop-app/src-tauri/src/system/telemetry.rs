// CyberForge System Telemetry
//
// Deep OS-level system snapshot: CPU, memory, disks, network I/O, load average,
// uptime, and process count.  Built on the `sysinfo` crate — no elevated
// privileges required.
//
// This module is ADDITIVE — it does not modify any existing file.

use serde::Serialize;
use sysinfo::{Disks, Networks, System};

/// One complete snapshot of OS health at a point in time.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemTelemetry {
    // ── CPU ──────────────────────────────────────────
    /// Average CPU usage across all cores, 0-100
    pub cpu_usage_pct: f64,
    /// Number of logical CPU cores
    pub cpu_cores: usize,
    /// CPU brand string (e.g. "Apple M2")
    pub cpu_model: String,
    /// Per-core usage, 0-100
    pub cpu_per_core: Vec<f64>,

    // ── Memory ───────────────────────────────────────
    /// Total physical RAM, bytes
    pub mem_total_bytes: u64,
    /// Used physical RAM, bytes
    pub mem_used_bytes: u64,
    /// Available RAM, bytes
    pub mem_available_bytes: u64,
    /// RAM usage percentage, 0-100
    pub mem_usage_pct: f64,
    /// Total swap, bytes
    pub swap_total_bytes: u64,
    /// Used swap, bytes
    pub swap_used_bytes: u64,

    // ── Disk ─────────────────────────────────────────
    /// Per-disk stats
    pub disks: Vec<DiskStat>,

    // ── Network I/O ──────────────────────────────────
    /// Per-interface stats (cumulative bytes since boot)
    pub networks: Vec<NetStat>,
    /// Total received bytes across all interfaces
    pub net_total_rx_bytes: u64,
    /// Total transmitted bytes across all interfaces
    pub net_total_tx_bytes: u64,

    // ── Load / System ────────────────────────────────
    /// System uptime in seconds
    pub uptime_secs: u64,
    /// Hostname
    pub hostname: String,
    /// OS long name (e.g. "macOS 14.4.1")
    pub os_name: String,
    /// Kernel version
    pub kernel_version: String,
    /// Total running processes
    pub process_count: usize,

    /// ISO-8601 UTC timestamp of when this snapshot was taken
    pub snapshot_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskStat {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub usage_pct: f64,
    pub is_removable: bool,
    pub file_system: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetStat {
    pub interface: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
    pub rx_packets: u64,
    pub tx_packets: u64,
}

/// Collect a single system telemetry snapshot synchronously.
/// Designed to be called from `tokio::task::spawn_blocking`.
pub fn collect_system_telemetry() -> SystemTelemetry {
    let mut sys = System::new_all();
    // Two refreshes separated by a tiny sleep give accurate CPU deltas.
    sys.refresh_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_usage();

    // ── CPU ──────────────────────────────────────────────────────────────
    let cpus = sys.cpus();
    let cpu_cores = cpus.len();
    let cpu_per_core: Vec<f64> = cpus
        .iter()
        .map(|c| (c.cpu_usage() as f64 * 10.0).round() / 10.0)
        .collect();
    let cpu_usage_pct = if cpu_cores > 0 {
        (cpu_per_core.iter().sum::<f64>() / cpu_cores as f64 * 10.0).round() / 10.0
    } else {
        0.0
    };
    let cpu_model = cpus
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| format!("{} cores", cpu_cores));

    // ── Memory ───────────────────────────────────────────────────────────
    let mem_total = sys.total_memory();
    let mem_used = sys.used_memory();
    let mem_available = sys.available_memory();
    let mem_usage_pct = if mem_total > 0 {
        ((mem_used as f64 / mem_total as f64) * 1000.0).round() / 10.0
    } else {
        0.0
    };
    let swap_total = sys.total_swap();
    let swap_used = sys.used_swap();

    // ── Disks ────────────────────────────────────────────────────────────
    let disks_obj = Disks::new_with_refreshed_list();
    let disks: Vec<DiskStat> = disks_obj
        .iter()
        .map(|d| {
            let total = d.total_space();
            let avail = d.available_space();
            let used = total.saturating_sub(avail);
            let usage_pct = if total > 0 {
                ((used as f64 / total as f64) * 1000.0).round() / 10.0
            } else {
                0.0
            };
            DiskStat {
                name: d.name().to_string_lossy().to_string(),
                mount_point: d.mount_point().to_string_lossy().to_string(),
                total_bytes: total,
                available_bytes: avail,
                used_bytes: used,
                usage_pct,
                is_removable: d.is_removable(),
                file_system: d.file_system().to_string_lossy().to_string(),
                kind: format!("{:?}", d.kind()),
            }
        })
        .collect();

    // ── Network ──────────────────────────────────────────────────────────
    let nets = Networks::new_with_refreshed_list();
    let mut net_total_rx: u64 = 0;
    let mut net_total_tx: u64 = 0;
    let networks: Vec<NetStat> = nets
        .iter()
        .map(|(name, data)| {
            net_total_rx += data.total_received();
            net_total_tx += data.total_transmitted();
            NetStat {
                interface: name.clone(),
                rx_bytes: data.total_received(),
                tx_bytes: data.total_transmitted(),
                rx_packets: data.total_packets_received(),
                tx_packets: data.total_packets_transmitted(),
            }
        })
        .collect();

    // ── System ───────────────────────────────────────────────────────────
    let uptime_secs = System::uptime();
    let hostname = System::host_name().unwrap_or_else(|| "unknown".to_string());
    let os_name = System::long_os_version().unwrap_or_else(|| crate::system::get_os_name().to_string());
    let kernel_version = System::kernel_version().unwrap_or_default();
    let process_count = sys.processes().len();

    SystemTelemetry {
        cpu_usage_pct,
        cpu_cores,
        cpu_model,
        cpu_per_core,
        mem_total_bytes: mem_total,
        mem_used_bytes: mem_used,
        mem_available_bytes: mem_available,
        mem_usage_pct,
        swap_total_bytes: swap_total,
        swap_used_bytes: swap_used,
        disks,
        networks,
        net_total_rx_bytes: net_total_rx,
        net_total_tx_bytes: net_total_tx,
        uptime_secs,
        hostname,
        os_name,
        kernel_version,
        process_count,
        snapshot_at: chrono::Utc::now().to_rfc3339(),
    }
}
