import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { getSessionProfile } from "@/lib/admin-api-auth";

const ACCEPT = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const MAX_BYTES = 12 * 1024 * 1024;

function configureCloudinary() {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    return { error: "Cloudinary is not configured" as const };
  }
  cloudinary.config({ cloud_name, api_key, api_secret });
  return { ok: true as const };
}

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (
    session.role !== "agent" &&
    session.role !== "broker" &&
    session.role !== "admin"
  ) {
    return Response.json(
      { error: "Only agents can upload listing images" },
      { status: 403 },
    );
  }

  const cfg = configureCloudinary();
  if (!("ok" in cfg && cfg.ok)) {
    return Response.json({ error: cfg.error }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "file field required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "File too large (max 12MB)" },
      { status: 400 },
    );
  }
  const mime = (file.type || "").toLowerCase();
  if (!ACCEPT.has(mime)) {
    return Response.json(
      { error: "Only JPG, PNG, WEBP, PDF, DOC, DOCX, or TXT allowed" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const purposeRaw = String(formData.get("purpose") ?? "")
    .trim()
    .toLowerCase();
  const folderRaw = String(formData.get("folder") ?? "").trim();
  const isVerificationUpload =
    folderRaw === "bahaygo/verification" ||
    purposeRaw === "verification" ||
    purposeRaw === "prc" ||
    purposeRaw === "prc_verification";

  const uploadFolder = isVerificationUpload
    ? "bahaygo/verification"
    : "bahaygo/properties";

  const baseImageTransform = {
    width: 1200,
    crop: "limit" as const,
    quality: "auto",
    fetch_format: "auto",
  };

  /** Diagonal semi-transparent text watermark (PRC / identity docs only). */
  const verificationWatermarkTransform = {
    overlay: {
      font_family: "Arial",
      font_size: 40,
      font_weight: "bold" as const,
      text: "For BahayGo Verification Only",
    },
    color: "white",
    opacity: 50,
    angle: -30,
    gravity: "center" as const,
  };

  const transformation = isVerificationUpload
    ? [baseImageTransform, verificationWatermarkTransform]
    : [baseImageTransform];

  // Determine resource type based on file MIME type
  const isImage = mime.startsWith("image/");
  const resourceType = isImage ? "image" : "auto";

  try {
    const result = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: uploadFolder,
            resource_type: resourceType,
            transformation: isImage ? transformation : undefined,
          },
          (error, res) => {
            if (error) reject(error);
            else if (res?.secure_url && res.public_id) {
              resolve({ secure_url: res.secure_url, public_id: res.public_id });
            } else {
              reject(new Error("Upload returned no URL"));
            }
          },
        );
        Readable.from(buffer).pipe(uploadStream);
      },
    );

    return Response.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
