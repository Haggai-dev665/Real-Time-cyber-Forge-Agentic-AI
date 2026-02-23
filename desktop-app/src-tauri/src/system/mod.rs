// CyberForge System Intelligence Module
// OS-aware browser detection, process inspection, and system metadata.
// Privacy-conscious: NO access to browsing history, cookies, passwords, or profile data.

pub mod os_info;
pub mod browser_detector;
pub mod process_checker;
pub mod url_monitor;

pub use browser_detector::detect_all_browsers;
pub use os_info::get_os_name;
pub use url_monitor::get_active_browser_urls;
