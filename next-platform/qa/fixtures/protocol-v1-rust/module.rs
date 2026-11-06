#![no_std]

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! { loop {} }

#[no_mangle]
pub extern "C" fn protocol_version() -> u32 { 1 }

#[no_mangle]
pub extern "C" fn supports_local_schema(version: u32) -> u32 {
    if version >= 1 && version <= 2 { 1 } else { 0 }
}
