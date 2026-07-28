---
name: Tall screenshots need slicing before vision OCR
description: Why bank SMS thread screenshots must be sliced before sending to vision models
---

Vision models downscale the whole image to fit their input; a phone SMS-thread screenshot (e.g. 540×11877) collapses to an unreadable thumbnail (~260 prompt tokens) and the model refuses to extract.

**Why:** Discovered when BIBD SMS screenshot import returned zero transactions; slicing the image into overlapping ~2:1 segments (sharp, `prepareImageSlices` in the API server's smsExtract lib) fixed it — 55/55 transactions extracted.

**How to apply:** Any feature sending user images to a vision model must slice tall/wide images (aspect > ~2.5) into overlapping segments sent as multiple image parts, with prompt guidance not to double-count overlaps. Also: the frontend receipt `compressImage` must cap only the short side for tall images, and express.json needs a raised limit (15mb) for base64 scan payloads.

Also learned: don't trust the model's `kind` classification alone — route to the multi-transaction review flow whenever >1 transaction is extracted, regardless of kind.

Dedupe contract for all import surfaces (upload tab, receipt scan, AI chat): stage rows into `uploadedDocuments`/`importedTransactionRows` and rely on the review flow's duplicate flagging + confirm-time skip (user+date+amount+type). Never insert transactions directly from extraction.
