import plistlib
import struct
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None, 'Corrupt archive'
    root = 'Payload/DuoWebApp.app/'
    info = plistlib.loads(archive.read(root + 'Info.plist'))
    assert info['CFBundleIdentifier'] == 'com.insfratst.iphoneduo'
    assert info['CFBundlePackageType'] == 'APPL'
    assert info['CFBundleSupportedPlatforms'] == ['iPhoneOS']
    assert info['UIDeviceFamily'] == [1], f"Expected iPhone-only UIDeviceFamily [1], got {info.get('UIDeviceFamily')}"
    assert info['MinimumOSVersion'] == '15.0'
    executable = archive.read(root + info['CFBundleExecutable'])
    magic, cpu = struct.unpack_from('<II', executable)
    assert magic == 0xFEEDFACF and cpu == 0x0100000C, 'Expected ARM64 Mach-O'
    assert archive.getinfo(root + info['CFBundleExecutable']).external_attr >> 16 & 0o111
    assert root + 'Assets.car' in archive.namelist(), 'Missing app assets'
    page = archive.read(root + 'index.html').decode('utf-8')
    assert '<div class="screens" id="screens"></div>' in page, 'Missing Duo HTML interface'
    assert 'Tap or drag to fold and unfold' in page, 'Missing fold control'
    print('Verified archive, bundle metadata, iPhone target, ARM64 binary, assets, HTML interface and fold control.')
