# Integration Guide

This guide is for a beginner.

Important update:

- this project now has a dedicated Flutterwave flow
- use [FLUTTERWAVE_SETUP.md](c:\Users\USER\Desktop\E-book\FLUTTERWAVE_SETUP.md) for payments
- the old Stripe and Paystack sections below are no longer the payment path you should follow for this setup

You do not need to guess.
You do not need to know what comes next.

Just follow the steps in order.

## Before You Start

Keep these two files open:

- [INTEGRATION_GUIDE.md](c:\Users\USER\Desktop\E-book\INTEGRATION_GUIDE.md)
- [config.js](c:\Users\USER\Desktop\E-book\config.js)

Your `config.js` currently looks like this:

```js
window.APP_CONFIG = {
  app: {
    name: "Luma Library",
    mode: "demo",
  },
  firebase: {
    enabled: false,
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
  cloudinary: {
    enabled: false,
    cloudName: "",
    unsignedUploadPreset: "",
    folder: "luma-library",
  },
  stripe: {
    enabled: false,
    publicKey: "",
    checkoutEndpoint: "/.netlify/functions/create-stripe-checkout",
  },
  paystack: {
    enabled: false,
    publicKey: "",
    checkoutEndpoint: "/.netlify/functions/initialize-paystack",
  },
  admin: {
    hiddenRoute: "/admin.html",
  },
};
```

That is good.
We are going to fill those empty parts one by one.

## The Order You Should Follow

Do it in this order:

1. Set up Firebase
2. Put Firebase values into `config.js`
3. Set up Cloudinary
4. Put Cloudinary values into `config.js`
5. Test your admin uploads
6. Set up Stripe
7. Set up Paystack
8. Put secret keys in Netlify later

If you are tired, stop after Firebase or Cloudinary.
That is fine.

## Part 1: Firebase Setup

### Step 1: Open Firebase

Click this link:

https://console.firebase.google.com/

### Step 2: Create a project

When Firebase opens:

1. Click `Create a project`
2. In the project name box, type a name
   Example: `luma-library`
3. Click `Continue`
4. If it asks about Google Analytics, you can turn it off for now
5. Click `Create project`
6. Wait for Firebase to finish
7. Click `Continue`

### Step 3: Add a web app

Inside your Firebase project:

1. Look for the `</>` web icon
2. Click the web icon
3. In `App nickname`, type something simple
   Example: `luma-library-web`
4. Do not worry about hosting for now
5. Click `Register app`

### Step 4: Copy the Firebase config values

After you register the web app, Firebase will show a config block.

You will see values like:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

Copy each one.

### Step 5: Paste those values into `config.js`

Open [config.js](c:\Users\USER\Desktop\E-book\config.js).

Find this section:

```js
firebase: {
  enabled: false,
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
},
```

Change it so it looks like this:

```js
firebase: {
  enabled: true,
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_AUTH_DOMAIN_HERE",
  projectId: "PASTE_PROJECT_ID_HERE",
  storageBucket: "PASTE_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_APP_ID_HERE",
},
```

Important:

- replace `enabled: false` with `enabled: true`
- paste the real values between the quotes
- do not remove commas
- do not remove quotation marks

### Step 6: Turn on Firebase Authentication

Go back to Firebase.

In the left menu:

1. Click `Build`
2. Click `Authentication`
3. Click `Get started`
4. Click the `Sign-in method` tab
5. Click `Email/Password`
6. Turn on `Email/Password`
7. Click `Save`

This allows users and admins to log in with email and password.

### Step 7: Create Firestore Database

Still in Firebase:

1. In the left menu, click `Build`
2. Click `Firestore Database`
3. Click `Create database`
4. Choose `Start in production mode` if you want safer defaults
5. Click `Next`
6. Choose the region closest to you
7. Click `Enable`

### Step 8: Create the collections you need

Inside Firestore:

1. Click `Start collection`
2. For collection ID, type `books`
3. For `Document ID`, choose `Auto-ID`
4. Under `Add field`, create these fields exactly:

| Field name | Field type | What to write |
| --- | --- | --- |
| `id` | `string` | `my-first-book` |
| `title` | `string` | `My First Book` |
| `author` | `string` | `Your Name` |
| `description` | `string` | `This is my first uploaded book.` |
| `category` | `string` | `General` |
| `type` | `string` | `free` |
| `price` | `string` | `Free` |
| `currency` | `string` | `USD` |
| `featured` | `boolean` | `false` |
| `published` | `boolean` | `true` |
| `coverUrl` | `string` | `https://example.com/cover.jpg` |
| `pdfUrl` | `string` | `https://example.com/book.pdf` |
| `pdfFileName` | `string` | `book.pdf` |
| `createdAt` | `string` | `2026-03-29T00:00:00.000Z` |

5. Click `Save`

Important for `books`:

- for `Field type`, choose `string` for normal text values
- choose `boolean` only for `featured` and `published`
- if your book is paid, set:
  - `type` = `paid`
  - `price` = something like `14.99`
- if your book is free, set:
  - `type` = `free`
  - `price` = `Free`
- you can use fake URLs first if you are only testing
- later, when Cloudinary is ready, replace `coverUrl` and `pdfUrl` with real uploaded file links

Then create these collections too:

- `users`
- `purchases`

If you want to make them one by one:

1. Click `Start collection`
2. Type the collection name
3. Choose `Auto-ID`
4. Add a simple test document
5. Click `Save`

Use these simple starter fields:

For `users` collection:

| Field name | Field type | What to write |
| --- | --- | --- |
| `email` | `string` | `test@example.com` |
| `name` | `string` | `Test User` |
| `role` | `string` | `reader` |
| `createdAt` | `string` | `2026-03-29T00:00:00.000Z` |

Important for the real admin account:

- the admin page now signs in with Firebase Authentication
- after sign-in, it checks the `users` collection for admin access
- the real admin user's Firestore document ID should be the Firebase Auth `UID`
- inside that user document, add `role` = `admin`
- you can also add `admin` = `true` if you want

For `purchases` collection:

| Field name | Field type | What to write |
| --- | --- | --- |
| `bookId` | `string` | `my-first-book` |
| `userEmail` | `string` | `test@example.com` |
| `amount` | `string` | `14.99` |
| `currency` | `string` | `USD` |
| `status` | `string` | `paid` |
| `createdAt` | `string` | `2026-03-29T00:00:00.000Z` |

You are not trying to make perfect data yet.
You are just creating the collections correctly so the project structure exists.

### Step 9: What to do next

After Firebase is done:

1. Save `config.js`
2. Refresh your site
3. Then move to Cloudinary below

## Part 2: Cloudinary Setup

Cloudinary is for:

- cover image upload
- PDF upload

### Step 1: Open Cloudinary

Click this link:

https://console.cloudinary.com/

If you do not have an account yet:

1. Sign up
2. Verify your email if they ask
3. Log in

### Step 2: Find your Cloud Name

When you enter Cloudinary:

1. Go to the dashboard home screen
2. Look for `Cloud name`
3. Copy that value

You will paste it into `config.js` soon.

### Step 3: Create an unsigned upload preset

In Cloudinary:

1. Look for `Settings`
2. Click `Upload`
3. Scroll to `Upload presets`
4. Click `Add upload preset`

Now set it like this:

1. In preset mode, choose `Unsigned`
2. Give the preset a name
   Example: `luma_unsigned`
3. If there is a folder option, you can use `luma-library`
4. Save the preset

### Step 4: Copy the upload preset name

After saving:

1. Find the preset you just created
2. Copy its preset name

You now need two Cloudinary values:

- cloud name
- unsigned upload preset name

### Step 5: Paste Cloudinary values into `config.js`

Open [config.js](c:\Users\USER\Desktop\E-book\config.js).

Find this section:

```js
cloudinary: {
  enabled: false,
  cloudName: "",
  unsignedUploadPreset: "",
  folder: "luma-library",
},
```

Change it to this:

```js
cloudinary: {
  enabled: true,
  cloudName: "PASTE_YOUR_CLOUD_NAME_HERE",
  unsignedUploadPreset: "PASTE_YOUR_UPLOAD_PRESET_HERE",
  folder: "luma-library",
},
```

Important:

- change `enabled: false` to `enabled: true`
- keep `folder: "luma-library"` unless you want a different folder name

### Step 6: What to do next

After that:

1. Save `config.js`
2. Open your admin page
3. Try uploading a cover image
4. Try uploading a PDF

If it works, Cloudinary is connected correctly.

## Part 3: Exactly What You Should Change in `config.js`

When Firebase and Cloudinary are finished, your file should look like this style:

```js
window.APP_CONFIG = {
  app: {
    name: "Luma Library",
    mode: "demo",
  },
  firebase: {
    enabled: true,
    apiKey: "your-real-value",
    authDomain: "your-real-value",
    projectId: "your-real-value",
    storageBucket: "your-real-value",
    messagingSenderId: "your-real-value",
    appId: "your-real-value",
  },
  cloudinary: {
    enabled: true,
    cloudName: "your-real-value",
    unsignedUploadPreset: "your-real-value",
    folder: "luma-library",
  },
  stripe: {
    enabled: false,
    publicKey: "",
    checkoutEndpoint: "/.netlify/functions/create-stripe-checkout",
  },
  paystack: {
    enabled: false,
    publicKey: "",
    checkoutEndpoint: "/.netlify/functions/initialize-paystack",
  },
  admin: {
    hiddenRoute: "/admin.html",
  },
};
```

At this stage:

- Firebase should be `true`
- Cloudinary should be `true`
- Stripe can still stay `false`
- Paystack can still stay `false`

That is okay.

## Part 4: Stripe Setup

Do this after Firebase and Cloudinary.

### Step 1: Open Stripe

Click this link:

https://dashboard.stripe.com/register

If you already have an account, log in here:

https://dashboard.stripe.com/

### Step 2: Get your publishable key

In Stripe dashboard:

1. Look for `Developers`
2. Look for `API keys`
3. Copy the `Publishable key`

Do not copy the secret key into frontend code.

### Step 3: Put the Stripe public key into `config.js`

Open [config.js](c:\Users\USER\Desktop\E-book\config.js).

Find:

```js
stripe: {
  enabled: false,
  publicKey: "",
  checkoutEndpoint: "/.netlify/functions/create-stripe-checkout",
},
```

Change it to:

```js
stripe: {
  enabled: true,
  publicKey: "PASTE_STRIPE_PUBLISHABLE_KEY_HERE",
  checkoutEndpoint: "/.netlify/functions/create-stripe-checkout",
},
```

### Step 4: What happens next

Later, your backend function here:

- [create-stripe-checkout.js](c:\Users\USER\Desktop\E-book\netlify\functions\create-stripe-checkout.js)

will use your Stripe secret key on Netlify.

Do not put the Stripe secret key inside `config.js`.

## Part 5: Paystack Setup

Do this only if you want Paystack too.

### Step 1: Open Paystack

Click this link:

https://dashboard.paystack.com/#/signup

If you already have an account, log in here:

https://dashboard.paystack.com/

### Step 2: Copy the public key

In the Paystack dashboard:

1. Go to your settings or developer/API area
2. Find your `Public Key`
3. Copy it

Do not put the secret key into frontend code.

### Step 3: Put the Paystack public key into `config.js`

Open [config.js](c:\Users\USER\Desktop\E-book\config.js).

Find:

```js
paystack: {
  enabled: false,
  publicKey: "",
  checkoutEndpoint: "/.netlify/functions/initialize-paystack",
},
```

Change it to:

```js
paystack: {
  enabled: true,
  publicKey: "PASTE_PAYSTACK_PUBLIC_KEY_HERE",
  checkoutEndpoint: "/.netlify/functions/initialize-paystack",
},
```

## Part 6: Netlify Setup Later

Do this when you are ready to go live.

### Step 1: Open Netlify

Click this link:

https://app.netlify.com/

### Step 2: Add your project

Inside Netlify:

1. Click `Add new site`
2. Click `Import an existing project`
3. Connect GitHub
4. Choose your repo
5. Click deploy

### Step 3: Add environment variables

Inside your Netlify site:

1. Click `Site configuration`
2. Click `Environment variables`
3. Add these one by one

Add:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYSTACK_SECRET_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Important

These values should go into Netlify environment variables, not into `config.js`.

## Part 6.5: Admin Login Fix

Right now the admin page uses the values inside `config.js`.

The admin page no longer uses an email and password stored in `config.js`.

It now works like this:

1. The admin signs in with Firebase Authentication
2. The app checks the signed-in user
3. The dashboard opens only if that user has admin access

### Step 1: Create the real admin user in Firebase Authentication

In Firebase:

1. Open `Authentication`
2. Open the `Users` tab
3. Click `Add user`
4. Enter your real admin email
5. Enter your real admin password
6. Save

### Step 2: Copy the user's UID

After the user is created:

1. Click the user
2. Copy the `UID`

### Step 3: Create the matching admin document in Firestore

In Firestore:

1. Open the `users` collection
2. Click `Add document`
3. For `Document ID`, paste the Firebase Auth `UID`

Add these fields:

| Field name | Field type | What to write |
| --- | --- | --- |
| `email` | `string` | `your-real-admin@email.com` |
| `name` | `string` | `Admin User` |
| `role` | `string` | `admin` |
| `createdAt` | `string` | `2026-03-29T00:00:00.000Z` |

Then click `Save`.

### Step 4: Sign in on the admin page

Use that Firebase admin email and password on `admin.html`.

Important:

- do not put admin passwords in frontend files
- random email and password will not work anymore
- if the signed-in user does not have `role = admin`, the dashboard stays blocked
- for the strongest production setup, add Firebase custom claims and Firestore security rules too

### Step 5: Add Firestore security rules

This project now includes a rules file here:

- [firestore.rules](c:\Users\USER\Desktop\E-book\firestore.rules)

You should publish those rules in Firebase so:

- signed-in users can read their own `users/{uid}` document
- admin users can manage `books`
- non-admin users cannot write admin data

If you use the Firebase console:

1. Open `Firestore Database`
2. Open the `Rules` tab
3. Replace the rules there with the contents of [firestore.rules](c:\Users\USER\Desktop\E-book\firestore.rules)
4. Click `Publish`

Without this step, the admin role check may fail even if the email and password are correct.

## Part 7: What You Should Never Put in `config.js`

Never put these in frontend files:

- Stripe secret key
- Stripe webhook secret
- Paystack secret key
- Firebase Admin private key

Only put public or client-safe values in `config.js`.

## Part 8: The Exact Beginner Checklist

If you want the shortest possible version, do this:

1. Open Firebase: `https://console.firebase.google.com/`
2. Click `Create a project`
3. Create your project
4. Click the web app `</>` icon
5. Register the app
6. Copy the Firebase config values
7. Paste them into the `firebase` section in [config.js](c:\Users\USER\Desktop\E-book\config.js)
8. Turn on `Authentication`
9. Turn on `Email/Password`
10. Create `Firestore Database`
11. Create collections: `books`, `users`, `purchases`
12. Open Cloudinary: `https://console.cloudinary.com/`
13. Copy your `Cloud name`
14. Open `Settings`
15. Open `Upload`
16. Open `Upload presets`
17. Click `Add upload preset`
18. Choose `Unsigned`
19. Save the preset
20. Copy the preset name
21. Paste the Cloudinary values into the `cloudinary` section in [config.js](c:\Users\USER\Desktop\E-book\config.js)
22. Save `config.js`
23. Open your admin page
24. Test image upload
25. Test PDF upload

## If You Want Me To Make It Even Easier

I can do one more step for you:

- I can rewrite this again as a `do this now` checklist with tiny baby steps only
- I can also edit [config.js](c:\Users\USER\Desktop\E-book\config.js) and leave clear `PASTE HERE` markers for you
- I can also make a separate `FIREBASE_ONLY_SETUP.md` file just for Firebase

If you want, I can do the next version as:

`Step 1: click this`
`Step 2: type this`
`Step 3: copy this`
`Step 4: paste here`

with almost no extra words.
