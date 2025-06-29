use std::fs;
use std::path::PathBuf;

use crate::system;

fn get_config_path() -> anyhow::Result<PathBuf> {
    let home_dir =
        home::home_dir().ok_or_else(|| anyhow::anyhow!("Could not find home directory"))?;
    Ok(home_dir.join(".kawairc"))
}

#[tauri::command]
pub fn get_api_key() -> Result<String, String> {
    let config_path = match get_config_path() {
        Ok(path) => path,
        Err(e) => return Err(e.to_string()),
    };

    let placeholder_key = "YOUR_GEMINI_API_KEY_HERE".to_string();

    if !config_path.exists() {
        let content = format!("API_KEY={}", placeholder_key);
        if let Err(e) = fs::write(&config_path, content) {
            return Err(format!("Failed to create config file: {}", e));
        }
        return Ok(placeholder_key);
    }

    // If the file exists, read it.
    match fs::read_to_string(config_path) {
        Ok(content) => {
            for line in content.lines() {
                if let Some(key) = line.strip_prefix("API_KEY=") {
                    return Ok(key.trim().to_string());
                }
            }

            Err("API_KEY not found in ~/.kawairc".to_string())
        }
        Err(e) => Err(format!("Failed to read config file: {}", e)),
    }
}

#[tauri::command]
pub fn hide_window(app_handle: tauri::AppHandle) {
    system::window::hide(&app_handle);
}
