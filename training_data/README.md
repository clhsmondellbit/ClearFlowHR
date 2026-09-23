# ClearFlowHR – 50 Synthetic Vietnamese Leave Forms

This dataset is synthetic and intended for OCR / field-extraction development.

## Contents
- `images/leave_001.png` … `leave_050.png`
- `tags_ocr.jsonl` — field-level OCR ground truth + approximate bounding boxes
- `tags_clearflowhr_request.jsonl` — request payloads matching the documented ClearFlowHR `EmployeeLeaveRequest` contract
- `tags_clearflowhr_expected_result.jsonl` — deterministic expected outcomes and SHA-256 receipts
- `dataset_metadata.json` — dataset summary

## Important
The expected results are generated from the rules documented in the ClearFlowHR repository. They are labels for testing/training, not logs produced by running the application.

All personal data in this dataset is fictional/synthetic.
