# Android Release Signing Setup

This document explains how to set up and use the Android release signing pipeline for Bizz Automators.

## ✅ Current Status

- **Web Build**: ✅ Working
- **Capacitor Sync**: ✅ Working  
- **Android AAB Generation**: ✅ Working (unsigned)
- **Release Signing**: ⚠️ Requires GitHub Secrets configuration
- **GitHub Actions Workflow**: ✅ Ready to use

## 📋 What You Need

To enable signed Android App Bundle builds, you need to:

1. **Generate a release keystore** (if you don't have one)
2. **Create 4 GitHub Secrets** in your repository
3. **Trigger the GitHub Actions workflow**

## 🔑 Step 1: Generate Release Keystore (If Needed)

If you already have a release keystore file, skip to Step 2.

### Create a new release keystore:

```bash
keytool -genkey -v \
  -keystore bizz-release.keystore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias bizz
```

**When prompted, answer these questions:**

```
Enter keystore password: [CHOOSE A STRONG PASSWORD]
Re-enter new password: [REPEAT PASSWORD]
What is your first and last name? [Your Name]
What is the name of your organizational unit? [Your Department]
What is the name of your organization? [Your Company]
What is the name of your City or Locality? [City]
What is the name of your State or Province? [State]
What is the two-letter country code for this unit? [US]
Is CN=... correct? [yes]
Enter key password for <bizz>: [CHOOSE A STRONG PASSWORD - can be same as keystore]
```

**This creates `bizz-release.keystore` with:**
- **Key Alias**: `bizz`
- **Keystore Password**: The password you entered
- **Key Password**: The key password you entered

⚠️ **IMPORTANT**: Keep this keystore file safe! Back it up in a secure location.

## 🔐 Step 2: Create GitHub Secrets

You need to create 4 secrets in your GitHub repository. These are **GitHub Actions Secrets**, NOT regular environment variables.

### How to create secrets:

1. Go to your GitHub repository
2. Click **Settings** (top right)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret** for each of these:

### Secret 1: `ANDROID_KEYSTORE_BASE64`

**Value**: The keystore file encoded in Base64

Run this command to generate the value:

```bash
openssl base64 -in bizz-release.keystore -out keystore-base64.txt
cat keystore-base64.txt
```

**Copy the entire output** and paste it into the GitHub Secret for `ANDROID_KEYSTORE_BASE64`

### Secret 2: `KEYSTORE_PASSWORD`

**Value**: The keystore password you chose when generating the keystore

### Secret 3: `KEY_ALIAS`

**Value**: `bizz` (unless you chose a different alias)

### Secret 4: `KEY_PASSWORD`

**Value**: The key password you chose when generating the keystore

## ✅ Verify Secrets Are Created

In GitHub, go to **Settings** → **Secrets and variables** → **Actions**

You should see:
- ✓ ANDROID_KEYSTORE_BASE64 (masked value)
- ✓ KEY_ALIAS
- ✓ KEYSTORE_PASSWORD (masked value)
- ✓ KEY_PASSWORD (masked value)

## 🚀 Step 3: Trigger the Build Workflow

### Option A: From GitHub Web UI

1. Go to your GitHub repository
2. Click **Actions** (top navigation)
3. Find **Android Release Build** workflow (left sidebar)
4. Click **Run workflow** (blue button, right side)
5. Enter a release name (e.g., `v1.0.0`)
6. Click **Run workflow**

### Option B: From Command Line

```bash
gh workflow run android-release-build.yml -f release_name=v1.0.0
```

## 📥 Step 4: Download the Signed AAB

1. The workflow will run and complete in ~3-5 minutes
2. Go to **Actions** and click the completed workflow run
3. Scroll down to the **Artifacts** section
4. Download `android-app-bundle` (the .aab file)

The AAB is now **signed and ready for Google Play Console**!

## 📦 What the Workflow Does

1. ✅ Checks out your code
2. ✅ Sets up Java 21 and Android SDK
3. ✅ Installs dependencies with Bun
4. ✅ Builds the web application
5. ✅ Syncs Capacitor with production URL (`https://buzz-gallery-hub.lovable.app`)
6. ✅ Decodes the keystore from `ANDROID_KEYSTORE_BASE64`
7. ✅ Creates temporary `key.properties` file (only in runner memory, never committed)
8. ✅ Builds Android App Bundle with signing
9. ✅ Verifies AAB integrity and structure
10. ✅ Uploads AAB as artifact
11. ✅ Deletes temporary signing files (secure cleanup)

## 🔐 Security Features

- **Secrets are masked** in workflow logs
- **No secrets are committed** to Git
- **Keystore is decoded** in-memory only, not written to disk
- **Temporary files are deleted** after each build (even if build fails)
- **Protected by GitHub's encryption** while at rest
- **Only repository admins** can view/modify secrets

## ⚠️ Important Notes

- **Never commit** `key.properties`, `*.keystore`, or `*.jks` files
- **Never hardcode** passwords in source code
- **Never share** your keystore password or key password
- **Back up your keystore** in a secure location (NOT in GitHub)
- **If you lose the keystore**, you cannot update your app on Google Play
- **Use strong passwords** (12+ characters with mixed case, numbers, symbols)

## 🐛 Troubleshooting

### Workflow shows "Secrets not configured"

This is just a warning. If you want signing, configure the 4 GitHub Secrets above.

### Build fails with "keystore error"

- Verify all 4 secrets are created correctly
- Check that `ANDROID_KEYSTORE_BASE64` is the full Base64 output (no truncation)
- Verify passwords match exactly

### Download says "No artifacts found"

The build may have failed. Check the workflow logs for errors.

### Can I use this for unsigned builds?

Yes! The workflow will build an unsigned AAB if the secrets are not configured. This is useful for testing, but Google Play requires signed APKs/AABs for publishing.

## 📚 Related Documentation

- [Android App Signing Guide](https://developer.android.com/studio/publish/app-signing)
- [Google Play Console Help](https://support.google.com/googleplay)
- [Capacitor Android Deployment](https://capacitorjs.com/docs/guides/deploying-to-app-stores)

## ✨ What's Next?

After downloading the signed AAB:

1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app or select existing one
3. Go to **Release** → **Production**
4. Upload the signed AAB
5. Complete release form and review
6. Submit for review

Good luck with your Bizz Automators launch! 🚀
