# Selar Card Payments for International Readers

This website keeps the existing Wema bank-transfer flow for readers who want to pay by transfer. Selar is an additional card-payment option for paid books.

## Before Adding a Selar Link

The book owner must create the matching ebook in their Selar account first:

1. In Selar, choose `Products` and then `Add Product`.
2. Choose `Digital Product`.
3. Add the book title, price, cover, and PDF.
4. Create or publish the product.
5. Copy the public product link. It should begin with `https://selar.com/`.

Keep the Selar account password, bank details, and verification documents private. The website only needs the public product link.

## Add a New Paid Book

1. Sign in at `admin.html`.
2. Add the book details, cover, PDF, price, and choose `Paid`.
3. Paste the public Selar product link into `Selar product link for international card payments`.
4. Save the book.

The admin library will show `Selar card checkout: ready` when the link was saved successfully.

## What Buyers See

- Wema buyers sign in, submit a bank transfer, and wait for the admin to approve it. Once approved, the book unlocks in this website reader.
- Selar card buyers open the Selar page in a new tab, pay there, and receive access to the ebook through Selar.

If the Selar field is empty, the paid book keeps its Wema transfer option and does not show a card button.

## Editing or Removing a Link

Open the book in the admin dashboard and change or remove the Selar link, then save. Removing it immediately hides the card option while keeping Wema transfers available.
