export interface LegalSection {
  readonly heading: string;
  readonly body: string;
}

export interface LegalDocument {
  readonly title: string;
  readonly lastUpdated: string;
  readonly sections: readonly LegalSection[];
}

export const TERMS_CONTENT: LegalDocument = Object.freeze({
  title: "Terms of Use",
  lastUpdated: "2026-05-05",
  sections: Object.freeze([
    Object.freeze({
      heading: "Acceptance",
      body:
        "By accessing Burstchester you agree to these terms. This is placeholder copy that should be replaced after legal review before public launch.",
    }),
    Object.freeze({
      heading: "Dataset uploads",
      body:
        "You confirm that any dataset you upload was produced from open-source models or human authorship and does not violate the originating model's terms of service. See docs/03-data-spec.md §7 for the source-model whitelist.",
    }),
    Object.freeze({
      heading: "License",
      body:
        "Datasets are shared under their declared licenses. The Burstchester service itself is provided as-is without warranty.",
    }),
  ]),
});

export const PRIVACY_CONTENT: LegalDocument = Object.freeze({
  title: "Privacy Policy",
  lastUpdated: "2026-05-05",
  sections: Object.freeze([
    Object.freeze({
      heading: "Information we collect",
      body:
        "We store the email and display name from your Google sign-in, plus the metadata of datasets you upload. This is placeholder copy pending legal review.",
    }),
    Object.freeze({
      heading: "How we use it",
      body:
        "Account information is used to attribute uploads and downloads. We do not sell your personal data.",
    }),
    Object.freeze({
      heading: "Your rights",
      body:
        "You may request deletion of your account and associated metadata at any time by contacting support.",
    }),
  ]),
});
