// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn run_installer_and_exit(app_handle: tauri::AppHandle, path_or_url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path_or_url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path_or_url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_or_url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    // Give detached installer a brief moment to start, then exit cleanly to unlock files
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(600));
        app_handle.exit(0);
    });
    Ok(())
}

#[tauri::command]
async fn auto_install_update(app_handle: tauri::AppHandle, url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let temp_dir = std::env::temp_dir();
        let installer_path = temp_dir.join("Hephaestus-Setup.exe");
        let installer_str = installer_path
            .to_str()
            .ok_or_else(|| "Failed to resolve temp installer path".to_string())?
            .to_string();

        // 1. Download directly using curl.exe
        let curl_res = std::process::Command::new("curl.exe")
            .args(["-L", "-f", "-s", "-S", "-o", &installer_str, &url])
            .status();

        let success = match curl_res {
            Ok(s) => s.success(),
            Err(_) => false,
        };

        if !success {
            // Fallback to PowerShell Invoke-WebRequest
            let ps_cmd = format!("Invoke-WebRequest -Uri '{}' -OutFile '{}'", url, installer_str);
            let ps_status = std::process::Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", &ps_cmd])
                .status()
                .map_err(|e| format!("PowerShell download failed: {}", e))?;
            if !ps_status.success() {
                return Err("Failed to download installer".into());
            }
        }

        // Verify installer exists and has valid size (> 100KB)
        let meta = std::fs::metadata(&installer_path)
            .map_err(|e| format!("Failed to read downloaded installer: {}", e))?;
        if meta.len() < 100_000 {
            return Err("Downloaded installer is incomplete".into());
        }

        // 2. Launch installer with /S (silent install) in detached mode
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &installer_str, "/S"])
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;

        // 3. Gracefully exit current process after a short delay so files are unlocked
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(800));
            app_handle.exit(0);
        });

        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        open_url(url)
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_url, run_installer_and_exit, auto_install_update])
        .run(tauri::generate_context!())
        .expect("error while running Hephaestus");
}
