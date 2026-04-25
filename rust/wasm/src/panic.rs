#![cfg(target_arch = "wasm32")]

//! Wasm panic hook.
//!
//! Forwards Rust panics to the browser console via `console_error_panic_hook`,
//! and additionally stashes the formatted panic message on `window.__wasmPanic`
//! so JS catch blocks can surface the real cause instead of the opaque
//! "Unreachable" wasm trap that wasm-bindgen otherwise produces.

use js_sys::Reflect;
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

#[wasm_bindgen(start)]
pub fn install() {
    std::panic::set_hook(Box::new(|info| {
        if let Some(window) = web_sys::window() {
            let _ = Reflect::set(
                &window,
                &JsValue::from_str("__wasmPanic"),
                &JsValue::from_str(&info.to_string()),
            );
        }
        console_error_panic_hook::hook(info);
    }));
}
