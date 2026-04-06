# Wema Bank Transfer Logic

This file explains the payment flow in a very simple way before any code is written.

We are not using Flutterwave for now.

We are using:

- manual Wema bank transfer
- manual admin confirmation
- automatic book unlock only after admin approval

## Simple Idea

The user will not pay inside the app.

Instead:

1. the app shows the Wema bank account details
2. the user sends the money from their bank app or bank branch
3. the user tells our app that payment has been made
4. the admin checks the Wema bank account manually
5. if the payment is confirmed, the admin approves it
6. the app unlocks the paid book for that user

So the app does **not** trust the user just because the user clicked `I have paid`.

The app only trusts the admin approval.

## User Flow

This is how it should work for the reader.

1. the user signs in
2. the user opens a paid book
3. the app shows:
   - account name
   - bank name: Wema Bank
   - account number
   - amount to pay
   - payment reference
4. the user sends the money to the Wema account
5. after payment, the user clicks a button like `I have paid`
6. the user submits a small form
7. the app saves the payment request as `pending`
8. the user waits for admin confirmation
9. when approved, the paid book becomes unlocked

## What The User Should Submit

The payment form should be very simple.

It can ask for:

- book
- amount paid
- sender name
- transfer reference
- date or time of payment
- optional proof of payment screenshot

We can keep it small so users do not get confused.

## Admin Flow

This is how it should work for the admin.

1. admin signs in to the admin dashboard
2. admin opens a page or section for bank transfer requests
3. admin sees all pending requests
4. admin checks the real Wema bank account or bank alert
5. admin compares:
   - amount
   - sender name
   - transfer reference
   - time of payment
6. if the payment is correct, admin clicks `Approve`
7. if the payment is wrong or missing, admin clicks `Reject` or `Needs Review`

## What Happens After Approval

When admin approves a payment:

1. the app creates a trusted purchase record
2. the purchase is linked to:
   - the user
   - the paid book
   - the payment request
3. the book is unlocked for that user
4. the user can now open the reader page for that paid book

Important:

- only admin approval should unlock the book
- the user should never unlock a book directly from the browser

## Payment Statuses

The payment request can have simple statuses like these:

- `pending`
- `approved`
- `rejected`
- `needs_review`

Meaning:

- `pending` = user submitted payment, admin has not checked yet
- `approved` = admin confirmed payment, unlock the book
- `rejected` = payment could not be confirmed
- `needs_review` = something is unclear and admin wants to check again

## Collections Or Records We Will Likely Need

We should keep payment request records separate from final purchase records.

### 1. `transferRequests`

This stores what the user submitted.

Example fields:

- `id`
- `bookId`
- `userId`
- `bookTitle`
- `userEmail`
- `amount`
- `currency`
- `bankName`
- `accountName`
- `accountNumber`
- `paymentReference`
- `senderName`
- `paymentProofUrl`
- `status`
- `createdAt`
- `reviewedAt`
- `reviewedBy`
- `adminNote`

### 2. `purchases`

This stores trusted unlocks.

This should only be created after admin approval.

Example fields:

- `bookId`
- `userId`
- `bookTitle`
- `userEmail`
- `amount`
- `currency`
- `provider: bank_transfer`
- `status: paid`
- `transferRequestId`
- `approvedAt`

## Why We Need Two Separate Records

This is important.

`transferRequests` means:
"the user says payment was made"

`purchases` means:
"the admin confirmed the payment and the app can unlock the book"

This separation keeps the app safer and easier to manage.

## Unlock Logic

The unlock rule should be very simple:

- if a paid book has an approved purchase for this user, allow access
- if there is no approved purchase, do not allow access

So:

- `pending transfer request` does not unlock the book
- `approved purchase record` unlocks the book

## Basic Screen Ideas

Before coding, the app will likely need these simple UI parts:

### User Side

- `Pay via Bank Transfer` button
- bank details box
- `I have paid` button
- payment submission form
- message like `Your payment is pending confirmation`

### Admin Side

- list of pending transfer requests
- request details panel
- `Approve` button
- `Reject` button
- optional admin note field

## Expected Real-Life Behavior

This system is simple, but it is manual.

That means:

- users may need to wait before access is granted
- admin must check payments regularly
- support messages may increase if users pay without the correct reference

But it is still a good first step if we want to avoid Flutterwave problems for now.

## Recommended Rule For Launch

For the first version, keep the flow strict and simple:

1. show one Wema account for payment
2. require sign-in before payment submission
3. require a payment reference
4. save every request as `pending`
5. only admin can approve
6. only approved payments create purchase records
7. only purchase records unlock paid books

## One Sentence Summary

Manual Wema bank transfer means the user pays outside the app, submits payment details inside the app, the admin confirms the payment manually, and only then does the app unlock the paid book.
