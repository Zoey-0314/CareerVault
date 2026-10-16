const EN_MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeMonth(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if (iso) return raw;

  const numeric = raw.match(/(20\d{2})\s*(?:年|[-/.])\s*(\d{1,2})/);
  if (numeric) {
    const month = Number(numeric[2]);
    if (month >= 1 && month <= 12) return `${numeric[1]}-${String(month).padStart(2, "0")}`;
  }

  const english = raw.match(/\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (english) return `${english[2]}-${EN_MONTHS[english[1].toLowerCase()]}`;
  return raw;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getPath(object, path) {
  return String(path || "").split(".").filter(Boolean).reduce((value, key) => value?.[key], object);
}

function candidateCertificateNumber(response) {
  const direct = response?.visualKeyFields?.certificateNumber;
  if (direct) return String(direct).trim();
  const description = String(response?.extracted?.description || "");
  const labelled = description.match(/(?:证书编号|certificate\s*(?:no\.?|number))\s*[：:]?\s*([^；;\n]+)/i);
  return labelled?.[1]?.trim() || "";
}

export function canonicalCredentialResponse(response) {
  return {
    name: String(response?.extracted?.name || ""),
    issuer: String(response?.extracted?.issuer || ""),
    date: normalizeMonth(response?.extracted?.date || ""),
    rank: String(response?.extracted?.rank || ""),
    type: String(response?.extracted?.type || ""),
    description: String(response?.extracted?.description || ""),
    certificateNumber: candidateCertificateNumber(response),
    transcription: String(response?.transcription || ""),
  };
}

function matchesExpectation(actual, spec) {
  const mode = spec?.match || "normalized_exact";
  const expected = spec?.value;
  if (mode === "month") return normalizeMonth(actual) === normalizeMonth(expected);
  if (mode === "contains") return normalizeText(actual).includes(normalizeText(expected));
  if (mode === "one_of") return asArray(spec?.values).some((item) => normalizeText(actual) === normalizeText(item));
  if (mode === "regex") {
    try { return new RegExp(String(expected), spec?.flags || "i").test(String(actual ?? "")); }
    catch { return false; }
  }
  return normalizeText(actual) === normalizeText(expected);
}

function evaluateFields(actual, expectedFields = {}) {
  const details = [];
  let weightedTotal = 0;
  let weightedCorrect = 0;
  let requiredCount = 0;
  let missingRequired = 0;

  for (const [field, spec] of Object.entries(expectedFields)) {
    const weight = Number(spec?.weight) > 0 ? Number(spec.weight) : 1;
    const required = spec?.required !== false;
    const actualValue = getPath(actual, field);
    const present = String(actualValue ?? "").trim().length > 0;
    const correct = present && matchesExpectation(actualValue, spec);

    weightedTotal += weight;
    if (correct) weightedCorrect += weight;
    if (required) {
      requiredCount += 1;
      if (!present) missingRequired += 1;
    }

    details.push({
      field,
      expected: spec?.value ?? spec?.values ?? null,
      actual: actualValue ?? "",
      required,
      weight,
      present,
      correct,
    });
  }

  return {
    fieldAccuracy: weightedTotal ? weightedCorrect / weightedTotal : 1,
    missingRequiredRate: requiredCount ? missingRequired / requiredCount : 0,
    details,
  };
}

function phraseCoverage(text, phrases = []) {
  const normalized = normalizeText(text);
  const checks = phrases.map((phrase) => ({
    phrase,
    found: normalized.includes(normalizeText(phrase)),
  }));
  const matched = checks.filter((item) => item.found).length;
  return {
    coverage: checks.length ? matched / checks.length : 1,
    checks,
  };
}

function findForbidden(response, patterns = []) {
  const haystack = JSON.stringify({
    extracted: response?.extracted,
    assessment: response?.assessment,
    roleTitle: response?.roleTitle,
    jdText: response?.jdText,
    analysis: response?.analysis,
  });
  const hits = [];
  for (const pattern of patterns) {
    try {
      if (new RegExp(pattern, "i").test(haystack)) hits.push(pattern);
    } catch {
      if (normalizeText(haystack).includes(normalizeText(pattern))) hits.push(pattern);
    }
  }
  return hits;
}

export function evaluateCredentialCase(fixture, response) {
  const actual = canonicalCredentialResponse(response);
  const fields = evaluateFields(actual, fixture.expected?.fields || {});
  const transcription = phraseCoverage(actual.transcription, fixture.expected?.transcriptionMustContain || []);
  const hallucinations = findForbidden(response, fixture.expected?.forbiddenPatterns || []);
  const thresholds = {
    fieldAccuracy: fixture.thresholds?.fieldAccuracy ?? 0.95,
    transcriptionCoverage: fixture.thresholds?.transcriptionCoverage ?? 0.95,
    missingRequiredRate: fixture.thresholds?.missingRequiredRate ?? 0,
    hallucinationCount: fixture.thresholds?.hallucinationCount ?? 0,
  };

  const pass = fields.fieldAccuracy >= thresholds.fieldAccuracy
    && transcription.coverage >= thresholds.transcriptionCoverage
    && fields.missingRequiredRate <= thresholds.missingRequiredRate
    && hallucinations.length <= thresholds.hallucinationCount;

  return {
    id: fixture.id,
    kind: fixture.kind,
    pass,
    metrics: {
      fieldAccuracy: fields.fieldAccuracy,
      transcriptionCoverage: transcription.coverage,
      missingRequiredRate: fields.missingRequiredRate,
      hallucinationCount: hallucinations.length,
    },
    thresholds,
    fieldDetails: fields.details,
    transcriptionChecks: transcription.checks,
    hallucinations,
  };
}

export function evaluateJdCase(fixture, response) {
  const actual = {
    roleTitle: String(response?.roleTitle || ""),
    jdText: String(response?.jdText || ""),
  };
  const fields = evaluateFields(actual, fixture.expected?.fields || {});
  const content = phraseCoverage(actual.jdText, fixture.expected?.mustContain || []);
  const hallucinations = findForbidden(response, fixture.expected?.forbiddenPatterns || []);
  const thresholds = {
    fieldAccuracy: fixture.thresholds?.fieldAccuracy ?? 1,
    contentCoverage: fixture.thresholds?.contentCoverage ?? 0.95,
    missingRequiredRate: fixture.thresholds?.missingRequiredRate ?? 0,
    hallucinationCount: fixture.thresholds?.hallucinationCount ?? 0,
  };
  const pass = fields.fieldAccuracy >= thresholds.fieldAccuracy
    && content.coverage >= thresholds.contentCoverage
    && fields.missingRequiredRate <= thresholds.missingRequiredRate
    && hallucinations.length <= thresholds.hallucinationCount;

  return {
    id: fixture.id,
    kind: fixture.kind,
    pass,
    metrics: {
      fieldAccuracy: fields.fieldAccuracy,
      contentCoverage: content.coverage,
      missingRequiredRate: fields.missingRequiredRate,
      hallucinationCount: hallucinations.length,
    },
    thresholds,
    fieldDetails: fields.details,
    contentChecks: content.checks,
    hallucinations,
  };
}

export function evaluateInterviewCase(fixture, response) {
  const facts = asArray(response?.analysis?.extractedFacts);
  const factText = facts.map((item) => String(item?.value || "")).join("\n");
  const required = phraseCoverage(factText, fixture.expected?.factValuesMustContain || []);
  const forbidden = findForbidden(response, fixture.expected?.forbiddenPatterns || []);
  const sourceTextMissing = facts.filter((item) => !String(item?.sourceText || "").trim()).length;
  const thresholds = {
    factCoverage: fixture.thresholds?.factCoverage ?? 1,
    hallucinationCount: fixture.thresholds?.hallucinationCount ?? 0,
    sourceTextMissing: fixture.thresholds?.sourceTextMissing ?? 0,
  };
  const pass = required.coverage >= thresholds.factCoverage
    && forbidden.length <= thresholds.hallucinationCount
    && sourceTextMissing <= thresholds.sourceTextMissing;

  return {
    id: fixture.id,
    kind: fixture.kind,
    pass,
    metrics: {
      factCoverage: required.coverage,
      hallucinationCount: forbidden.length,
      sourceTextMissing,
    },
    thresholds,
    factChecks: required.checks,
    hallucinations: forbidden,
  };
}

export function evaluateCase(fixture, response) {
  if (fixture.kind === "credential") return evaluateCredentialCase(fixture, response);
  if (fixture.kind === "jd") return evaluateJdCase(fixture, response);
  if (fixture.kind === "interview") return evaluateInterviewCase(fixture, response);
  throw new Error(`Unsupported eval kind: ${fixture.kind}`);
}

export function validateFixture(fixture) {
  const errors = [];
  if (!fixture || typeof fixture !== "object") return ["fixture must be an object"];
  if (!fixture.id || typeof fixture.id !== "string") errors.push("id is required");
  if (!["credential", "jd", "interview"].includes(fixture.kind)) errors.push("kind must be credential, jd, or interview");
  if (!fixture.expected || typeof fixture.expected !== "object") errors.push("expected is required");
  if (fixture.kind !== "interview" && !fixture.assetFile) errors.push("assetFile is required for credential/jd live eval cases");
  if (fixture.kind === "interview" && !fixture.request) errors.push("request is required for interview live eval cases");
  return errors;
}
