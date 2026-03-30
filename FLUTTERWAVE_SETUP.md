# Flutterwave Setup Guide

This guide is for your current project.

You do not need to guess.
You do not need to rewrite code.

The Flutterwave code is already added.

You only need to:

1. create the Flutterwave account
2. copy your keys
3. add environment variables in Netlify
4. turn Flutterwave on in `config.js`
5. set the webhook URL in Flutterwave
6. test one payment

## Important First Rule

Create the Flutterwave account in the name of the person or business that should receive the money.

- If this is your own business, use your own details
- If this is for your client and your client should receive the money, use your client's details

## What The App Now Does

The app now uses this real flow:

1. reader signs in
2. reader clicks `Pay with Flutterwave`
3. your Netlify function creates a real Flutterwave checkout
4. Flutterwave sends the reader to the hosted payment page
5. after payment, the app verifies the transaction on the server
6. the server writes a trusted purchase record into Firebase
7. the book unlocks for that reader

## Files Already Prepared

These files are already connected:

- [config.js](c:\Users\USER\Desktop\E-book\config.js)
- [app.js](c:\Users\USER\Desktop\E-book\app.js)
- [initialize-flutterwave.js](c:\Users\USER\Desktop\E-book\netlify\functions\initialize-flutterwave.js)
- [verify-flutterwave-transaction.js](c:\Users\USER\Desktop\E-book\netlify\functions\verify-flutterwave-transaction.js)
- [verify-flutterwave-webhook.js](c:\Users\USER\Desktop\E-book\netlify\functions\verify-flutterwave-webhook.js)
- [firestore.rules](c:\Users\USER\Desktop\E-book\firestore.rules)

## Step 1: Create Or Open Flutterwave

Open:

https://flutterwave.com/

Create your account or log in.

Use the real business details that should receive the payment.

## Step 2: Get The Values You Need From Flutterwave

Inside Flutterwave, you need these values:

- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_SECRET_HASH`

You will use:

- the `secret key` for server-to-server API calls
- the `secret hash` for webhook verification

Important:

- do not put the secret key in frontend files
- do not put the secret hash in frontend files
- this project does not need a Flutterwave public key for the current hosted checkout flow

## Step 3: Add Environment Variables In Netlify

Open:

https://app.netlify.com/

Then:

1. open your site
2. click `Site configuration`
3. click `Environment variables`
4. add these values one by one

Add these exact names:

- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_SECRET_HASH`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `APP_SITE_NAME`

For `APP_SITE_NAME`, you can use something like:

`AKINDELE OKANLAWAN`

Important for `FIREBASE_PRIVATE_KEY`:

- paste the full private key from your Firebase service account
- include the full `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Netlify usually stores it correctly even when it contains line breaks

## Step 4: Get The Firebase Admin Values

You already use Firebase in this project.

Now you also need Firebase Admin credentials for the server functions.

Inside Firebase:

1. open your project
2. click the gear icon
3. click `Project settings`
4. open the `Service accounts` tab
5. click `Generate new private key`
6. download the JSON file

From that JSON file, copy these values into Netlify:

- `project_id` -> `FIREBASE_PROJECT_ID`
- `client_email` -> `FIREBASE_CLIENT_EMAIL`
- `private_key` -> `FIREBASE_PRIVATE_KEY`

## Step 5: Turn Flutterwave On In `config.js`

Open [config.js](c:\Users\USER\Desktop\E-book\config.js).

Find this section:

```js
flutterwave: {
  enabled: false,
  checkoutEndpoint: "/.netlify/functions/initialize-flutterwave",
  verificationEndpoint: "/.netlify/functions/verify-flutterwave-transaction",
},
```

Change it to:

```js
flutterwave: {
  enabled: true,
  checkoutEndpoint: "/.netlify/functions/initialize-flutterwave",
  verificationEndpoint: "/.netlify/functions/verify-flutterwave-transaction",
},
```

Only change:

- `enabled: false` -> `enabled: true`

Do not change the endpoint paths.

## Step 6: Add The Flutterwave Webhook URL

After your site is deployed on Netlify, copy your live webhook URL.

It will look like this:

`https://YOUR-SITE.netlify.app/.netlify/functions/verify-flutterwave-webhook`

Example:

`https://amazing-library.netlify.app/.netlify/functions/verify-flutterwave-webhook`

Then inside Flutterwave, add that URL as your webhook URL.

Also make sure the webhook uses the same secret hash as the one you saved in:

`FLUTTERWAVE_SECRET_HASH`

## Step 7: Publish Firestore Rules

Open [firestore.rules](c:\Users\USER\Desktop\E-book\firestore.rules).

Then in Firebase:

1. open `Firestore Database`
2. open the `Rules` tab
3. replace the current rules with the contents of that file
4. click `Publish`

This matters because:

- admin users need to manage books
- readers need to load their own purchases
- payment unlocks are stored in Firestore

## Step 8: Make Sure Your Books Are In Firebase

This is very important.

The payment function reads the real book price from Firestore, not from browser demo data.

That is good and safer.

So before testing payment:

1. log in to your admin page
2. create or edit the paid books there
3. save them

If Firebase is connected correctly, the books will be stored in Firestore and Flutterwave will charge the real saved amount.

## Step 9: Deploy To Netlify

Push your changes and deploy the site.

After deploy:

1. open the homepage
2. create a reader account
3. open a paid book
4. click `Pay with Flutterwave`
5. finish the payment
6. wait for the redirect back
7. the app should verify the payment and unlock the reader

## Step 10: What Success Looks Like

If everything is correct:

- Flutterwave checkout opens
- payment completes
- the app returns to your site
- the server verifies the payment
- a document is written into the `purchases` collection
- the reader can open the paid book

## Netlify Variable Checklist

Use these exact names:

```text
FLUTTERWAVE_SECRET_KEY
FLUTTERWAVE_SECRET_HASH
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
APP_SITE_NAME
```

## What You Should Never Put In `config.js`

Never put these in frontend code:

- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_SECRET_HASH`
- `FIREBASE_PRIVATE_KEY`

Only keep frontend-safe values in [config.js](c:\Users\USER\Desktop\E-book\config.js).

## Quickest Version

If you want the shortest version:

1. create Flutterwave account
2. copy your secret key and secret hash
3. add Netlify env vars
4. add Firebase service account env vars
5. set `flutterwave.enabled` to `true` in [config.js](c:\Users\USER\Desktop\E-book\config.js)
6. deploy
7. set Flutterwave webhook URL to `/.netlify/functions/verify-flutterwave-webhook`
8. publish [firestore.rules](c:\Users\USER\Desktop\E-book\firestore.rules)
9. test one paid book

## If Something Fails

Check these first:

- Flutterwave is enabled in [config.js](c:\Users\USER\Desktop\E-book\config.js)
- Netlify env vars are added exactly
- your paid book exists in Firestore
- your Firebase admin service account values are correct
- your Flutterwave webhook URL is correct
- your Firestore rules were published

If you want, I can also make one more file next:

`NETLIFY_ENV_VALUES_EXAMPLE.md`

with a copy-paste example showing exactly what each environment variable should look like.
