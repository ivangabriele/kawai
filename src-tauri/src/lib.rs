use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

mod commands;
mod globals;
mod system;

pub fn run() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_api_key,
            commands::hide_window
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                let app_handle = app.handle();

                tauri::async_runtime::block_on(async move {
                    #[cfg(all(desktop))]
                    {
                        system::tray::new_tray_icon(app_handle)
                            .expect("Could not create system tray.");
                    }
                });

                let super_shift_p_shortcut =
                    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyP);
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app_handle, shortcut, event| {
                            if shortcut == &super_shift_p_shortcut
                                && event.state() == ShortcutState::Pressed
                            {
                                system::window::show(&app_handle);
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(super_shift_p_shortcut)?;

                let window = app_handle
                    .get_webview_window(globals::MAIN_WINDOW_LABEL)
                    .expect(
                        format!(
                            "Could not get window with label `{}`.",
                            globals::MAIN_WINDOW_LABEL
                        )
                        .as_str(),
                    );

                let monitor = window.current_monitor().unwrap().unwrap();
                let screen_scale_factor = monitor.scale_factor();
                let screen_physical_size = monitor.size();

                #[cfg(not(debug_assertions))]
                {
                    let position = tauri::LogicalPosition {
                        x: ((screen_physical_size.width as f64 / screen_scale_factor - 1280.0)
                            / 2.0) as i32,
                        y: ((screen_physical_size.height as f64 / screen_scale_factor - 360.0)
                            / 2.0) as i32,
                    };
                    window
                        .set_position(position)
                        .expect("Could not set window position.");
                }
                #[cfg(debug_assertions)]
                {
                    use tauri::{LogicalPosition, LogicalSize};

                    let position = LogicalPosition {
                        x: ((screen_physical_size.width as f64 / screen_scale_factor - 1280.0)
                            / 2.0) as i32,
                        y: ((screen_physical_size.height as f64 / screen_scale_factor - 640.0)
                            / 2.0) as i32,
                    };
                    window
                        .set_position(position)
                        .expect("Could not set window position.");

                    window
                        .set_size(LogicalSize {
                            width: 1280.0,
                            height: 640.0,
                        })
                        .expect("Could not set window size.");
                    // window
                    //     .set_always_on_top(false)
                    //     .expect("Could not set always on top.");
                    // window
                    //     .get_webview_window(globals::MAIN_WINDOW_LABEL)
                    //     .unwrap()
                    //     .open_devtools();
                }
                // Not dev mode
            }
            Ok(())
        })
        .build(context)
        .expect("error while running tauri application")
        .run(|app_handle, run_event| match run_event {
            tauri::RunEvent::WindowEvent {
                event: window_event,
                ..
            } => match window_event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();

                    system::window::hide(app_handle);
                }
                _ => {}
            },
            _ => {}
        });
}
