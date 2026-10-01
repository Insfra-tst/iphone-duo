import plistlib
import struct
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None, 'Corrupt archive'
    root = 'Payload/DuoSimulator.app/'
    info = plistlib.loads(archive.read(root + 'Info.plist'))
    assert info['CFBundleIdentifier'] == 'com.insfratst.iphoneduo'
    assert info['CFBundlePackageType'] == 'APPL'
    assert info['CFBundleSupportedPlatforms'] == ['iPhoneOS']
    assert info['UIDeviceFamily'] == [1], 'Expected an iPhone app'
    assert info['MinimumOSVersion'] == '15.0'
    executable = archive.read(root + info['CFBundleExecutable'])
    magic, cpu = struct.unpack_from('<II', executable)
    assert magic == 0xFEEDFACF and cpu == 0x0100000C, 'Expected ARM64 Mach-O'
    assert archive.getinfo(root + info['CFBundleExecutable']).external_attr >> 16 & 0o111
    assert root + 'Assets.car' in archive.namelist(), 'Missing app assets'
    print('Verified archive, bundle metadata, iPhone target, ARM64 binary, assets and executable permissions.')
