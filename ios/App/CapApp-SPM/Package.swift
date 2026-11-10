// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.0"),
        .package(name: "CapacitorCommunityAppleSignIn", path: "../../../../../node_modules/.pnpm/@capacitor-community+apple-sign-in@7.1.0_@capacitor+core@8.6.0/node_modules/@capacitor-community/apple-sign-in"),
        .package(name: "CapacitorApp", path: "../../../../../node_modules/.pnpm/@capacitor+app@8.1.2_@capacitor+core@8.6.0/node_modules/@capacitor/app"),
        .package(name: "CapacitorCamera", path: "../../../../../node_modules/.pnpm/@capacitor+camera@8.2.6_@capacitor+core@8.6.0/node_modules/@capacitor/camera"),
        .package(name: "CapacitorFilesystem", path: "../../../../../node_modules/.pnpm/@capacitor+filesystem@8.1.5_@capacitor+core@8.6.0/node_modules/@capacitor/filesystem"),
        .package(name: "CapacitorKeyboard", path: "../../../../../node_modules/.pnpm/@capacitor+keyboard@8.0.6_@capacitor+core@8.6.0/node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorPreferences", path: "../../../../../node_modules/.pnpm/@capacitor+preferences@8.0.1_@capacitor+core@8.6.0/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorPushNotifications", path: "../../../../../node_modules/.pnpm/@capacitor+push-notifications@8.1.3_@capacitor+core@8.6.0/node_modules/@capacitor/push-notifications"),
        .package(name: "CapacitorSplashScreen", path: "../../../../../node_modules/.pnpm/@capacitor+splash-screen@8.0.2_@capacitor+core@8.6.0/node_modules/@capacitor/splash-screen"),
        .package(name: "CapacitorStatusBar", path: "../../../../../node_modules/.pnpm/@capacitor+status-bar@8.0.4_@capacitor+core@8.6.0/node_modules/@capacitor/status-bar"),
        .package(name: "CapawesomeTeamCapacitorFileOpener", path: "../../../../../node_modules/.pnpm/@capawesome-team+capacitor-file-opener@8.0.5_@capacitor+core@8.6.0/node_modules/@capawesome-team/capacitor-file-opener"),
        .package(name: "CapgoCapacitorDocumentScanner", path: "../../../../../node_modules/.pnpm/@capgo+capacitor-document-scanner@8.4.13_@capacitor+core@8.6.0/node_modules/@capgo/capacitor-document-scanner"),
        .package(name: "CapgoCapacitorNativeBiometric", path: "../../../../../node_modules/.pnpm/@capgo+capacitor-native-biometric@8.8.3_@capacitor+core@8.6.0/node_modules/@capgo/capacitor-native-biometric")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorCommunityAppleSignIn", package: "CapacitorCommunityAppleSignIn"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorCamera", package: "CapacitorCamera"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar"),
                .product(name: "CapawesomeTeamCapacitorFileOpener", package: "CapawesomeTeamCapacitorFileOpener"),
                .product(name: "CapgoCapacitorDocumentScanner", package: "CapgoCapacitorDocumentScanner"),
                .product(name: "CapgoCapacitorNativeBiometric", package: "CapgoCapacitorNativeBiometric")
            ]
        )
    ]
)
