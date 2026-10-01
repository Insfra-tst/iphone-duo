import plistlib
import struct
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None, 'Corrupt archive'
    root = 'Payload/AIMobileOS.app/'
    info = plistlib.loads(archive.read(root + 'Info.plist'))
    assert info['CFBundleIdentifier'] == 'com.insfratst.aimobileos'
    assert info['CFBundleDisplayName'] == 'AI Mobile OS'
    assert info['CFBundlePackageType'] == 'APPL'
    assert info['CFBundleSupportedPlatforms'] == ['iPhoneOS']
    assert info['UIDeviceFamily'] == [1], f"Expected iPhone-only UIDeviceFamily [1], got {info.get('UIDeviceFamily')}"
    assert info['MinimumOSVersion'] == '15.0'
    assert info['CFBundleExecutable'] == 'AIMobileOS'
    executable = archive.read(root + info['CFBundleExecutable'])
    magic, cpu = struct.unpack_from('<II', executable)
    assert magic == 0xFEEDFACF and cpu == 0x0100000C, 'Expected ARM64 Mach-O'
    assert archive.getinfo(root + info['CFBundleExecutable']).external_attr >> 16 & 0o111
    assert root + 'Assets.car' in archive.namelist(), 'Missing app assets'
    page = archive.read(root + 'web/index.html').decode('utf-8')
    assert 'id="mobile-os"' in page, 'Missing AI Mobile OS interface'
    for required in ['web/script.js', 'web/styles.css', 'web/apps/app-store.json', 'web/icons/icon-180.png']:
        assert root + required in archive.namelist(), f'Missing bundled app file: {required}'
    assert archive.read(root + 'web/icons/icon-180.png').startswith(b'\x89PNG\r\n\x1a\n'), 'Invalid bundled icon'
    print('Verified archive, bundle metadata, iPhone target, ARM64 binary, assets, AI Mobile OS HTML, scripts, styles, app data, and icon.')
