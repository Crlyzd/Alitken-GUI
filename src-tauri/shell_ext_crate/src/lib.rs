use std::sync::atomic::{AtomicU32, Ordering};
use windows_sys::core::GUID;
use windows_sys::Win32::Foundation::BOOL;
use windows_sys::Win32::System::Com::CoTaskMemAlloc;
use windows_sys::Win32::System::LibraryLoader::GetModuleFileNameW;
use windows_sys::Win32::System::Threading::{CreateProcessW, PROCESS_INFORMATION, STARTUPINFOW};

pub type HRESULT = i32;
pub type EXPCMDSTATE = i32;
pub type EXPCMDFLAGS = i32;

pub const S_OK: HRESULT = 0;
pub const S_FALSE: HRESULT = 1;
pub const E_NOINTERFACE: HRESULT = -2147467262;
pub const E_POINTER: HRESULT = -2147467261;
pub const E_NOTIMPL: HRESULT = -2147467263;
pub const E_OUTOFMEMORY: HRESULT = -2147024882;
pub const CLASS_E_NOAGGREGATION: HRESULT = -2147221232;
pub const CLASS_E_CLASSNOTAVAILABLE: HRESULT = -2147221231;

pub const ECS_ENABLED: EXPCMDSTATE = 0;
pub const ECF_DEFAULT: EXPCMDFLAGS = 0;
pub const SIGDN_FILESYSPATH: u32 = 0x80058000;

static MODULE_REF_COUNT: AtomicU32 = AtomicU32::new(0);

// CLSID: {a117ce00-0000-0000-0000-000000000001}
pub const CLSID_ALITKEN_COMMAND: GUID = GUID {
    data1: 0xa117ce00,
    data2: 0x0000,
    data3: 0x0000,
    data4: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01],
};

pub const IID_IUNKNOWN: GUID = GUID {
    data1: 0x00000000,
    data2: 0x0000,
    data3: 0x0000,
    data4: [0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
};

pub const IID_ICLASS_FACTORY: GUID = GUID {
    data1: 0x00000001,
    data2: 0x0000,
    data3: 0x0000,
    data4: [0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
};

// IExplorerCommand IID: {a8954136-232d-4191-838d-637678711c8b}
pub const IID_IEXPLORER_COMMAND: GUID = GUID {
    data1: 0xa8954136,
    data2: 0x232d,
    data3: 0x4191,
    data4: [0x83, 0x8d, 0x63, 0x76, 0x78, 0x71, 0x1c, 0x8b],
};

#[repr(C)]
pub struct IUnknownVtbl {
    pub QueryInterface: unsafe extern "system" fn(*mut ::core::ffi::c_void, *const GUID, *mut *mut ::core::ffi::c_void) -> HRESULT,
    pub AddRef: unsafe extern "system" fn(*mut ::core::ffi::c_void) -> u32,
    pub Release: unsafe extern "system" fn(*mut ::core::ffi::c_void) -> u32,
}

#[repr(C)]
pub struct IClassFactoryVtbl {
    pub base: IUnknownVtbl,
    pub CreateInstance: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut ::core::ffi::c_void, *const GUID, *mut *mut ::core::ffi::c_void) -> HRESULT,
    pub LockServer: unsafe extern "system" fn(*mut ::core::ffi::c_void, BOOL) -> HRESULT,
}

#[repr(C)]
pub struct IExplorerCommandVtbl {
    pub base: IUnknownVtbl,
    pub GetTitle: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut ::core::ffi::c_void, *mut *mut u16) -> HRESULT,
    pub GetIcon: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut ::core::ffi::c_void, *mut *mut u16) -> HRESULT,
    pub GetToolTip: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut ::core::ffi::c_void, *mut *mut u16) -> HRESULT,
    pub GetCanonicalName: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut GUID) -> HRESULT,
    pub GetState: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut ::core::ffi::c_void, BOOL, *mut EXPCMDSTATE) -> HRESULT,
    pub Invoke: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut ::core::ffi::c_void, *mut ::core::ffi::c_void) -> HRESULT,
    pub GetFlags: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut EXPCMDFLAGS) -> HRESULT,
    pub EnumSubCommands: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut *mut ::core::ffi::c_void) -> HRESULT,
}

#[repr(C)]
struct IShellItemArrayVtbl {
    pub base: IUnknownVtbl,
    pub GetBindCtx: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut *mut ::core::ffi::c_void) -> HRESULT,
    pub GetItemAt: unsafe extern "system" fn(*mut ::core::ffi::c_void, u32, *mut *mut ::core::ffi::c_void) -> HRESULT,
    pub GetCount: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut u32) -> HRESULT,
}

#[repr(C)]
struct IShellItemVtbl {
    pub base: IUnknownVtbl,
    pub BindToHandler: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut ::core::ffi::c_void, *const GUID, *const GUID, *mut *mut ::core::ffi::c_void) -> HRESULT,
    pub GetParent: unsafe extern "system" fn(*mut ::core::ffi::c_void, *mut *mut ::core::ffi::c_void) -> HRESULT,
    pub GetDisplayName: unsafe extern "system" fn(*mut ::core::ffi::c_void, u32, *mut *mut u16) -> HRESULT,
}

// --- AlitkenCommand Implementation ---
#[repr(C)]
struct AlitkenCommand {
    lpVtbl: *const IExplorerCommandVtbl,
    ref_count: AtomicU32,
}

static ALITKEN_COMMAND_VTBL: IExplorerCommandVtbl = IExplorerCommandVtbl {
    base: IUnknownVtbl {
        QueryInterface: cmd_query_interface,
        AddRef: cmd_add_ref,
        Release: cmd_release,
    },
    GetTitle: cmd_get_title,
    GetIcon: cmd_get_icon,
    GetToolTip: cmd_get_tool_tip,
    GetCanonicalName: cmd_get_canonical_name,
    GetState: cmd_get_state,
    Invoke: cmd_invoke,
    GetFlags: cmd_get_flags,
    EnumSubCommands: cmd_enum_sub_commands,
};

fn alloc_co_string(s: &str) -> *mut u16 {
    let wide: Vec<u16> = s.encode_utf16().chain(std::iter::once(0)).collect();
    let bytes = wide.len() * 2;
    unsafe {
        let ptr = CoTaskMemAlloc(bytes) as *mut u16;
        if !ptr.is_null() {
            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
        }
        ptr
    }
}

unsafe extern "system" fn cmd_query_interface(
    this: *mut ::core::ffi::c_void,
    riid: *const GUID,
    ppv_object: *mut *mut ::core::ffi::c_void,
) -> HRESULT {
    if ppv_object.is_null() || riid.is_null() {
        return E_POINTER;
    }
    let r = *riid;
    if (r.data1 == IID_IUNKNOWN.data1 && r.data4 == IID_IUNKNOWN.data4)
        || (r.data1 == IID_IEXPLORER_COMMAND.data1 && r.data4 == IID_IEXPLORER_COMMAND.data4)
    {
        *ppv_object = this;
        cmd_add_ref(this);
        S_OK
    } else {
        *ppv_object = std::ptr::null_mut();
        E_NOINTERFACE
    }
}

unsafe extern "system" fn cmd_add_ref(this: *mut ::core::ffi::c_void) -> u32 {
    let obj = &*(this as *const AlitkenCommand);
    obj.ref_count.fetch_add(1, Ordering::Relaxed) + 1
}

unsafe extern "system" fn cmd_release(this: *mut ::core::ffi::c_void) -> u32 {
    let obj = &*(this as *const AlitkenCommand);
    let count = obj.ref_count.fetch_sub(1, Ordering::Release) - 1;
    if count == 0 {
        std::sync::atomic::fence(Ordering::Acquire);
        let _ = Box::from_raw(this as *mut AlitkenCommand);
        MODULE_REF_COUNT.fetch_sub(1, Ordering::Relaxed);
    }
    count
}

unsafe extern "system" fn cmd_get_title(
    _this: *mut ::core::ffi::c_void,
    _psiItemArray: *mut ::core::ffi::c_void,
    ppszName: *mut *mut u16,
) -> HRESULT {
    if ppszName.is_null() {
        return E_POINTER;
    }
    *ppszName = alloc_co_string("Convert with Alitken");
    if (*ppszName).is_null() {
        E_OUTOFMEMORY
    } else {
        S_OK
    }
}

unsafe extern "system" fn cmd_get_icon(
    _this: *mut ::core::ffi::c_void,
    _psiItemArray: *mut ::core::ffi::c_void,
    ppszIcon: *mut *mut u16,
) -> HRESULT {
    if ppszIcon.is_null() {
        return E_POINTER;
    }
    let mut buf = [0u16; 512];
    let len = GetModuleFileNameW(0, buf.as_mut_ptr(), 512) as usize;
    let path = String::from_utf16_lossy(&buf[..len]);
    *ppszIcon = alloc_co_string(&path);
    S_OK
}

unsafe extern "system" fn cmd_get_tool_tip(
    _this: *mut ::core::ffi::c_void,
    _psiItemArray: *mut ::core::ffi::c_void,
    ppszInfo: *mut *mut u16,
) -> HRESULT {
    if ppszInfo.is_null() {
        return E_POINTER;
    }
    *ppszInfo = alloc_co_string("Open in Alitken Media Converter");
    S_OK
}

unsafe extern "system" fn cmd_get_canonical_name(
    _this: *mut ::core::ffi::c_void,
    pguidCommandName: *mut GUID,
) -> HRESULT {
    if pguidCommandName.is_null() {
        return E_POINTER;
    }
    *pguidCommandName = CLSID_ALITKEN_COMMAND;
    S_OK
}

unsafe extern "system" fn cmd_get_state(
    _this: *mut ::core::ffi::c_void,
    _psiItemArray: *mut ::core::ffi::c_void,
    _fOkToBeSlow: BOOL,
    pCmdState: *mut EXPCMDSTATE,
) -> HRESULT {
    if pCmdState.is_null() {
        return E_POINTER;
    }
    *pCmdState = ECS_ENABLED;
    S_OK
}

unsafe extern "system" fn cmd_invoke(
    _this: *mut ::core::ffi::c_void,
    psiItemArray: *mut ::core::ffi::c_void,
    _pbc: *mut ::core::ffi::c_void,
) -> HRESULT {
    let mut buf = [0u16; 512];
    let len = GetModuleFileNameW(0, buf.as_mut_ptr(), 512) as usize;
    let exe_path = String::from_utf16_lossy(&buf[..len]);

    let mut cmd_line = format!("\"{}\"", exe_path);

    if !psiItemArray.is_null() {
        let array_vtbl = *(psiItemArray as *const *const IShellItemArrayVtbl);
        let mut count = 0u32;
        if ((*array_vtbl).GetCount)(psiItemArray, &mut count) == S_OK {
            for i in 0..count {
                let mut item: *mut ::core::ffi::c_void = std::ptr::null_mut();
                if ((*array_vtbl).GetItemAt)(psiItemArray, i, &mut item) == S_OK && !item.is_null() {
                    let item_vtbl = *(item as *const *const IShellItemVtbl);
                    let mut path_ptr: *mut u16 = std::ptr::null_mut();
                    if ((*item_vtbl).GetDisplayName)(item, SIGDN_FILESYSPATH, &mut path_ptr) == S_OK
                        && !path_ptr.is_null()
                    {
                        let mut end = 0;
                        while *path_ptr.add(end) != 0 {
                            end += 1;
                        }
                        let path_slice = std::slice::from_raw_parts(path_ptr, end);
                        let file_path = String::from_utf16_lossy(path_slice);
                        cmd_line.push_str(&format!(" \"{}\"", file_path));
                        windows_sys::Win32::System::Com::CoTaskMemFree(path_ptr as _);
                    }
                    let unk_vtbl = *(item as *const *const IUnknownVtbl);
                    ((*unk_vtbl).Release)(item);
                }
            }
        }
    }

    let wide_cmd: Vec<u16> = cmd_line.encode_utf16().chain(std::iter::once(0)).collect();
    let mut si: STARTUPINFOW = std::mem::zeroed();
    si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
    let mut pi: PROCESS_INFORMATION = std::mem::zeroed();

    let res = CreateProcessW(
        std::ptr::null(),
        wide_cmd.as_ptr() as *mut u16,
        std::ptr::null(),
        std::ptr::null(),
        0,
        0,
        std::ptr::null(),
        std::ptr::null(),
        &si,
        &mut pi,
    );

    if res != 0 {
        windows_sys::Win32::Foundation::CloseHandle(pi.hThread);
        windows_sys::Win32::Foundation::CloseHandle(pi.hProcess);
    }

    S_OK
}

unsafe extern "system" fn cmd_get_flags(
    _this: *mut ::core::ffi::c_void,
    pFlags: *mut EXPCMDFLAGS,
) -> HRESULT {
    if pFlags.is_null() {
        return E_POINTER;
    }
    *pFlags = ECF_DEFAULT;
    S_OK
}

unsafe extern "system" fn cmd_enum_sub_commands(
    _this: *mut ::core::ffi::c_void,
    ppEnum: *mut *mut ::core::ffi::c_void,
) -> HRESULT {
    if !ppEnum.is_null() {
        *ppEnum = std::ptr::null_mut();
    }
    E_NOTIMPL
}

// --- AlitkenClassFactory Implementation ---
#[repr(C)]
struct AlitkenClassFactory {
    lpVtbl: *const IClassFactoryVtbl,
    ref_count: AtomicU32,
}

static ALITKEN_FACTORY_VTBL: IClassFactoryVtbl = IClassFactoryVtbl {
    base: IUnknownVtbl {
        QueryInterface: factory_query_interface,
        AddRef: factory_add_ref,
        Release: factory_release,
    },
    CreateInstance: factory_create_instance,
    LockServer: factory_lock_server,
};

unsafe extern "system" fn factory_query_interface(
    this: *mut ::core::ffi::c_void,
    riid: *const GUID,
    ppv_object: *mut *mut ::core::ffi::c_void,
) -> HRESULT {
    if ppv_object.is_null() || riid.is_null() {
        return E_POINTER;
    }
    let r = *riid;
    if (r.data1 == IID_IUNKNOWN.data1 && r.data4 == IID_IUNKNOWN.data4)
        || (r.data1 == IID_ICLASS_FACTORY.data1 && r.data4 == IID_ICLASS_FACTORY.data4)
    {
        *ppv_object = this;
        factory_add_ref(this);
        S_OK
    } else {
        *ppv_object = std::ptr::null_mut();
        E_NOINTERFACE
    }
}

unsafe extern "system" fn factory_add_ref(this: *mut ::core::ffi::c_void) -> u32 {
    let obj = &*(this as *const AlitkenClassFactory);
    obj.ref_count.fetch_add(1, Ordering::Relaxed) + 1
}

unsafe extern "system" fn factory_release(this: *mut ::core::ffi::c_void) -> u32 {
    let obj = &*(this as *const AlitkenClassFactory);
    let count = obj.ref_count.fetch_sub(1, Ordering::Release) - 1;
    if count == 0 {
        std::sync::atomic::fence(Ordering::Acquire);
        let _ = Box::from_raw(this as *mut AlitkenClassFactory);
        MODULE_REF_COUNT.fetch_sub(1, Ordering::Relaxed);
    }
    count
}

unsafe extern "system" fn factory_create_instance(
    _this: *mut ::core::ffi::c_void,
    pUnkOuter: *mut ::core::ffi::c_void,
    riid: *const GUID,
    ppvObject: *mut *mut ::core::ffi::c_void,
) -> HRESULT {
    if !pUnkOuter.is_null() {
        return CLASS_E_NOAGGREGATION;
    }
    let cmd = Box::new(AlitkenCommand {
        lpVtbl: &ALITKEN_COMMAND_VTBL,
        ref_count: AtomicU32::new(1),
    });
    MODULE_REF_COUNT.fetch_add(1, Ordering::Relaxed);
    let ptr = Box::into_raw(cmd) as *mut ::core::ffi::c_void;
    let hr = cmd_query_interface(ptr, riid, ppvObject);
    cmd_release(ptr);
    hr
}

unsafe extern "system" fn factory_lock_server(
    _this: *mut ::core::ffi::c_void,
    fLock: BOOL,
) -> HRESULT {
    if fLock != 0 {
        MODULE_REF_COUNT.fetch_add(1, Ordering::Relaxed);
    } else {
        MODULE_REF_COUNT.fetch_sub(1, Ordering::Relaxed);
    }
    S_OK
}

// Exported DLL Functions
#[no_mangle]
pub unsafe extern "system" fn DllGetClassObject(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut ::core::ffi::c_void,
) -> HRESULT {
    if ppv.is_null() || rclsid.is_null() || riid.is_null() {
        return E_POINTER;
    }
    let cls = *rclsid;
    if cls.data1 == CLSID_ALITKEN_COMMAND.data1 && cls.data4 == CLSID_ALITKEN_COMMAND.data4 {
        let factory = Box::new(AlitkenClassFactory {
            lpVtbl: &ALITKEN_FACTORY_VTBL,
            ref_count: AtomicU32::new(1),
        });
        MODULE_REF_COUNT.fetch_add(1, Ordering::Relaxed);
        let ptr = Box::into_raw(factory) as *mut ::core::ffi::c_void;
        let hr = factory_query_interface(ptr, riid, ppv);
        factory_release(ptr);
        hr
    } else {
        *ppv = std::ptr::null_mut();
        CLASS_E_CLASSNOTAVAILABLE
    }
}

#[no_mangle]
pub unsafe extern "system" fn DllCanUnloadNow() -> HRESULT {
    if MODULE_REF_COUNT.load(Ordering::Relaxed) == 0 {
        S_OK
    } else {
        S_FALSE
    }
}
