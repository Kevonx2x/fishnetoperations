"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { PhPhoneInput } from "@/components/ui/ph-phone-input";
import { useGlobalAlert } from "@/contexts/global-alert-context";
import { BAHAYGO_DATA_CONSENT_KEY } from "@/components/legal/data-consent-modal";
import {
  formatPrcLicenseInput,
  validateAgentName,
  validateEmailField,
  validateLicenseExpiry,
  validateLicenseField,
  validatePasswordField,
  validatePhoneField,
} from "@/lib/validation/agent-registration";
import { uploadVerificationImageToCloudinary } from "@/lib/upload-verification-image-cloudinary";
import { brokerIdForAgentApi, isBrokerUuidString } from "@/lib/validation/broker-id";

const supabase = createSupabaseBrowser();

const PRC_LICENSE_PREFIX = "PRC-AG-";
const MAX_VERIFICATION_BYTES = 5 * 1024 * 1024;

function extForVerification(kind: "license" | "selfie", file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) {
    if (kind === "license" && (fromName === "pdf" || ["jpg", "jpeg", "png", "webp", "heic"].includes(fromName))) {
      return fromName;
    }
    if (kind === "selfie" && ["jpg", "jpeg", "png", "webp", "heic"].includes(fromName)) {
      return fromName;
    }
  }
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return kind === "license" ? "pdf" : "jpg";
}

async function uploadVerificationPair(
  userId: string,
  prc: File,
  selfie: File,
): Promise<{ prc_document_url: string; selfie_url: string }> {
  const prcExt = extForVerification("license", prc);
  const prcPath = `prc/${userId}/license.${prcExt}`;

  let prc_document_url: string;
  if (prc.type === "application/pdf" || prcExt === "pdf") {
    const { error: e1 } = await supabase.storage.from("verification").upload(prcPath, prc, {
      upsert: true,
      contentType: prc.type || undefined,
    });
    if (e1) throw e1;
    prc_document_url = prcPath;
  } else {
    prc_document_url = await uploadVerificationImageToCloudinary(prc);
  }

  const selfie_url = await uploadVerificationImageToCloudinary(selfie);

  return { prc_document_url, selfie_url };
}

type VerificationDropzoneProps = {
  id: string;
  label: string;
  accept: string;
  file: File | null;
  onChange: (f: File | null) => void;
  error?: string;
};

function VerificationDropzone({ id, label, accept, file, onChange, error }: VerificationDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || file.type === "application/pdf" || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const onPick = (list: FileList | null) => {
    onChange(list?.[0] ?? null);
  };

  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onPick(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#6B9E6E]/55 bg-[#6B9E6E]/6 px-4 py-8 text-center transition hover:border-[#6B9E6E] hover:bg-[#6B9E6E]/10 ${
          dragging ? "border-[#6B9E6E] bg-[#6B9E6E]/12" : ""
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onPick(e.target.files)}
        />
        <p className="text-sm font-medium text-[#2C2C2C]">Drag and drop here, or click to browse</p>
        <p className="mt-1 text-xs text-gray-500">Max 5MB</p>
      </div>
      {file ? (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3">
          {file.type === "application/pdf" ? (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[#6B9E6E]/10">
              <FileText className="h-10 w-10 text-[#6B9E6E]" aria-hidden />
            </div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-100" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#2C2C2C]">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="mt-2 text-xs font-medium text-red-600 underline"
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function PrcLicenseInput({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const suffix = value.startsWith(PRC_LICENSE_PREFIX) ? value.slice(PRC_LICENSE_PREFIX.length) : value;
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">PRC / license number</p>
      <div className="mt-1.5 flex min-w-0 items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-[#6B9E6E]">
        <span
          className="flex shrink-0 select-none items-center border-r border-[#6B9E6E]/25 bg-[#6B9E6E]/12 px-3 py-3 font-mono text-sm font-bold tabular-nums tracking-tight text-[#2C2C2C]"
          title="Fixed prefix — type only the year and five digits"
        >
          {PRC_LICENSE_PREFIX}
        </span>
        <input
          type="text"
          id={id}
          name="license_number"
          placeholder="2024-12345"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={suffix}
          onChange={(e) => onChange(formatPrcLicenseInput(e.target.value))}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm text-[#2C2C2C] outline-none placeholder:text-gray-400"
          aria-label="PRC license — year and five-digit number (after PRC-AG-)"
        />
      </div>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
      <p className="mt-1.5 text-xs text-gray-500">Enter your year and five-digit number — the {PRC_LICENSE_PREFIX} prefix is added automatically.</p>
    </div>
  );
}

type ApprovedBroker = { id: string; company_name: string };

function normalizeApprovedBrokerRows(raw: unknown): ApprovedBroker[] {
  if (!Array.isArray(raw)) return [];
  const out: ApprovedBroker[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = o.id;
    const label = o.company_name ?? o.name;
    if (typeof id !== "string" || !isBrokerUuidString(id)) continue;
    if (typeof label !== "string" || !label.trim()) continue;
    out.push({ id: id.trim(), company_name: label.trim() });
  }
  return out;
}

type FieldErrors = Partial<
  Record<
    | "name"
    | "avatar"
    | "email"
    | "password"
    | "confirmPassword"
    | "licenseNumber"
    | "licenseExpiry"
    | "phone"
    | "regEmail"
    | "prcUpload"
    | "selfieUpload"
    | "bio"
    | "brokerId"
    | "form",
    string
  >
>;

type RegisterAgentApiJson = {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
    field?: string;
    details?: {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    };
  };
};

function firstFieldMessage(arr: string[] | undefined): string {
  return arr?.[0] ?? "";
}

function applyRegisterAgentApiErrors(
  json: RegisterAgentApiJson,
  layout: "guest" | "signed-in",
  setAuthFieldErrors: (e: FieldErrors) => void,
  setDetailErrors: (e: FieldErrors) => void,
  setSubmitError: (s: string) => void,
) {
  const err = json.error;
  const fe = err?.details?.fieldErrors;
  const formErrs = err?.details?.formErrors?.filter(Boolean) ?? [];
  const auth: FieldErrors = {};
  const detail: FieldErrors = {};
  const unmapped: string[] = [];

  const push = (apiKey: string, message: string) => {
    if (!message) return;
    switch (apiKey) {
      case "name":
        if (layout === "guest") auth.name = message;
        else detail.name = message;
        break;
      case "email":
        if (layout === "guest") auth.email = message;
        else detail.regEmail = message;
        break;
      case "license_number":
        detail.licenseNumber = message;
        break;
      case "license_expiry":
        detail.licenseExpiry = message;
        break;
      case "phone":
        detail.phone = message;
        break;
      case "bio":
        detail.bio = message;
        break;
      case "broker_id":
        detail.brokerId = message;
        break;
      case "prc_document_url":
        detail.prcUpload = message;
        break;
      case "selfie_url":
        detail.selfieUpload = message;
        break;
      default:
        unmapped.push(message);
    }
  };

  if (fe && Object.keys(fe).length > 0) {
    for (const [k, arr] of Object.entries(fe)) {
      const m = firstFieldMessage(arr);
      if (m) push(k, m);
    }
  } else if (err?.field && err.message) {
    push(err.field, err.message);
  }

  if (formErrs.length) {
    unmapped.push(...formErrs);
  }

  if (Object.keys(auth).length === 0 && Object.keys(detail).length === 0) {
    const parts = [...unmapped, err?.message].filter(Boolean) as string[];
    setSubmitError(parts.length ? parts.join(" ") : "Registration failed");
    setAuthFieldErrors({});
    setDetailErrors({});
    return;
  }

  const tail = unmapped.length ? ` ${unmapped.join(" ")}` : "";
  setSubmitError(tail.trim() ? tail.trim() : "");
  setAuthFieldErrors(auth);
  setDetailErrors(detail);
}

export default function RegisterAgentPage() {
  const { showAlert } = useGlobalAlert();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [authFieldErrors, setAuthFieldErrors] = useState<FieldErrors>({});

  const [name, setName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileNameLocked, setProfileNameLocked] = useState(false);
  const [profilePhotoLocked, setProfilePhotoLocked] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [bio, setBio] = useState("");
  const [brokerId, setBrokerId] = useState<string>("");
  const [brokers, setBrokers] = useState<ApprovedBroker[]>([]);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [detailErrors, setDetailErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);
  const [prcFile, setPrcFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [dpaConsent, setDpaConsent] = useState(false);

  const refreshSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSessionReady(!!session);
    if (session?.user?.email) {
      setRegEmail((prev) => prev || session.user.email || "");
    }
    if (session?.user?.id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", session.user.id)
        .maybeSingle();
      const fullName = String((prof as { full_name?: string | null } | null)?.full_name ?? "").trim();
      const avatarUrl = String((prof as { avatar_url?: string | null } | null)?.avatar_url ?? "").trim();
      if (fullName) {
        setName(fullName);
        setProfileNameLocked(true);
      } else {
        setProfileNameLocked(false);
      }
      if (avatarUrl) {
        setProfileAvatarUrl(avatarUrl);
        setProfilePhotoLocked(true);
      } else {
        setProfileAvatarUrl(null);
        setProfilePhotoLocked(false);
      }
    } else {
      setProfileAvatarUrl(null);
      setProfileNameLocked(false);
      setProfilePhotoLocked(false);
    }
  };

  useEffect(() => {
    void refreshSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshSession();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/v1/brokers");
      const json = (await res.json()) as { success?: boolean; data?: unknown };
      if (json.success && json.data !== undefined) {
        setBrokers(normalizeApprovedBrokerRows(json.data));
      }
    })();
  }, []);

  useEffect(() => {
    const t = brokerId.trim();
    if (t && !isBrokerUuidString(t)) setBrokerId("");
  }, [brokerId]);

  const validateVerificationFiles = (de: FieldErrors) => {
    if (!prcFile) {
      de.prcUpload = "PRC license photo is required.";
    } else if (prcFile.size > MAX_VERIFICATION_BYTES) {
      de.prcUpload = "PRC file must be 5MB or less.";
    } else if (!prcFile.type.startsWith("image/") && prcFile.type !== "application/pdf") {
      de.prcUpload = "Upload an image or PDF.";
    }
    if (!selfieFile) {
      de.selfieUpload = "Selfie photo is required.";
    } else if (selfieFile.size > MAX_VERIFICATION_BYTES) {
      de.selfieUpload = "Selfie must be 5MB or less.";
    } else if (!selfieFile.type.startsWith("image/")) {
      de.selfieUpload = "Upload an image only.";
    }
  };

  const validateGuestCombinedForm = (): boolean => {
    const ae: FieldErrors = {};
    const de: FieldErrors = {};
    const ne = validateAgentName(name);
    if (ne) ae.name = ne;
    const ee = validateEmailField(email);
    if (ee) ae.email = ee;
    const pe = validatePasswordField(password);
    if (pe) ae.password = pe;
    if (password !== confirmPassword) ae.confirmPassword = "Passwords do not match.";
    const lic = validateLicenseField(licenseNumber);
    if (lic) de.licenseNumber = lic;
    const exp = validateLicenseExpiry(licenseExpiry);
    if (exp) de.licenseExpiry = exp;
    const ph = validatePhoneField(phone);
    if (ph) de.phone = ph;
    validateVerificationFiles(de);
    setAuthFieldErrors(ae);
    setDetailErrors(de);
    return Object.keys(ae).length === 0 && Object.keys(de).length === 0;
  };

  const submitAgentRegistration = async (
    contactEmail: string,
    userId: string,
    layout: "guest" | "signed-in",
  ): Promise<boolean> => {
    if (!prcFile || !selfieFile) {
      throw new Error("PRC license photo and selfie are required.");
    }
    let prc_document_url: string | undefined;
    let selfie_url: string | undefined;
    try {
      const paths = await uploadVerificationPair(userId, prcFile, selfieFile);
      prc_document_url = paths.prc_document_url;
      selfie_url = paths.selfie_url;
    } catch {
      prc_document_url = undefined;
      selfie_url = undefined;
      showAlert(
        "Document upload failed — you can resubmit in Settings after registration",
        "warning",
      );
    }
    const res = await fetch("/api/v1/register/agent", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        license_number: licenseNumber.trim(),
        license_expiry: licenseExpiry.trim(),
        phone: phone.trim(),
        email: contactEmail.trim(),
        bio: bio.trim() || null,
        broker_id: brokerIdForAgentApi(brokerId),
        ...(prc_document_url !== undefined && selfie_url !== undefined
          ? { prc_document_url, selfie_url }
          : {}),
      }),
    });
    const json = (await res.json()) as RegisterAgentApiJson;
    if (!res.ok || !json.success) {
      const validation =
        res.status === 422 || json.error?.code === "VALIDATION_ERROR";
      if (validation && json.error) {
        applyRegisterAgentApiErrors(json, layout, setAuthFieldErrors, setDetailErrors, setSubmitError);
        return false;
      }
      throw new Error(json.error?.message || "Registration failed");
    }
    setDone(true);
    showAlert("🎉 Application submitted! We'll review your details within 24 hours.", "success");
    return true;
  };

  const handleGuestCombinedRegister = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setAuthNotice("");
    setSubmitError("");
    setAuthFieldErrors({});
    setDetailErrors({});
    if (!validateGuestCombinedForm()) return;
    if (!dpaConsent) {
      setSubmitError("Please agree to the data privacy terms");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BAHAYGO_DATA_CONSENT_KEY, "true");
    }
    setSubmitBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) throw error;
      if (data.user && !data.session) {
        setAuthNotice(
          "Check your email to confirm your account, then sign in and return here to finish your agent application.",
        );
        setSubmitBusy(false);
        return;
      }
      await refreshSession();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setAuthNotice(
          "Check your email to confirm your account, then sign in and return here to finish your agent application.",
        );
        setSubmitBusy(false);
        return;
      }
      const submitted = await submitAgentRegistration(email.trim(), session.user.id, "guest");
      if (!submitted) {
        setSubmitBusy(false);
        return;
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Registration failed");
    }
    setSubmitBusy(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSessionReady(false);
    window.location.href = "/auth/signout";
  };

  const validateDetailForm = (): boolean => {
    const e: FieldErrors = {};
    const n = validateAgentName(name);
    if (n) e.name = n;
    const lic = validateLicenseField(licenseNumber);
    if (lic) e.licenseNumber = lic;
    const exp = validateLicenseExpiry(licenseExpiry);
    if (exp) e.licenseExpiry = exp;
    const ph = validatePhoneField(phone);
    if (ph) e.phone = ph;
    const em = validateEmailField(regEmail);
    if (em) e.regEmail = em;
    validateVerificationFiles(e);
    setDetailErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitError("");
    setDetailErrors({});
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setSubmitError("Sign in or create an account first.");
      return;
    }
    if (!validateDetailForm()) return;
    setSubmitBusy(true);
    try {
      const submitted = await submitAgentRegistration(regEmail.trim(), session.user.id, "signed-in");
      if (!submitted) {
        setSubmitBusy(false);
        return;
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Registration failed");
    }
    setSubmitBusy(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <p className="mb-2 text-sm text-gray-500">
          <Link href="/" className="underline hover:text-gray-800">
            Home
          </Link>
        </p>
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Agent registration</h1>
        <p className="mb-8 text-sm text-gray-600">
          Apply for a verified agent profile. Optionally join an approved brokerage.
        </p>

        {!sessionReady ? (
          <div className="mb-8 space-y-4">
            <form
              onSubmit={handleGuestCombinedRegister}
              className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Account</h2>
                <p className="mt-1 text-xs text-gray-500">Create your login — same email will be used on your agent profile.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Dela Cruz"
                    autoComplete="name"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {authFieldErrors.name ? <p className="mt-1 text-sm text-red-600">{authFieldErrors.name}</p> : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {authFieldErrors.email ? <p className="mt-1 text-sm text-red-600">{authFieldErrors.email}</p> : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {authFieldErrors.password ? (
                  <p className="mt-1 text-sm text-red-600">{authFieldErrors.password}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {authFieldErrors.confirmPassword ? (
                  <p className="mt-1 text-sm text-red-600">{authFieldErrors.confirmPassword}</p>
                ) : null}
              </div>

              <div className="border-t border-gray-100 pt-5">
                <h2 className="text-sm font-semibold text-gray-900">Professional details</h2>
                <p className="mt-1 text-xs text-gray-500">PRC license and contact for your application.</p>
              </div>
              <PrcLicenseInput
                id="license_number_guest"
                value={licenseNumber}
                onChange={setLicenseNumber}
                error={detailErrors.licenseNumber}
              />
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  License expiry
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={(e) => setLicenseExpiry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {detailErrors.licenseExpiry ? (
                  <p className="mt-1 text-sm text-red-600">{detailErrors.licenseExpiry}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">PRC License Photo</p>
                <VerificationDropzone
                  id="prc_license_guest"
                  label="Upload your PRC ID or license card"
                  accept="image/*,application/pdf"
                  file={prcFile}
                  onChange={setPrcFile}
                  error={detailErrors.prcUpload}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">Selfie / Live Photo</p>
                <VerificationDropzone
                  id="selfie_guest"
                  label="Take or upload a clear photo of your face"
                  accept="image/*"
                  file={selfieFile}
                  onChange={setSelfieFile}
                  error={detailErrors.selfieUpload}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500" htmlFor="guest-agent-reg-phone">
                  Phone
                </label>
                <PhPhoneInput id="guest-agent-reg-phone" value={phone} onChange={setPhone} className="mt-1" />
                {detailErrors.phone ? <p className="mt-1 text-sm text-red-600">{detailErrors.phone}</p> : null}
              </div>
              <label className="block text-xs font-medium text-gray-500">
                Brokerage (optional)
                <select
                  value={brokerId}
                  onChange={(e) => setBrokerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                >
                  <option value="">Independent Agent</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.company_name}
                    </option>
                  ))}
                </select>
                {detailErrors.brokerId ? <p className="mt-1 text-sm text-red-600">{detailErrors.brokerId}</p> : null}
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Bio (optional)
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
                {detailErrors.bio ? <p className="mt-1 text-sm text-red-600">{detailErrors.bio}</p> : null}
              </label>

              {authNotice ? (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{authNotice}</p>
              ) : null}
              {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
              <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={dpaConsent}
                  onChange={(e) => setDpaConsent(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                />
                <span>
                  I consent to BahayGo collecting and storing my PRC license and identity documents for verification
                  purposes under the Data Privacy Act of 2012 (RA 10173).{" "}
                  <Link href="/privacy" className="font-semibold text-[#6B9E6E] underline">
                    View Privacy Policy
                  </Link>
                </span>
              </label>
              <button
                type="submit"
                disabled={submitBusy || !dpaConsent}
                title={!dpaConsent ? "Please agree to the data privacy terms" : undefined}
                className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {submitBusy ? "Submitting…" : "Register as Agent"}
              </button>
            </form>
            <p className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/auth/login?next=/register/agent" className="font-medium text-gray-900 underline">
                Sign in
              </Link>
            </p>
          </div>
        ) : done ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-sm text-green-900">
            <p className="mb-1 font-semibold">Application submitted</p>
            <p className="mb-4">
              Your agent profile is pending review. You will receive a notification when an admin has decided.
            </p>
            <Link href="/settings" className="font-medium underline">
              View profile status
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-sm text-gray-700">Signed in</span>
              <button type="button" onClick={() => void signOut()} className="text-sm text-gray-600 underline">
                Sign out
              </button>
            </div>
            <form onSubmit={handleRegister} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900">Agent details</h2>
              {profilePhotoLocked && profileAvatarUrl ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Profile photo</p>
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profileAvatarUrl}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover ring-1 ring-black/10 opacity-70"
                    />
                    <p className="text-xs text-gray-500">Photo is from your client profile.</p>
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={profileNameLocked}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-400 ${
                      profileNameLocked ? "border-gray-200 bg-gray-100 text-gray-500" : "border-gray-200 bg-white"
                    }`}
                  />
                </label>
                {profileNameLocked ? (
                  <p className="mt-1 text-xs text-gray-500">Update name in Profile settings</p>
                ) : null}
                {detailErrors.name ? <p className="mt-1 text-sm text-red-600">{detailErrors.name}</p> : null}
              </div>
              <PrcLicenseInput
                id="license_number_session"
                value={licenseNumber}
                onChange={setLicenseNumber}
                error={detailErrors.licenseNumber}
              />
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  License expiry
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={(e) => setLicenseExpiry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {detailErrors.licenseExpiry ? (
                  <p className="mt-1 text-sm text-red-600">{detailErrors.licenseExpiry}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">PRC License Photo</p>
                <VerificationDropzone
                  id="prc_license_session"
                  label="Upload your PRC ID or license card"
                  accept="image/*,application/pdf"
                  file={prcFile}
                  onChange={setPrcFile}
                  error={detailErrors.prcUpload}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">Selfie / Live Photo</p>
                <VerificationDropzone
                  id="selfie_session"
                  label="Take or upload a clear photo of your face"
                  accept="image/*"
                  file={selfieFile}
                  onChange={setSelfieFile}
                  error={detailErrors.selfieUpload}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500" htmlFor="agent-reg-phone">
                  Phone
                </label>
                <PhPhoneInput
                  id="agent-reg-phone"
                  value={phone}
                  onChange={setPhone}
                  className="mt-1"
                />
                {detailErrors.phone ? <p className="mt-1 text-sm text-red-600">{detailErrors.phone}</p> : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Email
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {detailErrors.regEmail ? <p className="mt-1 text-sm text-red-600">{detailErrors.regEmail}</p> : null}
              </div>
              <label className="block text-xs font-medium text-gray-500">
                Brokerage (optional)
                <select
                  value={brokerId}
                  onChange={(e) => setBrokerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                >
                  <option value="">Independent Agent</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.company_name}
                    </option>
                  ))}
                </select>
                {detailErrors.brokerId ? <p className="mt-1 text-sm text-red-600">{detailErrors.brokerId}</p> : null}
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Bio (optional)
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
                {detailErrors.bio ? <p className="mt-1 text-sm text-red-600">{detailErrors.bio}</p> : null}
              </label>
              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
              <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={dpaConsent}
                  onChange={(e) => setDpaConsent(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                />
                <span>
                  I consent to BahayGo collecting and storing my PRC license and identity documents for verification
                  purposes under the Data Privacy Act of 2012 (RA 10173).{" "}
                  <Link href="/privacy" className="font-semibold text-[#6B9E6E] underline">
                    View Privacy Policy
                  </Link>
                </span>
              </label>
              <button
                type="submit"
                disabled={submitBusy || !dpaConsent}
                title={!dpaConsent ? "Please agree to the data privacy terms" : undefined}
                className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {submitBusy ? "Submitting…" : "Submit for review"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
