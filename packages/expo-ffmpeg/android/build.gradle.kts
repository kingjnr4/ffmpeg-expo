import expo.modules.plugin.gradle.ExpoModuleExtension
import groovy.json.JsonSlurper

plugins {
    id("com.android.library")
    id("expo-module-gradle-plugin")
}

val packageJson = JsonSlurper().parse(file("../package.json")) as Map<*, *>
val packageVersion = packageJson["version"] as String

group = "expo.modules.ffmpeg"
version = packageVersion

extensions.configure<ExpoModuleExtension>("expoModule") {
    canBePublished = false
}

val prepareFFmpegBinaries = tasks.register("prepareFFmpegBinaries") {
    inputs.file(file("../package.json"))
    inputs.file(file("../scripts/postinstall.js"))
    outputs.dir(file("jniLibs"))
    outputs.dir(file("include"))

    doLast {
        providers.exec {
            workingDir(file(".."))
            commandLine("node", "scripts/postinstall.js")
        }.result.get()
    }
}

android {
    namespace = "expo.modules.ffmpeg"

    defaultConfig {
        minSdk = 24

        ndk {
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }

        externalNativeBuild {
            cmake {
                cppFlags += "-std=c++17"
                arguments += listOf(
                    "-DANDROID_STL=c++_shared"
                )
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    externalNativeBuild {
        cmake {
            path = file("CMakeLists.txt")
            version = "3.22.1"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("main") {
            jniLibs.srcDirs("jniLibs")
        }
    }
}

tasks.named("preBuild") {
    dependsOn(prepareFFmpegBinaries)
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
}
