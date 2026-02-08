use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

fn log_dir() -> PathBuf {
    let state_home = std::env::var("XDG_STATE_HOME").ok().map(PathBuf::from);
    let base = state_home.unwrap_or_else(|| {
        dirs::home_dir()
            .expect("cannot determine home directory")
            .join(".local")
            .join("state")
    });
    base.join("grey-rso")
}

fn log_path() -> PathBuf {
    log_dir().join("mcp.log")
}

fn ensure_log_dir() {
    let dir = log_dir();
    let _ = fs::create_dir_all(dir);
}

pub fn log_to_file(content: &str) {
    ensure_log_dir();
    let path = log_path();
    let timestamp = chrono_lite_now();
    let entry = format!("[{timestamp}] {content}\n");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(entry.as_bytes());
    }
}

pub fn log_server_start(version: &str) {
    log_to_file(&format!(
        "MCP SERVER STARTED - grey-rso v{version}\n{}",
        "=".repeat(80)
    ));
}

pub fn log_tool_call(name: &str, args: &str) {
    log_to_file(&format!(
        "TOOL CALL: {name}\nArguments: {args}\n{}",
        "=".repeat(80)
    ));
}

pub fn log_prompt(model: &str, prompt: &str) {
    log_to_file(&format!(
        "PROMPT (model: {model}):\n{prompt}\n{}",
        "=".repeat(80)
    ));
}

pub fn log_response(model: &str, response: &str) {
    log_to_file(&format!(
        "RESPONSE (model: {model}):\n{response}\n{}",
        "=".repeat(80)
    ));
}

pub fn log_cli_debug(message: &str) {
    log_to_file(&format!("CLI DEBUG: {message}"));
}

/// Minimal ISO 8601 timestamp without pulling in chrono.
fn chrono_lite_now() -> String {
    // Use UNIX_EPOCH approach — works on all platforms
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();

    // Convert to rough UTC components
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Days since epoch to Y-M-D (simplified leap year calculation)
    let (year, month, day) = days_to_ymd(days);

    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}Z")
}

fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}
