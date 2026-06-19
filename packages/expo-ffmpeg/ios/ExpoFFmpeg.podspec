require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoFFmpeg'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = 'https://github.com/kingjnr4/ffmpeg-expo'
  s.platform       = :ios, '16.4'
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/kingjnr4/ffmpeg-expo.git', :tag => "v#{s.version}" }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Source files
  s.source_files = '**/*.{h,m,mm,swift}'
  s.exclude_files = 'Frameworks/**/*'

  # Vendored framework
  s.vendored_frameworks = 'Frameworks/FFmpeg.xcframework'

  # Required system frameworks
  s.frameworks = 'AudioToolbox', 'AVFoundation', 'CoreMedia', 'VideoToolbox', 'CoreVideo', 'CoreAudio'

  # System libraries
  s.libraries = 'z', 'bz2', 'iconv'

  # Build settings
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/Frameworks/FFmpeg.xcframework/ios-arm64/Headers"',
    'OTHER_LDFLAGS' => '-lz -lbz2 -liconv',
    'ENABLE_BITCODE' => 'NO'
  }

  s.user_target_xcconfig = {
    'ENABLE_BITCODE' => 'NO'
  }
end
