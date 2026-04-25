#![cfg(target_arch = "wasm32")]

use std::cell::RefCell;

use effects::EffectPipeline;
use gpu::{GpuContext, wgpu};
use js_sys::{Object, Reflect};
use masks::MaskFeatherPipeline;
use serde::Deserialize;
use wasm_bindgen::{JsCast, JsValue, prelude::wasm_bindgen};

/// Classifies the GPU path that initialization landed on, so the UI can decide
/// whether to surface a degraded-rendering notice. This is the single source of
/// truth — JS never calls `requestAdapter()` itself to figure this out.
#[wasm_bindgen]
#[derive(Copy, Clone)]
pub enum GpuInitKind {
    /// WebGPU on a hardware adapter.
    Ready,
    /// WebGPU but on a CPU/software adapter (e.g. SwiftShader). Preview will
    /// likely be slow or blank.
    SoftwareFallbackAdapter,
    /// WebGPU was unavailable; we fell back to WebGL. Works but with reduced
    /// capability and performance.
    WebglFallback,
}

pub(crate) struct GpuRuntime {
    pub(crate) context: GpuContext,
    pub(crate) effects: EffectPipeline,
    pub(crate) masks: MaskFeatherPipeline,
    kind: GpuInitKind,
}

thread_local! {
    static GPU_RUNTIME: RefCell<Option<GpuRuntime>> = const { RefCell::new(None) };
}

/// Initializes the shared GPU runtime and reports which path it landed on.
///
/// Concurrent callers are expected to be serialized by the JS layer (it caches
/// the returned promise). Without that, two parallel calls would each create a
/// `GpuContext` and the second would silently overwrite the first.
#[wasm_bindgen(js_name = initializeGpu)]
pub async fn initialize_gpu() -> Result<GpuInitKind, JsValue> {
    if let Some(kind) = GPU_RUNTIME.with(|runtime| runtime.borrow().as_ref().map(|r| r.kind)) {
        return Ok(kind);
    }

    let context = GpuContext::new()
        .await
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let kind = classify_adapter(context.adapter());
    let effects = EffectPipeline::new(&context);
    let masks = MaskFeatherPipeline::new(&context);

    GPU_RUNTIME.with(|runtime| {
        runtime.replace(Some(GpuRuntime {
            context,
            effects,
            masks,
            kind,
        }));
    });

    Ok(kind)
}

fn classify_adapter(adapter: &wgpu::Adapter) -> GpuInitKind {
    let info = adapter.get_info();
    if info.backend == wgpu::Backend::Gl {
        GpuInitKind::WebglFallback
    } else if info.device_type == wgpu::DeviceType::Cpu {
        GpuInitKind::SoftwareFallbackAdapter
    } else {
        // `DeviceType::Other` is bucketed with hardware adapters; some
        // virtualized GPUs report this way and we have no better signal.
        GpuInitKind::Ready
    }
}

pub(crate) fn with_gpu_runtime<T>(
    action: impl FnOnce(&GpuRuntime) -> Result<T, JsValue>,
) -> Result<T, JsValue> {
    GPU_RUNTIME.with(|runtime| {
        let borrow = runtime.borrow();
        let Some(gpu_runtime) = borrow.as_ref() else {
            return Err(JsValue::from_str(
                "GPU context not initialized. Call initializeGpu() first.",
            ));
        };
        action(gpu_runtime)
    })
}

pub(crate) fn import_canvas_texture(
    context: &GpuContext,
    canvas: &wgpu::web_sys::OffscreenCanvas,
    width: u32,
    height: u32,
    label: &'static str,
) -> wgpu::Texture {
    context.import_offscreen_canvas_texture(canvas, width, height, label)
}

pub(crate) fn render_texture_to_canvas(
    context: &GpuContext,
    texture: &wgpu::Texture,
    width: u32,
    height: u32,
) -> Result<wgpu::web_sys::OffscreenCanvas, JsValue> {
    let canvas = wgpu::web_sys::OffscreenCanvas::new(width, height)?;
    context
        .render_texture_to_offscreen_canvas(texture, &canvas, width, height)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    Ok(canvas)
}

pub(crate) fn read_property(object: &Object, name: &str) -> Result<JsValue, JsValue> {
    Reflect::get(object, &JsValue::from_str(name))
        .map_err(|_| JsValue::from_str(&format!("Missing property '{name}'")))
}

pub(crate) fn read_offscreen_canvas_property(
    object: &Object,
    name: &str,
) -> Result<wgpu::web_sys::OffscreenCanvas, JsValue> {
    read_property(object, name)?
        .dyn_into::<wgpu::web_sys::OffscreenCanvas>()
        .map_err(|_| JsValue::from_str(&format!("Property '{name}' must be an OffscreenCanvas")))
}

pub(crate) fn read_u32_property(object: &Object, name: &str) -> Result<u32, JsValue> {
    let value = read_property(object, name)?;
    let Some(number) = value.as_f64() else {
        return Err(JsValue::from_str(&format!(
            "Property '{name}' must be a number"
        )));
    };
    Ok(number as u32)
}

pub(crate) fn read_f32_property(object: &Object, name: &str) -> Result<f32, JsValue> {
    let value = read_property(object, name)?;
    let Some(number) = value.as_f64() else {
        return Err(JsValue::from_str(&format!(
            "Property '{name}' must be a number"
        )));
    };
    Ok(number as f32)
}

pub(crate) fn read_serde_property<T>(object: &Object, name: &str) -> Result<T, JsValue>
where
    T: for<'de> Deserialize<'de>,
{
    let value = read_property(object, name)?;
    serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&format!("Invalid property '{name}': {error}")))
}
