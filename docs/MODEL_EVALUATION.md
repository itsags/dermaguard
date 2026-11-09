# Model readiness and safety gate

No skin-lesion model is enabled. `MODEL_MODE=unavailable` is the safe default.

Before enabling inference, document dataset provenance and license, patient-level train/validation/test separation, preprocessing, class mapping, per-class recall/specificity/precision/F1, calibration, demographic and image-source limitations, data leakage checks, model versioning, and clinical review. Do not use a consumer photograph to assign cancer type, cancer stage, or a confirmed diagnosis.

The assessment API intentionally exposes `model_status` and returns an unavailable state instead of a fabricated result. A demo fixture, if added later, must be visibly labelled `demo_only` and must never look like a clinical prediction.
